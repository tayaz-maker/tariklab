import {locationEducationLoad} from './locations.js?v=10';
export const EDUCATION_LEVEL_RANKS = { lise: 1, onlisans: 2, lisans: 3 };

export const EDUCATION_LEVEL_LABELS = {
  lise: "Lise mezunu",
  onlisans: "Ön lisans mezunu",
  lisans: "Lisans mezunu",
};

export const EDUCATION_INTENSITY_LABELS = { full: "Tam zamanlı", part: "Yarı zamanlı" };

const INTENSITY_PROGRESS = { full: 3, part: 2 };

export const EDUCATION_FIELDS = [
  { id: "technical", label: "Teknik" },
  { id: "business", label: "İşletme" },
  { id: "health", label: "Sağlık" },
  { id: "creative", label: "Yaratıcı" },
  { id: "education", label: "Eğitim" },
  { id: "law", label: "Hukuk" },
  { id: "craft", label: "Zanaat" },
  { id: "language", label: "Dil" },
];

export const EDUCATION_PATHS = [
  {
    id: "vocational_course",
    displayName: "Mesleki Eğitim Kursu",
    summary: "Kısa süreli, çalışırken sürdürülebilir teknik program.",
    grantsLevel: null,
    grantsField: "technical",
    allowedIntensity: ["full", "part"],
    targetPoints: 78,
    enrollmentFee: 1200,
    monthlyTuition: 700,
    load: {
      full: { energy: -5, stress: 4, load: 2 },
      part: { energy: -3, stress: 2, load: 1 },
    },
  },
  {
    id: "university",
    displayName: "Üniversite",
    summary: "Uzun soluklu lisans programı; bitince yeni kariyer kapısı açar.",
    grantsLevel: "lisans",
    grantsField: "business",
    allowedIntensity: ["full", "part"],
    targetPoints: 312,
    enrollmentFee: 3000,
    monthlyTuition: 1500,
    load: {
      full: { energy: -7, stress: 5, load: 3 },
      part: { energy: -4, stress: 3, load: 2 },
    },
  },
  {
    id: "associate_admin",
    displayName: "Ön lisans — Büro ve yönetim",
    summary: "Kamu ve ofis kapısını aralayan iki yıllık program.",
    grantsLevel: "onlisans",
    grantsField: "business",
    allowedIntensity: ["full", "part"],
    targetPoints: 156,
    enrollmentFee: 1800,
    monthlyTuition: 900,
    load: { full: { energy: -5, stress: 4, load: 2 }, part: { energy: -3, stress: 2, load: 1 } },
  },
  {
    id: "open_uni",
    displayName: "Açık öğretim",
    summary: "Çalışırken okunur. Diploma gelir, çevre zayıf kalır.",
    grantsLevel: "lisans",
    grantsField: "business",
    allowedIntensity: ["part"],
    targetPoints: 280,
    enrollmentFee: 800,
    monthlyTuition: 400,
    load: { part: { energy: -3, stress: 3, load: 1 } },
  },
  {
    id: "bootcamp",
    displayName: "Yazılım bootcamp",
    summary: "Yoğun, pahalı, iş garantisi yok. Teknik alan açar.",
    grantsLevel: null,
    grantsField: "technical",
    allowedIntensity: ["full", "part"],
    targetPoints: 90,
    enrollmentFee: 4500,
    monthlyTuition: 2200,
    load: { full: { energy: -8, stress: 7, load: 3 }, part: { energy: -5, stress: 4, load: 2 } },
  },
  {
    id: "language_course",
    displayName: "Dil kursu",
    summary: "Kapı değil, eik. Yurtdışı ve bazı ofis işlerini kolaylaştırır.",
    grantsLevel: null,
    grantsField: "language",
    allowedIntensity: ["full", "part"],
    targetPoints: 60,
    enrollmentFee: 1600,
    monthlyTuition: 800,
    load: { full: { energy: -4, stress: 3, load: 2 }, part: { energy: -2, stress: 2, load: 1 } },
  },
  {
    id: "driving_license",
    displayName: "Ehliyet ve yetki belgesi",
    summary: "Lojistik ve saha işleri için kâğıt.",
    grantsLevel: null,
    grantsField: "craft",
    allowedIntensity: ["full"],
    targetPoints: 24,
    enrollmentFee: 3500,
    monthlyTuition: 0,
    load: { full: { energy: -4, stress: 2, load: 1 } },
  },
  {
    id: "apprentice_path",
    displayName: "Çıraklık / ustalık",
    summary: "Tezgâh öğretir. Diploma değil, meslek verir.",
    grantsLevel: null,
    grantsField: "craft",
    allowedIntensity: ["full", "part"],
    targetPoints: 120,
    enrollmentFee: 600,
    monthlyTuition: 200,
    load: { full: { energy: -6, stress: 3, load: 2 }, part: { energy: -3, stress: 2, load: 1 } },
  },
  {
    id: "health_support",
    displayName: "Sağlık destek meslek kursu",
    summary: "Hasta bakımı ve eczane teknisyenliği kapısı.",
    grantsLevel: null,
    grantsField: "health",
    allowedIntensity: ["full", "part"],
    targetPoints: 96,
    enrollmentFee: 2200,
    monthlyTuition: 1100,
    load: { full: { energy: -6, stress: 5, load: 2 }, part: { energy: -4, stress: 3, load: 1 } },
  },
  {
    id: "nursing_assoc",
    displayName: "Ön lisans — Hemşirelik",
    summary: "Nöbet ve evrak. Diploma iş değil, ehliyet gibi.",
    grantsLevel: "onlisans",
    grantsField: "health",
    allowedIntensity: ["full"],
    targetPoints: 200,
    enrollmentFee: 2800,
    monthlyTuition: 1300,
    load: { full: { energy: -7, stress: 6, load: 3 } },
  },
  {
    id: "sales_cert",
    displayName: "Satış ve pazarlama sertifikası",
    summary: "Hedef konuşmayı öğretir. Müşteri getirmez.",
    grantsLevel: null,
    grantsField: "business",
    allowedIntensity: ["full", "part"],
    targetPoints: 48,
    enrollmentFee: 1400,
    monthlyTuition: 600,
    load: { full: { energy: -4, stress: 4, load: 1 }, part: { energy: -2, stress: 2, load: 1 } },
  },
  {
    id: "accounting_cert",
    displayName: "Muhasebe ve ofis programı",
    summary: "Beyanname korkusunu azaltır.",
    grantsLevel: null,
    grantsField: "business",
    allowedIntensity: ["full", "part"],
    targetPoints: 72,
    enrollmentFee: 1800,
    monthlyTuition: 750,
    load: { full: { energy: -5, stress: 4, load: 2 }, part: { energy: -3, stress: 3, load: 1 } },
  },
  {
    id: "kpss_prep",
    displayName: "Kamu sınavı hazırlığı",
    summary: "Kadroyu vaat etmez. Yalnız sınava oturtur.",
    grantsLevel: null,
    grantsField: "education",
    allowedIntensity: ["full", "part"],
    targetPoints: 84,
    enrollmentFee: 2000,
    monthlyTuition: 900,
    load: { full: { energy: -6, stress: 6, load: 2 }, part: { energy: -4, stress: 4, load: 1 } },
  },
  {
    id: "law_faculty",
    displayName: "Hukuk fakültesi",
    summary: "Uzun, pahalı, staj ayrı kapı.",
    grantsLevel: "lisans",
    grantsField: "law",
    allowedIntensity: ["full", "part"],
    targetPoints: 360,
    enrollmentFee: 4000,
    monthlyTuition: 1800,
    load: { full: { energy: -7, stress: 6, load: 3 }, part: { energy: -4, stress: 4, load: 2 } },
  },
  {
    id: "edu_faculty",
    displayName: "Eğitim fakültesi",
    summary: "Sınıf kapısı. Atama başka masada.",
    grantsLevel: "lisans",
    grantsField: "education",
    allowedIntensity: ["full", "part"],
    targetPoints: 300,
    enrollmentFee: 2600,
    monthlyTuition: 1200,
    load: { full: { energy: -6, stress: 5, load: 3 }, part: { energy: -4, stress: 3, load: 2 } },
  },
  {
    id: "creative_school",
    displayName: "Tasarım / medya atölyesi",
    summary: "Portföy üretir. Maaş vaat etmez.",
    grantsLevel: null,
    grantsField: "creative",
    allowedIntensity: ["full", "part"],
    targetPoints: 88,
    enrollmentFee: 2400,
    monthlyTuition: 1000,
    load: { full: { energy: -5, stress: 4, load: 2 }, part: { energy: -3, stress: 3, load: 1 } },
  },
  {
    id: "tech_uni",
    displayName: "Mühendislik / lisans teknik",
    summary: "Uzun lisans. Şantiye ve yazılım kapısı.",
    grantsLevel: "lisans",
    grantsField: "technical",
    allowedIntensity: ["full", "part"],
    targetPoints: 336,
    enrollmentFee: 3500,
    monthlyTuition: 1600,
    load: { full: { energy: -7, stress: 6, load: 3 }, part: { energy: -4, stress: 4, load: 2 } },
  },
  {
    id: "masters_work",
    displayName: "Çalışırken yüksek lisans",
    summary: "Unvan ister, uyku yer. Geç öder.",
    grantsLevel: "lisans",
    grantsField: "business",
    allowedIntensity: ["part"],
    targetPoints: 160,
    enrollmentFee: 5000,
    monthlyTuition: 2400,
    load: { part: { energy: -5, stress: 5, load: 2 } },
  },
];

