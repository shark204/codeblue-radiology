"""
Code Blue Radiology v2.1 — Scientific Upgrade Suite (Modal A100)
Runs 3 high-impact upgrades in parallel and saves to /vol/outputs/:
  1) Expanded Abdomen US Expert (ConvNeXt-Small 50M):
     Streams real Abdominal Ultrasound cases from `eltorio/ROCOv2-radiology` + existing clean U2-Bench pancreas cases
     across emergency clinical classes: Gallbladder/Cholecystitis, Hydronephrosis/Renal Stone,
     Liver Fatty/Cirrhosis/Lesion, Ascites/Free Fluid, Pancreas Mass, and Normal Abdomen US.
  2) Paired ED+ES Echo Expert (ConvNeXt-Small 50M):
     Pairs CAMUS End-Diastolic (ED) + End-Systolic (ES) frames per patient/view into a 3-channel
     contraction tensor [ED, ES, |ED - ES|] (with single-frame dropout augmentation so 1-image fallback also works).
  3) Supabase Real Atlas Embedding Bank (`rad_atlas_embeddings_v1.pt`):
     Pulls real PACS Atlas images directly from the user's Supabase `radiology-scans-bucket` (zero Wikimedia limits)
     and computes L2-normalized router embeddings for Top-3 Similar Real Case retrieval.
"""
import io, os, re, json, math, copy, time, hashlib, urllib.request
from typing import Dict, List, Optional, Tuple
import modal

app = modal.App("codeblue-rad-upgrade-v3")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch", "torchvision", "timm", "scikit-learn",
        "numpy", "opencv-python-headless", "pillow", "datasets", "huggingface_hub>=0.24.0",
    )
)

ARCH = "convnext_small.fb_in22k_ft_in1k_384"


def wilson_ci(k: int, n: int, z: float = 1.95996):
    if n <= 0:
        return [0.0, 0.0]
    p = k / n
    d = 1.0 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / d
    return [round(max(0.0, c - h) * 100.0, 1), round(min(1.0, c + h) * 100.0, 1)]


