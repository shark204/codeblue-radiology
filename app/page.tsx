"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Box, Stethoscope, ScanLine, Sun, Moon } from "lucide-react";
import ScanControls from "@/features/viewer/AxialView";
import { useScanStore } from "@/stores/scanStore";
import { useUIStore } from "@/stores/uiStore";
import { useAtlasLocale } from "@/lib/atlasI18n";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_URL || "https://mrcs-bank.vercel.app";
const SOUNDS_URL = process.env.NEXT_PUBLIC_SOUNDS_URL || "https://codeblue-sounds.vercel.app";
const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL || "https://codeblue-atlas.vercel.app";

export default function RadiologyHomePage() {
  const [mounted, setMounted] = useState(false);
  const enabled = useScanStore((s) => s.enabled);
  const toggle = useScanStore((s) => s.toggle);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { locale, setLocale } = useAtlasLocale();

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (mounted && !enabled) toggle();
  }, [mounted, enabled, toggle]);

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
        <div style={{ fontSize: 12, color: "#94a3b8" }}>Loading Radiology &amp; AI Studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent text-slate-100 flex flex-col">
      <header className="sticky top-0 z-40 h-12 px-4 border-b border-slate-800/80 bg-[#070b16]/80 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <ScanLine className="w-4 h-4" />
          </div>
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
            <span>{locale === "ar" ? "بنك الأسئلة" : "Main Bank"}</span>
          </a>
          <a
            href={SOUNDS_URL}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{locale === "ar" ? "أصوات القلب والصدر" : "Sounds & ECG"}</span>
          </a>
          <a
            href={ATLAS_URL}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 transition"
          >
            <Box className="w-3.5 h-3.5" />
            <span>{locale === "ar" ? "الأطلس 3D" : "3D Atlas"}</span>
          </a>
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold"
          >
            {locale === "ar" ? "EN" : "AR"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
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
            {locale === "ar" ? "فتح استوديو الأشعة والتشخيص الذكي" : "Open Radiology & AI Scan Studio"}
          </button>
        )}
        <ScanControls />
      </main>
    </div>
  );
}
