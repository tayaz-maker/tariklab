import type { Command, CommandResult, Point, WorldState } from "../domain/types.ts";
import type { MobilityState, MobilityView, WeatherKind } from "../domain/mobility-types.ts";
import { isWalkable, hasLineOfSight, pointOnLane } from "../domain/world.ts";
import { draw, clamp } from "./random.ts";
import { emit, notify } from "./events.ts";
import { transfer } from "./ledger.ts";
export const TRANSIT_STOPS = [
  { id: "stop-market", name: "Çarşı durağı", point: { x: 27, y: 15.5 } },
  { id: "stop-crossroads", name: "Meydan durağı", point: { x: 45.5, y: 35 } },
  { id: "stop-coast", name: "Sahil durağı", point: { x: 28, y: 54.5 } },
];
export const PARKING_LOTS = [
  {
    id: "park-market",
    name: "Çarşı otoparkı",
    point: { x: 31, y: 16 },
    capacity: 2,
    lane: 0,
    progress: 14,
  },
  {
    id: "park-east",
    name: "Meydan otoparkı",
    point: { x: 45, y: 25 },
    capacity: 2,
    lane: 1,
    progress: 53,
  },
  {
    id: "park-coast",
    name: "Sahil otoparkı",
    point: { x: 29, y: 54.5 },
    capacity: 1,
    lane: 1,
    progress: 10,
  },
];
export const RENTAL_VEHICLE_ID = "v-rental-0";
export const RENTAL_DAILY_FEE = 25000,
  RENTAL_DEPOSIT = 50000,
  TRANSIT_FARE = 2500;