# ==============================================================================
# PART 1: EXPANDED ABDOMEN US EXPERT (ROCOv2 Ultrasound + U2-Bench Pancreas)
# ==============================================================================
@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def upgrade_abdomen_us_expert():
    import cv2, numpy as np, timm, torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
    from sklearn.metrics import f1_score, classification_report
    from datasets import load_dataset

    torch.manual_seed(42); np.random.seed(42); torch.backends.cudnn.benchmark = True
    device = torch.device("cuda")
    SAVE_DIR = "/vol/rad_data/abdomen_us_v3"
    OUT_DIR = "/vol/outputs"
    os.makedirs(SAVE_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1) Gather clean pancreas cases from existing U2-Bench manifest
    items: List[Tuple[str, str, str]] = []  # (path, label, group_key)
    seen_hash = set()
    old_manifest = "/vol/rad_data/abdomen_us/manifest.json"
    if os.path.exists(old_manifest):
        for r in json.load(open(old_manifest)):
            p = r.get("path", "")
            lbl = str(r.get("label", "")).strip().lower()
            if not os.path.exists(p):
                continue
            if lbl == "pancreas cancer":
                h = hashlib.md5(open(p, "rb").read()).hexdigest()
                if h not in seen_hash:
                    seen_hash.add(h)
                    items.append((p, "pancreas_mass", r.get("patient_id", h)))

    # 2) Stream eltorio/ROCOv2-radiology for clinical Abdominal Ultrasound images
    RULES = [
        ("gallbladder_stone_cholecystitis", r"\b(gallstone|gallstones|cholelithiasis|cholecystitis|gallbladder stone|biliary sludge|murphy)\b"),
        ("hydronephrosis_renal_stone", r"\b(hydronephrosis|nephrolithiasis|renal stone|kidney stone|urolithiasis|renal calculus|hydroureter)\b"),
        ("liver_lesion_fatty_cirrhosis", r"\b(fatty liver|hepatic steatosis|cirrhosis|hepatocellular|liver mass|hepatic lesion|hemangioma|liver abscess)\b"),
        ("ascites_free_fluid", r"\b(ascites|free fluid|hemoperitoneum|morison|peritoneal fluid)\b"),
        ("pancreas_mass", r"\b(pancreatic mass|pancreatic cancer|pancreatic tumor|pancreatic head mass)\b"),
        ("normal_abdomen_us", r"\b(normal liver|normal kidney|normal gallbladder|normal abdominal ultrasound|unremarkable abdominal)\b"),
    ]
    US_RE = re.compile(r"\b(ultrasound|ultrasonography|sonography|sonogram|usg)\b", re.I)
    EXCLUDE_RE = re.compile(r"\b(fetal|fetus|obstetric|pregnancy|thyroid|breast|scrotal|testicular|carotid|echocardiography|transesophageal|brain|cranial|knee|shoulder)\b", re.I)

    caps = {k: 0 for k, _ in RULES}
    MAX_PER_CLASS = 320
    print("[Abdomen US v3] Streaming eltorio/ROCOv2-radiology for abdominal ultrasound...")
    for split_name in ("train", "validation", "test"):
        try:
            ds = load_dataset("eltorio/ROCOv2-radiology", split=split_name, streaming=True)
        except Exception as e:
            print(f"[Abdomen US v3] Split {split_name} skipped: {e}")
            continue
        for row in ds:
            cap = str(row.get("caption", "") or "")
            if not US_RE.search(cap) or EXCLUDE_RE.search(cap):
                continue
            matched = None
            for cls_name, pat in RULES:
                if caps[cls_name] < MAX_PER_CLASS and re.search(pat, cap, re.I):
                    matched = cls_name
                    break
            if not matched:
                continue
            img = row.get("image")
            if img is None:
                continue
            try:
                rgb = img.convert("RGB")
                buf = io.BytesIO()
                rgb.save(buf, format="JPEG", quality=90)
                raw = buf.getvalue()
                h = hashlib.md5(raw).hexdigest()
                if h in seen_hash:
                    continue
                seen_hash.add(h)
                out_p = os.path.join(SAVE_DIR, f"{matched}_{h[:12]}.jpg")
                with open(out_p, "wb") as f:
                    f.write(raw)
                items.append((out_p, matched, h))
                caps[matched] += 1
            except Exception:
                continue
            if all(v >= MAX_PER_CLASS for v in caps.values()):
                break

    print(f"[Abdomen US v3] Collected ROCOv2 counts: {caps} | total items={len(items)}")

    # Filter classes with >= 25 samples
    cnt_map: Dict[str, int] = {}
    for _, l, _ in items:
        cnt_map[l] = cnt_map.get(l, 0) + 1
    CLASSES = sorted([c for c, n in cnt_map.items() if n >= 25])
    c2i = {c: i for i, c in enumerate(CLASSES)}
    filtered = [(p, c2i[l], g) for p, l, g in items if l in c2i]

    # Deterministic stratified 75 / 12.5 / 12.5 split
    tr, va, te = [], [], []
    by_cls: Dict[int, List[Tuple[str, int]]] = {i: [] for i in range(len(CLASSES))}
    for p, y, _ in filtered:
        by_cls[y].append((p, y))
    rng = np.random.default_rng(42)
    for y, lst in by_cls.items():
        idx = rng.permutation(len(lst))
        n_te = max(4, int(len(lst) * 0.125))
        n_va = max(4, int(len(lst) * 0.125))
        te.extend([lst[i] for i in idx[:n_te]])
        va.extend([lst[i] for i in idx[n_te:n_te + n_va]])
        tr.extend([lst[i] for i in idx[n_te + n_va:]])

    print(f"[Abdomen US v3] classes={CLASSES} | train={len(tr)} val={len(va)} test={len(te)}")
    IMG = 320
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    class USDS(Dataset):
        def __init__(self, data, aug=False): self.data, self.aug = data, aug
        def __len__(self): return len(self.data)
        def __getitem__(self, i):
            p, y = self.data[i]
            im = cv2.imread(p)
            if im is None: im = np.zeros((IMG, IMG, 3), dtype=np.uint8)
            if self.aug:
                r = np.random.default_rng()
                if r.random() < 0.5: im = cv2.flip(im, 1)
                if r.random() < 0.45:
                    h, w = im.shape[:2]
                    im = im[int(h * r.uniform(0, 0.06)):int(h * r.uniform(0.94, 1)), int(w * r.uniform(0, 0.06)):int(w * r.uniform(0.94, 1))]
                if r.random() < 0.35:
                    im = np.clip(im.astype(np.float32) * float(r.uniform(0.8, 1.2)) + float(r.uniform(-15, 15)), 0, 255).astype(np.uint8)
            im = cv2.cvtColor(cv2.resize(im, (IMG, IMG), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0
            return torch.from_numpy((im - MEAN) / STD), y

    cnt = np.bincount([y for _, y in tr], minlength=len(CLASSES))
    w = [1.0 / max(1, cnt[y]) for _, y in tr]
    dl_tr = DataLoader(USDS(tr, True), batch_size=24, sampler=WeightedRandomSampler(w, len(tr), replacement=True), num_workers=4, pin_memory=True)
    dl_va = DataLoader(USDS(va, False), batch_size=32, shuffle=False, num_workers=4)
    dl_te = DataLoader(USDS(te, False), batch_size=32, shuffle=False, num_workers=4)

    model = timm.create_model(ARCH, pretrained=True, num_classes=len(CLASSES), drop_rate=0.25, drop_path_rate=0.2).to(device)
    ema = copy.deepcopy(model).eval()
    EPOCHS = 14
    opt = torch.optim.AdamW(model.parameters(), lr=1.5e-4, weight_decay=2e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS * max(1, len(dl_tr)), eta_min=1e-5)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.05)

    def eval_dl(m_ev, dl):
        m_ev.eval(); ls, ys = [], []
        with torch.no_grad():
            for xb, yb in dl:
                with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                    ls.append(m_ev(xb.to(device)).float().cpu().numpy())
                ys.append(yb.numpy())
        L, Y = np.concatenate(ls), np.concatenate(ys)
        preds = L.argmax(axis=1)
        return float((preds == Y).mean()), float(f1_score(Y, preds, average="macro", zero_division=0)), preds, Y

    best_f1, best_sd = -1.0, None
    for ep in range(1, EPOCHS + 1):
        t0 = time.time(); model.train()
        for xb, yb in dl_tr:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                loss = loss_fn(model(xb), yb)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0); opt.step(); sched.step()
            with torch.no_grad():
                for pe, p in zip(ema.parameters(), model.parameters()):
                    pe.mul_(0.985).add_(p, alpha=0.015)
        vacc, vf1, _, _ = eval_dl(ema, dl_va)
        if ep % 2 == 0 or ep == EPOCHS:
            print(f"[Abdomen US v3] Ep {ep}/{EPOCHS} ({time.time()-t0:.0f}s) | val acc={vacc*100:.2f}% macroF1={vf1:.4f}")
        if vf1 > best_f1:
            best_f1 = vf1
            best_sd = {k: v.cpu().clone() for k, v in ema.state_dict().items()}

    ema.load_state_dict(best_sd)
    tacc, tf1, pred_te, Y_te = eval_dl(ema, dl_te)
    k_ok = int((pred_te == Y_te).sum())
    ci = wilson_ci(k_ok, len(Y_te))
    print(f"\n=== [ABDOMEN US v3 MULTI-ORGAN ConvNeXt-Small 50M] TEST: {k_ok}/{len(Y_te)} = {tacc*100:.2f}% {ci} | Macro-F1={tf1:.4f} ===")
    print(classification_report(Y_te, pred_te, target_names=CLASSES, digits=4, zero_division=0))

    torch.save({
        "arch": ARCH, "img_size": IMG, "classes": CLASSES, "state_dict": best_sd,
        "test_acc": round(tacc, 4), "test_ci95": ci, "test_macro_f1": round(tf1, 4),
    }, os.path.join(OUT_DIR, "rad_abdomen_us_convnext_small_v1.pt"))
    vol.commit()
    return {"modality": "abdomen_us_v3", "classes": CLASSES, "test_n": len(Y_te), "test_acc": round(tacc * 100, 2), "ci95": ci, "macro_f1": round(tf1, 4)}


