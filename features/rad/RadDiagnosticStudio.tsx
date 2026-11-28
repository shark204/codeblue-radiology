"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDown, CheckCircle2, ChevronLeft, ChevronRight,
  Download, Eye, Flame, FlaskConical, ImagePlus, Layers, Loader2, Minus, Pill, Plus,
  RotateCcw, ScanLine, ShieldAlert, Sparkles, ZoomIn, ZoomOut,
} from "lucide-react";
import { useAtlasLocale } from "@/lib/atlasI18n";
import { useUIStore } from "@/stores/uiStore";
import {
  INITIAL_RAD_CONTEXT, MODALITY_SYMPTOMS, RadClinicalContext, RadHybridResult,
  RadModality, RemoteRadResponse, runHybridRadiologyDiagnosis,
} from "@/lib/radHybridEngine";
import { downloadRadReportSlide } from "@/lib/radReportSlide";

const RAD_API_URL =
  process.env.NEXT_PUBLIC_RADIOLOGY_AI_URL ||
  "https://mohama2468d--codeblue-radiology-ai-fastapi-app.modal.run";

const WINDOW_PRESETS = [
  { id: "classic", labelEn: "Classic", labelAr: "قياسي", filter: "" },
  { id: "lung", labelEn: "Lung", labelAr: "رئة", filter: "contrast(1.38) brightness(1.06)" },
  { id: "bone", labelEn: "Bone", labelAr: "عظم", filter: "contrast(1.55) brightness(0.95)" },
  { id: "brain", labelEn: "Brain", labelAr: "مخ", filter: "contrast(1.28) brightness(1.04)" },
  { id: "invert", labelEn: "Invert", labelAr: "عكس", filter: "invert(1) contrast(1.15)" },
] as const;

const MODALITY_OPTIONS: { id: "auto" | RadModality; en: string; ar: string }[] = [
  { id: "auto", en: "Auto-Detect", ar: "تلقائي" },
  { id: "chest_xray", en: "Chest X-Ray", ar: "أشعة صدر" },
  { id: "chest_ct", en: "Chest CT", ar: "مقطعية صدر" },
  { id: "neuro_ct", en: "Brain CT/MRI", ar: "أشعة مخ" },
  { id: "abdomen_us", en: "Abdomen US", ar: "سونار بطن" },
  { id: "echo", en: "Echo", ar: "إيكو قلب" },
];