export const CAREER_BANDS = [
  { id: "entry", label: "Başlangıç", minWeeks: 0 },
  { id: "experienced", label: "Deneyimli", minWeeks: 24 },
  { id: "senior", label: "Kıdemli", minWeeks: 72 },
];

export const JOB_FAMILY_LABELS = {
  hizmet: "Hizmet",
  ofis: "Ofis",
  yemeicme: "Yeme-içme",
  guvenlik: "Güvenlik",
  uretim: "Üretim",
  lojistik: "Lojistik",
  ticaret: "Ticaret",
  saglik: "Sağlık",
  egitim: "Eğitim",
  kamu: "Kamu",
  medya: "Medya",
  eglence: "Eğlence",
  freelance: "Serbest",
  hukuk: "Hukuk",
};

export const getPathById = (pathId) => EDUCATION_PATHS.find((path) => path.id === pathId) || null;

export const getFieldLabel = (fieldId) =>
  EDUCATION_FIELDS.find((field) => field.id === fieldId)?.label || fieldId;

export const isEducationLevel = (level) =>
  typeof level === "string" && Object.hasOwn(EDUCATION_LEVEL_RANKS, level);

export const eduRank = (level) => EDUCATION_LEVEL_RANKS[level] || 0;

export const getEducationLevelLabel = (level) => EDUCATION_LEVEL_LABELS[level] || "Bilinmiyor";

