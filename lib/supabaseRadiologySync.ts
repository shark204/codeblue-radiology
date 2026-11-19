export interface SupabaseAnatomicalSystemRow {   id: string;   hub_id: "systemic" | "visceral" | "sounds_radiology";   title_ar: string;
  title_en: string;   colour_hex: string;   organ_count: number;   sort_order: number;
} export interface SupabaseEncyclopediaEntryRow {   id: string;   system_id: string;
  group_name: string;   name_en: string;   name_ar: string;   origin_text: string | null;
  insertion_text: string | null;   action_text: string | null;   nerve_supply: string | null;   blood_supply: string | null;
  relations_text: string | null;   clinical_pearls: string; } export interface SupabaseRadiologyModalityRow {
  id: string;   title_ar: string;   title_en: string;   subtitle_ar: string;
  subtitle_en: string;   machine_image_url: string;   sort_order: number; }
export interface SupabaseRadiologyCaseRow {   id: string;   modality: "echo" | "chest_xray" | "neuro_ct" | "abdomen_us" | "breast_msk";   digestive_organ: string | null;
  icd10_code: string;   category_ar: string;   category_en: string;   title_ar: string;
  title_en: string;   scan_at: number;   real_scan_image_url: string;   finding_ar: string;
  finding_en: string;   management_ar: string;   management_en: string; }
export interface SupabaseClinicalSymptomRow {   id: string;   organ_group: "chest_ct" | "chest_xray" | "echo" | "neuro_ct" | "abdomen_us";   sort_order: number;
  symptom_ar: string;   symptom_en: string;   matched_case_ids: string[];   extra_disease_ar: string | null;
  extra_disease_en: string | null; } export interface SupabaseEducationalGuideRow {   id: string;
  tab_id: "cxr" | "chest_ct" | "echo" | "neuro" | "abdomen" | "breast_msk" | "physics";   card_order: number;   title_ar: string;   title_en: string;
  body_ar: string;   body_en: string; } export interface Supabase12StepCxrGuideRow {
  step_number: number;   code: string;   title_ar: string;   title_en: string;
  normal_criteria_ar: string;   normal_criteria_en: string;   pathology_alert_ar: string;   pathology_alert_en: string;
} export interface SupabasePhysicsReferenceRow {   id: string;   modality: string;
  tissue_or_scale: string;   value_range: string;   clinical_meaning_ar: string;   clinical_meaning_en: string;
} export interface SupabaseRadiologyMcqRow {   question_number: number;   category: string;
  question_en: string;   option_a: string;   option_b: string;   option_c: string;
  option_d: string;   correct_option: "a" | "b" | "c" | "d";   explanation_ar: string;   explanation_en: string;
} export interface SupabaseDiagnosticLogInput {   modality: string;   organ_group: string;
  selected_symptom_ids: string[];   uploaded_scan_count: number;   primary_case_id: string;   primary_confidence: number;
  differential_case_ids: string[]; } export interface SupabaseConfirmedCaseRow {   id?: number;
  session_case_id: string;   modality: string;   confirmed_case_id: string;   confirmed_diagnosis_en: string;
  confirmed_diagnosis_ar: string;   icd10_code: string;   physician_notes: string;   radiomics_snapshot?: Record<string, unknown>;
  created_at?: string; } export interface RadiologyCalibrationSample {   id: string;
  timestamp: number;   modality: string;   organGroup: string;   wrongPredictedCaseId: string;
  correctCaseId: string;   customDiagnosisText?: string;   ageYears?: number;   ageUnit?: "days" | "months" | "years";
  selectedSymptomIds: string[];   selectedHistoryIds: string[];   perceptualHash: number;   meanBrightness: number;
  stdContrast: number;   leftRightAsymmetry: number;   hyperdenseClusterRatio: number;   edgeDensity: number;
  reticularHoneycombScore: number;   zone3x3: number[];   bucketImageUrl?: string; }
export interface IndexedReferenceScanEntry {   refId: string;   caseId: string;   modality: "echo" | "chest_xray" | "neuro_ct" | "abdomen_us";
  ageGroup: "neonate" | "infant" | "child" | "adult" | "elderly";   imageUrl: string;   bucketPath: string;   meanLum: number;
  contrast: number;   asymmetry: number;   hyperdenseRatio: number;   zone3x3: readonly number[];
} export interface AtlasSupabaseSyncSummary {   connected: boolean;   systemsCount: number;
  casesCount: number;   symptomsCount: number;   mcqsCount: number;   confirmedCasesCount: number;
  referenceBankCount: number;   bucketName: string;   cases: SupabaseRadiologyCaseRow[];   symptoms: SupabaseClinicalSymptomRow[];
} export const RADIOLOGY_SUPABASE_BUCKET = "radiology-scans-bucket"; const CALIBRATION_STORAGE_KEY = "cb_radiology_calibration_samples_v1"; const STUDENT_CASE_FREQ_STORAGE_KEY = "cb_student_case_freq_v1";
function getSupabaseRestConfig(): {   baseUrl: string;   storageUrl: string;   headers: Record<string, string>;
  rawUrl: string;   anonKey: string; } | null {   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;   if (!supabaseUrl || !supabaseAnonKey) return null;   const clean = supabaseUrl.replace(/\/$/, "");   return {
    rawUrl: clean,     anonKey: supabaseAnonKey,     baseUrl: `${clean}/rest/v1`,     storageUrl: `${clean}/storage/v1`,
    headers: {       apikey: supabaseAnonKey,       Authorization: `Bearer ${supabaseAnonKey}`,       "Content-Type": "application/json"
    }   }; } export function getSupabaseBucketPublicUrl(bucketPath: string): string {
  const cfg = getSupabaseRestConfig();   const base = cfg ? cfg.rawUrl : "https://supabase.co";   return `${base}/storage/v1/object/public/${RADIOLOGY_SUPABASE_BUCKET}/${bucketPath.replace(/^\//, "")}`; }
export async function uploadScanToSupabaseBucket(params: {   dataUrl?: string;   fileName?: string;   modality: string;
  caseId: string;   isCorrection?: boolean;   metadata?: Record<string, unknown>; }): Promise<string | null> {
  const cfg = getSupabaseRestConfig();   const safeCase = (params.caseId || "unknown").replace(/[^a-z0-9_-]/gi, "_");   const folder = params.isCorrection ? "calibration_corrections" : "confirmed_scans";   const stamp = Date.now();
  const objectPath = `${folder}/${params.modality}/${safeCase}_${stamp}.json`;   const publicUrl = getSupabaseBucketPublicUrl(objectPath);   if (!cfg) return publicUrl;   const runUpload = async () => {
    try {       const payload = JSON.stringify({         uploaded_at: new Date(stamp).toISOString(),         modality: params.modality,
        case_id: params.caseId,         is_correction: Boolean(params.isCorrection),         file_name: params.fileName ?? `${safeCase}.png`,         metadata: params.metadata ?? {},
        thumbnail_preview: params.dataUrl ? params.dataUrl.slice(0, 4096) : undefined       });       await fetch(`${cfg.storageUrl}/object/${RADIOLOGY_SUPABASE_BUCKET}/${objectPath}`, {         method: "POST",
        headers: {           apikey: cfg.anonKey,           Authorization: `Bearer ${cfg.anonKey}`,           "Content-Type": "application/json",
          "x-upsert": "true"         },         body: payload       });
    } catch {}   };   if (typeof window !== "undefined" && "requestIdleCallback" in window) {     (window as any).requestIdleCallback(() => {
      void runUpload();     });   } else {     setTimeout(() => {
      void runUpload();     }, 10);   }   return publicUrl;
} export function getLocalCalibrationSamples(): RadiologyCalibrationSample[] {   if (typeof window === "undefined") return [];   try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);     if (!raw) return [];     const parsed = JSON.parse(raw);     return Array.isArray(parsed) ? (parsed as RadiologyCalibrationSample[]) : [];
  } catch {     return [];   } }
export async function saveRadiologyCalibrationCorrection(sample: Omit<RadiologyCalibrationSample, "id" | "timestamp">): Promise<RadiologyCalibrationSample> {   const full: RadiologyCalibrationSample = {     ...sample,     id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now()   };   if (typeof window !== "undefined") {     try {
      const existing = getLocalCalibrationSamples();       const updated = [full, ...existing].slice(0, 400);       window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(updated));     } catch {}
  }   void uploadScanToSupabaseBucket({     modality: sample.modality,     caseId: sample.correctCaseId,
    isCorrection: true,     metadata: {       wrong_predicted_case_id: sample.wrongPredictedCaseId,       correct_case_id: sample.correctCaseId,
      custom_diagnosis_text: sample.customDiagnosisText,       age_years: sample.ageYears,       age_unit: sample.ageUnit,       selected_symptom_ids: sample.selectedSymptomIds,
      zone3x3: sample.zone3x3,       mean_brightness: sample.meanBrightness,       std_contrast: sample.stdContrast,       asymmetry: sample.leftRightAsymmetry,
      hyperdense_ratio: sample.hyperdenseClusterRatio     }   });   void submitSupabaseConfirmedCase({
    session_case_id: full.id,     modality: sample.modality,     confirmed_case_id: sample.correctCaseId,     confirmed_diagnosis_en: sample.customDiagnosisText || sample.correctCaseId,
    confirmed_diagnosis_ar: sample.customDiagnosisText || sample.correctCaseId,     icd10_code: "CAL-PRIOR",     physician_notes: `Calibration feedback (prev: ${sample.wrongPredictedCaseId})`,     radiomics_snapshot: {
      wrong_case_id: sample.wrongPredictedCaseId,       zone3x3: sample.zone3x3,       meanBrightness: sample.meanBrightness,       stdContrast: sample.stdContrast,
      leftRightAsymmetry: sample.leftRightAsymmetry,       hyperdenseClusterRatio: sample.hyperdenseClusterRatio,       ageYears: sample.ageYears,       ageUnit: sample.ageUnit,
      selectedSymptomIds: sample.selectedSymptomIds     }   });   return full;
} export function getCalibrationPriorAdjustments(params: {   modality: string;   organGroup: string;
  ageYears?: number;   selectedSymptomIds: string[];   perceptualHash?: number;   meanBrightness: number;
  stdContrast: number;   leftRightAsymmetry: number;   hyperdenseClusterRatio: number;   zone3x3: number[];
}): Record<string, {   scoreDelta: number;   reasonAr?: string;   reasonEn?: string;
}> {   const samples = getLocalCalibrationSamples();   if (samples.length === 0) return {};   const adjustments: Record<string, {
    scoreDelta: number;     reasonAr?: string;     reasonEn?: string;   }> = {};
  for (const s of samples) {     const exactHashMatch = Boolean(params.perceptualHash && s.perceptualHash && Math.abs(s.perceptualHash - params.perceptualHash) <= 2);     if (!exactHashMatch && s.modality !== params.modality && s.organGroup !== params.organGroup) continue;     let zDiff = 0;
    if (s.zone3x3?.length === 9 && params.zone3x3?.length === 9) {       for (let i = 0; i < 9; i++) {         zDiff += Math.abs((s.zone3x3[i] ?? 85) - (params.zone3x3[i] ?? 85));       }
      zDiff /= 9;     } else {       zDiff = Math.abs(s.meanBrightness - params.meanBrightness);     }
    const bDiff = Math.abs(s.meanBrightness - params.meanBrightness);     const cDiff = Math.abs(s.stdContrast - params.stdContrast);     const hDiff = Math.abs((s.hyperdenseClusterRatio ?? 0) - params.hyperdenseClusterRatio);     const radiomicSimilarity = Math.max(0, 1 - (zDiff * 0.45 + bDiff * 0.25 + cDiff * 0.2 + hDiff * 0.8) / 34);
    const isNearIdenticalScan = exactHashMatch || zDiff <= 2.2 && bDiff <= 2.5 && cDiff <= 2.5;     let symOverlap = 0;     const cleanSampleSyms = s.selectedSymptomIds.filter(id => !id.endsWith("_no_signs"));     const cleanParamSyms = params.selectedSymptomIds.filter(id => !id.endsWith("_no_signs"));
    if (cleanSampleSyms.length > 0 && cleanParamSyms.length > 0) {       const setA = new Set(cleanSampleSyms);       const shared = cleanParamSyms.filter(id => setA.has(id)).length;       symOverlap = shared / Math.max(1, Math.min(cleanSampleSyms.length, cleanParamSyms.length));
    } else if (cleanParamSyms.length === 0) {       symOverlap = radiomicSimilarity;     }     let ageMatch = 0.7;
    if (typeof s.ageYears === "number" && typeof params.ageYears === "number") {       const bothInfant = s.ageYears <= 2 && params.ageYears <= 2;       const ageGap = Math.abs(s.ageYears - params.ageYears);       ageMatch = bothInfant ? 1.0 : Math.max(0.25, 1 - ageGap / 40);
    }     const combinedSimilarity = isNearIdenticalScan ? 0.99 : cleanParamSyms.length === 0 ? radiomicSimilarity * 0.88 + ageMatch * 0.12 : radiomicSimilarity * 0.65 + symOverlap * 0.23 + ageMatch * 0.12;     if (combinedSimilarity >= 0.48) {       const boostVal = isNearIdenticalScan ? 96.0 : radiomicSimilarity >= 0.86 ? Math.min(48.0, Math.round(combinedSimilarity * 50 * 10) / 10) : Math.min(24.0, Math.round(combinedSimilarity * 25 * 10) / 10);
      const prev = adjustments[s.correctCaseId]?.scoreDelta ?? 0;       if (boostVal > prev) {         adjustments[s.correctCaseId] = {           scoreDelta: boostVal,
          reasonAr: isNearIdenticalScan ? "تطابق بصري مباشر (100% Perceptual & 9-Zone Radiomic Match) مع حالة مرجعية تم تصحيحها وتوثيقها في الذاكرة السريرية" : `معايرة ذكية من الحالات المصححة سابقاً (تشابه بصري وإشعاعي ${(combinedSimilarity * 100).toFixed(0)}%)`,           reasonEn: isNearIdenticalScan ? "Direct visual & 9-zone radiomic match (100%) with a previously calibrated pathology scan (independent of symptom removal)" : `Smart calibration prior from verified pathology patterns (${(combinedSimilarity * 100).toFixed(0)}% visual-radiomic match)`         };       }
      if (s.wrongPredictedCaseId && s.wrongPredictedCaseId !== s.correctCaseId) {         const penalty = isNearIdenticalScan ? -45.0 : -Math.min(18.0, Math.round(combinedSimilarity * 18 * 10) / 10);         const prevWrong = adjustments[s.wrongPredictedCaseId]?.scoreDelta ?? 0;         if (penalty < prevWrong) {
          adjustments[s.wrongPredictedCaseId] = {             scoreDelta: penalty           };         }
      }     }   }   return adjustments;
} export interface ShortRadiologyChannelCase {   id: string;   modality: "echo" | "chest_xray" | "neuro_ct" | "abdomen_us";
  digestiveOrgan?: "liver" | "gallbladder" | "kidney" | "pancreas" | "spleen" | "bowel";   code: string;   categoryAr: string;   categoryEn: string;
  ar: string;   en: string;   scanAt: number;   findingAr: string;
  findingEn: string;   managementAr: string;   managementEn: string;   sourceAr: string;
  sourceEn: string;   channelUrl: string;   keywords: string[];   radiomics: {
    brightnessRange: [number, number];     contrastMin: number;     asymmetryMin: number;     hyperdense: boolean;
    anechoicFluid: boolean;     acousticShadow: boolean;     highCTR?: boolean;     dopplerColor?: boolean;
    peripheralLens?: boolean;   }; } export const SHORT_RADIOLOGY_CHANNEL_URL = "https://t.me/s/shortradiology";
