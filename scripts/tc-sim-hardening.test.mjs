import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { getEventDefinition, resolveEvent } from "../public/games/tc-sim/js/events.js";
import { advanceWeek } from "../public/games/tc-sim/js/time.js";
import {
  acceptJobOffer,
  enrollEducation,
  moveHome,
  stopEducation,
} from "../public/games/tc-sim/js/life.js";
import { getJobById } from "../public/games/tc-sim/js/catalog.js";
import {
  EDUCATION_PATHS,
  getCareerBand,
  getPathById,
  getPathDurationWeeks,
  getWeeklyProgressGain,
  isEligibleForJob,
  resolveCompletedLevel,
} from "../public/games/tc-sim/js/education.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }
  getItem(key) {
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    this.data.set(key, String(value));
  }
  removeItem(key) {
    this.data.delete(key);
  }
}

const fresh = () => createNewGame({ name: "HRD", seed: 3, now: "2027-01-01T00:00:00.000Z" });
const settle = (state) => {
  let guard = 0;
  while (state.events.active && guard++ < 50) {
    const definition = getEventDefinition(state.events.active.eventId);
    resolveEvent(state, definition.choices[0].id);
  }
};
const runWeeks = (state, count) => {
  for (let index = 0; index < count; index += 1) {
    settle(state);
    assert.equal(advanceWeek(state).ok, true);
    settle(state);
  }
};

// ------------------------------------------------- tuition borcu monotonik

test("1. ay içinde ucuz programa geçmek o ayın eğitim borcunu düşüremez", () => {
  const state = fresh();
  state.finances.balance = 100000;
  enrollEducation(state, "university", "full");
  runWeeks(state, 1);
  const expensive = state.education.tuitionOwedThisMonth;
  assert.equal(expensive, getPathById("university").monthlyTuition);

  assert.equal(stopEducation(state).ok, true);
  assert.equal(enrollEducation(state, "vocational_course", "full").ok, true);
  runWeeks(state, 1);
  assert.equal(state.education.tuitionOwedThisMonth, expensive);
});

test("2. pahalı programa geçmek o ayın borcunu yükseltir", () => {
  const state = fresh();
  state.finances.balance = 100000;
  enrollEducation(state, "vocational_course", "full");
  runWeeks(state, 1);
  const cheap = state.education.tuitionOwedThisMonth;
  assert.equal(stopEducation(state).ok, true);
  assert.equal(enrollEducation(state, "university", "full").ok, true);
  runWeeks(state, 1);
  assert.equal(state.education.tuitionOwedThisMonth, getPathById("university").monthlyTuition);
  assert.equal(state.education.tuitionOwedThisMonth > cheap, true);
});

test("3. hiç ilerleme olmadan bırakılan kayıt eğitim borcu doğurmaz", () => {
  const state = fresh();
  state.finances.balance = 100000;
  enrollEducation(state, "university", "full");
  assert.equal(stopEducation(state).ok, true);
  runWeeks(state, 4);
  assert.equal(
    state.finances.ledger.some((entry) => entry.reason === "Eğitim ücreti"),
    false,
  );
});

test("4. kayıt/bırakma döngüsü yalnız para kaybettirir, ilerleme kazandırmaz", () => {
  const state = fresh();
  state.finances.balance = 100000;
  const before = state.finances.balance;
  for (let round = 0; round < 5; round += 1) {
    enrollEducation(state, "vocational_course", "full");
    stopEducation(state);
  }
  assert.equal(state.education.active, null);
  assert.equal(state.finances.balance, before - 5 * getPathById("vocational_course").enrollmentFee);
  assert.equal(state.weekly.used, 0);
});

// ------------------------------------------------------- kayıt kurtarma

test("5. career nesnesi tamamen kayıp bir kayıt çöpe atılmadan onarılır", () => {
  const raw = JSON.parse(JSON.stringify(fresh()));
  raw.finances.balance = 4321;
  raw.household.homeId = "shared";
  delete raw.career;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.career.jobId, null);
  assert.equal(migrated.state.career.pendingJob, null);
  assert.deepEqual(migrated.state.career.jobFamilyExperience, {});
  // Kaydın geri kalanı korunur.
  assert.equal(migrated.state.finances.balance, 4321);
  assert.equal(migrated.state.household.homeId, "shared");
  assert.equal(validateState(migrated.state).ok, true);
});