# ==============================================================================
# PART 2: PAIRED ED+ES ECHO EXPERT (CAMUS [ED, ES, |ED-ES|] Contraction Tensor)
# ==============================================================================
@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def upgrade_echo_paired_ed_es():
    import cv2, numpy as np, timm, torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
    from sklearn.metrics import f1_score, classification_report

    torch.manual_seed(42); np.random.seed(42); torch.backends.cudnn.benchmark = True
    device = torch.device("cuda")
    ROOT, OUT_DIR = "/vol/rad_data/echo", "/vol/outputs"
    rows = json.load(open(os.path.join(ROOT, "manifest.json")))

    # Group ED + ES frames by (split, patient_id, view)
    grouped: Dict[Tuple[str, str, str], Dict[str, any]] = {}
    for r in rows:
        p = r.get("path", "")
        if not os.path.exists(p) or r.get("ef") is None:
            continue
        pid = str(r.get("patient_id", ""))
        view = str(r.get("view", "4CH")).upper()
        sp = str(r.get("split", "train"))
        phase = "ES" if ("_ES" in os.path.basename(p).upper() or str(r.get("phase", "")).upper() == "ES") else "ED"
        key = (sp, pid, view)
        if key not in grouped:
            grouped[key] = {"ef": float(r["ef"]), "ED": None, "ES": None}
        grouped[key][phase] = p

    CLASSES = ["preserved_ef", "reduced_ef"]
    tr, va, te = [], [], []
    for (sp, pid, view), info in grouped.items():
        ed_p = info["ED"] or info["ES"]
        es_p = info["ES"] or info["ED"]
        if not ed_p:
            continue
        y = 1 if info["ef"] < 50.0 else 0
        rec = (ed_p, es_p, y)
        if sp == "train": tr.append(rec)
        elif sp == "val_cal": va.append(rec)
        else: te.append(rec)

    print(f"[Echo Paired ED+ES] train_pairs={len(tr)} val_pairs={len(va)} test_pairs={len(te)}")
    IMG = 320
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    class EchoPairDS(Dataset):
        def __init__(self, items, aug=False): self.items, self.aug = items, aug
        def __len__(self): return len(self.items)
        def __getitem__(self, i):
            ed_p, es_p, y = self.items[i]
            ed = cv2.imread(ed_p, cv2.IMREAD_GRAYSCALE)
            es = cv2.imread(es_p, cv2.IMREAD_GRAYSCALE)
            if ed is None: ed = np.zeros((IMG, IMG), dtype=np.uint8)
            if es is None: es = ed.copy()
            ed = cv2.resize(ed, (IMG, IMG), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
            es = cv2.resize(es, (IMG, IMG), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
            if self.aug:
                r = np.random.default_rng()
                # 20% single-frame dropout so single-image uploads still work cleanly
                if r.random() < 0.20:
                    es = ed.copy()
                if r.random() < 0.40:
                    ang = float(r.uniform(-7, 7))
                    M = cv2.getRotationMatrix2D((IMG / 2, IMG / 2), ang, float(r.uniform(0.94, 1.06)))
                    ed = cv2.warpAffine(ed, M, (IMG, IMG), borderMode=cv2.BORDER_REPLICATE)
                    es = cv2.warpAffine(es, M, (IMG, IMG), borderMode=cv2.BORDER_REPLICATE)
                if r.random() < 0.35:
                    gain = float(r.uniform(0.85, 1.15))
                    ed = np.clip(ed * gain, 0.0, 1.0)
                    es = np.clip(es * gain, 0.0, 1.0)
            diff = np.abs(ed - es)
            arr = np.stack([ed, es, diff], axis=0)
            return torch.from_numpy((arr - MEAN) / STD), y

    cnt = np.bincount([y for _, _, y in tr], minlength=2)
    w = [1.0 / max(1, cnt[y]) for _, _, y in tr]
    dl_tr = DataLoader(EchoPairDS(tr, True), batch_size=24, sampler=WeightedRandomSampler(w, len(tr), replacement=True), num_workers=4, pin_memory=True)
    dl_va = DataLoader(EchoPairDS(va, False), batch_size=32, shuffle=False, num_workers=4)
    dl_te = DataLoader(EchoPairDS(te, False), batch_size=32, shuffle=False, num_workers=4)

    model = timm.create_model(ARCH, pretrained=True, num_classes=2, drop_rate=0.25, drop_path_rate=0.2).to(device)
    ema = copy.deepcopy(model).eval()
    EPOCHS = 14
    opt = torch.optim.AdamW(model.parameters(), lr=1.5e-4, weight_decay=2e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS * max(1, len(dl_tr)), eta_min=1e-5)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.05)

    def eval_dl(m_ev, dl):
        m_ev.eval(); ls, ys = [], []
        with torch.no_grad():
            for xb, yb in dl:
                with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                    ls.append(m_ev(xb.to(device)).float().cpu().numpy())
                ys.append(yb.numpy())
        L, Y = np.concatenate(ls), np.concatenate(ys)
        preds = L.argmax(axis=1)
        return float((preds == Y).mean()), float(f1_score(Y, preds, average="macro", zero_division=0)), preds, Y

    best_f1, best_sd = -1.0, None
    for ep in range(1, EPOCHS + 1):
        t0 = time.time(); model.train()
        for xb, yb in dl_tr:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                loss = loss_fn(model(xb), yb)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0); opt.step(); sched.step()
            with torch.no_grad():
                for pe, p in zip(ema.parameters(), model.parameters()):
                    pe.mul_(0.985).add_(p, alpha=0.015)
        vacc, vf1, _, _ = eval_dl(ema, dl_va)
        if ep % 2 == 0 or ep == EPOCHS:
            print(f"[Echo Paired ED+ES] Ep {ep}/{EPOCHS} ({time.time()-t0:.0f}s) | val acc={vacc*100:.2f}% macroF1={vf1:.4f}")
        if vf1 > best_f1:
            best_f1 = vf1
            best_sd = {k: v.cpu().clone() for k, v in ema.state_dict().items()}

    ema.load_state_dict(best_sd)
    tacc, tf1, pred_te, Y_te = eval_dl(ema, dl_te)
    k_ok = int((pred_te == Y_te).sum())
    ci = wilson_ci(k_ok, len(Y_te))
    print(f"\n=== [ECHO PAIRED ED+ES ConvNeXt-Small 50M] TEST: {k_ok}/{len(Y_te)} = {tacc*100:.2f}% {ci} | Macro-F1={tf1:.4f} ===")
    print(classification_report(Y_te, pred_te, target_names=CLASSES, digits=4, zero_division=0))

    torch.save({
        "arch": ARCH, "img_size": IMG, "classes": CLASSES, "paired_ed_es": True,
        "state_dict": best_sd, "test_acc": round(tacc, 4), "test_ci95": ci, "test_macro_f1": round(tf1, 4),
    }, os.path.join(OUT_DIR, "rad_echo_convnext_small_v1.pt"))
    vol.commit()
    return {"modality": "echo_paired_ed_es", "test_n": len(Y_te), "test_acc": round(tacc * 100, 2), "ci95": ci, "macro_f1": round(tf1, 4)}


