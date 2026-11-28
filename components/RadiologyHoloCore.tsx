"use client";

import React, { useState } from "react";

interface HoloStep {
  num: string;
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
}

const LEFT_STEPS: HoloStep[] = [
  {
    num: "01",
    titleAr: "توجيه تلقائي للخمس أشعة",
    bodyAr: "فحص جودة الصورة وتوجيهها تلقائيًا بدقة 99.9% بين CXR وChest CT وBrain وUS وEcho.",
    titleEn: "5-Modality Auto-Router",
    bodyEn: "Quality check & 99.9% auto-routing across CXR, Chest CT, Brain, US & Echo.",
  },
  {
    num: "03",
    titleAr: "3 بطاقات سريرية تكيفية",
    bodyAr: "بداية الأعراض والاستقرار الحيوي والأعراض المخصصة لكل عضو لحسم التشخيص.",
    titleEn: "3 Adaptive Clinical Cards",
    bodyEn: "Onset, hemodynamic stability, and organ-specific symptoms tailored to the scan.",
  },
];

const RIGHT_STEPS: HoloStep[] = [
  {
    num: "02",
    titleAr: "خبراء 50M + Grad-CAM",
    bodyAr: "5 نماذج ConvNeXt (+48K أشعة) + TorchXRayVision (+700K) + خريطة تركيز وCTR.",
    titleEn: "50M Experts + Grad-CAM",
    bodyEn: "5 ConvNeXt networks (48K+ scans) + TorchXRayVision (700K+) + heatmap & CTR.",
  },
  {
    num: "04",
    titleAr: "دمج ومصائد الطوارئ",
    bodyAr: "تنبيهات حرجة لا تُتجاهل (Tension PTX، SAH، إصابات الرأس مع المسيلات، وPE).",
    titleEn: "Fusion & Safety Traps",
    bodyEn: "Hard emergency alerts (Tension PTX, SAH, anticoagulated trauma, PE).",
  },
];

const STEP_5: HoloStep = {
  num: "05",
  titleAr: "تقرير سلايد وأطلس الـ PACS",
  bodyAr: "تقرير سلايد PNG جاهز + أدوات DICOM + ربط بأطلس الحالات ودليل الـ 12 خطوة.",
  titleEn: "Slide Report & PACS Atlas",
  bodyEn: "Downloadable PNG slide report + DICOM windowing + 12-Step Guide & Real Atlas.",
};

