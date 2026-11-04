import type { Command, CommandResult, Crime, WorldState } from "../domain/types.ts";
import type { PoliceCase, PoliceView } from "../domain/social-types.ts";
import { emit, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
const active = new Set<PoliceCase["status"]>(["investigating", "pursuit", "custody"]);
const terminal = new Set<PoliceCase["status"]>(["acquitted", "fined"]);
const ok = (reason: string): CommandResult => ({ ok: true, reason, events: [] });
const fail = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
const person = (s: WorldState, id: string) =>
  id === "player" ? s.player : s.npcs.find((n) => n.id === id);
export function policeRepresentative(s: WorldState): string | null {
  return (
    s.npcs.find((n) => n.alive && n.age >= 18 && (n.id === "n5" || n.jobId === "security"))?.id ??
    s.npcs.find((n) => n.alive && n.age >= 18)?.id ??
    null
  );
}
const officers = (s: WorldState): string[] => {
  const id = policeRepresentative(s);
  return id ? [id] : [];
};
const atStation = (s: WorldState) => s.player.location.scene === "b-police";
function eyewitnessEvidence(s: WorldState, c: Crime): string[] {
  if (!c.reported) return [];
  return c.evidence.filter(
    (item) =>
      item.startsWith("saw:") &&
      c.witnesses.includes(item.slice(4)) &&
      person(s, item.slice(4)) !== undefined,
  );
}
function caseFor(s: WorldState, crime: Crime): PoliceCase | null {
  const p = s.social.police;
  let c = p.cases.find((c) => c.crimeId === crime.id);
  if (c) return c;
  if (p.cases.length >= 128) {
    const oldest = p.cases.findIndex((c) => terminal.has(c.status));
    if (oldest < 0) return null;
    p.cases.splice(oldest, 1);
  }
  c = {
    id: `case:${crime.id}`,
    crimeId: crime.id,
    knownSuspectId: null,
    knownEvidence: [],
    testimonyIds: [],
    status: "queued",
    openedAt: s.minute,
    updatedAt: s.minute,
    outcome: null,
  };
  p.cases.push(c);
  return c;
}
function refreshKnowledge(s: WorldState): void {
  for (const crime of s.crimes) {
    const statements = s.social.testimonies.filter((t) => t.crimeId === crime.id);
    if (
      !s.social.police.cases.some((c) => c.crimeId === crime.id) &&
      Object.hasOwn(s.flags, `policeClosed:${crime.id}`) &&
      eyewitnessEvidence(s, crime).length <= Number(s.flags[`policeClosed:${crime.id}`])
    )
      continue;
    if (!crime.reported && !statements.length) continue;
    if (crime.status === "resolved" && !s.social.police.cases.some((c) => c.crimeId === crime.id))
      continue;
    const c = caseFor(s, crime);
    if (!c) continue;
    c.testimonyIds = statements.map((t) => t.id);
    const evidence = eyewitnessEvidence(s, crime),
      newEvidence = evidence.some((e) => !c.knownEvidence.includes(e));
    if (evidence.length) {
      // Ground truth identity becomes police knowledge only through the reported canonical eyewitness.
      c.knownSuspectId = crime.offender;
      c.knownEvidence = [...new Set([...c.knownEvidence, ...evidence])];
      if (
        c.status === "queued" &&
        crime.status === "pursuit" &&
        s.flags[`caseHidden:${crime.id}`] !== true &&
        s.social.police.cases.filter((x) => active.has(x.status)).length < 2
      ) {
        c.status = "pursuit";
        c.updatedAt = s.minute;
      }
      if (newEvidence && c.status === "acquitted") {
        c.status = "queued";
        c.outcome = null;
        c.updatedAt = s.minute;
      }
    } else if (!c.knownEvidence.length && !c.knownSuspectId) {
      c.knownSuspectId = statements.find((t) => t.status !== "contradicted")?.accusedId ?? null;
    }
    if (crime.status === "resolved" && !terminal.has(c.status)) {
      c.status = "fined";
      c.outcome = "Önceden tamamlanmış tanıklı dosya sonucu korundu.";
      c.updatedAt = s.minute;
    }
  }
}
export function isPoliceChargeSupported(s: WorldState, crimeId: string): boolean {
  const crime = s.crimes.find((c) => c.id === crimeId);
  return Boolean(crime && eyewitnessEvidence(s, crime).length > 0 && crime.offender === "player");
}
export function recordFineResolution(s: WorldState, crimeId: string): void {
  const crime = s.crimes.find((c) => c.id === crimeId);
  if (!crime || !isPoliceChargeSupported(s, crimeId)) return;
  const c = caseFor(s, crime);
  if (!c) return;
  c.knownSuspectId = "player";
  c.knownEvidence = eyewitnessEvidence(s, crime);
  c.status = "fined";
  c.updatedAt = s.minute;
  c.outcome = "Tanık kaydı doğrulandı; mevcut para cezası ve borç mutabakatı uygulandı.";
}
function settleFine(s: WorldState, c: PoliceCase): void {
  const crime = s.crimes.find((v) => v.id === c.crimeId)!;
  if (crime.status !== "resolved") {
    const cash = Math.min(s.accounts.player, crime.fine);
    if (cash && !transfer(s, `fine:${crime.id}`, "player", "municipality", cash, "fine"))
      throw Error("Custody fine transfer rejected; state requires recovery.");
    const arrears = crime.fine - cash;
    s.player.debt += arrears;
    s.flags.loanAsset = Number(s.flags.loanAsset ?? 0) + arrears;
    crime.status = "resolved";
  }
  recordFineResolution(s, crime.id);
}
function acquit(s: WorldState, c: PoliceCase): void {
  s.flags[`policeClosed:${c.crimeId}`] = c.knownEvidence.length;
  c.status = "acquitted";
  c.updatedAt = s.minute;
  c.outcome = "Beyan fiziksel tanık kaydıyla doğrulanamadı; bu şüphe için ceza ve borç doğmadı.";
  const crime = s.crimes.find((x) => x.id === c.crimeId);
  if (crime?.status === "pursuit") {
    crime.status = "investigating";
    s.flags[`caseHidden:${crime.id}`] = true;
  }
  emit(
    s,
    "case_acquitted",
    "Doğrulanmamış suçlama için takipsizlik kararı verildi.",
    officers(s),
    c.knownSuspectId,
    "private",
  );
}
function recomputeWanted(s: WorldState): void {
  s.player.wanted = Math.min(
    3,
    s.social.police.cases.filter((c) => c.status === "pursuit" && c.knownSuspectId === "player")
      .length,
  );
}
/** Called before normal command dispatch. Snapshot/save/pause are worker messages, not commands. */
export function guardJusticeCommand(s: WorldState, c: Command): CommandResult | null {
  if (!s.social?.police?.custody) return null;
  if (c.type === "STOP") return null;
  return fail(
    "İfade süresi sürüyor. Oyun zamanında otuz dakika sonra dosya sonucu açıklanacak; kayıt ve duraklatma açık.",
  );
}
export function applyJusticeCommand(s: WorldState, c: Command): CommandResult | null {
  if (!["POLICE_REVIEW", "POLICE_ATTEND"].includes(c.type)) return null;
  if (!s.social?.police || !atStation(s) || s.social.police.custody)
    return fail("Bu işlem için karakolun içinde ol ve açık bir ifade süren bulunmasın.");
  refreshKnowledge(s);
  const pcase = s.social.police.cases.find((v) => v.id === c.args.caseId);
  if (!pcase || terminal.has(pcase.status)) return fail("Açık bir polis dosyası seç.");
  const related =
    pcase.knownSuspectId === "player" ||
    pcase.testimonyIds.some((id) =>
      s.social.testimonies.some((t) => t.id === id && t.speakerId === "player"),
    );
  if (!related) return fail("Bu dosyada senin beyanın veya sana yöneltilmiş bir şüphe bulunmuyor.");
  if (c.type === "POLICE_REVIEW") {
    if (pcase.knownEvidence.length)
      return fail(
        "Doğrulanmış tanık kaydı mevcut. İfadeye katılabilir veya aktif takipte teslim olabilirsin.",
      );
    acquit(s, pcase);
    recomputeWanted(s);
    return ok("Doğrulanmamış suçlama kapatıldı; para kesilmedi ve delil üretilmedi.");
  }
  if (pcase.knownSuspectId !== "player")
    return fail("Yalnızca sana yöneltilmiş bir şüphe için ifadeye katılabilirsin.");
  if (
    !active.has(pcase.status) &&
    s.social.police.cases.filter((v) => active.has(v.status)).length >= 2
  )
    return fail("İki ekip de görevde. Sıradaki dosyan için kapasite açılmasını bekle.");
  if (s.player.vehicleId || s.player.shift || s.mobility.trip)
    return fail("Araç, seyahat veya vardiya sırasında ifadeye başlanamaz.");
  pcase.status = "custody";
  pcase.updatedAt = s.minute;
  s.social.police.custody = {
    caseId: pcase.id,
    personId: "player",
    startedAt: s.minute,
    releaseAt: s.minute + 30,
  };
  s.player.path = [];
  s.player.destination = null;
  for (const key of ["moveX", "moveY", "throttle", "steer"]) s.flags[key] = 0;
  recomputeWanted(s);
  emit(
    s,
    "custody_started",
    "Karakolda otuz oyun dakikalık ifade süreci başladı.",
    ["player", ...officers(s)],
    null,
    "private",
  );
  return ok("İfade başladı. Süre sonunda bilinen kanıta göre ceza veya takipsizlik uygulanır.");
}
export function tickJustice(s: WorldState): void {
  if (!s.social?.police) return;
  for (const crime of s.crimes)
    if (
      crime.status === "unreported" &&
      crime.witnesses.some((id) => person(s, id)?.alive) &&
      s.tick >= crime.tick + 30
    ) {
      crime.reported = true;
      crime.status = "investigating";
      emit(
        s,
        "witness_report",
        "Bir tanık olayı polise bildirdi.",
        crime.witnesses,
        crime.victim,
        "witnessed",
        crime.witnesses,
      );
    }
  refreshKnowledge(s);
  const p = s.social.police;
  const custody = p.custody;
  if (custody) {
    s.player.location = { x: 7, y: 9, scene: "b-police" };
    s.player.path = [];
    s.player.destination = null;
    if (s.minute >= custody.releaseAt) {
      const c = p.cases.find((c) => c.id === custody.caseId)!;
      if (c.knownSuspectId === "player" && isPoliceChargeSupported(s, c.crimeId)) settleFine(s, c);
      else acquit(s, c);
      p.custody = null;
      emit(
        s,
        "custody_ended",
        "İfade süreci sona erdi; yaşamına devam edebilirsin.",
        ["player", ...officers(s)],
        null,
        "private",
      );
    }
  }
  // Bounded, stable FIFO dispatch; nonactive backlog does not make an omniscient pursuit.
  let occupied = p.cases.filter((c) => active.has(c.status)).length;
  for (const c of p.cases) {
    const crime = s.crimes.find((x) => x.id === c.crimeId);
    if (!crime || terminal.has(c.status) || c.status === "custody") continue;
    if (c.knownSuspectId && person(s, c.knownSuspectId)?.alive === false) {
      if (active.has(c.status)) occupied--;
      s.flags[`policeClosed:${crime.id}`] = c.knownEvidence.length;
      c.status = "acquitted";
      c.updatedAt = s.minute;
      c.outcome =
        "Kişinin yaşamı sona erdiği için takip kapatıldı; bu karar tanık kaydını silmez ve kapanmış terekeye yeni borç yazmaz.";
      crime.status = "resolved";
      continue;
    }
    if (c.status === "queued" && s.flags[`caseHidden:${c.crimeId}`] === true) continue;
    if (c.status === "queued" && occupied < p.dispatchCapacity) {
      c.status = "investigating";
      c.updatedAt = s.minute;
      occupied++;
    }
    if (c.status === "investigating" && !c.knownEvidence.length && s.minute - c.updatedAt >= 60) {
      acquit(s, c);
      occupied--;
      continue;
    }
    if (
      c.status === "investigating" &&
      c.knownEvidence.length &&
      c.knownSuspectId === "player" &&
      s.flags[`caseHidden:${crime.id}`] !== true &&
      s.tick >= crime.tick + 80
    ) {
      c.status = "pursuit";
      c.updatedAt = s.minute;
      crime.status = "pursuit";
      s.flags.pursuitUntil = s.minute + 120;
      notify(
        s,
        "Polisin bildiği tanık kaydıyla arama başladı. Karakolda ifade ver veya teslim ol.",
      );
    }
    if (
      c.status === "investigating" &&
      c.knownEvidence.length &&
      c.knownSuspectId !== "player" &&
      s.minute - c.updatedAt >= 60
    ) {
      const suspect = c.knownSuspectId;
      if (suspect && Object.hasOwn(s.accounts, suspect)) {
        const fine = Math.min(s.accounts[suspect], crime.fine);
        if (fine && !transfer(s, `fine:${crime.id}`, suspect, "municipality", fine, "npc-fine"))
          throw Error("NPC fine transfer rejected; state requires recovery.");
        const arrears = crime.fine - fine,
          npc = person(s, suspect);
        if (arrears && npc) {
          npc.debt += arrears;
          s.flags[`loanAsset:${suspect}`] = Number(s.flags[`loanAsset:${suspect}`] ?? 0) + arrears;
        }
      }
      crime.status = "resolved";
      c.status = "fined";
      c.updatedAt = s.minute;
      c.outcome =
        "Tanık kaydıyla NPC dosyası sonuçlandı; mevcut bakiye tahsil edildi, ödenmeyen tutar borca kaydedildi.";
      occupied--;
    }
  }
  if (
    s.player.wanted &&
    s.minute >= Number(s.flags.pursuitUntil) &&
    s.player.location.scene !== "outside" &&
    !p.custody
  ) {
    for (const c of p.cases)
      if (c.status === "pursuit" && c.knownSuspectId === "player") {
        c.status = "queued";
        c.updatedAt = s.minute;
        s.flags[`caseHidden:${c.crimeId}`] = true;
        const crime = s.crimes.find((x) => x.id === c.crimeId);
        if (crime) crime.status = "investigating";
      }
    s.flags.pursuitUntil = s.minute + 240;
    notify(s, "Aktif takip sona erdi. Kayda geçmiş delil ve dosya korunuyor.");
  }
  recomputeWanted(s);
}
export function projectJustice(s: WorldState): PoliceView {
  const police = s.social.police;
  const statements = new Set(
    s.social.testimonies.filter((t) => t.speakerId === "player").map((t) => t.id),
  );
  return {
    capacity: 2,
    activeDispatches: police.cases.filter((c) => active.has(c.status)).length,
    custody: police.custody,
    cases: police.cases
      .filter(
        (c) => c.knownSuspectId === "player" || c.testimonyIds.some((id) => statements.has(id)),
      )
      .map((c) => ({
        ...c,
        knownEvidence: [...c.knownEvidence],
        testimonyIds: [...c.testimonyIds],
        knownSuspectName: c.knownSuspectId ? (person(s, c.knownSuspectId)?.name ?? null) : null,
      })),
  };
}
export function validateJustice(s: WorldState): string[] {
  const p = s.social.police,
    errors: string[] = [];
  if (!p || p.dispatchCapacity !== 2 || !Array.isArray(p.cases)) return ["police-shape"];
  if (p.cases.length > 128 || p.cases.filter((c) => c && active.has(c.status)).length > 2)
    errors.push("police-capacity");
  const ids = new Set<string>(),
    crimes = new Set<string>();
  const integer = (v: unknown, min = 0, max = s.minute) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
  for (const c of p.cases) {
    const crime = c ? s.crimes.find((x) => x.id === c.crimeId) : null;
    if (
      !c ||
      !crime ||
      ids.has(c.id) ||
      crimes.has(c.crimeId) ||
      c.id !== `case:${c.crimeId}` ||
      !["queued", "investigating", "pursuit", "custody", "acquitted", "fined"].includes(c.status) ||
      !Array.isArray(c.knownEvidence) ||
      !Array.isArray(c.testimonyIds) ||
      !integer(c.openedAt) ||
      !integer(c.updatedAt, c.openedAt) ||
      (c.knownSuspectId !== null && !person(s, c.knownSuspectId))
    ) {
      errors.push("police-case");
      continue;
    }
    ids.add(c.id);
    crimes.add(c.crimeId);
    if (
      c.knownEvidence.some(
        (e) =>
          !crime.evidence.includes(e) ||
          !e.startsWith("saw:") ||
          !crime.witnesses.includes(e.slice(4)),
      ) ||
      new Set(c.knownEvidence).size !== c.knownEvidence.length ||
      c.testimonyIds.some(
        (id) => !s.social.testimonies.some((t) => t.id === id && t.crimeId === c.crimeId),
      )
    )
      errors.push("police-knowledge");
    if (c.knownEvidence.length && (c.knownSuspectId !== crime.offender || !crime.reported))
      errors.push("police-identity");
    if (c.status === "pursuit" && (!c.knownEvidence.length || c.knownSuspectId !== "player"))
      errors.push("police-unsupported-pursuit");
    if (c.status === "fined" && (!c.knownEvidence.length || crime.status !== "resolved"))
      errors.push("police-unsupported-fine");
  }
  if (p.custody) {
    const c = p.cases.find((c) => c?.id === p.custody?.caseId);
    if (
      !c ||
      c.status !== "custody" ||
      c.knownSuspectId !== "player" ||
      p.custody.personId !== "player" ||
      !integer(p.custody.startedAt) ||
      !integer(p.custody.releaseAt, s.minute, s.minute + 30) ||
      p.custody.releaseAt - p.custody.startedAt !== 30 ||
      s.player.location.scene !== "b-police"
    )
      errors.push("police-custody");
  }
  if (p.cases.some((c) => c?.status === "custody" && c.id !== p.custody?.caseId))
    errors.push("police-orphan-custody");
  return errors;
}
