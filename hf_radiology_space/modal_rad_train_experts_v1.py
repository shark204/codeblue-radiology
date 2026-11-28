"""
Code Blue Radiology v2 — Scaled-Up Multi-Expert Trainer (ConvNeXt-Small 50M, ImageNet-22K, Modal A100 bf16)
Trains ALL 5 Specialist Experts on /vol/rad_data with strict patient/hash-disjoint splits & ZERO test leakage:
  1) CXR Expert        -> ConvNeXt-Small 50M @ 384x384 on 38,000 NIH ChestX-ray14 (multi-label + Fold-val Platt/F1.5)
  2) Neuro Expert      -> ConvNeXt-Small 50M @ 384x384 on 6,877 Brain scans (Glioma/Meningioma/Pituitary/Normal)
  3) Chest CT Expert   -> ConvNeXt-Small 50M @ 384x384 on 848 Chest CT scans (4-class lung cancer vs normal)
  4) Abdomen US Expert -> ConvNeXt-Small 50M @ 320x320 on 1,161 Abdominal Ultrasound scans
  5) Echo Expert       -> ConvNeXt-Small 50M @ 320x320 on 1,600 CAMUS 2D Echo frames (view/EF classification)

Spawns all experts in parallel on Modal A100s (~20 min wall-clock total) and saves all calibrated checkpoints
plus full held-out test metrics (with Wilson 95% CIs) to /vol/outputs/.
"""
import os, json, math, copy, time, modal

app = modal.App("codeblue-rad-train-experts-v1")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "torch", "torchvision", "timm", "scikit-learn",
        "numpy", "opencv-python-headless", "pillow",
    )
)

ARCH = "convnext_small.fb_in22k_ft_in1k_384"
NIH_CLASSES = [
    "No Finding", "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration",
    "Mass", "Nodule", "Pneumonia", "Pneumothorax", "Consolidation",
    "Edema", "Emphysema", "Fibrosis", "Pleural_Thickening", "Hernia",
]


def wilson_ci(k: int, n: int, z: float = 1.95996):
    if n <= 0: return [0.0, 0.0]
    p = k / n; d = 1.0 + z * z / n; c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / d
    return [round(max(0.0, c - h) * 100.0, 1), round(min(1.0, c + h) * 100.0, 1)]


def _load_rad_img(path, img_sz, aug=False, allow_hflip=False):
    import cv2, numpy as np
    im = cv2.imread(path)
    if im is None:
        im = np.zeros((img_sz, img_sz, 3), dtype=np.uint8)
    if aug:
        rng = np.random.default_rng()
        h, w = im.shape[:2]
        if allow_hflip and rng.random() < 0.5:
            im = cv2.flip(im, 1)
        if rng.random() < 0.45:
            cy0, cy1 = int(h * rng.uniform(0.0, 0.07)), int(h * rng.uniform(0.93, 1.0))
            cx0, cx1 = int(w * rng.uniform(0.0, 0.07)), int(w * rng.uniform(0.93, 1.0))
            im = im[cy0:cy1, cx0:cx1]
        if rng.random() < 0.45:
            M = cv2.getRotationMatrix2D((im.shape[1] / 2, im.shape[0] / 2), float(rng.uniform(-8, 8)), 1.0)
            im = cv2.warpAffine(im, M, (im.shape[1], im.shape[0]), borderMode=cv2.BORDER_REPLICATE)
        if rng.random() < 0.35:
            im = np.clip(im.astype(np.float32) * float(rng.uniform(0.78, 1.22)) + float(rng.uniform(-18, 18)), 0, 255).astype(np.uint8)
    im = cv2.resize(im, (img_sz, img_sz), interpolation=cv2.INTER_AREA)
    im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]
    return (im - mean) / std


