"""
Code Blue Radiology v2.1 — Fast CPU-Only Multi-Modality Deep Vision Server (Modal CPU)
Upgrades:
  - CPU-only PyTorch wheels (~350MB image vs ~3.5GB CUDA -> ~3x faster Cold Start!)
  - All 5 Modality-Routed ConvNeXt-Small (50M) Experts + TorchXRayVision CXR Ensemble
  - Paired ED+ES Echo contraction tensor support ([ED, ES, |ED-ES|]) with single-frame fallback
  - Real Supabase Atlas Similar-Case Retrieval (`rad_atlas_embeddings_v1.pt`)
  - Real-time Grad-CAM localization overlay & CXR CTR estimate
"""
import io, os, time, base64, logging
from typing import Any, Dict, List, Optional, Tuple
import modal

app = modal.App("codeblue-radiology-ai")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch", "torchvision",
        extra_index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install(
        "fastapi[standard]", "python-multipart", "timm",
        "numpy", "pillow", "opencv-python-headless", "torchxrayvision",
    )
)


@app.function(
    image=image, cpu=4.0, memory=12288, timeout=300, scaledown_window=300, volumes={"/vol": vol}
)
@modal.asgi_app()
def fastapi_app():
    import cv2, numpy as np, timm, torch, torch.nn as nn
    from PIL import Image
    from fastapi import FastAPI, File, Form, UploadFile
    from fastapi.middleware.cors import CORSMiddleware

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("codeblue-rad-ai")
    torch.set_num_threads(4)
    DEVICE = torch.device("cpu")
    OUT_DIR = "/vol/outputs"

    api = FastAPI(title="Code Blue Radiology v2.1 Multi-Modality AI", version="2.1.0")
    api.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]
    MODALITIES = ["chest_xray", "chest_ct", "neuro_ct", "abdomen_us", "echo"]

    MODELS: Dict[str, Dict[str, Any]] = {}
    XRV_MODEL = None
    XRV_PATHOLOGIES: List[str] = []
    ATLAS_BANK: Optional[Dict[str, Any]] = None

    def _load_ckpt_model(key: str, fname: str) -> Optional[Dict[str, Any]]:
        if key in MODELS:
            return MODELS[key]
        path = os.path.join(OUT_DIR, fname)
        if not os.path.exists(path):
            return None
        ck = torch.load(path, map_location=DEVICE, weights_only=False)
        classes = ck.get("classes", ck.get("modalities", []))
        m = timm.create_model(ck["arch"], pretrained=False, num_classes=len(classes)).to(DEVICE).eval()
        m.load_state_dict(ck["state_dict"])
        entry = {
            "model": m,
            "classes": list(classes),
            "img_size": int(ck.get("img_size", 384)),
            "paired_ed_es": bool(ck.get("paired_ed_es", False)),
            "platt_a": np.array(ck["platt_a"], dtype=np.float32) if "platt_a" in ck else None,
            "platt_b": np.array(ck["platt_b"], dtype=np.float32) if "platt_b" in ck else None,
            "thresholds": dict(ck.get("thresholds", {})),
            "arch": ck.get("arch", ""),
        }
        MODELS[key] = entry
        logger.info(f"Loaded {key}: {entry['arch']} ({len(classes)} classes, paired={entry['paired_ed_es']})")
        return entry

    def _get_xrv():
        nonlocal XRV_MODEL, XRV_PATHOLOGIES
        if XRV_MODEL is not None:
            return XRV_MODEL, XRV_PATHOLOGIES
        try:
            import torchxrayvision as xrv
            XRV_MODEL = xrv.models.DenseNet(weights="densenet121-res224-all").to(DEVICE).eval()
            XRV_PATHOLOGIES = list(XRV_MODEL.pathologies)
            logger.info(f"Loaded TorchXRayVision DenseNet121 ({len(XRV_PATHOLOGIES)} pathologies)")
        except Exception as e:
            logger.warning(f"TorchXRayVision unavailable: {e}")
        return XRV_MODEL, XRV_PATHOLOGIES

    def _get_atlas_bank() -> Optional[Dict[str, Any]]:
        nonlocal ATLAS_BANK
        if ATLAS_BANK is not None:
            return ATLAS_BANK
        p = os.path.join(OUT_DIR, "rad_atlas_embeddings_v1.pt")
        if not os.path.exists(p):
            return None
        try:
            ATLAS_BANK = torch.load(p, map_location="cpu", weights_only=False)
            logger.info(f"Loaded Atlas Embedding Bank ({len(ATLAS_BANK.get('items', []))} real cases)")
        except Exception as e:
            logger.warning(f"Atlas bank load failed: {e}")
        return ATLAS_BANK

    _load_ckpt_model("router", "rad_modality_router_v1.pt")

    def prep_tensor(img_bgr: np.ndarray, sz: int) -> torch.Tensor:
        im = cv2.resize(img_bgr, (sz, sz), interpolation=cv2.INTER_AREA)
        im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0
        return torch.from_numpy((im - MEAN) / STD).unsqueeze(0).to(DEVICE)

    def prep_paired_echo_tensor(ed_bgr: np.ndarray, es_bgr: Optional[np.ndarray], sz: int) -> torch.Tensor:
        g_ed = cv2.cvtColor(cv2.resize(ed_bgr, (sz, sz), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
        if es_bgr is not None:
            g_es = cv2.cvtColor(cv2.resize(es_bgr, (sz, sz), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
            diff = np.abs(g_ed - g_es)
        else:
            g_es = g_ed.copy()
            diff = np.zeros_like(g_ed)
        arr = np.stack([g_ed, g_es, diff], axis=0)
        return torch.from_numpy((arr - MEAN) / STD).unsqueeze(0).to(DEVICE)

    def query_similar_atlas(router_model: nn.Module, xr: torch.Tensor, modality: str, top_k: int = 3) -> List[Dict[str, Any]]:
        bank = _get_atlas_bank()
        if not bank or not bank.get("items"):
            return []
        try:
            with torch.no_grad():
                feat = router_model.forward_features(xr)
                emb = router_model.forward_head(feat, pre_logits=True).numpy()[0]
                emb = emb / (np.linalg.norm(emb) + 1e-8)
            embs = bank["embeddings"]  # (N, D) L2-normalized numpy
            items = bank["items"]
            sims = embs @ emb
            ranked = []
            for idx, score in enumerate(sims):
                it = items[idx]
                if it.get("modality") == modality or modality == "chest_ct" and it.get("modality") == "chest_xray":
                    ranked.append((float(score), it))
            ranked.sort(key=lambda t: t[0], reverse=True)
            out = []
            for sc, it in ranked[:top_k]:
                out.append({
                    "id": it.get("id", ""),
                    "title_en": it.get("title_en", ""),
                    "title_ar": it.get("title_ar", ""),
                    "modality": it.get("modality", modality),
                    "icd10": it.get("icd10", ""),
                    "image_url": it.get("image_url", ""),
                    "similarity": round(max(0.0, min(1.0, sc)), 3),
                })
            return out
        except Exception as e:
            logger.warning(f"Atlas similarity skipped: {e}")
            return []

    def check_medical_quality(img_bgr: np.ndarray) -> Tuple[bool, str, Dict[str, Any]]:
        h, w = img_bgr.shape[:2]
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        std_c = float(gray.std())
        mean_b = float(gray.mean())
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        sat_high = float((hsv[:, :, 1] > 90).mean())
        if min(h, w) < 96:
            return False, "Image resolution too low (<96px). Please upload a clearer medical scan.", {}
        if std_c < 8.0:
            return False, "Image appears blank or uniform contrast. Please upload a valid scan.", {}
        if sat_high > 0.65:
            return False, "Image appears to be a colorful non-medical photo rather than a radiology scan.", {}
        return True, "", {"width": w, "height": h, "contrast": round(std_c, 1), "brightness": round(mean_b, 1)}

    def estimate_cxr_ctr(img_bgr: np.ndarray) -> Optional[float]:
        try:
            g = cv2.cvtColor(cv2.resize(img_bgr, (256, 256)), cv2.COLOR_BGR2GRAY)
            band = g[120:200, :]
            prof = band.mean(axis=0)
            lung_thr = np.percentile(prof, 35)
            lung_cols = np.where(prof <= lung_thr)[0]
            if len(lung_cols) < 20:
                return None
            thorax_w = max(40.0, float(lung_cols[-1] - lung_cols[0]))
            mid_band = prof[int(lung_cols[0] + thorax_w * 0.2):int(lung_cols[-1] - thorax_w * 0.2)]
            if len(mid_band) < 10:
                return None
            heart_w = float((mid_band > np.percentile(prof, 62)).sum())
            return round(float(np.clip(heart_w / thorax_w, 0.34, 0.72)), 2)
        except Exception:
            return None

    def compute_gradcam(model: nn.Module, x: torch.Tensor, target_idx: int, img_bgr: np.ndarray) -> Tuple[Optional[str], str]:
        feats: Dict[str, torch.Tensor] = {}
        grads: Dict[str, torch.Tensor] = {}
        target_layer = model.stages[-1] if hasattr(model, "stages") else (model.features[-1] if hasattr(model, "features") else None)
        if target_layer is None:
            return None, "Global Scan Field"

        def _f(_m, _i, o): feats["a"] = o
        def _b(_m, _gi, go): grads["g"] = go[0]; return None

        h1 = target_layer.register_forward_hook(_f)
        h2 = target_layer.register_full_backward_hook(_b)
        try:
            model.zero_grad()
            logits = model(x)
            logits[0, target_idx].backward()
            w = grads["g"].mean(dim=(2, 3), keepdim=True)
            cam = torch.relu((w * feats["a"]).sum(dim=1)).squeeze().detach().cpu().numpy()
            cam = cv2.resize(cam / (cam.max() + 1e-8), (384, 384))
            heat = cv2.cvtColor(cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
            orig = cv2.cvtColor(cv2.resize(img_bgr, (384, 384), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
            overlay = (0.64 * orig + 0.36 * heat).astype(np.uint8)
            buf = io.BytesIO()
            Image.fromarray(overlay).save(buf, format="JPEG", quality=84)
            url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
            cy, cx = np.unravel_index(int(np.argmax(cam)), cam.shape)
            v_pos = "Upper" if cy < 128 else ("Mid" if cy < 256 else "Lower")
            h_pos = "Right (Viewer Left)" if cx < 145 else ("Central / Mediastinal" if cx < 240 else "Left (Viewer Right)")
            return url, f"{v_pos} {h_pos} Zone"
        except Exception as e:
            logger.warning(f"Grad-CAM skipped: {e}")
            return None, "Global Scan Field"
        finally:
            h1.remove(); h2.remove()

    EXPERT_FILES = {
        "chest_xray": "rad_cxr_convnext_small_v1.pt",
        "chest_ct": "rad_chest_ct_convnext_small_v1.pt",
        "neuro_ct": "rad_neuro_ct_convnext_small_v1.pt",
        "abdomen_us": "rad_abdomen_us_convnext_small_v1.pt",
        "echo": "rad_echo_convnext_small_v1.pt",
    }

    @api.get("/health")
    def health():
        available = [k for k, fn in EXPERT_FILES.items() if os.path.exists(os.path.join(OUT_DIR, fn))]
        atlas_ready = os.path.exists(os.path.join(OUT_DIR, "rad_atlas_embeddings_v1.pt"))
        return {
            "status": "ok",
            "version": "codeblue-radiology-v2.1-cpu-fast",
            "router_ready": os.path.exists(os.path.join(OUT_DIR, "rad_modality_router_v1.pt")),
            "experts_ready": available,
            "atlas_bank_ready": atlas_ready,
            "xrv_supported": True,
        }

    @api.post("/analyze-radiology")
    async def analyze_radiology(
        file: UploadFile = File(...),
        modality_hint: str = Form("auto"),
        file_es: Optional[UploadFile] = File(None),
    ):
        t0 = time.time()
        raw = await file.read()
        pil_img = Image.open(io.BytesIO(raw)).convert("RGB")
        img_bgr = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        es_bgr = None
        if file_es is not None:
            raw_es = await file_es.read()
            if raw_es:
                es_bgr = cv2.cvtColor(np.array(Image.open(io.BytesIO(raw_es)).convert("RGB")), cv2.COLOR_RGB2BGR)

        ok_q, reason, q_meta = check_medical_quality(img_bgr)
        if not ok_q:
            return {
                "ok": True, "invalid_scan": True, "invalid_reason": reason,
                "elapsed_sec": round(time.time() - t0, 2), "findings": [], "quality": q_meta,
            }

        # 1) Modality Auto-Router + Similar Real Atlas Retrieval
        detected_mod = modality_hint if modality_hint in MODALITIES else "chest_xray"
        router_probs: Dict[str, float] = {}
        similar_atlas_cases: List[Dict[str, Any]] = []
        router_ent = _load_ckpt_model("router", "rad_modality_router_v1.pt")
        if router_ent is not None:
            xr = prep_tensor(img_bgr, router_ent["img_size"])
            with torch.no_grad():
                lg = router_ent["model"](xr).numpy()[0]
            pr = np.exp(lg - lg.max()); pr /= pr.sum()
            router_probs = {router_ent["classes"][i]: round(float(pr[i]), 3) for i in range(len(pr))}
            if modality_hint == "auto":
                detected_mod = router_ent["classes"][int(np.argmax(pr))]
            similar_atlas_cases = query_similar_atlas(router_ent["model"], xr, detected_mod, top_k=3)

        # 2) Run Modality-Specific ConvNeXt-Small (50M) Expert
        exp = _load_ckpt_model(detected_mod, EXPERT_FILES[detected_mod])
        findings: List[Dict[str, Any]] = []
        gradcam_url, focus_region = None, "Global Scan Field"
        measurements: Dict[str, Any] = {}

        if detected_mod == "chest_xray":
            ctr = estimate_cxr_ctr(img_bgr)
            if ctr is not None:
                measurements["ctr_ratio"] = ctr
        elif detected_mod == "echo":
            measurements["echo_paired_ed_es"] = bool(es_bgr is not None)

        if exp is not None:
            if detected_mod == "echo" and exp.get("paired_ed_es"):
                x = prep_paired_echo_tensor(img_bgr, es_bgr, exp["img_size"])
            else:
                x = prep_tensor(img_bgr, exp["img_size"])

            with torch.no_grad():
                lg = exp["model"](x).numpy()[0]
            classes = exp["classes"]

            if detected_mod == "chest_xray":
                if exp["platt_a"] is not None and exp["platt_b"] is not None:
                    probs = 1.0 / (1.0 + np.exp(-np.clip(exp["platt_a"] * lg + exp["platt_b"], -30, 30)))
                else:
                    probs = 1.0 / (1.0 + np.exp(-np.clip(lg, -30, 30)))
                xrv_m, xrv_p = _get_xrv()
                if xrv_m is not None:
                    try:
                        import torchxrayvision as xrv
                        g224 = cv2.resize(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY), (224, 224))
                        x_xrv = torch.from_numpy(xrv.datasets.normalize(g224, 255)[None, None, :, :]).float()
                        with torch.no_grad():
                            p_xrv = xrv_m(x_xrv).numpy()[0]
                        xrv_map = {xrv_p[i]: float(p_xrv[i]) for i in range(len(xrv_p))}
                        for j, cn in enumerate(classes):
                            if cn in xrv_map:
                                probs[j] = 0.60 * probs[j] + 0.40 * xrv_map[cn]
                    except Exception as e:
                        logger.warning(f"XRV blend skipped: {e}")
                thrs = exp["thresholds"]
                top_idx = int(np.argmax(probs))
                gradcam_url, focus_region = compute_gradcam(exp["model"], x, top_idx, img_bgr)
                for j, cn in enumerate(classes):
                    thr = float(thrs.get(cn, 0.35))
                    findings.append({
                        "code": cn.upper().replace(" ", "_"),
                        "label": cn,
                        "probability": round(float(probs[j]), 4),
                        "threshold": thr,
                        "positive": bool(probs[j] >= thr),
                    })
            else:
                probs = np.exp(lg - lg.max()); probs /= probs.sum()
                NOISE_LABELS = {"[0]", "[1]", "[]", "optimal", "suboptimal", "0"}
                top_idx = int(np.argmax(probs))
                gradcam_url, focus_region = compute_gradcam(exp["model"], x, top_idx, img_bgr)
                for j, cn in enumerate(classes):
                    if cn.strip().lower() in NOISE_LABELS:
                        continue
                    findings.append({
                        "code": cn.upper().replace(" ", "_"),
                        "label": cn.replace("_", " ").title(),
                        "probability": round(float(probs[j]), 4),
                        "threshold": 0.35,
                        "positive": bool(j == top_idx or probs[j] >= 0.30),
                    })
            findings.sort(key=lambda d: d["probability"], reverse=True)

        return {
            "ok": True,
            "invalid_scan": False,
            "engine": f"codeblue-rad-v2.1-{detected_mod}",
            "detected_modality": detected_mod,
            "router_probabilities": router_probs,
            "elapsed_sec": round(time.time() - t0, 2),
            "findings": findings[:8],
            "measurements": measurements,
            "gradcam_url": gradcam_url,
            "gradcam_focus_region": focus_region,
            "similar_atlas_cases": similar_atlas_cases,
            "quality": q_meta,
        }

    return api