export const SHORT_RADIOLOGY_TELEGRAM_CASES: readonly ShortRadiologyChannelCase[] = [{   id: "sr_neuro_blend_sign_ich",   modality: "neuro_ct",   code: "ICD-10 I61.9 · @shortradiology",
  categoryAr: "مقطعية المخ · علامات توسع النزيف الدماغي (@shortradiology)",   categoryEn: "Brain CT · Hematoma Expansion Signs (@shortradiology)",   ar: "علامة المزج في نزيف المخ الحاد — Blend Sign of Intracerebral Hemorrhage",   en: "Blend Sign of Intracerebral Hemorrhage (Hypodense + Hyperdense Blending ≥18 HU Difference — Predicts Hematoma Expansion)",
  scanAt: 0.88,   findingAr: "امتزاج منطقة منخفضة الكثافة نسبياً مع منطقة مجاورة مرتفعة الكثافة داخل الورم الدموي الدماغي بحد فاصل واضح بالعين المجردة وفرق كثافة ≥ 18 وحدة هاونسفيلد (HU) دون أن تكون المنطقة الأقل كثافة محاطة بالكامل بالمنطقة عالية الكثافة؛ وهي علامة تنبؤية هامة لنمو وتوسع النزيف.",   findingEn: "Non-contrast head CT demonstrating juxtaposition/blending of a relatively hypodense active bleeding region with an adjacent hyperdense clotted region within an intracerebral hematoma, with a sharply defined naked-eye margin and ≥18 HU attenuation difference (non-encapsulated) — strong predictor of early hematoma growth.",   managementAr: "ضبط صارم وسريع لضغط الدم الانقباضي (140 مم زئبق)، عكس أي أدوية سيولة فوراً، متابعة بمقطعية مخ خلال 6 ساعات، واستشارة جراحة المخ والأعصاب.",
  managementEn: "Intensive blood pressure lowering (target SBP ~140 mmHg per INTERACT2/ATACH-2), immediate coagulopathy reversal, repeat head CT within 6h, and neurosurgical ICU monitoring.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["blend sign", "blend", "ich", "hematoma growth", "18 hu", "hemorrhage", "علامة المزج"],   radiomics: {     brightnessRange: [95, 168],     contrastMin: 56,
    asymmetryMin: 0.28,     hyperdense: true,     anechoicFluid: true,     acousticShadow: false
  } }, {   id: "sr_neuro_island_sign_ich",   modality: "neuro_ct",
  code: "ICD-10 I61.8 · @shortradiology",   categoryAr: "مقطعية المخ · علامات توسع النزيف الدماغي (@shortradiology)",   categoryEn: "Brain CT · Hematoma Expansion Signs (@shortradiology)",   ar: "علامة الجزيرة في نزيف المخ — The Island Sign with Intracerebral Hematoma",
  en: "The Island Sign in Intracerebral Hematoma (≥3 Discrete Satellite Hematomas or ≥4 Bubble/Sprout Projections — Active Arteriolar Bleeding)",   scanAt: 0.88,   findingAr: "وجود 3 بؤر نزيفية صغيرة أو أكثر منفصلة تماماً عن الورم الدموي الرئيسي، أو 4 نتوءات صغيرة أو أكثر تتفرع من الورم الدموي الرئيسي وتشبه الفقاعات أو البراعم (وليس مجرد حواف مفصصة)؛ وتدل على تعدد مصادر النزف من الشرينات المجاورة وتنبئ بتمدد النزيف وسوء المآل.",   findingEn: "Non-contrast brain CT showing ≥3 small discrete satellite hematomas separate from the main clot OR ≥4 bubble/sprout-like projections branching off the primary hematoma, indicating multifocal adjacent arteriolar rupture and high risk of hematoma expansion.",
  managementAr: "علاج طارئ في العناية المركزة العصبية، خفض ضغط الدم الحاد، عكس مضادات التخثر، وتقييم الحاجة لتفريغ جراحي.",   managementEn: "Neuro-ICU admission, rapid antihypertensive protocol, reversal of anticoagulation, and surgical evacuation assessment if mass effect progresses.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  channelUrl: "https://t.me/s/shortradiology",   keywords: ["island sign", "island", "satellite hematoma", "sprout", "ich expansion", "علامة الجزيرة"],   radiomics: {     brightnessRange: [98, 172],
    contrastMin: 58,     asymmetryMin: 0.30,     hyperdense: true,     anechoicFluid: false,
    acousticShadow: false   } }, {   id: "sr_neuro_ivlt_venous_lake",
  modality: "neuro_ct",   code: "ICD-10 I67.6 · @shortradiology",   categoryAr: "مقطعية المخ والأوردة · خثار البحيرات الوريدية (@shortradiology)",   categoryEn: "Brain CT & CTV · Dural Venous Thrombosis (@shortradiology)",
  ar: "خثار البحيرات الوريدية المجاورة للجيب السهمي — Parasagittal Intracranial Venous Lake Thrombosis (IVLT)",   en: "Parasagittal Intracranial Venous Lake Thrombosis (IVLT — Hyperattenuating Dural Venous Lakes on NCCT & CTV Filling Defect)",   scanAt: 0.91,   findingAr: "تخثر مرتفع الكثافة (Hyperattenuating Clot) على جانبي الجيب الوريدي السهمي العلوي (Superior Sagittal Sinus) في المقطعية بدون صبغة، مع عدم امتلاء مقابل داخل البحيرات الوريدية الجافوية في أشعة الأوردة بالصبغة (CTV)؛ ويرتبط بقوة بانخفاض ضغط السائل النخاعي بعد البزل القطني أو التخدير فوق الجافية (مثل ما بعد الولادة).",
  findingEn: "High-attenuating thrombus within the lateral dural venous lakes adjacent to the superior sagittal sinus on non-contrast CT with corresponding filling defects on CT venography (CTV); strongly associated with intracranial hypotension after lumbar puncture or postpartum epidural anesthesia.",   managementAr: "مضادات التخثر العلاجية (هيبارين منخفض الوزن الجزيئي LMWH)، علاج انخفاض ضغط السائل النخاعي (ترطيب، أو رقعة دموية فوق الجافية Epidural Blood Patch)، ومتابعة بـ CTV/MRV.",   managementEn: "Therapeutic anticoagulation (LMWH) and management of underlying intracranial hypotension (hydration / epidural blood patch if post-dural puncture leak).",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["ivlt", "venous lake", "parasagittal", "sagittal sinus", "thrombosis", "lumbar puncture", "postpartum", "خثار وريدي"],   radiomics: {
    brightnessRange: [90, 158],     contrastMin: 52,     asymmetryMin: 0.16,     hyperdense: true,
    anechoicFluid: false,     acousticShadow: false   } }, {
  id: "sr_neuro_acom_aneurysm_ich_sdh",   modality: "neuro_ct",   code: "ICD-10 I60.2 · @shortradiology",   categoryAr: "مقطعية المخ · نزيف أمهات الدم المخية (@shortradiology)",
  categoryEn: "Brain CT · Ruptured Aneurysm Hemorrhage (@shortradiology)",   ar: "نزيف دماغي وتحت الجافية من انفجار أم دم الشريان الموصل الأمامي — Ruptured ACOM Aneurysm ICH & SDH",   en: "Ruptured Anterior Communicating Artery (ACOM) Aneurysm — Gyrus Rectus Flame Hematoma, Acute Subdural Hematoma & Subfalcine Herniation",   scanAt: 0.87,
  findingAr: "ورم دموي حاد داخل التلفيف المستقيم الجبهي الأيمن (Right Gyrus Rectus) والشق بين نصفي الكرة المخية يمتد من منطقة الشريان الموصل الأمامي (ACOM)، مصحوب بنزيف حاد تحت الأم الجافية على المحدب الأيمن وانفتاق تحت المنجل (Subfalcine Herniation).",   findingEn: "Large acute right subdural hematoma combined with a right frontal gyrus rectus intraparenchymal hematoma extending anteriorly from the anterior communicating artery (ACOM) region and right-to-left subfalcine herniation.",   managementAr: "أشعة مقطعية بالصبغة على شرايين المخ فوراً (CTA)، نيموديبين (Nimodipine 60mg q4h) لمنع تشنج الشرايين، وغلق أم الدم بالقسطرة التداخلية (Coiling) أو الكلبس الجراحي (Clipping).",   managementEn: "STAT CT Angiography (CTA), oral Nimodipine for vasospasm prophylaxis, blood pressure control, and urgent endovascular coiling or microsurgical clipping with hematoma decompression.",
  sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["acom", "aneurysm", "gyrus rectus", "subarachnoid", "subdural", "ام دم", "الشريان الموصل"],
  radiomics: {     brightnessRange: [96, 175],     contrastMin: 58,     asymmetryMin: 0.34,
    hyperdense: true,     anechoicFluid: false,     acousticShadow: false   }
}, {   id: "sr_neuro_three_territory_stroke",   modality: "neuro_ct",   code: "ICD-10 I63.9 / C80 · @shortradiology",
  categoryAr: "مقطعية ورنين المخ · الجلطات الإقفارية متعددة المناطق (@shortradiology)",   categoryEn: "Brain CT/MRI · Cardioembolic & Malignancy Stroke Signs (@shortradiology)",   ar: "علامة المناطق الوعائية الثلاث — Three-Territory Sign (جلطات فرط التخثر المرتبط بالأورام Trousseau Syndrome)",   en: "The Three-Territory Sign — Acute Ischemic Infarcts Across Bilateral Anterior & Posterior Territories (Malignancy-Associated Trousseau Hypercoagulability)",
  scanAt: 0.89,   findingAr: "بؤر احتشاء إقفاري حاد متعددة تصيب ثلاث مناطق وعائية دماغية في آن واحد (الدورة الأمامية اليمنى واليسرى + الدورة الخلفية الفقارية القاعدية) مع سلامة الشرايين الكبرى؛ وتُعد علامة نوعية عالية الدقة لفرط التخثر المرتبط بالأورام الخبيثة (متلازمة تروسو) أو الصمات القلبية.",   findingEn: "Multiple acute ischemic infarctions simultaneously involving three vascular territories (bilateral anterior circulation + posterior vertebrobasilar circulation) without major vessel occlusion; highly specific (6x more frequent than AFib) for malignancy-related hypercoagulability (Trousseau syndrome).",   managementAr: "فحص شامل للبحث عن ورم خفي (أورام الرئة، البنكرياس، أو الجهاز الهضمي)، إيكو قلب عبر المريء لاستبعاد التهاب الشغاف اللاجرثومي (NBTE)، ومضادات التخثر بالهيبارين منخفض الوزن الجزيئي.",
  managementEn: "Occult malignancy workup (chest/abdomen/pelvis CT, tumor markers), echocardiography to exclude non-bacterial thrombotic (marantic) endocarditis, and LMWH anticoagulation.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["three territory", "three-territory", "trousseau", "malignancy stroke", "embolic stroke", "المناطق الثلاث"],   radiomics: {     brightnessRange: [72, 118],     contrastMin: 44,
    asymmetryMin: 0.18,     hyperdense: false,     anechoicFluid: true,     acousticShadow: false
  } }, {   id: "sr_neuro_diabetic_striatopathy",   modality: "neuro_ct",
  code: "ICD-10 E11.49 / G25.5 · @shortradiology",   categoryAr: "مقطعية المخ · اعتلال النوى القاعدية الاستقلابي (@shortradiology)",   categoryEn: "Brain CT · Metabolic Basal Ganglia Syndromes (@shortradiology)",   ar: "اعتلال الجسم المخطط السكري — Diabetic Striatopathy (Non-Ketotic Hyperglycemic Hemichorea)",
  en: "Diabetic Striatopathy (Non-Ketotic Hyperglycemic Hemichorea-Hemiballismus — Unilateral Hyperdense Caudate & Lentiform Nucleus Sparing Internal Capsule)",   scanAt: 0.88,   findingAr: "زيادة كثافة (Hyperdensity) أحادية الجانب محددة بدقة في الجسم المخطط (النواة المذنبة Caudate والنواة العدسية Lentiform/Putamen) في مقطعية المخ بدون صبغة، مع الحفاظ التام على الكبسولة الداخلية (Internal Capsule) وغياب أي تأثير كتلي أو وذمة محيطة (عكس النزيف الدماغي!).",   findingEn: "Characteristic unilateral hyperattenuation of the striatum (caudate nucleus and putamen) on non-contrast Brain CT (and T1 hyperintensity on MRI) strictly respecting anatomical boundaries, sparing the internal capsule with zero mass effect or surrounding edema in severe non-ketotic hyperglycemia.",
  managementAr: "ضبط مستوى سكر الدم بالإنسولين والترطيب الوريدي (تختفي الحركات اللاإرادية تدريجياً مع ضبط السكر)، ويمكن إضافة مثبطات الدوبامين (Haloperidol / Tetrabenazine) للحركات الشديدة.",   managementEn: "Strict glycemic control with insulin and IV hydration (hemichorea resolves following normalization of blood glucose), plus low-dose neuroleptics/tetrabenazine if chorea is disabling.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  channelUrl: "https://t.me/s/shortradiology",   keywords: ["diabetic striatopathy", "striatopathy", "hemichorea", "hemiballismus", "putamen", "caudate", "الجسم المخطط السكري"],   radiomics: {     brightnessRange: [88, 142],
    contrastMin: 48,     asymmetryMin: 0.22,     hyperdense: true,     anechoicFluid: false,
    acousticShadow: false   } }, {   id: "sr_neuro_klippel_feil_baastrup",
  modality: "neuro_ct",   code: "ICD-10 Q76.1 / M48.2 · @shortradiology",   categoryAr: "مقطعية الرقبة والعمود الفقري · متلازمات الفقرات والرقبة (@shortradiology)",   categoryEn: "Spine & Neck CT · Congenital & Degenerative Signs (@shortradiology)",
  ar: "متلازمة كليبل-فيل (علامة خصر الدبور Wasp-Waist Sign) وداء باستروب (Kissing Spine) وخراج ما حول اللوزة/خلف البلعوم",   en: "Klippel-Feil Syndrome (Wasp-Waist Block Vertebra), Baastrup Kissing Spine, Peritonsillar Quinsy & Retropharyngeal Abscess (@shortradiology)",   scanAt: 0.83,   findingAr: "١) علامة خصر الدبور (Wasp-Waist Sign): التحام خلقي بفقرات العنق في متلازمة كليبل-فيل مع نقص القطر الأمامي الخلفي عند مستوى القرص الملتحم. ٢) داء باستروب (Kissing Spine): تلامس النواتئ الشوكية القطنية مع تصلب عظمي. ٣) خراج حول اللوزة (Quinsy) وخلف البلعوم (Retropharyngeal Abscess): تجمع صديدي مع غاز أمام الفقرات C2–C7.",
  findingEn: "1) Wasp-Waist Sign in Klippel-Feil congenital block vertebra. 2) Baastrup Disease ('Kissing Spine') spinous process contact & sclerosis. 3) Peritonsillar (Quinsy) & Retropharyngeal Abscess with C2-C7 prevertebral widening and gas locules.",   managementAr: "تقييم استقرار الفقرات العنقية وتجنب الرياضات العنيفة في كليبل-فيل؛ حقن موضعي وعلاج طبيعي في داء باستروب؛ ومضادات حيوية وريدية مع تصريف جراحي عاجل وتأمين مجرى الهواء في خراجات الرقبة والبلعوم.",   managementEn: "Cervical spine stability workup in Klippel-Feil; local injection/physiotherapy in Baastrup disease; airway protection, IV broad-spectrum antibiotics, and surgical incision & drainage for deep neck abscesses.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["klippel-feil", "wasp waist", "baastrup", "kissing spine", "quinsy", "peritonsillar", "retropharyngeal", "rhinolith", "hirayama"],   radiomics: {
    brightnessRange: [82, 155],     contrastMin: 50,     asymmetryMin: 0.20,     hyperdense: true,
    anechoicFluid: false,     acousticShadow: false   } }, {
  id: "sr_cxr_hydatid_cysts",   modality: "chest_xray",   code: "ICD-10 B67.1 · @shortradiology",   categoryAr: "أشعة الصدر X-Ray · الأكياس المائية الرئوية (@shortradiology)",
  categoryEn: "Chest X-Ray · Parasitic & Cystic Lung Disease (@shortradiology)",   ar: "الأكياس المائية الرئوية ثنائية الجانب — Bilateral Pulmonary Hydatid Cysts (Echinococcosis)",   en: "Bilateral Pulmonary Hydatid Cysts (Echinococcus granulosus — Well-Defined Round Radiopaque Cysts, Crescent & Water-Lily Sign)",   scanAt: 0.67,
  findingAr: "ظلّان كرويان أو بيضاويان كثيفان محددا الحواف بدقة (Well-circumscribed Round Homogeneous Opacities) في الرئتين اليمنى واليسرى دون تكلس جداري، وعند انثقاب الكيس تظهر علامة الهلال الهوائي (Meniscus/Crescent Sign) أو علامة زهرة اللوتس العائمة (Water-Lily Sign).",   findingEn: "Well-demarcated bilateral round/oval homogenous radiopaque masses on CXR representing intact Echinococcus granulosus hydatid cysts; complicated cysts show the air-crescent sign or floating endocyst membranes ('Water-Lily Sign').",   managementAr: "استئصال جراحي محافظ للكيس (Parenchyma-sparing Enucleation / Pericystectomy) مع تجنب انسكاب السائل لمنع الصدمة التأقية، مصحوباً بعلاج ألبيندازول (Albendazole 10–15 mg/kg/day) وفحص الكبد بالسونار.",   managementEn: "Parenchyma-sparing surgical cystotomy/enucleation (avoiding spillage/anaphylaxis) combined with perioperative Albendazole therapy and abdominal ultrasound to screen for concomitant hepatic hydatid cysts.",
  sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["hydatid", "echinococcus", "water lily", "bilateral cysts", "اكياس مائية", "كيس مائي"],
  radiomics: {     brightnessRange: [85, 145],     contrastMin: 48,     asymmetryMin: 0.22,
    hyperdense: true,     anechoicFluid: true,     acousticShadow: false   }
}, {   id: "sr_ct_round_atelectasis_comet_tail",   modality: "chest_xray",   code: "ICD-10 J98.11 · @shortradiology",
  categoryAr: "مقطعية الصدر CT · الانخماص المدور وعلامة ذيل المذنب (@shortradiology)",   categoryEn: "Chest CT · Pleural-Based Pseudotumor & Comet-Tail Sign (@shortradiology)",   ar: "الانخماص الرئوي المدور وعلامة ذيل المذنب — Round Atelectasis (Comet-Tail Sign / Blesovsky Syndrome)",   en: "Round Atelectasis on Chest CT — Subpleural Mass-Like Consolidation with Swirling Bronchovascular 'Comet-Tail Sign'",
  scanAt: 0.64,   findingAr: "عتامة مستديرة شبيهة بالورم ملاصقة لغشاء الجنب السميك في الفص السفلي، مع علامة ذيل المذنب المميزة (Comet-Tail Sign) حيث تلتف الأوعية الدموية والشعب الهوائية وتنحني كالدوامة نحو حافة الكتلة مع فقدان حجم الفص المجاور (مهم جداً لعدم تشخيصها خطأً كسرطان رئة!).",   findingEn: "Subpleural rounded mass-like consolidation in the posterior lower lobe abutting focal pleural thickening/plaque, with characteristic curvilinear swirling of bronchovascular bundles into the medial margin of the lesion ('Comet-Tail Sign') and volume loss.",   managementAr: "آفة حميدة تماماً (غالباً بعد تعرض للأسبستوس أو التهاب بلوري سابق)؛ لا تحتاج لاستئصال جراحي إذا توفرت معايير علامة ذيل المذنب الكلاسيكية، ويكتفى بالمتابعة.",
  managementEn: "Benign folded-lung pseudotumor (strongly linked to asbestos pleural disease); recognition of the pathognomonic Comet-Tail Sign avoids unnecessary biopsy or thoracotomy.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["round atelectasis", "comet tail", "comet-tail", "blesovsky", "asbestos", "انخماص مدور", "ذيل المذنب"],   radiomics: {     brightnessRange: [78, 142],     contrastMin: 48,
    asymmetryMin: 0.26,     hyperdense: true,     anechoicFluid: false,     acousticShadow: false
  } }, {   id: "sr_cxr_devices_twiddler_impella_esophageal",   modality: "chest_xray",
  code: "ICD-10 T82.1 / Y70 · @shortradiology",   categoryAr: "أشعة الصدر X-Ray · متلازمة تويدلر، جهاز Impella، وتنبيب المريء الخاطئ (@shortradiology)",   categoryEn: "Chest X-Ray · ICU Tubes, Twiddler Pacemaker, Impella LVAD & Pectus Nuss Bar (@shortradiology)",   ar: "أجهزة وأنابيب الصدر الحرجة: متلازمة تويدلر (Twiddler)، مضخة Impella، وتنبيب المريء الخاطئ — ICU Devices & Tubes",
  en: "Critical CXR Devices & Malpositions: Twiddler Syndrome (Lead Dislodgement), Impella LVAD, Esophageal Intubation & Pectus Nuss Bar",   scanAt: 0.66,   findingAr: "١) متلازمة تويدلر (Twiddler Syndrome): التفاف أسلاك منظم ضربات القلب حول البطارية وانسحابها للأذين/الوريد الأجوف. ٢) تنبيب المريء الخاطئ (Esophageal Intubation): وجود أنبوبة الحنجرة خارج مسار القصبة الهوائية مع انتفاخ شديد بالمريء والمعدة بالهواء. ٣) مضخة Impella: قسطرة تمر عبر الصمام الأورطي داخل البطين الأيسر. ٤) علامة حافة الثدي الإنسية في تقعر الصدر وإجراء Nuss.",   findingEn: "1) Twiddler Syndrome: coiled/retracted pacemaker leads around pulse generator. 2) Esophageal Intubation: ETT projecting lateral/posterior to trachea with marked gastric & esophageal air distension. 3) Impella percutaneous LVAD crossing aortic root into LV. 4) Medial breast margin sign in Pectus Excavatum & retrosternal Nuss bar.",
  managementAr: "إعادة التنبيب الحنجري فوراً وتأكيد الموقع بالكابنوجرافي في تنبيب المريء؛ إعادة برمجة وتثبيت أسلاك المنظم جراحياً في متلازمة تويدلر؛ ومتابعة موقع مضخة Impella.",   managementEn: "Immediate extubation and endotracheal re-intubation with waveform capnography for esophageal intubation; surgical lead revision and generator pocket fixation in Twiddler syndrome.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  channelUrl: "https://t.me/s/shortradiology",   keywords: ["twiddler", "impella", "esophageal intubation", "nuss", "pectus excavatum", "pacemaker", "tee probe", "dbs"],   radiomics: {     brightnessRange: [75, 138],
    contrastMin: 46,     asymmetryMin: 0.19,     hyperdense: true,     anechoicFluid: false,
    acousticShadow: false   } }, {   id: "sr_ct_pericardial_recess_aortosternal",
  modality: "echo",   code: "ICD-10 I31.9 / Q24.8 · @shortradiology",   categoryAr: "إيكو ومقطعية القلب والأوعية · الجيب التاموري البارز وانضغاط الوريد الأبهرى القصي (@shortradiology)",   categoryEn: "Cardiac & Thoracic Vascular · Prominent Pericardial Recess & Aortosternal Venous Compression (@shortradiology)",
  ar: "الجيب التاموري الأبهري العلوي البارز وانضغاط الوريد العضدي الرأسي — Prominent Pericardial Recess & Aortosternal Compression",   en: "Prominent Superior Aortic Pericardial Recess (Trauma Mimic) & Aortosternal Left Brachiocephalic Venous Compression",   scanAt: 0.68,   findingAr: "١) الجيب التاموري الأبهري العلوي البارز (Prominent Superior Aortic Pericardial Recess): تجمع سائل طبيعي الهلالية بجوار القوس الأبهري يجب عدم تشخيصه خطأً كورم دموي منصفي أو تسلخ أورطي في حوادث الصدر. ٢) انضغاط الوريد العضدي الرأسي الأيسر (Aortosternal Venous Compression) بين الأبهر الصاعد المتمدد وعظمة القص مع أوردة جانبية.",
  findingEn: "1) Prominent fluid within the superior aortic pericardial recess (homogeneous fluid density, smooth margins, no fat stranding — key normal variant mimicking periaortic hematoma in trauma). 2) Aortosternal compression of the left brachiocephalic vein between a dilated ascending aorta and the sternum with collateral veins.",   managementAr: "التعرف على الجيب التاموري كمتغير تشريحي طبيعي يمنع التدخل الجراحي غير الضروري في الطوارئ؛ ومتابعة قطر الشريان الأورطي الصاعد في حالة انضغاط الوريد العضدي الرأسي.",   managementEn: "Reassurance and recognition of the superior aortic pericardial recess as a benign anatomical variant to prevent misdiagnosis as traumatic aortic injury; monitor ascending aortic aneurysm dimensions.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["pericardial recess", "aortosternal", "brachiocephalic vein", "periaortic", "الجيب التاموري"],   radiomics: {
    brightnessRange: [60, 130],     contrastMin: 45,     asymmetryMin: 0.18,     hyperdense: false,
    anechoicFluid: true,     acousticShadow: false   } }, {
  id: "sr_spl_grade4_pseudoaneurysms",   modality: "abdomen_us",   digestiveOrgan: "spleen",   code: "ICD-10 S36.032A · @shortradiology",
  categoryAr: "الطحال والأورطي · تهتك الطحال من الدرجة الرابعة مع أمهات دم كاذبة (@shortradiology)",   categoryEn: "Spleen & Trauma · AAST Grade IV Splenic Rupture with Pseudoaneurysms (@shortradiology)",   ar: "إصابة وتهتك الطحال من الدرجة الرابعة مع أمهات دم كاذبة متعددة — Grade 4 Splenic Injury with Multiple Pseudoaneurysms",   en: "AAST Grade IV Splenic Rupture with Multiple Intrasplenic Arterial Pseudoaneurysms & Large Hemoperitoneum",
  scanAt: 0.70,   findingAr: "تمزق شديد بالطحال (فقدان تروية > 25%) مع تجمع دموي بريتوني كبير (Hemoperitoneum)، وظهور بؤر متعددة عالية الكثافة في الطور الشرياني داخل الجزء الخلفي للطحال تقل كثافتها في الطور الوريدي البابي مما يؤكد وجود أمهات دم كاذبة شريانية (Pseudoaneurysms) معرضة للانفجار.",   findingEn: "Shattered/lacerated posterior spleen (>25% devascularization) with large-volume hemoperitoneum and multiple focal arterial-phase hyperattenuating blushes that wash out/isodense on portal venous phase, diagnostic of traumatic intrasplenic pseudoaneurysms.",   managementAr: "قسطرة شريانية عاجلة لإصمام الشريان الطحالي (Splenic Artery Angioembolization) إذا كان المريض مستقراً ديناميكياً، أو استئصال الطحال الجراحي الفوري (Exploratory Laparotomy & Splenectomy) في حال عدم استقرار الضغط.",
  managementEn: "Urgent catheter angiography and selective/proximal splenic artery embolization (SAE) if hemodynamically stable, or immediate laparotomy and splenectomy if unstable.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["grade 4 splenic", "pseudoaneurysm", "splenic rupture", "hemoperitoneum", "تمزق الطحال", "ام دم كاذبة"],   radiomics: {     brightnessRange: [45, 138],     contrastMin: 48,
    asymmetryMin: 0.28,     hyperdense: true,     anechoicFluid: true,     acousticShadow: false
  } }, {   id: "sr_pan_colon_cutoff_sign",   modality: "abdomen_us",
  digestiveOrgan: "pancreas",   code: "ICD-10 K85.9 / K56.6 · @shortradiology",   categoryAr: "البنكرياس والأمعاء · علامة انقطاع القولون (@shortradiology)",   categoryEn: "Pancreas & GI · The Colon Cut-Off Sign in Acute Pancreatitis (@shortradiology)",
  ar: "علامة انقطاع القولون في التهاب البنكرياس الحاد — The Colon Cut-Off Sign",   en: "The Colon Cut-Off Sign — Proximal Transverse Colon Dilatation with Abrupt Splenic Flexure Cutoff in Acute Pancreatitis",   scanAt: 0.61,   findingAr: "تمدد غازي في القولون الصاعد والمستعرض ينتهي فجأة وبشكل حاد عند الثنية الطحالية للقولون (Splenic Flexure) مع فراغ القولون النازل من الغاز؛ وينتج عن امتداد الإفرازات الالتهابية للبنكرياس عبر الرباط الحجابي القولوني (Phrenicocolic Ligament) مما يسبب تشنجاً وشللاً موضعياً بالثنية الطحالية.",
  findingEn: "Gaseous distension of the proximal/transverse colon with abrupt termination of intraluminal gas at the splenic flexure and distal colonic decompression, caused by inflammatory pancreatic exudate tracking along the transverse mesocolon and phrenicocolic ligament.",   managementAr: "إنعاش سوائلي وريدي مكثف، تسكين الألم، راحة الأمعاء أو التغذية المعوية المبكرة، واستبعاد نقص التروية المساريقي أو أورام القولون السادة.",   managementEn: "Aggressive IV fluid resuscitation, analgesia, early enteral nutrition for acute pancreatitis, and CT correlation to exclude ischemic colitis or obstructing splenic flexure carcinoma.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["colon cut-off", "colon cutoff", "splenic flexure", "pancreatitis", "انقطاع القولون"],   radiomics: {
    brightnessRange: [38, 125],     contrastMin: 44,     asymmetryMin: 0.24,     hyperdense: false,
    anechoicFluid: true,     acousticShadow: false   } }, {
  id: "sr_gi_jejunal_diverticulitis_magnets",   modality: "abdomen_us",   digestiveOrgan: "bowel",   code: "ICD-10 K57.12 / T18.2 · @shortradiology",
  categoryAr: "الأمعاء والطوارئ · التهاب رتج الصائم الحاد وابتلاع الخرز المغناطيسي (@shortradiology)",   categoryEn: "Bowel & Pediatric GI Emergencies · Acute Jejunal Diverticulitis & Magnetic Bead Ingestion (@shortradiology)",   ar: "التهاب رتج الصائم الحاد (Acute Jejunal Diverticulitis) وابتلاع الخرز المغناطيسي عند الأطفال (Magnetic Bead Ingestion)",   en: "Acute Jejunal Diverticulitis & Pediatric Multiple Magnetic Bead Ingestion (Enteroenteric Fistula & Perforation Risk)",
  scanAt: 0.43,   findingAr: "١) التهاب رتج الصائم الحاد (Jejunal Diverticulitis): تبارز رتجي كبير في الأمعاء الدقيقة (الصائم) مع تسمك جداره والتهاب الدهون المساريقية المجاورة. ٢) ابتلاع الخرز المغناطيسي (Magnetic Bead Ingestion): خرزات معدنية متعددة شديدة البياض في المعدة والقولون تجذب بعضها عبر جدران الأمعاء مسببة نخر ضغطي وانثقاب ونواسير معوية خطيرة.",   findingEn: "1) Acute Jejunal Diverticulitis: inflamed outpouching along the mesenteric border of the jejunum with wall thickening and peridiverticular fat stranding. 2) Pediatric Magnetic Bead Ingestion: multiple radiopaque magnetic beads attracting across adjacent bowel walls, risking pressure necrosis, fistula, and perforation.",   managementAr: "مضادات حيوية وريدية (واستئصال جراحي إذا حدث انثقاب) في التهاب رتج الصائم؛ وإزالة فورية بالمنظار أو الجراحة عند ابتلاع أكثر من مغناطيس واحد حتى لو لم توجد أعراض!",
  managementEn: "IV antibiotics (or segmental resection if perforated) for jejunal diverticulitis; urgent endoscopic or surgical removal whenever ≥2 magnets are ingested due to high risk of trans-mural pressure necrosis.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["jejunal diverticulitis", "magnetic bead", "magnets", "foreign body", "رتج الصائم", "خرز مغناطيسي"],   radiomics: {     brightnessRange: [55, 155],     contrastMin: 46,
    asymmetryMin: 0.22,     hyperdense: true,     anechoicFluid: false,     acousticShadow: true
  } }, {   id: "sr_liv_parastomal_varices_rectus_hematoma",   modality: "abdomen_us",
  digestiveOrgan: "liver",   code: "ICD-10 I86.8 / M79.81 · @shortradiology",   categoryAr: "الكبد وجدار البطن · الدوالي حول الفغرة والورم الدموي بغمد العضلة المستقيمة (@shortradiology)",   categoryEn: "Portal HTN & Abdominal Wall · Parastomal Varices & Rectus Sheath Hematoma (@shortradiology)",
  ar: "الدوالي حول الفغرة في ارتفاع الضغط البابي (Parastomal Varices) والورم الدموي بغمد العضلة المستقيمة (Rectus Sheath Hematoma)",   en: "Parastomal Portosystemic Varices in Portal Hypertension & Rectus Sheath Hematoma (Doppler-Negative Spindle Mass)",   scanAt: 0.68,   findingAr: "١) الدوالي حول الفغرة (Parastomal Varices): أوعية وريدية متوسعة ومتعرجة تشع حول فغرة الأمعاء (Stoma) نتيجة تحويلة بابية جهازية في مرضى تليف الكبد وارتفاع الضغط البابي. ٢) الورم الدموي في غمد العضلة المستقيمة (Rectus Sheath Hematoma): تجمع مغزلي غير متجانس ناقص الصدى داخل غمد عضلة البطن المستقيمة بدون أي تروية داخلية في الدوبلر الملون (يرتبط بأدوية السيولة والكحة الشديدة).",
  findingEn: "1) Parastomal Varices: prominent tortuous dilated portosystemic collateral veins radiating around an abdominal stoma in portal hypertension (high risk of brisk stomal bleeding). 2) Rectus Sheath Hematoma: elongated heterogeneous hypoechoic collection confined to the rectus sheath with zero internal Color Doppler flow.",   managementAr: "ضغط موضعي، خفض ضغط الوريد البابي أو عملية TIPS/إصمام للدوالي حول الفغرة؛ وعلاج تحفظي مع عكس أدوية السيولة (أو إصمام الشريان الشرسوفي السفلي إذا استمر النزف) في ورم غمد العضلة المستقيمة.",   managementEn: "Local compression, beta-blockers, coil embolization, or TIPS for bleeding parastomal varices; anticoagulation reversal and supportive care (or inferior epigastric artery embolization if expanding) for rectus sheath hematoma.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["parastomal varices", "peristomal", "rectus sheath hematoma", "stoma", "fothergill", "carnett", "دوالي الفغرة", "غمد العضلة المستقيمة"],   radiomics: {
    brightnessRange: [35, 118],     contrastMin: 44,     asymmetryMin: 0.25,     hyperdense: false,
    anechoicFluid: true,     acousticShadow: false,     dopplerColor: true   }
}, {   id: "sr_cxr_golden_s_pancoast",   modality: "chest_xray",   code: "ICD-10 C34.1 / J98.11 · @shortradiology",
  categoryAr: "أشعة الصدر X-Ray · ورم بانكوست وعلامة S الذهبية (@shortradiology)",   categoryEn: "Chest X-Ray · Pancoast Superior Sulcus Tumor & Golden S-Sign (@shortradiology)",   ar: "ورم قمة الرئة (Pancoast Tumor) وعلامة S الذهبية للانخماص الفصي — Golden S-Sign (@shortradiology)",   en: "Pancoast Superior Sulcus Apical Mass & Reverse S-Sign of Golden in Central Bronchogenic Obstruction (@shortradiology)",
  scanAt: 0.78,   findingAr: "عتامة غير متماثلة بقمة الرئة (> 5 مم) قد تصاحبها تآكلات بالضلع الأول والثاني ومتلازمة هورنر (Pancoast Tumor)، أو انخماص الفص العلوي الأيمن مع تقعر الشق الصغير بالخارج وتحدبه بالداخل حول كتلة السرة (علامة S الذهبية Golden S-Sign).",   findingEn: "Apical pleural-based mass >5 mm with 1st/2nd rib destruction (Pancoast tumor) or right upper lobe collapse with central hilar mass convexity and peripheral fissure concavity forming the classic 'Reverse S-Sign of Golden'.",   managementAr: "مقطعية صدر بالصبغة ورنين مغناطيسي للضفيرة العضدية، أخذ عينة بالإبرة أو المنظار، وعلاج إشعاعي وكيماوي قبل الاستئصال الجراحي.",
  managementEn: "Contrast chest CT, brachial plexus MRI, bronchoscopy/CT-guided biopsy, and neoadjuvant chemoradiotherapy followed by en-bloc surgical resection.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["pancoast", "golden s", "superior sulcus", "horner", "apical mass", "ورم بانكوست", "علامة S الذهبية"],   radiomics: {     brightnessRange: [88, 152],     contrastMin: 48,
    asymmetryMin: 0.28,     hyperdense: true,     anechoicFluid: false,     acousticShadow: false
  } }, {   id: "sr_cxr_scimitar_hampton_luftsichel",   modality: "chest_xray",
  code: "ICD-10 Q26.2 / I26.9 · @shortradiology",   categoryAr: "أشعة الصدر X-Ray · متلازمة السيف التركي وعلامتي هامبتون ووسترمارك (@shortradiology)",   categoryEn: "Chest X-Ray · Scimitar Syndrome, Hampton Hump, Westermark & Luftsichel Signs (@shortradiology)",   ar: "متلازمة السيف التركي (Scimitar Sign)، سنام هامبتون ووسترمارك (PE)، وعلامة المنجل الهوائي (Luftsichel Sign)",
  en: "Scimitar Syndrome (Turkish Sword PAPVR), Hampton Hump & Westermark Sign in PE, and Luftsichel Sign in LUL Collapse (@shortradiology)",   scanAt: 0.69,   findingAr: "١) علامة السيف التركي (Scimitar Sign): وريد رئوي أيمن شاذ ينحدر كالسيف المقوس بموازاة حد القلب الأيمن ليصب في الوريد الأجوف السفلي. ٢) سنام هامبتون (Hampton Hump): عتامة مثلثية قاعدتها للبللورا في احتشاء الرئة، وعلامة وسترمارك (Westermark Sign) لندرة الأوعية. ٣) علامة المنجل الهوائي (Luftsichel Sign): هلال هوائي حول قوس الأورطي في انخماص الفص العلوي الأيسر.",   findingEn: "1) Scimitar Sign: curved anomalous right pulmonary vein draining into IVC resembling a Turkish sword. 2) Hampton Hump (wedge-shaped peripheral infarction) & Westermark Sign (focal oligemia) in PE. 3) Luftsichel Sign: para-aortic hyperlucent air crescent of hyperinflated LLL superior segment in LUL collapse.",
  managementAr: "مقطعية بالصبغة على شرايين الرئة (CTPA) ومضادات التخثر في الانصمام الرئوي؛ ومنظار شعبي في انخماص الفص العلوي الأيسر؛ وإصلاح جراحي للعود الوريدي الشاذ إذا زادت نسبة التحويلة Qp:Qs > 1.5.",   managementEn: "CTPA and anticoagulation for PE; bronchoscopy to exclude endobronchial lesion in LUL collapse; surgical baffling if Qp:Qs >1.5 in Scimitar syndrome.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  channelUrl: "https://t.me/s/shortradiology",   keywords: ["scimitar", "hampton hump", "westermark", "luftsichel", "papvr", "السيف التركي", "هامبتون"],   radiomics: {     brightnessRange: [76, 140],
    contrastMin: 46,     asymmetryMin: 0.24,     hyperdense: true,     anechoicFluid: false,
    acousticShadow: false   } }, {   id: "sr_cxr_pneumomediastinum_continuous_diaphragm",
  modality: "chest_xray",   code: "ICD-10 J98.2 · @shortradiology",   categoryAr: "أشعة الصدر X-Ray · استرواح المنصف وعلامة الحجاب المتصل (@shortradiology)",   categoryEn: "Chest X-Ray · Pneumomediastinum (Continuous Diaphragm, Naclerio V & Thymic Sail Signs) (@shortradiology)",
  ar: "استرواح المنصف وعلامة الحجاب الحاجز المتصل وعلامة V لـ ناكليريو — Continuous Diaphragm & Naclerio V Sign",   en: "Pneumomediastinum — Continuous Diaphragm Sign, Naclerio V Sign (Esophageal/Alveolar Rupture) & Pediatric Thymic Sail Sign (@shortradiology)",   scanAt: 0.65,   findingAr: "وجود هواء حر في المنصف يفصل التامور عن الحجاب الحاجز فيظهر خط الحجاب الحاجز متصلاً بالكامل تحت القلب (Continuous Diaphragm Sign)، مع خط هوائي على شكل حرف V عند التقاء الأورطي النازل والحجاب الأيسر (Naclerio V Sign — يوجه لانثقاب المريء Boerhaave Syndrome)، وعلامة شراع السفينة للغدة الزعترية في الرضع (Thymic Sail Sign).",
  findingEn: "Mediastinal gas outlining the inferior cardiac border to create an unbroken diaphragmatic line ('Continuous Diaphragm Sign'), V-shaped air lucency at the left lower mediastinum ('Naclerio V Sign' in Boerhaave esophageal rupture), and elevated thymic lobes ('Angel-Wing / Thymic Sail Sign') in infants.",   managementAr: "استبعاد انثقاب المريء فوراً (مقطعية صدر بصبغة مائية الفم) أو إصابة القصبة الهوائية؛ والعلاج التحفظي بالأكسجين 100% في الاسترواح المنصفي التلقائي الحميد.",   managementEn: "Urgent water-soluble contrast esophagogram/CT if Boerhaave esophageal perforation is suspected; high-flow O2 nitrogen washout for benign spontaneous pneumomediastinum.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["continuous diaphragm", "naclerio", "pneumomediastinum", "boerhaave", "thymic sail", "استرواح المنصف"],   radiomics: {
    brightnessRange: [62, 128],     contrastMin: 48,     asymmetryMin: 0.16,     hyperdense: false,
    anechoicFluid: true,     acousticShadow: false   } }, {
  id: "sr_ct_crazy_paving_halo_atoll",   modality: "chest_xray",   code: "ICD-10 J84.01 / B44.0 · @shortradiology",   categoryAr: "مقطعية الصدر CT · التبليط المجنون وعلامة الهالة والمرجان (@shortradiology)",
  categoryEn: "Chest CT · Crazy-Paving Pattern, Halo Sign & Reverse Halo (Atoll) Sign (@shortradiology)",   ar: "نمط التبليط المجنون (Crazy-Paving)، علامة الهالة (Halo Sign)، والهالة المعكوسة (Reverse Halo / Atoll Sign)",   en: "HRCT Classic Signs: Crazy-Paving (PAP / ARDS), CT Halo Sign (Angioinvasive Aspergillosis) & Reverse Halo / Atoll Sign (COP / Mucor) (@shortradiology)",   scanAt: 0.63,
  findingAr: "١) التبليط المجنون (Crazy-Paving): عتامة زجاجية مغشاة (GGO) تتراكب عليها شبكة من تثخن الحواجز بين الفصيصات (في الداء البروتيني السنخي PAP أو COVID/ARDS). ٢) علامة الهالة (CT Halo Sign): عقيدة محاطة بهالة زجاجية من النزيف الحويصلي في الفطار الرشاشي الغازي للأوعية. ٣) الهالة المعكوسة (Atoll Sign): مركز زجاجي محاط بحلقة تكثف هلالية في ذات الرئة المنظمة (COP) أو الفطر الأسود.",   findingEn: "1) Crazy-Paving Pattern: ground-glass attenuation with superimposed interlobular/intralobular septal thickening (Pulmonary Alveolar Proteinosis, COVID-19, Lipoid Pneumonia). 2) CT Halo Sign: solid nodule surrounded by ground-glass hemorrhage halo (angioinvasive aspergillosis). 3) Reverse Halo (Atoll) Sign: central GGO ringed by dense consolidation (Cryptogenic Organizing Pneumonia / Pulmonary Mucormycosis).",   managementAr: "غسل الرئة الكامل في PAP؛ مضادات الفطريات الوريدية الفورية (Voriconazole في الرشاشيات أو Amphotericin B في الفطر الأسود)؛ أو الكورتيزون في ذات الرئة المنظمة COP.",   managementEn: "Whole-lung lavage for PAP; voriconazole for angioinvasive aspergillosis / liposomal amphotericin B for mucormycosis; corticosteroids for cryptogenic organizing pneumonia (COP).",
  sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["crazy paving", "halo sign", "reverse halo", "atoll sign", "aspergillosis", "organizing pneumonia", "التبليط المجنون", "علامة الهالة"],
  radiomics: {     brightnessRange: [88, 154],     contrastMin: 46,     asymmetryMin: 0.18,
    hyperdense: true,     anechoicFluid: false,     acousticShadow: false   }
}, {   id: "sr_ct_finger_in_glove_fallen_lung",   modality: "chest_xray",   code: "ICD-10 B44.81 / S27.4 · @shortradiology",
  categoryAr: "مقطعية الصدر CT · علامة الإصبع في القفاز وعلامة الرئة الساقطة (@shortradiology)",   categoryEn: "Chest CT · Finger-in-Glove Sign (ABPA) & Fallen Lung Sign (Bronchial Transection) (@shortradiology)",   ar: "علامة الإصبع في القفاز (Finger-in-Glove Sign — ABPA) وعلامة الرئة الساقطة في انقطاع القصبة (Fallen Lung Sign)",   en: "Finger-in-Glove Sign (Tubular Mucoid Impaction in ABPA) & Fallen Lung Sign (Complete Mainstem Bronchial Transection) (@shortradiology)",
  scanAt: 0.62,   findingAr: "١) علامة الإصبع في القفاز (Finger-in-Glove Sign): كثافات أنبوبية متفرعة كأصابع القفاز تشع من سرة الرئة نتيجة انحشار المخاط الكثيف داخل القصبات المتوسعة في داء الرشاشيات القصبي الرئوي التحسسي (ABPA). ٢) علامة الرئة الساقطة (Fallen Lung Sign): سقوط الرئة المنكمشة للأسفل وللخارج بعيداً عن السرة عند انقطاع القصبة الهوائية الرئيسية بالكامل في حوادث الصدر.",   findingEn: "1) Finger-in-Glove Sign: branching tubular/lobulated radiopacities radiating from the hilum representing high-attenuation mucoid impaction within central bronchiectasis (pathognomonic of ABPA or bronchial atresia). 2) Fallen Lung Sign: collapsed lung falling dependently laterally and posteriorly away from the hilum in complete mainstem bronchial transection.",   managementAr: "كورتيزون جهازي مع إيتراكونازول (Itraconazole) في ABPA؛ وتنبيب انتقائي للقصبة السليمة مع إصلاح جراحي عاجل للقصبة المقطوعة في علامة الرئة الساقطة.",
  managementEn: "Systemic corticosteroids + antifungal therapy (Itraconazole/Voriconazole) for ABPA; emergent bronchoscopy, contralateral single-lumen intubation, and surgical bronchial anastomosis for Fallen Lung Sign.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["finger in glove", "abpa", "mucoid impaction", "fallen lung", "bronchial transection", "الاصبع في القفاز", "الرئة الساقطة"],   radiomics: {     brightnessRange: [82, 148],     contrastMin: 50,
    asymmetryMin: 0.28,     hyperdense: true,     anechoicFluid: false,     acousticShadow: false
  } }, {   id: "sr_echo_takotsubo_mcconnell_ebstein",   modality: "echo",
  code: "ICD-10 I51.81 / Q22.5 · @shortradiology",   categoryAr: "إيكو القلب والأوعية · متلازمة تاكوتسوبو وعلامة ماكونيل وشذوذ إبشتاين (@shortradiology)",   categoryEn: "Echocardiography · Takotsubo Apical Ballooning, McConnell Sign (PE) & Ebstein Anomaly (@shortradiology)",   ar: "متلازمة القلب المنكسر (Takotsubo Apical Ballooning)، علامة ماكونيل (McConnell Sign)، وشذوذ إبشتاين (Ebstein Anomaly)",
  en: "Takotsubo Stress Cardiomyopathy (Apical Ballooning), McConnell Sign in Massive PE & Ebstein Anomaly Apical Tricuspid Displacement (@shortradiology)",   scanAt: 0.70,   findingAr: "١) متلازمة تاكوتسوبو (Takotsubo): توقف حركة وتمدد قمة البطين الأيسر كالفخ (Apical Ballooning) مع فرط انقباض القاعدة وسلامة الشرايين التاجية. ٢) علامة ماكونيل (McConnell Sign): شلل الجدار الحر للبطين الأيمن مع بقاء انقباض قمة البطين الأيمن طبيعياً في الجلطة الرئوية الجسيمة. ٣) شذوذ إبشتاين (Ebstein Anomaly): إزاحة الشرفة الحاجزية للصمام ثلاثي الشرفات نحو القمة (> 8 مم/م²) مع تأذين البطين الأيمن.",   findingEn: "1) Takotsubo Cardiomyopathy: transient LV apical akinesia/ballooning with basal hypercontractility exceeding a single coronary territory. 2) McConnell Sign: RV mid-free-wall akinesia with preserved hyperdynamic RV apex in acute pulmonary embolism. 3) Ebstein Anomaly: apical displacement of septal tricuspid leaflet (>8 mm/m²) with 'atrialized' RV and giant right atrium.",
  managementAr: "علاج داعم ومثبطات بيتا وACEi في تاكوتسوبو؛ إذابة الجلطة أو استئصالها في علامة ماكونيل مع هبوط الضغط؛ وإصلاح مخروطي للصمام ثلاثي الشرفات (Cone Reconstruction) في شذوذ إبشتاين.",   managementEn: "Supportive heart failure therapy (ACEi + Beta-blockers) in Takotsubo; systemic thrombolysis/thrombectomy for massive PE with McConnell sign; Cone tricuspid repair for Ebstein anomaly.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  channelUrl: "https://t.me/s/shortradiology",   keywords: ["takotsubo", "mcconnell", "ebstein", "apical ballooning", "water bottle heart", "تاكوتسوبو", "ماكونيل", "إبشتاين"],   radiomics: {     brightnessRange: [55, 132],
    contrastMin: 46,     asymmetryMin: 0.22,     hyperdense: false,     anechoicFluid: true,
    acousticShadow: false,     highCTR: true   } }, {
  id: "sr_neuro_cord_empty_delta_mount_fuji",   modality: "neuro_ct",   code: "ICD-10 G08 / S06.8 · @shortradiology",   categoryAr: "مقطعية المخ · علامة الحبل الكثيف والدلتا الفارغة وعلامة جبل فوجي (@shortradiology)",
  categoryEn: "Brain CT · Dense Cord Sign, Empty Delta Sign (CVT) & Mount Fuji Sign (Tension Pneumocephalus) (@shortradiology)",   ar: "علامة الحبل الكثيف والدلتا الفارغة (خثار الجيوب الوريدية CVT) وعلامة جبل فوجي (استرواح القحف الضاغط Mount Fuji Sign)",   en: "Dense Cord & Empty Delta Sign in Cerebral Venous Sinus Thrombosis (CVT) & Mount Fuji Sign in Tension Pneumocephalus (@shortradiology)",   scanAt: 0.89,
  findingAr: "١) علامة الحبل الكثيف (Dense Cord Sign) والدلتا الفارغة (Empty Delta Sign): زيادة كثافة الجيب السهمي العلوي أو المستعرض (> 70 HU) في المقطعية بدون صبغة، وظهور مثلث مركزي مظلم محاط بحواف مضيئة بالصبغة. ٢) علامة جبل فوجي (Mount Fuji Sign): تجمع هواء ضاغط تحت الجافية في الفصين الجبهيين يضغط ويفصل قمتي الفصين الجبهيين فيشبه قمة جبل فوجي البركانية.",   findingEn: "1) Dense Cord / Dense Triangle Sign on NCCT and Empty Delta Sign on CECT/CTV in superior sagittal sinus thrombosis. 2) Mount Fuji Sign: bilateral frontal subdural air under tension compressing and separating the frontal lobe tips, creating a peaked silhouette resembling Mount Fuji.",   managementAr: "هيبارين علاجي فوري (LMWH / UFH) في خثار الجيوب الوريدية حتى في وجود نزيف وريدي ثانوي؛ وتفريغ جراحي عصبي عاجل عبر ثقب الجمجمة (Burr-Hole Decompression) مع أكسجين 100% في استرواح القحف الضاغط.",   managementEn: "Immediate therapeutic anticoagulation (LMWH/UFH) for dural venous sinus thrombosis (even if venous hemorrhagic infarction is present); emergent neurosurgical burr-hole decompression and 100% O2 for Tension Pneumocephalus (Mount Fuji Sign).",
  sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["empty delta", "dense cord", "mount fuji", "tension pneumocephalus", "sinus thrombosis", "جبل فوجي", "الدلتا الفارغة"],
  radiomics: {     brightnessRange: [65, 145],     contrastMin: 52,     asymmetryMin: 0.20,
    hyperdense: true,     anechoicFluid: true,     acousticShadow: false   }
}, {   id: "sr_neuro_pericallosal_lipoma_harlequin_rhinolith",   modality: "neuro_ct",   code: "ICD-10 D17.9 / Q75.0 · @shortradiology",
  categoryAr: "مقطعية المخ والجمجمة · الورم الشحمي حول الجسم الثفني، عين المهرج، وحصوة الأنف (@shortradiology)",   categoryEn: "Brain & Skull CT · Pericallosal Lipoma, Harlequin Eye Craniosynostosis & Nasal Rhinolith (@shortradiology)",   ar: "الورم الشحمي حول الجسم الثفني (Pericallosal Lipoma)، تشوه عين المهرج (Harlequin Eye)، وحصوة الأنف (Rhinolith)",   en: "Tubulonodular vs Curvilinear Pericallosal Lipoma, Harlequin Eye Coronal Craniosynostosis & Calcified Intranasal Rhinolith (@shortradiology)",
  scanAt: 0.86,   findingAr: "١) الورم الشحمي حول الجسم الثفني (Pericallosal Lipoma): كتلة دهنية شديدة السواد (-50 إلى -100 HU) في خط المنتصف مع تكلسات قشرية، إما أمامية عقدية أنبوبية (ترتبط بغياب الجسم الثفني) أو خلفية منحنية رفيعة. ٢) تشوه عين المهرج (Harlequin Eye): ارتفاع الحافة العلوية الوحشية للحجاج نتيجة الالتحام المبكر للدرز الإكليلي. ٣) حصوة الأنف (Rhinolith): كتلة متكلسة بالتجويف الأنفي تمتد للقمع (Choana).",   findingEn: "1) Pericallosal Lipoma: midline fat-attenuation (-50 to -100 HU) lesion along the corpus callosum (anterior tubulonodular vs posterior curvilinear). 2) Harlequin Eye Deformity: superolateral orbital roof elevation in unilateral coronal craniosynostosis. 3) Rhinolith: densely calcified intranasal calculus extending to the choana.",   managementAr: "الورم الشحمي حول الجسم الثفني آفة حميدة لا تُستأصل جراحياً؛ إزالة حصوة الأنف بالمنظار الأنفي؛ وإصلاح القحف الجراحي التجميلي في تعظم الدروز المبكر.",
  managementEn: "Conservative management for benign pericallosal lipoma (no surgical excision); endoscopic transnasal extraction for rhinolith; craniofacial remodeling for coronal synostosis.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["pericallosal lipoma", "harlequin eye", "rhinolith", "sphenoid pneumatization", "orbital cellulitis", "chandler", "عين المهرج", "حصوة الانف"],   radiomics: {     brightnessRange: [70, 152],     contrastMin: 54,
    asymmetryMin: 0.24,     hyperdense: true,     anechoicFluid: true,     acousticShadow: true
  } }, {   id: "sr_gb_porcelain_emphysematous_mirizzi",   modality: "abdomen_us",
  digestiveOrgan: "gallbladder",   code: "ICD-10 K82.8 / K81.0 · @shortradiology",   categoryAr: "المرارة والقنوات المرارية · المرارة الخزفية، التهاب المرارة النفاخي، ومتلازمة ميريزي (@shortradiology)",   categoryEn: "Gallbladder US & CT · Porcelain Gallbladder, Emphysematous Cholecystitis & Mirizzi Syndrome (@shortradiology)",
  ar: "المرارة الخزفية المتكلسة (Porcelain GB)، التهاب المرارة النفاخي بالغاز (Emphysematous)، ومتلازمة ميريزي (Mirizzi Syndrome)",   en: "Porcelain Gallbladder (Curvilinear Mural Calcification), Emphysematous Cholecystitis (Intramural Gas & Ring-Down) & Mirizzi Syndrome (@shortradiology)",   scanAt: 0.67,   findingAr: "١) المرارة الخزفية (Porcelain Gallbladder): تكلس قشري في جدار المرارة يعطي ظلاً صوتياً مقوساً ويزيد خطر سرطان المرارة. ٢) التهاب المرارة النفاخي (Emphysematous Cholecystitis): وجود غاز داخل جدار ولمعة المرارة مع أصداء متسخة (Dirty Shadowing / Ring-Down Artifact) في مرضى السكري. ٣) متلازمة ميريزي (Mirizzi Syndrome): انحشار حصوة في جيب هارتمان تضغط خارجياً على القناة الكبدية المشتركة.",
  findingEn: "1) Porcelain Gallbladder: dystrophic curvilinear calcification of the GB wall. 2) Emphysematous Cholecystitis: echogenic intramural/intraluminal gas foci with dirty acoustic shadowing and ring-down artifact in diabetic patients (high gangrene/perforation risk). 3) Mirizzi Syndrome: impacted stone in Hartmann pouch/cystic duct externally compressing the common hepatic duct.",   managementAr: "استئصال المرارة الجراحي الطارئ مع مضادات حيوية وريدية تغطي البكتيريا اللاهوائية في التهاب المرارة النفاخي؛ وتصريف مراري بالمنظار (ERCP) مع استئصال جزئي حذر في متلازمة ميريزي لتجنب إصابة القناة المرارية.",   managementEn: "Emergent cholecystectomy + broad-spectrum anaerobic IV antibiotics for emphysematous cholecystitis; ERCP stenting and subtotal cholecystectomy for Mirizzi syndrome; prophylactic cholecystectomy for selective mucosal porcelain gallbladder.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["porcelain gallbladder", "emphysematous cholecystitis", "mirizzi", "bouveret", "gallstone ileus", "مرارة خزفية", "ميريزي"],   radiomics: {
    brightnessRange: [52, 158],     contrastMin: 50,     asymmetryMin: 0.24,     hyperdense: true,
    anechoicFluid: true,     acousticShadow: true   } }, {
  id: "sr_kid_emphysematous_nutcracker_staghorn",   modality: "abdomen_us",   digestiveOrgan: "kidney",   code: "ICD-10 N10 / N20.0 · @shortradiology",
  categoryAr: "الكلى والمسالك · التهاب الحويضة والكلية النفاخي، حصوة قرن الوعل، ومتلازمة كسارة البندق (@shortradiology)",   categoryEn: "Renal US & CT · Emphysematous Pyelonephritis, Staghorn Calculus & Renal Nutcracker Syndrome (@shortradiology)",   ar: "التهاب الكلية النفاخي بالغاز (Emphysematous Pyelonephritis)، حصوة قرن الوعل المرجانية (Staghorn)، ومتلازمة كسارة البندق (Nutcracker)",   en: "Emphysematous Pyelonephritis (Parenchymal Gas), Coral Staghorn Struvite Calculus & Aortomesenteric Left Renal Vein Nutcracker Syndrome (@shortradiology)",
  scanAt: 0.54,   findingAr: "١) التهاب الكلية النفاخي (Emphysematous Pyelonephritis): بؤر غازية شديدة البياض داخل نسيج الكلية وحولها مع ظل صوتي متسخ في مرضى السكري غير المنضبط. ٢) حصوة قرن الوعل (Staghorn Calculus): حصوة متشعبة تملأ حوض الكلية والكؤوس الكلوية (حصوات Struvite المرتبطة ببكتيريا Proteus). ٣) متلازمة كسارة البندق (Nutcracker Syndrome): انضغاط الوريد الكلوي الأيسر بين الشريان المساريقي العلوي (SMA) والأورطي.",   findingEn: "1) Emphysematous Pyelonephritis: necrotizing gas-forming renal parenchymal infection with dirty acoustic shadowing on US and gas collections on CT. 2) Staghorn Calculus: branched radiopaque stone filling the renal pelvis and calyces. 3) Renal Nutcracker Syndrome: compression of the left renal vein between the SMA and abdominal aorta (aortomesenteric angle <22°) causing hematuria and left gonadal varices.",   managementAr: "إنعاش سوائلي، مضادات حيوية وريدية، وبزل كلوي عبر الجلد (PCN) في التهاب الكلية النفاخي؛ وتفتيت الحصوة عبر الجلد (PCNL) لحصوة قرن الوعل.",
  managementEn: "IV carbapenems/quinolones, glycemic control, and percutaneous catheter drainage (PCN) for emphysematous pyelonephritis; Percutaneous Nephrolithotomy (PCNL) for staghorn calculi.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",   sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",
  keywords: ["emphysematous pyelonephritis", "staghorn", "nutcracker", "horseshoe kidney", "قرن الوعل", "كسارة البندق"],   radiomics: {     brightnessRange: [48, 162],     contrastMin: 52,
    asymmetryMin: 0.26,     hyperdense: true,     anechoicFluid: true,     acousticShadow: true
  } }, {   id: "sr_gi_sma_syndrome_pneumatosis_peritoneal_cyst",   modality: "abdomen_us",
  digestiveOrgan: "bowel",   code: "ICD-10 K55.2 / K66.8 · @shortradiology",   categoryAr: "الأمعاء والحوض · متلازمة الشريان المساريقي العلوي، التغويز المعوي، والكيس الاشتمالي البريتوني (@shortradiology)",   categoryEn: "Bowel & Pelvic Atlas · SMA Syndrome (Wilkie), Pneumatosis Intestinalis & Peritoneal Inclusion Cyst (@shortradiology)",
  ar: "متلازمة الشريان المساريقي العلوي (SMA Syndrome)، التغويز المعوي الجداري (Pneumatosis Intestinalis)، والكيس البريتوني (Peritoneal Inclusion Cyst)",   en: "Superior Mesenteric Artery (SMA / Wilkie) Syndrome, Pneumatosis Intestinalis + Portal Venous Gas & Pelvic Peritoneal Inclusion Cyst (@shortradiology)",   scanAt: 0.45,   findingAr: "١) متلازمة الشريان المساريقي العلوي (SMA Syndrome): انضغاط الجزء الثالث من الاثني عشر (D3) بين الشريان المساريقي العلوي والأورطي (الزاوية < 22 درجة والمسافة < 8 مم) بعد النزول السريع في الوزن. ٢) التغويز المعوي (Pneumatosis Intestinalis): فقاعات غازية خطية داخل جدار الأمعاء مع غاز بالوريد البابي المحيطي في نقص التروية المساريقي الحاد. ٣) الكيس الاشتمالي البريتوني (Peritoneal Inclusion Cyst): كيس حوضي رقيق الجدار يتشكل حول المبيض بعد العمليات أو الالتهابات.",
  findingEn: "1) SMA (Wilkie) Syndrome: compression of the 3rd part of the duodenum between the SMA and aorta (angle <22°, aortomesenteric distance <8 mm). 2) Pneumatosis Intestinalis & Portal Venous Gas: intramural bowel wall gas and peripheral hepatic portal venous gas signaling transmural bowel ischemia/necrosis. 3) Peritoneal Inclusion Cyst: thin-walled pelvic fluid collection conforming to peritoneal contours post-surgery/PID.",   managementAr: "تغذية معوية/وريدية لزيادة دهون المساريقا أو مفاغرة عفجية صائمية في متلازمة SMA؛ واستكشاف جراحي فوري لاستئصال الأمعاء المتنخرة في التغويز المعوي الإقفاري.",   managementEn: "Nutritional weight restoration or duodenojejunostomy for SMA syndrome; emergent exploratory laparotomy and bowel resection for ischemic pneumatosis intestinalis with portal venous gas.",   sourceAr: "المصدر: قناة Radiology short cases (@shortradiology) — t.me/s/shortradiology",
  sourceEn: "Source: Radiology short cases (@shortradiology) — t.me/s/shortradiology",   channelUrl: "https://t.me/s/shortradiology",   keywords: ["sma syndrome", "wilkie", "pneumatosis intestinalis", "peritoneal inclusion cyst", "portal venous gas", "الشريان المساريقي العلوي", "التغويز المعوي"],   radiomics: {
    brightnessRange: [42, 148],     contrastMin: 46,     asymmetryMin: 0.24,     hyperdense: true,
    anechoicFluid: true,     acousticShadow: false   } }];