test("6. zengin v3 kaydı hiçbir eski alanı kaybetmeden v4'e taşınır", () => {
  const raw = JSON.parse(JSON.stringify(fresh()));
  raw.meta.saveVersion = 3;
  delete raw.education;
  delete raw.career.jobFamilyExperience;
  raw.career.jobId = "office";
  raw.career.pendingJob = null;
  raw.finances.balance = 54321;
  raw.finances.otherMonthlyIncome = 250;
  raw.finances.otherMonthlyExpenses = 4800;
  raw.finances.ledger = [{ week: 3, amount: -120, reason: "eski", category: "other" }];
  raw.household = { homeId: "studio", livingWithFamily: false };
  raw.health = { energy: 44, stress: 61, health: 73 };
  raw.time = { year: 2029, month: 7, weekOfMonth: 3, absoluteWeek: 111 };
  raw.player.age = 20;
  raw.relationships = { anne: 81, baba: 40, mehmet: 12, elif: 55 };
  raw.people[0].memories.push({ week: 9, year: 2027, text: "eski anne hatırası" });
  raw.people[2].memories.push({ week: 12, year: 2027, text: "eski mehmet hatırası" });
  raw.memories.push({
    id: "m-1",
    week: 5,
    year: 2027,
    text: "eski hayat kaydı",
    importance: "important",
  });
  raw.openCases.push({
    id: "loan-5",
    type: "friend-loan",
    createdWeek: 5,
    dueWeek: 9,
    eventId: "loan_repayment",
    status: "pending",
  });
  raw.yearlyHistory.push({
    year: 2027,
    startingBalance: 5000,
    endingBalance: 9000,
    importantMemories: ["bir şey"],
    relationships: {},
  });
  raw.flags = { helpedFriend: true, overtimeStreak: 2 };
  raw.events.seen = ["family_budget_talk"];
  raw.events.cooldowns = { job_pressure: 40 };

  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  const s = migrated.state;
  assert.equal(s.meta.saveVersion, SAVE_VERSION);
  assert.equal(s.career.jobId, "office");
  assert.equal(s.finances.balance, 54321);
  assert.equal(s.finances.otherMonthlyIncome, 250);
  assert.equal(s.finances.otherMonthlyExpenses, 4800);
  assert.equal(s.finances.ledger.length, 1);
  assert.equal(s.household.homeId, "studio");
  assert.deepEqual(s.health, { energy: 44, stress: 61, health: 73 });
  assert.equal(s.time.absoluteWeek, 111);
  assert.equal(s.player.age, 20);
  // Eski kaydın dört ilişkisi olduğu gibi korunur; "kardes" göçle eklenen
  // modellenmiş kardeştir (alan kaybı değil, alan kazancı).
  assert.deepEqual(s.relationships, { anne: 81, baba: 40, mehmet: 12, elif: 55, kardes: 44 });
  assert.equal(s.people[0].memories.length, 1);
  assert.equal(s.people[2].memories.length, 1);
  assert.equal(s.memories.length, 1);
  assert.equal(s.openCases.length, 1);
  assert.equal(s.yearlyHistory.length, 1);
  assert.equal(s.flags.helpedFriend, true);
  assert.deepEqual(s.events.seen, ["family_budget_talk"]);
  assert.deepEqual(s.events.cooldowns, { job_pressure: 40 });
  assert.equal(s.world.eraId, "present_day");
  // Yeni alanlar güvenli varsayılan alır.
  assert.equal(s.education.level, "lise");
  assert.deepEqual(s.career.jobFamilyExperience, {});
});

test("7. bozuk kayıt tekrar tekrar migrate edilse de aynı güvenli state'e oturur", () => {
  const raw = JSON.parse(JSON.stringify(fresh()));
  raw.meta.saveVersion = 3;
  raw.education = {
    level: "doktora",
    fields: "teknik",
    active: { pathId: "yok", intensity: "z", progressPoints: Number.NaN },
    tuitionOwedThisMonth: -9,
  };
  raw.career.jobFamilyExperience = { hizmet: Number.POSITIVE_INFINITY, ofis: 2.5 };
  let current = migrateState(raw);
  assert.equal(current.ok, true);
  const first = JSON.stringify(current.state.education);
  for (let round = 0; round < 3; round += 1) {
    current = migrateState(JSON.parse(JSON.stringify(current.state)));
    assert.equal(current.ok, true);
    assert.equal(JSON.stringify(current.state.education), first);
  }
  assert.deepEqual(current.state.career.jobFamilyExperience, { hizmet: 0, ofis: 0 });
});

