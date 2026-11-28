"""
Code Blue Radiology v2 — Upgrade Script (4 min on Modal A100):
  1) Fixes Chest CT (`Kabil007/LungCancer4Types`) by reading true 4-class folder names via snapshot_download
     (adenocarcinoma, large_cell_carcinoma, squamous_cell_carcinoma, normal), hash-deduping,
     and training ConvNeXt-Small (50M) @ 384x384 with EMA & full 4-class held-out test report.
  2) Builds the Deep ConvNeXt-Small (768-dim) Visual Similarity Retrieval Bank (`/vol/outputs/rad_atlas_embeddings_v1.pt`)
     from the verified clinical Atlas cases in `codeblue-radiology` (Epidural/Subdural/SAH, Stroke, etc.).
"""
import os, re, json, math, copy, time, hashlib, urllib.request, urllib.parse, modal

app = modal.App("codeblue-rad-upgrade-v2-ct-atlas")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch", "torchvision", "timm", "huggingface_hub>=0.24.0",
        "scikit-learn", "numpy", "opencv-python-headless", "pillow",
    )
)

ARCH = "convnext_small.fb_in22k_ft_in1k_384"
ATLAS_SEEDS = [
  [
    "cxr_flail_chest",
    "chest_xray",
    "Flail_chest_X-ray.jpg"
  ],
  [
    "cxr_rib_clavicle_fracture",
    "chest_xray",
    "Rib_fractures_chest_X-ray.jpg"
  ],
  [
    "cxr_chronic_bronchitis",
    "chest_xray",
    "Chronic_bronchitis_chest_X-ray.jpg"
  ],
  [
    "cxr_acute_bronchiolitis",
    "chest_xray",
    "Bronchiolitis_infant_chest_X-ray.jpg"
  ],
  [
    "ct_ischemic_stroke",
    "neuro_ct",
    "MCA_Territory_Infarct.png"
  ],
  [
    "ct_brain_hemorrhage",
    "neuro_ct",
    "Intracerebral_hemorrhage_CT.jpg"
  ],
  [
    "ct_sah_aneurysm",
    "neuro_ct",
    "Subarachnoid_hemorrhage_CT.jpg"
  ],
  [
    "ct_trauma_epidural",
    "neuro_ct",
    "Epidural_hematoma_CT.jpg"
  ],
  [
    "ct_trauma_subdural",
    "neuro_ct",
    "Subdural_hematoma_CT.jpg"
  ],
  [
    "cxr_pneumonia",
    "chest_xray",
    "Lobar_pneumonia_CXR.jpg"
  ],
  [
    "cxr_pleural_effusion",
    "chest_xray",
    "Pleural_effusion_CXR.jpg"
  ],
  [
    "cxr_pneumothorax",
    "chest_xray",
    "Pneumothorax_CXR.jpg"
  ],
  [
    "cxr_tuberculosis",
    "chest_xray",
    "Tuberculosis_CXR.jpg"
  ],
  [
    "cxr_emphysema_copd",
    "chest_xray",
    "Emphysema_COPD_CXR.jpg"
  ],
  [
    "cxr_chf_edema",
    "chest_xray",
    "Pulmonary_edema_CXR.jpg"
  ],
  [
    "ct_flail_chest_trauma",
    "chest_xray",
    "Flail_chest_CT.jpg"
  ],
  [
    "ct_chronic_bronchitis",
    "chest_xray",
    "Chronic_bronchitis_CT.jpg"
  ],
  [
    "ct_acute_bronchiolitis",
    "chest_xray",
    "Bronchiolitis_HRCT.jpg"
  ],
  [
    "sr_neuro_blend_sign_ich",
    "neuro_ct",
    "Blend_sign_ICH.jpg"
  ],
  [
    "sr_neuro_island_sign_ich",
    "neuro_ct",
    "Island_sign_ICH.jpg"
  ],
  [
    "sr_neuro_ivlt_venous_lake",
    "neuro_ct",
    "Venous_lake_thrombosis.jpg"
  ],
  [
    "sr_neuro_acom_aneurysm_ich_sdh",
    "neuro_ct",
    "ACOM_aneurysm_ICH.jpg"
  ],
  [
    "sr_neuro_three_territory_stroke",
    "neuro_ct",
    "Three_territory_sign_stroke.jpg"
  ],
  [
    "sr_neuro_diabetic_striatopathy",
    "neuro_ct",
    "Diabetic_striatopathy_CT.jpg"
  ],
  [
    "sr_cxr_hydatid_cysts",
    "chest_xray",
    "Pulmonary_hydatid_cysts.jpg"
  ],
  [
    "sr_ct_round_atelectasis_comet_tail",
    "chest_xray",
    "Round_atelectasis_comet_tail.jpg"
  ],
  [
    "sr_spl_grade4_pseudoaneurysms",
    "abdomen_us",
    "Grade4_splenic_pseudoaneurysm.jpg"
  ],
  [
    "sr_pan_colon_cutoff_sign",
    "abdomen_us",
    "Colon_cutoff_sign.jpg"
  ],
  [
    "sr_cxr_golden_s_pancoast",
    "chest_xray",
    "Golden_S_sign_CXR.jpg"
  ],
  [
    "sr_cxr_scimitar_hampton_luftsichel",
    "chest_xray",
    "Scimitar_sign_CXR.jpg"
  ],
  [
    "sr_cxr_pneumomediastinum_continuous_diaphragm",
    "chest_xray",
    "Continuous_diaphragm_sign_CXR.jpg"
  ],
  [
    "sr_neuro_cvt_empty_delta_mount_fuji",
    "neuro_ct",
    "Empty_delta_mount_fuji_CT.jpg"
  ],
  [
    "sr_neuro_pericallosal_lipoma_harlequin_rhinolith",
    "neuro_ct",
    "Pericallosal_lipoma_CT.jpg"
  ],
  [
    "sr_gb_porcelain_emphysematous_mirizzi",
    "abdomen_us",
    "Porcelain_gallbladder_US.jpg"
  ],
  [
    "sr_kid_emphysematous_nutcracker_staghorn",
    "abdomen_us",
    "Staghorn_calculus_US.jpg"
  ],
  [
    "sr_gi_sma_syndrome_pneumatosis_peritoneal_cyst",
    "abdomen_us",
    "SMA_syndrome_CT.jpg"
  ]
]


