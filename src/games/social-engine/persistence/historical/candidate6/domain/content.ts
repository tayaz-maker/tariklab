import type { Job } from "./types.ts";

export const ENGINE_VERSION = "1.0.0-candidate.6";
export const SCHEMA_VERSION = 7;
export const RULES_VERSION = "social-engine-rules-7";
export const SIM_STEP_MS = 100;
export const TICKS_PER_MINUTE = 10;
export const MINUTES_PER_DAY = 1440;
export const LOCAL_POPULATION = 100;
export const BACKGROUND_POPULATION = 1000;
export const JOBS: Job[] = [
  {
    id: "retail",
    name: "Market görevlisi",
    businessId: "market",
    skill: "trade",
    wage: 9500,
    duration: 60,
  },
  {
    id: "courier",
    name: "Kurye",
    businessId: "warehouse",
    skill: "driving",
    wage: 11500,
    duration: 60,
  },
  {
    id: "taxi",
    name: "Taksi şoförü",
    businessId: "taxi",
    skill: "driving",
    wage: 13500,
    duration: 60,
  },
  {
    id: "waiter",
    name: "Çayevi garsonu",
    businessId: "tea",
    skill: "communication",
    wage: 10500,
    duration: 60,
  },
  {
    id: "mechanic",
    name: "Tamirci",
    businessId: "garage",
    skill: "technical",
    wage: 14500,
    duration: 60,
  },
  {
    id: "warehouse",
    name: "Depo görevlisi",
    businessId: "warehouse",
    skill: "body",
    wage: 12000,
    duration: 60,
  },
  {
    id: "office",
    name: "Ofis asistanı",
    businessId: "office",
    skill: "academic",
    wage: 15500,
    duration: 60,
  },
  {
    id: "security",
    name: "Güvenlik görevlisi",
    businessId: "police",
    skill: "discipline",
    wage: 14000,
    duration: 60,
  },
  {
    id: "teaching",
    name: "Eğitim asistanı",
    businessId: "school",
    skill: "academic",
    wage: 17000,
    duration: 60,
  },
  {
    id: "sales",
    name: "Satış danışmanı",
    businessId: "bank",
    skill: "trade",
    wage: 12500,
    duration: 60,
  },
];
export const ITEMS: Record<
  string,
  { name: string; price: number; hunger: number; health: number; weight: number }
> = {
  simit: { name: "Simit", price: 1800, hunger: 25, health: 0, weight: 1 },
  tea: { name: "Çay", price: 1200, hunger: 8, health: 0, weight: 1 },
  meal: { name: "Ev yemeği", price: 7500, hunger: 65, health: 5, weight: 2 },
  medicine: { name: "İlk yardım kiti", price: 9500, hunger: 0, health: 45, weight: 1 },
  parts: { name: "Yedek parça", price: 5500, hunger: 0, health: 0, weight: 3 },
  book: { name: "Kurs kitabı", price: 4200, hunger: 0, health: 0, weight: 2 },
};
export const FIRST_NAMES = [
  "Deniz",
  "Ece",
  "Mert",
  "Selin",
  "Cem",
  "Derya",
  "Bora",
  "İpek",
  "Can",
  "Aslı",
  "Ozan",
  "Elif",
  "Arda",
  "Aylin",
  "Kerem",
  "Defne",
  "Umut",
  "Seda",
  "Onur",
  "Leyla",
];
export const LAST_NAMES = [
  "Yel",
  "Koru",
  "Acar",
  "Durul",
  "Ilgın",
  "Sarp",
  "Kıyı",
  "Aksoy",
  "Demir",
  "Çınar",
  "Eren",
  "Arın",
];
export const FACTIONS = [
  { id: "dock", name: "Rıhtım Dayanışması", approach: "Mahalle esnafını bir arada tutar." },
  { id: "hill", name: "Yokuş Birliği", approach: "Kuryeler ve genç çalışanların sözünü taşır." },
  { id: "night", name: "Gece Masası", approach: "Borcun ve nüfuzun tehlikeli tarafında durur." },
];
export type EventKind =
  | "job_offer"
  | "late_wage"
  | "layoff"
  | "promotion"
  | "rent_rise"
  | "loan_due"
  | "price_shock"
  | "shortage"
  | "delivery"
  | "vehicle_breakdown"
  | "traffic_jam"
  | "lost_item"
  | "neighbor_help"
  | "friend_invite"
  | "relationship_dispute"
  | "scholarship"
  | "neighborhood_argument"
  | "witness_report"
  | "police_check"
  | "faction_truce";
