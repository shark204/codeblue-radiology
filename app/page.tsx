"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Home,
  Moon,
  ScanLine,
  Sun,
} from "lucide-react";
import dynamic from "next/dynamic";
import { RadiologyHoloCore } from "@/components/RadiologyHoloCore";
import { useScanStore } from "@/stores/scanStore";
import { useUIStore } from "@/stores/uiStore";
import { useAtlasLocale } from "@/lib/atlasI18n";

const ScanControls = dynamic(() => import("@/features/viewer/AxialView"), { ssr: false });
const RadDiagnosticStudio = dynamic(
  () => import("@/features/rad/RadDiagnosticStudio").then((m) => m.RadDiagnosticStudio),
  { ssr: false }
);

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "https://mrcs-bank.vercel.app";

export default function RadiologyHomePage() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"landing" | "workspace">("landing");
  const [workspaceTab, setWorkspaceTab] = useState<"ai-v2" | "atlas">("ai-v2");
  const enabled = useScanStore((s) => s.enabled);
  const toggle = useScanStore((s) => s.toggle);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { locale, setLocale } = useAtlasLocale();
  const isAr = locale === "ar";
  const isLight = theme === "light";

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (mounted && view === "workspace" && workspaceTab === "atlas" && !enabled) toggle();
  }, [mounted, view, workspaceTab, enabled, toggle]);

  useEffect(() => {
    const onClose = () => setView("landing");
    window.addEventListener("cb-rad-close", onClose);
    return () => window.removeEventListener("cb-rad-close", onClose);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("codeblue_theme", theme);
      localStorage.removeItem("sky:mode-override");
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    } catch {}
  }, [theme]);

  const handleToggleTheme = () => {
    toggleTheme();
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("codeblue_theme", next);
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
    } catch {}
  };

  const launchRadiology = (tab: "ai-v2" | "atlas" = "ai-v2") => {
    setWorkspaceTab(tab);
    if (tab === "atlas" && !enabled) toggle();
    setView("workspace");
  };

  if (!mounted) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          background: "radial-gradient(circle at 50% 35%, #0f1b38 0%, #060913 75%)",
          color: "#e2e8f0",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <img
          src="/icon.png"
          alt="Code Blue Radiology"
          style={{ width: 68, height: 68, borderRadius: 16, boxShadow: "0 0 30px rgba(34,211,238,0.35)" }}
        />
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.04em" }}>CODE BLUE RADIOLOGY</div>
      </div>
    );
  }

  if (view === "landing") {
    return (
      <div
        dir={isAr ? "rtl" : "ltr"}
        className={`min-h-screen lg:h-screen lg:overflow-hidden w-full bg-transparent flex flex-col ${
          isLight ? "text-slate-900" : "text-slate-100"
        }`}
      >
        {/* Top Bar */}
        <header
          className={`shrink-0 h-14 px-5 md:px-10 border-b backdrop-blur-xl flex items-center justify-between gap-4 z-40 ${
            isLight
              ? "border-slate-200/80 bg-white/75"
              : "border-white/10 bg-[#070b16]/70"
          }`}
        >
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt="Code Blue Radiology"
              className="w-8 h-8 rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-500/20"
            />
            <div className="leading-tight">
              <div className={`font-extrabold text-sm md:text-base tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
                Code Blue Radiology
              </div>
              <div className={`text-[10.5px] font-mono ${isLight ? "text-cyan-700" : "text-cyan-300/80"}`}>
                codeblue-radiology
              </div>
            </div>
          </div>

          <div
            aria-hidden="true"
            className={`hidden md:flex items-center gap-5 text-xs font-semibold select-none cursor-default ${
              isLight ? "text-slate-500" : "text-slate-300/80"
            }`}
          >
            <span>{isAr ? "التشخيص الذكي" : "AI Scan"}</span>
            <span className="opacity-40">•</span>
            <span>{isAr ? "دليل 12 خطوة" : "12-Step Guide"}</span>
            <span className="opacity-40">•</span>
            <span>{isAr ? "الأطلس السريري" : "Real Scans Atlas"}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href={MAIN_URL}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition ${
                isLight
                  ? "bg-slate-100/80 hover:bg-slate-200/80 text-slate-800 border-slate-300/70"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isAr ? "بنك الأسئلة" : "Main Bank"}</span>
            </a>
            <button
              type="button"
              onClick={() => setLocale(isAr ? "en" : "ar")}
              className={`px-3 py-1.5 rounded-xl border font-bold transition ${
                isLight
                  ? "bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-200"
                  : "bg-white/5 hover:bg-white/10 text-cyan-200 border-white/10"
              }`}
            >
              {isAr ? "EN" : "AR"}
            </button>
            <button
              type="button"
              onClick={handleToggleTheme}
              className={`p-2 rounded-xl border transition ${
                isLight
                  ? "bg-slate-100/80 hover:bg-slate-200/80 text-slate-800 border-slate-300/70"
                  : "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10"
              }`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Single-Viewport 2-Column Hero */}
        <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-5 md:px-10 py-4 lg:py-3 flex items-center overflow-y-auto lg:overflow-hidden">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-8">
            {/* Left Column (5 cols): Clean Headline + Rephrased Subtitle + 2 CTAs */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-4">
              <div className="space-y-3.5">
                <h1
                  className={`text-2xl sm:text-3xl xl:text-4xl font-black leading-[1.18] ${
                    isLight ? "text-slate-900" : "text-white"
                  }`}
                >
                  {isAr
                    ? "أطلس حالات الأشعة والتشخيص بالذكاء الاصطناعي"
                    : "Clinical Radiology Atlas & AI Diagnostic Engine"}
                </h1>
                <p
                  className={`text-sm sm:text-base leading-relaxed max-w-xl ${
                    isLight ? "text-slate-600" : "text-slate-300"
                  }`}
                >
                  {isAr ? (
                    <>
                      ارفع أي أشعة صدر أو CT أو مخ أو سونار أو إيكو للتحليل الفوري بالذكاء الاصطناعي —{" "}
                      <span className={isLight ? "text-cyan-700 font-extrabold" : "text-cyan-300 font-extrabold"}>
                        أو استكشف أطلس الحالات الحقيقية ودليل الـ 12 خطوة.
                      </span>
                    </>
                  ) : (
                    <>
                      Upload any Chest X-Ray, CT, Brain MRI, Ultrasound, or Echo for instant AI analysis —{" "}
                      <span className={isLight ? "text-cyan-700 font-extrabold" : "text-cyan-300 font-extrabold"}>
                        or explore the PACS Atlas &amp; 12-Step Guide.
                      </span>
                    </>
                  )}
                </p>

                <div className="pt-1.5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => launchRadiology("ai-v2")}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-300 hover:from-cyan-300 hover:to-sky-200 text-slate-950 font-black text-sm sm:text-base shadow-[0_0_28px_rgba(34,211,238,0.45)] transition transform hover:scale-[1.03] active:scale-[0.99] cursor-pointer"
                  >
                    <ScanLine className="w-4 h-4 stroke-[2.4]" />
                    <span>{isAr ? "فحص الأشعة بالذكاء الاصطناعي" : "AI Scan & Diagnosis"}</span>
                    <ArrowUpRight className="w-4 h-4 stroke-[2.4]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => launchRadiology("atlas")}
                    className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl border font-extrabold text-xs sm:text-sm transition cursor-pointer ${
                      isLight
                        ? "bg-white/85 hover:bg-white text-slate-900 border-slate-300 shadow-sm"
                        : "bg-white/8 hover:bg-white/15 text-slate-100 border-white/15"
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>{isAr ? "الأطلس ودليل الـ 12 خطوة" : "Atlas & 12-Step Guide"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): Electric Cyan 7-Step Holographic Radiology Core */}
            <div className="lg:col-span-7 flex items-center justify-center">
              <RadiologyHoloCore isAr={isAr} isLight={isLight} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 h-12 px-4 border-b border-slate-800/80 bg-[#070b16]/80 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setView("landing")}
            className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/25 transition"
            title={isAr ? "العودة للرئيسية" : "Back to Home"}
          >
            <Home className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm tracking-tight text-white">
            Code Blue <span className="text-cyan-400">Radiology &amp; AI</span>
          </span>
        </div>

        <nav className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => launchRadiology(workspaceTab === "ai-v2" ? "atlas" : "ai-v2")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/45 font-bold cursor-pointer transition"
          >
            {workspaceTab === "ai-v2" ? <BookOpen className="w-3.5 h-3.5" /> : <ScanLine className="w-3.5 h-3.5" />}
            <span>{workspaceTab === "ai-v2" ? (isAr ? "الأطلس" : "Atlas") : (isAr ? "فحص الأشعة" : "AI Scan")}</span>
          </button>
          <button
            type="button"
            onClick={() => setLocale(isAr ? "en" : "ar")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold cursor-pointer"
          >
            {isAr ? "EN" : "AR"}
          </button>
          <button
            type="button"
            onClick={handleToggleTheme}
            className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </nav>
      </header>

      {workspaceTab === "ai-v2" ? (
        <main className="flex-1 w-full overflow-hidden">
          <RadDiagnosticStudio />
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {!enabled && (
            <button
              type="button"
              onClick={() => toggle()}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition"
            >
              {isAr ? "فتح أطلس الأشعة ودليل الـ 12 خطوة" : "Open Radiology Atlas & 12-Step Guide"}
            </button>
          )}
          <ScanControls />
        </main>
      )}
    </div>
  );
}