// ------------------------------------------------------- zaman sınırları

test("8. ay ve yıl dönümü gelir/gider/eğitim ücretini tam bir kez işler", () => {
  const state = fresh();
  state.finances.balance = 100000;
  enrollEducation(state, "university", "part");
  runWeeks(state, 48); // tam 12 ay
  const tuition = state.finances.ledger.filter((entry) => entry.reason === "Eğitim ücreti");
  const weeks = tuition.map((entry) => entry.week);
  assert.equal(new Set(weeks).size, weeks.length, "aynı haftada iki tahsilat olamaz");
  assert.equal(state.time.year, 2028);
  assert.equal(state.time.month, 1);
  assert.equal(state.time.weekOfMonth, 1);
  assert.equal(state.player.age, 19);
  assert.equal(state.yearlyHistory.length, 1);
  assert.equal(validateState(state).ok, true);
});

test("9. haftalık zaman bütçesi her hafta sıfırlanır ve altıyı aşmaz", () => {
  const state = fresh();
  state.finances.balance = 100000;
  assert.equal(moveHome(state, "studio").ok, true);
  assert.equal(moveHome(state, "shared").ok, true);
  assert.equal(state.weekly.used, 2);
  assert.equal(moveHome(state, "family").ok, true);
  state.weekly.used = 6;
  assert.equal(moveHome(state, "studio").ok, false);
  runWeeks(state, 1);
  assert.equal(state.weekly.used, 0);
});

// ----------------------------------------------------- tek doğruluk kaynağı

test("10. program süresi tek kaynaktan türetilir", () => {
  for (const path of EDUCATION_PATHS) {
    for (const intensity of path.allowedIntensity) {
      const gain = getWeeklyProgressGain(intensity);
      assert.equal(getPathDurationWeeks(path, intensity), Math.ceil(path.targetPoints / gain));
      // Süre gerçekten o kadar hafta sürmeli.
      const state = fresh();
      state.finances.balance = 500000;
      enrollEducation(state, path.id, intensity);
      runWeeks(state, getPathDurationWeeks(path, intensity));
      assert.equal(state.education.active, null, `${path.id}/${intensity} süresinde bitmedi`);
    }
  }
});

test("11. tamamlanan eğitim seviyeyi asla düşürmez", () => {
  // Bugünkü veride daha düşük seviye veren bir program yok; kural yine de
  // doğrudan sınanır ki ileride böyle bir yol eklendiğinde diploma düşmesin.
  assert.equal(resolveCompletedLevel("lise", "lisans"), "lisans");
  assert.equal(resolveCompletedLevel("lisans", "onlisans"), "lisans");
  assert.equal(resolveCompletedLevel("lisans", "lise"), "lisans");
  assert.equal(resolveCompletedLevel("lisans", "lisans"), "lisans");
  assert.equal(resolveCompletedLevel("onlisans", "lisans"), "lisans");
  assert.equal(resolveCompletedLevel("lisans", null), "lisans");
  assert.equal(resolveCompletedLevel("lise", null), "lise");
  // Gerçek akışta da: lisans sahibi kursu bitirince lisans kalır.
  const state = fresh();
  state.finances.balance = 100000;
  state.education.level = "lisans";
  enrollEducation(state, "vocational_course", "full");
  runWeeks(state, getPathDurationWeeks(getPathById("vocational_course"), "full"));
  assert.equal(state.education.level, "lisans");
  assert.deepEqual(state.education.fields, ["technical"]);
});

// --------------------------------------------------------- 3B kazanım zinciri