# ==============================================================================
# PART 3: SUPABASE REAL ATLAS EMBEDDING BANK (Similar Real Cases Retrieval)
# ==============================================================================
@app.function(image=image, cpu=4.0, memory=8192, timeout=1200, volumes={"/vol": vol})
def build_supabase_atlas_bank(supabase_url: str, supabase_key: str):
    import cv2, numpy as np, timm, torch
    from PIL import Image

    OUT_DIR = "/vol/outputs"
    if not supabase_url or not supabase_key:
        print("[Atlas Bank] Skipped: supabase_url or supabase_key not provided.")
        return {"atlas_cases_embedded": 0, "skipped": True}

    ck_path = os.path.join(OUT_DIR, "rad_modality_router_v1.pt")
    ck = torch.load(ck_path, map_location="cpu", weights_only=False)
    classes = ck.get("classes", ck.get("modalities", []))
    model = timm.create_model(ck["arch"], pretrained=False, num_classes=len(classes)).eval()
    model.load_state_dict(ck["state_dict"])
    img_sz = int(ck.get("img_size", 256))
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    rest_url = f"{supabase_url.rstrip('/')}/rest/v1/radiology_cases?select=id,modality,icd10_code,title_en,title_ar,real_scan_image_url&limit=1000"
    req = urllib.request.Request(rest_url, headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        rows = json.loads(resp.read().decode("utf-8"))
    print(f"[Atlas Bank] Fetched {len(rows)} rows from Supabase radiology_cases")

    embs, items = [], []
    for r in rows:
        u = str(r.get("real_scan_image_url") or "").strip()
        if not u.startswith("http"):
            continue
        try:
            ireq = urllib.request.Request(u, headers={"User-Agent": "CodeBlueRadiology/2.1"})
            with urllib.request.urlopen(ireq, timeout=15) as iresp:
                pil = Image.open(io.BytesIO(iresp.read())).convert("RGB")
            im = cv2.resize(np.array(pil), (img_sz, img_sz), interpolation=cv2.INTER_AREA).transpose(2, 0, 1).astype(np.float32) / 255.0
            x = torch.from_numpy((im - MEAN) / STD).unsqueeze(0)
            with torch.no_grad():
                feat = model.forward_features(x)
                emb = model.forward_head(feat, pre_logits=True).numpy()[0]
                emb = emb / (np.linalg.norm(emb) + 1e-8)
            embs.append(emb.astype(np.float32))
            items.append({
                "id": r.get("id", ""),
                "modality": r.get("modality", "chest_xray"),
                "icd10": r.get("icd10_code", ""),
                "title_en": r.get("title_en", ""),
                "title_ar": r.get("title_ar", ""),
                "image_url": u,
            })
        except Exception:
            continue

    if embs:
        torch.save({"embeddings": np.stack(embs), "items": items}, os.path.join(OUT_DIR, "rad_atlas_embeddings_v1.pt"))
        vol.commit()
    print(f"[Atlas Bank] Embedded {len(items)} real PACS Atlas cases from Supabase!")
    return {"atlas_cases_embedded": len(items)}


@app.local_entrypoint()
def main(supabase_url: str = "", supabase_key: str = ""):
    f_us = upgrade_abdomen_us_expert.spawn()
    f_ec = upgrade_echo_paired_ed_es.spawn()
    f_at = build_supabase_atlas_bank.spawn(supabase_url, supabase_key)
    res = {"abdomen_us": f_us.get(), "echo": f_ec.get(), "atlas_bank": f_at.get()}
    print("\n=== RADIOLOGY v2.1 SCIENTIFIC UPGRADES COMPLETE ===")
    print(json.dumps(res, indent=2))