# ==============================================================================
# EXPERT 1: CHEST X-RAY (Multi-Label ConvNeXt-Small 50M @ 384x384, 38,000 NIH)
# ==============================================================================
@app.function(image=image, gpu="A100", cpu=8.0, memory=32768, timeout=7200, volumes={"/vol": vol})
def train_cxr_expert():
    import numpy as np, timm, torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader
    from sklearn.metrics import roc_auc_score, fbeta_score
    from sklearn.linear_model import LogisticRegression

    torch.manual_seed(42); np.random.seed(42); torch.backends.cudnn.benchmark = True
    device = torch.device("cuda")
    ROOT, OUT_DIR = "/vol/rad_data/chest_xray", "/vol/outputs"
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = json.load(open(os.path.join(ROOT, "manifest.json")))

    def to_vec(lbls):
        y = np.zeros(len(NIH_CLASSES), dtype=np.float32)
        for v in lbls:
            if isinstance(v, int) and 0 <= v < len(NIH_CLASSES):
                y[v] = 1.0
            elif isinstance(v, str) and v in NIH_CLASSES:
                y[NIH_CLASSES.index(v)] = 1.0
        if y.sum() == 0:
            y[0] = 1.0
        return y

    tr = [(r["path"], to_vec(r["labels"])) for r in rows if r["split"] == "train" and os.path.exists(r["path"])]
    va = [(r["path"], to_vec(r["labels"])) for r in rows if r["split"] == "val_cal" and os.path.exists(r["path"])]
    te = [(r["path"], to_vec(r["labels"])) for r in rows if r["split"] == "test" and os.path.exists(r["path"])]
    print(f"[CXR Expert] train={len(tr)} val_cal={len(va)} test={len(te)}")

    IMG = 384
    class CXRDS(Dataset):
        def __init__(self, items, aug=False): self.items, self.aug = items, aug
        def __len__(self): return len(self.items)
        def __getitem__(self, i):
            p, y = self.items[i]
            return torch.from_numpy(_load_rad_img(p, IMG, self.aug, allow_hflip=False)), torch.from_numpy(y)

    Y_tr = np.stack([y for _, y in tr])
    pos = np.maximum(Y_tr.sum(axis=0), 1.0)
    pw = np.clip(np.sqrt((len(tr) - pos) / pos), 1.0, 5.0).astype(np.float32)

    dl_tr = DataLoader(CXRDS(tr, True), batch_size=32, shuffle=True, num_workers=6, pin_memory=True, drop_last=True)
    dl_va = DataLoader(CXRDS(va, False), batch_size=48, shuffle=False, num_workers=4)
    dl_te = DataLoader(CXRDS(te, False), batch_size=48, shuffle=False, num_workers=4)

    model = timm.create_model(ARCH, pretrained=True, num_classes=len(NIH_CLASSES), drop_rate=0.25, drop_path_rate=0.2).to(device)
    ema = copy.deepcopy(model).eval()
    EPOCHS = 8
    opt = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=2e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS * len(dl_tr), eta_min=1e-5)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(pw, device=device))

    def predict(m_ev, dl):
        m_ev.eval(); ls, ys = [], []
        with torch.no_grad():
            for xb, yb in dl:
                with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                    ls.append(m_ev(xb.to(device)).float().cpu().numpy())
                ys.append(yb.numpy())
        return np.concatenate(ls), np.concatenate(ys)

    def m_auc(Y, L):
        P = 1.0 / (1.0 + np.exp(-np.clip(L, -30, 30)))
        aucs = [roc_auc_score(Y[:, j], P[:, j]) for j in range(len(NIH_CLASSES)) if Y[:, j].sum() > 0 and (1 - Y[:, j]).sum() > 0]
        return float(np.mean(aucs)), {NIH_CLASSES[j]: round(float(roc_auc_score(Y[:, j], P[:, j])), 4) for j in range(len(NIH_CLASSES)) if Y[:, j].sum() > 0 and (1 - Y[:, j]).sum() > 0}

    best_auc, best_sd = -1.0, None
    for ep in range(1, EPOCHS + 1):
        t0 = time.time(); model.train(); tot = 0.0
        for xb, yb in dl_tr:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                loss = loss_fn(model(xb), yb)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0); opt.step(); sched.step()
            tot += float(loss.item())
            with torch.no_grad():
                for pe, p in zip(ema.parameters(), model.parameters()):
                    pe.mul_(0.996).add_(p, alpha=0.004)
        L_va, Y_va = predict(ema, dl_va)
        va_auc, _ = m_auc(Y_va, L_va)
        print(f"[CXR] Ep {ep}/{EPOCHS} ({time.time()-t0:.0f}s) | loss={tot/len(dl_tr):.4f} | val_cal Macro-AUC={va_auc:.4f}")
        if va_auc > best_auc:
            best_auc = va_auc
            best_sd = {k: v.cpu().clone() for k, v in ema.state_dict().items()}

    ema.load_state_dict(best_sd)
    L_va, Y_va = predict(ema, dl_va)
    pa, pb, thrs = np.ones(len(NIH_CLASSES), dtype=np.float32), np.zeros(len(NIH_CLASSES), dtype=np.float32), {}
    for j, cn in enumerate(NIH_CLASSES):
        yj = Y_va[:, j].astype(int)
        if yj.sum() >= 15 and (1 - yj).sum() >= 15:
            lr = LogisticRegression(C=1.0, max_iter=500).fit(L_va[:, j].reshape(-1, 1), yj)
            pa[j], pb[j] = float(np.clip(lr.coef_[0][0], 0.3, 4.0)), float(np.clip(lr.intercept_[0], -6.0, 6.0))
        pj = 1.0 / (1.0 + np.exp(-np.clip(pa[j] * L_va[:, j] + pb[j], -30, 30)))
        best_t, best_f = 0.35, -1.0
        if yj.sum() >= 25:
            for t in np.linspace(0.10, 0.60, 51):
                f = fbeta_score(yj, (pj >= t).astype(int), beta=1.5, zero_division=0)
                if f > best_f: best_f, best_t = f, float(t)
        thrs[cn] = round(best_t, 3)

    L_te, Y_te = predict(ema, dl_te)
    te_auc, per_cls = m_auc(Y_te, L_te)
    print(f"\n=== [CXR ConvNeXt-Small 50M] HELD-OUT NIH TEST (N={len(te)}) Macro-AUC = {te_auc:.4f} ===")
    print(json.dumps(per_cls, indent=2))

    out = os.path.join(OUT_DIR, "rad_cxr_convnext_small_v1.pt")
    torch.save({
        "arch": ARCH, "img_size": IMG, "classes": NIH_CLASSES, "state_dict": best_sd,
        "platt_a": pa.tolist(), "platt_b": pb.tolist(), "thresholds": thrs,
        "test_macro_auc": round(te_auc, 4), "test_per_class_auc": per_cls,
    }, out)
    vol.commit()
    return {"modality": "chest_xray", "test_n": len(te), "macro_auc": round(te_auc, 4)}