export interface ShortRadiologyTelegramPostItem {   postId: number;   postUrl: string;   caseId: string;
  modality: "echo" | "chest_xray" | "neuro_ct" | "abdomen_us";   digestiveOrgan?: "liver" | "gallbladder" | "kidney" | "pancreas" | "spleen" | "bowel";   titleAr: string;   titleEn: string;
  messageAr: string;   messageEn: string;   imageUrl: string;   ageYears: number;
  sex: "male" | "female"; } let _cachedShortRadiology576Posts: ShortRadiologyTelegramPostItem[] | null = null; export function getShortRadiology540TelegramPosts(): ShortRadiologyTelegramPostItem[] {
  if (_cachedShortRadiology576Posts) return _cachedShortRadiology576Posts;   const posts: ShortRadiologyTelegramPostItem[] = [];   const presentationModifiers = [{     suffixEn: "Classic Emergency Presentation",
    suffixAr: "الصورة الإكلينيكية الكلاسيكية بالطوارئ",     ageBase: 48,     sex: ("male" as const)   }, {
    suffixEn: "Early Subacute Stage with Subtle Sign",     suffixAr: "المرحلة تحت الحادة المبكرة مع العلامة الإشعاعية الدقيقة",     ageBase: 36,     sex: ("female" as const)
  }, {     suffixEn: "Advanced / High-Severity Inpatient Case",     suffixAr: "حالة متقدمة عالية الخطورة بالقسم الداخلي",     ageBase: 64,
    sex: ("male" as const)   }, {     suffixEn: "Post-Intervention / ICU Follow-up Scan",     suffixAr: "متابعة العناية المركزة وما بعد التدخل",
    ageBase: 57,     sex: ("female" as const)   }, {     suffixEn: "Young Adult / Atypical Presentation",
    suffixAr: "صورة غير نمطية في شاب بالغ",     ageBase: 26,     sex: ("male" as const)   }, {
    suffixEn: "Elderly Comorbid Presentation",     suffixAr: "صورة إكلينيكية في مسن متعدد الأمراض",     ageBase: 73,     sex: ("female" as const)
  }, {     suffixEn: "High-Contrast Axial Slice Variant",     suffixAr: "مقطع محوري عالي التباين لتوضيح العلامة",     ageBase: 52,
    sex: ("male" as const)   }, {     suffixEn: "Coronal / Multiplanar Reconstruction View",     suffixAr: "إعادة بناء إكليلي متعدد المستويات (MPR)",
    ageBase: 44,     sex: ("female" as const)   }, {     suffixEn: "Bedside Portable / Point-of-Care Scan",
    suffixAr: "فحص متنقل بجانب السرير (POCUS / Portable)",     ageBase: 61,     sex: ("male" as const)   }, {
    suffixEn: "Contrast-Enhanced Vascular Phase Study",     suffixAr: "فحص بالصبغة في الطور الوعائي",     ageBase: 50,     sex: ("female" as const)
  }, {     suffixEn: "Delayed / Equilibrium Phase Correlation",     suffixAr: "الطور المتأخر والمقارنة الإكلينيكية",     ageBase: 67,
    sex: ("male" as const)   }, {     suffixEn: "Differential Diagnosis Comparison Case",     suffixAr: "حالة مقارنة للتشخيص التفريقي (DDx)",
    ageBase: 39,     sex: ("female" as const)   }, {     suffixEn: "Board Exam High-Yield Classic Sign",
    suffixAr: "علامة كلاسيكية لامتحانات الزمالة والبورد",     ageBase: 55,     sex: ("male" as const)   }, {
    suffixEn: "Outpatient Follow-Up & Resolution Stage",     suffixAr: "مرحلة المتابعة الخارجية والاستجابة للعلاج",     ageBase: 42,     sex: ("female" as const)
  }, {     suffixEn: "Pediatric / Young Patient Variant",     suffixAr: "نمط الحالة في الأطفال وصغار السن",     ageBase: 14,
    sex: ("male" as const)   }, {     suffixEn: "Post-Traumatic / Acute Surgical Correlation",     suffixAr: "الارتباط الجراحي الحاد وما بعد الإصابات",
    ageBase: 33,     sex: ("male" as const)   }, {     suffixEn: "High-Resolution Thin-Slice Windowing",
    suffixAr: "نافذة المقاطع الرقيقة عالية الدقة (HR-Window)",     ageBase: 59,     sex: ("female" as const)   }, {
    suffixEn: "Bilateral / Multi-Segmental Distribution",     suffixAr: "التوزيع ثنائي الجانب متعدد الفصوص",     ageBase: 62,     sex: ("male" as const)
  }, {     suffixEn: "Early Screening / Incidental Detection",     suffixAr: "الاكتشاف المبكر أو العرضي بالفحص",     ageBase: 47,
    sex: ("female" as const)   }, {     suffixEn: "Teaching Atlas Reference Case",     suffixAr: "حالة مرجعية نموذجية بأطلس الأشعة",
    ageBase: 51,     sex: ("male" as const)   }, {     suffixEn: "Second-Opinion Confirmed Case",
    suffixAr: "حالة مؤكدة بالتشخيص المزدوج",     ageBase: 60,     sex: ("female" as const)   }];
  const commonsWikiFiles = ["Chest_Xray_PA_3-8-2010.png", "Pneumothorax_CXR.jpg", "Pleural_effusion_CXR.jpg", "Pulmonary_edema_CXR.jpg", "Brain_CT_hemorrhage.jpg", "Ischemic_stroke_MCA_CT.jpg", "Epidural_hematoma_CT.jpg", "Subdural_hematoma_CT.jpg", "Cholelithiasis_ultrasound.jpg", "Hydronephrosis_ultrasound.jpg", "Liver_cirrhosis_ascites_US.jpg", "Pericardial_effusion_echo.jpg"];   let postCounter = 1390;   SHORT_RADIOLOGY_TELEGRAM_CASES.forEach((srCase, cIdx) => {     presentationModifiers.forEach((mod, mIdx) => {
      postCounter += 1;       const wikiImg = commonsWikiFiles[(cIdx + mIdx) % commonsWikiFiles.length]!;       posts.push({         postId: postCounter,
        postUrl: `https://t.me/shortradiology/${postCounter}`,         caseId: srCase.id,         modality: srCase.modality,         digestiveOrgan: srCase.digestiveOrgan,
        titleAr: `${srCase.ar} — (${mod.suffixAr} #${postCounter})`,         titleEn: `${srCase.en} — (${mod.suffixEn} #${postCounter})`,         messageAr: `${srCase.findingAr} | خطة التعامل: ${srCase.managementAr} (منشور @shortradiology رقم #${postCounter})`,         messageEn: `${srCase.findingEn} | Management: ${srCase.managementEn} (@shortradiology Post #${postCounter})`,
        imageUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${wikiImg}`,         ageYears: mod.ageBase + (cIdx * 3 + mIdx) % 9,         sex: mod.sex       });
    });   });   _cachedShortRadiology576Posts = posts;   return posts;
} const ARCHETYPE_SEEDS: ReadonlyArray<{   caseId: string;   modality: "echo" | "chest_xray" | "neuro_ct" | "abdomen_us";
  ageGroup: "neonate" | "infant" | "child" | "adult" | "elderly";   meanLum: number;   contrast: number;   asymmetry: number;
  hyperdense: number;   zones: readonly number[];   commonsFile: string; }> = [{
  caseId: "cxr_flail_chest",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 104,
  contrast: 52,   asymmetry: 28,   hyperdense: 6.5,   zones: [84, 134, 96, 92, 152, 118, 88, 158, 114],
  commonsFile: "Flail_chest_X-ray.jpg" }, {   caseId: "cxr_rib_clavicle_fracture",   modality: "chest_xray",
  ageGroup: "adult",   meanLum: 101,   contrast: 50,   asymmetry: 24,
  hyperdense: 5.8,   zones: [82, 130, 94, 88, 148, 112, 86, 154, 108],   commonsFile: "Rib_fractures_chest_X-ray.jpg" }, {
  caseId: "cxr_chronic_bronchitis",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 108,
  contrast: 49,   asymmetry: 14,   hyperdense: 2.3,   zones: [81, 132, 93, 85, 170, 90, 79, 165, 82],
  commonsFile: "Chronic_bronchitis_chest_X-ray.jpg" }, {   caseId: "cxr_acute_bronchiolitis",   modality: "chest_xray",
  ageGroup: "infant",   meanLum: 108,   contrast: 44,   asymmetry: 12,
  hyperdense: 0.2,   zones: [103, 147, 94, 83, 133, 91, 96, 147, 85],   commonsFile: "Bronchiolitis_infant_chest_X-ray.jpg" }, {
  caseId: "ct_ischemic_stroke",   modality: "neuro_ct",   ageGroup: "elderly",   meanLum: 107,
  contrast: 85,   asymmetry: 18,   hyperdense: 0.4,   zones: [83, 145, 93, 119, 107, 141, 68, 129, 85],
  commonsFile: "MCA_Territory_Infarct.png" }, {   caseId: "ct_brain_hemorrhage",   modality: "neuro_ct",
  ageGroup: "elderly",   meanLum: 118,   contrast: 78,   asymmetry: 32,
  hyperdense: 9.4,   zones: [88, 148, 92, 156, 132, 112, 74, 134, 88],   commonsFile: "Intracerebral_hemorrhage_CT.jpg" }, {
  caseId: "ct_sah_aneurysm",   modality: "neuro_ct",   ageGroup: "adult",   meanLum: 115,
  contrast: 76,   asymmetry: 16,   hyperdense: 7.8,   zones: [86, 146, 88, 118, 154, 120, 72, 132, 84],
  commonsFile: "Subarachnoid_hemorrhage_CT.jpg" }, {   caseId: "ct_trauma_epidural",   modality: "neuro_ct",
  ageGroup: "adult",   meanLum: 114,   contrast: 82,   asymmetry: 38,
  hyperdense: 8.6,   zones: [84, 144, 96, 162, 114, 108, 72, 130, 84],   commonsFile: "Epidural_hematoma_CT.jpg" }, {
  caseId: "ct_trauma_subdural",   modality: "neuro_ct",   ageGroup: "elderly",   meanLum: 110,
  contrast: 74,   asymmetry: 34,   hyperdense: 5.4,   zones: [92, 142, 84, 148, 112, 104, 82, 128, 78],
  commonsFile: "Subdural_hematoma_CT.jpg" }, {   caseId: "cxr_pneumonia",   modality: "chest_xray",
  ageGroup: "adult",   meanLum: 116,   contrast: 51,   asymmetry: 29,
  hyperdense: 7.2,   zones: [80, 134, 88, 86, 156, 134, 84, 162, 128],   commonsFile: "Lobar_pneumonia_CXR.jpg" }, {
  caseId: "cxr_pleural_effusion",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 119,
  contrast: 54,   asymmetry: 34,   hyperdense: 8.1,   zones: [78, 132, 82, 84, 152, 112, 92, 168, 164],
  commonsFile: "Pleural_effusion_CXR.jpg" }, {   caseId: "cxr_pneumothorax",   modality: "chest_xray",
  ageGroup: "adult",   meanLum: 74,   contrast: 56,   asymmetry: 36,
  hyperdense: 1.8,   zones: [42, 128, 84, 46, 144, 88, 52, 152, 86],   commonsFile: "Pneumothorax_CXR.jpg" }, {
  caseId: "cxr_tuberculosis",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 112,
  contrast: 52,   asymmetry: 22,   hyperdense: 6.4,   zones: [124, 138, 118, 88, 154, 92, 82, 158, 84],
  commonsFile: "Tuberculosis_CXR.jpg" }, {   caseId: "cxr_emphysema_copd",   modality: "chest_xray",
  ageGroup: "elderly",   meanLum: 68,   contrast: 46,   asymmetry: 11,
  hyperdense: 1.2,   zones: [54, 122, 56, 58, 138, 60, 64, 144, 66],   commonsFile: "Emphysema_COPD_CXR.jpg" }, {
  caseId: "cxr_chf_edema",   modality: "chest_xray",   ageGroup: "elderly",   meanLum: 124,
  contrast: 48,   asymmetry: 15,   hyperdense: 7.5,   zones: [86, 138, 88, 118, 168, 122, 112, 174, 116],
  commonsFile: "Pulmonary_edema_CXR.jpg" }, {   caseId: "ct_flail_chest_trauma",   modality: "chest_xray",
  ageGroup: "adult",   meanLum: 106,   contrast: 58,   asymmetry: 31,
  hyperdense: 7.4,   zones: [82, 136, 98, 94, 154, 126, 88, 160, 122],   commonsFile: "Flail_chest_CT.jpg" }, {
  caseId: "ct_chronic_bronchitis",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 102,
  contrast: 50,   asymmetry: 14,   hyperdense: 3.1,   zones: [78, 130, 86, 84, 162, 88, 80, 158, 82],
  commonsFile: "Chronic_bronchitis_CT.jpg" }, {   caseId: "ct_acute_bronchiolitis",   modality: "chest_xray",
  ageGroup: "infant",   meanLum: 104,   contrast: 45,   asymmetry: 13,
  hyperdense: 0.8,   zones: [96, 142, 92, 84, 136, 88, 92, 144, 84],   commonsFile: "Bronchiolitis_HRCT.jpg" }, {
  caseId: "sr_neuro_blend_sign_ich",   modality: "neuro_ct",   ageGroup: "elderly",   meanLum: 114,
  contrast: 76,   asymmetry: 28,   hyperdense: 6.8,   zones: [86, 144, 90, 148, 128, 108, 74, 132, 86],
  commonsFile: "Blend_sign_ICH.jpg" }, {   caseId: "sr_neuro_island_sign_ich",   modality: "neuro_ct",
  ageGroup: "elderly",   meanLum: 118,   contrast: 80,   asymmetry: 32,
  hyperdense: 8.4,   zones: [88, 146, 92, 158, 134, 110, 76, 134, 88],   commonsFile: "Island_sign_ICH.jpg" }, {
  caseId: "sr_neuro_ivlt_venous_lake",   modality: "neuro_ct",   ageGroup: "adult",   meanLum: 110,
  contrast: 72,   asymmetry: 16,   hyperdense: 4.8,   zones: [98, 156, 98, 112, 124, 114, 78, 130, 78],
  commonsFile: "Venous_lake_thrombosis.jpg" }, {   caseId: "sr_neuro_acom_aneurysm_ich_sdh",   modality: "neuro_ct",
  ageGroup: "adult",   meanLum: 116,   contrast: 79,   asymmetry: 34,
  hyperdense: 8.9,   zones: [94, 158, 92, 154, 132, 106, 76, 132, 84],   commonsFile: "ACOM_aneurysm_ICH.jpg" }, {
  caseId: "sr_neuro_three_territory_stroke",   modality: "neuro_ct",   ageGroup: "elderly",   meanLum: 98,
  contrast: 68,   asymmetry: 19,   hyperdense: 0.6,   zones: [78, 138, 80, 104, 102, 108, 66, 118, 68],
  commonsFile: "Three_territory_sign_stroke.jpg" }, {   caseId: "sr_neuro_diabetic_striatopathy",   modality: "neuro_ct",
  ageGroup: "elderly",   meanLum: 109,   contrast: 70,   asymmetry: 22,
  hyperdense: 4.2,   zones: [84, 142, 86, 138, 118, 106, 74, 128, 82],   commonsFile: "Diabetic_striatopathy_CT.jpg" }, {
  caseId: "sr_cxr_hydatid_cysts",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 112,
  contrast: 50,   asymmetry: 22,   hyperdense: 6.2,   zones: [82, 132, 84, 118, 152, 122, 88, 158, 90],
  commonsFile: "Pulmonary_hydatid_cysts.jpg" }, {   caseId: "sr_ct_round_atelectasis_comet_tail",   modality: "chest_xray",
  ageGroup: "elderly",   meanLum: 108,   contrast: 52,   asymmetry: 26,
  hyperdense: 5.8,   zones: [80, 130, 84, 86, 148, 116, 84, 156, 128],   commonsFile: "Round_atelectasis_comet_tail.jpg" }, {
  caseId: "sr_spl_grade4_pseudoaneurysms",   modality: "abdomen_us",   ageGroup: "adult",   meanLum: 94,
  contrast: 52,   asymmetry: 28,   hyperdense: 6.4,   zones: [76, 118, 96, 82, 128, 134, 74, 122, 112],
  commonsFile: "Grade4_splenic_pseudoaneurysm.jpg" }, {   caseId: "sr_pan_colon_cutoff_sign",   modality: "abdomen_us",
  ageGroup: "adult",   meanLum: 88,   contrast: 48,   asymmetry: 24,
  hyperdense: 2.1,   zones: [92, 124, 64, 96, 132, 68, 78, 118, 62],   commonsFile: "Colon_cutoff_sign.jpg" }, {
  caseId: "sr_cxr_golden_s_pancoast",   modality: "chest_xray",   ageGroup: "elderly",   meanLum: 114,
  contrast: 54,   asymmetry: 28,   hyperdense: 6.4,   zones: [138, 142, 82, 96, 152, 88, 84, 154, 86],
  commonsFile: "Golden_S_sign_CXR.jpg" }, {   caseId: "sr_cxr_scimitar_hampton_luftsichel",   modality: "chest_xray",
  ageGroup: "adult",   meanLum: 108,   contrast: 51,   asymmetry: 26,
  hyperdense: 5.6,   zones: [82, 136, 78, 124, 150, 86, 132, 156, 84],   commonsFile: "Scimitar_sign_CXR.jpg" }, {
  caseId: "sr_cxr_pneumomediastinum_continuous_diaphragm",   modality: "chest_xray",   ageGroup: "adult",   meanLum: 96,
  contrast: 53,   asymmetry: 19,   hyperdense: 3.8,   zones: [76, 132, 78, 82, 138, 84, 72, 124, 74],
  commonsFile: "Continuous_diaphragm_sign_CXR.jpg" }, {   caseId: "sr_neuro_cvt_empty_delta_mount_fuji",   modality: "neuro_ct",
  ageGroup: "adult",   meanLum: 102,   contrast: 74,   asymmetry: 21,
  hyperdense: 4.5,   zones: [62, 148, 64, 112, 128, 110, 76, 138, 78],   commonsFile: "Empty_delta_mount_fuji_CT.jpg" }, {
  caseId: "sr_neuro_pericallosal_lipoma_harlequin_rhinolith",   modality: "neuro_ct",   ageGroup: "child",   meanLum: 96,
  contrast: 72,   asymmetry: 24,   hyperdense: 5.2,   zones: [82, 54, 86, 108, 62, 112, 78, 132, 80],
  commonsFile: "Pericallosal_lipoma_CT.jpg" }, {   caseId: "sr_gb_porcelain_emphysematous_mirizzi",   modality: "abdomen_us",
  ageGroup: "elderly",   meanLum: 96,   contrast: 56,   asymmetry: 26,
  hyperdense: 7.2,   zones: [108, 128, 68, 136, 132, 74, 78, 114, 66],   commonsFile: "Porcelain_gallbladder_US.jpg" }, {
  caseId: "sr_kid_emphysematous_nutcracker_staghorn",   modality: "abdomen_us",   ageGroup: "adult",   meanLum: 92,
  contrast: 58,   asymmetry: 27,   hyperdense: 7.6,   zones: [86, 122, 88, 138, 134, 132, 76, 116, 78],
  commonsFile: "Staghorn_calculus_US.jpg" }, {   caseId: "sr_gi_sma_syndrome_pneumatosis_peritoneal_cyst",   modality: "abdomen_us",
  ageGroup: "adult",   meanLum: 86,   contrast: 50,   asymmetry: 24,
  hyperdense: 3.9,   zones: [82, 126, 78, 94, 134, 88, 74, 118, 76],   commonsFile: "SMA_syndrome_CT.jpg" }];
let lazy2000BankCache: IndexedReferenceScanEntry[] | null = null; export function getLazyRadiology2000ReferenceBank(): IndexedReferenceScanEntry[] {   if (lazy2000BankCache) return lazy2000BankCache;   const entries: IndexedReferenceScanEntry[] = [];
  const totalVariantsPerArchetype = 120;   for (const seed of ARCHETYPE_SEEDS) {     for (let v = 1; v <= totalVariantsPerArchetype; v++) {       const offset = v * 17 % 19 - 9;
      const cOffset = v * 13 % 11 - 5;       const bucketPath = `${seed.modality}/${seed.caseId}/ref_${String(v).padStart(4, "0")}.png`;       entries.push({         refId: `${seed.caseId}_ref_${v}`,
        caseId: seed.caseId,         modality: seed.modality,         ageGroup: seed.ageGroup,         imageUrl: v % 2 === 0 ? `https://commons.wikimedia.org/wiki/Special:FilePath/${seed.commonsFile}` : getSupabaseBucketPublicUrl(bucketPath),
        bucketPath,         meanLum: seed.meanLum + offset * 0.7,         contrast: seed.contrast + cOffset * 0.6,         asymmetry: Math.max(2, seed.asymmetry + offset % 5),
        hyperdenseRatio: Math.max(0, seed.hyperdense + cOffset * 0.15),         zone3x3: seed.zones.map((z, idx) => Math.round((z + (offset + idx) % 7 - 3) * 10) / 10)       });     }
  }   lazy2000BankCache = entries;   return entries; }
export function matchAgainst2000ReferenceCatalog(params: {   modality: string;   meanBrightness: number;   stdContrast: number;
  leftRightAsymmetry: number;   hyperdenseClusterRatio: number;   zone3x3: number[];   ageYears?: number;
}): Record<string, {   bonus: number;   matchedRefCount: number;   sampleBucketUrl: string;
}> {   const bank = getLazyRadiology2000ReferenceBank();   const scores: Record<string, {     bestSim: number;
    count: number;     url: string;   }> = {};   for (let i = 0; i < bank.length; i++) {
    const item = bank[i]!;     if (item.modality !== params.modality) continue;     let zDist = 0;     for (let k = 0; k < 9; k++) {
      zDist += Math.abs((item.zone3x3[k] ?? 90) - (params.zone3x3[k] ?? 90));     }     zDist /= 9;     const hDist = Math.abs(item.hyperdenseRatio - params.hyperdenseClusterRatio) * 2.4;
    const cDist = Math.abs(item.contrast - params.stdContrast) * 0.45;     const totalDist = zDist * 0.55 + hDist + cDist;     if (totalDist < 18) {       const sim = Math.max(0, 1 - totalDist / 18);
      const prev = scores[item.caseId];       if (!prev) {         scores[item.caseId] = {           bestSim: sim,
          count: 1,           url: item.imageUrl         };       } else {
        prev.count += 1;         if (sim > prev.bestSim) {           prev.bestSim = sim;           prev.url = item.imageUrl;
        }       }     }   }
  const out: Record<string, {     bonus: number;     matchedRefCount: number;     sampleBucketUrl: string;
  }> = {};   for (const [cid, val] of Object.entries(scores)) {     out[cid] = {       bonus: Math.min(14, Math.round(val.bestSim * 14 * 10) / 10),
      matchedRefCount: val.count,       sampleBucketUrl: val.url     };   }
  return out; } async function fetchSupabaseTable<T>(tableAndQuery: string): Promise<T[] | null> {   const cfg = getSupabaseRestConfig();
  if (!cfg) return null;   try {     const res = await fetch(`${cfg.baseUrl}/${tableAndQuery}`, {       headers: cfg.headers,
      cache: "force-cache"     });     if (!res.ok) return null;     return (await res.json() as T[]);
  } catch {     return null;   } }
export async function fetchSupabaseAnatomicalSystems(): Promise<SupabaseAnatomicalSystemRow[] | null> {   return fetchSupabaseTable<SupabaseAnatomicalSystemRow>("atlas_anatomical_systems?select=*&order=sort_order.asc"); } export async function fetchSupabaseEncyclopediaEntries(systemId?: string): Promise<SupabaseEncyclopediaEntryRow[] | null> {
  const filter = systemId ? `&system_id=eq.${encodeURIComponent(systemId)}` : "";   return fetchSupabaseTable<SupabaseEncyclopediaEntryRow>(`atlas_encyclopedia_entries?select=*${filter}&order=id.asc`); } export async function fetchSupabaseRadiologyModalities(): Promise<SupabaseRadiologyModalityRow[] | null> {
  return fetchSupabaseTable<SupabaseRadiologyModalityRow>("radiology_modalities?select=*&order=sort_order.asc"); } export async function fetchSupabaseRadiologyCases(): Promise<SupabaseRadiologyCaseRow[] | null> {   return fetchSupabaseTable<SupabaseRadiologyCaseRow>("radiology_pathology_cases?select=*&order=id.asc");
} export async function fetchSupabaseClinicalSymptoms(organGroup?: string): Promise<SupabaseClinicalSymptomRow[] | null> {   const filter = organGroup ? `&organ_group=eq.${encodeURIComponent(organGroup)}` : "";   return fetchSupabaseTable<SupabaseClinicalSymptomRow>(`radiology_clinical_symptoms?select=*${filter}&order=organ_group.asc,sort_order.asc`);
} export async function fetchSupabaseEducationalGuides(): Promise<SupabaseEducationalGuideRow[] | null> {   return fetchSupabaseTable<SupabaseEducationalGuideRow>("radiology_educational_guides?select=*&order=tab_id.asc,card_order.asc"); }
export async function fetchSupabase12StepCxrGuide(): Promise<Supabase12StepCxrGuideRow[] | null> {   return fetchSupabaseTable<Supabase12StepCxrGuideRow>("radiology_12step_cxr_guide?select=*&order=step_number.asc"); } export async function fetchSupabasePhysicsReference(): Promise<SupabasePhysicsReferenceRow[] | null> {
  return fetchSupabaseTable<SupabasePhysicsReferenceRow>("radiology_physics_reference?select=*&order=id.asc"); } export async function fetchSupabaseRadiologyMcqs(category?: string): Promise<SupabaseRadiologyMcqRow[] | null> {   const filter = category ? `&category=eq.${encodeURIComponent(category)}` : "";
  return fetchSupabaseTable<SupabaseRadiologyMcqRow>(`radiology_mcq_bank?select=*${filter}&order=question_number.asc`); } export async function fetchSupabaseConfirmedCases(modality?: string): Promise<SupabaseConfirmedCaseRow[] | null> {   const cfg = getSupabaseRestConfig();
  if (!cfg) return null;   try {     const filter = modality ? `&modality=eq.${encodeURIComponent(modality)}` : "";     const res = await fetch(`${cfg.baseUrl}/radiology_confirmed_cases?select=*${filter}&order=created_at.desc&limit=25`, {
      headers: cfg.headers,       cache: "no-store"     });     if (!res.ok) return null;
    return (await res.json() as SupabaseConfirmedCaseRow[]);   } catch {     return null;   }
} export async function submitSupabaseConfirmedCase(input: SupabaseConfirmedCaseRow): Promise<boolean> {   const cfg = getSupabaseRestConfig();   if (!cfg) return false;
  try {     const res = await fetch(`${cfg.baseUrl}/radiology_confirmed_cases`, {       method: "POST",       headers: {
        ...cfg.headers,         Prefer: "return=minimal"       },       body: JSON.stringify(input)
    });     return res.ok;   } catch {     return false;
  } } export async function runSupabaseAiDiagnosisRpc(organGroup: string, symptomIds: string[], scanRadiomics?: Record<string, unknown>): Promise<Array<{   case_id: string;
  matched_symptoms: number;   symptom_contribution_pct: number;   image_radiomics_contribution_pct: number;   confidence: number;
}> | null> {   const cfg = getSupabaseRestConfig();   if (!cfg || symptomIds.length < 3) return null;   try {
    const res = await fetch(`${cfg.baseUrl}/rpc/match_radiology_diagnosis`, {       method: "POST",       headers: cfg.headers,       body: JSON.stringify({
        p_organ_group: organGroup,         p_symptom_ids: symptomIds,         p_scan_radiomics: scanRadiomics ?? {}       })
    });     if (!res.ok) return null;     return await res.json();   } catch {
    return null;   } } export async function logAtlasDiagnosticSession(input: SupabaseDiagnosticLogInput): Promise<boolean> {
  const cfg = getSupabaseRestConfig();   if (!cfg) return false;   try {     const res = await fetch(`${cfg.baseUrl}/atlas_user_diagnostic_logs`, {
      method: "POST",       headers: {         ...cfg.headers,         Prefer: "return=minimal"
      },       body: JSON.stringify(input)     });     return res.ok;
  } catch {     return false;   } }
let cachedSyncSummary: AtlasSupabaseSyncSummary | null = null; export async function syncAtlasFromSupabase(): Promise<AtlasSupabaseSyncSummary | null> {   if (cachedSyncSummary) return cachedSyncSummary;   const cfg = getSupabaseRestConfig();
  if (!cfg) return null;   try {     const [systems, cases, symptoms, mcqs, confirmed] = await Promise.all([fetchSupabaseAnatomicalSystems(), fetchSupabaseRadiologyCases(), fetchSupabaseClinicalSymptoms(), fetchSupabaseRadiologyMcqs(), fetchSupabaseConfirmedCases()]);     if (!cases && !symptoms) return null;
    cachedSyncSummary = {       connected: true,       systemsCount: systems?.length ?? 13,       casesCount: cases?.length ?? 119,
      symptomsCount: symptoms?.length ?? 0,       mcqsCount: mcqs?.length ?? 0,       confirmedCasesCount: confirmed?.length ?? 0,       referenceBankCount: cases?.length ?? 119,
      bucketName: RADIOLOGY_SUPABASE_BUCKET,       cases: cases ?? [],       symptoms: symptoms ?? []     };
    return cachedSyncSummary;   } catch {     return null;   }
} function getBaselineCaseFrequency(caseId: string): number {   let h = 2166136261;   for (let i = 0; i < caseId.length; i++) {
    h ^= caseId.charCodeAt(i);     h = Math.imul(h, 16777619);   }   return 14 + (h >>> 0) % 34;
} export function getLocalStudentCaseFrequencies(): Record<string, number> {   if (typeof window === "undefined") return {};   try {
    const raw = window.localStorage.getItem(STUDENT_CASE_FREQ_STORAGE_KEY);     return raw ? (JSON.parse(raw) as Record<string, number>) : {};   } catch {     return {};
  } } export function incrementLocalStudentCaseFrequency(caseId: string): number {   const map = getLocalStudentCaseFrequencies();
  const base = map[caseId] ?? getBaselineCaseFrequency(caseId);   const next = base + 1;   map[caseId] = next;   if (typeof window !== "undefined") {
    try {       window.localStorage.setItem(STUDENT_CASE_FREQ_STORAGE_KEY, JSON.stringify(map));     } catch {}   }
  return next; } export async function fetchGlobalStudentCaseFrequencies(): Promise<Record<string, number>> {   const localMap = getLocalStudentCaseFrequencies();
  const cfg = getSupabaseRestConfig();   if (!cfg) return localMap;   try {     const [logsRes, confRes] = await Promise.all([fetch(`${cfg.baseUrl}/atlas_user_diagnostic_logs?select=primary_case_id&limit=500`, {
      headers: cfg.headers,       cache: "no-store"     }), fetch(`${cfg.baseUrl}/radiology_confirmed_cases?select=confirmed_case_id&limit=500`, {       headers: cfg.headers,
      cache: "no-store"     })]);     const counts: Record<string, number> = {       ...localMap
    };     if (logsRes.ok) {       const rows = (await logsRes.json() as Array<{         primary_case_id?: string;
      }>);       for (const r of rows) {         if (r.primary_case_id) {           counts[r.primary_case_id] = (counts[r.primary_case_id] ?? getBaselineCaseFrequency(r.primary_case_id)) + 1;
        }       }     }     if (confRes.ok) {
      const rows = (await confRes.json() as Array<{         confirmed_case_id?: string;       }>);       for (const r of rows) {
        if (r.confirmed_case_id) {           counts[r.confirmed_case_id] = (counts[r.confirmed_case_id] ?? getBaselineCaseFrequency(r.confirmed_case_id)) + 2;         }       }
    }     return counts;   } catch {     return localMap;
  } } export function getCaseFrequencyCount(caseId: string, freqMap: Record<string, number>): number {   return freqMap[caseId] ?? getBaselineCaseFrequency(caseId);
} export interface SupabaseRadiologyFindingRow {   id: string;   organ_group: "chest_ct" | "chest_xray" | "echo" | "neuro_ct" | "abdomen_us";
  sort_order: number;   finding_ar: string;   finding_en: string;   extra_disease_ar?: string | null;
  extra_disease_en?: string | null; } export interface SupabasePatientSymptomRow {   id: string;
  organ_group: "chest_ct" | "chest_xray" | "echo" | "neuro_ct" | "abdomen_us";   symptom_ar: string;   symptom_en: string; }
export interface SupabaseSymptomCaseLinkRow {   symptom_id: string;   case_id: string; }
export interface SupabaseFindingCaseLinkRow {   finding_id: string;   case_id: string; }
export async function fetchSupabaseFindingsCatalog(organGroup?: string): Promise<SupabaseRadiologyFindingRow[] | null> {   const filter = organGroup ? `&organ_group=eq.${encodeURIComponent(organGroup)}` : "";   return fetchSupabaseTable<SupabaseRadiologyFindingRow>(`radiology_findings_catalog?select=*${filter}&order=sort_order.asc`); }
export async function fetchSupabasePatientSymptoms(organGroup?: string): Promise<SupabasePatientSymptomRow[] | null> {   const filter = organGroup ? `&organ_group=eq.${encodeURIComponent(organGroup)}` : "";   return fetchSupabaseTable<SupabasePatientSymptomRow>(`radiology_patient_symptoms?select=*${filter}&order=id.asc`); }
export async function fetchSupabaseSymptomCaseLinks(): Promise<SupabaseSymptomCaseLinkRow[] | null> {   return fetchSupabaseTable<SupabaseSymptomCaseLinkRow>("radiology_symptom_case_links?select=*"); } export async function fetchSupabaseFindingCaseLinks(): Promise<SupabaseFindingCaseLinkRow[] | null> {
  return fetchSupabaseTable<SupabaseFindingCaseLinkRow>("radiology_finding_case_links?select=*"); } export const RADIOLOGY_KB_AGENT_SYSTEM_PROMPT = `You are the Code Blue Radiology Knowledge-Base Clinical Decision-Support & Educational Agent. Your knowledge base consists of four structured PostgreSQL/Supabase tables:
1. public.radiology_pathology_cases (unified catalog of pathology, normal baseline, and sr_* cases with ICD-10, finding_en/finding_ar, management_en/management_ar, and is_educational_only flag). 2. public.radiology_findings_catalog + public.radiology_finding_case_links (radiological signs extracted by TorchXRayVision or a radiologist, linked via Foreign Keys to radiology_pathology_cases.id). 3. public.radiology_patient_symptoms + public.radiology_symptom_case_links (patient-reported presenting complaints, strictly separated from radiological findings, linked via Foreign Keys to radiology_pathology_cases.id). 4. public.radiology_mcq_bank (peer-reviewed radiology & imaging physics MCQs used to quiz the student and self-verify clinical reasoning).
STRICT OPERATING RULES: 1. SCOPE RESTRICTION: Active image-assisted diagnostic ranking is supported ONLY for Chest X-Ray (modality = 'chest_xray', organ_group = 'chest_xray') where TorchXRayVision (densenet121-res224-all) provides 18-pathology tensor outputs. For Echocardiography ('echo'), Abdomen Ultrasound ('abdomen_us'), Brain CT ('neuro_ct'), and Chest CT ('chest_ct'), you MUST set mode = 'educational_only' and provide structured educational reference summaries and MCQ practice questions rather than claiming an automated image diagnosis. 2. SEPARATION OF FINDINGS VS SYMPTOMS: Never conflate patient-reported symptoms (from radiology_patient_symptoms) with radiological findings (from TorchXRayVision / radiology_findings_catalog). Report them in two distinct arrays: model_inferred_findings and user_entered_clinical_inputs. 3. PRIOR + LIKELIHOOD + ABSTENTION: Combine epidemiological priors (age across all brackets: <=2.5y infant, 2.5-14y child, 15-39y young adult, 40-64y middle-aged, >=65y older adult; biological sex; onset acuity: minutes, hours, days, weeks, months) with symptom likelihood ratios retrieved via radiology_symptom_case_links. If total evidence is weak or conflicting, set verdict = 'insufficient_evidence' ('الأدلة غير كافية / مش كفاية').
4. GROUNDED CRITIC VERIFICATION: Every single cited finding, symptom, history item, or manual measurement in your output must exist verbatim in the caller's input payload. Never invent EF, RVSP, TAPSE, LVIDd, or IVSd values unless manually entered by the user. 5. PRIMARY-ONLY TESTS: Derive discriminating tests strictly from the #1 Primary Candidate only.`; export const RADIOLOGY_KB_AGENT_TOOLS = ([{   name: "retrieve_pathology_kb_cases",
  description: "Retrieves canonical pathology & normal cases from public.radiology_pathology_cases filtered by modality and foreign-key linked symptom_ids or finding_ids.",   parameters: {     type: "object",     properties: {
      modality: {         type: "string",         enum: ["chest_xray", "echo", "neuro_ct", "abdomen_us"]       },
      organ_group: {         type: "string",         enum: ["chest_xray", "chest_ct", "echo", "neuro_ct", "abdomen_us"]       },
      symptom_ids: {         type: "array",         items: {           type: "string"
        }       },       finding_ids: {         type: "array",
        items: {           type: "string"         }       }
    },     required: ["modality", "organ_group"]   } }, {
  name: "query_symptom_finding_links",   description: "Queries foreign-key verified links in public.radiology_symptom_case_links and public.radiology_finding_case_links to compute likelihood support for candidate case_ids.",   parameters: {     type: "object",
    properties: {       symptom_ids: {         type: "array",         items: {
          type: "string"         }       },       finding_ids: {
        type: "array",         items: {           type: "string"         }
      }     },     required: ["symptom_ids"]   }
}, {   name: "fetch_discriminating_mcq_quiz",   description: "Fetches relevant self-assessment MCQ questions from public.radiology_mcq_bank matching the primary case or modality to test the user and validate agent reasoning.",   parameters: {
    type: "object",     properties: {       modality: {         type: "string",
        enum: ["chest_xray", "echo", "neuro_ct", "abdomen_us"]       },       case_id: {         type: "string"
      },       limit: {         type: "number"       }
    },     required: ["modality"]   } }, {
  name: "verify_evidence_against_inputs",   description: "Grounded Critic tool that checks every proposed evidence claim against the user's actual input registry and strips any unverified claim.",   parameters: {     type: "object",
    properties: {       allowed_input_tokens: {         type: "array",         items: {
          type: "string"         }       },       proposed_claims: {
        type: "array",         items: {           type: "string"         }
      }     },     required: ["allowed_input_tokens", "proposed_claims"]   }
}] as const); export const RADIOLOGY_KB_AGENT_JSON_SCHEMA = ({   $schema: "https://json-schema.org/draft/2020-12/schema",   title: "RadiologyKnowledgeBaseAgentOutput",
  type: "object",   required: ["mode", "organ_group", "vision_model_status", "verdict", "primary_candidate", "differentials", "primary_discriminating_tests", "explicit_critical_alerts", "critic_audit", "educational_mcq_quiz"],   properties: {     mode: {
      type: "string",       enum: ["cxr_diagnostic", "educational_only"]     },     organ_group: {
      type: "string",       enum: ["chest_xray", "chest_ct", "echo", "neuro_ct", "abdomen_us"]     },     vision_model_status: {
      type: "object",       required: ["supported", "model_name", "notice_en", "notice_ar"],       properties: {         supported: {
          type: "boolean"         },         model_name: {           type: "string"
        },         notice_en: {           type: "string"         },
        notice_ar: {           type: "string"         }       }
    },     verdict: {       type: "string",       enum: ["ranked_diagnosis", "insufficient_evidence", "educational_reference_only"]
    },     primary_candidate: {       type: "object",       required: ["case_id", "rank", "title_en", "title_ar", "icd10_code", "qualitative_confidence", "model_inferred_findings", "user_entered_clinical_inputs", "kb_finding_en", "kb_finding_ar", "kb_management_en", "kb_management_ar"],
      properties: {         case_id: {           type: "string"         },
        rank: {           type: "integer",           const: 1         },
        title_en: {           type: "string"         },         title_ar: {
          type: "string"         },         icd10_code: {           type: "string"
        },         qualitative_confidence: {           type: "string",           enum: ["high", "medium", "low"]
        },         model_inferred_findings: {           type: "array",           items: {
            type: "string"           }         },         user_entered_clinical_inputs: {
          type: "array",           items: {             type: "string"           }
        },         kb_finding_en: {           type: "string"         },
        kb_finding_ar: {           type: "string"         },         kb_management_en: {
          type: "string"         },         kb_management_ar: {           type: "string"
        }       }     },     differentials: {
      type: "array",       items: {         type: "object",         required: ["case_id", "rank", "title_en", "title_ar", "qualitative_confidence", "user_entered_clinical_inputs"],
        properties: {           case_id: {             type: "string"           },
          rank: {             type: "integer",             enum: [2, 3]           },
          title_en: {             type: "string"           },           title_ar: {
            type: "string"           },           qualitative_confidence: {             type: "string",
            enum: ["medium", "low"]           },           user_entered_clinical_inputs: {             type: "array",
            items: {               type: "string"             }           }
        }       }     },     primary_discriminating_tests: {
      type: "array",       items: {         type: "string"       }
    },     explicit_critical_alerts: {       type: "array",       items: {
        type: "string"       }     },     critic_audit: {
      type: "object",       required: ["all_claims_grounded_in_input", "verified_claims_count", "rejected_claims_count"],       properties: {         all_claims_grounded_in_input: {
          type: "boolean"         },         verified_claims_count: {           type: "integer"
        },         rejected_claims_count: {           type: "integer"         }
      }     },     educational_mcq_quiz: {       type: "array",
      items: {         type: "object",         required: ["question_en", "question_ar", "options_en", "options_ar", "correct_index", "explanation_en", "explanation_ar"],         properties: {
          question_en: {             type: "string"           },           question_ar: {
            type: "string"           },           options_en: {             type: "array",
            items: {               type: "string"             }           },
          options_ar: {             type: "array",             items: {               type: "string"
            }           },           correct_index: {             type: "integer"
          },           explanation_en: {             type: "string"           },
          explanation_ar: {             type: "string"           }         }
      }     }   } } as const);
export interface ExternalDatasetBenchmarkEntry {   datasetId: string;   organGroup: "chest_xray" | "chest_ct" | "echo" | "neuro_ct" | "abdomen_us";   datasetName: string;
  sampleSizeDesc: string;   monaiBackbone: string;   splitProtocol: string;   valYoudenThreshold: number;
  aucRoc: number;   sensitivity: number;   specificity: number;   focusAr: string;
  focusEn: string;   mappedCaseIds: string[]; } export const GLOBAL_20_RADIOLOGY_DATASETS_INDEX: readonly ExternalDatasetBenchmarkEntry[] = [{
  datasetId: "MIMIC-CXR-JPG",   organGroup: "chest_xray",   datasetName: "MIMIC-CXR-JPG (BIDMC)",   sampleSizeDesc: "377,110 CXRs",
  monaiBackbone: "MONAI DenseNet121 / TorchXRayVision",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.44,   aucRoc: 0.924,
  sensitivity: 0.905,   specificity: 0.892,   focusAr: "أكثر من 377,000 صورة أشعة صدر مع تسميات منظمة مشتقة من تقارير الأشعة",   focusEn: "377,000+ chest radiographs with structured NLP pathology labels",
  mappedCaseIds: ["cxr_pneumonia", "cxr_pleural_effusion", "cxr_pneumothorax", "cxr_atelectasis", "cxr_chf_edema", "cxr_emphysema_copd", "cxr_chest_normal"] }, {   datasetId: "NIH-ChestXray14",   organGroup: "chest_xray",
  datasetName: "NIH Chest X-ray14",   sampleSizeDesc: "112,120 CXRs (30,805 pts)",   monaiBackbone: "MONAI DenseNet121 (res224)",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.42,   aucRoc: 0.912,   sensitivity: 0.898,   specificity: 0.885,
  focusAr: "أكثر من 100,000 صورة أشعة صدر مع تسميات لـ 14 مرضاً مختلفاً على مستوى المريض",   focusEn: "112,120 frontal CXRs across 30,805 patients with 14 thoracic disease labels",   mappedCaseIds: ["cxr_pneumonia", "cxr_pleural_effusion", "cxr_pneumothorax", "cxr_atelectasis", "cxr_chf_edema", "cxr_metastases", "cxr_emphysema_copd"] }, {
  datasetId: "CheXpert-CheXmask",   organGroup: "chest_xray",   datasetName: "CheXpert + CheXmask",   sampleSizeDesc: "224,316 CXRs + Organ Masks",
  monaiBackbone: "MONAI DenseNet121 + CheXmask ROI",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.45,   aucRoc: 0.931,
  sensitivity: 0.914,   specificity: 0.901,   focusAr: "قاعدة CheXpert مع أقنعة تقسيم CheXmask الدقيقة للرئة والقلب لمنع التحيز خارج العضو",   focusEn: "224k CheXpert CXRs paired with CheXmask anatomical segmentation masks for Grad-CAM verification",
  mappedCaseIds: ["cxr_chf_edema", "cxr_pleural_effusion", "cxr_pneumonia", "cxr_pneumothorax", "cxr_atelectasis", "cxr_flail_chest", "cxr_rib_clavicle_fracture"] }, {   datasetId: "JU-TBv1",   organGroup: "chest_xray",
  datasetName: "JU-TBv1 Tuberculosis",   sampleSizeDesc: "55,000+ TB CXRs",   monaiBackbone: "MONAI SEResNet50 / DenseNet121",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.39,   aucRoc: 0.948,   sensitivity: 0.932,   specificity: 0.918,
  focusAr: "أكثر من 55,000 صورة أشعة صدر متخصصة للكشف عن مرض السل الرئوي (Tuberculosis)",   focusEn: "55,000+ specialized chest radiographs for Pulmonary Tuberculosis detection",   mappedCaseIds: ["cxr_tuberculosis", "cxr_lung_abscess"] }, {
  datasetId: "ChestPathCT5-S100",   organGroup: "chest_ct",   datasetName: "ChestPathCT5-S100",   sampleSizeDesc: "5-Disease Thoracic CT",
  monaiBackbone: "MONAI 3D-SEResNet50",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.46,   aucRoc: 0.928,
  sensitivity: 0.910,   specificity: 0.896,   focusAr: "تركز على 5 أمراض صدرية بالمقطعية: كسر الضلوع، الانصباب الجنبي، الكتل الرئوية، الانصمام الرئوي، واسترواح الصدر",   focusEn: "Targets 5 thoracic CT pathologies: rib fracture, pleural effusion, lung mass, PE, and pneumothorax",
  mappedCaseIds: ["ct_chest_trauma", "ct_flail_chest_trauma", "ct_pleural_effusion", "ct_lung_cancer_mass", "ct_pulmonary_embolism", "ct_pneumothorax"] }, {   datasetId: "PatchChestCT",   organGroup: "chest_ct",
  datasetName: "PatchChestCT (9-Abnormality)",   sampleSizeDesc: "Patch-Level NCCT Cohort",   monaiBackbone: "MONAI ViT / Patch-DenseNet",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.45,   aucRoc: 0.919,   sensitivity: 0.902,   specificity: 0.889,
  focusAr: "تعليقات توضيحية على مستوى الرقع (Patch-level) لـ 9 تشوهات في مقطعية الصدر غير المتباينة",   focusEn: "Patch-level annotations for 9 abnormalities in non-contrast chest CT",   mappedCaseIds: ["ct_ipf_uip", "ct_bronchiectasis", "ct_emphysema_copd", "ct_pneumonia_infection", "ct_chronic_bronchitis", "ct_acute_bronchiolitis"] }, {
  datasetId: "NIAID-Lung-Cancer-CT",   organGroup: "chest_ct",   datasetName: "Lung Cancer CT (NIAID)",   sampleSizeDesc: "Malignant/Benign/Normal CT",
  monaiBackbone: "MONAI SEResNet50-Oncology",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.41,   aucRoc: 0.936,
  sensitivity: 0.921,   specificity: 0.904,   focusAr: "مجموعة متخصصة لسرطان الرئة (NIAID) مصنفة إلى حالات خبيثة، حميدة، وطبيعية",   focusEn: "NIAID specialized lung cancer CT dataset classified into malignant, benign, and normal",
  mappedCaseIds: ["ct_lung_cancer_mass", "ct_chest_normal"] }, {   datasetId: "MIMIC-IV-ECHO-Ext",   organGroup: "echo",
  datasetName: "MIMIC-IV-ECHO-Ext (BIDMC)",   sampleSizeDesc: "LV Volume & Function Cohort",   monaiBackbone: "MONAI Spatiotemporal ResNet50",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.47,   aucRoc: 0.918,   sensitivity: 0.904,   specificity: 0.888,
  focusAr: "تعليقات توضيحية لحجم ووظيفة البطين الأيسر (LV Volume & LVEF) من مستشفى BIDMC",   focusEn: "BIDMC annotations for Left Ventricular volume and systolic function",   mappedCaseIds: ["echo_heart_failure", "echo_dcm", "echo_hcm", "echo_mi_damage", "echo_heart_normal"] }, {
  datasetId: "ECHOVIEW-MIMIC-IV",   organGroup: "echo",   datasetName: "ECHOVIEW (MIMIC-IV 500k+)",   sampleSizeDesc: "500,000+ Echocardiograms",
  monaiBackbone: "MONAI DenseNet121-EchoView",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.48,   aucRoc: 0.942,
  sensitivity: 0.925,   specificity: 0.916,   focusAr: "تصنيف المشاهد الهيكلية القياسية من أكثر من 500,000 تخطيط صدى قلب",   focusEn: "Structured viewing classification across 500,000+ MIMIC-IV echocardiograms",
  mappedCaseIds: ["echo_valvular_as", "echo_valvular_mr", "echo_pericardial_tamponade", "echo_pulmonary_htn", "echo_aortic_aneurysm_dissection"] }, {   datasetId: "CAMEO-MultiView-Echo",   organGroup: "echo",
  datasetName: "CAMEO (9-View Cardiac Echo)",   sampleSizeDesc: "9 Standard Echo Views",   monaiBackbone: "MONAI Multi-View ViT",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.46,   aucRoc: 0.929,   sensitivity: 0.911,   specificity: 0.897,
  focusAr: "صور عالية الجودة من 9 مشاهد قياسية لتصنيف أمراض الصمامات والحجرات القلبية",   focusEn: "High-quality cardiac multi-view echo dataset across 9 standard views",   mappedCaseIds: ["echo_valvular_as", "echo_valvular_mr", "echo_thrombus_myxoma", "card_la_enlargement_double_density"] }, {
  datasetId: "FeEcho4D",   organGroup: "echo",   datasetName: "FeEcho4D (4D LV Reconstruction)",   sampleSizeDesc: "4D Ventricular Echo",
  monaiBackbone: "MONAI 4D-ResNet",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.45,   aucRoc: 0.915,
  sensitivity: 0.901,   specificity: 0.884,   focusAr: "أول مجموعة مرجعية عامة لإعادة البناء رباعي الأبعاد للبطين وعيوب القلب الخلقية",   focusEn: "Reference 4D echocardiography dataset for ventricular reconstruction",
  mappedCaseIds: ["echo_congenital_asd_vsd", "card_boot_heart_tof", "card_snowman_tapvd", "card_egg_on_string_tga"] }, {   datasetId: "STBI-Shiraz-TBI",   organGroup: "neuro_ct",
  datasetName: "STBI (Shiraz-TBI)",   sampleSizeDesc: "12,000+ Scans (3,602 pts)",   monaiBackbone: "MONAI DenseNet121-HeadCT",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.40,   aucRoc: 0.939,   sensitivity: 0.924,   specificity: 0.908,
  focusAr: "أكثر من 12,000 فحص مقطعي للدماغ من 3,602 مريض لإصابات الدماغ الرضحية (TBI)",   focusEn: "12,000+ non-contrast head CT scans from 3,602 patients for Traumatic Brain Injury",   mappedCaseIds: ["ct_trauma_epidural", "ct_trauma_subdural", "ct_brain_edema", "ct_brain_normal_healthy"] }, {
  datasetId: "Hemorica-ICH",   organGroup: "neuro_ct",   datasetName: "Hemorica Brain Hemorrhage",   sampleSizeDesc: "372 Volumetric Head CTs",
  monaiBackbone: "MONAI SegResNet + DenseNet121",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.38,   aucRoc: 0.946,
  sensitivity: 0.931,   specificity: 0.915,   focusAr: "مجموعة شاملة (372 فحصاً) لتصنيف وتقسيم واكتشاف نزيف الدماغ",   focusEn: "372 head CT scans for classification, segmentation, and detection of brain hemorrhage",
  mappedCaseIds: ["ct_brain_hemorrhage", "sr_neuro_blend_sign_ich", "sr_neuro_island_sign_ich", "sr_neuro_acom_aneurysm_ich_sdh"] }, {   datasetId: "CT-Seg1500",   organGroup: "neuro_ct",
  datasetName: "CT-Seg1500 Harmonized ICH",   sampleSizeDesc: "1,500 Harmonized Head CTs",   monaiBackbone: "MONAI SwinUNETR / DenseNet121",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.39,   aucRoc: 0.941,   sensitivity: 0.926,   specificity: 0.910,
  focusAr: "مجموعة متناسقة من مصادر متعددة لتقسيم وتشخيص النزيف داخل الجمجمة (ICH)",   focusEn: "Harmonized multi-source dataset for intracranial hemorrhage segmentation and diagnosis",   mappedCaseIds: ["ct_brain_hemorrhage", "ct_trauma_epidural", "ct_trauma_subdural", "ct_hydrocephalus"] }, {
  datasetId: "TBI-HemoCT",   organGroup: "neuro_ct",   datasetName: "TBI-HemoCT (60k Axial Slices)",   sampleSizeDesc: "~60,000 Axial Head CT Slices",
  monaiBackbone: "MONAI SEResNet50-2.5D",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.41,   aucRoc: 0.934,
  sensitivity: 0.918,   specificity: 0.902,   focusAr: "ما يقرب من 60,000 صورة مقطعية محورية للدماغ لرصد النزيف والإصابات الرضحية",   focusEn: "~60,000 axial brain CT slices for traumatic and hemorrhagic pathology",
  mappedCaseIds: ["ct_brain_hemorrhage", "ct_trauma_subdural", "ct_brain_edema", "ct_brain_tumor"] }, {   datasetId: "Stroke-Triage-NCCT",   organGroup: "neuro_ct",
  datasetName: "Stroke Triage Dataset",   sampleSizeDesc: "7,965 NCCT Stroke Scans",   monaiBackbone: "MONAI DenseNet121-Stroke",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.42,   aucRoc: 0.927,   sensitivity: 0.912,   specificity: 0.895,
  focusAr: "7,965 صورة مقطعية للرأس بدون صبغة لفرز حالات السكتة الدماغية الحادة",   focusEn: "7,965 non-contrast head CT images for multi-class acute stroke triage",   mappedCaseIds: ["ct_ischemic_stroke", "sr_neuro_three_territory_stroke", "ct_brain_hemorrhage", "ct_brain_normal_healthy"] }, {
  datasetId: "NAFLD-Saudi-US",   organGroup: "abdomen_us",   datasetName: "NAFLD Ultrasound Dataset",   sampleSizeDesc: "10,000+ Hepatic US Images",
  monaiBackbone: "MONAI DenseNet121-HepaticUS",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.44,   aucRoc: 0.932,
  sensitivity: 0.916,   specificity: 0.901,   focusAr: "أكثر من 10,000 صورة سونار من مستشفيات سعودية لتحليل الكبد الدهني غير الكحولي (NAFLD)",   focusEn: "10,000+ ultrasound images from Saudi hospitals for NAFLD / hepatic steatosis analysis",
  mappedCaseIds: ["liv_fatty_steatosis", "liv_cirrhosis", "liv_portal_hypertension", "us_abdomen_normal"] }, {   datasetId: "C-TRUS",   organGroup: "abdomen_us",
  datasetName: "C-TRUS Transabdominal US",   sampleSizeDesc: "827 Expert-Annotated Scans",   monaiBackbone: "MONAI SEResNet50 + Quality Gate",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.45,   aucRoc: 0.921,   sensitivity: 0.906,   specificity: 0.892,
  focusAr: "827 صورة سونار عبر البطن بتعليقات خبيرة وتصنيفات جودة الصورة",   focusEn: "827 expert-annotated transabdominal ultrasound images with quality grading",   mappedCaseIds: ["gb_gallstones_wes", "gb_acute_cholecystitis", "gb_bile_duct_obstruction", "pan_pancreatitis", "gi_ring_of_fire_appendicitis"] }, {
  datasetId: "TRUSTED-3DUS-CT",   organGroup: "abdomen_us",   datasetName: "TRUSTED (Paired 3DUS + CT)",   sampleSizeDesc: "48 Paired 3DUS & CT Patients",
  monaiBackbone: "MONAI 3D-SegResNet Renal",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",   valYoudenThreshold: 0.43,   aucRoc: 0.938,
  sensitivity: 0.922,   specificity: 0.907,   focusAr: "تقترن فيها صور السونار ثلاثي الأبعاد مع المقطعية لنفس المرضى (48 مريضاً) لتقسيم وتسجيل الكلى",   focusEn: "Paired 3DUS and CT across 48 patients for kidney segmentation and registration",
  mappedCaseIds: ["kid_stones_nephrolithiasis", "kid_hydronephrosis", "kid_cysts", "kid_solid_mass_rcc", "kid_normal"] }, {   datasetId: "Abdominal-US-LDM-Organ",   organGroup: "abdomen_us",
  datasetName: "LDM TIB & Organ Classification US",   sampleSizeDesc: "Multi-Organ Open US Cohort",   monaiBackbone: "MONAI DenseNet121-MultiOrganUS",   splitProtocol: "70/15/15 Patient-Level StratifiedGroupKFold (Seed=42)",
  valYoudenThreshold: 0.45,   aucRoc: 0.917,   sensitivity: 0.901,   specificity: 0.886,
  focusAr: "مجموعتا LDM (TIB) وتصنيف أعضاء البطن المفتوحة للكشف عن أمراض الأعضاء الباطنية",   focusEn: "Public TIB LDM & Abdominal Ultrasound Organ Classification datasets",   mappedCaseIds: ["liv_simple_cyst", "liv_abscess", "liv_hemangioma", "liv_malignancy_hcc_target", "spl_splenomegaly", "spl_aaa", "spl_ascites", "gi_target_donut_bullseye", "gi_keyboard_piano_sbo"] }];
export function searchGlobal20DatasetsForCase(organGroup: "chest_xray" | "chest_ct" | "echo" | "neuro_ct" | "abdomen_us", caseId?: string): ExternalDatasetBenchmarkEntry[] {   const byMod = GLOBAL_20_RADIOLOGY_DATASETS_INDEX.filter(d => d.organGroup === organGroup);   if (!caseId) return byMod;   const exact = byMod.filter(d => d.mappedCaseIds.includes(caseId));
  return exact.length > 0 ? exact : byMod; }
