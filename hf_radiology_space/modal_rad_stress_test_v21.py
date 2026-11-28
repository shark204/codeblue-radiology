"""
Code Blue Radiology v2.1 — Live Adversarial Stress-Test & Edge-Case Audit Suite
Tests the LIVE production endpoint against 4 categories of real-world & hostile cases:
  1) Adversarial OOD Inputs (white lab-report document, colorful photo, pure black, tiny 64px)
  2) Real Held-Out Test Scans across ALL 5 Modalities (from /vol/rad_data/)
  3) Phone-Photo Degradation Stress (12-deg tilt + glare + JPEG q=25 + low contrast)
  4) Echo Single-Frame vs Paired ED+ES Consistency & Latency Benchmark
"""
import io, os, json, time, urllib.request
import modal

app = modal.App("codeblue-rad-stress-test-v21")
vol = modal.Volume.from_name("codeblue-radiology-vol", create_if_missing=True)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install("numpy", "opencv-python-headless", "pillow", "requests")
)

LIVE_URL = "https://mohama2468d--codeblue-radiology-ai-fastapi-app.modal.run/analyze-radiology"


@app.function(image=image, cpu=2.0, memory=4096, timeout=900, volumes={"/vol": vol})
def run_stress_suite():
    import cv2, numpy as np, requests
    from PIL import Image, ImageDraw

    def call_api(img_bytes: bytes, name: str, es_bytes: bytes = None):
        files = {"file": (name, img_bytes, "image/jpeg")}
        if es_bytes is not None:
            files["file_es"] = ("es.jpg", es_bytes, "image/jpeg")
        t0 = time.time()
        r = requests.post(LIVE_URL, files=files, data={"modality_hint": "auto"}, timeout=90)
        dt = round(time.time() - t0, 2)
        return r.status_code, dt, r.json() if r.ok else {"error": r.text[:200]}

    def to_jpg(arr_bgr, q=90):
        ok, buf = cv2.imencode(".jpg", arr_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), q])
        return buf.tobytes()

    def degrade_phone_photo(img_bgr):
        h, w = img_bgr.shape[:2]
        # 12-degree phone tilt
        M = cv2.getRotationMatrix2D((w / 2, h / 2), 12.0, 0.94)
        rot = cv2.warpAffine(img_bgr, M, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(15, 15, 15))
        # Lightbox glare hotspot + reduced contrast
        yy, xx = np.mgrid[0:h, 0:w]
        glare = np.exp(-(((xx - w * 0.35) ** 2 + (yy - h * 0.3) ** 2) / (2 * (min(h, w) * 0.22) ** 2)))
        out = np.clip(rot.astype(np.float32) * 0.85 + 22.0 + glare[:, :, None] * 65.0, 0, 255).astype(np.uint8)
        return to_jpg(out, q=28)

    report = {"ood_tests": [], "modality_clean": [], "phone_degraded": [], "echo_single_vs_paired": []}

    # ==========================================================================
    # 1) ADVERSARIAL OOD / NON-MEDICAL INPUTS
    # ==========================================================================
    print("\n=== [1] ADVERSARIAL OOD & CORRUPT INPUT TESTS ===")
    # 1a. White lab report / document with black text (grayscale!)
    doc = Image.new("RGB", (512, 512), (245, 245, 245))
    dr = ImageDraw.Draw(doc)
    for y in range(40, 460, 28):
        dr.text((35, y), "CBC REPORT: WBC 12.4 | Hb 11.2 | PLT 240 | CRP 45 mg/L", fill=(20, 20, 20))
    buf_doc = io.BytesIO(); doc.save(buf_doc, format="JPEG", quality=85)

    # 1b. Colorful photo (high saturation)
    col = np.zeros((320, 320, 3), dtype=np.uint8)
    col[:, :160] = (30, 220, 240)
    col[:, 160:] = (220, 40, 210)
    # 1c. Pure black blank frame
    blk = np.zeros((320, 320, 3), dtype=np.uint8)
    # 1d. Tiny 64x64 thumbnail
    tiny = np.random.randint(40, 200, (64, 64, 3), dtype=np.uint8)

    ood_cases = [
        ("white_lab_report_grayscale.jpg", buf_doc.getvalue()),
        ("colorful_non_medical.jpg", to_jpg(col)),
        ("blank_black.jpg", to_jpg(blk)),
        ("tiny_64px.jpg", to_jpg(tiny)),
    ]
    for name, raw in ood_cases:
        st, dt, res = call_api(raw, name)
        rejected = bool(res.get("invalid_scan"))
        top = (res.get("findings") or [{}])[0]
        rec = {
            "case": name, "http": st, "sec": dt, "rejected_correctly": rejected,
            "detected_mod": res.get("detected_modality"),
            "top_pred": f"{top.get('label', '')} ({top.get('probability', '')})" if top else "",
            "reason": res.get("invalid_reason", ""),
        }
        report["ood_tests"].append(rec)
        print(f"  [{name}] rejected={rejected} | mod={rec['detected_mod']} | top={rec['top_pred']} | {dt}s")

    # ==========================================================================
    # 2) REAL HELD-OUT SCANS (CLEAN vs PHONE-PHOTO DEGRADED) ACROSS 5 MODALITIES
    # ==========================================================================
    print("\n=== [2] REAL HELD-OUT TEST SCANS: CLEAN vs PHONE-PHOTO DEGRADED ===")
    for mod in ["chest_xray", "chest_ct", "neuro_ct", "abdomen_us", "echo"]:
        man_p = f"/vol/rad_data/{mod}/manifest.json"
        if not os.path.exists(man_p):
            continue
        rows = [r for r in json.load(open(man_p)) if r.get("split") == "test" and os.path.exists(r.get("path", ""))]
        sample = rows[:3]
        for idx, r in enumerate(sample):
            im = cv2.imread(r["path"])
            if im is None:
                continue
            gt = r.get("label") or r.get("labels") or r.get("ef") or "unknown"
            # Clean
            st1, dt1, res1 = call_api(to_jpg(im, 92), f"{mod}_clean_{idx}.jpg")
            top1 = (res1.get("findings") or [{}])[0]
            clean_rec = {
                "gt_mod": mod, "gt_label": str(gt)[:45], "pred_mod": res1.get("detected_modality"),
                "router_ok": res1.get("detected_modality") == mod,
                "top_pred": f"{top1.get('label', '')} ({top1.get('probability', '')})",
                "atlas_hits": len(res1.get("similar_atlas_cases") or []),
                "gradcam": bool(res1.get("gradcam_url")), "sec": dt1,
            }
            report["modality_clean"].append(clean_rec)

            # Phone-degraded
            st2, dt2, res2 = call_api(degrade_phone_photo(im), f"{mod}_phone_{idx}.jpg")
            top2 = (res2.get("findings") or [{}])[0]
            deg_rec = {
                "gt_mod": mod, "pred_mod": res2.get("detected_modality"),
                "router_ok": res2.get("detected_modality") == mod,
                "top_pred": f"{top2.get('label', '')} ({top2.get('probability', '')})",
                "pred_flipped": top1.get("label") != top2.get("label"),
                "sec": dt2,
            }
            report["phone_degraded"].append(deg_rec)
            print(
                f"  [{mod}#{idx}] GT={str(gt)[:24]} | "
                f"CLEAN: mod={clean_rec['pred_mod']} top={clean_rec['top_pred']} atlas={clean_rec['atlas_hits']} ({dt1}s) | "
                f"PHONE: mod={deg_rec['pred_mod']} top={deg_rec['top_pred']} flip={deg_rec['pred_flipped']} ({dt2}s)"
            )

    # ==========================================================================
    # 3) ECHO SINGLE-FRAME vs PAIRED ED+ES TEST
    # ==========================================================================
    print("\n=== [3] ECHO SINGLE-FRAME vs PAIRED ED+ES ===")
    echo_man = "/vol/rad_data/echo/manifest.json"
    if os.path.exists(echo_man):
        rows = [r for r in json.load(open(echo_man)) if r.get("split") == "test" and os.path.exists(r.get("path", ""))]
        by_key = {}
        for r in rows:
            k = (str(r.get("patient_id", "")), str(r.get("view", "4CH")))
            ph = "ES" if "_ES" in os.path.basename(r["path"]).upper() else "ED"
            by_key.setdefault(k, {"ef": r.get("ef")})[ph] = r["path"]
        pairs = [(k, v) for k, v in by_key.items() if "ED" in v and "ES" in v][:4]
        for (pid, view), v in pairs:
            ed_b = open(v["ED"], "rb").read()
            es_b = open(v["ES"], "rb").read()
            _, dt_s, r_s = call_api(ed_b, f"{pid}_ed.jpg")
            _, dt_p, r_p = call_api(ed_b, f"{pid}_ed.jpg", es_bytes=es_b)
            t_s = (r_s.get("findings") or [{}])[0]
            t_p = (r_p.get("findings") or [{}])[0]
            rec = {
                "patient": pid, "ef": v["ef"],
                "single": f"{t_s.get('label','')} ({t_s.get('probability','')})",
                "paired": f"{t_p.get('label','')} ({t_p.get('probability','')})",
                "paired_flag": (r_p.get("measurements") or {}).get("echo_paired_ed_es"),
            }
            report["echo_single_vs_paired"].append(rec)
            print(f"  [Echo {pid} EF={v['ef']}] single={rec['single']} | paired={rec['paired']} (flag={rec['paired_flag']})")

    # Summary stats
    ood_pass = sum(1 for x in report["ood_tests"] if x["rejected_correctly"])
    clean_r_ok = sum(1 for x in report["modality_clean"] if x["router_ok"])
    phone_r_ok = sum(1 for x in report["phone_degraded"] if x["router_ok"])
    flips = sum(1 for x in report["phone_degraded"] if x["pred_flipped"])
    avg_sec = round(float(np.mean([x["sec"] for x in report["modality_clean"]])) if report["modality_clean"] else 0.0, 2)

    print("\n=== STRESS TEST SUMMARY ===")
    print(f"OOD Rejection: {ood_pass}/{len(report['ood_tests'])}")
    print(f"Router Clean Accuracy: {clean_r_ok}/{len(report['modality_clean'])}")
    print(f"Router Phone-Degraded Accuracy: {phone_r_ok}/{len(report['phone_degraded'])} (label flips: {flips})")
    print(f"Mean Warm Latency: {avg_sec}s")
    return report


@app.local_entrypoint()
def main():
    run_stress_suite.remote()
