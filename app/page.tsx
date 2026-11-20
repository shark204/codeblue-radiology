"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardList,
  Cpu,
  Home,
  Moon,
  ScanLine,
  Stethoscope,
  Sun,
} from "lucide-react";
import ScanControls from "@/features/viewer/AxialView";
import { useScanStore } from "@/stores/scanStore";
import { useUIStore } from "@/stores/uiStore";
import { useAtlasLocale } from "@/lib/atlasI18n";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "https://mrcs-bank.vercel.app";

export default function RadiologyHomePage() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"landing" | "workspace">("landing");
  const enabled = useScanStore((s) => s.enabled);
  const toggle = useScanStore((s) => s.toggle);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { locale, setLocale } = useAtlasLocale();
  const isAr = locale === "ar";

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (mounted && view === "workspace" && !enabled) toggle();
  }, [mounted, view, enabled, toggle]);

  const handleToggleTheme = () => {
    toggleTheme();
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("codeblue_theme", next);
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
    } catch {}
  };

  const launchRadiology = () => {
    if (!enabled) toggle();
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
        className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col overflow-y-auto"
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-16 px-5 md:px-10 border-b border-white/10 bg-[#070b16]/70 backdrop-blur-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/icon.png" alt="Code Blue Radiology" className="w-9 h-9 rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-500/20" />
            <div className="leading-tight">
              <div className="font-extrabold text-base text-white tracking-tight">Code Blue Radiology</div>
              <div className="text-[11px] font-mono text-cyan-300/80">codeblue-radiology</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold text-slate-200">
            <button type="button" onClick={launchRadiology} className="hover:text-cyan-300 transition">
              {isAr ? "التشخيص الذكي" : "AI Scan"}
            </button>
            <span className="text-cyan-400/50">•</span>
            <button type="button" onClick={launchRadiology} className="hover:text-cyan-300 transition">
              {isAr ? "دليل 12 خطوة" : "12-Step Guide"}
            </button>
            <span className="text-cyan-400/50">•</span>
            <button type="button" onClick={launchRadiology} className="hover:text-cyan-300 transition">
              {isAr ? "الأقسام والحالات" : "Real Scans & Signs"}
            </button>
          </nav>

          <div className="flex items-center gap-2 text-xs">
            <a
              href={MAIN_URL}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isAr ? "بنك الأسئلة" : "Main Bank"}</span>
            </a>
            <button
              type="button"
              onClick={() => setLocale(isAr ? "en" : "ar")}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-200 border border-white/10 font-bold transition"
            >
              {isAr ? "EN" : "AR"}
            </button>
            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-5 md:px-10 py-8 md:py-12 flex flex-col justify-between gap-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8">
            <div className="lg:col-span-6 space-y-5">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-white">
                {isAr
                  ? "أطلس حالات الأشعة والتشخيص بالذكاء الاصطناعي"
                  : "Clinical Radiology Atlas & AI Diagnostic Engine"}
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                {isAr
                  ? "أطلس الحالات الإشعاعية السريرية الحقيقية ومحرك التحليل الذكي متعدد المراحل لقراءة أشعة الصدر والدماغ والقلب والبطن."
                  : "Real PACS clinical radiology atlas paired with a 12-stage AI diagnostic reasoning engine across Chest X-Ray, Chest CT, Brain CT, Echo, and Abdomen US."}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={launchRadiology}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-300 hover:from-cyan-300 hover:to-sky-200 text-slate-950 font-black text-base shadow-[0_0_32px_rgba(34,211,238,0.45)] transition transform hover:scale-[1.02]"
                >
                  <span>{isAr ? "ابدأ التشخيص الآن" : "Start Diagnosis Now"}</span>
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 flex items-center justify-center">
              <img
                src="/hero-radiology.png"
                alt="Code Blue Radiology AI Workspace"
                className="w-full max-w-[600px] h-auto object-contain drop-shadow-[0_0_40px_rgba(34,211,238,0.28)] transition duration-500 hover:scale-[1.02] cursor-pointer"
                onClick={launchRadiology}
              />
            </div>
          </div>

          {/* Bottom 3 Feature Cards */}
          <section className="space-y-4">
            <h2 className="text-lg font-extrabold text-white">
              {isAr ? "ماذا تقدم المنصة لمتخصصي الأشعة؟" : "What Does the Radiology Platform Offer?"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={launchRadiology}
                className="group text-start rounded-2xl border border-cyan-400/25 bg-[#0d1528]/70 hover:bg-[#121e38]/85 hover:border-cyan-400/55 backdrop-blur-xl p-5 flex items-center justify-between gap-4 transition shadow-xl"
              >
                <div>
                  <div className="font-bold text-white text-base group-hover:text-cyan-200 transition">
                    {isAr ? "5 أقسام إشعاعية متكاملة (صدر، دماغ، قلب، بطن)" : "5 Complete Modalities (CXR, CT, Echo, US)"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {isAr ? "تغطية سريرية شاملة لحالات الطوارئ والباطنة" : "Full emergency & clinical imaging coverage"}
                  </div>
                </div>
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300">
                  <Stethoscope className="w-6 h-6" />
                </div>
              </button>

              <button
                type="button"
                onClick={launchRadiology}
                className="group text-start rounded-2xl border border-amber-400/25 bg-[#0d1528]/70 hover:bg-[#121e38]/85 hover:border-amber-400/55 backdrop-blur-xl p-5 flex items-center justify-between gap-4 transition shadow-xl"
              >
                <div>
                  <div className="font-bold text-white text-base group-hover:text-amber-200 transition">
                    {isAr ? "البرنامج المنهجي الـ 12 لقراءة أشعة الصدر" : "Systematic 12-Step CXR & Physics Guide"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {isAr ? "PA vs AP وحدود القلب وMRI T1/T2 والصبغات" : "PA vs AP, cardiac contours, MRI T1/T2 & contrast"}
                  </div>
                </div>
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
                  <ClipboardList className="w-6 h-6" />
                </div>
              </button>

              <button
                type="button"
                onClick={launchRadiology}
                className="group text-start rounded-2xl border border-violet-400/25 bg-[#0d1528]/70 hover:bg-[#121e38]/85 hover:border-violet-400/55 backdrop-blur-xl p-5 flex items-center justify-between gap-4 transition shadow-xl"
              >
                <div>
                  <div className="font-bold text-white text-base group-hover:text-violet-200 transition">
                    {isAr ? "مئات الحالات السريرية ومحرك تشخيص بالذكاء الاصطناعي" : "546+ Real Cases & AI Diagnostic Engine"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {isAr ? "ارفع الأشعة واحصل على التشخيص التفريقي والخطورة" : "Upload scans for Bayesian differential & red-flag triage"}
                  </div>
                </div>
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-violet-500/15 border border-violet-400/35 flex items-center justify-center text-violet-300">
                  <Cpu className="w-6 h-6" />
                </div>
              </button>
            </div>
          </section>
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
          <a
            href={MAIN_URL}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isAr ? "بنك الأسئلة" : "Main Bank"}</span>
          </a>
          <button
            type="button"
            onClick={() => setLocale(isAr ? "en" : "ar")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold"
          >
            {isAr ? "EN" : "AR"}
          </button>
          <button
            type="button"
            onClick={handleToggleTheme}
            className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {!enabled && (
          <button
            type="button"
            onClick={() => toggle()}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition"
          >
            {isAr ? "فتح استوديو الأشعة والتشخيص الذكي" : "Open Radiology & AI Scan Studio"}
          </button>
        )}
        <ScanControls />
      </main>
    </div>
  );
}