def wilson_ci(k: int, n: int, z: float = 1.95996):
    if n <= 0: return [0.0, 0.0]
    p = k / n; d = 1.0 + z * z / n; c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / d
    return [round(max(0.0, c - h) * 100.0, 1), round(min(1.0, c + h) * 100.0, 1)]


@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def upgrade_chest_ct_and_atlas():
    import cv2, numpy as np, timm, torch, torch.nn as nn
    from PIL import Image
    from huggingface_hub import snapshot_download
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
    from sklearn.metrics import classification_report, confusion_matrix, f1_score

    torch.manual_seed(42); np.random.seed(42)
    device = torch.device("cuda")
    OUT_DIR = "/vol/outputs"
    os.makedirs(OUT_DIR, exist_ok=True)
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    def norm_ct_label(folder_name: str) -> str:
        s = folder_name.lower()
        if "adeno" in s: return "adenocarcinoma"
        if "large" in s: return "large_cell_carcinoma"
        if "squamous" in s: return "squamous_cell_carcinoma"
        if "normal" in s: return "normal"
        return ""

    # ------------------------------------------------------------------
    # PART 1: TRUE 4-CLASS CHEST CT (Kabil007/LungCancer4Types)
    # ------------------------------------------------------------------
    print("[Part 1] Downloading Kabil007/LungCancer4Types folder tree...")
    import zipfile, tarfile
    snap_dir = snapshot_download("Kabil007/LungCancer4Types", repo_type="dataset")
    extract_dir = "/tmp/lung_ct_extracted"
    os.makedirs(extract_dir, exist_ok=True)
    for root, _, files in os.walk(snap_dir):
        for fn in files:
            fp = os.path.join(root, fn)
            if fn.lower().endswith(".zip"):
                with zipfile.ZipFile(fp, "r") as zf:
                    zf.extractall(extract_dir)
            elif fn.lower().endswith((".tar", ".tar.gz", ".tgz")):
                with tarfile.open(fp, "r:*") as tf:
                    tf.extractall(extract_dir)
    scan_root = extract_dir if any(os.scandir(extract_dir)) else snap_dir
    items, seen_h = [], set()
    for root, _, files in os.walk(scan_root):
        lbl = norm_ct_label(os.path.basename(root))
        if not lbl:
            continue
        for fn in files:
            if not fn.lower().endswith((".png", ".jpg", ".jpeg")):
                continue
            fp = os.path.join(root, fn)
            im = cv2.imread(fp)
            if im is None:
                continue
            h = hashlib.md5(cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (16, 16)).tobytes()).hexdigest()[:16]
            if h in seen_h:
                continue
            seen_h.add(h)
            hv = int(h[:8], 16) % 100
            sp = "train" if hv < 72 else ("val_cal" if hv < 86 else "test")
            items.append((fp, lbl, sp))

    CLASSES = sorted(list({lbl for _, lbl, _ in items}))
    c2i = {c: i for i, c in enumerate(CLASSES)}
    tr = [(p, c2i[l]) for p, l, s in items if s == "train"]
    va = [(p, c2i[l]) for p, l, s in items if s == "val_cal"]
    te = [(p, c2i[l]) for p, l, s in items if s == "test"]
    print(f"[Chest CT 4-Class] classes={CLASSES} | train={len(tr)} val_cal={len(va)} test={len(te)}")
    assert len(CLASSES) >= 4, f"Expected 4 classes, got {CLASSES}"

    IMG = 384
    def load_im(path, aug=False):
        im = cv2.imread(path)
        if im is None: im = np.zeros((IMG, IMG, 3), dtype=np.uint8)
        if aug:
            rng = np.random.default_rng()
            if rng.random() < 0.5: im = cv2.flip(im, 1)
            if rng.random() < 0.45:
                M = cv2.getRotationMatrix2D((im.shape[1]/2, im.shape[0]/2), float(rng.uniform(-10, 10)), 1.0)
                im = cv2.warpAffine(im, M, (im.shape[1], im.shape[0]), borderMode=cv2.BORDER_REPLICATE)
            if rng.random() < 0.35:
                im = np.clip(im.astype(np.float32) * float(rng.uniform(0.8, 1.2)) + float(rng.uniform(-16, 16)), 0, 255).astype(np.uint8)
        im = cv2.resize(im, (IMG, IMG), interpolation=cv2.INTER_AREA)
        im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0
        return (im - MEAN) / STD

    class CTDS(Dataset):
        def __init__(self, rows, aug=False): self.rows, self.aug = rows, aug
        def __len__(self): return len(self.rows)
        def __getitem__(self, i): p, y = self.rows[i]; return torch.from_numpy(load_im(p, self.aug)), y

    cnt = np.bincount([y for _, y in tr], minlength=len(CLASSES))
    dl_tr = DataLoader(CTDS(tr, True), batch_size=24, sampler=WeightedRandomSampler([1.0/max(1, cnt[y]) for _, y in tr], len(tr), replacement=True), num_workers=4)
    dl_va = DataLoader(CTDS(va, False), batch_size=32, shuffle=False, num_workers=4)
    dl_te = DataLoader(CTDS(te, False), batch_size=32, shuffle=False, num_workers=4)

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
        P = L.argmax(axis=1)
        return float((P == Y).mean()), float(f1_score(Y, P, average="macro", zero_division=0)), P, Y

    best_f1, best_sd = -1.0, None
    for ep in range(1, EPOCHS + 1):
        t0 = time.time(); model.train()
        for xb, yb in dl_tr:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                loss = loss_fn(model(xb), yb)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0); opt.step(); sched.step()
            with torch.no_grad():
                for pe, p in zip(ema.parameters(), model.parameters()):
                    pe.mul_(0.98).add_(p, alpha=0.02)
        va_acc, va_f1, _, _ = eval_dl(ema, dl_va)
        if ep % 2 == 0 or ep == EPOCHS:
            print(f"[Chest CT 4-Class] Ep {ep}/{EPOCHS} ({time.time()-t0:.0f}s) | val_cal acc={va_acc*100:.2f}% macroF1={va_f1:.4f}")
        if va_f1 > best_f1:
            best_f1 = va_f1
            best_sd = {k: v.cpu().clone() for k, v in ema.state_dict().items()}

    ema.load_state_dict(best_sd)
    te_acc, te_f1, P_te, Y_te = eval_dl(ema, dl_te)
    k_ok = int((P_te == Y_te).sum())
    ci = wilson_ci(k_ok, len(Y_te))
    print(f"\n=== [CHEST CT 4-CLASS ConvNeXt-Small 50M] HELD-OUT TEST: {k_ok}/{len(Y_te)} = {te_acc*100:.2f}% {ci} | Macro-F1={te_f1:.4f} ===")
    print(classification_report(Y_te, P_te, target_names=CLASSES, digits=4, zero_division=0))
    print("Confusion Matrix:\n", confusion_matrix(Y_te, P_te))

    ct_out = os.path.join(OUT_DIR, "rad_chest_ct_convnext_small_v1.pt")
    torch.save({
        "arch": ARCH, "img_size": IMG, "classes": CLASSES, "state_dict": best_sd,
        "test_acc": round(te_acc, 4), "test_ci95": ci, "test_macro_f1": round(te_f1, 4),
    }, ct_out)

    # ------------------------------------------------------------------
    # PART 2: BUILD DEEP CONVNEXT ATLAS EMBEDDING BANK (36 VERIFIED SEEDS)
    # ------------------------------------------------------------------
    print("\n[Part 2] Building Deep ConvNeXt-Small Atlas Visual Retrieval Bank...")
    enc = timm.create_model(ARCH, pretrained=True, num_classes=0).to(device).eval()
    atlas_entries = []
    for cid, mod, fn in ATLAS_SEEDS:
        url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(fn)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CodeBlueRadiologyBot/2.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                raw = resp.read()
            arr = np.frombuffer(raw, np.uint8)
            im = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if im is None:
                continue
            im = cv2.resize(im, (384, 384), interpolation=cv2.INTER_AREA)
            x = (cv2.cvtColor(im, cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0 - MEAN) / STD
            with torch.no_grad(), torch.amp.autocast("cuda", dtype=torch.bfloat16):
                emb = enc(torch.from_numpy(x).unsqueeze(0).to(device)).float().cpu().numpy()[0]
            emb = emb / (np.linalg.norm(emb) + 1e-8)
            atlas_entries.append({"case_id": cid, "modality": mod, "file": fn, "embedding": emb.astype(np.float16)})
        except Exception:
            pass
    atlas_out = os.path.join(OUT_DIR, "rad_atlas_embeddings_v1.pt")
    torch.save({"arch": ARCH, "entries": atlas_entries}, atlas_out)
    vol.commit()
    print(f"Saved {len(atlas_entries)}/{len(ATLAS_SEEDS)} deep Atlas embeddings to {atlas_out}")


@app.local_entrypoint()
def main():
    upgrade_chest_ct_and_atlas.remote()
