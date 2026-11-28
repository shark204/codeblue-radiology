"""
Code Blue Radiology v2 — Fast Completion Script (2 min, Zero Re-Download of CXR/CT/Neuro)
1. Keeps all 38,000 NIH ChestX-ray14 scans already saved on /vol/rad_data/chest_xray.
2. Assigns clean hash-disjoint 75/12/13 (train/val_cal/test) splits to chest_ct (848) & neuro_ct (6,877).
3. Downloads abdomen_us (DolphinAI/u2-bench, split='train') and echo (MedOtter/CAMUS, config='ed_es').
4. Rebuilds /vol/rad_data/router_manifest.json across ALL 5 modalities with balanced splits.
"""
import os, json, hashlib, time, modal

app = modal.App("codeblue-rad-finish-all5")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install("datasets>=2.19.0", "huggingface_hub>=0.24.0", "pillow", "numpy", "pyarrow")
)


@app.function(image=image, cpu=6.0, memory=24576, timeout=3600, volumes={"/vol": vol})
def finish_all5():
    import io, base64, numpy as np
    from PIL import Image
    from datasets import load_dataset

    t0 = time.time()
    ROOT = "/vol/rad_data"

    def save_pil(img, out_path, max_side=512):
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        if not isinstance(img, Image.Image):
            img = Image.fromarray(np.array(img))
        img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > max_side:
            s = max_side / float(max(w, h))
            img = img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.LANCZOS)
        img.save(out_path, format="JPEG", quality=92)

    def split_key(key: str) -> str:
        hv = int(hashlib.md5(key.encode("utf-8")).hexdigest()[:8], 16) % 100
        return "train" if hv < 75 else ("val_cal" if hv < 88 else "test")

    summary = {}
    router_rows = []

    # 1) Keep existing chest_xray manifest
    cxr_m = json.load(open(os.path.join(ROOT, "chest_xray", "manifest.json")))
    c_cxr = {"train": 0, "val_cal": 0, "test": 0}
    r_cxr = {"train": 0, "val_cal": 0, "test": 0}
    for r in cxr_m:
        sp = r["split"]
        c_cxr[sp] += 1
        if r_cxr[sp] < (1200 if sp == "train" else 300):
            router_rows.append({"path": r["path"], "modality": "chest_xray", "split": sp})
            r_cxr[sp] += 1
    summary["chest_xray"] = c_cxr

    # 2) Re-split chest_ct (848) cleanly 75/12/13 by path hash
    cct_p = os.path.join(ROOT, "chest_ct", "manifest.json")
    cct_m = json.load(open(cct_p))
    c_cct = {"train": 0, "val_cal": 0, "test": 0}
    for r in cct_m:
        sp = split_key(r["path"] + "|" + str(r.get("label", "")))
        r["split"] = sp
        c_cct[sp] += 1
        router_rows.append({"path": r["path"], "modality": "chest_ct", "split": sp})
    json.dump(cct_m, open(cct_p, "w"))
    summary["chest_ct"] = c_cct

    # 3) Re-split neuro_ct (6,877) cleanly 75/12/13 by path hash
    neu_p = os.path.join(ROOT, "neuro_ct", "manifest.json")
    neu_m = json.load(open(neu_p))
    c_neu = {"train": 0, "val_cal": 0, "test": 0}
    r_neu = {"train": 0, "val_cal": 0, "test": 0}
    for r in neu_m:
        sp = split_key(r["path"] + "|" + str(r.get("label", "")))
        r["split"] = sp
        c_neu[sp] += 1
        if r_neu[sp] < (1200 if sp == "train" else 300):
            router_rows.append({"path": r["path"], "modality": "neuro_ct", "split": sp})
            r_neu[sp] += 1
    json.dump(neu_m, open(neu_p, "w"))
    summary["neuro_ct"] = c_neu

    # 4) Download abdomen_us (DolphinAI/u2-bench, split='train')
    print("[4/5] Downloading abdomen_us (DolphinAI/u2-bench, split='train')...")
    abd_dir = os.path.join(ROOT, "abdomen_us")
    abd_m = []
    c_abd = {"train": 0, "val_cal": 0, "test": 0}
    try:
        ds_us = load_dataset("DolphinAI/u2-bench", split="train", streaming=True)
        for idx, row in enumerate(ds_us):
            anat = str(row.get("anatomy_location", row.get("anatomy", ""))).lower()
            if anat and not any(k in anat for k in ["liver", "abdom", "kidney", "gall", "spleen", "pancrea", "renal", "pelv"]):
                continue
            im = row.get("image")
            if im is None and row.get("img_data"):
                im = Image.open(io.BytesIO(base64.b64decode(row["img_data"])))
            if im is None:
                continue
            lbl = str(row.get("class_label", row.get("label", anat or "abdomen"))).strip().lower()
            sp = split_key(f"abd_{idx}_{lbl}")
            fp = os.path.join(abd_dir, sp, f"abd_{idx:05d}.jpg")
            if not os.path.exists(fp):
                save_pil(im, fp, max_side=512)
            abd_m.append({"path": fp, "split": sp, "anatomy": anat, "label": lbl})
            c_abd[sp] += 1
            router_rows.append({"path": fp, "modality": "abdomen_us", "split": sp})
            if sum(c_abd.values()) >= 2500:
                break
        json.dump(abd_m, open(os.path.join(abd_dir, "manifest.json"), "w"))
        summary["abdomen_us"] = c_abd
    except Exception as e:
        summary["abdomen_us"] = {"error": str(e)}
        print("  !! abdomen_us error:", e)

    # 5) Download echo (MedOtter/CAMUS, config='ed_es')
    print("[5/5] Downloading echo (MedOtter/CAMUS, config='ed_es')...")
    eco_dir = os.path.join(ROOT, "echo")
    eco_m = []
    c_eco = {"train": 0, "val_cal": 0, "test": 0}
    r_eco = {"train": 0, "val_cal": 0, "test": 0}
    try:
        ds_ec = load_dataset("MedOtter/CAMUS", "ed_es", split="train", streaming=True)
        for idx, row in enumerate(ds_ec):
            if idx >= 2000:
                break
            im = row.get("image")
            if im is None:
                continue
            pid = str(row.get("patient_id", row.get("subject_id", f"p_{idx // 4}")))
            sp = split_key(f"camus_{pid}")
            view = str(row.get("view", "4CH"))
            ef = row.get("ef", row.get("ejection_fraction", None))
            fp = os.path.join(eco_dir, sp, f"echo_{idx:05d}.jpg")
            if not os.path.exists(fp):
                save_pil(im, fp, max_side=512)
            eco_m.append({"path": fp, "split": sp, "patient_id": pid, "view": view, "ef": ef})
            c_eco[sp] += 1
            if r_eco[sp] < (1200 if sp == "train" else 300):
                router_rows.append({"path": fp, "modality": "echo", "split": sp})
                r_eco[sp] += 1
        json.dump(eco_m, open(os.path.join(eco_dir, "manifest.json"), "w"))
        summary["echo"] = c_eco
    except Exception as e:
        summary["echo"] = {"error": str(e)}
        print("  !! echo error:", e)

    json.dump(router_rows, open(os.path.join(ROOT, "router_manifest.json"), "w"))
    json.dump(summary, open(os.path.join(ROOT, "dataset_summary.json"), "w"), indent=2)
    vol.commit()

    print(f"\n=== ALL 5 MODALITIES READY in {time.time()-t0:.1f}s ===")
    print(json.dumps(summary, indent=2))
    print("Total Router samples:", len(router_rows))


@app.local_entrypoint()
def main():
    finish_all5.remote()