const DAY_TICKS = 14400;
const WEATHER: Record<WeatherKind, { label: string; speedFactor: number; needFactor: number }> = {
  clear: { label: "Açık", speedFactor: 1, needFactor: 1 },
  cloudy: { label: "Bulutlu", speedFactor: 1, needFactor: 1 },
  rain: { label: "Yağmurlu", speedFactor: 0.7, needFactor: 1.2 },
  wind: { label: "Rüzgârlı", speedFactor: 0.85, needFactor: 1.1 },
};
export function weatherAt(seed: number, day: number): WeatherKind {
  return (["clear", "cloudy", "rain", "wind"] as const)[draw(seed, 901, day) % 4];
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const nearby = (s: WorldState, p: Point) =>
  s.player.location.scene === "outside" &&
  distance(s.player.location, p) <= 1.8 &&
  hasLineOfSight(s.player.location, p);
const good = (reason: string): CommandResult => ({ ok: true, reason, events: [] });
const bad = (reason: string): CommandResult => ({ ok: false, reason, events: [] });
export function initializeMobility(s: WorldState): MobilityState {
  const day = Math.floor(s.minute / 1440),
    existing = s.vehicles.find((v) => v.id === RENTAL_VEHICLE_ID),
    lot = PARKING_LOTS[0],
    lane = pointOnLane(lot.lane, lot.progress);
  if (!existing)
    s.vehicles.push({
      id: RENTAL_VEHICLE_ID,
      location: { ...lot.point, scene: "outside" },
      heading: lane.heading,
      speed: 0,
      driverId: null,
      lane: lot.lane,
      progress: lot.progress,
      color: 0x67a5a0,
    });
  const account = "rental:" + RENTAL_VEHICLE_ID;
  if (!Object.hasOwn(s.accounts, account)) {
    s.accounts[account] = 0;
    s.ledgerCheckpoint.balances[account] = 0;
  }
  return {
    version: 1,
    weather: { kind: weatherAt(s.seed, day), day },
    speed: 1,
    parking: PARKING_LOTS.map((p, i) => ({
      id: p.id,
      capacity: p.capacity,
      vehicleIds: i === 0 ? [RENTAL_VEHICLE_ID] : [],
    })),
    rentals: [
      {
        id: "rental-station",
        vehicleId: RENTAL_VEHICLE_ID,
        renterId: null,
        startTick: 0,
        endTick: 0,
        deposit: 0,
        status: "available",
      },
    ],
    trip: null,
  };
}
export const weatherEffects = (s: WorldState) => WEATHER[s.mobility.weather.kind];
export function parkedAt(s: WorldState, vehicleId: string): string | null {
  return s.mobility.parking.find((p) => p.vehicleIds.includes(vehicleId))?.id ?? null;
}
export function rentalAccess(s: WorldState, vehicleId: string): string | null {
  const r = s.mobility.rentals.find((x) => x.vehicleId === vehicleId);
  return r && r.renterId !== "player" ? "Bu araç için önce kiralama sözleşmesi yap." : null;
}
export function unparkVehicle(s: WorldState, vehicleId: string): void {
  const parked = s.mobility.parking.find((p) => p.vehicleIds.includes(vehicleId));
  if (!parked) return;
  const lot = PARKING_LOTS.find((p) => p.id === parked.id)!,
    v = s.vehicles.find((x) => x.id === vehicleId)!,
    point = pointOnLane(lot.lane, lot.progress);
  parked.vehicleIds = parked.vehicleIds.filter((id) => id !== vehicleId);
  v.lane = lot.lane;
  v.progress = lot.progress;
  v.heading = point.heading;
  v.location = { x: point.x, y: point.y, scene: "outside" };
}
export function applyMobilityCommand(s: WorldState, c: Command): CommandResult | null {
  const a = c.args,
    p = s.player,
    m = s.mobility;
  if (m.trip && !["STOP", "USE_ITEM", "SET_TIME_SPEED"].includes(c.type))
    return bad("Otobüs yolculuğu sürüyor. Varışta diğer eylemler açılır.");
  switch (c.type) {
    case "SET_TIME_SPEED": {
      if (![0.5, 1, 2].includes(Number(a.speed)) || typeof a.speed !== "number")
        return bad("Zaman hızı 0,5 / 1 / 2 olabilir.");
      m.speed = a.speed as 0.5 | 1 | 2;
      emit(s, "time_speed", "Zaman akış hızı değişti.", ["player"], null, "private");
      return good("Zaman hızı " + m.speed + "×.");
    }
    case "TRANSIT_RIDE": {
      const from = TRANSIT_STOPS.find((x) => nearby(s, x.point)),
        to = TRANSIT_STOPS.find((x) => x.id === a.stopId);
      if (!from || !to || from.id === to.id)
        return bad("Bir durağa yaklaş ve farklı bir varış durağı seç.");
      if (
        p.vehicleId ||
        p.shift ||
        p.wanted ||
        Number(s.flags.trainingUntil ?? 0) > s.minute ||
        s.life.enrollments.some(
          (e) =>
            e.personId === "player" && e.status === "enrolled" && (e.activeUntil ?? 0) > s.minute,
        )
      )
        return bad("Araç, iş, ders veya polis takibi sırasında otobüse binilemez.");
      if (!transfer(s, "bus:" + c.id, "player", "business:taxi", TRANSIT_FARE, "transit-fare"))
        return bad("Otobüs ücreti için25TL gerekir.");
      const minutes = 8 + Math.ceil(distance(from.point, to.point) / 4);
      m.trip = {
        id: "trip:" + c.id,
        fromStop: from.id,
        toStop: to.id,
        arrivalTick: s.tick + minutes * 10,
        startedTick: s.tick,
        fare: TRANSIT_FARE,
      };
      p.location = { ...from.point, scene: "outside" };
      p.path = [];
      p.destination = null;
      p.goal = "transit";
      s.flags.moveX = 0;
      s.flags.moveY = 0;
      s.flags.restUntil = 0;
      p.expenses += TRANSIT_FARE;
      emit(
        s,
        "transit_departure",
        from.name + " → " + to.name + "; ücret bir kez ödendi.",
        ["player"],
        to.id,
        "private",
      );
      return good(minutes + " dakikalık yolculuk başladı.");
    }
    case "RENT_VEHICLE": {
      const r = m.rentals.find((x) => x.vehicleId === a.vehicleId),
        v = s.vehicles.find((x) => x.id === a.vehicleId),
        days = a.days;
      if (
        !r ||
        !v ||
        r.status !== "available" ||
        !nearby(s, v.location) ||
        p.vehicleId ||
        v.driverId
      )
        return bad("Boş kiralık aracın yanına yaklaş.");
      if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 3)
        return bad("Kiralama süresi1–3gün olmalı.");
      const fee = RENTAL_DAILY_FEE * days;
      if (s.accounts.player < fee + RENTAL_DEPOSIT)
        return bad("Kira ve iade edilebilir depozito için yeterli paran yok.");
      if (!transfer(s, "rent-fee:" + c.id, "player", "business:garage", fee, "vehicle-rental"))
        return bad("Kira ödemesi başarısız.");
      if (
        !transfer(
          s,
          "rent-deposit:" + c.id,
          "player",
          "rental:" + r.vehicleId,
          RENTAL_DEPOSIT,
          "vehicle-rental-deposit",
        )
      )
        throw new Error("Validated rental deposit transfer failed");
      r.renterId = "player";
      r.status = "active";
      r.startTick = s.tick;
      r.endTick = s.tick + days * DAY_TICKS;
      r.deposit = RENTAL_DEPOSIT;
      p.expenses += fee;
      emit(
        s,
        "vehicle_rented",
        "Araç kiralandı; depozito ayrı hesapta tutuluyor.",
        ["player"],
        r.vehicleId,
        "private",
      );
      return good("Araç hazır. Süre bitince otoparka bırakıp iade et.");
    }
    case "PARK_VEHICLE": {
      const lot = PARKING_LOTS.find((x) => x.id === a.parkingId),
        record = m.parking.find((x) => x.id === a.parkingId),
        v = s.vehicles.find((x) => x.id === p.vehicleId);
      if (!lot || !record || !v || !nearby(s, lot.point) || v.speed > 0.6)
        return bad("Park alanının yanında aracı durdur.");
      if (record.vehicleIds.length >= record.capacity) return bad("Otopark dolu; başka alan seç.");
      const slot = { x: lot.point.x + (record.vehicleIds.length ? 1.2 : 0), y: lot.point.y };
      if (!isWalkable(slot)) return bad("Park alanı erişilemiyor.");
      record.vehicleIds.push(v.id);
      v.driverId = null;
      v.speed = 0;
      v.location = { ...slot, scene: "outside" };
      p.vehicleId = null;
      p.location = { x: slot.x, y: slot.y + 0.8, scene: "outside" };
      if (!isWalkable(p.location)) p.location = { ...slot, scene: "outside" };
      s.flags.throttle = 0;
      s.flags.steer = 0;
      emit(s, "vehicle_parked", lot.name + " alanına park edildi.", ["player"], v.id, "private");
      return good("Park yeri ayrıldı. Araçtan indin.");
    }
    case "RETURN_RENTAL": {
      const r = m.rentals.find((x) => x.vehicleId === a.vehicleId),
        v = s.vehicles.find((x) => x.id === a.vehicleId);
      if (
        !r ||
        !v ||
        r.renterId !== "player" ||
        r.status === "available" ||
        v.driverId ||
        !parkedAt(s, v.id) ||
        !nearby(s, v.location)
      )
        return bad("Kiralık aracı otoparka park et, in ve yanında iade et.");
      const overdue = Math.max(0, s.tick - r.endTick),
        penalty = Math.min(r.deposit, Math.ceil(overdue / DAY_TICKS) * 5000),
        refund = r.deposit - penalty,
        account = "rental:" + r.vehicleId;
      if (
        penalty &&
        !transfer(s, "rental-late:" + c.id, account, "business:garage", penalty, "rental-late-fee")
      )
        throw new Error("Rental penalty invariant");
      if (
        refund &&
        !transfer(s, "rental-refund:" + c.id, account, "player", refund, "rental-deposit-refund")
      )
        throw new Error("Rental refund invariant");
      p.expenses += penalty;
      r.renterId = null;
      r.status = "available";
      r.deposit = 0;
      r.startTick = 0;
      r.endTick = 0;
      emit(
        s,
        "vehicle_returned",
        "Araç iade edildi; depozito ve varsa açık gecikme ücreti hesaplandı.",
        ["player"],
        v.id,
        "private",
      );
      return good(refund / 100 + "TL depozito iade edildi.");
    }
    default:
      return null;
  }
}
export function mobilityTick(s: WorldState): void {
  const m = s.mobility;
  if (m.trip && s.tick >= m.trip.arrivalTick) {
    const stop = TRANSIT_STOPS.find((x) => x.id === m.trip!.toStop)!;
    s.player.location = { ...stop.point, scene: "outside" };
    s.player.goal = "explore";
    s.player.path = [];
    s.player.destination = null;
    emit(s, "transit_arrival", stop.name + " durağına ulaştın.", ["player"], stop.id, "private");
    m.trip = null;
    notify(s, "Otobüs yolculuğu tamamlandı.");
  }
  for (const r of m.rentals)
    if (r.status === "active" && s.tick >= r.endTick) {
      r.status = "overdue";
      notify(s, "Kiralama süresi bitti. İade gecikme ücreti günlük50TL; depozito ile sınırlıdır.");
    }
}
export function mobilityMinute(s: WorldState): void {
  const day = Math.floor(s.minute / 1440);
  if (s.mobility.weather.day !== day) {
    const kind = weatherAt(s.seed, day);
    s.mobility.weather = { kind, day };
    emit(
      s,
      "weather_change",
      "Bugün hava " + WEATHER[kind].label.toLocaleLowerCase("tr-TR") + ".",
      [],
      null,
      "public",
    );
  }
  if (
    s.minute % 15 === 0 &&
    s.player.location.scene === "outside" &&
    !s.mobility.trip &&
    (s.mobility.weather.kind === "rain" || s.mobility.weather.kind === "wind")
  )
    s.player.fatigue = clamp(s.player.fatigue + 1);
}
export function mobilityView(s: WorldState): MobilityView {
  const m = s.mobility,
    from = TRANSIT_STOPS.find((x) => nearby(s, x.point));
  return {
    speed: m.speed,
    weather: { ...m.weather, ...WEATHER[m.weather.kind] },
    stops: TRANSIT_STOPS.map((x) => ({
      ...x,
      point: { ...x.point },
      fare: TRANSIT_FARE,
      minutes: from ? 8 + Math.ceil(distance(from.point, x.point) / 4) : 0,
      nearby: nearby(s, x.point),
    })),
    parking: PARKING_LOTS.map((x) => {
      const r = m.parking.find((p) => p.id === x.id)!;
      return {
        id: x.id,
        name: x.name,
        point: { ...x.point },
        capacity: r.capacity,
        occupied: r.vehicleIds.length,
        available: r.capacity - r.vehicleIds.length,
      };
    }),
    rentals: m.rentals.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      location: { ...s.vehicles.find((v) => v.id === r.vehicleId)!.location },
      name: "Usta İşi kiralık otomobil",
      dailyFee: RENTAL_DAILY_FEE,
      deposit: RENTAL_DEPOSIT,
      status: r.status,
      endsAt: r.status === "available" ? null : r.endTick,
      parkedAt: parkedAt(s, r.vehicleId),
    })),
    trip: m.trip
      ? { ...m.trip, remainingMinutes: Math.max(0, Math.ceil((m.trip.arrivalTick - s.tick) / 10)) }
      : null,
    starterVehicleId: "v0",
  };
}
export function validateMobility(s: WorldState): string[] {
  const errors: string[] = [],
    m = s.mobility;
  if (!m || m.version !== 1) return ["missing-mobility"];
  if (![0.5, 1, 2].includes(m.speed)) errors.push("invalid-time-speed");
  if (
    !Object.hasOwn(WEATHER, m.weather.kind) ||
    m.weather.day !== Math.floor(s.minute / 1440) ||
    m.weather.kind !== weatherAt(s.seed, m.weather.day)
  )
    errors.push("invalid-weather");
  const parked = new Set<string>();
  if (m.parking.length !== PARKING_LOTS.length) errors.push("invalid-parking-count");
  for (const r of m.parking) {
    const def = PARKING_LOTS.find((p) => p.id === r.id);
    if (!def || def.capacity !== r.capacity || r.vehicleIds.length > r.capacity)
      errors.push("invalid-parking:" + r.id);
    for (const id of r.vehicleIds) {
      const v = s.vehicles.find((x) => x.id === id);
      if (
        parked.has(id) ||
        !v ||
        v.driverId ||
        v.speed !== 0 ||
        !def ||
        distance(v.location, def.point) > 1.5
      )
        errors.push("invalid-parked-vehicle:" + id);
      parked.add(id);
    }
  }
  if (m.rentals.length !== 1 || m.rentals[0].vehicleId !== RENTAL_VEHICLE_ID)
    errors.push("invalid-rental-registry");
  for (const r of m.rentals) {
    const v = s.vehicles.find((x) => x.id === r.vehicleId);
    if (
      !v ||
      !["available", "active", "overdue"].includes(r.status) ||
      s.accounts["rental:" + r.vehicleId] !== r.deposit ||
      !Number.isSafeInteger(r.deposit) ||
      r.deposit < 0
    )
      errors.push("invalid-rental:" + r.id);
    if (
      r.status === "available" &&
      (r.renterId !== null || r.deposit !== 0 || v?.driverId || !parked.has(r.vehicleId))
    )
      errors.push("invalid-available-rental");
    if (
      r.status !== "available" &&
      (r.renterId !== "player" ||
        r.deposit !== RENTAL_DEPOSIT ||
        !Number.isSafeInteger(r.startTick) ||
        !Number.isSafeInteger(r.endTick) ||
        r.endTick <= r.startTick ||
        r.endTick - r.startTick > 3 * DAY_TICKS ||
        (r.endTick - r.startTick) % DAY_TICKS !== 0)
    )
      errors.push("invalid-active-rental");
  }
  if (m.trip) {
    const t = m.trip,
      from = TRANSIT_STOPS.find((x) => x.id === t.fromStop),
      to = TRANSIT_STOPS.find((x) => x.id === t.toStop);
    if (
      !from ||
      !to ||
      from === to ||
      !Number.isSafeInteger(t.arrivalTick) ||
      t.arrivalTick <= s.tick ||
      !Number.isSafeInteger(t.startedTick) ||
      t.startedTick > s.tick ||
      t.fare !== TRANSIT_FARE ||
      (from &&
        to &&
        t.arrivalTick !==
          t.startedTick + (8 + Math.ceil(distance(from.point, to.point) / 4)) * 10) ||
      s.player.vehicleId ||
      s.player.goal !== "transit" ||
      s.player.location.scene !== "outside" ||
      (from && distance(s.player.location, from.point) > 0.01)
    )
      errors.push("invalid-transit-trip");
  }
  return errors;
}
