/**
 * Code Blue Radiology v2 — High-Resolution Slide Report Exporter (1600x900 PNG)
 */
import type { RadHybridResult } from "./radHybridEngine";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

export async function downloadRadReportSlide(params: {
  result: RadHybridResult;
  isAr: boolean;
  scanDataUrl: string | null;
}): Promise<void> {
  const { result, isAr, scanDataUrl } = params;
  const W = 1600;
  const H = 900;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Deep Aurora Navy + Cyan Gradient Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#050B16");
  bg.addColorStop(0.55, "#0B1629");
  bg.addColorStop(1, "#061522");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Header Strip
  ctx.fillStyle = "rgba(6, 182, 212, 0.14)";
  ctx.fillRect(0, 0, W, 86);
  ctx.fillStyle = "#22D3EE";
  ctx.font = "900 28px 'Inter', system-ui, sans-serif";
  ctx.fillText("CODE BLUE RADIOLOGY v2", 48, 52);
  ctx.fillStyle = "#94A3B8";
  ctx.font = "700 18px 'Inter', system-ui, sans-serif";
  ctx.fillText(`MODALITY: ${result.modality.toUpperCase()}  ·  URGENCY: ${result.finalUrgency}`, 480, 52);

  // Left Scan Frame
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "rgba(34, 211, 238, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(48, 118, 560, 680, 22);
  ctx.fill();
  ctx.stroke();

  if (scanDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = scanDataUrl;
      });
      const pad = 20;
      const boxW = 560 - pad * 2;
      const boxH = 620 - pad * 2;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, 48 + (560 - dw) / 2, 138 + (620 - dh) / 2, dw, dh);
    } catch {}
  }

  // Right Diagnosis Column
  const rx = 640;
  const rw = 910;
  const urgColor = result.finalUrgency === "CRITICAL" ? "#F43F5E" : result.finalUrgency === "URGENT" ? "#F59E0B" : "#10B981";
  ctx.fillStyle = urgColor;
  ctx.font = "900 18px 'Inter', system-ui, sans-serif";
  ctx.fillText(`${result.finalUrgency}  ·  ${result.primary.evidence.toUpperCase()} EVIDENCE`, rx, 148);

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "900 34px 'Inter', system-ui, sans-serif";
  const titleLines = wrapText(ctx, isAr ? result.primary.name_ar : result.primary.name_en, rw, 2);
  titleLines.forEach((ln, i) => ctx.fillText(ln, rx, 198 + i * 42));

  ctx.fillStyle = "#CBD5E1";
  ctx.font = "500 20px 'Inter', system-ui, sans-serif";
  const expLines = wrapText(ctx, isAr ? result.primary.explanation_ar : result.primary.explanation_en, rw, 3);
  expLines.forEach((ln, i) => ctx.fillText(ln, rx, 294 + i * 30));

  // Inv & TTT Cards
  const cardY = 415;
  const cardW = 442;
  const cardH = 265;
  [
    { x: rx, title: isAr ? "Investigations (Inv)" : "Investigations (Inv)", body: isAr ? result.primary.inv_ar : result.primary.inv_en, border: "#22D3EE" },
    { x: rx + cardW + 26, title: isAr ? "Management (TTT)" : "Clinical Management (TTT)", body: isAr ? result.primary.ttt_ar : result.primary.ttt_en, border: "#10B981" },
  ].forEach((c) => {
    ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(c.x, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.border;
    ctx.font = "800 18px 'Inter', system-ui, sans-serif";
    ctx.fillText(c.title, c.x + 22, cardY + 38);
    ctx.fillStyle = "#E2E8F0";
    ctx.font = "500 17px 'Inter', system-ui, sans-serif";
    wrapText(ctx, c.body, cardW - 44, 7).forEach((ln, idx) => ctx.fillText(ln, c.x + 22, cardY + 74 + idx * 25));
  });

  // Co-existing line
  if (result.coExisting.length > 0) {
    ctx.fillStyle = "#94A3B8";
    ctx.font = "700 16px 'Inter', system-ui, sans-serif";
    const coTxt = result.coExisting.map((d) => (isAr ? d.name_ar : d.name_en)).join("  •  ");
    ctx.fillText(`Other Findings: ${coTxt.slice(0, 110)}`, rx, 725);
  }

  // Footer disclaimer
  ctx.fillStyle = "#64748B";
  ctx.font = "600 15px 'Inter', system-ui, sans-serif";
  ctx.fillText("For medical education & clinical decision support only — verify with a qualified radiologist.", 48, 862);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `codeblue-radiology-${result.modality}-${Date.now()}.png`;
  a.click();
}