export const getIntensityLabel = (intensity) => EDUCATION_INTENSITY_LABELS[intensity] || intensity;

export const getWeeklyProgressGain = (intensity) => INTENSITY_PROGRESS[intensity] || 0;

/**
 * Bir program tamamlandığında seviyenin ne olacağı. Seviye yalnız yukarı gider:
 * daha düşük seviye veren bir program mevcut diplomayı düşüremez.
 */
export function resolveCompletedLevel(currentLevel, grantsLevel) {
  if (!grantsLevel) return currentLevel;
  return eduRank(grantsLevel) > eduRank(currentLevel) ? grantsLevel : currentLevel;
}

/** Bir programın o yoğunlukta kaç hafta süreceği. Arayüz süreyi burada hesaplatır. */
export function getPathDurationWeeks(path, intensity) {
  const gain = getWeeklyProgressGain(intensity);
  return gain > 0 && path ? Math.ceil(path.targetPoints / gain) : 0;
}

export function getPathIntensityLoad(path, intensity) {
  return path?.load?.[intensity] || { energy: 0, stress: 0, load: 0 };
}

export function isValidActiveEducation(active) {
  if (!active || typeof active !== "object" || Array.isArray(active)) return false;
  const path = getPathById(active.pathId);
  if (!path) return false;
  if (!path.allowedIntensity.includes(active.intensity)) return false;
  return (
    Number.isInteger(active.progressPoints) &&
    active.progressPoints >= 0 &&
    active.progressPoints <= path.targetPoints
  );
}