test("12. eğitim → uygunluk → teklif → geçiş → maaş farkı zinciri uçtan uca çalışır", () => {
  const state = fresh();
  state.finances.balance = 100000;
  const startingSalary = getJobById(state.career.jobId).salary;

  // 1) Başlangıçta üst iş kilitli.
  assert.equal(isEligibleForJob(state, getJobById("specialist")).ok, false);
  assert.equal(acceptJobOffer(state, "specialist").ok, false);

  // 2) Üniversiteyi bitir.
  assert.equal(enrollEducation(state, "university", "full").ok, true);
  runWeeks(state, getPathDurationWeeks(getPathById("university"), "full"));
  assert.equal(state.education.level, "lisans");
  assert.equal(state.education.fields.includes("business"), true);

  // 3) Deneyim de birikmiş olmalı (paralel çalışma).
  assert.equal(getCareerBand(state.career.jobFamilyExperience.hizmet).id, "senior");

  // 4) Üst iş artık açık ve teklif kabul edilebilir.
  assert.equal(isEligibleForJob(state, getJobById("specialist")).ok, true);
  assert.equal(acceptJobOffer(state, "specialist").ok, true);
  assert.equal(state.career.pendingJob.jobId, "specialist");

  // 5) Gecikmeli başlangıç bir hafta sonra gerçekleşir.
  runWeeks(state, 1);
  assert.equal(state.career.jobId, "specialist");
  assert.equal(state.career.pendingJob, null);

  // 6) Maaş gerçekten yükselmiş olmalı.
  const finalSalary = getJobById(state.career.jobId).salary;
  assert.equal(finalSalary > startingSalary, true);

  // 7) Yeni işin ilk ayı yeni maaşla kapanır.
  const before = state.finances.balance;
  runWeeks(state, 4);
  assert.equal(state.finances.balance > before, true);
  assert.equal(validateState(state).ok, true);
});

test("13. yeni karakter kilitlenmez: giriş işleri ve bir eğitim yolu erişilebilir", () => {
  const state = fresh();
  for (const jobId of ["market", "courier", "office"])
    assert.equal(isEligibleForJob(state, getJobById(jobId)).ok, true, jobId);
  // Başlangıç bakiyesiyle en az bir programa kaydolabilmeli.
  const affordable = EDUCATION_PATHS.filter((path) => path.enrollmentFee <= state.finances.balance);
  assert.equal(affordable.length > 0, true);
  assert.equal(enrollEducation(state, affordable[0].id, "part").ok, true);
});

test("14. migrate edilen eski oyuncu işini ve oynanabilirliğini korur", () => {
  const raw = JSON.parse(JSON.stringify(fresh()));
  raw.meta.saveVersion = 3;
  delete raw.education;
  delete raw.career.jobFamilyExperience;
  raw.career.jobId = "courier";
  raw.finances.balance = 15000;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  const state = migrated.state;
  // Eski işinden atılmaz.
  assert.equal(state.career.jobId, "courier");
  assert.equal(isEligibleForJob(state, getJobById("courier")).ok, true);
  // Oyun ilerlemeye devam eder ve deneyim migration haftasından itibaren birikir.
  runWeeks(state, 3);
  assert.equal(state.career.jobFamilyExperience.hizmet, 3);
  assert.equal(validateState(state).ok, true);
});

// ------------------------------------------------------------ dayanıklılık

test("15. 260 hafta boyunca state invariantları korunur", () => {
  const storage = new MemoryStorage();
  let state = fresh();
  for (let week = 0; week < 260; week += 1) {
    if (week === 10) enrollEducation(state, "vocational_course", "part");
    if (week === 120) acceptJobOffer(state, "office");
    runWeeks(state, 1);
    const validation = validateState(state);
    assert.equal(validation.ok, true, validation.errors.join("; "));
    const active = state.education.active;
    if (active) {
      const path = getPathById(active.pathId);
      assert.equal(Number.isInteger(active.progressPoints), true);
      assert.equal(active.progressPoints >= 0 && active.progressPoints <= path.targetPoints, true);
    }
    let total = 0;
    for (const weeks of Object.values(state.career.jobFamilyExperience)) {
      assert.equal(Number.isInteger(weeks) && weeks >= 0, true);
      total += weeks;
    }
    assert.equal(total <= state.time.absoluteWeek, true);
    if (week % 26 === 0) {
      assert.equal(saveGame(storage, state).ok, true);
      const loaded = loadGame(storage);
      assert.equal(loaded.ok, true);
      state = loaded.state;
    }
  }
  // Sınırlı listeler taşmaz.
  assert.equal(state.memories.length <= 200, true);
  assert.equal(state.finances.ledger.length <= 120, true);
  assert.equal(state.events.history.length <= 200, true);
  assert.equal(state.yearlyHistory.length <= 80, true);
});
