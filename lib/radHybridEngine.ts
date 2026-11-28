/**
 * Code Blue Radiology v2.1 — Hybrid Clinical Reasoning, Noisy-OR Fusion & Safety-Trap Engine
 * Combines Modal 5-Modality Deep Vision AI with 3-Card Clinical Context + Similar Real Atlas Cases.
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

export interface SimilarAtlasCase {
  id: string;
  title_en: string;
  title_ar: string;
  modality: string;
  icd10: string;
  image_url: string;
  similarity: number;
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
  measurements?: { ctr_ratio?: number; echo_paired_ed_es?: boolean };
  gradcam_url?: string | null;
  gradcam_focus_region?: string;
  similar_atlas_cases?: SimilarAtlasCase[];
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
  measurements: { ctr_ratio?: number; echo_paired_ed_es?: boolean };
  similarAtlasCases: SimilarAtlasCase[];
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
  GALLBLADDER_STONE_CHOLECYSTITIS: {
    name_en: "Gallstones / Acute Cholecystitis Pattern", name_ar: "حصوات المرارة / اشتباه التهاب مرارة حاد", urgency: "URGENT",
    exp_en: "Sonographic pattern consistent with cholelithiasis (echogenic stone with acoustic shadowing) or gallbladder wall thickening.",
    exp_ar: "نمط سونار يتماشى مع حصوات مرارية أو سماكة بجدار المرارة.",
    inv_en: "CBC, LFTs (Bilirubin, ALP, GGT, ALT/AST), Lipase/Amylase, sonographic Murphy's sign & CBD caliber.",
    inv_ar: "صورة دم CBC ووظائف كبد (صفراء، ALP، ALT/AST) وإنزيمات بنكرياس وفحص علامة Murphy وقطر القناة المرارية CBD.",
    ttt_en: "NPO, IV fluids, analgesia, empiric IV antibiotics if acute cholecystitis (Tokyo guidelines), general surgery consult for cholecystectomy.",
    ttt_ar: "صيام ومحاليل وريدية ومسكنات، ومضادات حيوية وريدية إذا كان هناك التهاب حاد، واستشارة الجراحة العامة لاستئصال المرارة.",
  },
  HYDRONEPHROSIS_RENAL_STONE: {
    name_en: "Hydronephrosis / Renal Calculus Pattern", name_ar: "استسقاء كلوي / حصوة بالكلى", urgency: "URGENT",
    exp_en: "Dilated renal pelvicalyceal system or echogenic shadowing renal calculus on abdominal ultrasound.",
    exp_ar: "اتساع بحوض الكلية أو حصوة كلوية ظاهرة بالسونار.",
    inv_en: "Urinalysis & urine culture, serum creatinine/eGFR, CBC/CRP, low-dose non-contrast CT KUB if needed.",
    inv_ar: "تحليل ومزرعة بول، وظائف كلى (كرياتينين)، CBC/CRP، وأشعة مقطعية بدون صبغة على المسالك CT KUB عند اللزوم.",
    ttt_en: "Analgesia (NSAIDs), hydration, medical expulsive therapy if uncomplicated; URGENT decompression (DJ stent/nephrostomy) if infected/obstructed.",
    ttt_ar: "مسكنات وسوائل؛ أما في حالة وجود حرارة/عدوى مع انسداد فهذا طارئ عاجل يستدعي تركيب دعامة DJ أو تصريف فوري.",
  },
  LIVER_LESION_FATTY_CIRRHOSIS: {
    name_en: "Hepatic Steatosis / Cirrhosis / Focal Liver Lesion", name_ar: "دهون الكبد / تليف كبدي / بؤرة بالكبد", urgency: "URGENT",
    exp_en: "Increased hepatic echogenicity, coarse cirrhotic nodularity, or focal parenchymal liver lesion.",
    exp_ar: "تغيّر بصدى نسيج الكبد يتماشى مع كبد دهني أو تليف أو بؤرة كبدية.",
    inv_en: "LFTs, viral hepatitis serology (HBsAg, Anti-HCV), AFP, INR/platelets, triphasic CT/MRI liver if focal lesion seen.",
    inv_ar: "وظائف كبد كاملة، فيروسات كبدية (B وC)، دلالة أورام AFP، سيولة وصفائح، ومقطعية ثلاثية المراحل لو هناك بؤرة.",
    ttt_en: "Hepatology follow-up, lifestyle/metabolic management for steatosis, cirrhosis/HCC surveillance protocol.",
    ttt_ar: "متابعة باطنة/كبد، تعديل نمط الحياة للكبد الدهني، وبروتوكول متابعة التليف والبؤر الكبدية.",
  },
  ASCITES_FREE_FLUID: {
    name_en: "Ascites / Intraperitoneal Free Fluid (FAST+)", name_ar: "استسقاء / سائل حر داخل البطن (FAST+)", urgency: "CRITICAL",
    exp_en: "Anechoic free fluid collection in Morison's pouch, splenorenal recess, or pelvis; rule out hemoperitoneum in trauma.",
    exp_ar: "تجمع سائل حر داخل التجويف البريتوني — في حالات الإصابات يجب استبعاد النزيف الداخلي فورًا.",
    inv_en: "If trauma -> immediate ATLS protocol & surgical consult. If non-trauma -> diagnostic paracentesis (SAAG, PMN count >250 for SBP, culture).",
    inv_ar: "في الإصابات ← بروتوكول طوارئ ATLS وجراحة فورية. بدون إصابة ← بزل تشخيصي لحساب SAAG وخلايا الصديد لاستبعاد SBP.",
    ttt_en: "Trauma + unstable -> emergent laparotomy. Cirrhotic ascites -> salt restriction, spironolactone/furosemide, IV antibiotics if SBP.",
    ttt_ar: "نزيف داخلي مع عدم استقرار ← استكشاف جراحي عاجل. استسقاء تليفي ← مدرات البول ومضاد حيوي وريدي لو هناك التهاب بريتوني SBP.",
  },
  PANCREAS_MASS: {
    name_en: "Suspected Pancreatic Mass / Lesion", name_ar: "اشتباه كتلة بالبنكرياس", urgency: "URGENT",
    exp_en: "Focal hypoechoic pancreatic lesion on ultrasound requiring dedicated pancreatic-protocol contrast CT.",
    exp_ar: "كتلة بؤرية مشتبهة بالبنكرياس تتطلب أشعة مقطعية بالصبغة ببروتوكول البنكرياس.",
    inv_en: "Pancreatic-protocol triphasic CT abdomen, LFTs/bilirubin, CA 19-9, EUS-FNA biopsy.",
    inv_ar: "مقطعية ثلاثية المراحل على البنكرياس، وظائف كبد وصفراء، CA 19-9، ومنظار موجات صوتية EUS لأخذ عينة.",
    ttt_en: "Urgent hepatobiliary / oncology MDT referral and biliary decompression (ERCP) if obstructive jaundice.",
    ttt_ar: "تحويل عاجل لجراحة الكبد والبنكرياس والأورام مع منظار قنوات مرارية ERCP عند وجود صفراء انسدادية.",
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
  ATELECTASIS: {
    name_en: "Pulmonary Atelectasis (Volume Loss)", name_ar: "انخماص رئوي (Atelectasis)", urgency: "URGENT",
    exp_en: "Linear or lobar volume loss with ipsilateral shift of fissures/hemidiaphragm; evaluate for mucus plugging, post-op hypoventilation, or endobronchial obstruction.",
    exp_ar: "انخماص جزئي أو فصي بالرئة؛ يجب تقييم انسداد الشعب بالمخاط أو نقص التهوية بعد العمليات أو وجود انسداد داخلي.",
    inv_en: "Compare with prior CXR, SpO2/ABG, chest CT or bronchoscopy if persistent lobar collapse in a smoker.",
    inv_ar: "مقارنة بالأشعة السابقة وقياس الأكسجين، ومقطعية صدر أو منظار شعبي إذا استمر الانخماص الفصي لدى مدخن.",
    ttt_en: "Incentive spirometry, chest physiotherapy, airway clearance; treat underlying obstruction or infection.",
    ttt_ar: "تمارين التنفس العميق والعلاج الطبيعي للصدر وتنظيف مجرى الهواء وعلاج سبب الانسداد.",
  },
  INFILTRATION: {
    name_en: "Pulmonary Infiltrate (Nonspecific Airspace Opacity)", name_ar: "ارتشاح رئوي (Pulmonary Infiltrate)", urgency: "URGENT",
    exp_en: "Patchy airspace or interstitial opacity; differential includes atypical pneumonia, aspiration, pulmonary edema, or inflammatory pneumonitis.",
    exp_ar: "عتامة ارتشاحية بالرئة قد تمثل التهابًا رئويًا غير نمطي أو استنشاقًا أو احتقانًا رئويًا حسب السياق السريري.",
    inv_en: "CBC, CRP, sputum/viral panel, SpO2, follow-up CXR after treatment to confirm clearance.",
    inv_ar: "صورة دم CBC و CRP وفحص بصاق وتشبع الأكسجين، وإعادة الأشعة بعد العلاج للتأكد من الزوال.",
    ttt_en: "Directed therapy per clinical picture (empiric antibiotics if infectious vs diuresis if congestive).",
    ttt_ar: "علاج موجه حسب السياق السريري (مضادات حيوية للعدوى أو مدرات بول للاحتقان).",
  },
  EMPHYSEMA: {
    name_en: "Pulmonary Emphysema / Hyperinflation (COPD)", name_ar: "انتفاخ رئوي مزمن (Emphysema / COPD)", urgency: "ROUTINE",
    exp_en: "Hyperinflated lung fields, flattened hemidiaphragms, and increased retrosternal airspace characteristic of emphysema/COPD.",
    exp_ar: "فرط انتفاخ بالرئتين وتسطح الحجاب الحاجز بما يتماشى مع السدة الرئوية المزمنة.",
    inv_en: "Spirometry (post-bronchodilator FEV1/FVC < 0.70), ABG if hypoxic/hypercapnic, alpha-1 antitrypsin if young.",
    inv_ar: "اختبار وظائف تنفس (Spirometry)، وغازات دم ABG عند وجود نقص أكسجين أو ارتفاع ثاني أكسيد الكربون.",
    ttt_en: "Smoking cessation, inhaled bronchodilators (LAMA/LABA), controlled O2 (target 88-92% in CO2 retainers) + steroids/antibiotics during exacerbations.",
    ttt_ar: "إيقاف التدخين، موسعات شعب استنشاقية، وأكسجين مضبوط (88-92%) مع كورتيزون عند النوبات الحادة.",
  },
  FIBROSIS: {
    name_en: "Pulmonary Fibrosis / Interstitial Lung Pattern", name_ar: "تليف رئوي / نمط رئة خلالي (Fibrosis / ILD)", urgency: "ROUTINE",
    exp_en: "Reticular or honeycombing interstitial opacities suggesting chronic interstitial lung disease or post-inflammatory scarring.",
    exp_ar: "عتامات شبكية خلالية تشير إلى تليف رئوي مزمن أو ندبات التهابية قديمة.",
    inv_en: "High-Resolution Chest CT (HRCT), PFTs with DLCO, autoimmune serology (ANA, RF, anti-CCP) & occupational exposure history.",
    inv_ar: "مقطعية عالية الدقة على الصدر HRCT، وظائف تنفس مع DLCO، وتحاليل مناعية وتاريخ التعرض المهني.",
    ttt_en: "Pulmonology ILD referral for antifibrotic or immunosuppressive evaluation, pulmonary rehabilitation, vaccinations.",
    ttt_ar: "تحويل لأخصائي صدرية لتقييم مضادات التليف أو مثبطات المناعة مع التأهيل الرئوي والتطعيمات.",
  },
  PLEURAL_THICKENING: {
    name_en: "Pleural Thickening / Calcified Plaque", name_ar: "سماكة بالغشاء البلوري (Pleural Thickening)", urgency: "ROUTINE",
    exp_en: "Focal or diffuse pleural thickening along the chest wall or apex; often prior pleuritis, empyema, TB, or asbestos exposure.",
    exp_ar: "سماكة موضعية أو منتشرة بالغشاء البلوري غالبًا نتيجة التهاب قديم أو درن أو تعرض مهني.",
    inv_en: "Compare with prior films; contrast Chest CT if nodular/circumferential (>1 cm) to exclude mesothelioma or pleural malignancy.",
    inv_ar: "مقارنة بالأشعة القديمة، ومقطعية بالصبغة إذا كانت السماكة عقدية أو محيطية لاستبعاد أورام الغشاء البلوري.",
    ttt_en: "Reassurance and follow-up if stable benign plaque; thoracic oncology workup if progressive/nodular.",
    ttt_ar: "متابعة دورية إذا كانت مستقرة وحميدة، وتقييم أورام الصدر إذا كانت متزايدة أو عقدية.",
  },
  HERNIA: {
    name_en: "Hiatal / Diaphragmatic Hernia", name_ar: "فتق بالحجاب الحاجز (Hiatal Hernia)", urgency: "ROUTINE",
    exp_en: "Retrocardiac gas-fluid level or soft-tissue opacity projecting above the diaphragm.",
    exp_ar: "ظهور مستوى هوائي سائل خلف القلب يشير إلى فتق بالحجاب الحاجز.",
    inv_en: "Upper GI endoscopy (EGD) or barium swallow; urgent CT if acute severe chest/epigastric pain (rule out volvulus/strangulation).",
    inv_ar: "منظار معدة أو أشعة بالباريوم؛ ومقطعية عاجلة لو هناك ألم حاد شديد لاستبعاد اختناق الفتق.",
    ttt_en: "PPI therapy & lifestyle measures for uncomplicated GERD; surgical consultation for large paraesophageal or symptomatic hernia.",
    ttt_ar: "مثبطات مضخة البروتون PPI وتعديل نمط الأكل، واستشارة جراحية للفتق الكبير أو المصحوب بأعراض.",
  },
  ADENOCARCINOMA: {
    name_en: "Chest CT: Suspected Lung Adenocarcinoma", name_ar: "مقطعية الصدر: اشتباه سرطان رئة غدي (Adenocarcinoma)", urgency: "CRITICAL",
    exp_en: "Peripheral/subsolid or spiculated pulmonary mass pattern on Chest CT strongly suspicious for lung adenocarcinoma.",
    exp_ar: "كتلة رئوية طرفية أو مشعّعة الحواف بمقطعية الصدر تشتبه بقوة في سرطان الرئة الغدي.",
    inv_en: "Staging contrast CT Chest/Abdomen/Pelvis, PET-CT, brain MRI, CT-guided biopsy with molecular panel (EGFR, ALK, ROS1, PD-L1).",
    inv_ar: "مقطعية مراحل بالصبغة، PET-CT، رنين مخ، وعينة موجهة مع فحص الطفرات الجينية (EGFR, ALK, PD-L1).",
    ttt_en: "Urgent thoracic oncology MDT referral for surgical resection vs targeted therapy / immunotherapy.",
    ttt_ar: "تحويل عاجل لفريق أورام الصدر متعدد التخصصات لتحديد الجراحة أو العلاج الموجه والمناعي.",
  },
  SQUAMOUS_CELL_CARCINOMA: {
    name_en: "Chest CT: Suspected Squamous Cell Lung Carcinoma", name_ar: "مقطعية الصدر: اشتباه سرطان رئة حرشفي (Squamous Cell)", urgency: "CRITICAL",
    exp_en: "Central or cavitating pulmonary mass pattern on Chest CT suspicious for squamous cell carcinoma.",
    exp_ar: "كتلة رئوية مركزية أو متكهّفة بمقطعية الصدر تشتبه في سرطان الرئة الحرشفي.",
    inv_en: "Bronchoscopy with endobronchial biopsy, staging PET-CT, serum calcium (rule out PTHrP hypercalcemia), PFTs.",
    inv_ar: "منظار شعبي لأخذ عينة، مسح ذري PET-CT، كالسيوم بالدم، ووظائف تنفس.",
    ttt_en: "Urgent thoracic oncology MDT referral (surgery / chemoradiation / immunotherapy per TNM stage).",
    ttt_ar: "تحويل عاجل لفريق أورام الصدر لتحديد خطة الجراحة أو العلاج الكيماوي والإشعاعي والمناعي.",
  },
  LARGE_CELL_CARCINOMA: {
    name_en: "Chest CT: Suspected Large Cell Lung Carcinoma", name_ar: "مقطعية الصدر: اشتباه سرطان رئة كبير الخلايا (Large Cell)", urgency: "CRITICAL",
    exp_en: "Large peripheral necrotic/lobulated pulmonary mass on Chest CT suspicious for undifferentiated large cell carcinoma.",
    exp_ar: "كتلة رئوية طرفية كبيرة بمقطعية الصدر تشتبه في سرطان الرئة كبير الخلايا.",
    inv_en: "Urgent CT-guided core biopsy with immunohistochemistry, PET-CT staging, brain MRI.",
    inv_ar: "عينة نسيجية موجهة بالمقطعية مع صبغات مناعية، وPET-CT ورنين مخ لتحديد المرحلة.",
    ttt_en: "Urgent thoracic oncology MDT referral for multimodal staging and systemic/surgical treatment.",
    ttt_ar: "تحويل عاجل لفريق أورام الصدر لوضع خطة العلاج متعددة التخصصات.",
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
  if (c.includes("NOTUMOR") || c.includes("NO_TUMOR") || c.includes("NORMAL") || c.includes("NO_FINDING") || c.includes("PRESERVED_EF") || c.includes("NON_PANCREAS")) return "NO_FINDING";
  if (c.includes("ADENOCARCINOMA")) return "ADENOCARCINOMA";
  if (c.includes("SQUAMOUS")) return "SQUAMOUS_CELL_CARCINOMA";
  if (c.includes("LARGE_CELL")) return "LARGE_CELL_CARCINOMA";
  if (c.includes("CARCINOMA")) return "MASS";
  if (c.includes("PANCREAS")) return "PANCREAS_MASS";
  if (c.includes("GALLBLADDER") || c.includes("CHOLE")) return "GALLBLADDER_STONE_CHOLECYSTITIS";
  if (c.includes("HYDRONEPHROSIS") || c.includes("RENAL")) return "HYDRONEPHROSIS_RENAL_STONE";
  if (c.includes("LIVER") || c.includes("FATTY") || c.includes("CIRRHOSIS")) return "LIVER_LESION_FATTY_CIRRHOSIS";
  if (c.includes("ASCITES") || c.includes("FREE_FLUID")) return "ASCITES_FREE_FLUID";
  return c;
}

export function runHybridRadiologyDiagnosis(
  remote: RemoteRadResponse,
  ctx: RadClinicalContext,
  selectedModality?: RadModality
): RadHybridResult {
  const modality: RadModality = selectedModality || remote.detected_modality || "chest_xray";
  const safetyAlerts: RadHybridResult["safetyAlerts"] = [];

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
    if (key === "GALLBLADDER_STONE_CHOLECYSTITIS" && (ctx.symptoms.includes("ruq_pain") || ctx.fever)) boost += 0.16;
    if (key === "HYDRONEPHROSIS_RENAL_STONE" && (ctx.symptoms.includes("flank_pain") || ctx.symptoms.includes("hematuria"))) boost += 0.16;
    if (key === "ASCITES_FREE_FLUID" && (ctx.trauma || ctx.symptoms.includes("ascites"))) boost += 0.16;
    if (key === "PANCREAS_MASS" && ctx.symptoms.includes("jaundice")) boost += 0.14;

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

  // Mandatory Clinical Safety Traps
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
  if (modality === "abdomen_us" && ctx.trauma && ctx.hemodynamics === "unstable") {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Unstable Abdominal Trauma (FAST / Hemoperitoneum)",
      title_ar: "تنبيه أمان حرج — إصابة بطن مع عدم استقرار حيوي (استبعد النزيف الداخلي)",
      body_en: "Unstable blunt abdominal trauma requires immediate ATLS resuscitation and urgent surgical evaluation regardless of a single US frame.",
      body_ar: "إصابة البطن مع عدم الاستقرار الحيوي تتطلب بروتوكول ATLS واستشارة جراحية فورية بغض النظر عن لقطة سونار واحدة.",
    });
  }
  if (modality === "neuro_ct" && ctx.onset === "acute" && ctx.symptoms.includes("focal_deficit")) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Acute Stroke Window (<4.5h): Early CT Can Be Normal",
      title_ar: "تنبيه أمان حرج — نافذة السكتة الدماغية الحادة: الـ CT المبكر قد يكون طبيعيًا",
      body_en: "Non-contrast Brain CT is often normal in the first 6 hours of acute ischemic stroke. Once hemorrhage is excluded, never delay Code Stroke / CTA / IV thrombolysis evaluation.",
      body_ar: "مقطعية المخ بدون صبغة تكون طبيعية غالبًا في أول 6 ساعات من الجلطة الدماغية. بمجرد استبعاد النزيف، لا تؤخر تفعيل كود السكتة وتقييم إذابة الجلطة.",
    });
  }
  const hasHydro = items.some((i) => normalizeKey(i.code) === "HYDRONEPHROSIS_RENAL_STONE" && i.confidence >= 0.45);
  if (modality === "abdomen_us" && (hasHydro || ctx.symptoms.includes("flank_pain")) && ctx.fever) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Suspected Obstructed Infected Kidney (Pyonephrosis / Urosepsis)",
      title_ar: "تنبيه أمان حرج — اشتباه انسداد كلوي ملتهب (Pyonephrosis / إنتان بولي)",
      body_en: "Hydronephrosis or renal colic with fever is a true urological emergency: start broad-spectrum IV antibiotics and arrange urgent decompression (DJ stent or nephrostomy).",
      body_ar: "الاستسقاء الكلوي أو المغص الكلوي مع حرارة طارئ مسالك قاتل: مضادات حيوية وريدية عاجلة وتصريف فوري بدعامة DJ أو قسطرة كلوية.",
    });
  }
  if ((modality === "chest_xray" || modality === "chest_ct") && ctx.onset === "acute" && ctx.hemodynamics === "unstable" && ctx.symptoms.includes("pleuritic_pain")) {
    safetyAlerts.push({
      title_en: "CRITICAL SAFETY TRAP — Rule Out Acute Aortic Dissection",
      title_ar: "تنبيه أمان حرج — استبعد تسلخ الشريان الأورطى (Aortic Dissection)",
      body_en: "Acute severe chest pain with hemodynamic instability requires bilateral BP check and urgent CT Angiography (CTA) regardless of CXR mediastinal appearance.",
      body_ar: "ألم الصدر الحاد مع عدم الاستقرار الحيوي يستدعي قياس الضغط بالذراعين وعمل أشعة مقطعية بالصبغة على الأورطى CTA فورًا.",
    });
  }
  if ((modality === "chest_xray" || modality === "chest_ct") && ctx.immunosuppressedOrTb && (ctx.symptoms.includes("weight_loss") || ctx.symptoms.includes("hemoptysis"))) {
    safetyAlerts.push({
      title_en: "URGENT SAFETY TRAP — Suspected Active Pulmonary TB (Airborne Isolation)",
      title_ar: "تنبيه أمان عاجل — اشتباه درن رئوي نشط (عزل هوائي فوري)",
      body_en: "Initiate airborne precautions, order 3× sputum AFB smears + GeneXpert MTB/RIF, and notify infection control.",
      body_ar: "طبّق العزل الهوائي الفوري واطلب تحليل بصاق AFB + GeneXpert وأبلغ مكافحة العدوى.",
    });
  }
  if (modality === "echo" && remote.measurements?.echo_paired_ed_es === false) {
    safetyAlerts.push({
      title_en: "CLINICAL NOTE — Single-Frame Echo Limitation",
      title_ar: "ملاحظة سريرية — حدود لقطة الإيكو المفردة",
      body_en: "EF estimation from a single static frame is preliminary. Attach the End-Systolic (ES) frame above for paired contraction analysis and confirm with quantitative Simpson biplane TTE.",
      body_ar: "تقدير كفاءة القلب من لقطة ثابتة واحدة تقديري فقط؛ أرفق لقطة الانقباض (ES) للتحليل المزدوج وأكّد بإيكو كمّي كامل.",
    });
  }

  const minConf = modality === "abdomen_us" ? 0.48 : 0.35;
  const pathologies = items.filter((i) => normalizeKey(i.code) !== "NO_FINDING" && i.confidence >= minConf).sort((a, b) => b.confidence - a.confidence);
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
    similarAtlasCases: remote.similar_atlas_cases ?? [],
  };
}