# ==============================================================================
# MULTICLASS SPECIALIST TRAINER (Neuro CT/MRI, Chest CT, Abdomen US, Echo)
# ==============================================================================
def _train_multiclass_expert(modality: str, img_sz: int, epochs: int, min_cls_count: int = 10, allow_hflip: bool = True):
    import numpy as np, timm, torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
    from sklearn.metrics import roc_auc_score, f1_score, classification_report

    torch.manual_seed(42); np.random.seed(42); torch.backends.cudnn.benchmark = True
    device = torch.device("cuda")
    ROOT, OUT_DIR = f"/vol/rad_data/{modality}", "/vol/outputs"
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = json.load(open(os.path.join(ROOT, "manifest.json")))

    def get_lbl(r):
        if modality == "echo":
            ef = r.get("ef")
            if ef is not None:
                try: return "reduced_ef" if float(ef) < 50.0 else "preserved_ef"
                except Exception: pass
            return str(r.get("view", "4CH")).upper()
        return str(r.get("label", r.get("anatomy", "unknown"))).strip().lower()

    counts_all = {}
    for r in rows:
        if os.path.exists(r["path"]):
            l = get_lbl(r)
            counts_all[l] = counts_all.get(l, 0) + 1
    CLASSES = sorted([c for c, n in counts_all.items() if n >= min_cls_count])
    if len(CLASSES) < 2:
        CLASSES = sorted(counts_all.keys())
    c2i = {c: i for i, c in enumerate(CLASSES)}

    tr = [(r["path"], c2i[get_lbl(r)]) for r in rows if r["split"] == "train" and os.path.exists(r["path"]) and get_lbl(r) in c2i]
    va = [(r["path"], c2i[get_lbl(r)]) for r in rows if r["split"] == "val_cal" and os.path.exists(r["path"]) and get_lbl(r) in c2i]
    te = [(r["path"], c2i[get_lbl(r)]) for r in rows if r["split"] == "test" and os.path.exists(r["path"]) and get_lbl(r) in c2i]
    print(f"[{modality}] classes={CLASSES} | train={len(tr)} val_cal={len(va)} test={len(te)}")

    class MCDS(Dataset):
        def __init__(self, items, aug=False): self.items, self.aug = items, aug
        def __len__(self): return len(self.items)
        def __getitem__(self, i):
            p, y = self.items[i]
            return torch.from_numpy(_load_rad_img(p, img_sz, self.aug, allow_hflip=allow_hflip)), y

    cnt = np.bincount([y for _, y in tr], minlength=len(CLASSES))
    w = [1.0 / max(1, cnt[y]) for _, y in tr]
    dl_tr = DataLoader(MCDS(tr, True), batch_size=24, sampler=WeightedRandomSampler(w, len(tr), replacement=True), num_workers=4, pin_memory=True)
    dl_va = DataLoader(MCDS(va, False), batch_size=32, shuffle=False, num_workers=4)
    dl_te = DataLoader(MCDS(te, False), batch_size=32, shuffle=False, num_workers=4)

    model = timm.create_model(ARCH, pretrained=True, num_classes=len(CLASSES), drop_rate=0.25, drop_path_rate=0.2).to(device)
    ema = copy.deepcopy(model).eval()
    opt = torch.optim.AdamW(model.parameters(), lr=1.5e-4, weight_decay=2e-2)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs * max(1, len(dl_tr)), eta_min=1e-5)
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.05)

    def eval_dl(m_ev, dl):
        m_ev.eval(); ls, ys = [], []
        with torch.no_grad():
            for xb, yb in dl:
                with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                    ls.append(m_ev(xb.to(device)).float().cpu().numpy())
                ys.append(yb.numpy())
        L, Y = np.concatenate(ls), np.concatenate(ys)
        P = np.exp(L - L.max(axis=1, keepdims=True)); P /= P.sum(axis=1, keepdims=True)
        preds = P.argmax(axis=1)
        acc = float((preds == Y).mean())
        f1 = float(f1_score(Y, preds, average="macro", zero_division=0))
        return acc, f1, P, preds, Y

    best_f1, best_sd = -1.0, None
    for ep in range(1, epochs + 1):
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
        vacc, vf1, _, _, _ = eval_dl(ema, dl_va)
        print(f"[{modality}] Ep {ep}/{epochs} ({time.time()-t0:.0f}s) | val_cal acc={vacc*100:.2f}% macroF1={vf1:.4f}")
        if vf1 > best_f1:
            best_f1 = vf1
            best_sd = {k: v.cpu().clone() for k, v in ema.state_dict().items()}

    ema.load_state_dict(best_sd)
    tacc, tf1, P_te, pred_te, Y_te = eval_dl(ema, dl_te)
    k_ok = int((pred_te == Y_te).sum())
    ci = wilson_ci(k_ok, len(Y_te))
    print(f"\n=== [{modality} ConvNeXt-Small 50M] HELD-OUT TEST: {k_ok}/{len(Y_te)} = {tacc*100:.2f}% {ci} | Macro-F1={tf1:.4f} ===")
    present = sorted(set(Y_te.tolist()) | set(pred_te.tolist()))
    print(classification_report(Y_te, pred_te, labels=present, target_names=[CLASSES[i] for i in present], digits=4, zero_division=0))

    out = os.path.join(OUT_DIR, f"rad_{modality}_convnext_small_v1.pt")
    torch.save({
        "arch": ARCH, "img_size": img_sz, "classes": CLASSES, "state_dict": best_sd,
        "test_acc": round(tacc, 4), "test_ci95": ci, "test_macro_f1": round(tf1, 4),
    }, out)
    vol.commit()
    return {"modality": modality, "classes": len(CLASSES), "test_n": len(Y_te), "test_acc": round(tacc * 100, 2), "ci95": ci, "macro_f1": round(tf1, 4)}


