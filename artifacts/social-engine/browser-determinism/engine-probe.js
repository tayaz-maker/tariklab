"use strict";
var SESimulation = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key3 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key3) && key3 !== except)
          __defProp(to, key3, { get: () => from[key3], enumerable: !(desc = __getOwnPropDesc(from, key3)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/games/social-engine/simulation/engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    advanceMinutes: () => advanceMinutes,
    applyCommand: () => applyCommand,
    canonicalState: () => canonicalState,
    createBenchmarkWorld: () => createBenchmarkWorld,
    createWorld: () => createWorld,
    eventEligible: () => eventEligible,
    offerEvent: () => offerEvent,
    profileErrors: () => profileErrors,
    projectWorld: () => projectWorld,
    reconcile: () => reconcile,
    stepWorld: () => stepWorld,
    transfer: () => transfer,
    validateState: () => validateState
  });

  // src/games/social-engine/domain/world.ts
  var LAND_HEIGHT = 57;
  var COLLIDER_RADIUS = 0.28;
  var INTERIOR_SPAWN = { x: 7, y: 9 };
  var INTERIOR_EXIT = { x: 7, y: 10 };
  var BUILDINGS = [
    {
      id: "b-home",
      name: "Yuva Apartman\u0131",
      kind: "home",
      x: 4,
      y: 3,
      w: 5,
      h: 10,
      height: 8,
      color: 14662028,
      door: { x: 6.5, y: 13.7 },
      sign: "YUVA"
    },
    {
      id: "b-restaurant",
      name: "Sahil Sofras\u0131",
      kind: "restaurant",
      x: 10,
      y: 5,
      w: 5,
      h: 8,
      height: 4,
      color: 13537131,
      door: { x: 12.5, y: 13.7 },
      sign: "SAH\u0130L SOFRASI"
    },
    {
      id: "b-market",
      name: "Bereket Market",
      kind: "market",
      x: 23,
      y: 6,
      w: 8,
      h: 8,
      height: 5,
      color: 15385989,
      door: { x: 27, y: 14.7 },
      sign: "BEREKET"
    },
    {
      id: "b-clinic",
      name: "K\u0131y\u0131yaka Klini\u011Fi",
      kind: "clinic",
      x: 33,
      y: 4,
      w: 6,
      h: 10,
      height: 5,
      color: 14868176,
      door: { x: 36, y: 14.7 },
      sign: "SA\u011ELIK"
    },
    {
      id: "b-garage",
      name: "Usta \u0130\u015Fi Tamirhane",
      kind: "garage",
      x: 47,
      y: 5,
      w: 12,
      h: 8,
      height: 4,
      color: 11581874,
      door: { x: 53, y: 13.7 },
      sign: "USTA \u0130\u015E\u0130"
    },
    {
      id: "b-cafe",
      name: "\xC7\u0131nar \xC7ayevi",
      kind: "cafe",
      x: 4,
      y: 23,
      w: 9,
      h: 8,
      height: 5,
      color: 12880757,
      door: { x: 8.5, y: 31.7 },
      sign: "\xC7INAR \xC7AYEV\u0130"
    },
    {
      id: "b-office",
      name: "K\u0131y\u0131 Kooperatifi",
      kind: "office",
      x: 23,
      y: 23,
      w: 7,
      h: 8,
      height: 8,
      color: 14075305,
      door: { x: 26.5, y: 31.7 },
      sign: "KIYI KOOPERAT\u0130F\u0130"
    },
    {
      id: "b-security",
      name: "Mahalle Dayan\u0131\u015Fma",
      kind: "security",
      x: 33,
      y: 24,
      w: 6,
      h: 7,
      height: 4,
      color: 12238240,
      door: { x: 36, y: 31.7 },
      sign: "DAYANI\u015EMA"
    },
    {
      id: "b-warehouse",
      name: "Liman Deposu",
      kind: "warehouse",
      x: 47,
      y: 23,
      w: 12,
      h: 9,
      height: 4,
      color: 12428939,
      door: { x: 53, y: 32.7 },
      sign: "L\u0130MAN DEPOSU"
    },
    {
      id: "b-school",
      name: "Ufuk Akademi",
      kind: "school",
      x: 4,
      y: 40,
      w: 10,
      h: 9,
      height: 6,
      color: 14137214,
      door: { x: 9, y: 49.7 },
      sign: "UFUK AKADEM\u0130"
    },
    {
      id: "b-sales",
      name: "Sahil Tasar\u0131m",
      kind: "sales",
      x: 23,
      y: 40,
      w: 7,
      h: 9,
      height: 5,
      color: 13211780,
      door: { x: 26.5, y: 49.7 },
      sign: "SAH\u0130L TASARIM"
    },
    {
      id: "b-bank",
      name: "K\u0131y\u0131 Finans",
      kind: "bank",
      x: 33,
      y: 40,
      w: 6,
      h: 9,
      height: 5,
      color: 14209466,
      door: { x: 36, y: 49.7 },
      sign: "KIYI F\u0130NANS"
    },
    {
      id: "b-taxi",
      name: "Mart\u0131 Taksi",
      kind: "taxi",
      x: 47,
      y: 40,
      w: 6,
      h: 9,
      height: 4,
      color: 14268249,
      door: { x: 50, y: 49.7 },
      sign: "MARTI TAKS\u0130"
    },
    {
      id: "b-police",
      name: "K\u0131y\u0131yaka Karakolu",
      kind: "police",
      x: 55,
      y: 40,
      w: 6,
      h: 9,
      height: 5,
      color: 12831172,
      door: { x: 58, y: 49.7 },
      sign: "KARAKOL"
    }
  ];
  var SPAWN = { x: 27, y: 16 };
  var ROADS = [
    [
      { x: 17, y: 17 },
      { x: 42, y: 17 },
      { x: 42, y: 51 },
      { x: 17, y: 51 }
    ],
    [
      { x: 19, y: 53 },
      { x: 44, y: 53 },
      { x: 44, y: 19 },
      { x: 19, y: 19 }
    ],
    [
      { x: 17, y: 35 },
      { x: 42, y: 35 },
      { x: 42, y: 51 },
      { x: 17, y: 51 }
    ],
    [
      { x: 19, y: 37 },
      { x: 44, y: 37 },
      { x: 44, y: 19 },
      { x: 19, y: 19 }
    ]
  ];
  var validScenes = new Set(BUILDINGS.map((b) => b.id));
  function isWalkable(p, scene = "outside") {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const r = COLLIDER_RADIUS;
    if (scene !== "outside")
      return validScenes.has(scene) && p.x >= 1 + r && p.x <= 13 - r && p.y >= 1 + r && p.y <= 11 - r && !(p.y < 4.8 + r && (p.x < 3.3 + r || p.x > 10 - r));
    if (p.x < 1 + r || p.x > 63 - r || p.y < 1 + r || p.y > LAND_HEIGHT - r) return false;
    return !BUILDINGS.some(
      (b) => p.x > b.x - r && p.x < b.x + b.w + r && p.y > b.y - r && p.y < b.y + b.h + r
    );
  }
  function hasLineOfSight(a, b, scene = "outside") {
    const distance3 = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(distance3 / 0.2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!isWalkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, scene)) return false;
    }
    return true;
  }
  function moveWithCollision(from, delta, scene = "outside") {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y) || !isWalkable(from, scene))
      return { ...from };
    const steps = Math.min(4096, Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / 0.16)));
    let p = { ...from };
    const dx = delta.x / steps, dy = delta.y / steps;
    for (let i = 0; i < steps; i++) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (isWalkable(next, scene)) p = next;
      else {
        const px = { x: p.x + dx, y: p.y };
        if (isWalkable(px, scene)) p = px;
        const py = { x: p.x, y: p.y + dy };
        if (isWalkable(py, scene)) p = py;
      }
    }
    return { x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 };
  }
  var cache = /* @__PURE__ */ new Map();
  function findPath(from, to, scene = "outside") {
    if (!isWalkable(from, scene) || !isWalkable(to, scene)) return [];
    if (hasLineOfSight(from, to, scene)) return [{ ...to }];
    const sx = Math.round(from.x * 2), sy = Math.round(from.y * 2), tx = Math.round(to.x * 2), ty = Math.round(to.y * 2);
    const key3 = `${scene}:${sx},${sy}:${tx},${ty}`;
    const hit = cache.get(key3);
    if (hit && hasLineOfSight(from, hit[0], scene) && hasLineOfSight(hit[hit.length - 1], to, scene))
      return [...hit.map((p) => ({ ...p })), { ...to }];
    const size = 129, start = sy * size + sx, goal = ty * size + tx;
    const g = /* @__PURE__ */ new Map([[start, 0]]), parent = /* @__PURE__ */ new Map();
    const closed = /* @__PURE__ */ new Set();
    const heap = [];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i > 0) {
        const p = i - 1 >> 1;
        if (heap[p].f < item.f || heap[p].f === item.f && heap[p].id < item.id) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = item;
    };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) {
        let i = 0;
        heap[0] = last;
        while (true) {
          let j = i * 2 + 1;
          if (j >= heap.length) break;
          if (j + 1 < heap.length && (heap[j + 1].f < heap[j].f || heap[j + 1].f === heap[j].f && heap[j + 1].id < heap[j].id))
            j++;
          if (heap[j].f > last.f || heap[j].f === last.f && heap[j].id > last.id) break;
          heap[i] = heap[j];
          i = j;
        }
        heap[i] = last;
      }
      return first;
    };
    push({ id: start, f: Math.abs(tx - sx) + Math.abs(ty - sy) });
    const dirs = [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ];
    while (heap.length && closed.size < 17e3) {
      const cur = pop();
      if (closed.has(cur.id)) continue;
      closed.add(cur.id);
      if (cur.id === goal) {
        const path = [];
        let id = goal;
        while (id !== start) {
          path.unshift({ x: id % size / 2, y: Math.floor(id / size) / 2 });
          id = parent.get(id);
        }
        if (!path.length || !hasLineOfSight(from, path[0], scene) || !hasLineOfSight(path[path.length - 1], to, scene))
          return [];
        const smooth = [];
        let anchor = from;
        for (let i = 0; i < path.length; ) {
          let j = i;
          while (j + 1 < path.length && hasLineOfSight(anchor, path[j + 1], scene)) j++;
          smooth.push(path[j]);
          anchor = path[j];
          i = j + 1;
        }
        if (cache.size > 256) cache.delete(cache.keys().next().value);
        cache.set(key3, smooth);
        return [...smooth, { ...to }];
      }
      const x = cur.id % size, y = Math.floor(cur.id / size);
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const id = ny * size + nx;
        if (closed.has(id) || !isWalkable({ x: nx / 2, y: ny / 2 }, scene)) continue;
        if (dx && dy && (!isWalkable({ x: (x + dx) / 2, y: y / 2 }, scene) || !isWalkable({ x: x / 2, y: (y + dy) / 2 }, scene)))
          continue;
        const cost = g.get(cur.id) + (dx && dy ? 14 : 10);
        if (cost >= (g.get(id) ?? Infinity)) continue;
        g.set(id, cost);
        parent.set(id, cur.id);
        push({ id, f: cost + 10 * Math.max(Math.abs(tx - nx), Math.abs(ty - ny)) });
      }
    }
    return [];
  }
  function laneLength(lane) {
    const points = ROADS[lane];
    if (!points) return 0;
    return points.reduce(
      (sum, p, i) => sum + Math.hypot(points[(i + 1) % points.length].x - p.x, points[(i + 1) % points.length].y - p.y),
      0
    );
  }
  function pointOnLane(lane, distance3) {
    const points = ROADS[lane] ?? ROADS[0], len = laneLength(lane) || laneLength(0);
    let d = (distance3 % len + len) % len;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length], seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= seg)
        return {
          x: a.x + (b.x - a.x) * d / seg,
          y: a.y + (b.y - a.y) * d / seg,
          heading: Math.atan2(b.y - a.y, b.x - a.x)
        };
      d -= seg;
    }
    return { ...points[0], heading: 0 };
  }

  // src/games/social-engine/domain/traffic.ts
  var edges = ROADS.flatMap(
    (lane, index) => lane.map((a, i) => ({ a, b: lane[(i + 1) % lane.length], lane: index }))
  );
  var nodes = /* @__PURE__ */ new Map();
  for (const h of edges.filter((e) => e.a.y === e.b.y))
    for (const v of edges.filter((e) => e.a.x === e.b.x)) {
      if (h.lane === v.lane) continue;
      const x = v.a.x, y = h.a.y;
      if (x < Math.min(h.a.x, h.b.x) || x > Math.max(h.a.x, h.b.x) || y < Math.min(v.a.y, v.b.y) || y > Math.max(v.a.y, v.b.y))
        continue;
      const id = `junction:${x}:${y}`;
      nodes.set(id, { id, x, y });
    }
  var JUNCTIONS = [...nodes.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  function signalAxis(tick, junction) {
    const phase = (tick + (junction.x + junction.y) * 3) % 180;
    return phase < 80 ? "horizontal" : phase < 90 ? "clearance" : phase < 170 ? "vertical" : "clearance";
  }

  // src/games/social-engine/simulation/random.ts
  function draw(seed, channel, tick, entity = 0) {
    let x = (seed ^ Math.imul(channel + 1, 2654435769) ^ Math.imul(tick + 1, 2246822507) ^ Math.imul(entity + 1, 3266489909)) >>> 0;
    x = Math.imul(x ^ x >>> 16, 2146121005);
    x = Math.imul(x ^ x >>> 15, 2221713035);
    return (x ^ x >>> 16) >>> 0;
  }
  var clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
  var quantize = (value) => Math.round(value * 1e3) / 1e3;
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    const object = value;
    return `{${Object.keys(object).sort().map((key3) => `${JSON.stringify(key3)}:${canonical(object[key3])}`).join(",")}}`;
  }

  // src/games/social-engine/simulation/events.ts
  function notify(state, message) {
    state.notices.push(message);
    if (state.notices.length > 8) state.notices.splice(0, state.notices.length - 8);
  }
  function remember(person5, id) {
    if (!person5.memories.includes(id)) person5.memories.push(id);
    if (person5.memories.length > 48) person5.memories.shift();
  }
  function emit(state, kind, text, actors = [], targetId = null, visibility = "public", witnesses = [], causeId = null) {
    const event2 = {
      id: `e${state.nextId++}`,
      tick: state.tick,
      minute: state.minute,
      kind,
      text,
      actors,
      targetId,
      visibility,
      witnesses,
      causeId
    };
    state.events.push(event2);
    state.eventCount++;
    const observers = /* @__PURE__ */ new Set([...actors, ...witnesses]);
    for (const id of observers) {
      const person5 = id === "player" ? state.player : state.npcs.find((n) => n.id === id);
      if (person5?.alive) remember(person5, event2.id);
    }
    return event2;
  }
  function relation(state, from, to) {
    let edge = state.relations.find((item) => item.from === from && item.to === to);
    if (!edge) {
      edge = { from, to, trust: 0, affection: 0, fear: 0, resentment: 0, lastContact: state.minute };
      state.relations.push(edge);
    }
    return edge;
  }
  function adjustRelation(state, from, to, trust, affection = 0, fear = 0, resentment = 0) {
    const edge = relation(state, from, to);
    edge.trust = clamp(edge.trust + trust, -100, 100);
    edge.affection = clamp(edge.affection + affection, -100, 100);
    edge.fear = clamp(edge.fear + fear, 0, 100);
    edge.resentment = clamp(edge.resentment + resentment, 0, 100);
    edge.lastContact = state.minute;
    return edge;
  }

  // src/games/social-engine/simulation/ledger.ts
  var retainedIds = /* @__PURE__ */ new WeakMap();
  function validTransactionBits(value) {
    if (typeof value !== "string") return false;
    if (/^[0-9a-f]{1,1024}$/.test(value)) return true;
    if (!/^b:(0|[1-9]\d{0,3})(,(0|[1-9]\d{0,3})){0,31}$/.test(value)) return false;
    const bits = value.slice(2).split(",").map(Number);
    return bits.every((n, i) => n < 4096 && (i === 0 || n > bits[i - 1]));
  }
  function readTransactionBits(value) {
    if (!validTransactionBits(value)) throw Error("Invalid transaction identity bitmap");
    if (!value.startsWith("b:")) return BigInt(`0x${value}`);
    return value.slice(2).split(",").reduce((n, bit) => n | 1n << BigInt(bit), 0n);
  }
  function writeTransactionBits(bitmap) {
    const hex = bitmap.toString(16);
    if (hex.length < 8) return hex;
    const positions = [];
    for (let i = hex.length - 1; i >= 0; i--) {
      const digit = parseInt(hex[i], 16);
      for (let bit = 0; bit < 4; bit++)
        if (digit & 1 << bit) {
          positions.push((hex.length - i - 1) * 4 + bit);
          if (positions.length > 32) return hex;
        }
    }
    const sparse = `b:${positions.join(",")}`;
    return sparse.length < hex.length ? sparse : hex;
  }
  function idAddress(id) {
    const match = /^(.*?)(0|[1-9]\d*)(\D*)$/.exec(id);
    if (match && Number.isSafeInteger(Number(match[2])) && String(Number(match[2])) === match[2]) {
      const ordinal = Number(match[2]);
      return {
        key: `txset:${JSON.stringify([match[1], match[3], Math.floor(ordinal / 4096)])}`,
        bit: 1n << BigInt(ordinal % 4096)
      };
    }
    return { key: `txexact:${id}`, bit: 1n };
  }
  function transfer(state, id, from, to, amount2, reason) {
    if (!Number.isSafeInteger(amount2) || amount2 <= 0 || from === to || !Object.hasOwn(state.accounts, from) || !Object.hasOwn(state.accounts, to))
      return false;
    const address = idAddress(id), stored = String(state.flags[address.key] ?? "0"), bitmap = readTransactionBits(stored);
    let recent = retainedIds.get(state);
    if (!recent) {
      recent = new Set(state.ledger.map((entry) => entry.id));
      retainedIds.set(state, recent);
    }
    if ((bitmap & address.bit) !== 0n || recent.has(id)) return false;
    if (state.accounts[from] < amount2 || !Number.isSafeInteger(state.accounts[to] + amount2))
      return false;
    state.accounts[from] -= amount2;
    state.accounts[to] += amount2;
    state.ledger.push({ id, tick: state.tick, from, to, amount: amount2, reason });
    state.flags[address.key] = writeTransactionBits(bitmap | address.bit);
    recent.add(id);
    if (state.ledger.length >= 2048) {
      const entries = state.ledger.splice(0, 1024);
      for (const entry of entries) {
        state.ledgerCheckpoint.balances[entry.from] -= entry.amount;
        state.ledgerCheckpoint.balances[entry.to] += entry.amount;
        recent.delete(entry.id);
      }
      state.ledgerCheckpoint.count += entries.length;
    }
    return true;
  }
  function reconcile(state) {
    const errors = [], balances = { ...state.ledgerCheckpoint.balances }, ids = /* @__PURE__ */ new Set();
    for (const entry of state.ledger) {
      if (ids.has(entry.id)) errors.push(`duplicate-ledger:${entry.id}`);
      ids.add(entry.id);
      if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0)
        errors.push(`invalid-transfer:${entry.id}`);
      if (!(entry.from in balances) || !(entry.to in balances))
        errors.push(`unknown-account:${entry.id}`);
      balances[entry.from] -= entry.amount;
      balances[entry.to] += entry.amount;
    }
    let total = 0;
    for (const [id, amount2] of Object.entries(state.accounts)) {
      if (!Number.isSafeInteger(amount2) || amount2 < 0) errors.push(`invalid-balance:${id}`);
      if (balances[id] !== amount2) errors.push(`unexplained-balance:${id}`);
      total += amount2;
    }
    if (total !== state.openingTotal) errors.push("currency-conservation");
    return errors;
  }

  // src/games/social-engine/simulation/mobility.ts
  var TRANSIT_STOPS = [
    { id: "stop-market", name: "\xC7ar\u015F\u0131 dura\u011F\u0131", point: { x: 27, y: 15.5 } },
    { id: "stop-crossroads", name: "Meydan dura\u011F\u0131", point: { x: 45.5, y: 35 } },
    { id: "stop-coast", name: "Sahil dura\u011F\u0131", point: { x: 28, y: 54.5 } }
  ];
  var PARKING_LOTS = [
    {
      id: "park-market",
      name: "\xC7ar\u015F\u0131 otopark\u0131",
      point: { x: 31, y: 16 },
      capacity: 2,
      lane: 0,
      progress: 14
    },
    {
      id: "park-east",
      name: "Meydan otopark\u0131",
      point: { x: 45, y: 25 },
      capacity: 2,
      lane: 1,
      progress: 53
    },
    {
      id: "park-coast",
      name: "Sahil otopark\u0131",
      point: { x: 29, y: 54.5 },
      capacity: 1,
      lane: 1,
      progress: 10
    }
  ];
  var RENTAL_VEHICLE_ID = "v-rental-0";
  var RENTAL_DAILY_FEE = 25e3;
  var RENTAL_DEPOSIT = 5e4;
  var TRANSIT_FARE = 2500;
  var DAY_TICKS = 14400;
  var WEATHER = {
    clear: { label: "A\xE7\u0131k", speedFactor: 1, needFactor: 1 },
    cloudy: { label: "Bulutlu", speedFactor: 1, needFactor: 1 },
    rain: { label: "Ya\u011Fmurlu", speedFactor: 0.7, needFactor: 1.2 },
    wind: { label: "R\xFCzg\xE2rl\u0131", speedFactor: 0.85, needFactor: 1.1 }
  };
  function weatherAt(seed, day) {
    return ["clear", "cloudy", "rain", "wind"][draw(seed, 901, day) % 4];
  }
  var distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  var nearby = (s, p) => s.player.location.scene === "outside" && distance(s.player.location, p) <= 1.8 && hasLineOfSight(s.player.location, p);
  var good = (reason) => ({ ok: true, reason, events: [] });
  var bad = (reason) => ({ ok: false, reason, events: [] });
  function initializeMobility(s) {
    const day = Math.floor(s.minute / 1440), existing = s.vehicles.find((v) => v.id === RENTAL_VEHICLE_ID), lot = PARKING_LOTS[0], lane = pointOnLane(lot.lane, lot.progress);
    if (!existing)
      s.vehicles.push({
        id: RENTAL_VEHICLE_ID,
        location: { ...lot.point, scene: "outside" },
        heading: lane.heading,
        speed: 0,
        driverId: null,
        lane: lot.lane,
        progress: lot.progress,
        color: 6792608
      });
    const account2 = "rental:" + RENTAL_VEHICLE_ID;
    if (!Object.hasOwn(s.accounts, account2)) {
      s.accounts[account2] = 0;
      s.ledgerCheckpoint.balances[account2] = 0;
    }
    return {
      version: 1,
      weather: { kind: weatherAt(s.seed, day), day },
      speed: 1,
      parking: PARKING_LOTS.map((p, i) => ({
        id: p.id,
        capacity: p.capacity,
        vehicleIds: i === 0 ? [RENTAL_VEHICLE_ID] : []
      })),
      rentals: [
        {
          id: "rental-station",
          vehicleId: RENTAL_VEHICLE_ID,
          renterId: null,
          startTick: 0,
          endTick: 0,
          deposit: 0,
          status: "available"
        }
      ],
      trip: null
    };
  }
  var weatherEffects = (s) => WEATHER[s.mobility.weather.kind];
  function parkedAt(s, vehicleId) {
    return s.mobility.parking.find((p) => p.vehicleIds.includes(vehicleId))?.id ?? null;
  }
  function rentalAccess(s, vehicleId) {
    const r = s.mobility.rentals.find((x) => x.vehicleId === vehicleId);
    return r && r.renterId !== "player" ? "Bu ara\xE7 i\xE7in \xF6nce kiralama s\xF6zle\u015Fmesi yap." : null;
  }
  function unparkVehicle(s, vehicleId) {
    const parked = s.mobility.parking.find((p) => p.vehicleIds.includes(vehicleId));
    if (!parked) return;
    const lot = PARKING_LOTS.find((p) => p.id === parked.id), v = s.vehicles.find((x) => x.id === vehicleId), point = pointOnLane(lot.lane, lot.progress);
    parked.vehicleIds = parked.vehicleIds.filter((id) => id !== vehicleId);
    v.lane = lot.lane;
    v.progress = lot.progress;
    v.heading = point.heading;
    v.location = { x: point.x, y: point.y, scene: "outside" };
  }
  function applyMobilityCommand(s, c) {
    const a = c.args, p = s.player, m = s.mobility;
    if (m.trip && !["STOP", "USE_ITEM", "SET_TIME_SPEED"].includes(c.type))
      return bad("Otob\xFCs yolculu\u011Fu s\xFCr\xFCyor. Var\u0131\u015Fta di\u011Fer eylemler a\xE7\u0131l\u0131r.");
    switch (c.type) {
      case "SET_TIME_SPEED": {
        if (![0.5, 1, 2].includes(Number(a.speed)) || typeof a.speed !== "number")
          return bad("Zaman h\u0131z\u0131 0,5 / 1 / 2 olabilir.");
        m.speed = a.speed;
        emit(s, "time_speed", "Zaman ak\u0131\u015F h\u0131z\u0131 de\u011Fi\u015Fti.", ["player"], null, "private");
        return good("Zaman h\u0131z\u0131 " + m.speed + "\xD7.");
      }
      case "TRANSIT_RIDE": {
        const from = TRANSIT_STOPS.find((x) => nearby(s, x.point)), to = TRANSIT_STOPS.find((x) => x.id === a.stopId);
        if (!from || !to || from.id === to.id)
          return bad("Bir dura\u011Fa yakla\u015F ve farkl\u0131 bir var\u0131\u015F dura\u011F\u0131 se\xE7.");
        if (p.vehicleId || p.shift || p.wanted || Number(s.flags.trainingUntil ?? 0) > s.minute || s.life.enrollments.some(
          (e) => e.personId === "player" && e.status === "enrolled" && (e.activeUntil ?? 0) > s.minute
        ))
          return bad("Ara\xE7, i\u015F, ders veya polis takibi s\u0131ras\u0131nda otob\xFCse binilemez.");
        if (!transfer(s, "bus:" + c.id, "player", "business:taxi", TRANSIT_FARE, "transit-fare"))
          return bad("Otob\xFCs \xFCcreti i\xE7in25TL gerekir.");
        const minutes = 8 + Math.ceil(distance(from.point, to.point) / 4);
        m.trip = {
          id: "trip:" + c.id,
          fromStop: from.id,
          toStop: to.id,
          arrivalTick: s.tick + minutes * 10,
          startedTick: s.tick,
          fare: TRANSIT_FARE
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
          from.name + " \u2192 " + to.name + "; \xFCcret bir kez \xF6dendi.",
          ["player"],
          to.id,
          "private"
        );
        return good(minutes + " dakikal\u0131k yolculuk ba\u015Flad\u0131.");
      }
      case "RENT_VEHICLE": {
        const r = m.rentals.find((x) => x.vehicleId === a.vehicleId), v = s.vehicles.find((x) => x.id === a.vehicleId), days = a.days;
        if (!r || !v || r.status !== "available" || !nearby(s, v.location) || p.vehicleId || v.driverId)
          return bad("Bo\u015F kiral\u0131k arac\u0131n yan\u0131na yakla\u015F.");
        if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 3)
          return bad("Kiralama s\xFCresi1\u20133g\xFCn olmal\u0131.");
        const fee = RENTAL_DAILY_FEE * days;
        if (s.accounts.player < fee + RENTAL_DEPOSIT)
          return bad("Kira ve iade edilebilir depozito i\xE7in yeterli paran yok.");
        if (!transfer(s, "rent-fee:" + c.id, "player", "business:garage", fee, "vehicle-rental"))
          return bad("Kira \xF6demesi ba\u015Far\u0131s\u0131z.");
        if (!transfer(
          s,
          "rent-deposit:" + c.id,
          "player",
          "rental:" + r.vehicleId,
          RENTAL_DEPOSIT,
          "vehicle-rental-deposit"
        ))
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
          "Ara\xE7 kiraland\u0131; depozito ayr\u0131 hesapta tutuluyor.",
          ["player"],
          r.vehicleId,
          "private"
        );
        return good("Ara\xE7 haz\u0131r. S\xFCre bitince otoparka b\u0131rak\u0131p iade et.");
      }
      case "PARK_VEHICLE": {
        const lot = PARKING_LOTS.find((x) => x.id === a.parkingId), record = m.parking.find((x) => x.id === a.parkingId), v = s.vehicles.find((x) => x.id === p.vehicleId);
        if (!lot || !record || !v || !nearby(s, lot.point) || v.speed > 0.6)
          return bad("Park alan\u0131n\u0131n yan\u0131nda arac\u0131 durdur.");
        if (record.vehicleIds.length >= record.capacity) return bad("Otopark dolu; ba\u015Fka alan se\xE7.");
        const slot = { x: lot.point.x + (record.vehicleIds.length ? 1.2 : 0), y: lot.point.y };
        if (!isWalkable(slot)) return bad("Park alan\u0131 eri\u015Filemiyor.");
        record.vehicleIds.push(v.id);
        v.driverId = null;
        v.speed = 0;
        v.location = { ...slot, scene: "outside" };
        p.vehicleId = null;
        p.location = { x: slot.x, y: slot.y + 0.8, scene: "outside" };
        if (!isWalkable(p.location)) p.location = { ...slot, scene: "outside" };
        s.flags.throttle = 0;
        s.flags.steer = 0;
        emit(s, "vehicle_parked", lot.name + " alan\u0131na park edildi.", ["player"], v.id, "private");
        return good("Park yeri ayr\u0131ld\u0131. Ara\xE7tan indin.");
      }
      case "RETURN_RENTAL": {
        const r = m.rentals.find((x) => x.vehicleId === a.vehicleId), v = s.vehicles.find((x) => x.id === a.vehicleId);
        if (!r || !v || r.renterId !== "player" || r.status === "available" || v.driverId || !parkedAt(s, v.id) || !nearby(s, v.location))
          return bad("Kiral\u0131k arac\u0131 otoparka park et, in ve yan\u0131nda iade et.");
        const overdue = Math.max(0, s.tick - r.endTick), penalty = Math.min(r.deposit, Math.ceil(overdue / DAY_TICKS) * 5e3), refund = r.deposit - penalty, account2 = "rental:" + r.vehicleId;
        if (penalty && !transfer(s, "rental-late:" + c.id, account2, "business:garage", penalty, "rental-late-fee"))
          throw new Error("Rental penalty invariant");
        if (refund && !transfer(s, "rental-refund:" + c.id, account2, "player", refund, "rental-deposit-refund"))
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
          "Ara\xE7 iade edildi; depozito ve varsa a\xE7\u0131k gecikme \xFCcreti hesapland\u0131.",
          ["player"],
          v.id,
          "private"
        );
        return good(refund / 100 + "TL depozito iade edildi.");
      }
      default:
        return null;
    }
  }
  function mobilityTick(s) {
    const m = s.mobility;
    if (m.trip && s.tick >= m.trip.arrivalTick) {
      const stop2 = TRANSIT_STOPS.find((x) => x.id === m.trip.toStop);
      s.player.location = { ...stop2.point, scene: "outside" };
      s.player.goal = "explore";
      s.player.path = [];
      s.player.destination = null;
      emit(s, "transit_arrival", stop2.name + " dura\u011F\u0131na ula\u015Ft\u0131n.", ["player"], stop2.id, "private");
      m.trip = null;
      notify(s, "Otob\xFCs yolculu\u011Fu tamamland\u0131.");
    }
    for (const r of m.rentals)
      if (r.status === "active" && s.tick >= r.endTick) {
        r.status = "overdue";
        notify(s, "Kiralama s\xFCresi bitti. \u0130ade gecikme \xFCcreti g\xFCnl\xFCk50TL; depozito ile s\u0131n\u0131rl\u0131d\u0131r.");
      }
  }
  function mobilityMinute(s) {
    const day = Math.floor(s.minute / 1440);
    if (s.mobility.weather.day !== day) {
      const kind = weatherAt(s.seed, day);
      s.mobility.weather = { kind, day };
      emit(
        s,
        "weather_change",
        "Bug\xFCn hava " + WEATHER[kind].label.toLocaleLowerCase("tr-TR") + ".",
        [],
        null,
        "public"
      );
    }
    if (s.minute % 15 === 0 && s.player.location.scene === "outside" && !s.mobility.trip && (s.mobility.weather.kind === "rain" || s.mobility.weather.kind === "wind"))
      s.player.fatigue = clamp(s.player.fatigue + 1);
  }
  function mobilityView(s) {
    const m = s.mobility, from = TRANSIT_STOPS.find((x) => nearby(s, x.point));
    return {
      speed: m.speed,
      weather: { ...m.weather, ...WEATHER[m.weather.kind] },
      stops: TRANSIT_STOPS.map((x) => ({
        ...x,
        point: { ...x.point },
        fare: TRANSIT_FARE,
        minutes: from ? 8 + Math.ceil(distance(from.point, x.point) / 4) : 0,
        nearby: nearby(s, x.point)
      })),
      parking: PARKING_LOTS.map((x) => {
        const r = m.parking.find((p) => p.id === x.id);
        return {
          id: x.id,
          name: x.name,
          point: { ...x.point },
          capacity: r.capacity,
          occupied: r.vehicleIds.length,
          available: r.capacity - r.vehicleIds.length
        };
      }),
      rentals: m.rentals.map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        location: { ...s.vehicles.find((v) => v.id === r.vehicleId).location },
        name: "Usta \u0130\u015Fi kiral\u0131k otomobil",
        dailyFee: RENTAL_DAILY_FEE,
        deposit: RENTAL_DEPOSIT,
        status: r.status,
        endsAt: r.status === "available" ? null : r.endTick,
        parkedAt: parkedAt(s, r.vehicleId)
      })),
      trip: m.trip ? { ...m.trip, remainingMinutes: Math.max(0, Math.ceil((m.trip.arrivalTick - s.tick) / 10)) } : null,
      starterVehicleId: "v0"
    };
  }
  function validateMobility(s) {
    const errors = [], m = s.mobility;
    if (!m || m.version !== 1) return ["missing-mobility"];
    if (![0.5, 1, 2].includes(m.speed)) errors.push("invalid-time-speed");
    if (!Object.hasOwn(WEATHER, m.weather.kind) || m.weather.day !== Math.floor(s.minute / 1440) || m.weather.kind !== weatherAt(s.seed, m.weather.day))
      errors.push("invalid-weather");
    const parked = /* @__PURE__ */ new Set();
    if (m.parking.length !== PARKING_LOTS.length) errors.push("invalid-parking-count");
    for (const r of m.parking) {
      const def = PARKING_LOTS.find((p) => p.id === r.id);
      if (!def || def.capacity !== r.capacity || r.vehicleIds.length > r.capacity)
        errors.push("invalid-parking:" + r.id);
      for (const id of r.vehicleIds) {
        const v = s.vehicles.find((x) => x.id === id);
        if (parked.has(id) || !v || v.driverId || v.speed !== 0 || !def || distance(v.location, def.point) > 1.5)
          errors.push("invalid-parked-vehicle:" + id);
        parked.add(id);
      }
    }
    if (m.rentals.length !== 1 || m.rentals[0].vehicleId !== RENTAL_VEHICLE_ID)
      errors.push("invalid-rental-registry");
    for (const r of m.rentals) {
      const v = s.vehicles.find((x) => x.id === r.vehicleId);
      if (!v || !["available", "active", "overdue"].includes(r.status) || s.accounts["rental:" + r.vehicleId] !== r.deposit || !Number.isSafeInteger(r.deposit) || r.deposit < 0)
        errors.push("invalid-rental:" + r.id);
      if (r.status === "available" && (r.renterId !== null || r.deposit !== 0 || v?.driverId || !parked.has(r.vehicleId)))
        errors.push("invalid-available-rental");
      if (r.status !== "available" && (r.renterId !== "player" || r.deposit !== RENTAL_DEPOSIT || !Number.isSafeInteger(r.startTick) || !Number.isSafeInteger(r.endTick) || r.endTick <= r.startTick || r.endTick - r.startTick > 3 * DAY_TICKS || (r.endTick - r.startTick) % DAY_TICKS !== 0))
        errors.push("invalid-active-rental");
    }
    if (m.trip) {
      const t = m.trip, from = TRANSIT_STOPS.find((x) => x.id === t.fromStop), to = TRANSIT_STOPS.find((x) => x.id === t.toStop);
      if (!from || !to || from === to || !Number.isSafeInteger(t.arrivalTick) || t.arrivalTick <= s.tick || !Number.isSafeInteger(t.startedTick) || t.startedTick > s.tick || t.fare !== TRANSIT_FARE || from && to && t.arrivalTick !== t.startedTick + (8 + Math.ceil(distance(from.point, to.point) / 4)) * 10 || s.player.vehicleId || s.player.goal !== "transit" || s.player.location.scene !== "outside" || from && distance(s.player.location, from.point) > 0.01)
        errors.push("invalid-transit-trip");
    }
    return errors;
  }

  // src/games/social-engine/simulation/traffic.ts
  var dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  var RESERVATION_RADIUS = 1.25;
  function trafficContext(s) {
    const drivers = new Set(s.vehicles.map((v) => v.driverId));
    return {
      cars: s.vehicles.filter((v) => !parkedAt(s, v.id)),
      pedestrians: [s.player, ...s.npcs.slice(0, 100)].filter(
        (p) => p.alive && !drivers.has(p.id) && p.location.scene === "outside"
      )
    };
  }
  function mayAdvanceVehicle(s, car, next, context = trafficContext(s)) {
    const moving = context.cars.filter((v) => v.id !== car.id);
    if (moving.some(
      (other) => dist(next, other.location) < 1.4 && dist(next, other.location) < dist(car.location, other.location) - 1e-3
    ))
      return false;
    const pedestrians = context.pedestrians;
    if (pedestrians.some(
      (p) => Math.abs(next.x - p.location.x) < 0.8 && Math.abs(next.y - p.location.y) < 0.8 && dist(next, p.location) < 0.8 && dist(next, p.location) < dist(car.location, p.location) - 1e-3
    ))
      return false;
    for (const junction of JUNCTIONS) {
      if (dist(next, junction) > RESERVATION_RADIUS) continue;
      const occupants = moving.filter((v) => dist(v.location, junction) <= RESERVATION_RADIUS);
      if (occupants.length && dist(car.location, junction) > RESERVATION_RADIUS) return false;
      if (dist(car.location, junction) <= RESERVATION_RADIUS) continue;
      const axis = Math.abs(next.x - car.location.x) >= Math.abs(next.y - car.location.y) ? "horizontal" : "vertical";
      if (signalAxis(s.tick, junction) !== axis) return false;
    }
    return true;
  }

  // src/games/social-engine/simulation/services.ts
  var HOURS = {
    market: [360, 1380],
    tea: [360, 1440],
    restaurant: [480, 1440],
    garage: [480, 1200],
    warehouse: [360, 1320],
    office: [480, 1080],
    school: [480, 1200],
    bank: [480, 1080]
  };
  var MAX_QUEUE = 64;
  function serviceHours(businessId) {
    return HOURS[businessId] ?? [0, 1440];
  }
  function serviceOpen(s, b) {
    const [opens, closes] = serviceHours(b.id), hour = s.minute % 1440;
    return b.status !== "closed" && hour >= opens && hour < closes;
  }
  function initializeServices(s) {
    return Object.fromEntries(
      s.businesses.map((b) => [
        b.id,
        {
          id: `service:${b.id}`,
          schemaVersion: 1,
          updatedTick: s.tick,
          servedMinute: s.minute,
          served: 0,
          queue: []
        }
      ])
    );
  }
  function present(s, p, b) {
    if (!p.alive) return false;
    if (p.location.scene === b.buildingId) return true;
    const door = BUILDINGS.find((x) => x.id === b.buildingId).door;
    return p.location.scene === "outside" && Math.hypot(p.location.x - door.x, p.location.y - door.y) <= 1.8;
  }
  function clean(s, b) {
    const desk = s.economy.services[b.id];
    if (desk.servedMinute !== s.minute) {
      desk.servedMinute = s.minute;
      desk.served = 0;
      desk.updatedTick = s.tick;
    }
    const length = desk.queue.length;
    desk.queue = desk.queue.filter((q) => {
      const p = q.personId === "player" ? s.player : s.npcs.find((n) => n.id === q.personId);
      return p && q.expiresAt > s.minute && present(s, p, b) && serviceOpen(s, b);
    });
    if (length !== desk.queue.length) desk.updatedTick = s.tick;
    return desk;
  }
  function requestService(s, b, p) {
    const [opens, closes] = serviceHours(b.id);
    const hour = (v) => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
    if (!serviceOpen(s, b))
      return { ok: false, reason: `Tezg\xE2h kapal\u0131. Hizmet saatleri ${hour(opens)}\u2013${hour(closes)}.` };
    if (!present(s, p, b)) return { ok: false, reason: "S\u0131raya kat\u0131lmak i\xE7in i\u015Fletmeye yakla\u015F." };
    const desk = clean(s, b);
    if (!desk.queue.some((q) => q.personId === p.id)) {
      if (desk.queue.length >= MAX_QUEUE)
        return { ok: false, reason: "\u0130\u015Fletmenin bekleme alan\u0131 dolu; biraz sonra tekrar dene." };
      desk.queue.push({
        id: `queue:${b.id}:${p.id}:${s.tick}`,
        personId: p.id,
        joinedAt: s.minute,
        expiresAt: s.minute + 15
      });
      desk.updatedTick = s.tick;
    }
    const first = desk.queue[0].personId === p.id;
    return first && desk.served < 12 ? { ok: true, reason: "" } : {
      ok: false,
      reason: "S\u0131ran korunuyor. Tezg\xE2h\u0131n yan\u0131ndan ayr\u0131lmadan k\u0131sa s\xFCre sonra yeniden dene."
    };
  }
  function finishService(s, b, id) {
    const desk = s.economy.services[b.id];
    if (desk.queue[0]?.personId !== id || desk.served >= 12)
      throw Error("Service reservation mismatch");
    desk.queue.shift();
    desk.served++;
    desk.updatedTick = s.tick;
  }
  function requestNpcMeal(s, p) {
    const b = s.businesses.find((b2) => b2.id === "market");
    if (p.age >= 18 && p.hunger >= 45 && p.goal === "eat" && present(s, p, b) && s.accounts[p.id] >= b.prices.simit && b.stock.simit > 0)
      requestService(s, b, p);
  }
  function servicesMinute(s) {
    for (const b of s.businesses) {
      const desk = clean(s, b);
      while (desk.queue.length && desk.served < 12) {
        const first = desk.queue[0];
        if (first.personId === "player") break;
        const p = s.npcs.find((n) => n.id === first.personId);
        if (b.id !== "market" || p.hunger < 45 || p.age < 18 || s.accounts[p.id] < b.prices.simit || b.stock.simit < 1) {
          desk.queue.shift();
          desk.updatedTick = s.tick;
          continue;
        }
        if (!transfer(
          s,
          `meal:v5:${b.id}:${first.id.split(":").at(-1)}:${p.id}`,
          p.id,
          `business:${b.id}`,
          b.prices.simit,
          "food"
        ))
          throw Error("Reserved meal could not settle");
        b.stock.simit--;
        b.sales += b.prices.simit;
        p.expenses += b.prices.simit;
        p.hunger = Math.max(0, p.hunger - 40);
        s.economy.lastDemand["market:simit"] = (s.economy.lastDemand["market:simit"] ?? 0) + 1;
        finishService(s, b, p.id);
      }
    }
  }
  function validateServices(s) {
    const services = s.economy.services, errors = [];
    if (!services || Object.keys(services).length !== s.businesses.length)
      return ["invalid-service-desks"];
    for (const b of s.businesses) {
      const d = services[b.id];
      if (!d || d.id !== `service:${b.id}` || d.schemaVersion !== 1 || !Number.isSafeInteger(d.updatedTick) || d.updatedTick < 0 || d.updatedTick > s.tick || !Number.isSafeInteger(d.servedMinute) || d.servedMinute > s.minute || !Number.isInteger(d.served) || d.served < 0 || d.served > 12 || !Array.isArray(d.queue) || d.queue.length > MAX_QUEUE) {
        errors.push("invalid-service-desk:" + b.id);
        continue;
      }
      const seen = /* @__PURE__ */ new Set();
      for (const q of d.queue) {
        const p = q.personId === "player" ? s.player : s.npcs.find((n) => n.id === q.personId);
        if (!p || seen.has(q.personId) || typeof q.id !== "string" || !q.id.startsWith(`queue:${b.id}:${q.personId}:`) || !/^(0|[1-9]\d*)$/.test(q.id.slice(`queue:${b.id}:${q.personId}:`.length)) || !Number.isSafeInteger(Number(q.id.slice(`queue:${b.id}:${q.personId}:`.length))) || Number(q.id.slice(`queue:${b.id}:${q.personId}:`.length)) > s.tick || !Number.isSafeInteger(q.joinedAt) || q.joinedAt > s.minute || q.expiresAt !== q.joinedAt + 15)
          errors.push("invalid-service-reservation:" + b.id);
        seen.add(q.personId);
      }
    }
    return errors;
  }

  // src/games/social-engine/domain/content.ts
  var ENGINE_VERSION = "1.0.0-candidate.4";
  var SCHEMA_VERSION = 5;
  var TICKS_PER_MINUTE = 10;
  var LOCAL_POPULATION = 100;
  var BACKGROUND_POPULATION = 1e3;
  var JOBS = [
    {
      id: "retail",
      name: "Market g\xF6revlisi",
      businessId: "market",
      skill: "trade",
      wage: 9500,
      duration: 60
    },
    {
      id: "courier",
      name: "Kurye",
      businessId: "warehouse",
      skill: "driving",
      wage: 11500,
      duration: 60
    },
    {
      id: "taxi",
      name: "Taksi \u015Fof\xF6r\xFC",
      businessId: "taxi",
      skill: "driving",
      wage: 13500,
      duration: 60
    },
    {
      id: "waiter",
      name: "\xC7ayevi garsonu",
      businessId: "tea",
      skill: "communication",
      wage: 10500,
      duration: 60
    },
    {
      id: "mechanic",
      name: "Tamirci",
      businessId: "garage",
      skill: "technical",
      wage: 14500,
      duration: 60
    },
    {
      id: "warehouse",
      name: "Depo g\xF6revlisi",
      businessId: "warehouse",
      skill: "body",
      wage: 12e3,
      duration: 60
    },
    {
      id: "office",
      name: "Ofis asistan\u0131",
      businessId: "office",
      skill: "academic",
      wage: 15500,
      duration: 60
    },
    {
      id: "security",
      name: "G\xFCvenlik g\xF6revlisi",
      businessId: "police",
      skill: "discipline",
      wage: 14e3,
      duration: 60
    },
    {
      id: "teaching",
      name: "E\u011Fitim asistan\u0131",
      businessId: "school",
      skill: "academic",
      wage: 17e3,
      duration: 60
    },
    {
      id: "sales",
      name: "Sat\u0131\u015F dan\u0131\u015Fman\u0131",
      businessId: "bank",
      skill: "trade",
      wage: 12500,
      duration: 60
    }
  ];
  var ITEMS = {
    simit: { name: "Simit", price: 1800, hunger: 25, health: 0, weight: 1 },
    tea: { name: "\xC7ay", price: 1200, hunger: 8, health: 0, weight: 1 },
    meal: { name: "Ev yeme\u011Fi", price: 7500, hunger: 65, health: 5, weight: 2 },
    medicine: { name: "\u0130lk yard\u0131m kiti", price: 9500, hunger: 0, health: 45, weight: 1 },
    parts: { name: "Yedek par\xE7a", price: 5500, hunger: 0, health: 0, weight: 3 },
    book: { name: "Kurs kitab\u0131", price: 4200, hunger: 0, health: 0, weight: 2 }
  };
  var FIRST_NAMES = [
    "Deniz",
    "Ece",
    "Mert",
    "Selin",
    "Cem",
    "Derya",
    "Bora",
    "\u0130pek",
    "Can",
    "Asl\u0131",
    "Ozan",
    "Elif",
    "Arda",
    "Aylin",
    "Kerem",
    "Defne",
    "Umut",
    "Seda",
    "Onur",
    "Leyla"
  ];
  var LAST_NAMES = [
    "Yel",
    "Koru",
    "Acar",
    "Durul",
    "Ilg\u0131n",
    "Sarp",
    "K\u0131y\u0131",
    "Aksoy",
    "Demir",
    "\xC7\u0131nar",
    "Eren",
    "Ar\u0131n"
  ];
  var FACTIONS = [
    { id: "dock", name: "R\u0131ht\u0131m Dayan\u0131\u015Fmas\u0131", approach: "Mahalle esnaf\u0131n\u0131 bir arada tutar." },
    { id: "hill", name: "Yoku\u015F Birli\u011Fi", approach: "Kuryeler ve gen\xE7 \xE7al\u0131\u015Fanlar\u0131n s\xF6z\xFCn\xFC ta\u015F\u0131r." },
    { id: "night", name: "Gece Masas\u0131", approach: "Borcun ve n\xFCfuzun tehlikeli taraf\u0131nda durur." }
  ];
  var event = (kind, title, trigger, location, effects, reward) => ({
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
    reward
  });
  var EVENT_TEMPLATES = [
    event(
      "job_offer",
      "\xC7ar\u015F\u0131da bir yer a\xE7\u0131ld\u0131",
      "open-employer-vacancy",
      "market",
      ["employment", "reference"],
      4e3
    ),
    event(
      "late_wage",
      "Geciken zarf",
      "distressed-employer",
      "garage",
      ["payroll-arrears", "trust"],
      6500
    ),
    event("layoff", "Kapanan vardiya", "closed-employer", "office", ["job-loss", "retraining"], 7e3),
    event("promotion", "Bir ad\u0131m yukar\u0131", "skill-earned", "office", ["wage", "responsibility"], 6e3),
    event(
      "rent_rise",
      "Apartman toplant\u0131s\u0131",
      "weekly-rent-review",
      "home",
      ["rent", "mediation"],
      5500
    ),
    event("loan_due", "Vadesi gelen s\xF6z", "outstanding-loan", "bank", ["debt", "reputation"], 5e3),
    event(
      "price_shock",
      "\xC7ar\u015F\u0131daki dalga",
      "weekly-stock-review",
      "market",
      ["prices", "trade"],
      6e3
    ),
    event("shortage", "Raf\u0131n eksik par\xE7as\u0131", "low-stock", "garage", ["stock", "sales"], 8500),
    event(
      "delivery",
      "R\u0131ht\u0131ma bir paket",
      "reserved-inventory",
      "warehouse",
      ["delivery", "income"],
      8e3
    ),
    event(
      "vehicle_breakdown",
      "Yolda kalan usta",
      "vehicle-wear",
      "garage",
      ["repair", "technical"],
      9e3
    ),
    event(
      "traffic_jam",
      "Dar sokakta d\xFC\u011F\xFCm",
      "lane-congestion",
      "taxi",
      ["traffic", "goodwill"],
      5e3
    ),
    event("lost_item", "Tezg\xE2hta unutulan", "public-item-found", "tea", ["ownership", "trust"], 4500),
    event(
      "neighbor_help",
      "Kom\u015Funun y\xFCk\xFC",
      "household-need",
      "home",
      ["belonging", "reputation"],
      4500
    ),
    event(
      "friend_invite",
      "Bir \xE7ayl\u0131k zaman",
      "positive-relationship",
      "tea",
      ["affection", "fatigue"],
      3500
    ),
    event(
      "relationship_dispute",
      "K\u0131rg\u0131n iki kom\u015Fu",
      "low-trust",
      "restaurant",
      ["mediation", "resentment"],
      6500
    ),
    event(
      "scholarship",
      "A\xE7\u0131k ders",
      "education-opportunity",
      "school",
      ["academic", "certificate"],
      5e3
    ),
    event(
      "neighborhood_argument",
      "Sokaktaki sesler",
      "local-conflict",
      "market",
      ["fear", "trust"],
      6500
    ),
    event(
      "witness_report",
      "G\xF6rd\xFC\u011F\xFCn\xFC s\xF6yle",
      "witnessed-crime",
      "police",
      ["evidence", "justice"],
      7500
    ),
    event("police_check", "R\u0131ht\u0131m kontrol\xFC", "reported-incident", "police", ["case", "safety"], 4e3),
    event(
      "faction_truce",
      "Ayn\u0131 masaya oturmak",
      "influence-dispute",
      "restaurant",
      ["influence", "truce"],
      1e4
    )
  ];

  // src/games/social-engine/simulation/economy.ts
  var DAY = 1440;
  var MAX_ATTENDANCE = 480;
  var resources = {
    simit: "grain",
    tea: "herbs",
    meal: "produce",
    medicine: "medical",
    parts: "metal",
    book: "paper"
  };
  var key = (personId, businessId) => personId + "|" + businessId;
  var caches = /* @__PURE__ */ new WeakMap();
  function people(s) {
    let cache2 = caches.get(s);
    if (!cache2 || cache2.count !== s.npcs.length) {
      cache2 = { count: s.npcs.length, people: new Map(s.npcs.map((n) => [n.id, n])) };
      caches.set(s, cache2);
    }
    return cache2.people;
  }
  function initializeEconomy(s) {
    if (!Object.hasOwn(s.accounts, "wholesaler")) {
      s.accounts.wholesaler = 0;
      s.ledgerCheckpoint.balances.wholesaler = 0;
    }
    return {
      version: 1,
      services: initializeServices(s),
      attendance: {},
      activeWork: {},
      travel: {},
      arrivals: [],
      arrivalSortNeeded: false,
      inputs: Object.fromEntries(
        s.businesses.map((b) => [
          b.id,
          Object.fromEntries(Object.values(resources).map((x) => [x, 0]))
        ])
      ),
      wholesaler: Object.fromEntries(
        Object.values(resources).map((x) => [x, x === "grain" ? 1e7 : 1e6])
      ),
      produced: {},
      consumedInputs: {},
      tax: s.businesses.map((b) => ({
        businessId: b.id,
        salesAssessed: b.sales,
        paid: 0,
        arrears: 0
      })),
      shocks: [],
      cooldowns: {},
      eventCursor: s.events.length,
      lastDailyAt: Math.floor(s.minute / DAY) * DAY,
      lastPayroll: [],
      lastDemand: {}
    };
  }
  function finish(s, r) {
    if (r.since !== null) {
      r.minutes = Math.min(MAX_ATTENDANCE, r.minutes + Math.max(0, s.minute - r.since));
      r.since = null;
    }
  }
  function attendance(s, n) {
    const e = s.economy, business = s.businesses.find((b) => b.id === n.employerId), working = n.alive && n.age >= 18 && n.goal === "work" && business?.status !== "closed" && n.location.scene === business?.buildingId;
    const previous = e.activeWork[n.id];
    if (previous && (!working || e.attendance[previous]?.businessId !== n.employerId)) {
      if (e.attendance[previous]) finish(s, e.attendance[previous]);
      delete e.activeWork[n.id];
    }
    if (!business) return;
    const id = key(n.id, business.id);
    let r = e.attendance[id];
    if (working) {
      r ??= e.attendance[id] = {
        personId: n.id,
        businessId: business.id,
        minutes: 0,
        since: null,
        day: Math.floor(s.minute / DAY)
      };
      if (r.since === null) r.since = s.minute;
      e.activeWork[n.id] = id;
    } else if (r) finish(s, r);
  }
  function scheduleBackgroundTravel(s, n, plan, index) {
    const e = s.economy, current = e.travel[n.id];
    if (current?.to.scene === plan.building && current.goal === plan.goal) return;
    if (current) delete e.travel[n.id];
    if (n.location.scene === plan.building) {
      n.goal = plan.goal;
      attendance(s, n);
      return;
    }
    const target = BUILDINGS.find((b) => b.id === plan.building), origin = BUILDINGS.find((b) => b.id === n.location.scene);
    if (!target) return;
    const from = origin?.door ?? n.location, path = findPath(from, target.door);
    if (!path.length) {
      n.goal = "idle";
      return;
    }
    n.goal = "travel";
    attendance(s, n);
    let length = 0, point = from;
    for (const next of path) {
      length += Math.hypot(next.x - point.x, next.y - point.y);
      point = next;
    }
    const duration = Math.max(2, Math.ceil((length + 2) / 1.6)), id = `trip:${n.id}:${s.minute}`;
    const trip = {
      id,
      personId: n.id,
      from: { ...n.location },
      to: { x: 4 + index % 5, y: 6 + index % 3, scene: plan.building },
      goal: plan.goal,
      departedAt: s.minute,
      arrivalAt: s.minute + duration
    };
    e.travel[n.id] = trip;
    e.arrivals.push({ personId: n.id, tripId: id, minute: trip.arrivalAt });
    e.arrivalSortNeeded = true;
    n.lastDecision = s.minute;
  }
  function economyMinute(s) {
    servicesMinute(s);
    const e = s.economy;
    if (e.arrivalSortNeeded) {
      e.arrivals.sort((a, b) => a.minute - b.minute || a.personId.localeCompare(b.personId, "en"));
      e.arrivalSortNeeded = false;
    }
    let used = 0;
    while (used < e.arrivals.length && e.arrivals[used].minute <= s.minute) {
      const arrival = e.arrivals[used++], trip = e.travel[arrival.personId];
      if (!trip || trip.id !== arrival.tripId) continue;
      const n = people(s).get(trip.personId);
      delete e.travel[trip.personId];
      if (!n?.alive) continue;
      n.location = { ...trip.to };
      n.goal = trip.goal;
      attendance(s, n);
    }
    if (used) e.arrivals.splice(0, used);
    for (const n of s.npcs.slice(0, 100)) attendance(s, n);
    for (const shock of e.shocks)
      if (shock.status === "active" && s.minute >= shock.endsAt) shock.status = "ended";
    for (const [id, trip] of Object.entries(e.travel)) {
      const n = people(s).get(id);
      if (!n?.alive) {
        delete e.travel[id];
        continue;
      }
      if (n.location.scene !== trip.from.scene || Math.hypot(n.location.x - trip.from.x, n.location.y - trip.from.y) > 1e-3)
        delete e.travel[id];
    }
  }
  function closeAttendanceDay(s) {
    for (const r of Object.values(s.economy.attendance)) finish(s, r);
    s.economy.lastPayroll = [];
  }
  function attendedWage(s, n, wage) {
    const r = s.economy.attendance[key(n.id, n.employerId ?? "")], minutes = r?.minutes ?? 0, amount2 = Math.floor(wage * Math.min(MAX_ATTENDANCE, minutes) / MAX_ATTENDANCE);
    s.economy.lastPayroll.push({ personId: n.id, businessId: n.employerId ?? "", minutes, amount: amount2 });
    return amount2;
  }
  function recordSale(s, businessId, item, quantity) {
    const id = businessId + ":" + item;
    s.economy.lastDemand[id] = (s.economy.lastDemand[id] ?? 0) + quantity;
  }
  function shockFactor(s, businessId) {
    return s.economy.shocks.filter((x) => x.status === "active" && (x.businessId === businessId || x.businessId === null)).reduce(
      (factor, x) => factor * (x.kind === "strike" ? 1 - x.severity / 100 : x.kind === "public-works" ? 0.8 : 1),
      1
    );
  }
  function startShock(s, kind, businessId, sourceEventId = null) {
    const e = s.economy, b = s.businesses.find((b2) => b2.id === businessId), idkey = kind + ":" + (businessId ?? "district");
    if (s.minute < (e.cooldowns[idkey] ?? 0) || e.shocks.some((x) => x.status === "active" && x.kind === kind && x.businessId === businessId))
      return null;
    if (kind === "strike" && (!b || b.status !== "distressed" || !b.employees.length)) return null;
    if (kind === "public-works" && (!b || b.status === "closed" || s.accounts.municipality < 5e3))
      return null;
    if (kind === "bankruptcy" && b?.status !== "closed") return null;
    if (kind === "shortage" && (!b || Object.values(b.stock).every((q) => q >= 8))) return null;
    if (kind === "recession" && !s.businesses.some((x) => x.status === "distressed")) return null;
    if ((kind === "migration" || kind === "rent") && !s.events.some(
      (x) => x.id === sourceEventId && x.kind === (kind === "migration" ? "household_moved" : "rent_rise")
    ))
      return null;
    const budget2 = kind === "strike" || kind === "public-works" ? 5e3 : 0, id = `shock:${s.nextId++}`;
    if (budget2) {
      const recipient = kind === "strike" ? b.employees.find((id2) => id2 !== "player") ?? "player" : "business:" + b.id;
      if (!transfer(
        s,
        id,
        "municipality",
        recipient,
        budget2,
        kind === "strike" ? "strike-subsistence" : "public-works-contract"
      ))
        return null;
    }
    const shock = {
      id,
      kind,
      businessId,
      startedAt: s.minute,
      endsAt: s.minute + (kind === "bankruptcy" ? 7 : 2) * DAY,
      severity: kind === "strike" ? 50 : 20,
      budget: budget2,
      status: "active",
      sourceEventId
    };
    e.shocks.push(shock);
    e.cooldowns[idkey] = s.minute + 14 * DAY;
    emit(
      s,
      "shock_" + kind,
      kind === "strike" ? "\xDCcret s\u0131k\u0131nt\u0131s\u0131 greve d\xF6n\xFC\u015Ft\xFC; ger\xE7ek \xFCretim iki g\xFCn yar\u0131ya indi." : kind === "public-works" ? "Belediye bak\u0131m s\xF6zle\u015Fmesi finanse edildi; i\u015Fyerinin \xFCretimi iki g\xFCn %20 yava\u015Flar." : "Mahallenin ekonomik ko\u015Fullar\u0131nda \xF6l\xE7\xFClen de\u011Fi\u015Fim kaydedildi.",
      b ? [b.ownerId] : [],
      businessId,
      "public",
      [],
      sourceEventId
    );
    if (e.shocks.length > 64)
      e.shocks = e.shocks.filter((x) => x.status === "active").concat(e.shocks.filter((x) => x.status === "ended").slice(-48));
    return shock;
  }
  function produceBusiness(s, b) {
    const e = s.economy, day = Math.floor(s.minute / DAY), worked = Object.values(e.attendance).filter((x) => x.businessId === b.id).reduce((n, x) => n + x.minutes, 0), labor = Math.min(
      1,
      worked / Math.max(1, b.employees.filter((id) => id !== "player").length * MAX_ATTENDANCE)
    );
    for (const item of Object.keys(b.stock).sort()) {
      const resource = resources[item];
      if (!resource || !ITEMS[item]) continue;
      const desired = Math.min(
        (item === "simit" ? 4500 : 1500) - b.stock[item],
        Math.floor(
          (item === "simit" ? 4800 : 25) * labor * shockFactor(s, b.id) * (s.mobility.weather.kind === "rain" ? 0.84 : 1)
        )
      );
      if (desired <= 0) continue;
      const unitCost = Math.max(1, Math.floor(ITEMS[item].price * 0.22)), available = Math.min(
        desired,
        e.wholesaler[resource],
        Math.floor(s.accounts["business:" + b.id] / unitCost)
      );
      if (available > 0 && transfer(
        s,
        `inputs:${day}:${b.id}:${item}`,
        "business:" + b.id,
        "wholesaler",
        available * unitCost,
        "production-inputs"
      )) {
        e.wholesaler[resource] -= available;
        e.inputs[b.id][resource] += available;
      }
      const output = Math.min(desired, e.inputs[b.id][resource]);
      e.inputs[b.id][resource] -= output;
      b.stock[item] += output;
      e.produced[item] = (e.produced[item] ?? 0) + output;
      e.consumedInputs[resource] = (e.consumedInputs[resource] ?? 0) + output;
    }
    if (day % 7 === 0)
      for (const item of Object.keys(b.prices).sort()) {
        const demand = e.lastDemand[b.id + ":" + item] ?? 0, pressure = demand > Math.max(1, b.stock[item]) ? 2 : b.stock[item] > 1e3 ? -2 : 0, weather = s.mobility.weather.kind === "rain" ? 1 : 0, delta = clamp(pressure + weather, -3, 3);
        b.prices[item] = Math.max(
          100,
          Math.min(1e5, Math.round(b.prices[item] * (100 + delta) / 100))
        );
        e.lastDemand[b.id + ":" + item] = 0;
      }
  }
  function reconcileStaffing(s) {
    const day = Math.floor(s.minute / DAY);
    for (const b of s.businesses) {
      const demand = Object.entries(s.economy.lastDemand).filter(([id]) => id.startsWith(b.id + ":")).reduce((n, [, units]) => n + units, 0);
      if (b.status !== "distressed" || b.employees.length <= 10 || b.stock.simit < 500 || demand >= b.employees.length || s.flags[`staffing:${b.id}`] === day)
        continue;
      const candidates = b.employees.filter((id) => id !== "player" && id !== b.ownerId).map((id) => people(s).get(id)).filter((p) => !!p && p.alive && p.age >= 18 && p.employerId === b.id);
      candidates.sort(
        (a, b2) => (s.economy.attendance[key(a.id, a.employerId)]?.minutes ?? 0) - (s.economy.attendance[key(b2.id, b2.employerId)]?.minutes ?? 0) || (a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0)
      );
      const person5 = candidates[0];
      if (!person5) continue;
      b.employees = b.employees.filter((id) => id !== person5.id);
      person5.employerId = null;
      person5.jobId = null;
      delete s.economy.activeWork[person5.id];
      s.flags[`staffing:${b.id}`] = day;
      emit(
        s,
        "layoff",
        `${person5.name}, sat\u0131lamayan stok ve daralan talep nedeniyle yeni bir i\u015F ar\u0131yor.`,
        [person5.id, b.ownerId],
        b.id,
        "public"
      );
    }
  }
  function economyDayEnd(s) {
    reconcileStaffing(s);
    const e = s.economy, day = Math.floor(s.minute / DAY);
    for (const tax of e.tax) {
      const b = s.businesses.find((b2) => b2.id === tax.businessId);
      const due = tax.arrears + Math.floor(Math.max(0, b.sales - tax.salesAssessed) * 2 / 100);
      let paid2 = Math.min(due, s.accounts["business:" + b.id]);
      if (paid2 && transfer(
        s,
        `sales-tax:${day}:${b.id}`,
        "business:" + b.id,
        "municipality",
        paid2,
        "business-sales-tax"
      ))
        tax.paid += paid2;
      else paid2 = 0;
      tax.arrears = due - paid2;
      tax.salesAssessed = b.sales;
    }
    for (const b of s.businesses) {
      if (b.status === "closed") startShock(s, "bankruptcy", b.id);
      else if (b.status === "distressed" && day % 5 === 0) startShock(s, "strike", b.id);
      if (Object.values(b.stock).some((x) => x < 8)) startShock(s, "shortage", b.id);
    }
    if (day % 10 === 0)
      startShock(s, "public-works", s.businesses[draw(s.seed, 915, day) % s.businesses.length].id);
    if (s.businesses.filter((b) => b.status === "distressed").length >= 2)
      startShock(s, "recession", null);
    for (; e.eventCursor < s.events.length; e.eventCursor++) {
      const event2 = s.events[e.eventCursor];
      if (event2.kind === "household_moved") startShock(s, "migration", null, event2.id);
      if (event2.kind === "rent_rise") startShock(s, "rent", null, event2.id);
    }
    e.attendance = {};
    e.activeWork = {};
    e.lastDailyAt = s.minute;
  }
  function economyView(s) {
    const e = s.economy, adults = s.npcs.filter((n) => n.alive && n.age >= 18), tax = e.tax;
    return {
      services: s.businesses.map((b) => ({
        businessId: b.id,
        opens: serviceHours(b.id)[0],
        closes: serviceHours(b.id)[1],
        open: serviceOpen(s, b),
        waiting: e.services[b.id].queue.length
      })),
      unemployment: Math.round(
        adults.filter((n) => !n.jobId).length * 100 / Math.max(1, adults.length)
      ),
      averageWage: Math.round(s.businesses.reduce((n, b) => n + b.wage, 0) / s.businesses.length),
      priceIndex: Math.round(
        s.businesses.reduce(
          (sum, b) => sum + Object.entries(b.prices).reduce(
            (n, [item, price]) => n + price / (ITEMS[item]?.price ?? price),
            0
          ) / Object.keys(b.prices).length,
          0
        ) * 100 / s.businesses.length
      ),
      sales: s.businesses.reduce((n, b) => n + b.sales, 0),
      taxPaid: tax.reduce((n, t) => n + t.paid, 0),
      taxArrears: tax.reduce((n, t) => n + t.arrears, 0),
      traveling: Object.keys(e.travel).length,
      attendedMinutes: e.lastPayroll.reduce((n, p) => n + p.minutes, 0),
      shocks: e.shocks.filter((x) => x.status === "active").map((x) => ({ ...x })),
      wholesaleUnits: Object.values(e.wholesaler).reduce((a, b) => a + b, 0),
      producedUnits: Object.values(e.produced).reduce((a, b) => a + b, 0)
    };
  }
  function validateEconomy(s) {
    const e = s.economy, errors = [];
    if (!e || e.version !== 1) return ["missing-economy"];
    errors.push(...validateServices(s));
    const people4 = new Map(s.npcs.map((n) => [n.id, n]));
    for (const r of Object.values(e.attendance)) {
      const n = people4.get(r.personId);
      if (!n || !Number.isInteger(r.minutes) || r.minutes < 0 || r.minutes > MAX_ATTENDANCE || r.since !== null && (!Number.isInteger(r.since) || r.since > s.minute) || !s.businesses.some((b) => b.id === r.businessId))
        errors.push("invalid-attendance");
    }
    for (const [id, t] of Object.entries(e.travel)) {
      const n = people4.get(id);
      if (!n?.alive || n.local || t.personId !== id || t.arrivalAt <= s.minute || t.departedAt > s.minute || !isWalkable(t.from, t.from.scene) || !isWalkable(t.to, t.to.scene) || n.location.scene !== t.from.scene || Math.hypot(n.location.x - t.from.x, n.location.y - t.from.y) > 1e-3)
        errors.push("invalid-background-travel:" + id);
    }
    for (const records of [e.wholesaler, e.produced, e.consumedInputs, ...Object.values(e.inputs)])
      for (const n of Object.values(records))
        if (!Number.isSafeInteger(n) || n < 0) errors.push("invalid-production-stock");
    for (const [resource, initial] of Object.entries(
      Object.fromEntries(
        Object.values(resources).map((x) => [x, x === "grain" ? 1e7 : 1e6])
      )
    )) {
      const total = e.wholesaler[resource] + Object.values(e.inputs).reduce((n, inputs) => n + (inputs[resource] ?? 0), 0) + (e.consumedInputs[resource] ?? 0);
      if (total !== initial) errors.push("unbalanced-production-input:" + resource);
    }
    for (const t of e.tax)
      if (!s.businesses.some((b) => b.id === t.businessId) || ![t.salesAssessed, t.paid, t.arrears].every((x) => Number.isSafeInteger(x) && x >= 0))
        errors.push("invalid-tax");
    for (const shock of e.shocks)
      if (!Number.isInteger(shock.severity) || shock.severity < 0 || shock.severity > 100 || shock.endsAt <= shock.startedAt || shock.budget < 0 || shock.sourceEventId && !s.events.some((x) => x.id === shock.sourceEventId))
        errors.push("invalid-shock");
    return errors;
  }

  // src/games/social-engine/simulation/justice.ts
  var active = /* @__PURE__ */ new Set(["investigating", "pursuit", "custody"]);
  var terminal = /* @__PURE__ */ new Set(["acquitted", "fined"]);
  var ok = (reason) => ({ ok: true, reason, events: [] });
  var fail = (reason) => ({ ok: false, reason, events: [] });
  var person = (s, id) => id === "player" ? s.player : s.npcs.find((n) => n.id === id);
  function policeRepresentative(s) {
    return s.npcs.find((n) => n.alive && n.age >= 18 && (n.id === "n5" || n.jobId === "security"))?.id ?? s.npcs.find((n) => n.alive && n.age >= 18)?.id ?? null;
  }
  var officers = (s) => {
    const id = policeRepresentative(s);
    return id ? [id] : [];
  };
  var atStation = (s) => s.player.location.scene === "b-police";
  function eyewitnessEvidence(s, c) {
    if (!c.reported) return [];
    return c.evidence.filter(
      (item) => item.startsWith("saw:") && c.witnesses.includes(item.slice(4)) && person(s, item.slice(4)) !== void 0
    );
  }
  function caseFor(s, crime) {
    const p = s.social.police;
    let c = p.cases.find((c2) => c2.crimeId === crime.id);
    if (c) return c;
    if (p.cases.length >= 128) {
      const oldest = p.cases.findIndex((c2) => terminal.has(c2.status));
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
      outcome: null
    };
    p.cases.push(c);
    return c;
  }
  function refreshKnowledge(s) {
    for (const crime of s.crimes) {
      const statements = s.social.testimonies.filter((t) => t.crimeId === crime.id);
      if (!s.social.police.cases.some((c2) => c2.crimeId === crime.id) && Object.hasOwn(s.flags, `policeClosed:${crime.id}`) && eyewitnessEvidence(s, crime).length <= Number(s.flags[`policeClosed:${crime.id}`]))
        continue;
      if (!crime.reported && !statements.length) continue;
      if (crime.status === "resolved" && !s.social.police.cases.some((c2) => c2.crimeId === crime.id))
        continue;
      const c = caseFor(s, crime);
      if (!c) continue;
      c.testimonyIds = statements.map((t) => t.id);
      const evidence = eyewitnessEvidence(s, crime), newEvidence = evidence.some((e) => !c.knownEvidence.includes(e));
      if (evidence.length) {
        c.knownSuspectId = crime.offender;
        c.knownEvidence = [.../* @__PURE__ */ new Set([...c.knownEvidence, ...evidence])];
        if (c.status === "queued" && crime.status === "pursuit" && s.flags[`caseHidden:${crime.id}`] !== true && s.social.police.cases.filter((x) => active.has(x.status)).length < 2) {
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
        c.outcome = "\xD6nceden tamamlanm\u0131\u015F tan\u0131kl\u0131 dosya sonucu korundu.";
        c.updatedAt = s.minute;
      }
    }
  }
  function isPoliceChargeSupported(s, crimeId) {
    const crime = s.crimes.find((c) => c.id === crimeId);
    return Boolean(crime && eyewitnessEvidence(s, crime).length > 0 && crime.offender === "player");
  }
  function recordFineResolution(s, crimeId) {
    const crime = s.crimes.find((c2) => c2.id === crimeId);
    if (!crime || !isPoliceChargeSupported(s, crimeId)) return;
    const c = caseFor(s, crime);
    if (!c) return;
    c.knownSuspectId = "player";
    c.knownEvidence = eyewitnessEvidence(s, crime);
    c.status = "fined";
    c.updatedAt = s.minute;
    c.outcome = "Tan\u0131k kayd\u0131 do\u011Fruland\u0131; mevcut para cezas\u0131 ve bor\xE7 mutabakat\u0131 uyguland\u0131.";
  }
  function settleFine(s, c) {
    const crime = s.crimes.find((v) => v.id === c.crimeId);
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
  function acquit(s, c) {
    s.flags[`policeClosed:${c.crimeId}`] = c.knownEvidence.length;
    c.status = "acquitted";
    c.updatedAt = s.minute;
    c.outcome = "Beyan fiziksel tan\u0131k kayd\u0131yla do\u011Frulanamad\u0131; bu \u015F\xFCphe i\xE7in ceza ve bor\xE7 do\u011Fmad\u0131.";
    const crime = s.crimes.find((x) => x.id === c.crimeId);
    if (crime?.status === "pursuit") {
      crime.status = "investigating";
      s.flags[`caseHidden:${crime.id}`] = true;
    }
    emit(
      s,
      "case_acquitted",
      "Do\u011Frulanmam\u0131\u015F su\xE7lama i\xE7in takipsizlik karar\u0131 verildi.",
      officers(s),
      c.knownSuspectId,
      "private"
    );
  }
  function recomputeWanted(s) {
    s.player.wanted = Math.min(
      3,
      s.social.police.cases.filter((c) => c.status === "pursuit" && c.knownSuspectId === "player").length
    );
  }
  function guardJusticeCommand(s, c) {
    if (!s.social?.police?.custody) return null;
    if (c.type === "STOP") return null;
    return fail(
      "\u0130fade s\xFCresi s\xFCr\xFCyor. Oyun zaman\u0131nda otuz dakika sonra dosya sonucu a\xE7\u0131klanacak; kay\u0131t ve duraklatma a\xE7\u0131k."
    );
  }
  function applyJusticeCommand(s, c) {
    if (!["POLICE_REVIEW", "POLICE_ATTEND"].includes(c.type)) return null;
    if (!s.social?.police || !atStation(s) || s.social.police.custody)
      return fail("Bu i\u015Flem i\xE7in karakolun i\xE7inde ol ve a\xE7\u0131k bir ifade s\xFCren bulunmas\u0131n.");
    refreshKnowledge(s);
    const pcase = s.social.police.cases.find((v) => v.id === c.args.caseId);
    if (!pcase || terminal.has(pcase.status)) return fail("A\xE7\u0131k bir polis dosyas\u0131 se\xE7.");
    const related2 = pcase.knownSuspectId === "player" || pcase.testimonyIds.some(
      (id) => s.social.testimonies.some((t) => t.id === id && t.speakerId === "player")
    );
    if (!related2) return fail("Bu dosyada senin beyan\u0131n veya sana y\xF6neltilmi\u015F bir \u015F\xFCphe bulunmuyor.");
    if (c.type === "POLICE_REVIEW") {
      if (pcase.knownEvidence.length)
        return fail(
          "Do\u011Frulanm\u0131\u015F tan\u0131k kayd\u0131 mevcut. \u0130fadeye kat\u0131labilir veya aktif takipte teslim olabilirsin."
        );
      acquit(s, pcase);
      recomputeWanted(s);
      return ok("Do\u011Frulanmam\u0131\u015F su\xE7lama kapat\u0131ld\u0131; para kesilmedi ve delil \xFCretilmedi.");
    }
    if (pcase.knownSuspectId !== "player")
      return fail("Yaln\u0131zca sana y\xF6neltilmi\u015F bir \u015F\xFCphe i\xE7in ifadeye kat\u0131labilirsin.");
    if (!active.has(pcase.status) && s.social.police.cases.filter((v) => active.has(v.status)).length >= 2)
      return fail("\u0130ki ekip de g\xF6revde. S\u0131radaki dosyan i\xE7in kapasite a\xE7\u0131lmas\u0131n\u0131 bekle.");
    if (s.player.vehicleId || s.player.shift || s.mobility.trip)
      return fail("Ara\xE7, seyahat veya vardiya s\u0131ras\u0131nda ifadeye ba\u015Flanamaz.");
    pcase.status = "custody";
    pcase.updatedAt = s.minute;
    s.social.police.custody = {
      caseId: pcase.id,
      personId: "player",
      startedAt: s.minute,
      releaseAt: s.minute + 30
    };
    s.player.path = [];
    s.player.destination = null;
    for (const key3 of ["moveX", "moveY", "throttle", "steer"]) s.flags[key3] = 0;
    recomputeWanted(s);
    emit(
      s,
      "custody_started",
      "Karakolda otuz oyun dakikal\u0131k ifade s\xFCreci ba\u015Flad\u0131.",
      ["player", ...officers(s)],
      null,
      "private"
    );
    return ok("\u0130fade ba\u015Flad\u0131. S\xFCre sonunda bilinen kan\u0131ta g\xF6re ceza veya takipsizlik uygulan\u0131r.");
  }
  function tickJustice(s) {
    if (!s.social?.police) return;
    for (const crime of s.crimes)
      if (crime.status === "unreported" && crime.witnesses.some((id) => person(s, id)?.alive) && s.tick >= crime.tick + 30) {
        crime.reported = true;
        crime.status = "investigating";
        emit(
          s,
          "witness_report",
          "Bir tan\u0131k olay\u0131 polise bildirdi.",
          crime.witnesses,
          crime.victim,
          "witnessed",
          crime.witnesses
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
        const c = p.cases.find((c2) => c2.id === custody.caseId);
        if (c.knownSuspectId === "player" && isPoliceChargeSupported(s, c.crimeId)) settleFine(s, c);
        else acquit(s, c);
        p.custody = null;
        emit(
          s,
          "custody_ended",
          "\u0130fade s\xFCreci sona erdi; ya\u015Fam\u0131na devam edebilirsin.",
          ["player", ...officers(s)],
          null,
          "private"
        );
      }
    }
    let occupied = p.cases.filter((c) => active.has(c.status)).length;
    for (const c of p.cases) {
      const crime = s.crimes.find((x) => x.id === c.crimeId);
      if (!crime || terminal.has(c.status) || c.status === "custody") continue;
      if (c.knownSuspectId && person(s, c.knownSuspectId)?.alive === false) {
        if (active.has(c.status)) occupied--;
        s.flags[`policeClosed:${crime.id}`] = c.knownEvidence.length;
        c.status = "acquitted";
        c.updatedAt = s.minute;
        c.outcome = "Ki\u015Finin ya\u015Fam\u0131 sona erdi\u011Fi i\xE7in takip kapat\u0131ld\u0131; bu karar tan\u0131k kayd\u0131n\u0131 silmez ve kapanm\u0131\u015F terekeye yeni bor\xE7 yazmaz.";
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
      if (c.status === "investigating" && c.knownEvidence.length && c.knownSuspectId === "player" && s.flags[`caseHidden:${crime.id}`] !== true && s.tick >= crime.tick + 80) {
        c.status = "pursuit";
        c.updatedAt = s.minute;
        crime.status = "pursuit";
        s.flags.pursuitUntil = s.minute + 120;
        notify(
          s,
          "Polisin bildi\u011Fi tan\u0131k kayd\u0131yla arama ba\u015Flad\u0131. Karakolda ifade ver veya teslim ol."
        );
      }
      if (c.status === "investigating" && c.knownEvidence.length && c.knownSuspectId !== "player" && s.minute - c.updatedAt >= 60) {
        const suspect = c.knownSuspectId;
        if (suspect && Object.hasOwn(s.accounts, suspect)) {
          const fine = Math.min(s.accounts[suspect], crime.fine);
          if (fine && !transfer(s, `fine:${crime.id}`, suspect, "municipality", fine, "npc-fine"))
            throw Error("NPC fine transfer rejected; state requires recovery.");
          const arrears = crime.fine - fine, npc = person(s, suspect);
          if (arrears && npc) {
            npc.debt += arrears;
            s.flags[`loanAsset:${suspect}`] = Number(s.flags[`loanAsset:${suspect}`] ?? 0) + arrears;
          }
        }
        crime.status = "resolved";
        c.status = "fined";
        c.updatedAt = s.minute;
        c.outcome = "Tan\u0131k kayd\u0131yla NPC dosyas\u0131 sonu\xE7land\u0131; mevcut bakiye tahsil edildi, \xF6denmeyen tutar borca kaydedildi.";
        occupied--;
      }
    }
    if (s.player.wanted && s.minute >= Number(s.flags.pursuitUntil) && s.player.location.scene !== "outside" && !p.custody) {
      for (const c of p.cases)
        if (c.status === "pursuit" && c.knownSuspectId === "player") {
          c.status = "queued";
          c.updatedAt = s.minute;
          s.flags[`caseHidden:${c.crimeId}`] = true;
          const crime = s.crimes.find((x) => x.id === c.crimeId);
          if (crime) crime.status = "investigating";
        }
      s.flags.pursuitUntil = s.minute + 240;
      notify(s, "Aktif takip sona erdi. Kayda ge\xE7mi\u015F delil ve dosya korunuyor.");
    }
    recomputeWanted(s);
  }
  function projectJustice(s) {
    const police = s.social.police;
    const statements = new Set(
      s.social.testimonies.filter((t) => t.speakerId === "player").map((t) => t.id)
    );
    return {
      capacity: 2,
      activeDispatches: police.cases.filter((c) => active.has(c.status)).length,
      custody: police.custody,
      cases: police.cases.filter(
        (c) => c.knownSuspectId === "player" || c.testimonyIds.some((id) => statements.has(id))
      ).map((c) => ({
        ...c,
        knownEvidence: [...c.knownEvidence],
        testimonyIds: [...c.testimonyIds],
        knownSuspectName: c.knownSuspectId ? person(s, c.knownSuspectId)?.name ?? null : null
      }))
    };
  }
  function validateJustice(s) {
    const p = s.social.police, errors = [];
    if (!p || p.dispatchCapacity !== 2 || !Array.isArray(p.cases)) return ["police-shape"];
    if (p.cases.length > 128 || p.cases.filter((c) => c && active.has(c.status)).length > 2)
      errors.push("police-capacity");
    const ids = /* @__PURE__ */ new Set(), crimes = /* @__PURE__ */ new Set();
    const integer = (v, min = 0, max = s.minute) => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
    for (const c of p.cases) {
      const crime = c ? s.crimes.find((x) => x.id === c.crimeId) : null;
      if (!c || !crime || ids.has(c.id) || crimes.has(c.crimeId) || c.id !== `case:${c.crimeId}` || !["queued", "investigating", "pursuit", "custody", "acquitted", "fined"].includes(c.status) || !Array.isArray(c.knownEvidence) || !Array.isArray(c.testimonyIds) || !integer(c.openedAt) || !integer(c.updatedAt, c.openedAt) || c.knownSuspectId !== null && !person(s, c.knownSuspectId)) {
        errors.push("police-case");
        continue;
      }
      ids.add(c.id);
      crimes.add(c.crimeId);
      if (c.knownEvidence.some(
        (e) => !crime.evidence.includes(e) || !e.startsWith("saw:") || !crime.witnesses.includes(e.slice(4))
      ) || new Set(c.knownEvidence).size !== c.knownEvidence.length || c.testimonyIds.some(
        (id) => !s.social.testimonies.some((t) => t.id === id && t.crimeId === c.crimeId)
      ))
        errors.push("police-knowledge");
      if (c.knownEvidence.length && (c.knownSuspectId !== crime.offender || !crime.reported))
        errors.push("police-identity");
      if (c.status === "pursuit" && (!c.knownEvidence.length || c.knownSuspectId !== "player"))
        errors.push("police-unsupported-pursuit");
      if (c.status === "fined" && (!c.knownEvidence.length || crime.status !== "resolved"))
        errors.push("police-unsupported-fine");
    }
    if (p.custody) {
      const c = p.cases.find((c2) => c2?.id === p.custody?.caseId);
      if (!c || c.status !== "custody" || c.knownSuspectId !== "player" || p.custody.personId !== "player" || !integer(p.custody.startedAt) || !integer(p.custody.releaseAt, s.minute, s.minute + 30) || p.custody.releaseAt - p.custody.startedAt !== 30 || s.player.location.scene !== "b-police")
        errors.push("police-custody");
    }
    if (p.cases.some((c) => c?.status === "custody" && c.id !== p.custody?.caseId))
      errors.push("police-orphan-custody");
    return errors;
  }

  // src/games/social-engine/simulation/social.ts
  var DAY2 = 1440;
  var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var IDS = ["dock", "hill", "night"];
  var criticalKinds = /* @__PURE__ */ new Set([
    "assault",
    "faction_betrayal",
    "false_testimony",
    "death",
    "marriage",
    "separation",
    "faction_succession"
  ]);
  var bounded = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
  var yes = (reason) => ({ ok: true, reason, events: [] });
  var no = (reason) => ({ ok: false, reason, events: [] });
  var registry = /* @__PURE__ */ new WeakMap();
  var eventRegistry = /* @__PURE__ */ new WeakMap();
  function people2(s) {
    let c = registry.get(s);
    if (!c || c.size !== s.npcs.length) {
      c = { size: s.npcs.length, people: new Map([s.player, ...s.npcs].map((p) => [p.id, p])) };
      registry.set(s, c);
    }
    return c.people;
  }
  function events(s) {
    let c = eventRegistry.get(s);
    if (!c || c.size > s.events.length) {
      c = { size: 0, events: /* @__PURE__ */ new Map() };
      eventRegistry.set(s, c);
    }
    for (; c.size < s.events.length; c.size++) c.events.set(s.events[c.size].id, s.events[c.size]);
    return c.events;
  }
  var adult = (p) => Boolean(p?.alive && p.age >= 18);
  var member = (s, id) => s.social.factions.find((f) => f.members.some((m) => m.personId === id));
  var near = (a, b) => a.location.scene === b.location.scene && Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y) <= 3 && hasLineOfSight(a.location, b.location, a.location.scene);
  function at(s, id) {
    const b = BUILDINGS.find((b2) => b2.id === id);
    return s.player.location.scene === id || Boolean(
      b && s.player.location.scene === "outside" && Math.hypot(s.player.location.x - b.door.x, s.player.location.y - b.door.y) <= 2
    );
  }
  function zeroAccount(s, id) {
    if (!Object.hasOwn(s.accounts, id)) {
      s.accounts[id] = 0;
      s.ledgerCheckpoint.balances[id] = 0;
    }
  }
  function newMember(id, role, minute) {
    return { personId: id, role, loyalty: 70, joinedAt: minute, lastServiceAt: -DAY2, services: 0 };
  }
  function initializeSocial(s, legacy = false) {
    const candidates = s.npcs.filter((p) => p.local && adult(p) && !["n5", "n6"].includes(p.id)).sort((a, b) => compare(a.id, b.id));
    const factions = FACTIONS.map((f, i) => {
      const roster = candidates.slice(i * 6, i * 6 + 6).map(
        (p, j) => newMember(p.id, j === 0 ? "leader" : j === 1 ? "officer" : "member", s.minute)
      );
      const treasuryAccount = `faction:${f.id}`;
      zeroAccount(s, treasuryAccount);
      return {
        id: f.id,
        name: f.name,
        treasuryAccount,
        members: roster,
        rivals: IDS.filter((id) => id !== f.id),
        heat: bounded(Number(s.flags[`faction:${f.id}`] ?? 0))
      };
    });
    const previous = IDS.includes(s.flags.faction) ? s.flags.faction : null;
    if (previous && adult(s.player))
      factions.find((f) => f.id === previous).members.push(newMember("player", "member", s.minute));
    const teachers = s.npcs.filter((p) => adult(p));
    const leader = teachers.find((p) => p.id === "n6") ?? teachers[0];
    if (factions.some((f) => !f.members.length) || !leader)
      throw Error("Social initialization requires living adult NPCs.");
    const social = {
      police: { dispatchCapacity: 2, cases: [], custody: null },
      version: 1,
      updatedTick: s.tick,
      factions,
      territories: [
        {
          id: "shore",
          name: "R\u0131ht\u0131m",
          buildingId: "b-taxi",
          influence: { dock: 50, hill: 30, night: 20 },
          lastChangedAt: s.minute
        },
        {
          id: "market",
          name: "\xC7ar\u015F\u0131",
          buildingId: "b-market",
          influence: { dock: 30, hill: 30, night: 40 },
          lastChangedAt: s.minute
        },
        {
          id: "hill",
          name: "Yoku\u015F",
          buildingId: "b-school",
          influence: { dock: 20, hill: 55, night: 25 },
          lastChangedAt: s.minute
        }
      ],
      knowledge: {},
      bonds: [],
      eventCursor: 0,
      lastDay: Math.floor(s.minute / DAY2),
      lastRumorAt: {},
      factionChangedAt: {},
      testimonies: [],
      club: {
        id: "study-circle",
        name: "Ufuk \xC7al\u0131\u015Fma Kul\xFCb\xFC",
        leaderId: leader.id,
        members: [{ personId: leader.id, standing: 100, role: "mentor" }],
        activity: null,
        lastSessionAt: {}
      }
    };
    if (previous) social.factionChangedAt.player = s.minute;
    s.social = social;
    if (legacy) social.factionChangedAt = previous ? { player: s.minute } : {};
    ingest(s);
    return social;
  }
  function retain(s, m) {
    const list = s.social.knowledge[m.ownerId] ?? (s.social.knowledge[m.ownerId] = []);
    const existing = list.find((x) => x.eventId === m.eventId);
    if (existing) {
      if (m.confidence > existing.confidence || m.mode === "direct") Object.assign(existing, m);
      return;
    }
    list.push(m);
    if (list.length > 64) {
      const pinned = new Set(list.filter((x) => x.critical).slice(-16));
      const removable = list.filter((x) => !pinned.has(x)).sort(
        (a, b) => a.salience - b.salience || a.learnedAt - b.learnedAt || compare(a.eventId, b.eventId)
      );
      const remove = removable[0];
      list.splice(list.indexOf(remove), 1);
    }
  }
  function ingest(s) {
    const peopleById = people2(s);
    const end = s.events.length;
    for (; s.social.eventCursor < end; s.social.eventCursor++) {
      const event2 = s.events[s.social.eventCursor], observers = /* @__PURE__ */ new Set([...event2.actors, ...event2.witnesses]);
      if (event2.visibility === "public" && event2.targetId && peopleById.has(event2.targetId))
        observers.add(event2.targetId);
      for (const id of observers)
        if (peopleById.get(id)?.alive)
          retain(s, {
            eventId: event2.id,
            ownerId: id,
            sourceId: id,
            mode: "direct",
            confidence: 100,
            salience: criticalKinds.has(event2.kind) ? 100 : 65,
            critical: criticalKinds.has(event2.kind),
            learnedAt: event2.minute,
            lastDecayDay: Math.floor(s.minute / DAY2),
            chain: [id]
          });
      if ([
        "conversation",
        "relationship_dispute",
        "faction_betrayal",
        "faction_join",
        "faction_departure",
        "club_session",
        "false_testimony"
      ].includes(event2.kind)) {
        const actors = event2.actors.filter((id) => peopleById.has(id));
        for (const from of actors)
          for (const to of actors)
            if (from !== to) {
              let bond = s.social.bonds.find((b) => b.from === from && b.to === to);
              if (!bond && s.social.bonds.length < 4096) {
                bond = { from, to, familiarity: 0, loyalty: 0, updatedAt: s.minute };
                s.social.bonds.push(bond);
              }
              if (bond) {
                bond.familiarity = bounded(bond.familiarity + 2);
                bond.loyalty = bounded(
                  bond.loyalty + ([
                    "relationship_dispute",
                    "faction_betrayal",
                    "faction_departure",
                    "false_testimony"
                  ].includes(event2.kind) ? -10 : 2),
                  -100,
                  100
                );
                bond.updatedAt = s.minute;
              }
            }
      }
      if (event2.kind === "assault")
        for (const id of event2.actors.slice(0, 1)) {
          const f = member(s, id);
          if (f) {
            f.heat = bounded(f.heat + 8);
            s.flags[`faction:${f.id}`] = f.heat;
          }
        }
    }
  }
  function shareRumor(s, senderId, recipientId, eventId) {
    ingest(s);
    const sender = people2(s).get(senderId), recipient = people2(s).get(recipientId);
    const source = s.social.knowledge[senderId]?.find((m) => m.eventId === eventId);
    if (!sender?.alive || !recipient?.alive || senderId === recipientId || !source || !near(sender, recipient) || source.chain.includes(recipientId) || source.chain.length >= 8 || s.minute - (s.social.lastRumorAt[senderId] ?? -DAY2) < 20)
      return false;
    if (s.social.knowledge[recipientId]?.some(
      (m) => m.eventId === eventId && m.confidence >= Math.floor(source.confidence * 0.75)
    ))
      return false;
    const confidence = Math.floor(source.confidence * 0.75);
    if (confidence < 10) return false;
    retain(s, {
      ...source,
      ownerId: recipientId,
      sourceId: senderId,
      mode: "rumor",
      confidence,
      salience: Math.max(10, source.salience - 15),
      learnedAt: s.minute,
      lastDecayDay: Math.floor(s.minute / DAY2),
      chain: [...source.chain, recipientId]
    });
    s.social.lastRumorAt[senderId] = s.minute;
    adjustRelation(s, recipientId, senderId, 1);
    return true;
  }
  function shiftTerritory(s, factionId, territoryId) {
    const zone = s.social.territories.find((z) => z.id === territoryId);
    const donor = IDS.filter((id) => id !== factionId).sort(
      (a, b) => zone.influence[b] - zone.influence[a] || compare(a, b)
    )[0];
    if (zone.influence[donor] > 0 && zone.influence[factionId] < 100) {
      zone.influence[donor]--;
      zone.influence[factionId]++;
      zone.lastChangedAt = s.minute;
    }
  }
  function leave(s, id, betrayal) {
    const f = member(s, id);
    if (!f) return;
    f.members = f.members.filter((m) => m.personId !== id);
    const leader = f.members.find((m) => m.role === "leader");
    if (leader) {
      adjustRelation(s, leader.personId, id, betrayal ? -20 : -8, 0, 0, betrayal ? 20 : 5);
    }
    emit(
      s,
      betrayal ? "faction_betrayal" : "faction_departure",
      betrayal ? "\xC7evre de\u011Fi\u015Ftirmek eski ba\u011Flar\u0131 sarst\u0131." : "Bir \xE7evreden ayr\u0131lma kayda ge\xE7ti.",
      [id, ...leader ? [leader.personId] : []],
      null,
      "private"
    );
    if (id === "player") {
      s.flags.faction = "";
      s.player.influence = bounded(s.player.influence - 5);
    }
  }
  function reconcileSocialAfterDeath(s, personId) {
    if (!s.social) return;
    const byId = people2(s);
    for (const f of s.social.factions) {
      const wasLeader = f.members.some((m) => m.personId === personId && m.role === "leader");
      f.members = f.members.filter((m) => m.personId !== personId && adult(byId.get(m.personId)));
      if (!f.members.some((m) => m.role === "leader")) {
        let next = f.members.slice().sort(
          (a, b) => b.loyalty - a.loyalty || b.services - a.services || compare(a.personId, b.personId)
        )[0];
        if (!next) {
          const candidate = s.npcs.find((p) => adult(p) && !member(s, p.id));
          if (candidate) {
            next = newMember(candidate.id, "leader", s.minute);
            f.members.push(next);
          }
        }
        if (next) {
          next.role = "leader";
          if (wasLeader)
            emit(
              s,
              "faction_succession",
              `${f.name} yeni temsilcisini se\xE7ti.`,
              [next.personId],
              null,
              "public"
            );
        }
      }
    }
    s.social.club.members = s.social.club.members.filter(
      (m) => m.personId !== personId && adult(byId.get(m.personId))
    );
    if (s.social.club.leaderId === personId || !adult(byId.get(s.social.club.leaderId))) {
      const next = s.social.club.members[0]?.personId ?? s.npcs.find((p) => adult(p))?.id;
      if (next) {
        s.social.club.leaderId = next;
        if (!s.social.club.members.some((m) => m.personId === next))
          s.social.club.members.push({ personId: next, role: "mentor", standing: 100 });
      }
    }
    if (s.social.club.activity?.personId === personId) s.social.club.activity = null;
    if (personId === "player") s.flags.faction = "";
  }
  function statementClosed(s, t) {
    return Object.hasOwn(s.flags, `policeClosed:${t.crimeId}`) || s.social.police.cases.some(
      (c) => c.crimeId === t.crimeId && (c.status === "acquitted" || c.status === "fined")
    );
  }
  function recordTestimony(s, speakerId, crimeId, accusedId) {
    const crime = s.crimes.find((c) => c.id === crimeId);
    if (!crime || !adult(people2(s).get(speakerId)) || !adult(people2(s).get(accusedId)) || crime.status === "resolved" || s.social.testimonies.some((t) => t.crimeId === crimeId && t.speakerId === speakerId) || s.social.testimonies.filter((t) => t.status === "unverified" && !statementClosed(s, t)).length >= 16)
      return null;
    const direct = crime.witnesses.includes(speakerId) || crime.victim === speakerId;
    const hearsay = Boolean(
      s.social.knowledge[speakerId]?.some(
        (m) => m.mode === "rumor" && events(s).get(m.eventId)?.kind === "assault"
      )
    );
    const record = {
      id: `statement:${s.nextId++}`,
      crimeId,
      speakerId,
      accusedId,
      basis: direct ? "direct" : hearsay ? "hearsay" : "unsupported",
      confidence: direct ? 80 : hearsay ? 30 : 10,
      submittedAt: s.minute,
      status: "unverified",
      reviewedAt: null
    };
    s.social.testimonies.push(record);
    if (s.social.testimonies.length > 128) {
      const oldest = s.social.testimonies.findIndex(
        (t) => t.status !== "unverified" || statementClosed(s, t)
      );
      if (oldest >= 0) {
        const removed = s.social.testimonies.splice(oldest, 1)[0];
        for (const c of s.social.police.cases)
          c.testimonyIds = c.testimonyIds.filter((id) => id !== removed.id);
      }
    }
    emit(
      s,
      "testimony",
      "Bir beyan kayda al\u0131nd\u0131; do\u011Frulanm\u0131\u015F fiziksel kan\u0131t say\u0131lmaz.",
      [speakerId, ...[policeRepresentative(s)].filter((id) => id !== null)],
      accusedId,
      "private"
    );
    return record;
  }
  function applySocialCommand(s, c) {
    const supported = /* @__PURE__ */ new Set([
      "JOIN_FACTION",
      "LEAVE_FACTION",
      "FACTION_DONATE",
      "FACTION_SERVICE",
      "FACTION_PROMOTE",
      "SHARE_RUMOR",
      "FILE_TESTIMONY",
      "CLUB_JOIN",
      "CLUB_SESSION"
    ]);
    if (!supported.has(c.type)) return null;
    if (!s.social || !adult(s.player))
      return no("Bu toplumsal etkile\u015Fim yeti\u015Fkin bir karakter gerektirir.");
    const a = c.args, p = s.player, f = member(s, "player"), m = f?.members.find((m2) => m2.personId === "player");
    switch (c.type) {
      case "JOIN_FACTION": {
        const target = s.social.factions.find((f2) => f2.id === a.factionId);
        if (!target || p.reputation < 5)
          return no("Bir \xE7evreye kat\u0131lmak i\xE7in en az 5 itibar gerekir.");
        if (f === target) return no("Zaten bu \xE7evrenin \xFCyesisin.");
        if (s.minute - (s.social.factionChangedAt.player ?? -DAY2) < DAY2)
          return no("\xC7evre de\u011Fi\u015Ftirmeden \xF6nce bir oyun g\xFCn\xFC bekle.");
        if (f) leave(s, "player", true);
        target.members.push(newMember("player", "member", s.minute));
        s.flags.faction = target.id;
        s.social.factionChangedAt.player = s.minute;
        p.influence = bounded(p.influence + 5);
        emit(
          s,
          "faction_join",
          `${target.name} \xFCyeli\u011Fin ba\u015Flad\u0131.`,
          ["player", target.members.find((x) => x.role === "leader").personId],
          null,
          "private"
        );
        return yes("\xDCyeli\u011Fin kaydedildi. Kasa, sadakat ve mahalle i\u015Fi sonu\xE7lar\u0131 kal\u0131c\u0131d\u0131r.");
      }
      case "LEAVE_FACTION":
        if (!f) return no("Bir \xE7evrenin \xFCyesi de\u011Filsin.");
        else {
          leave(s, "player", false);
          s.social.factionChangedAt.player = s.minute;
          return yes("\xC7evreden ayr\u0131ld\u0131n; eski ili\u015Fkiler silinmedi.");
        }
      case "FACTION_DONATE": {
        const amount2 = a.amount;
        if (!f || typeof amount2 !== "number" || !Number.isSafeInteger(amount2) || amount2 < 100 || amount2 > 1e5)
          return no("Ba\u011F\u0131\u015F 1\u20131000 TL aras\u0131nda olmal\u0131 ve \xFCyelik gerektirir.");
        if (!transfer(s, `social:${c.id}`, "player", f.treasuryAccount, amount2, "faction-donation"))
          return no("Bakiye yetersiz veya i\u015Flem daha \xF6nce uyguland\u0131.");
        return yes("Ba\u011F\u0131\u015F ortak kasaya ge\xE7ti; para \xFCretmedi ve \xFCyelik puan\u0131 satmad\u0131.");
      }
      case "FACTION_SERVICE": {
        const zone = s.social.territories.find((z) => z.id === a.territoryId);
        if (!f || !m || !zone || !at(s, zone.buildingId) || s.minute - m.lastServiceAt < 60 || p.wanted || p.shift)
          return no(
            "\xDCye olarak hedef mek\xE2na git; mahalle i\u015Fi saatte bir yap\u0131l\u0131r, takip/vardiya s\u0131ras\u0131nda yap\u0131lamaz."
          );
        if (!transfer(
          s,
          `social:${c.id}`,
          f.treasuryAccount,
          "business:market",
          2e3,
          "faction-neighborhood-service"
        ))
          return no("Ortak kasada 20 TL hizmet b\xFCt\xE7esi gerekiyor.");
        m.lastServiceAt = s.minute;
        m.services++;
        m.loyalty = bounded(m.loyalty + 2);
        shiftTerritory(s, f.id, zone.id);
        p.influence = bounded(p.influence + 1);
        emit(
          s,
          "faction_service",
          `${zone.name} i\xE7inde finanse edilmi\u015F bir mahalle i\u015Fi tamamland\u0131.`,
          ["player"],
          null,
          "public"
        );
        return yes("Hizmet bedeli \xF6dendi; b\xF6lgesel etki yaln\u0131zca bir puan de\u011Fi\u015Fti.");
      }
      case "FACTION_PROMOTE":
        if (!f || !m || m.role !== "member" || m.services < 3 || m.loyalty < 70)
          return no("Temsilcilik i\xE7in en az \xFC\xE7 mahalle i\u015Fi ve 70 sadakat gerekir.");
        else {
          m.role = "officer";
          return yes("\xC7evrenin temsilcilerinden biri oldun; tek lider korunuyor.");
        }
      case "SHARE_RUMOR":
        return typeof a.npcId === "string" && typeof a.eventId === "string" && shareRumor(s, "player", a.npcId, a.eventId) ? yes("Duyum kayna\u011F\u0131 ve azalan g\xFCvenle aktar\u0131ld\u0131; kesin bilgiye d\xF6n\xFC\u015Fmedi.") : no("Bilmedi\u011Fin, tekrar edilmi\u015F veya uzaktaki ki\u015Fiye y\xF6nelik bir duyumu aktaramazs\u0131n.");
      case "FILE_TESTIMONY":
        return at(s, "b-police") && typeof a.crimeId === "string" && typeof a.accusedId === "string" && recordTestimony(s, "player", a.crimeId, a.accusedId) ? yes("Beyan do\u011Frulanmam\u0131\u015F olarak al\u0131nd\u0131. Fiziksel delil veya otomatik aranma \xFCretmez.") : no("Karakolda a\xE7\u0131k bir dosya i\xE7in yeni ve ge\xE7erli bir beyan ver.");
      case "CLUB_JOIN":
        if (!at(s, "b-school") || s.social.club.members.some((m2) => m2.personId === "player"))
          return no("Kul\xFCbe akademide bir kez kat\u0131labilirsin.");
        else {
          s.social.club.members.push({ personId: "player", standing: 0, role: "newcomer" });
          return yes("Ufuk \xC7al\u0131\u015Fma Kul\xFCb\xFC\u2019ne kat\u0131ld\u0131n. Hi\xE7bir su\xE7 \xE7evresine \xFCyelik gerekmez.");
        }
      case "CLUB_SESSION": {
        const cm = s.social.club.members.find((m2) => m2.personId === "player");
        if (!cm || s.player.location.scene !== "b-school" || s.social.club.activity || p.shift || p.vehicleId || p.wanted || s.minute - (s.social.club.lastSessionAt.player ?? -DAY2) < 60 || s.flags.trainingSkill || s.life.enrollments.some((e) => e.personId === "player" && e.activeUntil !== null))
          return no(
            "Akademide bo\u015F zaman\u0131nda kul\xFCbe kat\u0131l; ders/vardiya \xE7ak\u0131\u015Fmas\u0131 veya saatlik bekleme engeller."
          );
        s.social.club.activity = { personId: "player", startedAt: s.minute, endsAt: s.minute + 30 };
        return yes("Otuz oyun dakikas\u0131 boyunca akademide kal. Kat\u0131l\u0131m sosyal konumunu geli\u015Ftirir.");
      }
      default:
        return null;
    }
  }
  function tickSocial(s) {
    if (!s.social) return;
    for (const faction of s.social.factions)
      faction.heat = bounded(Number(s.flags[`faction:${faction.id}`] ?? faction.heat));
    ingest(s);
    s.social.updatedTick = s.tick;
    const club = s.social.club, a = club.activity;
    if (a) {
      if (s.player.location.scene !== "b-school" || s.player.shift || s.player.wanted || !s.player.alive || s.flags.trainingSkill || s.life.enrollments.some((e) => e.personId === "player" && e.activeUntil !== null)) {
        club.activity = null;
      } else if (s.minute >= a.endsAt) {
        const m = club.members.find((m2) => m2.personId === a.personId);
        m.standing = bounded(m.standing + 10);
        m.role = m.standing >= 60 && s.player.skills.academic >= 30 ? "mentor" : m.standing >= 20 ? "member" : "newcomer";
        club.lastSessionAt[a.personId] = s.minute;
        club.activity = null;
        adjustRelation(s, club.leaderId, "player", 3, 2);
        emit(
          s,
          "club_session",
          "\xC7al\u0131\u015Fma kul\xFCb\xFCndeki ger\xE7ek kat\u0131l\u0131m\u0131n tan\u0131n\u0131rl\u0131\u011F\u0131n\u0131 art\u0131rd\u0131.",
          ["player", club.leaderId],
          null,
          "private"
        );
      }
    }
    const day = Math.floor(s.minute / DAY2);
    if (day > s.social.lastDay) {
      s.social.lastDay = day;
      for (const list of Object.values(s.social.knowledge))
        for (const memory of list) {
          const elapsed = day - memory.lastDecayDay;
          if (elapsed > 0) {
            for (let i = 0; i < elapsed; i++)
              memory.salience = Math.max(
                memory.critical ? 25 : 0,
                Math.floor(memory.salience * (memory.critical ? 0.97 : 0.85))
              );
            memory.lastDecayDay = day;
          }
        }
      for (const f of s.social.factions) {
        f.heat = bounded(f.heat - 1);
        s.flags[`faction:${f.id}`] = f.heat;
        for (const m of f.members)
          if (m.personId !== "player" && adult(people2(s).get(m.personId)) && s.accounts[m.personId] > 1e5) {
            transfer(
              s,
              `faction-dues:${f.id}:${m.personId}:${day}`,
              m.personId,
              f.treasuryAccount,
              100,
              "faction-npc-dues"
            );
          }
        const zone = s.social.territories[(day + IDS.indexOf(f.id)) % 3];
        if (transfer(
          s,
          `faction-service:${f.id}:${day}`,
          f.treasuryAccount,
          "business:market",
          300,
          "faction-npc-service"
        )) {
          shiftTerritory(s, f.id, zone.id);
          const leader = f.members.find((m) => m.role === "leader");
          if (leader) leader.services++;
        }
      }
    }
    if (s.tick % 600 === 0) {
      const locals = s.npcs.filter((p) => p.local && p.alive), speaker = locals[draw(s.seed, 79, s.tick) % locals.length];
      if (speaker) {
        const listener = locals.find((p) => p.id !== speaker.id && near(speaker, p));
        const memory = s.social.knowledge[speaker.id]?.slice().sort((a2, b) => b.salience - a2.salience)[0];
        if (listener && memory) shareRumor(s, speaker.id, listener.id, memory.eventId);
      }
    }
    for (const t of s.social.testimonies) {
      if (t.status !== "unverified") continue;
      const crime = s.crimes.find((c) => c.id === t.crimeId);
      if (!crime?.reported || !crime.evidence.some((e) => e.startsWith("saw:")) || s.minute < t.submittedAt + 10)
        continue;
      t.status = t.accusedId === crime.offender ? "corroborated" : "contradicted";
      t.reviewedAt = s.minute;
      if (t.status === "contradicted") {
        if (t.speakerId === "player")
          s.player.reputation = bounded(s.player.reputation - 10, -100, 100);
        const f = member(s, t.speakerId), m = f?.members.find((m2) => m2.personId === t.speakerId);
        if (m) m.loyalty = bounded(m.loyalty - 15);
        const officer = policeRepresentative(s);
        if (officer) adjustRelation(s, officer, t.speakerId, -20, 0, 0, 10);
        emit(
          s,
          "false_testimony",
          "Fiziksel tan\u0131k kayd\u0131yla \xE7eli\u015Fen beyan g\xFCven kaybettirdi.",
          [...officer ? [officer] : [], t.speakerId],
          null,
          "private"
        );
      }
    }
  }
  function projectSocial(s) {
    const byId = people2(s), byEvent = events(s);
    return {
      police: projectJustice(s),
      factions: s.social.factions.map((f) => ({
        id: f.id,
        name: f.name,
        leaderName: byId.get(f.members.find((m) => m.role === "leader").personId)?.name ?? "Temsilci",
        memberCount: f.members.length,
        treasury: s.accounts[f.treasuryAccount],
        heat: f.heat,
        rivals: [...f.rivals],
        membership: f.members.find((m) => m.personId === "player") ?? null
      })),
      territories: s.social.territories.map((z) => ({ ...z, influence: { ...z.influence } })),
      bonds: s.social.bonds.filter((b) => b.from === "player" || b.to === "player"),
      memories: (s.social.knowledge.player ?? []).map((m) => ({
        ...m,
        chain: [...m.chain],
        text: byEvent.get(m.eventId)?.text ?? "Ge\xE7mi\u015F olay",
        kind: byEvent.get(m.eventId)?.kind ?? "memory"
      })),
      testimonies: s.social.testimonies.filter((t) => t.speakerId === "player"),
      club: {
        name: s.social.club.name,
        leaderName: byId.get(s.social.club.leaderId)?.name ?? "Kul\xFCp temsilcisi",
        memberCount: s.social.club.members.length,
        membership: s.social.club.members.find((m) => m.personId === "player") ?? null,
        activity: s.social.club.activity
      }
    };
  }
  function validateSocial(s) {
    const errors = [], soci = s.social, byId = people2(s);
    const integer = (x, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max;
    if (!soci || soci.version !== 1 || !Array.isArray(soci.factions) || !Array.isArray(soci.territories) || !soci.knowledge || typeof soci.knowledge !== "object" || !Array.isArray(soci.testimonies) || !Array.isArray(soci.bonds) || !soci.club || !Array.isArray(soci.club.members))
      return ["social-shape"];
    if (!integer(soci.updatedTick, 0, s.tick) || !integer(soci.eventCursor, 0, s.events.length) || !integer(soci.lastDay, 0, Math.floor(s.minute / DAY2)))
      errors.push("social-clock");
    const ids = /* @__PURE__ */ new Set(), members = /* @__PURE__ */ new Set();
    for (const f of soci.factions) {
      if (!f || !IDS.includes(f.id) || ids.has(f.id) || f.treasuryAccount !== `faction:${f.id}` || !Object.hasOwn(s.accounts, f.treasuryAccount) || !Array.isArray(f.members) || !Array.isArray(f.rivals) || !integer(f.heat, 0, 100)) {
        errors.push("faction-shape");
        continue;
      }
      ids.add(f.id);
      if (f.members.filter((m) => m?.role === "leader").length !== 1)
        errors.push(`faction-leader:${f.id}`);
      for (const m of f.members) {
        if (!m || members.has(m.personId) || !adult(byId.get(m.personId)) || !["leader", "officer", "member"].includes(m.role) || !integer(m.loyalty, 0, 100) || !integer(m.services) || !integer(m.joinedAt, 0, s.minute) || !integer(m.lastServiceAt, -DAY2, s.minute))
          errors.push(`faction-member:${f.id}`);
        else members.add(m.personId);
      }
      if (new Set(f.rivals).size !== 2 || f.rivals.some((id) => id === f.id || !IDS.includes(id)))
        errors.push(`faction-rival:${f.id}`);
    }
    if (ids.size !== 3) errors.push("faction-count");
    const zones = /* @__PURE__ */ new Set();
    for (const z of soci.territories) {
      if (!z || !["shore", "market", "hill"].includes(z.id) || zones.has(z.id) || !z.influence || !IDS.every((id) => integer(z.influence[id], 0, 100)) || IDS.reduce((sum, id) => sum + z.influence[id], 0) !== 100 || !BUILDINGS.some((b) => b.id === z.buildingId) || !integer(z.lastChangedAt, 0, s.minute))
        errors.push("territory");
      else zones.add(z.id);
    }
    if (zones.size !== 3) errors.push("territory-count");
    const byEvent = events(s);
    for (const [owner, list] of Object.entries(soci.knowledge)) {
      if (!byId.has(owner) || !Array.isArray(list) || list.length > 64) {
        errors.push("knowledge-owner");
        continue;
      }
      const observed = /* @__PURE__ */ new Set();
      for (const m of list) {
        if (!m || m.ownerId !== owner || !byEvent.has(m.eventId) || observed.has(m.eventId) || !byId.has(m.sourceId) || !["direct", "rumor"].includes(m.mode) || !integer(m.confidence, 0, 100) || !integer(m.salience, 0, 100) || typeof m.critical !== "boolean" || !integer(m.learnedAt, 0, s.minute) || !integer(m.lastDecayDay, 0, Math.floor(s.minute / DAY2)) || !Array.isArray(m.chain) || m.chain.length < 1 || m.chain.length > 8 || m.chain.at(-1) !== owner || new Set(m.chain).size !== m.chain.length || m.chain.some((id) => !byId.has(id))) {
          errors.push("knowledge-provenance");
          continue;
        }
        observed.add(m.eventId);
        const e = byEvent.get(m.eventId);
        if (![...e.actors, ...e.witnesses, ...e.visibility === "public" ? [e.targetId] : []].includes(
          m.chain[0]
        ))
          errors.push("knowledge-unobserved-origin");
        if (m.mode === "direct" && (m.chain.length !== 1 || m.sourceId !== owner || m.confidence !== 100))
          errors.push("knowledge-direct");
        if (m.mode === "rumor" && (m.chain.length < 2 || m.sourceId !== m.chain.at(-2) || m.confidence > Math.floor(100 * 0.75 ** (m.chain.length - 1))))
          errors.push("knowledge-rumor-confidence");
      }
    }
    const bondKeys = /* @__PURE__ */ new Set();
    if (soci.bonds.length > 4096) errors.push("bond-limit");
    for (const b of soci.bonds) {
      const key3 = b ? JSON.stringify([b.from, b.to]) : "";
      if (!b || !byId.has(b.from) || !byId.has(b.to) || b.from === b.to || bondKeys.has(key3) || !integer(b.familiarity, 0, 100) || !integer(b.loyalty, -100, 100) || !integer(b.updatedAt, 0, s.minute))
        errors.push("social-bond");
      else bondKeys.add(key3);
    }
    const testimonyIds = /* @__PURE__ */ new Set();
    for (const t of soci.testimonies) {
      if (!t || testimonyIds.has(t.id) || !s.crimes.some((c) => c.id === t.crimeId) || !byId.has(t.speakerId) || !byId.has(t.accusedId) || !["direct", "hearsay", "unsupported"].includes(t.basis) || !["unverified", "corroborated", "contradicted"].includes(t.status) || !integer(t.confidence, 0, 100) || !integer(t.submittedAt, 0, s.minute) || t.reviewedAt !== null && !integer(t.reviewedAt, t.submittedAt, s.minute))
        errors.push("testimony");
      else testimonyIds.add(t.id);
    }
    if (soci.testimonies.length > 128) errors.push("testimony-limit");
    const clubIds = /* @__PURE__ */ new Set();
    for (const m of soci.club.members) {
      if (!m || clubIds.has(m.personId) || !adult(byId.get(m.personId)) || !integer(m.standing, 0, 100) || !["newcomer", "member", "mentor"].includes(m.role))
        errors.push("club-member");
      else clubIds.add(m.personId);
    }
    if (!clubIds.has(soci.club.leaderId) || !adult(byId.get(soci.club.leaderId)))
      errors.push("club-leader");
    if (soci.club.activity && (!clubIds.has(soci.club.activity.personId) || !integer(soci.club.activity.startedAt, 0, s.minute) || !integer(soci.club.activity.endsAt, s.minute, s.minute + 30)))
      errors.push("club-activity");
    for (const map of [soci.lastRumorAt, soci.factionChangedAt, soci.club.lastSessionAt])
      if (!map || typeof map !== "object" || Array.isArray(map) || Object.entries(map).some(([id, n]) => !byId.has(id) || !integer(n, 0, s.minute)))
        errors.push("social-cooldown");
    const membership = soci.factions.find(
      (f) => f && Array.isArray(f.members) && f.members.some((m) => m?.personId === "player")
    );
    if (String(s.flags.faction ?? "") !== (membership?.id ?? "")) errors.push("faction-player-sync");
    errors.push(...validateJustice(s));
    return errors;
  }

  // src/games/social-engine/simulation/progression.ts
  var DAILY_SKILL_LIMIT = 20;
  var INVENTORY_SLOT_LIMIT = 12;
  var fail2 = (reason) => ({ ok: false, reason, events: [] });
  var ok2 = (reason) => ({ ok: true, reason, events: [] });
  function initializeProgression(s) {
    if (s.progression) return s.progression;
    s.progression = {
      version: 1,
      updatedTick: s.tick,
      day: Math.floor(s.minute / 1440),
      gainedToday: 0,
      lastSkills: { ...s.player.skills },
      perks: [],
      items: {},
      retired: false,
      retiredAt: null
    };
    reconcileProgression(s, "legacy-import");
    return s.progression;
  }
  function progressionCommand(s, c) {
    const p = s.progression;
    if (c.type === "RESUME_CAREER") {
      if (!p.retired) return fail2("Zaten etkin hayat\u0131na devam ediyorsun.");
      p.retired = false;
      p.retiredAt = null;
      emit(
        s,
        "career_resumed",
        "Yeni bir sayfa: mahalledeki hayat\u0131na devam ediyorsun.",
        ["player"],
        null,
        "private"
      );
      return ok2("Yeni bir ba\u015Flang\u0131\xE7.");
    }
    if (p.retired && !["STOP", "BLOCK", "SET_TIME_SPEED"].includes(c.type))
      return fail2("Emeklilik \xF6zetinden hayata d\xF6nerek devam edebilirsin.");
    if (c.type === "RETIRE") {
      if (s.player.shift || s.player.vehicleId || s.player.wanted || s.mobility?.trip || s.player.attackUntil > s.tick)
        return fail2("\xD6nce vardiyan\u0131, yolculu\u011Funu ve hukuki y\xFCk\xFCml\xFCl\xFCklerini tamamla.");
      p.retired = true;
      p.retiredAt = s.minute;
      s.player.path = [];
      s.player.destination = null;
      s.flags.moveX = 0;
      s.flags.moveY = 0;
      emit(
        s,
        "retirement",
        "Bir d\xF6nemi kapatt\u0131n. Dilersen ayn\u0131 d\xFCnyadaki hayat\u0131na yeniden d\xF6nebilirsin.",
        ["player"],
        null,
        "private"
      );
      return ok2("Hayat \xF6zetin haz\u0131r; kay\u0131tlar\u0131n ve d\xFCnyan korunuyor.");
    }
    if (c.type === "BUY") {
      const item = String(c.args.item);
      if (Object.hasOwn(ITEMS, item) && !s.player.inventory[item] && Object.values(s.player.inventory).filter((q) => q > 0).length >= INVENTORY_SLOT_LIMIT)
        return fail2("\xC7antan\u0131n 12 e\u015Fya t\xFCr\xFC yuvas\u0131 dolu. Bir yuvay\u0131 bo\u015Faltmal\u0131s\u0131n.");
    }
    if (c.type === "ACCEPT_QUEST") {
      const q = s.quests.find((q2) => q2.id === c.args.questId);
      if (q?.kind === "delivery" && !s.player.inventory[`parcel:${q.id}`] && Object.values(s.player.inventory).filter((q2) => q2 > 0).length >= INVENTORY_SLOT_LIMIT)
        return fail2("Teslimat i\xE7in \xE7antanda bo\u015F bir yuva gerekli.");
    }
    return null;
  }
  function reconcileProgression(s, sourceId = "world") {
    const p = s.progression;
    if (!p) return;
    const day = Math.floor(s.minute / 1440);
    if (day !== p.day) {
      p.day = day;
      p.gainedToday = 0;
    }
    for (const key3 of Object.keys(s.player.skills).sort()) {
      const before = p.lastSkills[key3] ?? s.player.skills[key3], now = s.player.skills[key3];
      if (now > before) {
        const awarded = Math.min(now - before, Math.max(0, DAILY_SKILL_LIMIT - p.gainedToday));
        if (awarded < now - before && s.flags.skillCapNoticeDay !== day) {
          s.flags.skillCapNoticeDay = day;
          notify(
            s,
            "Bug\xFCnk\xFC 20 beceri puan\u0131 s\u0131n\u0131r\u0131na ula\u015Ft\u0131n. Sertifika ve \xFCcret haklar\u0131n korunur; yeni beceri kazan\u0131m\u0131 yar\u0131n devam eder."
          );
        }
        s.player.skills[key3] = before + awarded;
        p.gainedToday += awarded;
      }
      p.lastSkills[key3] = s.player.skills[key3];
    }
    if (Number(s.flags.shiftsCompleted ?? 0) >= 5 && !p.perks.includes("professional"))
      p.perks.push("professional");
    for (const kind of Object.keys(p.items)) if (!s.player.inventory[kind]) delete p.items[kind];
    for (const kind of Object.keys(s.player.inventory).sort()) {
      const count = s.player.inventory[kind];
      if (!Number.isSafeInteger(count) || count < 0 || count > 1e4) continue;
      const units = p.items[kind] ??= [];
      if (units.length > count) units.splice(0, units.length - count);
      while (units.length < count)
        units.push({ id: `item:${s.nextId++}`, kind, acquiredTick: s.tick, sourceId });
    }
    p.updatedTick = s.tick;
  }
  function progressionWageBonus(s) {
    return s.progression?.perks.includes("professional") ? 500 : 0;
  }
  function progressionView(s) {
    const p = s.progression;
    return {
      day: p.day,
      gainedToday: p.gainedToday,
      dailyLimit: DAILY_SKILL_LIMIT,
      slotLimit: INVENTORY_SLOT_LIMIT,
      slotsUsed: Object.values(s.player.inventory).filter((q) => q > 0).length,
      items: p.items,
      perks: p.perks.map((id) => ({
        id,
        name: "Meslek ustal\u0131\u011F\u0131",
        effect: "Be\u015F tamamlanm\u0131\u015F vardiya: sonraki vardiya tekliflerinde +5 \u20BA."
      })),
      retired: p.retired,
      retiredAt: p.retiredAt,
      shiftsCompleted: Number(s.flags.shiftsCompleted ?? 0)
    };
  }
  function validateProgression(s) {
    const errors = [];
    try {
      const p = s.progression;
      if (!p || p.version !== 1) return ["progression schema"];
      if (p.day !== Math.floor(s.minute / 1440) || p.updatedTick !== s.tick)
        errors.push("progression clock");
      if (!Number.isInteger(p.gainedToday) || p.gainedToday < 0 || p.gainedToday > DAILY_SKILL_LIMIT)
        errors.push("daily skill allowance");
      if (!p.lastSkills || typeof p.lastSkills !== "object" || Array.isArray(p.lastSkills))
        errors.push("skill baseline object");
      else {
        const actual = Object.keys(s.player.skills).sort(), last = Object.keys(p.lastSkills).sort();
        if (JSON.stringify(actual) !== JSON.stringify(last)) errors.push("skill baseline keys");
        for (const key3 of actual)
          if (!Number.isFinite(p.lastSkills[key3]) || p.lastSkills[key3] < 0 || p.lastSkills[key3] > 100 || p.lastSkills[key3] !== s.player.skills[key3])
            errors.push("skill baseline:" + key3);
      }
      if (Object.values(s.player.inventory).filter((q) => q > 0).length > INVENTORY_SLOT_LIMIT)
        errors.push("inventory slot capacity");
      const ids = /* @__PURE__ */ new Set();
      if (!p.items || typeof p.items !== "object" || Array.isArray(p.items))
        errors.push("item container");
      else {
        for (const [kind, items] of Object.entries(p.items)) {
          if (!Array.isArray(items)) {
            errors.push("item list:" + kind);
            continue;
          }
          if (items.length !== (s.player.inventory[kind] ?? 0)) errors.push("item count:" + kind);
          for (const item of items) {
            if (!item || typeof item.id !== "string" || !/^item:[0-9]+$/.test(item.id) || ids.has(item.id) || item.kind !== kind || !Number.isSafeInteger(item.acquiredTick) || item.acquiredTick < 0 || item.acquiredTick > s.tick || typeof item.sourceId !== "string" || !item.sourceId || item.sourceId.length > 120)
              errors.push("item identity:" + String(item?.id));
            if (item) ids.add(item.id);
          }
        }
        for (const [kind, count] of Object.entries(s.player.inventory))
          if (count > 0 && p.items[kind]?.length !== count)
            errors.push("missing item instances:" + kind);
      }
      if (!Array.isArray(p.perks) || p.perks.some((id) => id !== "professional") || new Set(p.perks).size !== p.perks.length)
        errors.push("perk identity");
      if (Array.isArray(p.perks) && p.perks.includes("professional") && Number(s.flags.shiftsCompleted ?? 0) < 5)
        errors.push("unearned perk");
      if (typeof p.retired !== "boolean" || p.retired && (!Number.isSafeInteger(p.retiredAt) || p.retiredAt < 0 || p.retiredAt > s.minute) || !p.retired && p.retiredAt !== null)
        errors.push("retirement state");
    } catch {
      errors.push("malformed progression state");
    }
    return errors;
  }

  // src/games/social-engine/simulation/population.ts
  var DEFAULT_PROFILE = {
    name: "Deniz",
    appearance: 0,
    background: "newcomer",
    attributes: { body: 3, mind: 3, social: 3, discipline: 3 }
  };
  var BUILDING_FOR_BUSINESS = {
    market: "b-market",
    tea: "b-cafe",
    garage: "b-garage",
    warehouse: "b-warehouse",
    office: "b-office",
    police: "b-security",
    school: "b-school",
    bank: "b-sales",
    taxi: "b-taxi",
    restaurant: "b-restaurant",
    clinic: "b-clinic"
  };
  function profileErrors(profile) {
    if (!profile || typeof profile !== "object") return ["Profil okunamad\u0131."];
    const errors = [];
    if (typeof profile.name !== "string" || !/^[\p{L}\p{N}][\p{L}\p{N} '-]{1,23}$/u.test(profile.name.trim()))
      errors.push("Ad 2\u201324 karakter olmal\u0131; harf, rakam, bo\u015Fluk, kesme ve tire kullan\u0131labilir.");
    if (!Number.isInteger(profile.appearance) || profile.appearance < 0 || profile.appearance > 7)
      errors.push("Ge\xE7ersiz g\xF6r\xFCn\xFCm.");
    if (!["local", "newcomer", "graduate"].includes(profile.background))
      errors.push("Ge\xE7ersiz ge\xE7mi\u015F.");
    const points = ["body", "mind", "social", "discipline"].map(
      (key3) => profile.attributes?.[key3]
    );
    if (points.some((value) => !Number.isInteger(value) || value < 1 || value > 6) || points.reduce((a, b) => a + b, 0) !== 12)
      errors.push("\xD6zellikler 1\u20136 aral\u0131\u011F\u0131nda ve toplam tam 12 puan olmal\u0131.");
    return errors;
  }
  function person2(seed, index) {
    const local = index < LOCAL_POPULATION, job = JOBS[index % JOBS.length], homeId = `home-${Math.floor(index / 4)}`;
    const building = BUILDINGS.find((b) => b.id === BUILDING_FOR_BUSINESS[job.businessId]);
    const x = building.door.x + (index % 3 - 1) * 0.55, y = building.door.y + 0.7 + Math.floor(index / 14) % 3 * 0.45;
    return {
      id: `n${index}`,
      name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}${index >= 240 ? ` ${index + 1}` : ""}`,
      age: 20 + draw(seed, 1, 0, index) % 47,
      local,
      location: local ? { x, y, scene: "outside" } : { x: 7, y: 9, scene: "b-home" },
      destination: null,
      path: [],
      homeId,
      householdId: `h${Math.floor(index / 4)}`,
      jobId: job.id,
      employerId: job.businessId,
      goal: "idle",
      health: 100,
      stamina: 100,
      hunger: draw(seed, 2, 0, index) % 30,
      fatigue: draw(seed, 3, 0, index) % 20,
      debt: 0,
      income: 0,
      expenses: 0,
      propertyIds: [],
      skills: {
        driving: 10,
        combat: 10,
        communication: 10,
        technical: 10,
        trade: 10,
        academic: 10,
        body: 10,
        discipline: 10
      },
      memories: [],
      wanted: 0,
      lastDecision: -100 - index,
      appearance: index % 8,
      alive: true
    };
  }
  function initializeWorld(seed, input = DEFAULT_PROFILE, populationCount = LOCAL_POPULATION + BACKGROUND_POPULATION) {
    if (![1100, 1e4].includes(populationCount))
      throw new Error("Unsupported population configuration");
    if (!Number.isSafeInteger(seed)) throw new Error("D\xFCnya seed de\u011Feri tamsay\u0131 olmal\u0131.");
    const errors = profileErrors(input);
    if (errors.length) throw new Error(errors.join(" "));
    const profile = structuredClone(input);
    profile.name = profile.name.trim();
    const player = {
      ...person2(seed, 0),
      id: "player",
      name: profile.name,
      age: 24,
      local: true,
      profile,
      appearance: profile.appearance,
      homeId: "player-home",
      householdId: "player-household",
      jobId: null,
      employerId: null,
      location: { ...SPAWN, scene: "outside" },
      inventory: { simit: 2 },
      reputation: 0,
      influence: 0,
      vehicleId: null,
      shift: null,
      blocking: false,
      attackUntil: 0,
      cooldownUntil: 0
    };
    player.skills.communication = profile.attributes.social * 2;
    player.skills.technical = profile.attributes.mind * 2;
    player.skills.combat = profile.attributes.body * 2;
    player.skills.academic = profile.background === "graduate" ? 25 : 10;
    const npcs = Array.from({ length: populationCount }, (_, index) => person2(seed, index));
    npcs[0].location = { x: SPAWN.x + 1, y: SPAWN.y, scene: "outside" };
    npcs[0].goal = "greet";
    const businesses = Object.entries(BUILDING_FOR_BUSINESS).map(
      ([id, buildingId], index) => ({
        id,
        buildingId,
        ownerId: `n${index}`,
        employees: npcs.filter((npc) => npc.employerId === id).map((npc) => npc.id),
        stock: {
          simit: id === "market" ? 250 : 20,
          tea: 120,
          meal: 80,
          medicine: 60,
          parts: id === "garage" ? 3 : 30,
          book: 30
        },
        prices: { simit: 1800, tea: 1200, meal: 7500, medicine: 9500, parts: 5500, book: 4200 },
        wage: JOBS.find((job) => job.businessId === id)?.wage ?? 1e4,
        status: "open",
        sales: 0
      })
    );
    const accounts = {
      player: 125e3,
      external: 9e11,
      bank: 1e8,
      municipality: 1e8,
      landlord: 1e8,
      quests: 1e8
    };
    for (const npc of npcs)
      accounts[npc.id] = 3e5 + draw(seed, 4, 0, Number(npc.id.slice(1))) % 4e5;
    for (const business of businesses) accounts[`business:${business.id}`] = 2e7;
    const state = {
      economy: void 0,
      social: void 0,
      progression: void 0,
      mobility: {
        version: 1,
        weather: { kind: "clear", day: 0 },
        speed: 1,
        parking: [],
        rentals: [],
        trip: null
      },
      life: {
        version: 2,
        guardians: {},
        births: [],
        deaths: [],
        estates: [],
        demography: {
          initialPopulation: 1100,
          maxBirths: 24,
          lastDailyAt: 0,
          lastAgingYear: 0,
          parenthoodAt: {}
        },
        properties: [],
        leases: [],
        budgets: [],
        parentage: {},
        consents: [],
        partnerships: [],
        enrollments: [],
        certificates: [],
        aidLastAt: {},
        archivedHouseholds: [],
        lastDailyAt: 0
      },
      schemaVersion: SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
      seed: seed >>> 0,
      tick: 0,
      minute: 8 * 60,
      rng: seed >>> 0,
      nextId: 1,
      player,
      npcs,
      households: [
        ...Array.from({ length: Math.ceil(npcs.length / 4) }, (_, index) => ({
          id: `h${index}`,
          members: npcs.slice(index * 4, index * 4 + 4).map((npc) => npc.id),
          homeId: `home-${index}`,
          rent: 4e4,
          arrears: 0
        })),
        {
          id: "player-household",
          members: ["player"],
          homeId: "player-home",
          rent: 65e3,
          arrears: 0
        }
      ],
      businesses,
      accounts,
      openingTotal: Object.values(accounts).reduce((a, b) => a + b, 0),
      ledger: [],
      ledgerCheckpoint: { count: 0, balances: { ...accounts } },
      events: [],
      eventCount: 0,
      relations: [],
      quests: [],
      crimes: [],
      vehicles: Array.from({ length: 8 }, (_, index) => {
        const lane = index % 4, progress = index === 0 ? 10 : index * 13;
        const p = pointOnLane(lane, progress);
        return {
          id: `v${index}`,
          location: { x: p.x, y: p.y, scene: "outside" },
          heading: p.heading,
          speed: index === 0 ? 0 : 1.8 + index % 3 * 0.4,
          driverId: index === 0 ? null : `n${80 + index}`,
          lane,
          progress,
          color: index === 0 ? 14265940 : [13201241, 10860740, 14735812][index % 3]
        };
      }),
      processedCommands: [],
      flags: {
        ...populationCount === 1e4 ? { benchmarkPopulation: 1e4 } : {},
        moveX: 0,
        moveY: 0,
        sprint: false,
        throttle: 0,
        steer: 0,
        day: 0,
        debtInterest: 0,
        faction: "",
        tutorial: 0,
        "faction:dock": 20,
        "faction:hill": 20,
        "faction:night": 20
      },
      notices: [
        "K\u0131y\u0131yaka\u2019ya ho\u015F geldin. Deniz ile konu\u015F; i\u015F, kom\u015Fuluk veya ke\u015Fifle kendi yolunu kur."
      ]
    };
    for (const vehicle of state.vehicles)
      if (vehicle.driverId) {
        const driver = npcs.find((npc) => npc.id === vehicle.driverId);
        driver.location = { ...vehicle.location };
        driver.goal = "drive";
      }
    for (const household3 of state.households)
      for (let i = 1; i < household3.members.length; i++) {
        const edge = relation(state, household3.members[0], household3.members[i]);
        edge.trust = 40;
        edge.affection = 35;
      }
    emit(state, "arrival", `${profile.name}, K\u0131y\u0131yaka\u2019da yeni bir g\xFCne ba\u015Flad\u0131.`, ["player"]);
    return state;
  }

  // src/games/social-engine/simulation/missions.ts
  function eventEligible(state, template) {
    if (Number(state.flags[`event:${template.kind}`] ?? -1e5) + template.cooldownMinutes > state.minute)
      return false;
    const business = state.businesses.find((item) => item.id === template.requiredLocation);
    switch (template.kind) {
      case "job_offer":
        return state.businesses.some((item) => item.status === "open");
      case "late_wage":
        return state.businesses.some((item) => item.status === "distressed");
      case "layoff":
        return state.npcs.some((npc) => npc.alive && npc.age >= 18 && !npc.jobId);
      case "promotion":
        return Object.values(state.player.skills).some((value) => value >= 20);
      case "rent_rise":
        return state.households.some((household3) => household3.arrears > 0) || state.minute >= 1440 * 7;
      case "loan_due":
        return state.player.debt > 0;
      case "price_shock":
        return state.minute >= 1440;
      case "shortage":
        return !!business && Object.values(business.stock).some((stock) => stock < 8);
      case "delivery":
        return !!state.businesses.find((item) => item.id === "warehouse" && item.stock.parts > 0);
      case "vehicle_breakdown":
        return state.flags.vehicleWear === true;
      case "traffic_jam":
        return state.vehicles.filter((vehicle) => vehicle.speed < 1).length >= 2;
      case "lost_item":
        return state.minute >= 600;
      case "neighbor_help":
        return state.npcs.some((npc) => npc.alive && npc.age >= 18 && npc.hunger >= 20);
      case "friend_invite":
        return state.relations.some((edge) => edge.to === "player" && edge.trust >= 8);
      case "relationship_dispute":
        return state.relations.some((edge) => edge.resentment >= 10);
      case "scholarship":
        return state.player.skills.academic < 40;
      case "neighborhood_argument":
        return state.relations.some((edge) => edge.trust < 0);
      case "witness_report":
        return state.crimes.some(
          (crime) => crime.witnesses.length > 0 && crime.status !== "resolved"
        );
      case "police_check":
        return state.crimes.some((crime) => crime.reported && crime.status !== "resolved");
      case "faction_truce":
        return Math.max(...["dock", "hill", "night"].map((id) => Number(state.flags[`faction:${id}`]))) > 25;
    }
  }
  var descriptions = {
    job_offer: "Marketle g\xF6r\xFC\u015F. Aktif bir i\u015Fe girip ilan sahibine d\xF6n; bir referans kap\u0131s\u0131 a\xE7\u0131ls\u0131n.",
    late_wage: "Tamirhaneye u\u011Fra ve patronla g\xF6r\xFC\u015F. Geciken \xFCcretler i\xE7in kom\u015Fuluk fonunun arac\u0131l\u0131\u011F\u0131 gerekiyor.",
    layoff: "\u0130\u015Fsiz kalan kom\u015Fu i\xE7in kooperatife u\u011Fra. Bir vardiya tamamlamak yeniden ba\u015Flama yolunu g\xF6sterir.",
    promotion: "Kooperatifte becerini g\xF6ster. En az bir beceriyi 20 seviyesine getir.",
    rent_rise: "Yuva Apartman\u0131 toplant\u0131s\u0131na kat\u0131l. Bir kom\u015Fuyla g\xFCven ili\u015Fkisi kurarak arabuluculuk yap.",
    loan_due: "K\u0131y\u0131 Finans \u015Fubesine u\u011Fra. Bor\xE7 bakiyeni azalt ve \xF6deme kayd\u0131n\u0131 g\xF6ster.",
    price_shock: "Market fiyatlar\u0131n\u0131 \xF6\u011Fren. Bir ticaret dersiyle b\xFCt\xE7e bilgisini art\u0131r.",
    shortage: "Tamirhanede par\xE7a azald\u0131. Bir yedek par\xE7a bul ve ustaya getir.",
    delivery: "Liman deposunun paketi ayr\u0131ld\u0131. Kabul etti\u011Finde \xE7antana konur; Mart\u0131 Taksi\u2019ye teslim et.",
    vehicle_breakdown: "Ustaya bir yedek par\xE7a getir. Tamir, ara\xE7 filosunun yeniden hareket etmesini sa\u011Flar.",
    traffic_jam: "Taksi dura\u011F\u0131na u\u011Fra. Ara\xE7la yol graf\u0131nda ilerleyip darbo\u011Faz\u0131 a\u015F.",
    lost_item: "\xC7\u0131nar \xC7ayevi\u2019ne u\u011Fra. Bulunan c\xFCzdan\u0131 sahibine ula\u015Ft\u0131rmak i\xE7in kom\u015Fuyla konu\u015F.",
    neighbor_help: "Yuva Apartman\u0131\u2019ndaki kom\u015Fuya bir simit getir. K\xFC\xE7\xFCk yard\u0131m uzun s\xFCre hat\u0131rlan\u0131r.",
    friend_invite: "\xC7\u0131nar \xC7ayevi\u2019nde bulu\u015F. Bir \xE7ay getir ve arkada\u015F\u0131nla g\xFCvenini geli\u015Ftir.",
    relationship_dispute: "Sahil Sofras\u0131\u2019ndaki tart\u0131\u015Fmay\u0131 yat\u0131\u015Ft\u0131r. Bir kom\u015Fuya yard\u0131m ederek g\xFCvenini g\xF6ster.",
    scholarship: "Ufuk Akademi\u2019ye u\u011Fra. Akademik becerinde bir derslik ilerleme yap; destek \xF6demesi haz\u0131r.",
    neighborhood_argument: "Bereket Market \xF6n\xFCndeki tart\u0131\u015Fmada kom\u015Fuyu dinle. Olumlu bir konu\u015Fmayla arabuluculuk yap.",
    witness_report: "Karakola git. Ger\xE7ek bir tan\u0131k kayd\u0131na dayanan olay\u0131 bildir.",
    police_check: "Karakola u\u011Fra. Aktif takibi \xE7\xF6z\xFCme ula\u015Ft\u0131r; olay dosyas\u0131 kay\u0131t alt\u0131nda kalacak.",
    faction_truce: "Sahil Sofras\u0131\u2019nda \xFC\xE7 \xE7evreyi bulu\u015Ftur. Sosyal itibar\u0131 10 seviyesine \xE7\u0131kar."
  };
  function offerEvent(state, kind) {
    const template = EVENT_TEMPLATES.find((item) => item.kind === kind);
    if (!eventEligible(state, template) || state.quests.filter((quest2) => quest2.status === "offered" || quest2.status === "active").length >= 8)
      return null;
    const business = kind === "late_wage" ? state.businesses.find((item) => item.status === "distressed") : kind === "job_offer" ? state.businesses.find((item) => item.status === "open") : state.businesses.find((item) => item.id === template.requiredLocation);
    const unemployed = kind === "layoff" ? state.npcs.find((npc) => npc.alive && npc.age >= 18 && !npc.jobId) : void 0;
    const issuerId = unemployed?.id ?? business?.ownerId ?? state.npcs.find((n) => n.alive && n.age >= 18)?.id;
    if (!issuerId) return null;
    const issuer = state.npcs.find((n) => n.id === issuerId);
    if (!issuer?.alive || issuer.age < 18) return null;
    const buildingId = kind === "late_wage" || kind === "job_offer" ? business.buildingId : kind === "delivery" || kind === "traffic_jam" ? "b-taxi" : kind === "loan_due" ? "b-bank" : kind === "witness_report" || kind === "police_check" ? "b-police" : kind === "neighbor_help" || kind === "rent_rise" ? "b-home" : BUILDING_FOR_BUSINESS[template.requiredLocation] ?? "b-home";
    if (state.quests.some(
      (quest2) => (quest2.status === "offered" || quest2.status === "active") && (quest2.issuerId === issuerId || quest2.buildingId === buildingId)
    ))
      return null;
    const id = `q${state.nextId++}`, account2 = `escrow:${id}`;
    state.accounts[account2] = 0;
    state.ledgerCheckpoint.balances[account2] = 0;
    if (!transfer(state, `reserve:${id}`, "quests", account2, template.reward, "mission-reserve")) {
      delete state.accounts[account2];
      delete state.ledgerCheckpoint.balances[account2];
      return null;
    }
    const cause = [...state.events].reverse().find(
      (event2) => event2.actors.includes(issuerId) && (kind === "late_wage" ? ["business_distress", "late_wage"].includes(event2.kind) : kind === "layoff" ? event2.kind === "layoff" : event2.kind === kind)
    );
    const source = emit(
      state,
      kind,
      template.title,
      [issuerId],
      "player",
      kind === "loan_due" ? "private" : "public",
      [],
      cause?.id ?? null
    );
    const description = kind === "late_wage" ? "Ekonomik s\u0131k\u0131nt\u0131 ya\u015Fayan i\u015Fyerine u\u011Fra. Kom\u015Fuluk fonu \xFCcretlerin \xF6denmesine arac\u0131l\u0131k edebilir." : descriptions[kind];
    const quest = {
      id,
      kind,
      title: template.title,
      description,
      issuerId,
      targetId: issuerId,
      buildingId,
      sourceEvent: source.id,
      status: "offered",
      reward: template.reward,
      deadline: state.minute + template.expiryMinutes,
      progress: 0,
      required: 1
    };
    state.quests.push(quest);
    state.flags[`event:${kind}`] = state.minute;
    if (kind === "loan_due") state.flags[`questDebt:${id}`] = state.player.debt;
    if (kind === "scholarship") state.flags[`questAcademic:${id}`] = state.player.skills.academic;
    notify(state, `Yeni f\u0131rsat: ${quest.title}. Telefonundaki g\xF6revlerden inceleyebilirsin.`);
    return quest;
  }
  function missionMinute(state) {
    for (const quest of state.quests)
      if ((quest.status === "active" || quest.status === "offered") && state.minute >= quest.deadline) {
        quest.status = "expired";
        const account2 = `escrow:${quest.id}`, balance = state.accounts[account2];
        if (balance)
          transfer(state, `expire:${quest.id}`, account2, "quests", balance, "mission-expired");
        if (state.player.inventory[`parcel:${quest.id}`]) {
          state.businesses.find((b) => b.id === "warehouse").stock.parts += state.player.inventory[`parcel:${quest.id}`];
          delete state.player.inventory[`parcel:${quest.id}`];
        }
        emit(
          state,
          "mission_expired",
          `${quest.title}: s\xFCre doldu. Ba\u015Fka f\u0131rsatlar a\xE7\u0131k.`,
          [quest.issuerId],
          "player",
          "private"
        );
      }
    if (state.minute % 30 !== 0) return;
    const eligible = EVENT_TEMPLATES.filter((template) => eventEligible(state, template));
    if (eligible.length)
      offerEvent(state, eligible[draw(state.seed, 20, state.minute) % eligible.length].kind);
  }
  function validateMissionReservations(state) {
    const errors = [], pending = state.quests.filter((q) => q.status === "active" || q.status === "offered");
    for (let i = 0; i < pending.length; i++)
      for (let j = i + 1; j < pending.length; j++)
        if ((pending[i].issuerId === pending[j].issuerId || pending[i].buildingId === pending[j].buildingId) && !(state.flags["legacyReservation:" + pending[i].id] === true && state.flags["legacyReservation:" + pending[j].id] === true))
          errors.push("conflicting-quest-reservations:" + pending[i].id + ":" + pending[j].id);
    return errors;
  }

  // src/games/social-engine/simulation/society.ts
  function routineTarget(state, npc, index) {
    const minute = state.minute % 1440;
    if (npc.age < 18)
      return {
        goal: npc.age >= 6 && minute >= 480 && minute < 900 ? "school" : "care",
        building: npc.age >= 6 && minute >= 480 && minute < 900 ? "b-school" : "b-home"
      };
    if (npc.health < 35) return { goal: "heal", building: "b-clinic" };
    if (npc.hunger > 75) return { goal: "eat", building: "b-market" };
    if (minute < 6 * 60 || minute >= 22 * 60) return { goal: "sleep", building: "b-home" };
    if (!npc.jobId) return { goal: "seekJob", building: "b-office" };
    if (minute >= 9 * 60 + index % 45 && minute < 17 * 60 + index % 45)
      return {
        goal: "work",
        building: BUILDING_FOR_BUSINESS[npc.employerId ?? "market"] ?? "b-market"
      };
    return { goal: "socialize", building: index % 2 ? "b-cafe" : "b-restaurant" };
  }
  function npcMovement(state) {
    const player = state.player;
    let detailed = 0;
    for (let index = 0; index < 100; index++) {
      const npc = state.npcs[index];
      if (npc.goal === "drive" || !npc.alive) continue;
      if (npc.id === "n0" && state.minute < 490) continue;
      const near2 = npc.location.scene === player.location.scene && Math.hypot(npc.location.x - player.location.x, npc.location.y - player.location.y) < 16 && detailed < 25;
      if (near2) detailed++;
      if (!near2 && state.tick % 10 !== index % 10) continue;
      if (state.minute >= npc.lastDecision + 20 && (npc.path.length === 0 || state.minute >= npc.lastDecision + 60)) {
        const plan = routineTarget(state, npc, index), target = BUILDINGS.find((building) => building.id === plan.building);
        npc.lastDecision = state.minute;
        if (npc.location.scene !== "outside") {
          if (npc.location.scene === target.id) {
            npc.goal = plan.goal;
            continue;
          }
          const current = BUILDINGS.find((building) => building.id === npc.location.scene);
          if (current) npc.location = { ...current.door, scene: "outside" };
        }
        npc.goal = plan.goal;
        npc.destination = { ...target.door };
        npc.path = findPath(npc.location, target.door);
      }
      if (npc.path.length) {
        const target = npc.path[0], dx = target.x - npc.location.x, dy = target.y - npc.location.y, distance3 = Math.hypot(dx, dy);
        const speed = near2 ? 0.105 : 1.05;
        if (distance3 <= speed) {
          npc.location.x = target.x;
          npc.location.y = target.y;
          npc.path.shift();
        } else {
          const next = moveWithCollision(
            npc.location,
            { x: dx / distance3 * speed, y: dy / distance3 * speed },
            npc.location.scene
          );
          npc.location.x = next.x;
          npc.location.y = next.y;
        }
        if (!npc.path.length && npc.destination) {
          const building = BUILDINGS.find(
            (item) => Math.hypot(item.door.x - npc.location.x, item.door.y - npc.location.y) < 0.4
          );
          if (building) {
            npc.location = { x: 4 + index % 5, y: 6 + index % 3, scene: building.id };
            npc.destination = null;
          }
        }
      }
    }
  }
  function societyMinute(state) {
    if (state.minute % 60 === 0) {
      const hour = state.minute % 1440;
      for (let index = 0; index < state.npcs.length; index++) {
        const npc = state.npcs[index];
        if (!npc.alive) continue;
        if (npc.age < 18) {
          const plan = routineTarget(state, npc, index);
          scheduleBackgroundTravel(state, npc, plan, index);
          npc.hunger = clamp(npc.hunger + 2);
          npc.fatigue = clamp(npc.fatigue + (hour < 360 || hour >= 1200 ? -15 : 1));
          continue;
        }
        npc.hunger = clamp(npc.hunger + 4);
        npc.fatigue = clamp(npc.fatigue + 3);
        if (npc.goal === "sleep") npc.fatigue = clamp(npc.fatigue - 22);
        if (npc.goal === "heal") npc.health = clamp(npc.health + 15);
        if (!npc.local) {
          const plan = routineTarget(state, npc, index);
          scheduleBackgroundTravel(state, npc, plan, index);
        }
        requestNpcMeal(state, npc);
        if (hour >= 1200 && hour < 1260 && index < 100) {
          const friend = state.npcs[(index + 1) % 100];
          if (friend.alive && friend.age >= 18 && friend.location.scene === npc.location.scene)
            adjustRelation(state, npc.id, friend.id, 1, 1);
        }
      }
    }
    if (state.minute % 1440 === 0) dailyEconomy(state);
  }
  function dailyEconomy(state) {
    const day = Math.floor(state.minute / 1440);
    state.flags.day = day;
    closeAttendanceDay(state);
    for (const business of state.businesses) {
      if (business.status === "closed") continue;
      const revenue = Math.floor(
        (7e4 + business.employees.length * (1e4 + draw(state.seed, 40, day, business.id.length) % 6e3)) * (business.status === "distressed" ? 0.6 : 1) * (state.mobility.weather.kind === "rain" ? 0.96 : state.mobility.weather.kind === "wind" ? 0.98 : 1)
      );
      transfer(
        state,
        `trade:${day}:${business.id}`,
        "external",
        `business:${business.id}`,
        revenue,
        "external-trade"
      );
      if (state.accounts[`business:${business.id}`] < business.employees.length * business.wage / 2) {
        business.status = "closed";
        emit(
          state,
          "business_closed",
          `${BUILDINGS.find((b) => b.id === business.buildingId).name} maa\u015F y\xFCk\xFCn\xFC kar\u015F\u0131layamad\u0131\u011F\u0131 i\xE7in faaliyetini durdurdu.`,
          [business.ownerId],
          business.id
        );
        if (state.player.employerId === business.id) {
          state.player.employerId = null;
          state.player.jobId = null;
          state.player.shift = null;
          business.employees = business.employees.filter((id) => id !== "player");
          notify(state, "\u0130\u015Fyerin kapand\u0131. Yeni i\u015F ilanlar\u0131, e\u011Fitim ve dayan\u0131\u015Fma deste\u011Fi a\xE7\u0131k.");
        }
        continue;
      }
      produceBusiness(state, business);
    }
    for (let index = 0; index < state.npcs.length; index++) {
      const npc = state.npcs[index];
      if (!npc.alive || npc.age < 18) continue;
      if (npc.employerId && npc.jobId) {
        const employer = state.businesses.find((business) => business.id === npc.employerId);
        const wage = attendedWage(
          state,
          npc,
          employer.status === "distressed" ? Math.floor(employer.wage * 0.7) : employer.wage
        );
        if (employer.status !== "closed" && wage > 0 && transfer(
          state,
          `salary:${day}:${npc.id}`,
          `business:${employer.id}`,
          npc.id,
          wage,
          "npc-payroll"
        ))
          npc.income += wage;
        else if (employer.status === "closed" || wage > 0) {
          employer.employees = employer.employees.filter((id) => id !== npc.id);
          npc.jobId = null;
          npc.employerId = null;
          if (index < 100) emit(state, "layoff", `${npc.name} yeni bir i\u015F ar\u0131yor.`, [npc.id]);
        }
      } else {
        const candidate = state.businesses.filter((business) => business.status === "open")[draw(state.seed, 42, day, index) % state.businesses.filter((business) => business.status === "open").length];
        const job = candidate && JOBS.find((item) => item.businessId === candidate.id);
        if (candidate && job) {
          npc.jobId = job.id;
          npc.employerId = candidate.id;
          candidate.employees.push(npc.id);
          if (index < 100)
            emit(state, "job_changed", `${npc.name}, ${job.name} olarak i\u015Fe ba\u015Flad\u0131.`, [npc.id]);
        } else
          transfer(
            state,
            `support:${day}:${npc.id}`,
            "municipality",
            npc.id,
            2e3,
            "subsistence-support"
          );
      }
      if (state.accounts[npc.id] < 1e4 && npc.debt < 3e4 && npc.jobId && transfer(state, `npc-loan:${day}:${npc.id}`, "bank", npc.id, 1e4, "npc-emergency-loan")) {
        npc.debt += 1e4;
        state.flags[`loanAsset:${npc.id}`] = Number(state.flags[`loanAsset:${npc.id}`] ?? 0) + 1e4;
      }
      if (npc.debt > 0 && day % 7 === 0) {
        const interest = Math.ceil(npc.debt / 100);
        npc.debt += interest;
        state.flags[`loanAsset:${npc.id}`] = Number(state.flags[`loanAsset:${npc.id}`] ?? 0) + interest;
        const payment = Math.min(npc.debt, Math.max(0, state.accounts[npc.id] - 1e5), 1e4);
        if (payment && transfer(state, `debt:${day}:${npc.id}`, npc.id, "bank", payment, "debt-payment")) {
          npc.debt -= payment;
          state.flags[`loanAsset:${npc.id}`] = Number(state.flags[`loanAsset:${npc.id}`]) - payment;
        }
      }
    }
    if (day % 7 === 0) {
      if (state.player.debt > 0) {
        const interest = Math.ceil(state.player.debt / 100);
        state.player.debt += interest;
        state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + interest;
        state.flags.debtInterest = Number(state.flags.debtInterest) + interest;
        emit(
          state,
          "loan_due",
          `Haftal\u0131k %1 oyun faizi: ${(interest / 100).toFixed(2)} TL.`,
          ["player"],
          null,
          "private"
        );
      }
    }
    const affected = state.businesses[draw(state.seed, 43, Math.floor(day / 3)) % state.businesses.length];
    if (day % 3 === 0 && affected.status !== "closed") {
      affected.status = "distressed";
      emit(
        state,
        "business_distress",
        `${BUILDINGS.find((b) => b.id === affected.buildingId).name} talep daralmas\u0131 ya\u015F\u0131yor; yeni vardiyalar\u0131n \xFCcreti %30 azald\u0131.`,
        [affected.ownerId]
      );
      if (state.player.employerId === affected.id)
        notify(
          state,
          "\u0130\u015Fyerindeki daralma yeni vardiya \xFCcretini d\xFC\u015F\xFCrd\xFC. \u0130stifa, e\u011Fitim veya i\u015Fletmeyi devralma se\xE7eneklerin a\xE7\u0131k."
        );
    }
    if (day % 3 === 2) {
      for (const business of state.businesses)
        if (business.status === "distressed" && state.accounts[`business:${business.id}`] > business.wage * 3)
          business.status = "open";
    }
    if (day % 5 === 0) {
      state.flags.vehicleWear = true;
      state.vehicles[2].speed = 0;
      emit(state, "vehicle_breakdown", "Taksi filosunda bak\u0131m ihtiyac\u0131 olu\u015Ftu.", ["n2"]);
    }
    if (day % 2 === 0) {
      const a = state.npcs[day % 100], b = state.npcs[(day + 1) % 100];
      if (a.alive && b.alive && a.age >= 18 && b.age >= 18)
        adjustRelation(state, a.id, b.id, -5, 0, 0, 12);
    }
    if (day % 7 === 0) {
      const conflict = state.relations.find(
        (edge) => edge.from !== "player" && edge.to !== "player" && edge.resentment >= 20 && edge.trust <= -10
      );
      if (conflict) {
        const offender = state.npcs.find((n) => n.id === conflict.from), victim = state.npcs.find((n) => n.id === conflict.to);
        if (offender?.alive && victim?.alive && offender.age >= 18 && victim.age >= 18 && offender.location.scene === victim.location.scene && Math.hypot(
          offender.location.x - victim.location.x,
          offender.location.y - victim.location.y
        ) <= 3 && hasLineOfSight(offender.location, victim.location, offender.location.scene)) {
          const witnesses = state.npcs.slice(0, 100).filter(
            (npc) => npc.alive && npc.age >= 18 && npc.id !== offender.id && npc.id !== victim.id && npc.location.scene === offender.location.scene && Math.hypot(npc.location.x - victim.location.x, npc.location.y - victim.location.y) <= 8 && hasLineOfSight(npc.location, victim.location, npc.location.scene)
          ).map((npc) => npc.id);
          if (state.player.location.scene === victim.location.scene && Math.hypot(
            state.player.location.x - victim.location.x,
            state.player.location.y - victim.location.y
          ) <= 8 && hasLineOfSight(state.player.location, victim.location, victim.location.scene))
            witnesses.push("player");
          const id = `crime:${state.nextId++}`;
          victim.health = clamp(victim.health - 8);
          conflict.resentment = Math.max(0, conflict.resentment - 15);
          state.crimes.push({
            id,
            offender: offender.id,
            victim: victim.id,
            witnesses,
            evidence: witnesses.map((witness) => `saw:${witness}`),
            reported: false,
            status: "unreported",
            tick: state.tick,
            fine: 1e4
          });
          emit(
            state,
            "neighborhood_argument",
            `${offender.name} ile ${victim.name} aras\u0131ndaki tart\u0131\u015Fma yaralanmayla sonu\xE7land\u0131.`,
            [offender.id, victim.id],
            victim.id,
            "witnessed",
            witnesses
          );
        }
      }
    }
    if (day % 7 === 0) {
      const faction = ["dock", "hill", "night"][draw(state.seed, 44, day) % 3];
      state.flags[`faction:${faction}`] = clamp(Number(state.flags[`faction:${faction}`]) + 6);
    }
    economyDayEnd(state);
  }

  // src/games/social-engine/simulation/family.ts
  var DAY3 = 1440;
  var YEAR = 365 * DAY3;
  var people3 = (s) => [s.player, ...s.npcs];
  var person3 = (s, id) => people3(s).find((n) => n.id === id);
  var household = (s, id) => s.households.find((h) => h.id === id);
  var failed = (reason) => ({ ok: false, reason, events: [] });
  var zero = (s, id) => {
    if (!Object.hasOwn(s.accounts, id)) {
      s.accounts[id] = 0;
      s.ledgerCheckpoint.balances[id] = 0;
    }
  };
  var paid = (s, id, from, to, value, reason) => {
    if (value > 0 && !transfer(s, id, from, to, value, reason))
      throw new Error(`Verified family transfer failed: ${reason}`);
  };
  function familyDefaults(s) {
    return {
      guardians: {},
      births: [],
      deaths: [],
      estates: [],
      demography: {
        initialPopulation: s.flags.benchmarkPopulation === 1e4 ? 1e4 : 1100,
        maxBirths: 24,
        lastDailyAt: Math.floor(s.minute / DAY3) * DAY3,
        lastAgingYear: Math.floor(s.minute / YEAR),
        parenthoodAt: {}
      }
    };
  }
  function birthEligibility(s, parentIds) {
    const [a, b] = parentIds.map((id) => person3(s, id));
    if (!a || !b || a.id === b.id || !a.alive || !b.alive || a.age < 18 || b.age < 18 || a.age > 55 || b.age > 55)
      return "\xC7ocuk plan\u0131 i\xE7in iki ya\u015Fayan yeti\u015Fkin ebeveyn gerekir (18\u201355).";
    if (a.householdId !== b.householdId || !s.life.partnerships.some(
      (p) => p.status === "married" && [p.a, p.b].includes(a.id) && [p.a, p.b].includes(b.id)
    ))
      return "\u0130ki ebeveynin evlilik ve ortak konut kayd\u0131 gerekli.";
    const h = household(s, a.householdId), home = s.life.properties.find((p) => p.id === h?.homeId);
    if (!h || !home || h.members.length >= home.capacity)
      return "\xC7ocuk i\xE7in konutta bo\u015F kapasite gerekli.";
    if (s.life.births.length >= s.life.demography.maxBirths)
      return "Bu mahallenin yeni \xE7ocuk kapasitesi doldu.";
    if (parentIds.some((id) => s.minute - (s.life.demography.parenthoodAt[id] ?? -YEAR) < YEAR))
      return "Yeni aile plan\u0131 i\xE7in bir oyun y\u0131l\u0131 ge\xE7meli.";
    return null;
  }
  function processBirth(s, parentIds, txId) {
    if (s.life.births.some((b) => b.id === txId)) return failed("Bu do\u011Fum daha \xF6nce kaydedildi.");
    const reason = birthEligibility(s, parentIds);
    if (reason) return failed(reason);
    if (!parentIds.every(
      (from, i) => s.life.consents.some(
        (c) => c.from === from && c.to === parentIds[1 - i] && c.purpose === "parenthood" && c.accepted && c.minute === s.minute
      )
    ))
      return failed("\u0130ki ebeveynin g\xFCncel aile kurma r\u0131zas\u0131 gerekli.");
    const a = person3(s, parentIds[0]), h = household(s, a.householdId), id = `born:${s.nextId++}`;
    const child = {
      id,
      name: `Bebek ${s.life.births.length + 1}`,
      age: 0,
      local: false,
      location: { x: 7, y: 9, scene: "b-home" },
      destination: null,
      path: [],
      homeId: h.homeId,
      householdId: h.id,
      jobId: null,
      employerId: null,
      goal: "care",
      health: 100,
      stamina: 100,
      hunger: 0,
      fatigue: 0,
      debt: 0,
      income: 0,
      expenses: 0,
      propertyIds: [],
      skills: {
        driving: 0,
        combat: 0,
        communication: 0,
        technical: 0,
        trade: 0,
        academic: 0,
        body: 0,
        discipline: 0
      },
      memories: [],
      wanted: 0,
      lastDecision: s.minute,
      appearance: a.appearance,
      alive: true
    };
    s.npcs.push(child);
    zero(s, id);
    h.members.push(id);
    s.life.budgets.find((b) => b.householdId === h.id).shares[id] = 0;
    s.life.parentage[id] = [...parentIds];
    s.life.guardians[id] = [...parentIds];
    s.life.births.push({
      id: txId,
      childId: id,
      parentIds: [...parentIds],
      householdId: h.id,
      minute: s.minute
    });
    for (const parent of parentIds) s.life.demography.parenthoodAt[parent] = s.minute;
    const event2 = emit(
      s,
      "child_born",
      `${child.name} haneye kat\u0131ld\u0131. Bak\u0131m ve konut sorumlulu\u011Fu ebeveynlere ba\u011Fl\u0131.`,
      [...parentIds, id],
      id,
      "private"
    );
    if (parentIds.includes("player")) notify(s, event2.text);
    return { ok: true, reason: event2.text, events: [event2.id] };
  }
  function assignGuardian(s, childId, guardianId, txId) {
    if (s.flags[`guardianDecision:${txId}`] === true)
      return failed("Bu vasi karar\u0131 daha \xF6nce i\u015Flendi.");
    const child = person3(s, childId), guardian = person3(s, guardianId);
    if (!child?.alive || child.age >= 18 || guardianId !== "municipality" && (!guardian?.alive || guardian.age < 18 || guardian.id === childId))
      return failed("\xC7ocuk ve ya\u015Fayan yeti\u015Fkin vasi kayd\u0131 gerekli.");
    s.life.guardians[childId] = [guardianId];
    const event2 = emit(
      s,
      "guardianship_assigned",
      `${child.name} i\xE7in ${guardian?.name ?? "mahalle \xE7ocuk bak\u0131m birimi"} bak\u0131m sorumlulu\u011Funu \xFCstlendi.`,
      [childId, ...guardian ? [guardian.id] : []],
      childId,
      "private"
    );
    s.flags[`guardianDecision:${txId}`] = true;
    return { ok: true, reason: event2.text, events: [event2.id] };
  }
  function rehomeEmpty(s, h) {
    if (h.members.length) return;
    const home = s.life.properties.find((p) => p.id === h.homeId);
    if (home) home.occupantHouseholdId = null;
    for (const lease2 of s.life.leases.filter(
      (l) => l.householdId === h.id && l.status === "active"
    )) {
      paid(
        s,
        `empty-house:${lease2.id}:${s.minute}`,
        lease2.depositAccount,
        lease2.payerId,
        s.accounts[lease2.depositAccount],
        "estate-lease-refund"
      );
      lease2.status = "ended";
    }
    for (const p of s.life.properties) if (p.reservation?.householdId === h.id) p.reservation = null;
    s.life.archivedHouseholds.push(h.id);
    s.households = s.households.filter((x) => x.id !== h.id);
    s.life.budgets = s.life.budgets.filter((b) => b.householdId !== h.id);
  }
  function ownerOf(s, id) {
    return s.life.properties.find((p) => p.id === id)?.ownerId ?? s.businesses.find((b) => b.id === id)?.ownerId;
  }
  function moveDeed(s, id, to) {
    const from = ownerOf(s, id);
    if (from === to) return;
    const old = from && person3(s, from), next = person3(s, to);
    if (!next?.alive || next.age < 18) throw new Error("Estate deed requires adult custodian");
    if (old) old.propertyIds = old.propertyIds.filter((p) => p !== id);
    if (!next.propertyIds.includes(id)) next.propertyIds.push(id);
    const property2 = s.life.properties.find((p) => p.id === id);
    if (property2) property2.ownerId = to;
    else s.businesses.find((b) => b.id === id).ownerId = to;
  }
  function estateHeirs(s, n) {
    const spouse = s.life.partnerships.find(
      (p) => p.status === "married" && (p.a === n.id || p.b === n.id)
    );
    const children = Object.entries(s.life.parentage).filter(([, parents]) => parents.includes(n.id)).map(([id]) => id);
    const family = [...spouse ? [spouse.a === n.id ? spouse.b : spouse.a] : [], ...children].filter(
      (id) => person3(s, id)?.alive
    );
    return [
      ...new Set(
        family.length ? family : (household(s, n.householdId)?.members ?? []).filter(
          (id) => id !== n.id && person3(s, id)?.alive
        )
      )
    ].sort();
  }
  function executorFor(s, heirs, exclude) {
    const choices = [
      ...heirs,
      ...s.npcs.filter((n) => n.alive && n.age >= 18 && n.age < 60).map((n) => n.id),
      "player"
    ];
    return choices.find(
      (id) => id !== exclude && person3(s, id)?.alive && (person3(s, id)?.age ?? 0) >= 18
    );
  }
  function settleEstate(s, e) {
    const n = person3(s, e.personId);
    paid(s, `estate-sweep:${e.id}:${s.minute}`, n.id, e.accountId, s.accounts[n.id], "estate-cash");
    let owed = e.debts.reduce((v, d) => v + d.amount - d.paid - d.writtenOff, 0);
    if (s.accounts[e.accountId] < owed) {
      for (const id of [...e.assets]) {
        const home = s.life.properties.find((p) => p.id === id), business = s.businesses.find((b) => b.id === id), price = home?.askingPrice ?? (business?.status === "distressed" ? 6e5 : 12e5);
        const buyer = people3(s).filter((p) => p.alive && p.age >= 18 && p.id !== e.executorId && s.accounts[p.id] >= price).sort((a, b) => s.accounts[b.id] - s.accounts[a.id] || a.id.localeCompare(b.id))[0];
        if (!buyer) continue;
        paid(
          s,
          `estate-sale:${e.id}:${id}`,
          buyer.id,
          e.accountId,
          price,
          "estate-asset-liquidation"
        );
        moveDeed(s, id, buyer.id);
        e.assets = e.assets.filter((asset) => asset !== id);
        if (s.accounts[e.accountId] >= owed) break;
      }
    }
    for (const debt of e.debts) {
      const amount2 = Math.min(debt.amount - debt.paid - debt.writtenOff, s.accounts[e.accountId]);
      if (amount2) {
        paid(
          s,
          `estate-debt:${e.id}:${debt.kind}:${debt.leaseId ?? "bank"}:${s.minute}`,
          e.accountId,
          debt.creditor,
          amount2,
          "estate-debt-payment"
        );
        debt.paid += amount2;
      }
      if (debt.kind === "loan") {
        n.debt = debt.amount - debt.paid - debt.writtenOff;
        s.flags[`loanAsset:${n.id}`] = n.debt;
      } else {
        const lease2 = s.life.leases.find((l) => l.id === debt.leaseId);
        lease2.arrears = debt.amount - debt.paid - debt.writtenOff;
      }
    }
    owed = e.debts.reduce((v, d) => v + d.amount - d.paid - d.writtenOff, 0);
    if (owed && e.assets.length) return;
    if (owed) {
      for (const debt of e.debts) {
        const loss = debt.amount - debt.paid - debt.writtenOff;
        debt.writtenOff += loss;
        s.flags[`estateWriteOff:${debt.creditor}`] = Number(s.flags[`estateWriteOff:${debt.creditor}`] ?? 0) + loss;
        if (debt.kind === "loan") {
          n.debt = 0;
          s.flags[`loanAsset:${n.id}`] = 0;
        } else s.life.leases.find((l) => l.id === debt.leaseId).arrears = 0;
      }
      emit(
        s,
        "estate_insolvent",
        `${n.name} terekesinde kar\u015F\u0131lanamayan bor\xE7, alacakl\u0131 kayb\u0131 olarak a\xE7\u0131k\xE7a kaydedildi.`,
        [n.id],
        e.id,
        "private"
      );
    }
    const heirs = e.heirIds.filter((id) => person3(s, id)?.alive), recipients = heirs.length ? heirs : ["municipality"];
    for (const id of [...e.assets]) {
      const beneficiary = recipients[Object.keys(e.assetBeneficiaries).length % recipients.length];
      const adult2 = person3(s, beneficiary);
      const custodian = adult2?.age && adult2.age >= 18 ? adult2.id : (s.life.guardians[beneficiary] ?? []).find(
        (id2) => person3(s, id2)?.alive && (person3(s, id2)?.age ?? 0) >= 18
      ) ?? e.executorId;
      moveDeed(s, id, custodian);
      e.assetBeneficiaries[id] = beneficiary;
      const home = s.life.properties.find((p) => p.id === id), residents = home?.occupantHouseholdId && household(s, home.occupantHouseholdId);
      if (residents && residents.members.includes(beneficiary)) {
        residents.rent = 0;
        for (const lease2 of s.life.leases.filter(
          (l) => l.householdId === residents.id && l.status === "active"
        )) {
          paid(
            s,
            `inherit-deposit:${e.id}:${lease2.id}`,
            lease2.depositAccount,
            lease2.payerId,
            s.accounts[lease2.depositAccount],
            "inherited-home-deposit-return"
          );
          lease2.status = "ended";
        }
      }
      let record = e.distributions.find((d) => d.recipient === beneficiary);
      if (!record) {
        record = { recipient: beneficiary, amount: 0, assetIds: [] };
        e.distributions.push(record);
      }
      record.assetIds.push(id);
    }
    e.assets = [];
    const total = s.accounts[e.accountId];
    let remaining = total;
    recipients.forEach((id, index) => {
      const value = Math.floor(total / recipients.length) + (index < total % recipients.length ? 1 : 0);
      paid(s, `estate-inherit:${e.id}:${s.minute}:${id}`, e.accountId, id, value, "inheritance");
      remaining -= value;
      let d = e.distributions.find((d2) => d2.recipient === id);
      if (!d) {
        d = { recipient: id, amount: 0, assetIds: [] };
        e.distributions.push(d);
      }
      d.amount += value;
    });
    if (remaining !== 0) throw new Error("Estate split did not balance");
    e.status = heirs.length ? "settled" : "public-custody";
    e.settledAt = s.minute;
  }
  function processDeath(s, personId, txId, cause = "validated") {
    const n = person3(s, personId);
    if (!n || personId === "player" || !n.alive || n.age < 18 || s.life.deaths.some((d) => d.personId === personId || d.id === txId))
      return failed("Bu ya\u015Fam kayd\u0131 \xF6l\xFCm ge\xE7i\u015Fine uygun de\u011Fil.");
    const heirs = estateHeirs(s, n), executorId = executorFor(s, heirs, n.id), h = household(s, n.householdId), b = s.life.budgets.find((b2) => b2.householdId === h.id);
    const entrusted = new Set(
      s.life.estates.flatMap((estate) => [
        ...estate.assets,
        ...Object.entries(estate.assetBeneficiaries).filter(([, beneficiary]) => beneficiary !== n.id).map(([id]) => id)
      ])
    );
    const e = {
      id: `estate:${s.nextId++}`,
      personId: n.id,
      accountId: `estate:${n.id}`,
      heirIds: heirs,
      openedAt: s.minute,
      settledAt: null,
      status: "settling",
      assets: n.propertyIds.filter((id) => !entrusted.has(id)),
      executorId,
      assetBeneficiaries: {},
      debts: n.debt ? [{ creditor: "bank", amount: n.debt, paid: 0, writtenOff: 0, kind: "loan" }] : [],
      distributions: []
    };
    zero(s, e.accountId);
    for (const lease2 of s.life.leases.filter((l) => l.payerId === n.id)) {
      if (lease2.arrears)
        e.debts.push({
          creditor: lease2.landlordId,
          amount: lease2.arrears,
          paid: 0,
          writtenOff: 0,
          kind: "rent",
          leaseId: lease2.id
        });
      paid(
        s,
        `estate-deposit:${e.id}:${lease2.id}`,
        lease2.depositAccount,
        e.accountId,
        s.accounts[lease2.depositAccount],
        "estate-deposit-release"
      );
      lease2.deposit = 0;
      if (lease2.status === "active") {
        lease2.status = "ended";
        if (h.members.some((id) => id !== n.id)) {
          const successor = `lease:${s.nextId++}`, depositAccount = `deposit:${successor}`;
          zero(s, depositAccount);
          s.life.leases.push({
            ...lease2,
            id: successor,
            payerId: executorId,
            depositAccount,
            deposit: 0,
            arrears: 0,
            startsAt: s.minute,
            status: "active"
          });
        }
      }
    }
    paid(
      s,
      `estate-budget:${e.id}`,
      b.accountId,
      e.accountId,
      b.shares[n.id] ?? 0,
      "estate-budget-share"
    );
    delete b.shares[n.id];
    h.members = h.members.filter((id) => id !== n.id);
    n.alive = false;
    n.health = 0;
    n.stamina = 0;
    n.path = [];
    n.destination = null;
    n.goal = "deceased";
    n.jobId = null;
    n.employerId = null;
    n.wanted = 0;
    for (const business of s.businesses)
      business.employees = business.employees.filter((id) => id !== n.id);
    for (const v of s.vehicles)
      if (v.driverId === n.id) {
        v.driverId = null;
        v.speed = 0;
      }
    for (const id of e.assets) moveDeed(s, id, executorId);
    for (const pending of s.life.estates)
      if (pending.executorId === n.id) {
        pending.executorId = executorId;
        for (const id of [...pending.assets, ...Object.keys(pending.assetBeneficiaries)])
          if (ownerOf(s, id) === n.id) moveDeed(s, id, executorId);
      }
    for (const bond of s.life.partnerships)
      if ((bond.a === n.id || bond.b === n.id) && ["dating", "married"].includes(bond.status)) {
        bond.status = "widowed";
        bond.endedAt = s.minute;
      }
    for (const consent of s.life.consents)
      if (consent.from === n.id || consent.to === n.id) consent.accepted = false;
    if (s.flags.partner === n.id) {
      s.flags.partner = "";
      s.flags.spouse = "";
      s.flags[`consent:${n.id}`] = false;
    }
    for (const enrollment of s.life.enrollments)
      if (enrollment.personId === n.id && enrollment.status === "enrolled") {
        enrollment.status = "cancelled";
        enrollment.activeUntil = null;
      }
    for (const quest of s.quests)
      if ([quest.issuerId, quest.targetId].includes(n.id) && ["offered", "active"].includes(quest.status)) {
        quest.status = "failed";
        const escrow = `escrow:${quest.id}`;
        paid(
          s,
          `death-quest:${quest.id}`,
          escrow,
          "quests",
          s.accounts[escrow] ?? 0,
          "mission-participant-death"
        );
        if (s.player.inventory[`parcel:${quest.id}`]) {
          s.businesses.find((b2) => b2.id === "warehouse").stock.parts += s.player.inventory[`parcel:${quest.id}`];
          delete s.player.inventory[`parcel:${quest.id}`];
        }
      }
    reconcileSocialAfterDeath(s, n.id);
    reconcileProgression(s, `death:${txId}`);
    for (const child of people3(s).filter((p) => p.alive && p.age < 18)) {
      const guardians = (s.life.guardians[child.id] ?? []).filter(
        (id) => id === "municipality" || person3(s, id)?.alive && (person3(s, id)?.age ?? 0) >= 18
      );
      if (guardians.length) s.life.guardians[child.id] = guardians;
      else assignGuardian(s, child.id, "municipality", `death:${txId}:${child.id}`);
    }
    rehomeEmpty(s, h);
    s.life.estates.push(e);
    s.life.deaths.push({ id: txId, personId: n.id, minute: s.minute, cause });
    settleEstate(s, e);
    for (const home of s.households)
      home.arrears = s.life.leases.filter((l) => l.householdId === home.id).reduce((v, l) => v + l.arrears, 0);
    const event2 = emit(
      s,
      "citizen_died",
      `${n.name} ya\u015Fam\u0131n\u0131 yitirdi. Vesayet, s\xF6zle\u015Fmeler ve tereke kay\u0131tlar\u0131 i\u015Flendi.`,
      [n.id, ...heirs],
      e.id,
      "private"
    );
    return { ok: true, reason: event2.text, events: [event2.id] };
  }
  function familyMinute(s) {
    if (s.minute % DAY3 !== 0 || s.life.demography.lastDailyAt >= s.minute) return;
    s.life.demography.lastDailyAt = s.minute;
    const year = Math.floor(s.minute / YEAR), years = year - s.life.demography.lastAgingYear;
    for (const p of people3(s))
      if (p.alive) {
        const birth = s.life.births.find((b) => b.childId === p.id);
        if (birth) p.age = Math.floor((s.minute - birth.minute) / YEAR);
        else if (years > 0) p.age += years;
        if (p.age >= 18) delete s.life.guardians[p.id];
      }
    if (years > 0) s.life.demography.lastAgingYear = year;
    for (const child of people3(s).filter((p) => p.alive && p.age < 18)) {
      let guardians = (s.life.guardians[child.id] ?? []).filter(
        (id) => id === "municipality" || person3(s, id)?.alive && (person3(s, id)?.age ?? 0) >= 18
      );
      if (!guardians.length) {
        assignGuardian(s, child.id, "municipality", `care:${child.id}:${s.minute}`);
        guardians = ["municipality"];
      }
      const market = s.businesses.find((b) => b.id === "market"), cost = market.prices.simit * 2, payer = guardians.find((id) => s.accounts[id] >= cost) ?? (s.accounts.municipality >= cost ? "municipality" : void 0);
      if (payer && market.stock.simit >= 2) {
        paid(
          s,
          `child-care:${child.id}:${s.minute}`,
          payer,
          "business:market",
          cost,
          "dependent-food"
        );
        market.stock.simit -= 2;
        market.sales += cost;
        child.hunger = clamp(child.hunger - 65);
        child.health = clamp(child.health + 4);
      }
      child.fatigue = clamp(child.fatigue - 30);
    }
    for (const estate of s.life.estates)
      if (estate.status === "settling" || s.accounts[estate.personId] > 0) settleEstate(s, estate);
    for (const home of s.households)
      home.arrears = s.life.leases.filter((l) => l.householdId === home.id).reduce((v, l) => v + l.arrears, 0);
    const day = Math.floor(s.minute / DAY3);
    const elder = s.npcs.find(
      (n, i) => n.alive && n.age >= 65 && draw(s.seed, 81, day, i) % 1e5 < 35
    );
    if (elder) processDeath(s, elder.id, `natural:${day}:${elder.id}`, "natural");
    if (day % 30 === 0 && s.life.births.length < s.life.demography.maxBirths) {
      const bond = s.life.partnerships.filter((p) => p.status === "married" && p.a !== "player" && p.b !== "player").find((p) => birthEligibility(s, [p.a, p.b]) === null);
      if (bond) {
        for (const [from, to] of [
          [bond.a, bond.b],
          [bond.b, bond.a]
        ])
          s.life.consents.push({
            id: `parenthood:${s.nextId++}`,
            from,
            to,
            purpose: "parenthood",
            accepted: true,
            minute: s.minute
          });
        processBirth(s, [bond.a, bond.b], `birth:${day}:${bond.id}`);
      }
    }
  }
  function validateFamily(s) {
    const errors = [], l = s.life, ids = new Set(people3(s).map((p) => p.id)), safe = (n) => Number.isSafeInteger(n) && n >= 0;
    if (l.version !== 2 || l.demography.initialPopulation !== (s.flags.benchmarkPopulation === 1e4 ? 1e4 : 1100) || l.demography.maxBirths !== 24 || l.births.length > 24 || ![l.demography.lastDailyAt, l.demography.lastAgingYear].every(safe))
      errors.push("family-demography");
    if (s.npcs.length !== l.demography.initialPopulation + l.births.length)
      errors.push("family-population-accounting");
    if (new Set(l.births.map((b) => b.childId)).size !== l.births.length || new Set(l.births.map((b) => b.id)).size !== l.births.length)
      errors.push("family-duplicate-birth");
    for (const b of l.births)
      if (!ids.has(b.childId) || !b.childId.startsWith("born:") || b.parentIds.length !== 2 || b.parentIds.some((id) => !ids.has(id)) || !safe(b.minute) || JSON.stringify(l.parentage[b.childId]) !== JSON.stringify(b.parentIds))
        errors.push(`family-birth:${b.id}`);
    for (const p of people3(s)) {
      if (!p.alive && !l.deaths.some((d) => d.personId === p.id))
        errors.push(`family-tombstone:${p.id}`);
      if (p.alive && p.age < 18) {
        const guardians = l.guardians[p.id];
        if (!guardians?.length || guardians.some(
          (id) => id !== "municipality" && (!person3(s, id)?.alive || (person3(s, id)?.age ?? 0) < 18)
        ))
          errors.push(`family-guardian:${p.id}`);
        if (p.jobId || p.employerId || p.wanted || s.vehicles.some((v) => v.driverId === p.id))
          errors.push(`family-child-adult-role:${p.id}`);
      }
    }
    for (const [id, guardians] of Object.entries(l.guardians))
      if (!person3(s, id)?.alive || (person3(s, id)?.age ?? 18) >= 18 || new Set(guardians).size !== guardians.length)
        errors.push(`family-guardian-ref:${id}`);
    if (new Set(l.deaths.map((d) => d.personId)).size !== l.deaths.length || l.deaths.some(
      (d) => !ids.has(d.personId) || person3(s, d.personId)?.alive || !safe(d.minute) || d.personId === "player"
    ))
      errors.push("family-death");
    for (const e of l.estates) {
      if (!l.deaths.some((d) => d.personId === e.personId) || e.accountId !== `estate:${e.personId}` || !Object.hasOwn(s.accounts, e.accountId) || !person3(s, e.executorId)?.alive || (person3(s, e.executorId)?.age ?? 0) < 18 || e.heirIds.some((id) => !ids.has(id)))
        errors.push(`family-estate:${e.id}`);
      if (e.debts.some(
        (d) => ![d.amount, d.paid, d.writtenOff].every(safe) || d.paid + d.writtenOff > d.amount || !Object.hasOwn(s.accounts, d.creditor)
      ))
        errors.push(`family-estate-debt:${e.id}`);
      if (e.status !== "settling" && (e.assets.length || e.debts.some((d) => d.paid + d.writtenOff !== d.amount) || s.accounts[e.accountId] !== 0))
        errors.push(`family-unsettled-inheritance:${e.id}`);
      if (e.assets.some((id) => ownerOf(s, id) !== e.executorId) || e.distributions.some((d) => !Object.hasOwn(s.accounts, d.recipient) || !safe(d.amount)))
        errors.push(`family-estate-assets:${e.id}`);
    }
    return errors;
  }

  // src/games/social-engine/simulation/life.ts
  var DAY4 = 1440;
  var WEEK = DAY4 * 7;
  var COURSES = [
    {
      id: "office-skills",
      name: "Ofis ve kooperatif i\u015Fleri",
      fee: 5e3,
      skill: "academic",
      minimumSkill: 0,
      requiredSessions: 3,
      sessionMinutes: 30,
      unlocks: ["office"]
    },
    {
      id: "pedagogy",
      name: "Yeti\u015Fkin e\u011Fitimine giri\u015F",
      fee: 9e3,
      skill: "academic",
      minimumSkill: 15,
      requiredSessions: 3,
      sessionMinutes: 30,
      unlocks: ["teaching"]
    },
    {
      id: "technical-craft",
      name: "At\xF6lye ustal\u0131k temelleri",
      fee: 7e3,
      skill: "technical",
      minimumSkill: 0,
      requiredSessions: 3,
      sessionMinutes: 30,
      unlocks: []
    }
  ];
  var person4 = (s, id) => id === "player" ? s.player : s.npcs.find((n) => n.id === id);
  var household2 = (s, id = s.player.householdId) => s.households.find((h) => h.id === id);
  var budget = (s, id) => s.life.budgets.find((b) => b.householdId === id);
  var property = (s, id) => s.life.properties.find((p) => p.id === id);
  var lease = (s, householdId) => s.life.leases.find((l) => l.householdId === householdId && l.status === "active");
  var failed2 = (reason) => ({ ok: false, reason, events: [] });
  var success = (s, kind, reason, actors = ["player"]) => {
    const event2 = emit(s, kind, reason, actors, null, "private");
    notify(s, reason);
    return { ok: true, reason, events: [event2.id] };
  };
  var key2 = (a, name) => typeof a[name] === "string" ? a[name] : "";
  var amount = (a) => Number.isSafeInteger(a.amount) && a.amount > 0 && a.amount <= 1e8 ? a.amount : null;
  function account(s, id) {
    if (!Object.hasOwn(s.accounts, id)) {
      s.accounts[id] = 0;
      s.ledgerCheckpoint.balances[id] = 0;
    }
  }
  function at2(s, buildings) {
    const p = s.player.location;
    return buildings.some((id) => {
      const b = BUILDINGS.find((b2) => b2.id === id);
      return b && (p.scene === id || p.scene === "outside" && Math.hypot(p.x - b.door.x, p.y - b.door.y) <= 1.8 && hasLineOfSight(p, b.door));
    });
  }
  function nearby2(s, n) {
    const p = s.player.location;
    return n.alive && n.location.scene === p.scene && Math.hypot(p.x - n.location.x, p.y - n.location.y) <= 1.8 && hasLineOfSight(p, n.location, p.scene);
  }
  function canMove(s, p, h) {
    return h.members.length <= p.capacity && (!p.occupantHouseholdId || p.occupantHouseholdId === h.id) && (!p.reservation || p.reservation.expiresAt <= s.minute || p.reservation.householdId === h.id);
  }
  function updateArrears(s, h) {
    h.arrears = s.life.leases.filter((l) => l.householdId === h.id).reduce((sum, l) => sum + l.arrears, 0);
  }
  function moveMembers(s, h, p) {
    const old = property(s, h.homeId);
    p.occupantHouseholdId = h.id;
    p.reservation = null;
    h.homeId = p.id;
    h.rent = p.ownerId === h.members[0] || h.members.includes(p.ownerId) ? 0 : p.weeklyRent;
    for (const id of h.members) {
      const n = person4(s, id);
      if (n) n.homeId = p.id;
    }
    if (old && old.id !== p.id && old.occupantHouseholdId === h.id) old.occupantHouseholdId = null;
  }
  function refundLease(s, old, txId) {
    const refundable = s.accounts[old.depositAccount] ?? 0;
    if (refundable > 0 && !transfer(
      s,
      `life-refund:${txId}:${old.id}`,
      old.depositAccount,
      old.payerId,
      refundable,
      "lease-deposit-refund"
    ))
      throw new Error("Verified lease refund failed");
    old.status = "ended";
  }
  function enterLease(s, h, p, payerId, txId) {
    if (!canMove(s, p, h)) return false;
    const old = lease(s, h.id), refundable = old?.payerId === payerId ? s.accounts[old.depositAccount] ?? 0 : 0;
    if (s.accounts[payerId] + refundable < p.weeklyRent) return false;
    if (old) refundLease(s, old, txId);
    const id = `lease:${s.nextId++}`, depositAccount = `deposit:${id}`;
    account(s, depositAccount);
    if (p.weeklyRent && !transfer(s, `life-deposit:${txId}`, payerId, depositAccount, p.weeklyRent, "lease-deposit"))
      throw new Error("Verified lease deposit failed");
    s.life.leases.push({
      id,
      householdId: h.id,
      propertyId: p.id,
      payerId,
      landlordId: p.ownerId,
      rent: p.weeklyRent,
      deposit: p.weeklyRent,
      depositAccount,
      startsAt: s.minute,
      nextDueAt: Math.ceil((s.minute + WEEK) / DAY4) * DAY4,
      arrears: 0,
      status: "active"
    });
    moveMembers(s, h, p);
    updateArrears(s, h);
    return true;
  }
  function debitBudget(s, b, amount2, to, txId, reason) {
    if (!amount2) return;
    const total = s.accounts[b.accountId];
    if (amount2 > total || !transfer(s, txId, b.accountId, to, amount2, reason))
      throw new Error("Verified shared budget payment failed");
    const ids = Object.keys(b.shares).sort(), allocations = /* @__PURE__ */ new Map();
    let allocated = 0;
    for (const id of ids) {
      const value = Number(BigInt(amount2) * BigInt(b.shares[id]) / BigInt(total));
      allocations.set(id, value);
      allocated += value;
    }
    let remainder = amount2 - allocated;
    for (const id of ids) {
      const value = allocations.get(id);
      const extra = Math.min(remainder, b.shares[id] - value);
      b.shares[id] -= value + extra;
      remainder -= extra;
    }
  }
  function initializeLife(s, options = {}) {
    s.flags.lifeRentMarketPrice ??= s.businesses.find((b) => b.id === "market")?.prices.simit ?? 1800;
    const life = {
      ...familyDefaults(s),
      version: 2,
      properties: [],
      leases: [],
      budgets: [],
      parentage: {},
      consents: [],
      partnerships: [],
      enrollments: [],
      certificates: [],
      aidLastAt: {},
      archivedHouseholds: [],
      lastDailyAt: Math.floor(s.minute / DAY4) * DAY4
    };
    const businesses = new Set(s.businesses.map((b) => b.id));
    for (const n of [s.player, ...s.npcs])
      n.propertyIds = n.propertyIds.filter((id) => !businesses.has(id));
    for (const business of s.businesses) {
      const owner = person4(s, business.ownerId);
      if (owner) owner.propertyIds.push(business.id);
    }
    for (const [index, h] of s.households.entries()) {
      const home = {
        id: h.homeId,
        name: h.id === s.player.householdId ? "Yuva \xB7 ba\u015Flang\u0131\xE7 dairesi" : `Yuva \xB7 daire ${index + 1}`,
        buildingId: "b-home",
        capacity: 4,
        ownerId: "landlord",
        askingPrice: 45e5,
        weeklyRent: h.rent,
        occupantHouseholdId: h.id,
        reservation: null
      };
      if (life.properties.some((p) => p.id === home.id))
        throw new Error("Duplicate primary residence during migration");
      life.properties.push(home);
      const id = `lease:initial:${h.id}`, depositAccount = `deposit:${id}`;
      account(s, depositAccount);
      life.leases.push({
        id,
        householdId: h.id,
        propertyId: home.id,
        payerId: h.members[0],
        landlordId: home.ownerId,
        rent: h.rent,
        deposit: 0,
        depositAccount,
        startsAt: s.minute,
        nextDueAt: (Math.floor(s.minute / WEEK) + 1) * WEEK,
        arrears: h.arrears,
        status: "active"
      });
      const accountId = `household:${h.id}`;
      account(s, accountId);
      life.budgets.push({
        householdId: h.id,
        accountId,
        shares: Object.fromEntries(h.members.map((id2) => [id2, 0]))
      });
    }
    for (let index = 0; index < 12; index++)
      life.properties.push({
        id: `vacant-home-${index}`,
        name: index < 4 ? `Yuva \xB7 ekonomik daire ${index + 1}` : index < 8 ? `Yuva \xB7 aile dairesi ${index - 3}` : `Yuva \xB7 teras dairesi ${index - 7}`,
        buildingId: "b-home",
        capacity: index < 4 ? 2 : 4,
        ownerId: "landlord",
        askingPrice: index < 4 ? 25e5 : index < 8 ? 45e5 : 7e6,
        weeklyRent: index < 4 ? 25e3 : index < 6 ? 3e4 : index < 8 ? 45e3 : 75e3,
        occupantHouseholdId: null,
        reservation: null
      });
    if (options.seedFamilies) {
      for (const [index, h] of s.households.entries()) {
        if (index % 4 !== 3 || h.members.includes("player") || h.members.length < 2) continue;
        const members = h.members.map((id2) => person4(s, id2)).sort((a2, b2) => b2.age - a2.age || a2.id.localeCompare(b2.id));
        const [a, b] = members;
        if (a.age < 18 || b.age < 18) continue;
        const id = `family:initial:${h.id}`;
        life.partnerships.push({
          id,
          a: a.id,
          b: b.id,
          status: "married",
          startedAt: s.minute,
          marriedAt: s.minute,
          endedAt: null,
          previousHouseholdId: h.id,
          previousHomeId: h.homeId
        });
        life.consents.push(
          {
            id: `${id}:a`,
            from: a.id,
            to: b.id,
            purpose: "marriage",
            accepted: true,
            minute: s.minute
          },
          {
            id: `${id}:b`,
            from: b.id,
            to: a.id,
            purpose: "marriage",
            accepted: true,
            minute: s.minute
          }
        );
        for (const child of members.slice(2)) {
          const parents = [a, b].filter((n) => n.age - child.age >= 18).map((n) => n.id);
          if (parents.length) life.parentage[child.id] = parents;
        }
      }
    }
    return life;
  }
  function currentPartnership(s, id) {
    return s.life.partnerships.find(
      (p) => ["dating", "married"].includes(p.status) && (p.a === id || p.b === id)
    );
  }
  function related(s, a, b) {
    const ancestors = (id) => {
      const found = /* @__PURE__ */ new Set(), queue = [id];
      while (queue.length) {
        const next = queue.pop();
        for (const parent of s.life.parentage[next] ?? [])
          if (!found.has(parent)) {
            found.add(parent);
            queue.push(parent);
          }
      }
      return found;
    };
    const one = ancestors(a), two = ancestors(b);
    return one.has(b) || two.has(a) || [...one].some((id) => two.has(id));
  }
  function mutualConsent(s, npcId, purpose) {
    s.life.consents.push(
      {
        id: `consent:${s.nextId++}`,
        from: "player",
        to: npcId,
        purpose,
        accepted: true,
        minute: s.minute
      },
      {
        id: `consent:${s.nextId++}`,
        from: npcId,
        to: "player",
        purpose,
        accepted: true,
        minute: s.minute
      }
    );
  }
  function movePerson(s, n, destination, txId) {
    const source = household2(s, n.householdId);
    if (source.id === destination.id) return;
    const oldBudget = budget(s, source.id), newBudget = budget(s, destination.id);
    const share = oldBudget.shares[n.id] ?? 0;
    if (share) {
      if (!transfer(
        s,
        `household-join:${txId}`,
        oldBudget.accountId,
        newBudget.accountId,
        share,
        "household-share-transfer"
      ))
        throw new Error("Shared funds transfer failed");
      newBudget.shares[n.id] = (newBudget.shares[n.id] ?? 0) + share;
    } else newBudget.shares[n.id] ??= 0;
    delete oldBudget.shares[n.id];
    source.members = source.members.filter((id) => id !== n.id);
    destination.members.push(n.id);
    n.householdId = destination.id;
    n.homeId = destination.homeId;
    if (!source.members.length) {
      const old = lease(s, source.id);
      if (old) refundLease(s, old, txId);
      for (const contract of s.life.leases)
        if (contract.householdId === source.id) contract.householdId = destination.id;
      const home = property(s, source.homeId);
      if (home?.occupantHouseholdId === source.id) home.occupantHouseholdId = null;
      s.life.archivedHouseholds.push(source.id);
      s.households = s.households.filter((h) => h.id !== source.id);
      s.life.budgets = s.life.budgets.filter((b) => b.householdId !== source.id);
      updateArrears(s, destination);
    }
  }
  function jobPrerequisite(s, jobId) {
    const course = COURSES.find((c) => c.unlocks.includes(jobId));
    return course && !s.life.certificates.some((c) => c.personId === "player" && c.courseId === course.id) ? `${course.name} belgesi gerekiyor. Ufuk Akademi'de kay\u0131t ve \xFC\xE7 ders tamamla.` : null;
  }
  function applyLifeCommand(s, command) {
    const a = command.args, p = s.player, h = household2(s), b = h && budget(s, h.id);
    const locationRequired = [
      "RESERVE_HOME",
      "LEASE_HOME",
      "PROPERTY_BUY",
      "HOUSEHOLD_DEPOSIT",
      "HOUSEHOLD_WITHDRAW",
      "PAY_RENT_ARREARS"
    ].includes(command.type);
    if (locationRequired && !at2(s, ["b-home", "b-bank", "b-office"]))
      return failed2("Konut ve ortak b\xFCt\xE7e i\u015Flemleri i\xE7in Yuva, kooperatif veya bankaya git.");
    switch (command.type) {
      case "RESERVE_HOME": {
        const target = property(s, key2(a, "propertyId"));
        if (!target || !h || !canMove(s, target, h) || target.id === h.homeId)
          return failed2("Daire dolu, ayr\u0131lm\u0131\u015F, k\xFC\xE7\xFCk veya zaten senin konutun.");
        for (const home of s.life.properties)
          if (home.reservation?.householdId === h.id) home.reservation = null;
        target.reservation = { householdId: h.id, expiresAt: s.minute + 180 };
        return success(
          s,
          "housing_reserved",
          `${target.name}, \xFC\xE7 oyun saati hanen i\xE7in ayr\u0131ld\u0131. Depozito: ${target.weeklyRent / 100} TL.`
        );
      }
      case "LEASE_HOME": {
        const target = property(s, key2(a, "propertyId"));
        if (!target || !h || !canMove(s, target, h) || target.id === h.homeId || target.reservation?.householdId !== h.id || target.reservation.expiresAt <= s.minute)
          return failed2("\xD6nce uygun bo\u015F daireyi ay\u0131rt; rezervasyon s\xFCresi dolmam\u0131\u015F olmal\u0131.");
        if (p.shift || s.life.enrollments.some((e) => e.activeUntil !== null))
          return failed2("Vardiya veya ders s\xFCrerken ta\u015F\u0131namazs\u0131n.");
        if (target.ownerId === "player") {
          const old = lease(s, h.id);
          if (old) refundLease(s, old, command.id);
          moveMembers(s, h, target);
        } else if (!enterLease(s, h, target, "player", command.id))
          return failed2(
            "Kapasite veya iade sonras\u0131 depozito b\xFCt\xE7esi uygun de\u011Fil. Eski evin korundu."
          );
        return success(
          s,
          "household_moved",
          `${target.name} yeni ana konutun. Eski depozito iade edildi; gecikmi\u015F kira borcu korunuyor.`,
          [...h.members]
        );
      }
      case "PROPERTY_BUY": {
        if (s.life.estates.some(
          (e) => e.status === "settling" && e.assets.includes(key2(a, "propertyId"))
        ))
          return failed2("Bu m\xFClk\xFCn tereke bor\xE7lar\u0131 hen\xFCz sonu\xE7lanmad\u0131.");
        const target = property(s, key2(a, "propertyId"));
        if (!target || !h || target.ownerId === "player" || target.occupantHouseholdId && target.occupantHouseholdId !== h.id || target.reservation && target.reservation.expiresAt > s.minute && target.reservation.householdId !== h.id)
          return failed2("Sat\u0131\u015Fa uygun bo\u015F veya kendi kiralad\u0131\u011F\u0131n bir daire se\xE7.");
        if (s.accounts.player < target.askingPrice || !Object.hasOwn(s.accounts, target.ownerId))
          return failed2("Sat\u0131n alma b\xFCt\xE7en yeterli de\u011Fil.");
        const previousOwner = person4(s, target.ownerId);
        if (!transfer(
          s,
          `property-buy:${command.id}`,
          "player",
          target.ownerId,
          target.askingPrice,
          "property-purchase"
        ))
          return failed2("Tapu \xF6demesi do\u011Frulanamad\u0131.");
        if (previousOwner)
          previousOwner.propertyIds = previousOwner.propertyIds.filter((id) => id !== target.id);
        target.ownerId = "player";
        if (!p.propertyIds.includes(target.id)) p.propertyIds.push(target.id);
        if (target.occupantHouseholdId === h.id) {
          const old = lease(s, h.id);
          if (old) refundLease(s, old, command.id);
          h.rent = 0;
        }
        return success(
          s,
          "property_bought",
          `${target.name} tapusu al\u0131nd\u0131. Konutta oturuyorsan yeni kira i\u015Flemez; eski bor\xE7 silinmez.`
        );
      }
      case "HOUSEHOLD_DEPOSIT":
      case "HOUSEHOLD_WITHDRAW": {
        const value = amount(a);
        if (!value || !h || !b) return failed2("Pozitif, tamsay\u0131 kuru\u015F tutar\u0131 gerekli.");
        const deposit = command.type === "HOUSEHOLD_DEPOSIT";
        if (!deposit && (b.shares.player ?? 0) < value)
          return failed2("Yaln\u0131zca kendi kullan\u0131lmam\u0131\u015F ortak b\xFCt\xE7e katk\u0131n\u0131 \xE7ekebilirsin.");
        if (!transfer(
          s,
          `household:${command.id}`,
          deposit ? "player" : b.accountId,
          deposit ? b.accountId : "player",
          value,
          deposit ? "household-deposit" : "household-withdrawal"
        ))
          return failed2("Yeterli bakiye yok.");
        b.shares.player = (b.shares.player ?? 0) + (deposit ? value : -value);
        return success(
          s,
          "household_budget",
          `${value / 100} TL ${deposit ? "ortak b\xFCt\xE7eye yat\u0131r\u0131ld\u0131" : "ki\u015Fisel hesab\u0131na d\xF6nd\xFC"}.`
        );
      }
      case "PAY_RENT_ARREARS": {
        const value = amount(a);
        if (!value || !h || value > h.arrears || s.accounts.player < value)
          return failed2("Tutar bor\xE7tan veya bakiyenden fazla olamaz.");
        let remaining = value;
        for (const old of s.life.leases.filter((l) => l.householdId === h.id && l.arrears > 0)) {
          const paid2 = Math.min(remaining, old.arrears);
          if (!transfer(
            s,
            `rent-arrears:${command.id}:${old.id}`,
            "player",
            old.landlordId,
            paid2,
            "rent-arrears"
          ))
            throw new Error("Verified arrears payment failed");
          old.arrears -= paid2;
          remaining -= paid2;
          if (!remaining) break;
        }
        updateArrears(s, h);
        return success(
          s,
          "rent_arrears_paid",
          `${value / 100} TL gecikmi\u015F kira \xF6dendi. Kalan: ${h.arrears / 100} TL.`
        );
      }
      case "ASK_DATE":
      case "PROPOSE_MARRIAGE":
      case "SEPARATE": {
        const n = person4(s, key2(a, "npcId"));
        if (!n || n.id === "player" || n.age < 18 || p.age < 18 || !nearby2(s, n))
          return failed2("Yak\u0131n\u0131nda yeti\u015Fkin ve g\xF6r\xFC\u015Febilece\u011Fin bir ki\u015Fi olmal\u0131.");
        const current = currentPartnership(s, "player"), other = currentPartnership(s, n.id), edge = s.relations.find((r) => r.from === n.id && r.to === "player");
        if (command.type === "ASK_DATE") {
          if (current || other || related(s, "player", n.id) || !edge || edge.trust < 30 || edge.affection < 20 || edge.fear >= 20 || edge.resentment >= 30)
            return failed2(
              "Kar\u015F\u0131l\u0131kl\u0131 r\u0131za, g\xFCven ve yak\u0131nl\u0131k yok; mevcut ba\u011F veya aile ba\u011F\u0131 da engel olabilir."
            );
          mutualConsent(s, n.id, "date");
          s.life.partnerships.push({
            id: `partnership:${s.nextId++}`,
            a: "player",
            b: n.id,
            status: "dating",
            startedAt: s.minute,
            marriedAt: null,
            endedAt: null,
            previousHouseholdId: n.householdId,
            previousHomeId: n.homeId
          });
          s.flags.partner = n.id;
          s.flags[`consent:${n.id}`] = true;
          adjustRelation(s, n.id, "player", 2, 8);
          return success(
            s,
            "partnership_started",
            `${n.name} bulu\u015Fmay\u0131 kendi iste\u011Fiyle kabul etti.`,
            ["player", n.id]
          );
        }
        if (!current || current.b !== n.id) return failed2("Bu ki\u015Fiyle aktif ili\u015Fki kayd\u0131n yok.");
        if (command.type === "PROPOSE_MARRIAGE") {
          if (current.status !== "dating" || !edge || edge.trust < 60 || edge.affection < 50 || edge.fear >= 20 || edge.resentment >= 30 || related(s, "player", n.id))
            return failed2(
              "Evlilik i\xE7in iki taraf\u0131n g\xFCncel r\u0131zas\u0131, y\xFCksek g\xFCven ve yak\u0131nl\u0131k gerekiyor."
            );
          const home = h && property(s, h.homeId);
          if (!h || !home || h.members.length + (n.householdId === h.id ? 0 : 1) > home.capacity)
            return failed2("Ortak konutun kapasitesi yetmiyor. \xD6nce daha geni\u015F bir daire kirala.");
          mutualConsent(s, n.id, "marriage");
          current.status = "married";
          current.marriedAt = s.minute;
          movePerson(s, n, h, command.id);
          s.flags.spouse = n.id;
          return success(
            s,
            "households_joined",
            `${n.name} ile kar\u015F\u0131l\u0131kl\u0131 evlilik karar\u0131 ald\u0131n\u0131z. Ayn\u0131 konut ve katk\u0131 payl\u0131 ortak b\xFCt\xE7e art\u0131k hanenize ba\u011Fl\u0131.`,
            ["player", n.id]
          );
        }
        if (current.status === "married" && n.householdId === p.householdId) {
          const origin = household2(s, current.previousHouseholdId), originHome = origin && property(s, origin.homeId);
          if (origin && originHome && origin.members.length < originHome.capacity)
            movePerson(s, n, origin, command.id);
          else if (h && b) {
            const share = b.shares[n.id] ?? 0;
            if (share) {
              if (!transfer(
                s,
                `separation:${command.id}`,
                b.accountId,
                n.id,
                share,
                "separation-share-return"
              ))
                throw new Error("Separation share refund failed");
              b.shares[n.id] = 0;
            }
          }
        }
        current.status = "separated";
        current.endedAt = s.minute;
        s.flags.partner = "";
        s.flags.spouse = "";
        s.flags[`consent:${n.id}`] = false;
        for (const consent of s.life.consents)
          if (consent.from === n.id && consent.to === "player" || consent.from === "player" && consent.to === n.id)
            consent.accepted = false;
        adjustRelation(s, n.id, "player", -5, -10);
        return success(
          s,
          "partnership_ended",
          `${n.name} ile ili\u015Fki sona erdi. Ki\u015Fisel katk\u0131lar ve ge\xE7mi\u015F bor\xE7lar korundu; uygun yer yoksa konut payla\u015F\u0131m\u0131 ta\u015F\u0131nana kadar s\xFCrer.`,
          ["player", n.id]
        );
      }
      case "REQUEST_CHILD": {
        const bond = currentPartnership(s, "player"), npc = bond && person4(s, bond.b);
        if (!bond || bond.status !== "married" || !npc)
          return failed2("\xD6nce kar\u015F\u0131l\u0131kl\u0131 evlilik ve ortak konut gerekli.");
        const reason = birthEligibility(s, ["player", npc.id]);
        if (reason) return failed2(reason);
        const relation2 = s.relations.find((r) => r.from === npc.id && r.to === "player");
        if (!relation2 || relation2.trust < 70 || relation2.affection < 60 || relation2.fear >= 20 || relation2.resentment >= 20)
          return failed2("E\u015Finin aile kurmak i\xE7in g\xFCncel, \xF6zg\xFCr r\u0131zas\u0131 yok.");
        mutualConsent(s, npc.id, "parenthood");
        return processBirth(s, ["player", npc.id], command.id);
      }
      case "ASSIGN_GUARDIAN": {
        const childId = key2(a, "childId"), guardianId = key2(a, "guardianId");
        if (!(s.life.parentage[childId] ?? []).includes("player") && !(s.life.guardians[childId] ?? []).includes("player"))
          return failed2("Bu \xE7ocu\u011Fun yasal bak\u0131m sorumlulu\u011Fu sende de\u011Fil.");
        const guardian = person4(s, guardianId), edge = s.relations.find((r) => r.from === guardianId && r.to === "player");
        if (guardianId !== "player" && guardianId !== "municipality" && (!guardian || !nearby2(s, guardian) || !edge || edge.trust < 60))
          return failed2("Yeti\u015Fkin vasi ile y\xFCz y\xFCze anla\u015Fma ve y\xFCksek g\xFCven gerekli.");
        if (guardianId === "municipality" && !at2(s, ["b-security"]))
          return failed2("Kurumsal bak\u0131m karar\u0131 i\xE7in Mahalle Dayan\u0131\u015Fma\u2019ya git.");
        return assignGuardian(s, childId, guardianId, command.id);
      }
      case "COURSE_ENROLL": {
        const course = COURSES.find((c) => c.id === key2(a, "courseId"));
        if (!course || !at2(s, ["b-school"])) return failed2("Kurs kayd\u0131 i\xE7in Ufuk Akademi\u2019ye git.");
        if (s.life.enrollments.some(
          (e) => e.personId === "player" && e.courseId === course.id && e.status !== "cancelled"
        ))
          return failed2("Bu kursa zaten kay\u0131tl\u0131s\u0131n veya belgen var.");
        if ((p.skills[course.skill] ?? 0) < course.minimumSkill)
          return failed2(`Bu kurs i\xE7in ${course.skill} en az ${course.minimumSkill} olmal\u0131.`);
        if (!transfer(
          s,
          `course-fee:${command.id}`,
          "player",
          "business:school",
          course.fee,
          "course-enrollment"
        ))
          return failed2("Kurs \xFCcretine bakiyen yetmiyor.");
        s.life.enrollments.push({
          id: `enrollment:${s.nextId++}`,
          personId: "player",
          courseId: course.id,
          status: "enrolled",
          enrolledAt: s.minute,
          attended: 0,
          missed: 0,
          nextSessionAt: s.minute,
          activeUntil: null,
          certificateId: null
        });
        return success(
          s,
          "course_enrolled",
          `${course.name}: ${course.requiredSessions} ger\xE7ek kat\u0131l\u0131m kayd\u0131 gerekiyor. \xDCcret ${course.fee / 100} TL; iptalde iade yok.`
        );
      }
      case "COURSE_ATTEND": {
        const e = s.life.enrollments.find(
          (e2) => e2.personId === "player" && e2.courseId === key2(a, "courseId") && e2.status === "enrolled"
        ), course = e && COURSES.find((c) => c.id === e.courseId);
        if (!e || !course || !at2(s, ["b-school"]) || p.location.scene !== "b-school")
          return failed2("Kay\u0131tl\u0131 kursun dersine akademinin i\xE7inde kat\u0131l.");
        if (p.shift || p.vehicleId || Number(s.flags.trainingUntil ?? 0) > s.minute || s.life.enrollments.some((e2) => e2.activeUntil !== null) || e.nextSessionAt > s.minute)
          return failed2("\xC7ak\u0131\u015Fan vardiya/ders var veya dersin tekrar saati gelmedi.");
        e.activeUntil = s.minute + course.sessionMinutes;
        p.path = [];
        p.destination = null;
        s.flags.moveX = 0;
        s.flags.moveY = 0;
        return success(
          s,
          "course_session_started",
          `${course.name}: ${course.sessionMinutes} oyun dakikas\u0131 akademide kal. Ayr\u0131l\u0131rsan yoklama ge\xE7mez.`
        );
      }
      case "COURSE_CANCEL": {
        const e = s.life.enrollments.find(
          (e2) => e2.personId === "player" && e2.courseId === key2(a, "courseId") && e2.status === "enrolled"
        );
        if (!e) return failed2("\u0130ptal edilebilir kurs kayd\u0131 yok.");
        e.status = "cancelled";
        e.activeUntil = null;
        return success(
          s,
          "course_cancelled",
          "Kurs iptal edildi; tamamlanmam\u0131\u015F dersler belgeye d\xF6n\xFC\u015Fmedi."
        );
      }
      case "REQUEST_AID": {
        if (!at2(s, ["b-clinic", "b-security"]))
          return failed2("Destek i\xE7in klinik veya Mahalle Dayan\u0131\u015Fma\u2019ya git.");
        const last = s.life.aidLastAt.player ?? -3 * DAY4;
        if (s.minute < last + 3 * DAY4 || s.accounts.player >= 5e3 || p.jobId && p.health >= 40 && (h?.arrears ?? 0) <= 0)
          return failed2(
            "Destek d\xFC\u015F\xFCk bakiye ve ge\xE7im/sa\u011Fl\u0131k/kira g\xFC\xE7l\xFC\u011F\xFC i\xE7in; \xFC\xE7 g\xFCnde bir al\u0131nabilir."
          );
        if (!transfer(s, `aid:${command.id}`, "municipality", "player", 12e3, "recovery-aid"))
          return failed2("Dayan\u0131\u015Fma kasas\u0131nda bug\xFCn yeterli kaynak yok.");
        s.life.aidLastAt.player = s.minute;
        p.health = Math.max(p.health, 35);
        return success(
          s,
          "recovery_aid",
          "Dayan\u0131\u015Fma kasas\u0131ndan 120 TL ge\xE7im deste\u011Fi ald\u0131n. \u0130\u015F, e\u011Fitim ve iyile\u015Fme yollar\u0131n a\xE7\u0131k."
        );
      }
      default:
        return null;
    }
  }
  function lifeMinute(s) {
    for (const home of s.life.properties)
      if (home.reservation && home.reservation.expiresAt <= s.minute) home.reservation = null;
    for (const e of s.life.enrollments) {
      if (e.status !== "enrolled" || e.activeUntil === null) continue;
      const actor = person4(s, e.personId), course = COURSES.find((c) => c.id === e.courseId);
      if (!actor || !actor.alive || actor.location.scene !== "b-school" || e.personId === "player" && s.player.shift !== null) {
        e.missed++;
        e.activeUntil = null;
        e.nextSessionAt = s.minute + 30;
        if (e.personId === "player")
          notify(s, "Ders yar\u0131da kald\u0131; yoklama yaz\u0131lmad\u0131. 30 dakika sonra tekrar kat\u0131labilirsin.");
      } else if (s.minute >= e.activeUntil) {
        e.attended++;
        e.activeUntil = null;
        e.nextSessionAt = s.minute + 10;
        actor.skills[course.skill] = clamp((actor.skills[course.skill] ?? 0) + 5);
        emit(
          s,
          "course_attended",
          `${actor.name}, ${course.name} dersine kat\u0131ld\u0131 (${e.attended}/${course.requiredSessions}).`,
          [actor.id],
          null,
          "private"
        );
        if (e.attended >= course.requiredSessions) {
          e.status = "completed";
          e.certificateId = `certificate:${s.nextId++}`;
          s.life.certificates.push({
            id: e.certificateId,
            personId: actor.id,
            courseId: course.id,
            issuedAt: s.minute,
            enrollmentId: e.id
          });
          const event2 = emit(
            s,
            "certificate_earned",
            `${actor.name}, ${course.name} belgesi ald\u0131.`,
            [actor.id],
            null,
            "private"
          );
          if (actor.id === "player") notify(s, event2.text);
        }
      }
    }
    if (s.minute % DAY4 !== 0 || s.life.lastDailyAt >= s.minute) return;
    s.life.lastDailyAt = s.minute;
    for (const current of s.life.leases) {
      if (current.status !== "active") continue;
      const h = household2(s, current.householdId), home = property(s, current.propertyId);
      if (!h || !h.members.length || !home) continue;
      while (current.nextDueAt <= s.minute) {
        const due = current.nextDueAt, shared = budget(s, h.id), fromShared = Math.min(current.rent, shared ? s.accounts[shared.accountId] : 0), payerId = h.members[0];
        const landlord = current.landlordId;
        if (fromShared && shared)
          debitBudget(
            s,
            shared,
            fromShared,
            landlord,
            `shared-rent:${current.id}:${due}`,
            "shared-rent"
          );
        const fromPersonal = Math.min(current.rent - fromShared, s.accounts[payerId]);
        if (fromPersonal && !transfer(s, `rent:${current.id}:${due}`, payerId, landlord, fromPersonal, "rent"))
          throw new Error("Verified rent transfer failed");
        const unpaid = current.rent - fromShared - fromPersonal;
        current.arrears += unpaid;
        current.nextDueAt += WEEK;
        const payer = person4(s, payerId);
        if (payer) payer.expenses += fromPersonal;
        if (unpaid && h.members.includes("player"))
          notify(
            s,
            `Kiran\u0131n ${unpaid / 100} TL b\xF6l\xFCm\xFC gecikti. Konut, ortak b\xFCt\xE7e ve destek se\xE7eneklerini de\u011Ferlendirebilirsin.`
          );
      }
      updateArrears(s, h);
    }
    if (s.minute % (30 * DAY4) === 0) {
      const marketPrice = s.businesses.find((b) => b.id === "market")?.prices.simit ?? 1800;
      const previousPrice = Number(s.flags.lifeRentMarketPrice ?? 1800);
      const factor = Math.max(0.98, Math.min(1.02, marketPrice / Math.max(1, previousPrice)));
      let adjusted = 0;
      for (const home of s.life.properties)
        if (!home.occupantHouseholdId && !home.reservation) {
          const next = Math.min(1e5, Math.max(1e3, Math.round(home.weeklyRent * factor)));
          if (next !== home.weeklyRent) {
            home.weeklyRent = next;
            adjusted++;
          }
        }
      s.flags.lifeRentMarketPrice = marketPrice;
      if (adjusted)
        emit(
          s,
          factor > 1 ? "rent_rise" : "housing_review",
          `Ayl\u0131k g\u0131da fiyat\u0131 de\u011Fi\u015Fimi nedeniyle ${adjusted} bo\u015F dairenin istenen kiras\u0131 g\xFCncellendi. Mevcut kira s\xF6zle\u015Fmeleri korundu.`,
          [],
          null,
          "public"
        );
    }
    for (const h of s.households) {
      if (!h.members.length || h.members.includes("player") || h.arrears <= h.rent * 4 || h.rent <= 0)
        continue;
      const target = s.life.properties.filter(
        (p) => !p.occupantHouseholdId && p.capacity >= h.members.length && p.weeklyRent <= Math.floor(h.rent * 0.8) && canMove(s, p, h)
      ).sort((a, b) => a.weeklyRent - b.weeklyRent || a.id.localeCompare(b.id))[0];
      if (target && enterLease(s, h, target, h.members[0], `npc-move:${h.id}:${s.minute}`))
        emit(
          s,
          "household_moved",
          `${person4(s, h.members[0]).name} ve hanesi b\xFCt\xE7esine uygun bir daireye ta\u015F\u0131nd\u0131.`,
          [...h.members]
        );
    }
    familyMinute(s);
  }
  function lifeView(s) {
    const h = household2(s), b = budget(s, h.id), home = property(s, h.homeId), active2 = currentPartnership(s, "player"), last = s.life.aidLastAt.player ?? -3 * DAY4;
    return {
      children: s.npcs.filter(
        (n) => n.alive && n.age < 18 && ((s.life.parentage[n.id] ?? []).includes("player") || (s.life.guardians[n.id] ?? []).includes("player") || n.householdId === h.id)
      ).map((n) => ({
        id: n.id,
        name: n.name,
        age: n.age,
        guardianNames: (s.life.guardians[n.id] ?? []).map(
          (id) => person4(s, id)?.name ?? "Mahalle \xE7ocuk bak\u0131m birimi"
        )
      })),
      familyEvents: s.events.filter(
        (e) => ["child_born", "citizen_died", "guardianship_assigned"].includes(e.kind) && e.actors.includes("player")
      ).slice(-5).map((e) => e.text),
      estates: s.life.estates.filter((e) => e.heirIds.includes("player") || e.executorId === "player").map((e) => ({
        id: e.id,
        personName: person4(s, e.personId)?.name ?? e.personId,
        status: e.status,
        receivedCash: e.distributions.find((d) => d.recipient === "player")?.amount ?? 0,
        assetIds: [...e.distributions.find((d) => d.recipient === "player")?.assetIds ?? []]
      })),
      birthsRemaining: s.life.demography.maxBirths - s.life.births.length,
      canRequestChild: !!active2 && active2.status === "married" && birthEligibility(s, ["player", active2.b]) === null,
      properties: s.life.properties.filter(
        (p) => p.occupantHouseholdId === h.id || !p.occupantHouseholdId || p.ownerId === "player"
      ).map((p) => ({ ...p, reservation: p.reservation ? { ...p.reservation } : null })),
      household: {
        id: h.id,
        homeId: h.homeId,
        homeName: home.name,
        memberNames: h.members.map((id) => person4(s, id)?.name ?? id),
        funds: s.accounts[b.accountId],
        ownContribution: b.shares.player ?? 0,
        rent: h.rent,
        arrears: h.arrears,
        nextDueAt: lease(s, h.id)?.nextDueAt ?? null
      },
      partnership: active2 ? { ...active2, partnerName: person4(s, active2.b)?.name ?? active2.b } : null,
      courses: COURSES.map((c) => ({
        ...c,
        unlocks: [...c.unlocks],
        enrollment: (() => {
          const e = [...s.life.enrollments].reverse().find((e2) => e2.personId === "player" && e2.courseId === c.id);
          return e ? { ...e } : null;
        })(),
        certified: s.life.certificates.some(
          (cert) => cert.personId === "player" && cert.courseId === c.id
        )
      })),
      aidAvailableAt: last + 3 * DAY4,
      eligibleForAid: s.minute >= last + 3 * DAY4 && s.accounts.player < 5e3 && (!s.player.jobId || s.player.health < 40 || h.arrears > 0),
      certificateNames: s.life.certificates.filter((c) => c.personId === "player").map((c) => COURSES.find((course) => course.id === c.courseId)?.name ?? c.courseId)
    };
  }
  function validateLife(s) {
    try {
      const l = s.life, errors = [];
      if (!l || l.version !== 2) return ["life-version"];
      const people4 = new Map([s.player, ...s.npcs].map((n) => [n.id, n])), households = new Map(s.households.map((h) => [h.id, h])), properties = new Map(l.properties.map((p) => [p.id, p]));
      const safe = (n) => Number.isSafeInteger(n) && n >= 0;
      if (properties.size !== l.properties.length) errors.push("life-duplicate-property");
      const activeHomes = /* @__PURE__ */ new Set(), memberships = /* @__PURE__ */ new Set();
      for (const h of s.households) {
        if (!h.members.length) {
          errors.push(`life-empty-household:${h.id}`);
          continue;
        }
        const p = properties.get(h.homeId);
        if (!p || p.occupantHouseholdId !== h.id || h.members.length > p.capacity || activeHomes.has(h.homeId))
          errors.push(`life-primary-home:${h.id}`);
        activeHomes.add(h.homeId);
        if (!safe(h.rent) || !safe(h.arrears) || h.arrears !== l.leases.filter((x) => x.householdId === h.id).reduce((sum, x) => sum + x.arrears, 0))
          errors.push(`life-arrears:${h.id}`);
        for (const id of h.members) {
          const n = people4.get(id);
          if (memberships.has(id) || !n || !n.alive || n.householdId !== h.id || n.homeId !== h.homeId)
            errors.push(`life-membership:${id}`);
          memberships.add(id);
        }
        const budgets = l.budgets.filter((b2) => b2.householdId === h.id);
        if (budgets.length !== 1) {
          errors.push(`life-budget-count:${h.id}`);
          continue;
        }
        const b = budgets[0];
        if (b.accountId !== `household:${h.id}` || !safe(s.accounts[b.accountId]) || Object.keys(b.shares).some((id) => !h.members.includes(id)) || Object.values(b.shares).some((n) => !safe(n)) || Object.values(b.shares).reduce((sum, n) => sum + n, 0) !== s.accounts[b.accountId])
          errors.push(`life-budget:${h.id}`);
      }
      if (memberships.size !== [...people4.values()].filter((p) => p.alive).length)
        errors.push("life-unhoused-person");
      for (const p of l.properties) {
        if (!Number.isSafeInteger(p.capacity) || p.capacity < 1 || p.capacity > 4 || !safe(p.askingPrice) || !safe(p.weeklyRent) || !Object.hasOwn(s.accounts, p.ownerId) || !BUILDINGS.some((b) => b.id === p.buildingId))
          errors.push(`life-property:${p.id}`);
        if (p.occupantHouseholdId && households.get(p.occupantHouseholdId)?.homeId !== p.id)
          errors.push(`life-occupancy:${p.id}`);
        const owner = people4.get(p.ownerId);
        if (owner && !owner.propertyIds.includes(p.id)) errors.push(`life-deed:${p.id}`);
        if (p.reservation && (!households.has(p.reservation.householdId) || !safe(p.reservation.expiresAt) || p.occupantHouseholdId && p.occupantHouseholdId !== p.reservation.householdId))
          errors.push(`life-reservation:${p.id}`);
      }
      for (const n of people4.values())
        for (const id of n.propertyIds) {
          const owned = properties.get(id);
          if (owned && owned.ownerId !== n.id) errors.push(`life-deed-backref:${n.id}:${id}`);
        }
      const leaseIds = /* @__PURE__ */ new Set(), activeLeases = /* @__PURE__ */ new Set();
      for (const lease2 of l.leases) {
        if (leaseIds.has(lease2.id) || !properties.has(lease2.propertyId) || !people4.has(lease2.payerId) || !Object.hasOwn(s.accounts, lease2.landlordId) || !households.has(lease2.householdId) && !l.archivedHouseholds.includes(lease2.householdId) || ![lease2.rent, lease2.deposit, lease2.startsAt, lease2.nextDueAt, lease2.arrears].every(safe) || !["active", "ended"].includes(lease2.status))
          errors.push(`life-lease:${lease2.id}`);
        leaseIds.add(lease2.id);
        if (lease2.depositAccount !== `deposit:${lease2.id}` || s.accounts[lease2.depositAccount] !== (lease2.status === "active" ? lease2.deposit : 0))
          errors.push(`life-deposit:${lease2.id}`);
        if (lease2.status === "active") {
          if (activeLeases.has(lease2.householdId) || households.get(lease2.householdId)?.homeId !== lease2.propertyId || households.get(lease2.householdId)?.rent !== lease2.rent)
            errors.push(`life-active-lease:${lease2.id}`);
          activeLeases.add(lease2.householdId);
        }
      }
      const visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set();
      const visit = (id) => {
        if (visiting.has(id)) {
          errors.push("life-parentage-cycle");
          return;
        }
        if (visited.has(id)) return;
        visiting.add(id);
        const parents = l.parentage[id] ?? [];
        if (!people4.has(id) || parents.length > 2 || new Set(parents).size !== parents.length)
          errors.push(`life-parentage:${id}`);
        for (const parent of parents) {
          const ancestor = people4.get(parent), death = l.deaths.find((d) => d.personId === parent);
          const effectiveAge = (ancestor?.age ?? 0) + (death ? Math.floor(s.minute / (365 * DAY4)) - Math.floor(death.minute / (365 * DAY4)) : 0);
          if (!ancestor || effectiveAge - (people4.get(id)?.age ?? 0) < 18)
            errors.push(`life-parent-age:${id}`);
          visit(parent);
        }
        visiting.delete(id);
        visited.add(id);
      };
      for (const id of Object.keys(l.parentage)) visit(id);
      const partnered = /* @__PURE__ */ new Set(), partnershipIds = /* @__PURE__ */ new Set();
      for (const bond of l.partnerships) {
        if (partnershipIds.has(bond.id)) errors.push(`life-duplicate-partnership:${bond.id}`);
        partnershipIds.add(bond.id);
        if (!people4.has(bond.a) || !people4.has(bond.b) || bond.a === bond.b || !["dating", "married", "separated", "widowed"].includes(bond.status)) {
          errors.push(`life-partnership:${bond.id}`);
          continue;
        }
        if (["dating", "married"].includes(bond.status)) {
          if (partnered.has(bond.a) || partnered.has(bond.b) || people4.get(bond.a).age < 18 || people4.get(bond.b).age < 18 || related(s, bond.a, bond.b))
            errors.push(`life-partner-eligibility:${bond.id}`);
          partnered.add(bond.a);
          partnered.add(bond.b);
          const purpose = bond.status === "married" ? "marriage" : "date";
          if (![
            [bond.a, bond.b],
            [bond.b, bond.a]
          ].every(
            ([from, to]) => l.consents.some(
              (c) => c.from === from && c.to === to && c.purpose === purpose && c.accepted && c.minute >= bond.startedAt
            )
          ))
            errors.push(`life-mutual-consent:${bond.id}`);
          if (bond.status === "married" && people4.get(bond.a).householdId !== people4.get(bond.b).householdId)
            errors.push(`life-married-household:${bond.id}`);
        }
      }
      if (new Set(l.consents.map((c) => c.id)).size !== l.consents.length)
        errors.push("life-duplicate-consent");
      for (const c of l.consents)
        if (!people4.has(c.from) || !people4.has(c.to) || c.from === c.to || !["date", "marriage", "parenthood"].includes(c.purpose) || typeof c.accepted !== "boolean" || !safe(c.minute))
          errors.push(`life-consent:${c.id}`);
      const certificateIds = /* @__PURE__ */ new Set(), enrollmentIds = /* @__PURE__ */ new Set(), registeredCourses = /* @__PURE__ */ new Set(), earnedCourses = /* @__PURE__ */ new Set();
      for (const e of l.enrollments) {
        const course = COURSES.find((c) => c.id === e.courseId);
        if (enrollmentIds.has(e.id) || !people4.has(e.personId) || !course || !["enrolled", "completed", "cancelled"].includes(e.status) || ![e.enrolledAt, e.attended, e.missed, e.nextSessionAt].every(safe) || e.activeUntil !== null && !safe(e.activeUntil) || e.attended > (course?.requiredSessions ?? 0))
          errors.push(`life-enrollment:${e.id}`);
        enrollmentIds.add(e.id);
        if (e.status !== "enrolled" && e.activeUntil !== null)
          errors.push(`life-inactive-class:${e.id}`);
        if (e.status !== "cancelled") {
          const key3 = `${e.personId}:${e.courseId}`;
          if (registeredCourses.has(key3)) errors.push(`life-duplicate-enrollment:${e.id}`);
          registeredCourses.add(key3);
        }
        if (e.status === "completed" && (e.attended !== course?.requiredSessions || !l.certificates.some((c) => c.id === e.certificateId && c.enrollmentId === e.id)))
          errors.push(`life-unearned-certificate:${e.id}`);
      }
      for (const c of l.certificates) {
        const key3 = `${c.personId}:${c.courseId}`;
        if (earnedCourses.has(key3)) errors.push(`life-duplicate-certificate:${c.id}`);
        earnedCourses.add(key3);
        const e = l.enrollments.find((e2) => e2.id === c.enrollmentId);
        if (certificateIds.has(c.id) || !e || e.personId !== c.personId || e.courseId !== c.courseId || e.status !== "completed" || e.certificateId !== c.id || !safe(c.issuedAt))
          errors.push(`life-certificate:${c.id}`);
        certificateIds.add(c.id);
      }
      if (l.enrollments.filter((e) => e.personId === "player" && e.activeUntil !== null).length > 1)
        errors.push("life-overlapping-classes");
      if (!safe(l.lastDailyAt) || Object.entries(l.aidLastAt).some(([id, minute]) => !people4.has(id) || !safe(minute)))
        errors.push("life-schedule");
      errors.push(...validateFamily(s));
      return errors;
    } catch (error) {
      return [`life-malformed:${error instanceof Error ? error.message : "unknown"}`];
    }
  }

  // src/games/social-engine/simulation/engine.ts
  function createWorld(seed = 20261103, profile) {
    return initializeCompleteWorld(seed, profile, 1100);
  }
  function createBenchmarkWorld(seed = 20261103) {
    return initializeCompleteWorld(seed, void 0, 1e4);
  }
  function initializeCompleteWorld(seed, profile, populationCount) {
    const state = initializeWorld(seed, profile, populationCount);
    state.life = initializeLife(state, { seedFamilies: true });
    state.mobility = initializeMobility(state);
    state.social = initializeSocial(state);
    state.progression = initializeProgression(state);
    state.economy = initializeEconomy(state);
    offerEvent(state, "shortage");
    offerEvent(state, "neighbor_help");
    offerEvent(state, "delivery");
    return state;
  }
  var canonicalState = (state) => canonical(state);
  var distance2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  var atBuilding = (state, buildingId) => {
    const building = BUILDINGS.find((item) => item.id === buildingId), location = state.player.location;
    return !!building && (location.scene === buildingId || location.scene === "outside" && distance2(location, building.door) <= 1.8 && hasLineOfSight(location, building.door));
  };
  var nearby3 = (state, person5) => person5.alive && person5.location.scene === state.player.location.scene && distance2(state.player.location, person5.location) <= 1.8 && hasLineOfSight(state.player.location, person5.location, person5.location.scene);
  var numberArg = (args, key3) => typeof args[key3] === "number" && Number.isFinite(args[key3]) ? args[key3] : null;
  var stringArg = (args, key3) => typeof args[key3] === "string" ? args[key3] : "";
  var commandSets = /* @__PURE__ */ new WeakMap();
  function stop(state) {
    state.flags.moveX = 0;
    state.flags.moveY = 0;
    state.player.path = [];
    state.player.destination = null;
  }
  function payFine(state) {
    const cases = state.crimes.filter(
      (crime) => crime.offender === "player" && crime.reported && crime.status !== "resolved" && isPoliceChargeSupported(state, crime.id)
    );
    for (const crime of cases) {
      const cash = Math.min(state.accounts.player, crime.fine);
      if (cash) transfer(state, `fine:${crime.id}`, "player", "municipality", cash, "fine");
      const arrears = crime.fine - cash;
      state.player.debt += arrears;
      state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + arrears;
      crime.status = "resolved";
      recordFineResolution(state, crime.id);
      emit(
        state,
        "case_resolved",
        "\u0130fade al\u0131nd\u0131; tan\u0131k kayd\u0131 olan dosya oyun i\xE7i para cezas\u0131yla kapand\u0131.",
        ["player"],
        crime.victim,
        "private"
      );
    }
    state.player.wanted = 0;
    state.flags.pursuitUntil = 0;
    state.player.shift = null;
    stop(state);
    notify(
      state,
      "Takip sona erdi. \xD6denemeyen ceza bor\xE7 defterinde; ge\xE7im ve iyile\u015Fme yollar\u0131 a\xE7\u0131k."
    );
  }
  function consume(state, item, count = 1) {
    if (!Object.hasOwn(state.player.inventory, item) || !Number.isSafeInteger(state.player.inventory[item]) || state.player.inventory[item] < count)
      return false;
    state.player.inventory[item] -= count;
    if (!state.player.inventory[item]) delete state.player.inventory[item];
    return true;
  }
  function completeMission(state, questId) {
    const quest = state.quests.find((item2) => item2.id === questId), p = state.player;
    if (!quest || quest.status !== "active")
      return { ok: false, reason: "G\xF6rev aktif de\u011Fil veya \xF6d\xFCl daha \xF6nce al\u0131nd\u0131.", events: [] };
    if (!atBuilding(state, quest.buildingId))
      return { ok: false, reason: "\xD6nce g\xF6revde belirtilen mek\xE2na ula\u015F.", events: [] };
    let item = "";
    switch (quest.kind) {
      case "shortage":
      case "vehicle_breakdown":
        item = "parts";
        break;
      case "neighbor_help":
        item = "simit";
        break;
      case "friend_invite":
        item = "tea";
        break;
      case "delivery":
        item = `parcel:${quest.id}`;
        break;
      case "job_offer":
        if (!p.jobId) return { ok: false, reason: "\xD6nce telefonundan bir i\u015Fe ba\u015Fvur.", events: [] };
        break;
      case "layoff":
        if (!Number(state.flags.shiftsCompleted))
          return { ok: false, reason: "Bir vardiya tamamlaman gerekiyor.", events: [] };
        break;
      case "promotion":
        if (!Object.values(p.skills).some((value) => value >= 20))
          return { ok: false, reason: "Bir beceriyi en az 20 seviyesine getir.", events: [] };
        break;
      case "loan_due":
        if (p.debt >= Number(state.flags[`questDebt:${quest.id}`]))
          return { ok: false, reason: "Bor\xE7 bakiyeni \xF6nce azaltmal\u0131s\u0131n.", events: [] };
        break;
      case "price_shock":
        if (p.skills.trade < 15)
          return { ok: false, reason: "Ticaret becerin en az 15 olmal\u0131.", events: [] };
        break;
      case "scholarship":
        if (p.skills.academic <= Number(state.flags[`questAcademic:${quest.id}`]))
          return { ok: false, reason: "\xD6nce akademide bir ders tamamla.", events: [] };
        break;
      case "traffic_jam":
        if (Number(state.flags.drivenDistance ?? 0) < 10)
          return { ok: false, reason: "Ara\xE7la en az 10 metre s\xFCr.", events: [] };
        break;
      case "witness_report":
        if (!state.crimes.some((crime) => crime.reported && crime.witnesses.length))
          return { ok: false, reason: "Bildirilebilecek ger\xE7ek bir tan\u0131k kayd\u0131 yok.", events: [] };
        break;
      case "police_check":
        if (p.wanted || !state.crimes.some((crime) => crime.status === "resolved"))
          return { ok: false, reason: "\xD6nce a\xE7\u0131k takip dosyan\u0131 \xE7\xF6z.", events: [] };
        break;
      case "faction_truce":
        if (p.reputation < 10)
          return {
            ok: false,
            reason: "Arabuluculuk i\xE7in sosyal itibar\u0131n en az 10 olmal\u0131.",
            events: []
          };
        break;
      case "late_wage":
        break;
      default:
        if (!state.relations.some((edge) => edge.to === "player" && edge.trust >= 5))
          return { ok: false, reason: "Bir kom\u015Fuyla konu\u015Fup g\xFCven olu\u015Ftur.", events: [] };
    }
    if (item && (p.inventory[item] ?? 0) < 1)
      return {
        ok: false,
        reason: `${ITEMS[item]?.name ?? "G\xF6rev paketi"} \xE7antanda yok.`,
        events: []
      };
    const escrow = `escrow:${quest.id}`;
    if (state.accounts[escrow] !== quest.reward)
      return { ok: false, reason: "G\xF6rev \xF6d\xFCl\xFC do\u011Frulanamad\u0131; i\u015Flem yap\u0131lmad\u0131.", events: [] };
    if (!transfer(state, `reward:${quest.id}`, escrow, "player", quest.reward, "mission-reward"))
      return { ok: false, reason: "\xD6d\xFCl aktar\u0131m\u0131 reddedildi.", events: [] };
    if (item) consume(state, item);
    quest.status = "complete";
    quest.progress = quest.required;
    p.reputation = clamp(p.reputation + 3, -100, 100);
    adjustRelation(state, quest.issuerId, "player", 10, 4);
    if (quest.kind === "shortage") state.businesses.find((b) => b.id === "garage").stock.parts += 1;
    if (quest.kind === "delivery") state.businesses.find((b) => b.id === "taxi").stock.parts += 1;
    if (quest.kind === "vehicle_breakdown") {
      state.flags.vehicleWear = false;
      state.vehicles[2].speed = 2;
      p.skills.technical = clamp(p.skills.technical + 4);
    }
    if (quest.kind === "late_wage") {
      const business = state.businesses.find(
        (b) => b.buildingId === quest.buildingId && b.ownerId === quest.issuerId
      );
      if (business && business.status === "distressed") {
        transfer(
          state,
          `mediation:${quest.id}`,
          "municipality",
          `business:${business.id}`,
          3e4,
          "wage-mediation"
        );
        business.status = "open";
      }
    }
    if (quest.kind === "faction_truce")
      for (const faction of ["dock", "hill", "night"])
        state.flags[`faction:${faction}`] = Math.max(
          0,
          Number(state.flags[`faction:${faction}`]) - 3
        );
    const event2 = emit(
      state,
      "mission_completed",
      `${quest.title} tamamland\u0131. ${(quest.reward / 100).toFixed(0)} TL \xF6dendi.`,
      ["player", quest.issuerId],
      null,
      "public",
      [],
      quest.sourceEvent
    );
    notify(state, event2.text);
    return { ok: true, reason: event2.text, events: [event2.id] };
  }
  function applyCommand(state, command) {
    const result = applyCommandInner(state, command);
    reconcileProgression(
      state,
      command?.type === "BUY" ? String(command.args?.businessId ?? "world") : "world"
    );
    return result;
  }
  function applyCommandInner(state, command) {
    const fail3 = (reason) => ({ ok: false, reason, events: [] });
    const ok3 = (reason) => ({ ok: true, reason, events: [] });
    if (!command || command.v !== 1 || typeof command.id !== "string" || !/^[\w:.-]{1,120}$/.test(command.id) || !command.args || typeof command.args !== "object")
      return fail3("Ge\xE7ersiz komut bi\xE7imi.");
    let ids = commandSets.get(state);
    if (!ids) {
      ids = new Set(state.processedCommands);
      commandSets.set(state, ids);
    }
    if (ids.has(command.id)) return fail3("Bu i\u015Flem daha \xF6nce i\u015Flendi.");
    ids.add(command.id);
    state.processedCommands.push(command.id);
    const a = command.args, p = state.player;
    const custodyResult = guardJusticeCommand(state, command);
    if (custodyResult) return custodyResult;
    const justiceResult = applyJusticeCommand(state, command);
    if (justiceResult) return justiceResult;
    const progressionResult = progressionCommand(state, command);
    if (progressionResult) return progressionResult;
    const mobilityResult = applyMobilityCommand(state, command);
    if (mobilityResult) return mobilityResult;
    const socialResult = applySocialCommand(state, command);
    if (socialResult) return socialResult;
    const lifeType = command.type === "TALK" ? { date: "ASK_DATE", marry: "PROPOSE_MARRIAGE", separate: "SEPARATE" }[String(a.topic)] : void 0;
    const lifeResult = applyLifeCommand(state, lifeType ? { ...command, type: lifeType } : command);
    if (lifeResult) return lifeResult;
    switch (command.type) {
      case "MOVE": {
        const x = numberArg(a, "x"), y = numberArg(a, "y");
        if (x === null || y === null || Math.abs(x) > 1 || Math.abs(y) > 1 || p.vehicleId)
          return fail3("Hareket girdisi ge\xE7ersiz.");
        state.flags.moveX = x;
        state.flags.moveY = y;
        state.flags.sprint = a.sprint === true;
        p.path = [];
        p.destination = null;
        return ok3("");
      }
      case "STOP":
        stop(state);
        state.flags.throttle = 0;
        state.flags.steer = 0;
        return ok3("");
      case "MOVE_TO": {
        const x = numberArg(a, "x"), y = numberArg(a, "y");
        if (x === null || y === null || p.vehicleId || !isWalkable({ x, y }, p.location.scene))
          return fail3("Bu noktaya y\xFCr\xFCnemiyor.");
        const path = findPath(p.location, { x, y }, p.location.scene);
        if (!path.length) return fail3("Hedefe a\xE7\u0131k bir yol bulunamad\u0131.");
        stop(state);
        p.destination = { x, y };
        p.path = path;
        return ok3("Yol belirlendi.");
      }
      case "ENTER": {
        const building = BUILDINGS.find((item) => item.id === stringArg(a, "buildingId"));
        if (!building || p.location.scene !== "outside" || p.vehicleId || !atBuilding(state, building.id))
          return fail3("Girmek i\xE7in binan\u0131n kap\u0131s\u0131na yakla\u015F.");
        p.location = { ...INTERIOR_SPAWN, scene: building.id };
        stop(state);
        emit(
          state,
          "building_entered",
          `${building.name} i\xE7ine girdin.`,
          ["player"],
          building.id,
          "private"
        );
        return ok3(`${building.name}`);
      }
      case "EXIT": {
        const building = BUILDINGS.find((item) => item.id === p.location.scene);
        if (!building || distance2(p.location, INTERIOR_EXIT) > 2 || !hasLineOfSight(p.location, INTERIOR_EXIT, building.id))
          return fail3("\xC7\u0131kmak i\xE7in kap\u0131ya yakla\u015F.");
        p.location = { ...building.door, scene: "outside" };
        stop(state);
        return ok3("Soka\u011Fa \xE7\u0131kt\u0131n.");
      }
      case "TALK": {
        const npc = state.npcs.find((item) => item.id === stringArg(a, "npcId"));
        if (!npc || !nearby3(state, npc))
          return fail3("Konu\u015Fmak i\xE7in ki\u015Fiye yakla\u015F ve g\xF6r\xFC\u015F hatt\u0131n\u0131 a\xE7.");
        if (Number(state.flags[`talk:${npc.id}`] ?? -100) + 20 > state.tick)
          return fail3("Kar\u015F\u0131ndaki konu\u015Fmas\u0131n\u0131 bitirsin.");
        state.flags[`talk:${npc.id}`] = state.tick;
        const topic = stringArg(a, "topic") || "greet";
        if (!["greet", "help", "insult", "askJob", "date", "marry", "separate"].includes(topic))
          return fail3("Bu konu\u015Fma se\xE7ene\u011Fi yok.");
        const edge = relation(state, npc.id, "player");
        let line;
        if (topic === "insult") {
          adjustRelation(state, npc.id, "player", -12, -4, 0, 12);
          p.reputation = clamp(p.reputation - 3, -100, 100);
          line = `${npc.name}: B\xF6yle konu\u015Fursan aram\u0131zdaki g\xFCven kalmaz.`;
        } else if (topic === "help") {
          if (!consume(state, "simit")) return fail3("Yard\u0131m etmek i\xE7in \xE7antanda bir simit olmal\u0131.");
          adjustRelation(state, npc.id, "player", 12, 6);
          npc.hunger = clamp(npc.hunger - 25);
          p.reputation = clamp(p.reputation + 3, -100, 100);
          line = `${npc.name}: Bunu unutmayaca\u011F\u0131m. \u0130\u015F ararken ad\u0131n\u0131 s\xF6yleyebilirim.`;
        } else {
          adjustRelation(state, npc.id, "player", topic === "askJob" ? 2 : 5, 2);
          p.skills.communication = clamp(p.skills.communication + 1);
          line = edge.trust < -15 ? `${npc.name}: \xD6nce aram\u0131zdaki meseleyi \xE7\xF6zmeliyiz.` : topic === "askJob" ? `${npc.name}: Telefonundaki i\u015F ilanlar\u0131na bak. G\xFCven kazand\u0131\u011F\u0131nda \xFCcretine referans katk\u0131m olur.` : `${npc.name}: ${npc.goal === "work" ? "Vardiya yo\u011Fun ge\xE7iyor." : npc.hunger > 60 ? "Bir \u015Feyler yemem gerekiyor." : "K\u0131y\u0131yaka\u2019da herkesin bir hik\xE2yesi var."} ${npc.memories.length ? "Son kar\u015F\u0131la\u015Fmalar\u0131m\u0131z\u0131 hat\u0131rl\u0131yorum." : "Tan\u0131\u015Ft\u0131\u011F\u0131m\u0131za sevindim."}`;
        }
        const event2 = emit(
          state,
          topic === "insult" ? "relationship_dispute" : "conversation",
          line,
          ["player", npc.id],
          npc.id,
          "private"
        );
        notify(state, line);
        return { ok: true, reason: line, events: [event2.id] };
      }
      case "BUY": {
        const business = state.businesses.find((item2) => item2.id === stringArg(a, "businessId")), item = stringArg(a, "item"), quantity = a.quantity === void 0 ? 1 : numberArg(a, "quantity");
        if (!business || business.status === "closed" || !atBuilding(state, business.buildingId))
          return fail3("Al\u0131\u015Fveri\u015F i\xE7in a\xE7\u0131k i\u015Fletmeye yakla\u015F.");
        if (!Object.hasOwn(ITEMS, item) || quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 20)
          return fail3("Ge\xE7ersiz \xFCr\xFCn veya miktar.");
        if ((business.stock[item] ?? 0) < quantity) return fail3("\u0130\u015Fletmenin sto\u011Fu yetmiyor.");
        const weight = Object.entries(p.inventory).reduce(
          (sum, [key3, count]) => sum + count * (ITEMS[key3]?.weight ?? 1),
          0
        );
        if (weight + quantity * ITEMS[item].weight > 30)
          return fail3("\xC7antanda yeterli yer yok (30 a\u011F\u0131rl\u0131k).");
        const price = business.prices[item] * quantity;
        if (state.accounts.player < price) return fail3("Yeterli paran yok.");
        const service = requestService(state, business, p);
        if (!service.ok) return fail3(service.reason);
        if (!transfer(
          state,
          `buy:${command.id}`,
          "player",
          `business:${business.id}`,
          price,
          "purchase"
        ))
          return fail3("Yeterli paran yok.");
        finishService(state, business, "player");
        business.stock[item] -= quantity;
        business.sales += price;
        recordSale(state, business.id, item, quantity);
        p.inventory[item] = (p.inventory[item] ?? 0) + quantity;
        p.expenses += price;
        emit(
          state,
          "purchase",
          `${quantity} ${ITEMS[item].name} sat\u0131n al\u0131nd\u0131.`,
          ["player", business.ownerId],
          business.id,
          "private"
        );
        return ok3(`${ITEMS[item].name} \xE7antana eklendi.`);
      }
      case "USE_ITEM": {
        const item = stringArg(a, "item"), definition = ITEMS[item];
        if (!Object.hasOwn(ITEMS, item) || item === "parts")
          return fail3("Bu e\u015Fya g\xF6revlerde veya i\u015Fletmede kullan\u0131l\u0131r.");
        if (!consume(state, item)) return fail3("Bu e\u015Fya \xE7antanda yok.");
        p.hunger = clamp(p.hunger - definition.hunger);
        p.health = clamp(p.health + definition.health);
        if (item === "book") p.skills.academic = clamp(p.skills.academic + 3);
        return ok3(`${definition.name} kullan\u0131ld\u0131.`);
      }
      case "APPLY_JOB": {
        const job = JOBS.find((item) => item.id === stringArg(a, "jobId")), employer = job && state.businesses.find((item) => item.id === job.businessId);
        if (!job || !employer || employer.status === "closed")
          return fail3("Bu i\u015F \u015Fu anda a\xE7\u0131k de\u011Fil.");
        const prerequisite = jobPrerequisite(state, job.id);
        if (prerequisite) return fail3(prerequisite);
        if (p.shift) return fail3("Aktif vardiya s\xFCrerken i\u015F de\u011Fi\u015Ftiremezsin.");
        if (job.id === "teaching" && p.skills.academic < 20)
          return fail3("E\u011Fitim asistanl\u0131\u011F\u0131 i\xE7in akademik beceri en az 20 olmal\u0131.");
        for (const business of state.businesses)
          business.employees = business.employees.filter((id) => id !== "player");
        p.jobId = job.id;
        p.employerId = employer.id;
        employer.employees.push("player");
        emit(
          state,
          "job_started",
          `${job.name} i\u015Fine kabul edildin.`,
          ["player", employer.ownerId],
          employer.id,
          "private"
        );
        return ok3("\u0130\u015Fe al\u0131nd\u0131n. Vardiya i\xE7in i\u015Fyerine git.");
      }
      case "START_SHIFT": {
        const job = JOBS.find((item) => item.id === p.jobId), employer = state.businesses.find((item) => item.id === p.employerId);
        if (!job || !employer || !atBuilding(state, employer.buildingId))
          return fail3("Vardiya i\xE7in \xE7al\u0131\u015Ft\u0131\u011F\u0131n i\u015Fletmeye git.");
        if (p.shift || state.life.enrollments.some((enrollment) => enrollment.activeUntil !== null) || employer.status === "closed" || p.wanted > 0 || p.health < 25 || p.fatigue > 85)
          return fail3(
            "Vardiya ba\u015Flayamad\u0131: aktif vardiya, takip, sa\u011Fl\u0131k veya yorgunluk durumunu kontrol et."
          );
        const reference = state.relations.some((edge) => edge.to === "player" && edge.trust >= 20) ? 1e3 : 0;
        const wage = Math.floor(
          (job.wage + p.skills[job.skill] * 100 + reference) * (employer.status === "distressed" ? 0.7 : 1)
        ) + progressionWageBonus(state);
        if (state.accounts[`business:${employer.id}`] < wage)
          return fail3("\u0130\u015Fletmenin maa\u015F b\xFCt\xE7esi yetersiz.");
        p.shift = {
          id: `shift:${state.nextId++}`,
          businessId: employer.id,
          endsAt: state.minute + job.duration,
          wage
        };
        stop(state);
        return ok3(
          `Vardiya ba\u015Flad\u0131. ${job.duration} oyun dakikas\u0131 i\u015Fyerinde kal; ${(wage / 100).toFixed(0)} TL kazanacaks\u0131n.`
        );
      }
      case "QUIT_JOB":
        if (p.shift)
          return fail3(
            "Vardiya s\xFCr\xFCyor; i\u015Ften ayr\u0131lmadan tamamla veya i\u015Fyerinden uzakla\u015Farak iptal et."
          );
        else {
          for (const business of state.businesses)
            business.employees = business.employees.filter((id) => id !== "player");
          p.jobId = null;
          p.employerId = null;
          return ok3("\u0130\u015Ften ayr\u0131ld\u0131n. Di\u011Fer ilanlar a\xE7\u0131k.");
        }
      case "ACCEPT_QUEST": {
        const quest = state.quests.find((item) => item.id === stringArg(a, "questId"));
        if (!quest || quest.status !== "offered" || quest.deadline <= state.minute)
          return fail3("Bu f\u0131rsat art\u0131k a\xE7\u0131k de\u011Fil.");
        if (state.quests.filter((item) => item.status === "active").length >= 3)
          return fail3("Ayn\u0131 anda en fazla \xFC\xE7 g\xF6rev \xFCstlenebilirsin.");
        if (quest.kind === "delivery") {
          const warehouse = state.businesses.find((b) => b.id === "warehouse");
          if (warehouse.stock.parts < 1) return fail3("Teslim edilecek paket kalmad\u0131.");
          warehouse.stock.parts--;
          p.inventory[`parcel:${quest.id}`] = 1;
        }
        quest.status = "active";
        return ok3("G\xF6rev kabul edildi. Haritada hedef i\u015Faretlendi.");
      }
      case "COMPLETE_QUEST":
        return completeMission(state, stringArg(a, "questId"));
      case "DECLINE_QUEST": {
        const quest = state.quests.find((item) => item.id === stringArg(a, "questId"));
        if (!quest || !["offered", "active"].includes(quest.status)) return fail3("G\xF6rev a\xE7\u0131k de\u011Fil.");
        quest.status = "failed";
        const balance = state.accounts[`escrow:${quest.id}`];
        if (balance)
          transfer(
            state,
            `decline:${quest.id}`,
            `escrow:${quest.id}`,
            "quests",
            balance,
            "mission-declined"
          );
        if (p.inventory[`parcel:${quest.id}`]) {
          state.businesses.find((b) => b.id === "warehouse").stock.parts += p.inventory[`parcel:${quest.id}`];
          delete p.inventory[`parcel:${quest.id}`];
        }
        return ok3("G\xF6rev b\u0131rak\u0131ld\u0131. Ayr\u0131lm\u0131\u015F paket depoya iade edildi; di\u011Fer ilerleme yollar\u0131 a\xE7\u0131k.");
      }
      case "VEHICLE_ENTER": {
        const vehicle = state.vehicles.find((item) => item.id === stringArg(a, "vehicleId"));
        if (!vehicle || vehicle.driverId || p.vehicleId || p.location.scene !== "outside" || distance2(p.location, vehicle.location) > 1.8 || !hasLineOfSight(p.location, vehicle.location))
          return fail3("Bo\u015F araca yakla\u015F.");
        const accessError = rentalAccess(state, vehicle.id);
        if (accessError) return fail3(accessError);
        unparkVehicle(state, vehicle.id);
        vehicle.driverId = "player";
        p.vehicleId = vehicle.id;
        p.location = { ...vehicle.location };
        stop(state);
        state.flags.throttle = 0;
        return ok3(
          "Araca bindin. W h\u0131zlan\u0131r, S frenler; A/D kav\u015Fakta d\xF6n\xFC\u015F se\xE7er. F veya etkile\u015Fim ile in."
        );
      }
      case "VEHICLE_EXIT": {
        const vehicle = state.vehicles.find((item) => item.id === p.vehicleId);
        if (!vehicle || vehicle.speed > 0.6) return fail3("\u0130nmek i\xE7in \xF6nce frenleyip dur.");
        const exits = [
          { x: vehicle.location.x + 1, y: vehicle.location.y },
          { x: vehicle.location.x - 1, y: vehicle.location.y },
          { x: vehicle.location.x, y: vehicle.location.y + 1 }
        ];
        const exit = exits.find((point) => isWalkable(point));
        if (!exit) return fail3("G\xFCvenli ini\u015F alan\u0131 bulunamad\u0131.");
        p.vehicleId = null;
        vehicle.driverId = null;
        vehicle.speed = 0;
        p.location = { ...exit, scene: "outside" };
        state.flags.throttle = 0;
        state.flags.steer = 0;
        return ok3("Arac\u0131 yol kenar\u0131nda durdurup indin. Ayr\u0131lm\u0131\u015F yer i\xE7in Park eylemini kullan.");
      }
      case "DRIVE": {
        const throttle = numberArg(a, "throttle"), steer = numberArg(a, "steer");
        if (!p.vehicleId || throttle === null || steer === null || Math.abs(throttle) > 1 || Math.abs(steer) > 1)
          return fail3("Ge\xE7ersiz s\xFCr\xFC\u015F komutu.");
        state.flags.throttle = throttle;
        state.flags.steer = steer;
        return ok3("");
      }
      case "ATTACK": {
        const npc = state.npcs.find((item) => item.id === stringArg(a, "npcId"));
        const heavy = a.heavy === true, cost = heavy ? 24 : 12;
        if (!npc || !nearby3(state, npc) || npc.age < 18 || p.vehicleId)
          return fail3("Yak\u0131n\u0131nda yeti\u015Fkin bir hedef olmal\u0131.");
        if (p.stamina < cost || p.cooldownUntil > state.tick || p.health <= 0)
          return fail3("Dayan\u0131kl\u0131l\u0131k veya toparlanma s\xFCresi sald\u0131r\u0131ya izin vermiyor.");
        p.stamina -= cost;
        p.attackUntil = state.tick + (heavy ? 6 : 3);
        p.cooldownUntil = state.tick + (heavy ? 18 : 10);
        state.flags.attackTarget = npc.id;
        state.flags.attackHeavy = heavy;
        return ok3("Sald\u0131r\u0131 haz\u0131rlan\u0131yor.");
      }
      case "BLOCK":
        p.blocking = a.active === true;
        return ok3(p.blocking ? "Savunma a\xE7\u0131k." : "Savunma kapal\u0131.");
      case "DODGE":
        if (p.stamina < 15) return fail3("Ka\xE7\u0131nmak i\xE7in dayan\u0131kl\u0131l\u0131k yetersiz.");
        else {
          p.stamina -= 15;
          state.flags.dodgeUntil = state.tick + 6;
          return ok3("Ka\xE7\u0131nd\u0131n.");
        }
      case "SURRENDER":
        if (!p.wanted) return fail3("Aktif takip yok.");
        else {
          payFine(state);
          return ok3("Teslim oldun; dosya sonucu kaydedildi.");
        }
      case "REPORT": {
        const crime = state.crimes.find((item) => item.id === stringArg(a, "crimeId"));
        if (!crime || !crime.witnesses.length || crime.status === "resolved" || !atBuilding(state, "b-police"))
          return fail3("Karakolda, tan\u0131k kayd\u0131 bulunan a\xE7\u0131k bir olay bildirebilirsin.");
        crime.reported = true;
        crime.status = "investigating";
        state.flags[`caseHidden:${crime.id}`] = false;
        emit(state, "witness_report", "Tan\u0131k ifadesi dosyaya i\u015Flendi.", ["player"], crime.victim);
        return ok3("\u0130hbar kaydedildi.");
      }
      case "REST": {
        if (!atBuilding(state, "b-home") && !atBuilding(state, "b-clinic"))
          return fail3("Dinlenmek i\xE7in eve veya klini\u011Fe git.");
        if (p.wanted || p.shift || p.vehicleId)
          return fail3("Takip veya vardiya s\u0131ras\u0131nda dinlenemezsin.");
        state.flags.restUntil = state.minute + 60;
        stop(state);
        return ok3("Bir saatlik dinlenme ba\u015Flad\u0131. Hareket edersen dinlenme sona erer.");
      }
      case "TRAIN": {
        const skill = stringArg(a, "skill");
        if (!Object.hasOwn(p.skills, skill) || ![
          "academic",
          "driving",
          "combat",
          "communication",
          "technical",
          "trade",
          "body",
          "discipline"
        ].includes(skill) || !atBuilding(state, "b-school") && !(skill === "technical" && atBuilding(state, "b-garage")))
          return fail3("Ders i\xE7in akademiye, teknik \xE7al\u0131\u015Fma i\xE7in tamirhaneye git.");
        if (p.wanted || p.shift || state.life.enrollments.some((enrollment) => enrollment.activeUntil !== null) || Number(state.flags.trainingUntil ?? 0) > state.minute)
          return fail3("\u015Eu anda derse ba\u015Flayamazs\u0131n.");
        const dayKey = `training:${Math.floor(state.minute / 1440)}`;
        if (Number(state.flags[dayKey] ?? 0) >= 5) return fail3("G\xFCnl\xFCk ders s\u0131n\u0131r\u0131na ula\u015Ft\u0131n.");
        if (!transfer(state, `course:${command.id}`, "player", "business:school", 2500, "course-fee"))
          return fail3("Ders \xFCcreti 25 TL.");
        state.flags.trainingSkill = skill;
        state.flags.trainingUntil = state.minute + 20;
        state.flags.trainingBuilding = atBuilding(state, "b-school") ? "b-school" : "b-garage";
        state.flags[dayKey] = Number(state.flags[dayKey] ?? 0) + 1;
        stop(state);
        return ok3("Ders ba\u015Flad\u0131. 20 oyun dakikas\u0131 burada kal.");
      }
      case "BORROW": {
        const amount2 = numberArg(a, "amount");
        if (!atBuilding(state, "b-bank") || amount2 === null || !Number.isSafeInteger(amount2) || amount2 < 1e3 || amount2 > 2e5 || p.debt + amount2 > 3e5)
          return fail3(
            "Bankada 10\u20132000 TL aras\u0131 kredi; toplam bor\xE7 s\u0131n\u0131r\u0131 3000 TL. Haftal\u0131k oyun faizi %1."
          );
        if (!transfer(state, `loan:${command.id}`, "bank", "player", amount2, "loan-principal"))
          return fail3("Kredi verilemedi.");
        p.debt += amount2;
        state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) + amount2;
        emit(
          state,
          "loan_opened",
          "Kredi anaparas\u0131 ve kar\u015F\u0131l\u0131k alaca\u011F\u0131 bor\xE7 defterine i\u015Flendi.",
          ["player"],
          null,
          "private"
        );
        return ok3("Kredi hesab\u0131na ge\xE7ti. Haftal\u0131k oyun faizi %1.");
      }
      case "REPAY": {
        const requested = numberArg(a, "amount");
        if (requested === null || !Number.isSafeInteger(requested) || requested <= 0 || !p.debt)
          return fail3("Ge\xE7erli bir bor\xE7 \xF6deme tutar\u0131 gir.");
        const amount2 = Math.min(requested, p.debt);
        if (!transfer(state, `repay:${command.id}`, "player", "bank", amount2, "debt-repayment"))
          return fail3("Bor\xE7 \xF6demesi i\xE7in bakiye yetersiz.");
        p.debt -= amount2;
        state.flags.loanAsset = Number(state.flags.loanAsset ?? 0) - amount2;
        return ok3("Bor\xE7 \xF6demesi kaydedildi.");
      }
      case "BUY_BUSINESS": {
        const business = state.businesses.find((item) => item.id === stringArg(a, "businessId"));
        if (!business || business.ownerId === "player" || !atBuilding(state, business.buildingId))
          return fail3("Devralmak i\xE7in i\u015Fletmeye git.");
        if (state.life.estates?.some(
          (estate) => estate.status === "settling" && estate.assets.includes(business.id)
        ))
          return fail3("\u0130\u015Fletme miras tasfiyesinde; bor\xE7lar sonu\xE7lanana kadar devral\u0131namaz.");
        const price = business.status === "distressed" ? 6e5 : 12e5;
        if (!transfer(
          state,
          `acquire:${command.id}`,
          "player",
          business.ownerId,
          price,
          "business-acquisition"
        ))
          return fail3(`Devralma i\xE7in ${(price / 100).toFixed(0)} TL gerekiyor.`);
        const previousOwner = state.npcs.find((npc) => npc.id === business.ownerId);
        if (previousOwner)
          previousOwner.propertyIds = previousOwner.propertyIds.filter((id) => id !== business.id);
        business.ownerId = "player";
        p.propertyIds.push(business.id);
        emit(
          state,
          "business_acquired",
          "\u0130\u015Fletmeyi devrald\u0131n; g\xFCnl\xFCk k\xE2rdan pay alacaks\u0131n.",
          ["player"],
          business.id
        );
        return ok3("\u0130\u015Fletmenin sahibi oldun.");
      }
      case "SUPPORT": {
        const dayKey = `support:${Math.floor(state.minute / 1440)}`;
        if (!atBuilding(state, "b-security") || state.accounts.player >= 2e4 || state.flags[dayKey])
          return fail3("Dayan\u0131\u015Fma deste\u011Fi, 200 TL alt\u0131ndaki bakiye i\xE7in g\xFCnde bir kez al\u0131nabilir.");
        if (!transfer(
          state,
          `support:${command.id}`,
          "municipality",
          "player",
          2e4,
          "emergency-support"
        ))
          return fail3("Destek fonu \u015Fu an yetersiz.");
        state.flags[dayKey] = true;
        return ok3("200 TL ge\xE7im deste\u011Fi hesab\u0131nda. Ge\xE7ici i\u015Flere ba\u015Fvurabilirsin.");
      }
      case "JOIN_FACTION": {
        const faction = stringArg(a, "factionId");
        if (!["dock", "hill", "night"].includes(faction) || p.reputation < 5)
          return fail3("Bir \xE7evreye kat\u0131lmak i\xE7in en az 5 sosyal itibar gerekiyor.");
        const previous = String(state.flags.faction);
        if (previous && previous !== faction) {
          p.influence = clamp(p.influence - 5);
          emit(state, "faction_departure", "Eski \xE7evren ayr\u0131l\u0131\u011F\u0131n\u0131 hat\u0131rlayacak.", ["player"]);
        }
        if (previous === faction) return fail3("Zaten bu \xE7evrenin \xFCyesisin.");
        state.flags.faction = faction;
        p.influence = clamp(p.influence + 5);
        state.flags[`faction:${faction}`] = clamp(Number(state.flags[`faction:${faction}`]) + 3);
        return ok3("\xC7evre kayd\u0131n g\xFCncellendi.");
      }
      default:
        return fail3("Bilinmeyen komut.");
    }
  }
  function movement(state) {
    const p = state.player;
    if (p.vehicleId || state.mobility.trip) return;
    let dx = Number(state.flags.moveX), dy = Number(state.flags.moveY), speed = state.flags.sprint && p.stamina >= 1 ? 0.36 : 0.16;
    if (p.path.length) {
      const target = p.path[0];
      dx = target.x - p.location.x;
      dy = target.y - p.location.y;
      if (Math.hypot(dx, dy) <= speed) {
        p.location.x = target.x;
        p.location.y = target.y;
        p.path.shift();
        if (!p.path.length) p.destination = null;
        return;
      }
    }
    const length = Math.hypot(dx, dy);
    if (!length) {
      if (!p.blocking) p.stamina = clamp(p.stamina + 0.4);
      return;
    }
    if (p.health < 20) speed *= 0.6;
    if (state.flags.sprint && p.stamina >= 1)
      p.stamina = clamp(
        p.stamina - 0.45 * (p.location.scene === "outside" ? weatherEffects(state).needFactor : 1)
      );
    const next = moveWithCollision(
      p.location,
      { x: dx / length * speed, y: dy / length * speed },
      p.location.scene
    );
    p.location.x = quantize(next.x);
    p.location.y = quantize(next.y);
    state.flags.restUntil = 0;
  }
  function traffic(state) {
    const context = trafficContext(state);
    for (const vehicle of state.vehicles) {
      if (!vehicle.driverId) continue;
      if (vehicle.driverId === "player") {
        const throttle = Number(state.flags.throttle ?? 0);
        vehicle.speed = quantize(
          clamp(
            vehicle.speed + (throttle > 0 ? 0.22 : throttle < 0 ? -0.55 : -0.08),
            0,
            6 * weatherEffects(state).speedFactor
          )
        );
        if (Number(state.flags.steer) && vehicle.speed > 0.1) {
          const current = vehicle.location, direction = Number(state.flags.steer);
          outer: for (let lane = 0; lane < ROADS.length; lane++)
            if (lane !== vehicle.lane) {
              let cumulative = 0;
              const points = ROADS[lane];
              for (let i = 0; i < points.length; i++) {
                const a = points[i], b = points[(i + 1) % points.length], len2 = distance2(a, b), t = ((current.x - a.x) * (b.x - a.x) + (current.y - a.y) * (b.y - a.y)) / (len2 * len2);
                if (t >= 0 && t <= 1) {
                  const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, heading = Math.atan2(b.y - a.y, b.x - a.x), turn = Math.atan2(
                    Math.sin(heading - vehicle.heading),
                    Math.cos(heading - vehicle.heading)
                  );
                  if (distance2(current, q) < 0.12 && Math.abs(turn) > 0.4 && Math.abs(turn) < 2.5 && Math.sign(turn) === Math.sign(direction)) {
                    vehicle.lane = lane;
                    vehicle.progress = cumulative + t * len2;
                    state.flags.steer = 0;
                    break outer;
                  }
                }
                cumulative += len2;
              }
            }
        }
      }
      const step = Math.min(vehicle.speed, 6 * weatherEffects(state).speedFactor) * 0.1, len = laneLength(vehicle.lane);
      const blocked = state.vehicles.some(
        (other) => other.id !== vehicle.id && !parkedAt(state, other.id) && other.lane === vehicle.lane && (other.progress - vehicle.progress + len) % len < 2.4 && (other.progress - vehicle.progress + len) % len > 0.01
      );
      const nextProgress = quantize((vehicle.progress + step) % len);
      const position = pointOnLane(vehicle.lane, nextProgress);
      if (blocked || !mayAdvanceVehicle(state, vehicle, position, context)) continue;
      vehicle.progress = nextProgress;
      vehicle.location = { x: quantize(position.x), y: quantize(position.y), scene: "outside" };
      vehicle.heading = position.heading;
      if (vehicle.driverId === "player") {
        state.player.location = { ...vehicle.location };
        state.flags.drivenDistance = quantize(Number(state.flags.drivenDistance ?? 0) + step);
      } else {
        const driver = state.npcs.find((n) => n.id === vehicle.driverId);
        if (!driver?.alive || driver.age < 18) {
          vehicle.driverId = null;
          vehicle.speed = 0;
          continue;
        }
        driver.location = { ...vehicle.location };
      }
    }
  }
  function combat(state) {
    const p = state.player;
    if (p.attackUntil && state.tick >= p.attackUntil && state.flags.attackTarget) {
      const npc = state.npcs.find((item) => item.id === state.flags.attackTarget);
      state.flags.attackTarget = "";
      p.attackUntil = 0;
      if (npc && nearby3(state, npc)) {
        const heavy = state.flags.attackHeavy === true, damage = (heavy ? 24 : 12) + Math.floor(p.skills.combat / 15);
        npc.health = clamp(npc.health - damage);
        npc.goal = "flee";
        npc.path = [];
        adjustRelation(state, npc.id, "player", -25, -10, 20, 20);
        p.reputation = clamp(p.reputation - 6, -100, 100);
        const witnesses = state.npcs.slice(0, 100).filter(
          (person5) => person5.alive && person5.age >= 18 && person5.id !== npc.id && person5.location.scene === npc.location.scene && distance2(person5.location, npc.location) <= 9 && hasLineOfSight(person5.location, npc.location, npc.location.scene)
        ).map((person5) => person5.id);
        const id = `crime:${state.nextId++}`;
        state.crimes.push({
          id,
          offender: "player",
          victim: npc.id,
          witnesses,
          evidence: [`victim:${npc.id}`, ...witnesses.map((witness) => `saw:${witness}`)],
          reported: false,
          status: "unreported",
          tick: state.tick,
          fine: heavy ? 25e3 : 15e3
        });
        emit(
          state,
          "assault",
          `${npc.name} yaraland\u0131. ${witnesses.length ? "Olay\u0131n tan\u0131klar\u0131 var." : "\xC7evrede tan\u0131k g\xF6r\xFCnm\xFCyor."}`,
          ["player", npc.id],
          npc.id,
          "witnessed",
          witnesses
        );
        state.flags.retaliateAt = state.tick + 8;
        state.flags.retaliateNpc = npc.id;
        notify(state, "Kavgan\u0131n sa\u011Fl\u0131k, g\xFCven ve hukuki sonu\xE7lar\u0131 kaydedildi.");
      }
    }
    if (Number(state.flags.retaliateAt ?? 0) === state.tick) {
      const npc = state.npcs.find((item) => item.id === state.flags.retaliateNpc);
      if (npc && npc.health > 0 && nearby3(state, npc) && Number(state.flags.dodgeUntil ?? 0) < state.tick) {
        const blocked = p.blocking && p.stamina >= 6;
        p.health = clamp(p.health - (blocked ? 3 : 11));
        if (blocked) p.stamina -= 6;
      }
    }
    if (p.health <= 0) {
      state.mobility.trip = null;
      p.goal = "recover";
      p.health = 45;
      p.stamina = 50;
      p.location = { ...INTERIOR_SPAWN, scene: "b-clinic" };
      p.shift = null;
      if (p.vehicleId) {
        const vehicle = state.vehicles.find((v) => v.id === p.vehicleId);
        vehicle.driverId = null;
        vehicle.speed = 0;
        p.vehicleId = null;
      }
      stop(state);
      const cost = Math.min(state.accounts.player, 1e4);
      if (cost)
        transfer(
          state,
          `clinic:${state.nextId++}`,
          "player",
          "business:clinic",
          cost,
          "medical-care"
        );
      emit(
        state,
        "medical_recovery",
        "Bayg\u0131nl\u0131k sonras\u0131 klinikte tedavi edildin. Hayat\u0131n devam ediyor.",
        ["player"],
        null,
        "private"
      );
      notify(state, "Klinikte uyand\u0131n. Sa\u011Fl\u0131k ve ge\xE7im deste\u011Fi yollar\u0131 a\xE7\u0131k.");
    }
  }
  function playerMinute(state) {
    const p = state.player;
    if (state.minute % 15 === 0) {
      p.hunger = clamp(p.hunger + 1);
      p.fatigue = clamp(p.fatigue + 1);
      if (p.hunger >= 95) p.health = clamp(p.health - 1);
    }
    if (Number(state.flags.restUntil ?? 0) > state.minute) {
      p.fatigue = clamp(p.fatigue - 2);
      p.health = clamp(p.health + 1);
      p.stamina = 100;
    }
    if (p.shift) {
      const shift = p.shift, business = state.businesses.find((item) => item.id === shift.businessId);
      if (!atBuilding(state, business.buildingId) || p.wanted) {
        p.shift = null;
        notify(
          state,
          "\u0130\u015Fyerinden ayr\u0131ld\u0131\u011F\u0131n veya takibe girdi\u011Fin i\xE7in vardiya iptal oldu; \xFCcret \xF6denmedi."
        );
      } else if (state.minute >= shift.endsAt) {
        if (transfer(
          state,
          `pay:${shift.id}`,
          `business:${business.id}`,
          "player",
          shift.wage,
          "player-payroll"
        )) {
          p.income += shift.wage;
          p.fatigue = clamp(p.fatigue + 12);
          const job = JOBS.find((item) => item.id === p.jobId);
          p.skills[job.skill] = clamp(p.skills[job.skill] + 3);
          state.flags.shiftsCompleted = Number(state.flags.shiftsCompleted ?? 0) + 1;
          adjustRelation(state, business.ownerId, "player", 4);
          emit(
            state,
            "shift_completed",
            `${job.name} vardiyas\u0131 tamamland\u0131; ${(shift.wage / 100).toFixed(0)} TL \xF6dendi.`,
            ["player", business.ownerId],
            business.id,
            "private"
          );
          notify(
            state,
            `Vardiya bitti: +${(shift.wage / 100).toFixed(0)} TL. Beceri ve g\xFCvenin geli\u015Fti.`
          );
        } else {
          business.status = "distressed";
          notify(state, "\u0130\u015Fletmenin nakdi yetmedi. Gecikmi\u015F \xFCcret olay\u0131 kaydedildi.");
          emit(
            state,
            "late_wage",
            "\u0130\u015Fletmenin maa\u015F b\xFCt\xE7esi yetmedi.",
            ["player", business.ownerId],
            business.id
          );
        }
        p.shift = null;
      }
    }
    if (Number(state.flags.trainingUntil ?? 0) > 0) {
      if (!atBuilding(state, String(state.flags.trainingBuilding))) {
        state.flags.trainingUntil = 0;
        notify(state, "Ders mek\xE2n\u0131ndan ayr\u0131ld\u0131n; devam \u015Fart\u0131 sa\u011Flanmad\u0131\u011F\u0131 i\xE7in beceri verilmedi.");
      } else if (state.minute >= Number(state.flags.trainingUntil)) {
        const skill = String(state.flags.trainingSkill);
        p.skills[skill] = clamp(p.skills[skill] + 5);
        state.flags.trainingUntil = 0;
        if (p.skills.academic >= 20) state.flags.certificate = true;
        emit(state, "course_completed", `${skill} dersi tamamland\u0131.`, ["player"], null, "private");
        notify(state, "Ders tamamland\u0131; becerin 5 puan artt\u0131.");
      }
    }
    if (state.minute % 1440 === 0) {
      for (const business of state.businesses)
        if (business.ownerId === "player") {
          const profit = Math.min(
            15e3,
            Math.max(
              0,
              state.accounts[`business:${business.id}`] - business.employees.length * business.wage
            )
          );
          if (profit)
            transfer(
              state,
              `profit:${state.minute}:${business.id}`,
              `business:${business.id}`,
              "player",
              profit,
              "owner-dividend"
            );
        }
    }
  }
  function stepWorld(state, commands = []) {
    const results = commands.map((command) => applyCommand(state, command));
    if (state.progression.retired) return results;
    state.tick++;
    mobilityTick(state);
    movement(state);
    traffic(state);
    npcMovement(state);
    combat(state);
    if (state.tick % TICKS_PER_MINUTE === 0) {
      state.minute++;
      mobilityMinute(state);
      playerMinute(state);
      societyMinute(state);
      lifeMinute(state);
      economyMinute(state);
      missionMinute(state);
    }
    tickJustice(state);
    tickSocial(state);
    reconcileProgression(state);
    return results;
  }
  function advanceMinutes(state, minutes) {
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 5256e3)
      throw new Error("Invalid advance interval");
    for (let tick = 0; tick < minutes * TICKS_PER_MINUTE; tick++) stepWorld(state);
  }
  function projectWorld(state) {
    return {
      economy: economyView(state),
      social: projectSocial(state),
      progression: progressionView(state),
      mobility: mobilityView(state),
      life: lifeView(state),
      tick: state.tick,
      minute: state.minute,
      player: structuredClone(state.player),
      npcs: state.npcs.slice(0, 100).filter((npc) => npc.alive).map((npc) => ({
        ...npc,
        location: { ...npc.location },
        path: [],
        memories: npc.memories.slice(-3),
        skills: { ...npc.skills }
      })),
      vehicles: structuredClone(state.vehicles),
      businesses: structuredClone(state.businesses),
      quests: state.quests.filter((quest) => quest.status === "active" || quest.status === "offered").concat(state.quests.filter((quest) => quest.status === "complete").slice(-5)).map((quest) => ({ ...quest })),
      events: state.events.filter(
        (event2) => event2.visibility === "public" || event2.actors.includes("player") || event2.witnesses.includes("player")
      ).slice(-20).map((event2) => ({ ...event2 })),
      relations: state.relations.filter((edge) => edge.from === "player" || edge.to === "player").map((edge) => ({ ...edge })),
      crimes: state.crimes.filter(
        (crime) => crime.offender === "player" || crime.victim === "player" || crime.witnesses.includes("player") || state.events.some(
          (event2) => event2.visibility === "public" && event2.targetId === crime.id
        )
      ).map((crime) => ({
        ...crime,
        witnesses: [...crime.witnesses],
        evidence: [...crime.evidence]
      })),
      balance: state.accounts.player,
      notices: [...state.notices],
      population: state.npcs.filter((n) => n.alive).length,
      simMs: 0
    };
  }
  function validateState(state, options = {}) {
    try {
      const errors = [];
      if (!state || state.schemaVersion !== SCHEMA_VERSION || state.engineVersion !== ENGINE_VERSION)
        return ["unsupported-world-version"];
      if (!Number.isSafeInteger(state.seed) || state.seed < 0 || !Number.isSafeInteger(state.nextId) || state.nextId < 1)
        errors.push("invalid-world-sequence");
      if (!Number.isSafeInteger(state.tick) || state.tick < 0 || !Number.isSafeInteger(state.minute) || state.minute !== 480 + Math.floor(state.tick / 10))
        errors.push("invalid-clock");
      const basePopulation = options.allowBenchmark && state.flags.benchmarkPopulation === 1e4 ? 1e4 : 1100;
      if (state.flags.benchmarkPopulation && !options.allowBenchmark)
        errors.push("benchmark-world-disabled-in-production");
      if (state.npcs.length < basePopulation || state.npcs.length > basePopulation + 24 || state.npcs.filter((npc) => npc.local).length !== 100)
        errors.push("invalid-population");
      if (state.npcs.some(
        (npc, index) => index < basePopulation ? npc.id !== `n${index}` || npc.local !== index < 100 : !/^born:/.test(npc.id) || npc.local
      ) || state.player.id !== "player")
        errors.push("invalid-person-index");
      for (const [key3, value] of Object.entries(state.flags)) {
        if (!["string", "number", "boolean"].includes(typeof value) || typeof value === "number" && !Number.isFinite(value))
          errors.push(`invalid-flag:${key3}`);
        if (/^tx(?:set|exact):/.test(key3) && !validTransactionBits(value))
          errors.push(`invalid-transaction-index:${key3}`);
      }
      if (Number(state.flags.trainingUntil ?? 0) > 0 && ![
        "academic",
        "driving",
        "combat",
        "communication",
        "technical",
        "trade",
        "body",
        "discipline"
      ].includes(String(state.flags.trainingSkill)))
        errors.push("invalid-training-skill");
      errors.push(...profileErrors(state.player.profile).map((error) => `profile:${error}`));
      const ids = /* @__PURE__ */ new Set(), householdIds = new Set(state.households.map((h) => h.id));
      for (const person5 of [state.player, ...state.npcs]) {
        if (ids.has(person5.id)) errors.push(`duplicate-person:${person5.id}`);
        ids.add(person5.id);
        if (!isWalkable(person5.location, person5.location.scene))
          errors.push(`invalid-location:${person5.id}`);
        if (!Array.isArray(person5.path) || person5.path.some((point) => !isWalkable(point, person5.location.scene)))
          errors.push(`invalid-path:${person5.id}`);
        if (![person5.health, person5.stamina, person5.hunger, person5.fatigue].every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 100
        ))
          errors.push(`invalid-needs:${person5.id}`);
        if (!Object.values(person5.skills).every(
          (value) => Number.isFinite(value) && value >= 0 && value <= 100
        ))
          errors.push(`invalid-skills:${person5.id}`);
        if (!Number.isSafeInteger(person5.debt) || person5.debt < 0)
          errors.push(`invalid-debt:${person5.id}`);
        if (!Number.isInteger(person5.age) || person5.age < 0 || person5.age > 130 || typeof person5.alive !== "boolean")
          errors.push(`invalid-life-stage:${person5.id}`);
        if ((!person5.alive || person5.age < 18) && (person5.jobId || person5.employerId))
          errors.push(`invalid-adult-employment:${person5.id}`);
        if (person5.alive && !householdIds.has(person5.householdId))
          errors.push(`missing-household:${person5.id}`);
        if (!(person5.id in state.accounts)) errors.push(`missing-person-account:${person5.id}`);
        if (person5.employerId && !state.businesses.some(
          (business) => business.id === person5.employerId && business.employees.includes(person5.id)
        ))
          errors.push(`employment-link:${person5.id}`);
        if (person5.jobId && !JOBS.some((job) => job.id === person5.jobId && job.businessId === person5.employerId))
          errors.push(`job-reference:${person5.id}`);
      }
      for (const household3 of state.households) {
        if (household3.members.length > 4 || new Set(household3.members).size !== household3.members.length)
          errors.push(`housing-capacity:${household3.id}`);
        for (const id of household3.members) {
          const person5 = id === "player" ? state.player : state.npcs.find((n) => n.id === id);
          if (!person5 || !person5.alive || person5.householdId !== household3.id || person5.homeId !== household3.homeId)
            errors.push(`household-link:${id}`);
        }
      }
      for (const business of state.businesses) {
        const owner = business.ownerId === "player" ? state.player : state.npcs.find((n) => n.id === business.ownerId);
        if (!owner?.alive || owner.age < 18 || !owner.propertyIds.includes(business.id))
          errors.push(`business-ownership:${business.id}`);
        if (!ids.has(business.ownerId) || !BUILDINGS.some((building) => building.id === business.buildingId))
          errors.push(`business-reference:${business.id}`);
        if (Object.values(business.stock).some((value) => !Number.isSafeInteger(value) || value < 0))
          errors.push(`negative-stock:${business.id}`);
        if (new Set(business.employees).size !== business.employees.length)
          errors.push(`duplicate-employee:${business.id}`);
        for (const employee of business.employees) {
          const person5 = employee === "player" ? state.player : state.npcs.find((n) => n.id === employee);
          if (!ids.has(employee) || person5?.employerId !== business.id)
            errors.push(`unknown-employee:${employee}`);
        }
      }
      for (const [item, amount2] of Object.entries(state.player.inventory))
        if (!Number.isSafeInteger(amount2) || amount2 <= 0 || !Object.hasOwn(ITEMS, item) && !item.startsWith("parcel:"))
          errors.push(`invalid-inventory:${item}`);
      const eventIds = new Set(state.events.map((event2) => event2.id));
      if (eventIds.size !== state.events.length || state.eventCount !== state.events.length)
        errors.push("event-journal");
      for (const event2 of state.events) {
        if (!event2.actors.every((id) => ids.has(id)) || !event2.witnesses.every((id) => ids.has(id)))
          errors.push(`event-reference:${event2.id}`);
        if (event2.causeId && !eventIds.has(event2.causeId)) errors.push(`missing-cause:${event2.id}`);
      }
      for (const edge of state.relations)
        if (!ids.has(edge.from) || !ids.has(edge.to) || ![edge.trust, edge.affection, edge.fear, edge.resentment].every(
          (value) => Number.isFinite(value) && value >= -100 && value <= 100
        ))
          errors.push(`invalid-relation:${edge.from}:${edge.to}`);
      for (const quest of state.quests) {
        if (!["offered", "active", "complete", "failed", "expired"].includes(quest.status))
          errors.push(`quest-status:${quest.id}`);
        if (!ids.has(quest.issuerId) || !ids.has(quest.targetId) || !eventIds.has(quest.sourceEvent) || !BUILDINGS.some((building) => building.id === quest.buildingId))
          errors.push(`quest-reference:${quest.id}`);
        const expectedEscrow = quest.status === "active" || quest.status === "offered" ? quest.reward : 0;
        if (state.accounts[`escrow:${quest.id}`] !== expectedEscrow)
          errors.push(`quest-funding:${quest.id}`);
      }
      for (const vehicle of state.vehicles) {
        const expected = pointOnLane(vehicle.lane, vehicle.progress);
        if (!parkedAt(state, vehicle.id) && distance2(expected, vehicle.location) > 2e-3 || vehicle.lane < 0 || vehicle.lane >= ROADS.length || vehicle.speed < 0 || vehicle.speed > 6 || !Number.isFinite(vehicle.heading) || !isWalkable(vehicle.location))
          errors.push(`invalid-vehicle:${vehicle.id}`);
        if (vehicle.driverId === "player" && (state.player.vehicleId !== vehicle.id || distance2(state.player.location, vehicle.location) > 1e-3))
          errors.push(`vehicle-player:${vehicle.id}`);
        if (vehicle.driverId && !ids.has(vehicle.driverId))
          errors.push(`unknown-driver:${vehicle.id}`);
      }
      if (state.player.vehicleId && !state.vehicles.some(
        (vehicle) => vehicle.id === state.player.vehicleId && vehicle.driverId === "player"
      ))
        errors.push("player-vehicle-reference");
      for (const crime of state.crimes) {
        if (!ids.has(crime.offender) || !ids.has(crime.victim) || !crime.witnesses.every((id) => ids.has(id)) || !["unreported", "investigating", "pursuit", "resolved"].includes(crime.status) || !Number.isSafeInteger(crime.fine) || crime.fine < 0)
          errors.push(`invalid-crime:${crime.id}`);
      }
      if (state.player.debt !== Number(state.flags.loanAsset ?? 0)) errors.push("player-loan-asset");
      errors.push(
        ...reconcile(state),
        ...validateLife(state),
        ...validateMobility(state),
        ...validateSocial(state),
        ...validateProgression(state),
        ...validateEconomy(state),
        ...validateMissionReservations(state)
      );
      return errors;
    } catch (error) {
      return [`malformed-world:${error instanceof Error ? error.message : "unknown"}`];
    }
  }
  return __toCommonJS(engine_exports);
})();
