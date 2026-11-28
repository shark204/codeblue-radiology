/**
 * Code Blue Radiology v2 — Hybrid Clinical Reasoning, Noisy-OR Fusion & Safety-Trap Engine
 * Combines Modal 5-Modality Deep Vision AI with 3-Card Clinical Context (Vitals/Onset, Symptoms, Risk Traps).
 */

export type RadModality = "chest_xray" | "chest_ct" | "neuro_ct" | "abdomen_us" | "echo";
export type RadUrgency = "CRITICAL" | "URGENT" | "ROUTINE";
export type EvidenceTier = "strong" | "moderate" | "preliminary";

export interface RemoteRadFinding {
  code: string;
  label: string;
  probability: number;
  threshold: number;
  positive: boolean;
}

export interface RemoteRadResponse {
  ok: boolean;
  invalid_scan?: boolean;
  invalid_reason?: string;
  engine?: string;
  detected_modality?: RadModality;
  router_probabilities?: Record<string, number>;
  elapsed_sec?: number;
  findings: RemoteRadFinding[];
  measurements?: { ctr_ratio?: number };
  gradcam_url?: string | null;
  gradcam_focus_region?: string;
}

export interface RadClinicalContext {
  onset: "acute" | "subacute" | "chronic";
  hemodynamics: "stable" | "unstable";
  fever: boolean;
  hypoxia: boolean;
  trauma: boolean;
  symptoms: string[];
  anticoagulants: boolean;
  malignancyOrSmoking: boolean;
  dvtPeRisk: boolean;
  immunosuppressedOrTb: boolean;
  postProcedure: boolean;
}

export const INITIAL_RAD_CONTEXT: RadClinicalContext = {
  onset: "acute",
  hemodynamics: "stable",
  fever: false,
  hypoxia: false,
  trauma: false,
  symptoms: [],
  anticoagulants: false,
  malignancyOrSmoking: false,
  dvtPeRisk: false,
  immunosuppressedOrTb: false,
  postProcedure: false,
};

export interface RadDiagnosisItem {
  code: string;
  name_en: string;
  name_ar: string;
  urgency: RadUrgency;
  source: "hybrid" | "visual_ai" | "safety_trap";
  evidence: EvidenceTier;
  confidence: number;
  explanation_en: string;
  explanation_ar: string;
  inv_en: string;
  inv_ar: string;
  ttt_en: string;
  ttt_ar: string;
}

export interface RadHybridResult {
  modality: RadModality;
  finalUrgency: RadUrgency;
  primary: RadDiagnosisItem;
  coExisting: RadDiagnosisItem[];
  safetyAlerts: { title_en: string; title_ar: string; body_en: string; body_ar: string }[];
  measurements: { ctr_ratio?: number };
}