export function RadDiagnosticStudio() {
  const { locale } = useAtlasLocale();
  const theme = useUIStore((s) => s.theme);
  const isAr = locale === "ar";
  const isLight = theme === "light";

  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [scanName, setScanName] = useState<string>("");
  const [modalityHint, setModalityHint] = useState<"auto" | RadModality>("auto");
  const [winPreset, setWinPreset] = useState<string>("classic");
  const [zoom, setZoom] = useState<number>(1);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteRadResponse | null>(null);

  const [step, setStep] = useState<number>(1);
  const [ctx, setCtx] = useState<RadClinicalContext>(INITIAL_RAD_CONTEXT);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [expandedCo, setExpandedCo] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [cardsInView, setCardsInView] = useState(false);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCardsInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [scanUrl, showResults]);

  const activeModality: RadModality =
    modalityHint !== "auto" ? modalityHint : (remote?.detected_modality ?? "chest_xray");

  const hybridResult: RadHybridResult | null = useMemo(() => {
    if (!remote || remote.invalid_scan) return null;
    return runHybridRadiologyDiagnosis(remote, ctx, modalityHint === "auto" ? undefined : modalityHint);
  }, [remote, ctx, modalityHint]);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScanUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
    setScanName(file.name);
    setShowResults(false);
    setApiError(null);
    setRemote(null);
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name || "scan.jpg");
      fd.append("modality_hint", modalityHint);
      const res = await fetch(`${RAD_API_URL.replace(/\/$/, "")}/analyze-radiology`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RemoteRadResponse;
      setRemote(data);
      if (data.invalid_scan) {
        setApiError(data.invalid_reason || (isAr ? "الصورة غير صالحة كأشعة طبية." : "Invalid radiology scan image."));
      }
    } catch {
      setApiError(
        isAr
          ? "تعذّر الاتصال بسيرفر الذكاء البصري الآن — تأكد من نشر modal_rad_app.py على Modal."
          : "Could not reach Modal Radiology AI server — ensure modal_rad_app.py is deployed."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAll = () => {
    setScanUrl(null);
    setScanName("");
    setRemote(null);
    setApiError(null);
    setStep(1);
    setCtx(INITIAL_RAD_CONTEXT);
    setShowResults(false);
    setZoom(1);
    setWinPreset("classic");
  };

  const toggleSymptom = (id: string) =>
    setCtx((p) => ({
      ...p,
      symptoms: p.symptoms.includes(id) ? p.symptoms.filter((s) => s !== id) : [...p.symptoms, id],
    }));

  const cardCls = isLight
    ? "border-slate-200/90 bg-white/85 text-slate-900 shadow-lg backdrop-blur-xl"
    : "border-white/12 bg-[#0a1324]/82 text-slate-100 shadow-2xl backdrop-blur-xl";
  const chipOff = isLight
    ? "border-slate-300 bg-slate-100/90 text-slate-800 hover:bg-slate-200"
    : "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10";
  const chipOn = isLight
    ? "border-cyan-600 bg-cyan-600 text-white shadow-sm"
    : "border-cyan-400/70 bg-cyan-500/25 text-cyan-100";

  const activeFilter = WINDOW_PRESETS.find((w) => w.id === winPreset)?.filter || "";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="h-[calc(100dvh-56px)] overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
      <div className="mx-auto max-w-7xl space-y-3 pb-16">
        {/* Compact Studio Header */}
        <div className={`rounded-2xl border px-3.5 py-2.5 flex items-center justify-between gap-2 ${cardCls}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <ScanLine className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-black truncate">
                {isAr ? "استوديو تشخيص الأشعة الذكي v2" : "AI Radiology Diagnostic Studio v2"}
              </div>
              <div className={`text-[10.5px] font-semibold truncate ${isLight ? "text-cyan-700" : "text-cyan-300/80"}`}>
                {isAr ? "5 تخصصات أشعة · ConvNeXt-Small 50M + Grad-CAM + مصائد الأمان" : "5 Modalities · ConvNeXt-Small 50M + Grad-CAM + Safety Traps"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAll}
            disabled={!scanUrl && !showResults}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer disabled:opacity-40 ${chipOff}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "حالة جديدة" : "New Case"}</span>
          </button>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* LEFT: Scan Uploader + Windowing + Grad-CAM */}
          <div className="lg:col-span-5 space-y-3">
            <div className={`${showResults ? "hidden lg:block " : ""}rounded-2xl border p-3.5 space-y-3 ${cardCls}`}>
              {/* Modality Pills */}
              <div className="flex flex-wrap gap-1.5">
                {MODALITY_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModalityHint(m.id)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer transition ${modalityHint === m.id ? chipOn : chipOff}`}
                  >
                    {isAr ? m.ar : m.en}
                  </button>
                ))}
              </div>

              {scanUrl ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold truncate flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      {scanName || "Scan"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))} className={`p-1.5 rounded-lg border cursor-pointer ${chipOff}`}>
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono px-1">{Math.round(zoom * 100)}%</span>
                      <button type="button" onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))} className={`p-1.5 rounded-lg border cursor-pointer ${chipOff}`}>
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full max-h-[360px] overflow-auto rounded-xl border border-slate-700/70 bg-black flex items-center justify-center">
                    <img
                      src={scanUrl}
                      alt="Uploaded Radiology Scan"
                      style={{ transform: `scale(${zoom})`, transformOrigin: "center", filter: activeFilter || undefined }}
                      className="max-h-[350px] w-auto object-contain transition-transform"
                    />
                  </div>
                  {/* DICOM-Style Windowing Bar */}
                  <div className="flex flex-wrap gap-1.5">
                    {WINDOW_PRESETS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setWinPreset(w.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold cursor-pointer ${winPreset === w.id ? chipOn : chipOff}`}
                      >
                        <Eye className="w-3 h-3 inline me-1" />
                        {isAr ? w.labelAr : w.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-2.5 min-h-[180px] rounded-2xl border-2 border-dashed p-5 cursor-pointer transition ${isLight ? "border-cyan-400/80 bg-cyan-50/40 hover:bg-cyan-50" : "border-cyan-400/35 bg-cyan-500/5 hover:border-cyan-400/70"}`}>
                  <ImagePlus className="w-8 h-8 text-cyan-400" />
                  <div className="text-xs sm:text-sm font-extrabold text-center">
                    {isAr ? "اضغط أو اسحب صورة الأشعة هنا (CXR / CT / MRI / US / Echo)" : "Drop or tap to upload Radiology Scan (CXR / CT / MRI / US / Echo)"}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
                </label>
              )}

              {analyzing && (
                <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>{isAr ? "جاري توجيه الأشعة وتحليلها بالذكاء البصري..." : "Routing modality & running deep visual analysis..."}</span>
                </div>
              )}

              {apiError && (
                <div className="rounded-xl border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{apiError}</span>
                </div>
              )}

              {remote && !remote.invalid_scan && !analyzing && (
                <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {isAr ? `تم التحليل (${activeModality.toUpperCase()})` : `Analyzed (${activeModality.toUpperCase()})`}
                  </span>
                  {remote.measurements?.ctr_ratio && (
                    <span className="font-mono text-[11px]">CTR ~ {remote.measurements.ctr_ratio}</span>
                  )}
                </div>
              )}
            </div>

            {/* Grad-CAM Visual Focus Overlay */}
            {showResults && remote?.gradcam_url && (
              <div className={`rounded-2xl border p-3.5 space-y-2 ${cardCls}`}>
                <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Flame className="w-4 h-4" />
                    {isAr ? "خريطة التركيز البصري (Grad-CAM)" : "Visual Focus Zone (Grad-CAM)"}
                  </span>
                  <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200">
                    {remote.gradcam_focus_region}
                  </span>
                </div>
                <img src={remote.gradcam_url} alt="Grad-CAM Overlay" className="w-full max-h-[280px] object-contain rounded-xl bg-black border border-white/10" />
              </div>
            )}
          </div>

          {/* RIGHT: 3 Clinical Context Cards OR Hybrid Results */}
          <div ref={cardsRef} className="lg:col-span-7 space-y-3">
            {!showResults ? (
              <div className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${cardCls}`}>
                {/* Stepper Pills */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { n: 1, ar: "1. الحالة والحيويات", en: "1. Vitals & Onset" },
                    { n: 2, ar: "2. الأعراض", en: "2. Symptoms" },
                    { n: 3, ar: "3. عوامل الخطورة", en: "3. Risk Traps" },
                  ].map((s) => (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => setStep(s.n)}
                      className={`py-2 px-2 rounded-xl border text-[11px] sm:text-xs font-extrabold cursor-pointer transition ${step === s.n ? chipOn : chipOff}`}
                    >
                      {isAr ? s.ar : s.en}
                    </button>
                  ))}
                </div>

                {step === 1 && (
                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="text-xs font-extrabold">{isAr ? "بداية الأعراض (Onset):" : "Symptom Onset:"}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["acute", "subacute", "chronic"] as const).map((o) => (
                          <button key={o} type="button" onClick={() => setCtx((p) => ({ ...p, onset: o }))} className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${ctx.onset === o ? chipOn : chipOff}`}>
                            {o === "acute" ? (isAr ? "حاد (<48 ساعة)" : "Acute (<48h)") : o === "subacute" ? (isAr ? "تحت حاد (أيام)" : "Subacute") : (isAr ? "مزمن (أسابيع+)" : "Chronic")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-xs font-extrabold">{isAr ? "الاستقرار الديناميكي (Hemodynamics):" : "Hemodynamic Status:"}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setCtx((p) => ({ ...p, hemodynamics: "stable" }))} className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${ctx.hemodynamics === "stable" ? chipOn : chipOff}`}>
                          {isAr ? "مستقر / واعي" : "Stable / Alert"}
                        </button>
                        <button type="button" onClick={() => setCtx((p) => ({ ...p, hemodynamics: "unstable" }))} className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${ctx.hemodynamics === "unstable" ? "border-rose-500 bg-rose-600 text-white" : chipOff}`}>
                          {isAr ? "غير مستقر / صدمة" : "Unstable / Shock"}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { k: "fever" as const, ar: "حرارة / عدوى", en: "Fever" },
                        { k: "hypoxia" as const, ar: "نقص أكسجين SpO2", en: "Hypoxia (SpO2<92%)" },
                        { k: "trauma" as const, ar: "إصابة / حادث", en: "Trauma" },
                      ].map((t) => (
                        <button key={t.k} type="button" onClick={() => setCtx((p) => ({ ...p, [t.k]: !p[t.k] }))} className={`py-2.5 px-2 rounded-xl border text-xs font-bold cursor-pointer ${ctx[t.k] ? chipOn : chipOff}`}>
                          {isAr ? t.ar : t.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-extrabold">
                      {isAr ? `أعراض المريض (${activeModality.toUpperCase()}):` : `Presenting Symptoms (${activeModality.toUpperCase()}):`}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(MODALITY_SYMPTOMS[activeModality] || []).map((sym) => {
                        const on = ctx.symptoms.includes(sym.id);
                        return (
                          <button key={sym.id} type="button" onClick={() => toggleSymptom(sym.id)} className={`p-2.5 rounded-xl border text-xs font-bold text-start cursor-pointer transition ${on ? chipOn : chipOff}`}>
                            {isAr ? sym.ar : sym.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-extrabold">{isAr ? "عوامل الخطورة ومصائد الأمان:" : "Risk Factors & Clinical Safety Traps:"}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { k: "anticoagulants" as const, ar: "يتناول مسيلات دم (Warfarin / DOAC)", en: "On Anticoagulants" },
                        { k: "dvtPeRisk" as const, ar: "خطورة جلطة ساق / رئة (DVT/PE)", en: "DVT / PE Risk Factors" },
                        { k: "malignancyOrSmoking" as const, ar: "تدخين شديد أو تاريخ أورام", en: "Heavy Smoking / Malignancy" },
                        { k: "immunosuppressedOrTb" as const, ar: "ضعف مناعة أو مخالطة درن (TB)", en: "Immunocompromised / TB Exposure" },
                        { k: "postProcedure" as const, ar: "بعد قسطرة مركزية / إجراء بالصدر", en: "Post Central-Line / Chest Procedure" },
                      ].map((rf) => (
                        <button key={rf.k} type="button" onClick={() => setCtx((p) => ({ ...p, [rf.k]: !p[rf.k] }))} className={`p-2.5 rounded-xl border text-xs font-bold text-start cursor-pointer transition ${ctx[rf.k] ? chipOn : chipOff}`}>
                          {isAr ? rf.ar : rf.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unified Bottom Navigation */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <button type="button" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className={`inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer disabled:opacity-35 ${chipOff}`}>
                    <ChevronLeft className="w-4 h-4" />
                    <span>{isAr ? "السابق" : "Back"}</span>
                  </button>
                  {step < 3 ? (
                    <button type="button" onClick={() => setStep((s) => s + 1)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold cursor-pointer shadow-lg">
                      <span>{step === 1 ? (isAr ? "التالي: الأعراض" : "Next: Symptoms") : (isAr ? "التالي: عوامل الخطورة" : "Next: Risk Traps")}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!remote || analyzing || Boolean(remote?.invalid_scan)}
                      onClick={() => setShowResults(true)}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-extrabold cursor-pointer shadow-lg disabled:opacity-45"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isAr ? "عرض التشخيص الهجين" : "Run Hybrid Diagnosis"}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : hybridResult ? (
              <div className="space-y-3">
                {/* Safety Traps Banner */}
                {hybridResult.safetyAlerts.map((al, idx) => (
                  <div key={idx} className="rounded-2xl border border-rose-500/70 bg-rose-950/75 p-4 text-rose-100 flex items-start gap-3 shadow-xl">
                    <ShieldAlert className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <div className="font-black text-rose-200">{isAr ? al.title_ar : al.title_en}</div>
                      <p className="leading-relaxed opacity-95">{isAr ? al.body_ar : al.body_en}</p>
                    </div>
                  </div>
                ))}

                {/* Primary Diagnosis Card */}
                <div className={`rounded-2xl border p-4 sm:p-5 space-y-3.5 ${cardCls}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {hybridResult.finalUrgency === "CRITICAL" ? (
                        <AlertOctagon className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                      ) : hybridResult.finalUrgency === "URGENT" ? (
                        <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-200 whitespace-nowrap">
                            {hybridResult.finalUrgency}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 whitespace-nowrap">
                            {hybridResult.primary.evidence.toUpperCase()} EVIDENCE
                          </span>
                        </div>
                        <h2 className="font-black text-base sm:text-lg leading-snug mt-1.5 break-words">
                          {isAr ? hybridResult.primary.name_ar : hybridResult.primary.name_en}
                        </h2>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto sm:shrink-0">
                      <button
                        type="button"
                        disabled={exporting}
                        onClick={async () => {
                          setExporting(true);
                          try { await downloadRadReportSlide({ result: hybridResult, isAr, scanDataUrl: scanUrl }); }
                          finally { setExporting(false); }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] sm:text-xs font-extrabold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{isAr ? "تقرير سلايد" : "Slide Report"}</span>
                      </button>
                      <button type="button" onClick={() => setShowResults(false)} className={`inline-flex items-center justify-center min-h-[40px] px-3.5 py-2 rounded-full border text-[11px] sm:text-xs font-bold cursor-pointer ${chipOff}`}>
                        {isAr ? "تعديل المدخلات" : "Edit Inputs"}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-[13px] leading-relaxed opacity-90">
                    {isAr ? hybridResult.primary.explanation_ar : hybridResult.primary.explanation_en}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-black/25 border border-cyan-400/35 p-3 space-y-1">
                      <div className="text-[11px] font-black text-cyan-300 flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>{isAr ? "الفحوصات المطلوبة (Inv)" : "Investigations (Inv)"}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-95">{isAr ? hybridResult.primary.inv_ar : hybridResult.primary.inv_en}</p>
                    </div>
                    <div className="rounded-xl bg-black/25 border border-emerald-400/35 p-3 space-y-1">
                      <div className="text-[11px] font-black text-emerald-300 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5" />
                        <span>{isAr ? "دعم القرار والعلاج (TTT)" : "Management (Educational TTT)"}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-95">{isAr ? hybridResult.primary.ttt_ar : hybridResult.primary.ttt_en}</p>
                    </div>
                  </div>

                  {hybridResult.coExisting.length > 0 && (
                    <div className="pt-2 border-t border-white/15 space-y-1.5">
                      <div className="text-[11px] font-black uppercase tracking-wide opacity-85 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>{isAr ? "نتائج أخرى مصاحبة" : "Other Confirmed Findings"}</span>
                      </div>
                      {hybridResult.coExisting.map((dx) => {
                        const open = expandedCo === dx.code;
                        return (
                          <div key={dx.code} className="rounded-xl bg-black/25 border border-white/15 overflow-hidden">
                            <button type="button" onClick={() => setExpandedCo((c) => (c === dx.code ? null : dx.code))} className="w-full min-h-[42px] px-3 py-2 flex items-center gap-2.5 text-start cursor-pointer hover:bg-white/5">
                              <span className="w-5 h-5 rounded-md bg-white/15 flex items-center justify-center shrink-0">
                                {open ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              </span>
                              <span className="font-extrabold text-xs sm:text-[13px] break-words">{isAr ? dx.name_ar : dx.name_en}</span>
                            </button>
                            {open && (
                              <div className="px-3 pb-3 pt-1 border-t border-white/10 text-xs space-y-1.5 opacity-90">
                                <p>{isAr ? dx.explanation_ar : dx.explanation_en}</p>
                                <p><strong className="text-cyan-300">Inv:</strong> {isAr ? dx.inv_ar : dx.inv_en}</p>
                                <p><strong className="text-emerald-300">TTT:</strong> {isAr ? dx.ttt_ar : dx.ttt_en}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Smart Floating Mobile Jump Button */}
      {scanUrl && !showResults && !cardsInView && (
        <button
          type="button"
          onClick={() => cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={`lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 min-h-[44px] px-5 py-2.5 rounded-full border text-xs font-extrabold flex items-center gap-2 whitespace-nowrap shadow-2xl backdrop-blur-xl cursor-pointer ${isLight ? "border-cyan-700 bg-cyan-600 text-white" : "border-cyan-400/60 bg-slate-900/95 text-cyan-100"}`}
        >
          <ArrowDown className="w-4 h-4 animate-bounce shrink-0" />
          <span>{isAr ? `انتقل للبطاقة ${step}` : `Go to Card ${step}`}</span>
        </button>
      )}
    </div>
  );
}
