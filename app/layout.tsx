import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code Blue Radiology & AI Scan",
  description: "Standalone Radiology Basics, Real Clinical Scans & Signs Atlas, and 12-Stage AI Diagnostic Engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#060913] text-slate-100 antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