export const MODALITY_SYMPTOMS: Record<RadModality, { id: string; en: string; ar: string }[]> = {
  chest_xray: [
    { id: "dyspnea", en: "Shortness of breath", ar: "ضيق في التنفس" },
    { id: "pleuritic_pain", en: "Sharp pleuritic chest pain", ar: "ألم صدر حاد مع الشهيق" },
    { id: "productive_cough", en: "Productive / purulent cough", ar: "كحة ببلغم أصفر أو أخضر" },
    { id: "hemoptysis", en: "Coughing up blood (Hemoptysis)", ar: "كحة مدممة" },
    { id: "orthopnea", en: "Orthopnea / pink frothy sputum", ar: "ضيق نفس عند الاستلقاء / بلغم وردي" },
    { id: "weight_loss", en: "Weight loss / night sweats", ar: "نزول وزن / تعرق ليلي" },
  ],
  chest_ct: [
    { id: "hemoptysis", en: "Hemoptysis / chronic cough >3w", ar: "سعال مدمم أو كحة > 3 أسابيع" },
    { id: "weight_loss", en: "Unexplained weight loss", ar: "فقدان وزن غير مبرر" },
    { id: "dyspnea", en: "Progressive dyspnea", ar: "ضيق نفس متزايد" },
    { id: "pleuritic_pain", en: "Pleuritic chest pain", ar: "ألم صدر مع التنفس" },
    { id: "hoarseness", en: "Hoarseness / chest wall pain", ar: "بحة صوت أو ألم بجدار الصدر" },
  ],
  neuro_ct: [
    { id: "thunderclap", en: "Sudden thunderclap headache", ar: "صداع مفاجئ وشديد جدًا (رعدي)" },
    { id: "focal_deficit", en: "One-sided weakness / facial droop", ar: "ضعف بنصف الجسم أو التواء الفم" },
    { id: "seizure", en: "New-onset seizures", ar: "تشنجات أو نوبات صرع جديدة" },
    { id: "vision_change", en: "Visual field loss / diplopia", ar: "اضطراب الرؤية أو ازدواجها" },
    { id: "morning_headache", en: "Progressive morning headache + vomiting", ar: "صداع صباحي متزايد مع قيء" },
    { id: "altered_loc", en: "Confusion / decreased consciousness", ar: "تشوش أو انخفاض مستوى الوعي" },
  ],
  abdomen_us: [
    { id: "ruq_pain", en: "RUQ pain (post-fatty meals)", ar: "ألم أعلى يمين البطن بعد الأكل الدسم" },
    { id: "jaundice", en: "Jaundice / dark tea urine", ar: "اصفرار العينين أو بول داكن" },
    { id: "flank_pain", en: "Flank pain radiating to groin", ar: "ألم بالجنب يمتد لأسفل البطن" },
    { id: "hematuria", en: "Blood in urine (Hematuria)", ar: "دم في البول" },
    { id: "rlq_pain", en: "RLQ pain + fever", ar: "ألم أسفل يمين البطن مع حرارة" },
    { id: "ascites", en: "Abdominal distension / early satiety", ar: "انتفاخ البطن / استسقاء" },
  ],
  echo: [
    { id: "exertional_sob", en: "Exertional dyspnea / orthopnea", ar: "ضيق نفس مع المجهود أو الاستلقاء" },
    { id: "leg_edema", en: "Bilateral ankle / leg edema", ar: "تورم الساقين والكاحلين" },
    { id: "chest_pressure", en: "Exertional chest pressure", ar: "ضغط أو ألم بالصدر مع المجهود" },
    { id: "syncope", en: "Syncope / pre-syncope", ar: "إغماء أو دوخة شديدة" },
    { id: "palpitations", en: "Palpitations / irregular pulse", ar: "خفقان أو عدم انتظام النبض" },
  ],
};

interface ClinicalEntry {
  name_en: string; name_ar: string; urgency: RadUrgency;
  exp_en: string; exp_ar: string;
  inv_en: string; inv_ar: string;
  ttt_en: string; ttt_ar: string;
}