export function RadiologyHoloCore({
  isAr,
  isLight,
}: {
  isAr: boolean;
  isLight: boolean;
}) {
  const [activeNum, setActiveNum] = useState<string | null>(null);

  const renderBox = (st: HoloStep, dotPos: "right" | "left" | "top") => {
    const isActive = activeNum === st.num;
    return (
      <div
        key={st.num}
        dir={isAr ? "rtl" : "ltr"}
        onMouseEnter={() => setActiveNum(st.num)}
        onMouseLeave={() => setActiveNum(null)}
        className={`relative rounded-xl border p-2 md:p-2.5 backdrop-blur-xl transition-all duration-300 select-none cursor-default ${
          isLight
            ? isActive
              ? "bg-white/95 border-cyan-500/75 shadow-[0_8px_20px_rgba(6,182,212,0.22)] -translate-y-0.5 scale-[1.02]"
              : "bg-white/88 border-cyan-200/90 shadow-sm hover:border-cyan-400/60"
            : isActive
              ? "bg-[#071c2c]/92 border-cyan-400/75 shadow-[0_0_20px_rgba(34,211,238,0.36)] -translate-y-0.5 scale-[1.02]"
              : "bg-[#061121]/80 border-cyan-400/24 hover:border-cyan-400/50"
        }`}
      >
        <span
          aria-hidden="true"
          className={`block absolute w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 ${
            dotPos === "right"
              ? "top-1/2 -translate-y-1/2 -right-[4px] md:-right-[5px]"
              : dotPos === "left"
                ? "top-1/2 -translate-y-1/2 -left-[4px] md:-left-[5px]"
                : "left-1/2 -translate-x-1/2 -top-[4px] md:-top-[5px]"
          } ${
            isActive
              ? "bg-cyan-100 scale-125 shadow-[0_0_10px_rgba(34,211,238,1)] ring-2 ring-cyan-500/70"
              : isLight
                ? "bg-cyan-600 shadow-[0_0_6px_rgba(6,182,212,0.55)]"
                : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)]"
          }`}
        />

        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`inline-flex items-center justify-center w-4 h-4 md:w-4.5 md:h-4.5 rounded-full text-[7.5px] md:text-[9px] font-black font-mono shrink-0 border ${
              isLight
                ? "bg-cyan-100 text-cyan-900 border-cyan-300"
                : "bg-cyan-950/75 text-cyan-300 border-cyan-400/45"
            }`}
          >
            {st.num}
          </span>
          <h3 className={`text-[8.5px] sm:text-[10px] md:text-[11px] font-black leading-tight ${isLight ? "text-slate-900" : "text-white"}`}>
            {isAr ? st.titleAr : st.titleEn}
          </h3>
        </div>
        <p className={`text-[7.5px] sm:text-[8.5px] md:text-[9.5px] leading-[1.28] md:leading-[1.35] ${isLight ? "text-slate-600" : "text-slate-300/90"}`}>
          {isAr ? st.bodyAr : st.bodyEn}
        </p>
      </div>
    );
  };

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: "url('/rad-holo-core.png')",
    maskImage: "url('/rad-holo-core.png')",
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };

  return (
    <div className="w-full space-y-2.5 select-none">
      <style>{`
        @keyframes cbRadScanBeam {
          0%   { background-position: 50% 135%; opacity: 0; }
          8%   { opacity: 0.95; }
          55%  { background-position: 50% -25%; opacity: 0.92; }
          64%  { background-position: 50% -45%; opacity: 0; }
          100% { background-position: 50% -45%; opacity: 0; }
        }
        .cb-rad-beam {
          background-image: linear-gradient(
            to top,
            transparent 0%,
            rgba(6, 182, 212, 0.35) 36%,
            rgba(34, 211, 238, 0.92) 48%,
            rgba(224, 242, 254, 1) 51%,
            rgba(56, 189, 248, 0.85) 55%,
            transparent 70%
          );
          background-size: 100% 340%;
          background-repeat: no-repeat;
          animation: cbRadScanBeam 9s cubic-bezier(0.32, 0.04, 0.25, 1) infinite;
        }
      `}</style>

      {/* Eyebrow Headline */}
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`text-center text-[11px] sm:text-xs font-extrabold leading-snug ${
          isLight ? "text-cyan-800" : "text-cyan-300/95"
        }`}
      >
        {isAr
          ? "من صورة الأشعة للتشخيص السريري في 5 خطوات متكاملة عبر 5 تخصصات."
          : "From a medical scan to clinical decision support in 5 focused steps."}
      </div>

      {/* Tight 5-Step Orbiting Hologram Layout — Fits Single Viewport Cleanly */}
      <div dir="ltr" className="relative w-full max-w-[680px] mx-auto h-[330px] sm:h-[365px] lg:h-[400px]">
        {/* Central Glowing Cyan Radiology CT Hologram Core */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[74px] md:bottom-[82px] flex items-center justify-center">
          <div
            aria-hidden="true"
            className={`absolute w-[140px] h-[140px] sm:w-[180px] sm:h-[180px] md:w-[225px] md:h-[225px] rounded-full blur-3xl ${
              isLight ? "bg-cyan-500/14" : "bg-cyan-500/22"
            }`}
          />
          <div className="relative h-[190px] w-[190px] sm:h-[225px] sm:w-[225px] md:h-[260px] md:w-[260px] flex items-center justify-center">
            <img
              src="/rad-holo-core.png"
              alt="Code Blue Holographic Cyan Radiology Core"
              draggable={false}
              className={`relative h-full w-full object-contain select-none ${
                isLight
                  ? "brightness-90 contrast-115 drop-shadow-[0_10px_22px_rgba(6,182,212,0.28)]"
                  : "opacity-95 drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
              }`}
            />
            <div
              aria-hidden="true"
              style={maskStyle}
              className="cb-rad-beam pointer-events-none absolute inset-0 mix-blend-screen drop-shadow-[0_0_12px_rgba(34,211,238,0.9)]"
            />
          </div>
        </div>

        {/* Left 2 Panels (01, 03) — Pulled Close to Hologram */}
        <div className="absolute left-[1%] sm:left-[3%] md:left-[4%] top-[14px] md:top-[22px] bottom-[96px] md:bottom-[108px] w-[33%] sm:w-[31%] md:w-[30%] flex flex-col justify-between z-10">
          {LEFT_STEPS.map((st) => renderBox(st, "right"))}
        </div>

        {/* Right 2 Panels (02, 04) — Staggered & Pulled Close to Hologram */}
        <div className="absolute right-[1%] sm:right-[3%] md:right-[4%] top-[42px] md:top-[56px] bottom-[68px] md:bottom-[76px] w-[33%] sm:w-[31%] md:w-[30%] flex flex-col justify-between z-10">
          {RIGHT_STEPS.map((st) => renderBox(st, "left"))}
        </div>

        {/* Bottom Center Finale Box (05) */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[56%] sm:w-[46%] md:w-[42%] z-10">
          {renderBox(STEP_5, "top")}
        </div>
      </div>
    </div>
  );
}
