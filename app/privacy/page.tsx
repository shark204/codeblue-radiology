import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Code Blue Radiology",
  description: "Privacy policy and medical educational disclaimer for Code Blue Radiology.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen w-full px-4 sm:px-8 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-400/25 bg-[#071122]/85 backdrop-blur-xl p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">Privacy Policy</h1>
            <p className="text-xs text-cyan-300/85 font-mono mt-1">
              Code Blue Radiology · Effective November 2026
            </p>
          </div>
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 text-xs font-bold transition"
          >
            Back to App
          </Link>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-slate-200">
          <h2 className="text-base font-extrabold text-cyan-300">1. Educational &amp; Decision-Support Purpose</h2>
          <p>
            Code Blue Radiology is an educational medical imaging atlas and AI-assisted clinical reasoning reference
            designed for medical students, house officers, and healthcare professionals. It is not a certified medical
            device and must never replace formal radiologist interpretation or emergency clinical judgment.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-200">
          <h2 className="text-base font-extrabold text-cyan-300">2. Medical Image Handling &amp; Zero Permanent Storage</h2>
          <p>
            When you upload a radiology scan (Chest X-Ray, Chest CT, Brain CT/MRI, Abdominal Ultrasound, or
            Echocardiogram) for AI analysis, the image is transmitted over encrypted HTTPS to our inference server
            solely to compute predictions and Grad-CAM visual heatmaps in memory. Uploaded scans are not permanently
            stored on our inference servers, sold, or shared with third-party advertisers. Please remove patient
            identifying information (names, IDs) before uploading any scan.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-200">
          <h2 className="text-base font-extrabold text-cyan-300">3. Local Preferences</h2>
          <p>
            Language (Arabic / English) and display theme (Dark / Light) preferences are stored locally in your browser
            using <code className="text-cyan-300">localStorage</code> and never leave your device.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-slate-200">
          <h2 className="text-base font-extrabold text-cyan-300">4. Contact</h2>
          <p>
            For privacy inquiries or data questions, contact Dr. Mohamed Elsharkay via the Code Blue Medical Bank
            platform at{" "}
            <a href="https://codeblue-radiology.vercel.app" className="text-cyan-300 underline">
              codeblue-radiology.vercel.app
            </a>
            .
          </p>
        </section>

        <section dir="rtl" className="space-y-2 text-sm leading-relaxed text-slate-200 border-t border-white/10 pt-5">
          <h2 className="text-base font-extrabold text-cyan-300">ملخص سياسة الخصوصية (بالعربية)</h2>
          <p>
            منصة <strong>Code Blue Radiology</strong> أداة تعليمية ومساعدة سريرية للأطباء وطلاب الطب وليست بديلًا عن
            تقرير طبيب الأشعة المختص. تُعالج صور الأشعة المرفوعة في الذاكرة عبر اتصال مشفّر HTTPS لاستخراج النتائج
            وخريطة Grad-CAM فقط ولا يتم تخزينها بشكل دائم أو مشاركتها مع أي جهات إعلانية. يُرجى إخفاء بيانات المريض
            الشخصية قبل رفع أي صورة أشعة.
          </p>
        </section>
      </div>
    </main>
  );
}