export function getFamilyExperience(state, familyId) {
  const value = state?.career?.jobFamilyExperience?.[familyId];
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function getCareerBand(weeks) {
  const safe = Number.isInteger(weeks) && weeks >= 0 ? weeks : 0;
  let band = CAREER_BANDS[0];
  for (const candidate of CAREER_BANDS) if (safe >= candidate.minWeeks) band = candidate;
  return band;
}

export function getEducationWeeklyLoad(state) {
  const active = state?.education?.active;
  if (!active) return { energy: 0, stress: 0, load: 0 };
  const base=getPathIntensityLoad(getPathById(active.pathId), active.intensity);
  const travel=locationEducationLoad(state);
  return {...base,load:base.load+travel,energy:base.energy-travel*2,stress:base.stress+travel};
}

export function getEducationProgress(state) {
  const active = state?.education?.active;
  const path = active ? getPathById(active.pathId) : null;
  if (!active || !path) return null;
  const gain = getWeeklyProgressGain(active.intensity);
  const remainingPoints = Math.max(0, path.targetPoints - active.progressPoints);
  return {
    path,
    intensity: active.intensity,
    points: active.progressPoints,
    targetPoints: path.targetPoints,
    percent: Math.min(100, Math.round((active.progressPoints / path.targetPoints) * 100)),
    remainingWeeks: gain > 0 ? Math.ceil(remainingPoints / gain) : 0,
    weeklyLoad: getEducationWeeklyLoad(state),
  };
}

export function isEligibleForJob(state, job) {
  if (!job) return { ok: false, reason: "İş tanımı bulunamadı." };
  if (job.since && state.time.year < job.since)
    return { ok: false, reason: `${job.since} öncesinde bu meslek bu senaryonun iş piyasasında yok.` };
  if (state?.career?.retirement?.status === "retired")
    return { ok: false, reason: "Emeklilikten sonra normal iş teklifleri kapalı." };
  if (job.requiredEducation && eduRank(state.education?.level) < eduRank(job.requiredEducation))
    return {
      ok: false,
      reason: `${getEducationLevelLabel(job.requiredEducation)} olman gerekiyor.`,
    };
  if (job.requiredField && !(state.education?.fields || []).includes(job.requiredField))
    return { ok: false, reason: `${getFieldLabel(job.requiredField)} alanında eğitim gerekiyor.` };
  if (job.requiredExperienceWeeks) {
    const current = getFamilyExperience(state, job.family);
    if (current < job.requiredExperienceWeeks)
      return {
        ok: false,
        reason: `${JOB_FAMILY_LABELS[job.family] || job.family} alanında ${job.requiredExperienceWeeks} hafta deneyim gerekiyor (${current} hafta).`,
      };
  }
  return { ok: true, reason: "" };
}

export function describeJobRequirements(job) {
  const parts = [];
  if (job.requiredEducation) parts.push(getEducationLevelLabel(job.requiredEducation));
  if (job.requiredField) parts.push(`${getFieldLabel(job.requiredField)} alanı`);
  if (job.requiredExperienceWeeks)
    parts.push(
      `${JOB_FAMILY_LABELS[job.family] || job.family} alanında ${job.requiredExperienceWeeks} hafta deneyim`,
    );
  return parts.length ? parts.join(" · ") : "Gereksinim yok";
}