const CLINICAL_LIB: Record<string, ClinicalEntry> = {
  PNEUMOTHORAX: {
    name_en: "Pneumothorax (Collapsed Lung)", name_ar: "استرواح صدري (Pneumothorax)", urgency: "CRITICAL",
    exp_en: "Visible pleural line with absent peripheral lung markings indicating air in the pleural space.",
    exp_ar: "وجود هواء في التجويف البلوري مع غياب العلامات الرئوية الطرفية.",
    inv_en: "Repeat upright CXR if stable, ABG/SpO2 monitoring, bedside lung ultrasound (absent lung sliding).",
    inv_ar: "متابعة الأكسجين وغازات الدم ABG وسونار الصدر السريري (غياب انزلاق الرئة).",
    ttt_en: "High-flow O2; if large/symptomatic -> needle aspiration or chest tube thoracostomy. If unstable/tension -> immediate needle decompression.",
    ttt_ar: "أكسجين عالي التدفق؛ وإذا كان كبيرًا أو مصحوبًا بأعراض ← أنبوب صدري. لو غير مستقر/ضاغط ← تفريغ فوري بالإبرة قبل أي أشعة إضافية.",
  },
  EFFUSION: {
    name_en: "Pleural Effusion", name_ar: "ارتشاح بلوري (Pleural Effusion)", urgency: "URGENT",
    exp_en: "Blunting of the costophrenic angle with meniscus sign suggesting pleural fluid accumulation.",
    exp_ar: "تجمع سوائل بالتجويف البلوري مع انطماس الزاوية الضلعية الحجابية.",
    inv_en: "Bedside thoracic US, diagnostic thoracentesis (Light's criteria: protein, LDH, cell count, cytology, Gram/AFB).",
    inv_ar: "سونار صدري وبزل تشخيصي لتحليل السائل البلوري (معايير Light: بروتين، LDH، خلايا، مزرعة).",
    ttt_en: "Therapeutic thoracentesis if dyspneic; treat underlying cause (diuretics for HF, antibiotics/drainage for empyema).",
    ttt_ar: "بزل علاجي لتخفيف ضيق النفس مع علاج السبب (مدرات البول لفشل القلب أو مضادات حيوية وتصريف للانصباب الصديدي).",
  },
  PNEUMONIA: {
    name_en: "Pneumonia / Lobar Consolidation", name_ar: "التهاب رئوي / تكثّف رئوي (Pneumonia)", urgency: "URGENT",
    exp_en: "Focal or patchy airspace opacification consistent with infectious consolidation.",
    exp_ar: "عتامة بؤرية أو منتشرة في النسيج الرئوي تتماشى مع التهاب رئوي.",
    inv_en: "CBC, CRP/Procalcitonin, blood & sputum cultures, ABG/SpO2, CURB-65 severity scoring.",
    inv_ar: "صورة دم CBC و CRP وبروكالسيتونين، مزرعة دم وبصاق، وتقييم الشدة بـ CURB-65.",
    ttt_en: "Guideline-directed empiric antibiotics (CAP vs HAP), O2 titration (target SpO2 >= 92%), IV fluids if septic.",
    ttt_ar: "مضادات حيوية حسب بروتوكول الالتهاب الرئوي، أكسجين للحفاظ على التشبع >= 92%، وسوائل وريدية عند وجود إنتان.",
  },
  CONSOLIDATION: {
    name_en: "Airspace Consolidation", name_ar: "تكثّف هوائي بالرئة (Consolidation)", urgency: "URGENT",
    exp_en: "Dense alveolar filling pattern; most commonly pneumonia, edema, or hemorrhage depending on clinical context.",
    exp_ar: "امتلاء الحويصلات الهوائية بسائل أو صديد (التهاب رئوي أو وذمة أو نزيف حسب السياق).",
    inv_en: "CBC, CRP, sputum culture, BNP if HF suspected, follow-up CXR in 6 weeks to ensure resolution.",
    inv_ar: "CBC و CRP ومزرعة بصاق و BNP عند اشتباه فشل القلب، وإعادة أشعة الصدر بعد 6 أسابيع للتأكد من الزوال.",
    ttt_en: "Treat primary etiology (empiric antibiotics for infection vs diuresis for edema) + respiratory support.",
    ttt_ar: "علاج السبب الأساسي (مضادات حيوية للعدوى أو مدرات للوذمة) مع دعم التنفس.",
  },
  EDEMA: {
    name_en: "Pulmonary Edema / Congestion", name_ar: "وذمة رئوية حادة (Pulmonary Edema)", urgency: "CRITICAL",
    exp_en: "Bilateral perihilar bat-wing opacities, Kerley B lines, or cephalization indicating elevated pulmonary venous pressure.",
    exp_ar: "احتقان رئوي ثنائي يشير لارتفاع الضغط الوريدي الرئوي وفشل القلب الحاد.",
    inv_en: "ECG, hs-Troponin, BNP/NT-proBNP, BMP/creatinine, ABG, urgent bedside Echocardiogram.",
    inv_ar: "تخطيط قلب ECG وتروبونين و BNP ووظائف كلى وغازات دم وإيكو قلب عاجل.",
    ttt_en: "Upright positioning, O2 / NIV (CPAP/BiPAP), IV loop diuretic (Furosemide), IV nitrates if SBP > 110 mmHg.",
    ttt_ar: "وضعية الجلوس، أكسجين / تنفس غير باضع NIV، فوروسيميد وريدي، ونيترات إذا كان الضغط يسمح.",
  },
  CARDIOMEGALY: {
    name_en: "Cardiomegaly (Enlarged Cardiac Silhouette)", name_ar: "تضخم عضلة القلب (Cardiomegaly)", urgency: "URGENT",
    exp_en: "Enlarged cardiothoracic silhouette (CTR > 0.50 on PA film); consider heart failure, pericardial effusion, or valvular disease.",
    exp_ar: "اتساع ظل القلب (CTR > 0.50) — يستدعي تقييم فشل القلب أو الارتشاح التاموري أو أمراض الصمامات.",
    inv_en: "12-lead ECG, Transthoracic Echocardiogram (LVEF, valves, pericardium), BNP, TSH.",
    inv_ar: "تخطيط قلب ECG وإيكو قلب كامل لتقييم الكفاءة والصمامات والتامور، مع تحليل BNP.",
    ttt_en: "Manage underlying cardiomyopathy, hypertension, or pericardial effusion per cardiology guidance.",
    ttt_ar: "علاج السبب (فشل القلب، ارتفاع الضغط، أو الارتشاح التاموري) تحت إشراف طبيب القلب.",
  },
  MASS: {
    name_en: "Pulmonary Mass / Suspicious Lesion", name_ar: "كتلة رئوية مشتبهة (Pulmonary Mass)", urgency: "URGENT",
    exp_en: "Discrete pulmonary opacity > 3 cm requiring urgent contrast Chest CT to exclude primary or metastatic malignancy.",
    exp_ar: "كتلة رئوية محددة تتطلب أشعة مقطعية بالصبغة لاستبعاد الأورام.",
    inv_en: "Contrast-enhanced Chest/Upper Abdomen CT, PET-CT staging, bronchoscopy or CT-guided biopsy.",
    inv_ar: "أشعة مقطعية بالصبغة على الصدر والبطن، وتقييم أخذ عينة (منظار شعبي أو عينة موجهة بالمقطعية).",
    ttt_en: "Urgent pulmonology / thoracic oncology multidisciplinary team (MDT) referral.",
    ttt_ar: "تحويل عاجل لفريق الصدر والأورام متعدد التخصصات (MDT) لوضع خطة التشخيص والعلاج.",
  },
  NODULE: {
    name_en: "Pulmonary Nodule", name_ar: "عقيدة رئوية (Pulmonary Nodule)", urgency: "ROUTINE",
    exp_en: "Focal rounded opacity <= 3 cm; risk-stratify by size, margins, and smoking/malignancy history (Fleischner criteria).",
    exp_ar: "عقيدة رئوية صغيرة تتطلب تقييم الحجم والحواف وعوامل الخطورة وفق معايير Fleischner.",
    inv_en: "Compare with prior imaging; thin-section Chest CT per Fleischner Society guidelines.",
    inv_ar: "مقارنة بالأشعة السابقة وعمل مقطعية رقيقة المقاطع وفق إرشادات Fleischner.",
    ttt_en: "Serial CT surveillance vs PET-CT/biopsy based on nodule size and clinical risk.",
    ttt_ar: "متابعة دورية بالمقطعية أو فحوصات إضافية حسب حجم العقيدة وتاريخ التدخين.",
  },
  GLIOMA: {
    name_en: "Suspected Glioma (Intra-Axial Brain Mass)", name_ar: "اشتباه ورم دبقي بالمخ (Glioma)", urgency: "CRITICAL",
    exp_en: "Intra-axial parenchymal mass pattern with surrounding edema/mass effect suspicious for glial neoplasm.",
    exp_ar: "آفة داخل نسيج المخ مع وذمة محيطة تشتبه في ورم دبقي.",
    inv_en: "Contrast Brain MRI with spectroscopy/perfusion, neurosurgery consult, baseline labs.",
    inv_ar: "رنين مغناطيسي بالصبغة على المخ واستشارة جراحة مخ وأعصاب عاجلة.",
    ttt_en: "IV Dexamethasone if significant vasogenic edema/mass effect, seizure prophylaxis if indicated, urgent neurosurgical evaluation.",
    ttt_ar: "ديكساميثازون وريدي عند وجود وذمة ضاغطة، ومضاد تشنجات عند اللزوم، وتقييم جراحة المخ والأعصاب.",
  },
  MENINGIOMA: {
    name_en: "Suspected Meningioma (Extra-Axial Mass)", name_ar: "اشتباه ورم سحائي (Meningioma)", urgency: "URGENT",
    exp_en: "Well-circumscribed extra-axial dural-based mass appearance.",
    exp_ar: "كتلة محددة الحواف خارج نسيج المخ (سحائية المنشأ).",
    inv_en: "Contrast Brain MRI (dural tail assessment), formal visual field & neurological exam.",
    inv_ar: "رنين مغناطيسي بالصبغة على المخ مع فحص عصبي ومجال إبصار كامل.",
    ttt_en: "Neurosurgery referral for surveillance vs surgical resection / stereotactic radiosurgery.",
    ttt_ar: "عرض على جراحة المخ والأعصاب لتحديد المتابعة أو الاستئصال أو الجراحة الإشعاعية.",
  },
  PITUITARY: {
    name_en: "Suspected Pituitary / Sellar Lesion", name_ar: "اشتباه ورم بالغدة النخامية (Pituitary)", urgency: "URGENT",
    exp_en: "Sellar / suprasellar mass pattern; assess optic chiasm compression and endocrine axes.",
    exp_ar: "آفة بمنطقة الغدة النخامية تستدعي تقييم العصب البصري والهرمونات.",
    inv_en: "Dedicated pituitary MRI with contrast, hormonal panel (Prolactin, IGF-1, Cortisol, ACTH, TSH/fT4, LH/FSH), formal perimetry.",
    inv_ar: "رنين مخصص للغدة النخامية بالصبغة + تحاليل هرمونات كاملة + فحص مجال الإبصار.",
    ttt_en: "Endocrinology & neurosurgery consult (dopamine agonist for prolactinoma vs transsphenoidal resection).",
    ttt_ar: "استشارة الغدد الصماء وجراحة المخ والأعصاب (علاج دوائي للبرولاكتينوما أو استئصال جراحي).",
  },
  REDUCED_EF: {
    name_en: "Reduced Left Ventricular Systolic Function (EF < 50%)", name_ar: "ضعف كفاءة البطين الأيسر (EF < 50%)", urgency: "URGENT",
    exp_en: "2D echocardiography pattern consistent with impaired LV systolic contraction (HFrEF/HFmrEF).",
    exp_ar: "نمط إيكو يشير لانخفاض كفاءة انقباض البطين الأيسر.",
    inv_en: "Complete quantitative TTE (Simpson's biplane EF), 12-lead ECG, BNP, troponin, ischemia workup.",
    inv_ar: "إيكو كمّي كامل بطريقة Simpson، تخطيط قلب، BNP، وتقييم الشرايين التاجية.",
    ttt_en: "Guideline-directed medical therapy (ARNI/ACEi, Beta-blocker, MRA, SGLT2i) + diuretics for congestion.",
    ttt_ar: "العلاج الرباعي القياسي لفشل القلب مع مدرات البول عند وجود احتقان تحت إشراف طبيب القلب.",
  },
  NO_FINDING: {
    name_en: "No Major Acute Radiographic Abnormality Detected", name_ar: "لم يُرصد شذوذ حاد واضح في الصورة", urgency: "ROUTINE",
    exp_en: "Visual AI did not detect a high-probability focal lesion; always correlate directly with clinical presentation.",
    exp_ar: "لم يرصد الذكاء البصري آفة بؤرية عالية الاحتمال؛ يجب دائمًا الربط المباشر بالحالة السريرية.",
    inv_en: "Correlate clinically; consider advanced imaging (CT/MRI/US) if red-flag symptoms persist.",
    inv_ar: "اربط النتيجة بالفحص السريري، واطلب أشعة أدق إذا استمرت أعراض الخطورة.",
    ttt_en: "Clinical follow-up and symptomatic management; return immediately if red flags develop.",
    ttt_ar: "متابعة سريرية وعلاج الأعراض مع التوجه فورًا للطوارئ عند ظهور أي علامات خطورة.",
  },
};