export type EventTemplate = {
  kind: EventKind;
  title: string;
  trigger: string;
  preconditions: string[];
  cooldownMinutes: number;
  participantRoles: string[];
  requiredLocation: string;
  choices: string[];
  effects: string[];
  expiryMinutes: number;
  fallback: string;
  reward: number;
};
const event = (
  kind: EventKind,
  title: string,
  trigger: string,
  location: string,
  effects: string[],
  reward: number,
): EventTemplate => ({
  kind,
  title,
  trigger,
  preconditions: ["living-participant", "reachable-location", "funded-reward"],
  cooldownMinutes: 1440,
  participantRoles: ["issuer", "helper"],
  requiredLocation: location,
  choices: ["accept", "decline"],
  effects,
  expiryMinutes: 720,
  fallback: "expire-and-release-reservation",
  reward,
});
export const EVENT_TEMPLATES: EventTemplate[] = [
  event(
    "job_offer",
    "Çarşıda bir yer açıldı",
    "open-employer-vacancy",
    "market",
    ["employment", "reference"],
    4000,
  ),
  event(
    "late_wage",
    "Geciken zarf",
    "distressed-employer",
    "garage",
    ["payroll-arrears", "trust"],
    6500,
  ),
  event("layoff", "Kapanan vardiya", "closed-employer", "office", ["job-loss", "retraining"], 7000),
  event("promotion", "Bir adım yukarı", "skill-earned", "office", ["wage", "responsibility"], 6000),
  event(
    "rent_rise",
    "Apartman toplantısı",
    "weekly-rent-review",
    "home",
    ["rent", "mediation"],
    5500,
  ),
  event("loan_due", "Vadesi gelen söz", "outstanding-loan", "bank", ["debt", "reputation"], 5000),
  event(
    "price_shock",
    "Çarşıdaki dalga",
    "weekly-stock-review",
    "market",
    ["prices", "trade"],
    6000,
  ),
  event("shortage", "Rafın eksik parçası", "low-stock", "garage", ["stock", "sales"], 8500),
  event(
    "delivery",
    "Rıhtıma bir paket",
    "reserved-inventory",
    "warehouse",
    ["delivery", "income"],
    8000,
  ),
  event(
    "vehicle_breakdown",
    "Yolda kalan usta",
    "vehicle-wear",
    "garage",
    ["repair", "technical"],
    9000,
  ),
  event(
    "traffic_jam",
    "Dar sokakta düğüm",
    "lane-congestion",
    "taxi",
    ["traffic", "goodwill"],
    5000,
  ),
  event("lost_item", "Tezgâhta unutulan", "public-item-found", "tea", ["ownership", "trust"], 4500),
  event(
    "neighbor_help",
    "Komşunun yükü",
    "household-need",
    "home",
    ["belonging", "reputation"],
    4500,
  ),
  event(
    "friend_invite",
    "Bir çaylık zaman",
    "positive-relationship",
    "tea",
    ["affection", "fatigue"],
    3500,
  ),
  event(
    "relationship_dispute",
    "Kırgın iki komşu",
    "low-trust",
    "restaurant",
    ["mediation", "resentment"],
    6500,
  ),
  event(
    "scholarship",
    "Açık ders",
    "education-opportunity",
    "school",
    ["academic", "certificate"],
    5000,
  ),
  event(
    "neighborhood_argument",
    "Sokaktaki sesler",
    "local-conflict",
    "market",
    ["fear", "trust"],
    6500,
  ),
  event(
    "witness_report",
    "Gördüğünü söyle",
    "witnessed-crime",
    "police",
    ["evidence", "justice"],
    7500,
  ),
  event("police_check", "Rıhtım kontrolü", "reported-incident", "police", ["case", "safety"], 4000),
  event(
    "faction_truce",
    "Aynı masaya oturmak",
    "influence-dispute",
    "restaurant",
    ["influence", "truce"],
    10000,
  ),
];