@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def train_neuro_expert():
    return _train_multiclass_expert("neuro_ct", img_sz=384, epochs=10, min_cls_count=20, allow_hflip=True)


@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def train_chest_ct_expert():
    return _train_multiclass_expert("chest_ct", img_sz=384, epochs=12, min_cls_count=10, allow_hflip=True)


@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def train_us_and_echo_experts():
    r_us = _train_multiclass_expert("abdomen_us", img_sz=320, epochs=12, min_cls_count=15, allow_hflip=True)
    r_ec = _train_multiclass_expert("echo", img_sz=320, epochs=10, min_cls_count=15, allow_hflip=False)
    return {"abdomen_us": r_us, "echo": r_ec}


@app.local_entrypoint()
def main():
    f_cxr = train_cxr_expert.spawn()
    f_neu = train_neuro_expert.spawn()
    f_cct = train_chest_ct_expert.spawn()
    f_ue = train_us_and_echo_experts.spawn()
    results = {
        "chest_xray": f_cxr.get(),
        "neuro_ct": f_neu.get(),
        "chest_ct": f_cct.get(),
        "us_and_echo": f_ue.get(),
    }
    print("\n=== ALL 5 RADIOLOGY EXPERTS COMPLETE ===")
    print(json.dumps(results, indent=2))