function normalizeKey(code: string): string {
  const c = code.toUpperCase();
  if (c.includes("NOTUMOR") || c.includes("NO_TUMOR") || c.includes("NORMAL") || c.includes("NO_FINDING") || c.includes("PRESERVED_EF")) return "NO_FINDING";
  if (c.includes("ADENOCARCINOMA") || c.includes("SQUAMOUS") || c.includes("LARGE_CELL") || c.includes("CARCINOMA")) return "MASS";
  return c;
}

export function runHybridRadiologyDiagnosis(
  remote: RemoteRadResponse,
  ctx: RadClinicalContext,
  selectedModality?: RadModality
): RadHybridResult {
  const modality: RadModality = selectedModality || remote.detected_modality || "chest_xray";
  const safetyAlerts: RadHybridResult["safetyAlerts"] = [];

  // 1) Map AI findings + apply clinical Noisy-OR boosting
  const items: RadDiagnosisItem[] = (remote.findings || []).map((f) => {
    const key = normalizeKey(f.code);
    const lib = CLINICAL_LIB[key];
    let boost = 0;
    if (key === "PNEUMONIA" && (ctx.fever || ctx.symptoms.includes("productive_cough"))) boost += 0.14;
    if (key === "PNEUMOTHORAX" && (ctx.trauma || ctx.postProcedure || ctx.symptoms.includes("pleuritic_pain"))) boost += 0.18;
    if (key === "EDEMA" && (ctx.hypoxia || ctx.symptoms.includes("orthopnea"))) boost += 0.15;
    if (key === "MASS" && (ctx.malignancyOrSmoking || ctx.symptoms.includes("hemoptysis") || ctx.symptoms.includes("weight_loss"))) boost += 0.14;
    if ((key === "GLIOMA" || key === "MENINGIOMA" || key === "PITUITARY") && (ctx.symptoms.includes("focal_deficit") || ctx.symptoms.includes("seizure") || ctx.symptoms.includes("morning_headache"))) boost += 0.14;
    if (key === "REDUCED_EF" && (ctx.symptoms.includes("exertional_sob") || ctx.symptoms.includes("leg_edema"))) boost += 0.14;

    // Noisy-OR fusion: 1 - (1 - p_ai)(1 - p_clin)
    const fused = Math.min(0.99, 1 - (1 - f.probability) * (1 - boost));
    const evidence: EvidenceTier = fused >= 0.72 ? "strong" : fused >= 0.42 ? "moderate" : "preliminary";

    return {
      code: f.code,
      name_en: lib ? lib.name_en : f.label,
      name_ar: lib ? lib.name_ar : f.label,
      urgency: lib ? lib.urgency : f.probability >= 0.6 ? "URGENT" : "ROUTINE",
      source: boost > 0 ? "hybrid" : "visual_ai",
      evidence,
      confidence: Number(fused.toFixed(3)),
      explanation_en: lib ? lib.exp_en : `Visual AI detected ${f.label} pattern in the ${modality.replace("_", " ")} scan.`,
      explanation_ar: lib ? lib.exp_ar : `رصد الذكاء البصري نمطًا يتماشى مع ${f.label} في الأشعة.`,
      inv_en: lib ? lib.inv_en : "Correlate with formal radiologist review and targeted laboratory/imaging workup.",
      inv_ar: lib ? lib.inv_ar : "اربط النتيجة بتقرير طبيب الأشعة والفحوصات المعملية والتصويرية المناسبة.",
      ttt_en: lib ? lib.ttt_en : "Manage according to specialist consultation and local clinical guidelines.",
      ttt_ar: lib ? lib.ttt_ar : "التعامل السريري حسب تقييم الطبيب المختص والبروتوكولات المعتمدة.",
    };
  });

  // 2) Mandatory Clinical Safety Traps (NEVER overridden by normal scan!)
  const hasPtx = items.some((i) => normalizeKey(i.code) === "PNEUMOTHORAX" && i.confidence >= 0.30);
  if (hasPtx && (ctx.hemodynamics === "unstable" || ctx.hypoxia)) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Suspected Tension Pneumothorax",
      title_ar: "تنبيه أمان حرج — اشتباه استرواح صدري ضاغط",
      body_en: "Pneumothorax with hemodynamic instability or severe hypoxia is a clinical emergency: perform immediate needle decompression / chest tube without waiting for CT.",
      body_ar: "الاسترواح الصدري مع عدم استقرار العلامات الحيوية طارئ قاتل: تفريغ فوري بالإبرة وأنبوب صدري دون انتظار أشعة إضافية.",
    });
  }
  if (modality === "neuro_ct" && ctx.symptoms.includes("thunderclap")) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Thunderclap Headache (Rule Out SAH)",
      title_ar: "تنبيه أمان حرج — صداع رعدي مفاجئ (استبعد نزيف تحت العنكبوتية SAH)",
      body_en: "A normal single slice or non-contrast scan does NOT exclude Subarachnoid Hemorrhage — urgent full non-contrast CT head + Lumbar Puncture / CTA required.",
      body_ar: "الصورة الطبيعية لا تستبعد نزيف تحت العنكبوتية SAH — يلزم فحص مقطعية مخ كاملة + بزل قطني أو CTA عاجل.",
    });
  }
  if (modality === "neuro_ct" && ctx.trauma && ctx.anticoagulants) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Head Trauma on Anticoagulants",
      title_ar: "تنبيه أمان حرج — إصابة رأس مع تناول مسيلات الدم",
      body_en: "High risk of acute or delayed intracranial hemorrhage: check INR/coagulation profile, consider urgent reversal, and repeat CT if any deterioration.",
      body_ar: "خطر مرتفع للنزيف الدماغي الحاد أو المتأخر: افحص التجلط/INR وفكّر في عكس المسيلات وإعادة المقطعية عند أي تدهور.",
    });
  }
  if ((modality === "chest_xray" || modality === "chest_ct") && ctx.hypoxia && ctx.dvtPeRisk) {
    safetyAlerts.push({
      title_en: "URGENT SAFETY TRAP — Hypoxia + PE Risk (Normal CXR Does Not Exclude PE)",
      title_ar: "تنبيه أمان عاجل — نقص أكسجين مع عوامل خطورة جلطة الرئة (PE)",
      body_en: "Chest X-ray is frequently normal in Pulmonary Embolism — calculate Wells score, D-dimer, and arrange urgent CT Pulmonary Angiography (CTPA).",
      body_ar: "أشعة الصدر غالبًا ما تكون طبيعية في جلطة الرئة — احسب Wells Score و D-dimer ورتّب CTPA عاجل.",
    });
  }

  // Sort positive pathology findings above NO_FINDING
  const pathologies = items.filter((i) => normalizeKey(i.code) !== "NO_FINDING" && i.confidence >= 0.30).sort((a, b) => b.confidence - a.confidence);
  const normalItem = items.find((i) => normalizeKey(i.code) === "NO_FINDING") || {
    code: "NO_FINDING",
    name_en: CLINICAL_LIB.NO_FINDING.name_en,
    name_ar: CLINICAL_LIB.NO_FINDING.name_ar,
    urgency: "ROUTINE" as RadUrgency,
    source: "visual_ai" as const,
    evidence: "moderate" as EvidenceTier,
    confidence: 0.7,
    explanation_en: CLINICAL_LIB.NO_FINDING.exp_en,
    explanation_ar: CLINICAL_LIB.NO_FINDING.exp_ar,
    inv_en: CLINICAL_LIB.NO_FINDING.inv_en,
    inv_ar: CLINICAL_LIB.NO_FINDING.inv_ar,
    ttt_en: CLINICAL_LIB.NO_FINDING.ttt_en,
    ttt_ar: CLINICAL_LIB.NO_FINDING.ttt_ar,
  };

  const primary = pathologies[0] ?? normalItem;
  const coExisting = pathologies.slice(1, 4);
  let finalUrgency: RadUrgency = primary.urgency;
  if (safetyAlerts.some((a) => a.title_en.includes("CRITICAL")) || ctx.hemodynamics === "unstable") finalUrgency = "CRITICAL";
  else if (safetyAlerts.length > 0 && finalUrgency === "ROUTINE") finalUrgency = "URGENT";

  return {
    modality,
    finalUrgency,
    primary,
    coExisting,
    safetyAlerts,
    measurements: remote.measurements ?? {},
  };
}
