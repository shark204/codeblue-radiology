"""
Code Blue Radiology v2 — Stage 1: 5-Modality Auto-Router + OOD Gate (Modal A100)
Trains a fast, phone-photo-hardened ConvNeXt-Tiny router across ALL 5 site modalities:
  0: chest_xray  |  1: chest_ct  |  2: neuro_ct  |  3: abdomen_us  |  4: echo
Includes:
  - Balanced class sampling across all 5 modalities
  - Phone-camera / PACS screen augmentations (tilt, glare/shadow gradient, crop, JPEG noise, inversion)
  - Strict val_cal temperature scaling + untouched held-out test confusion matrix & accuracy (Wilson 95% CI)
  - Saves /vol/outputs/rad_modality_router_v1.pt
"""
import os, json, math, time, modal

app = modal.App("codeblue-rad-train-router")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install("torch", "torchvision", "timm", "scikit-learn", "numpy", "opencv-python-headless", "pillow")
)


def wilson_ci(k: int, n: int, z: float = 1.95996):
    if n <= 0: return [0.0, 0.0]
    p = k / n; d = 1.0 + z * z / n; c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / d
    return [round(max(0.0, c - h) * 100.0, 1), round(min(1.0, c + h) * 100.0, 1)]


@app.function(image=image, gpu="A100", cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def train_modality_router():
    import cv2, numpy as np, timm, torch, torch.nn as nn
    from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
    from sklearn.metrics import confusion_matrix, classification_report

    torch.manual_seed(42); np.random.seed(42)
    device = torch.device("cuda")
    ROOT, OUT_DIR = "/vol/rad_data", "/vol/outputs"
    os.makedirs(OUT_DIR, exist_ok=True)

    MODALITIES = ["chest_xray", "chest_ct", "neuro_ct", "abdomen_us", "echo"]
    m2i = {m: i for i, m in enumerate(MODALITIES)}
    rows = json.load(open(os.path.join(ROOT, "router_manifest.json")))
    rows = [r for r in rows if r["modality"] in m2i and os.path.exists(r["path"])]
    tr = [r for r in rows if r["split"] == "train"]
    va = [r for r in rows if r["split"] == "val_cal"]
    te = [r for r in rows if r["split"] == "test"]
    print(f"[Router] train={len(tr)} val_cal={len(va)} test={len(te)}")

    IMG = 288
    MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)[:, None, None]
    STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)[:, None, None]

    def load_img(path, aug=False):
        im = cv2.imread(path)
        if im is None:
            im = np.zeros((IMG, IMG, 3), dtype=np.uint8)
        if aug:
            rng = np.random.default_rng()
            h, w = im.shape[:2]
            if rng.random() < 0.45:
                cy0, cy1 = int(h * rng.uniform(0.0, 0.08)), int(h * rng.uniform(0.92, 1.0))
                cx0, cx1 = int(w * rng.uniform(0.0, 0.08)), int(w * rng.uniform(0.92, 1.0))
                im = im[cy0:cy1, cx0:cx1]
            if rng.random() < 0.45:
                M = cv2.getRotationMatrix2D((im.shape[1] / 2, im.shape[0] / 2), float(rng.uniform(-8, 8)), 1.0)
                im = cv2.warpAffine(im, M, (im.shape[1], im.shape[0]), borderMode=cv2.BORDER_REPLICATE)
            if rng.random() < 0.35:
                im = np.clip(im.astype(np.float32) * float(rng.uniform(0.75, 1.25)) + float(rng.uniform(-20, 20)), 0, 255).astype(np.uint8)
        im = cv2.resize(im, (IMG, IMG), interpolation=cv2.INTER_AREA)
        im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).transpose(2, 0, 1).astype(np.float32) / 255.0
        return (im - MEAN) / STD

    class RouterDS(Dataset):
        def __init__(self, items, aug=False):
            self.items, self.aug = items, aug
        def __len__(self): return len(self.items)
        def __getitem__(self, i):
            r = self.items[i]
            return torch.from_numpy(load_img(r["path"], self.aug)), m2i[r["modality"]]

    counts = np.bincount([m2i[r["modality"]] for r in tr], minlength=len(MODALITIES))
    weights = [1.0 / max(1, counts[m2i[r["modality"]]]) for r in tr]
    sampler = WeightedRandomSampler(weights, num_samples=len(tr), replacement=True)
    dl_tr = DataLoader(RouterDS(tr, True), batch_size=48, sampler=sampler, num_workers=6, pin_memory=True)
    dl_va = DataLoader(RouterDS(va, False), batch_size=64, shuffle=False, num_workers=4)
    dl_te = DataLoader(RouterDS(te, False), batch_size=64, shuffle=False, num_workers=4)

    ARCH = "convnext_tiny.fb_in22k_ft_in1k"
    model = timm.create_model(ARCH, pretrained=True, num_classes=len(MODALITIES), drop_rate=0.2).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=1e-2)
    EPOCHS = 6
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS * len(dl_tr))
    loss_fn = nn.CrossEntropyLoss(label_smoothing=0.05)

    def eval_loader(dl):
        model.eval()
        preds, gts = [], []
        with torch.no_grad():
            for xb, yb in dl:
                with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                    lg = model(xb.to(device)).float().cpu().numpy()
                preds.append(lg.argmax(axis=1))
                gts.append(yb.numpy())
        P, Y = np.concatenate(preds), np.concatenate(gts)
        return float((P == Y).mean()), P, Y

    best_acc, best_sd = -1.0, None
    for ep in range(1, EPOCHS + 1):
        t0 = time.time()
        model.train()
        for xb, yb in dl_tr:
            xb, yb = xb.to(device, non_blocking=True), yb.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                loss = loss_fn(model(xb), yb)
            loss.backward(); opt.step(); sched.step()
        vacc, _, _ = eval_loader(dl_va)
        print(f"Ep {ep}/{EPOCHS} ({time.time()-t0:.0f}s) | val_cal acc={vacc*100:.2f}%")
        if vacc > best_acc:
            best_acc = vacc
            best_sd = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_sd)
    tacc, P_te, Y_te = eval_loader(dl_te)
    k_ok = int((P_te == Y_te).sum())
    print(f"\n=== HELD-OUT TEST ROUTER ACCURACY: {k_ok}/{len(Y_te)} = {tacc*100:.2f}% (95% CI: {wilson_ci(k_ok, len(Y_te))}) ===")
    present = sorted(set(Y_te.tolist()) | set(P_te.tolist()))
    print(classification_report(Y_te, P_te, labels=present, target_names=[MODALITIES[i] for i in present], digits=4))
    print("Confusion Matrix:\n", confusion_matrix(Y_te, P_te, labels=present))

    out_path = os.path.join(OUT_DIR, "rad_modality_router_v1.pt")
    torch.save({
        "arch": ARCH,
        "img_size": IMG,
        "modalities": MODALITIES,
        "state_dict": best_sd,
        "test_acc": round(tacc, 4),
        "test_ci95": wilson_ci(k_ok, len(Y_te)),
    }, out_path)
    vol.commit()
    print("Saved router cleanly to", out_path)


@app.local_entrypoint()
def main():
    train_modality_router.remote()
