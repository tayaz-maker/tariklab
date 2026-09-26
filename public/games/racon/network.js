/* Racon Manager — mahalle ağı: sokak kararları ve harita sinyalleri.
   Saf kurallar; DOM yok. index.html bunları S (oyun durumu) ve küçük bir
   api nesnesiyle çağırır. Harita bir şemadır: gerçek konum, sokak geometrisi
   veya üçüncü taraf harita çizimi kullanılmaz. */
(function (w) {
  "use strict";

  var clamp = function (v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  };
  var num = function (v, d) {
    return typeof v === "number" && isFinite(v) ? v : d;
  };

  /* Dört karar. Her birinin şimdi, her hafta ve sonunda ayrı etkisi var. */
  var ORDERS = {
    koru: {
      ad: "Koru",
      niyet:
        "Sokağa adam dik. Rakip bu sokağa randevu veremez; mahalle düzen görür, karakol da görür.",
      cost: 2500,
      weeks: 3,
      now: { sadakat: 3 },
      weekly: { heat: 2, teror: -3 },
      end: { dosya: 2 },
      komsuWeekly: { heat: 1 },
      needs: "sen",
    },
    yatirim: {
      ad: "Yatırım",
      niyet:
        "Esnafa sermaye koy. Dört hafta hiçbir şey görünmez; sonra sokak kalıcı olarak gelir getirir ve daha yavaş ısınır.",
      cost: 5000,
      weeks: 4,
      now: { heat: -2 },
      weekly: {},
      end: { sadakat: 10, yatirim: 1 },
      komsuEnd: { sadakat: 2 },
      needs: "senVeyaBos",
    },
    cekil: {
      ad: "Çekil",
      niyet:
        "Sokağı bırak. Baskı hemen düşer, dosya iki hafta sonra hafifler; ama sokak boşalır ve komşular sende olan bir kalenin eksildiğini görür.",
      cost: 0,
      weeks: 2,
      now: { heat: -8, teror: -6, sadakat: -5, saygi: -1, sahip: "bos" },
      weekly: {},
      end: { dosya: -3 },
      komsuNow: { heat: -2 },
      needs: "senEvDegil",
    },
    iliski: {
      ad: "İlişki kur",
      niyet:
        "Esnafla, kahveyle, kapıyla konuş. Yavaş ama kalıcı: sadakat birikir, rakip boş sokağa kolay giremez.",
      cost: 800,
      weeks: 3,
      now: { esnaf: 6 },
      weekly: { sadakat: 2, dokun: 1 },
      end: { favor: 1 },
      komsuEnd: { sadakat: 2 },
      needs: "herhangi",
    },
  };
  var KIND = ["koru", "yatirim", "cekil", "iliski"];
  var YATIRIM_GELIR = 600;
  var YATIRIM_MAX = 2;

  function streetBy(S, id) {
    return (S.streets || []).filter(function (s) {
      return s.id === id;
    })[0];
  }
  function komsular(S, st) {
    return (st.komsular || [])
      .map(function (id) {
        return streetBy(S, id);
      })
      .filter(Boolean);
  }

  function normalize(raw) {
    var ag = raw && typeof raw === "object" ? raw : {};
    var orders = Array.isArray(ag.orders) ? ag.orders : [];
    var seen = new Set();
    var clean = {
      orders: orders
        .slice(0, 24)
        .filter(function (o) {
          if (
            !o ||
            typeof o.street !== "string" ||
            !/^st_[a-z0-9_]{1,48}$/.test(o.street) ||
            KIND.indexOf(o.kind) < 0 ||
            !Number.isInteger(o.left) ||
            o.left < 1 ||
            o.left > ORDERS[o.kind].weeks ||
            seen.has(o.street)
          )
            return false;
          seen.add(o.street);
          return true;
        })
        .map(function (o) {
          return {
            street: o.street,
            kind: o.kind,
            from: clamp(Math.floor(num(o.from, 1)), 1, 100000),
            left: o.left,
            ...(typeof o.target === "string" && /^st_[a-z0-9_]{1,48}$/.test(o.target)
              ? { target: o.target }
              : {}),
          };
        })
        .slice(0, 4),
      log: Array.isArray(ag.log)
        ? ag.log
            .slice(-12)
            .filter(function (x) {
              return x && typeof x.text === "string";
            })
            .map(function (x) {
              return { week: num(x.week, 1), text: x.text.slice(0, 320) };
            })
        : [],
    };
    if (ag.flow && ag.flow.version === 1) clean.flow = normalizeFlow(ag.flow);
    return clean;
  }

  function ensure(S) {
    S.ag = normalize(S.ag);
    var ids = new Set(
      (S.streets || []).map(function (s) {
        return s.id;
      }),
    );
    S.ag.orders = S.ag.orders.filter(function (o) {
      return ids.has(o.street);
    });
    if (S.ag.flow)
      S.ag.flow.queue = S.ag.flow.queue.filter(function (p) {
        var st = streetBy(S, p.from);
        return ids.has(p.to) && st && (st.komsular || []).indexOf(p.to) >= 0;
      });
    return S.ag;
  }

  function capacity(S) {
    var live = (S.men || []).filter(function (m) {
      return m.durum !== "olu" && m.durum !== "hapis";
    }).length;
    return live >= 5 ? 3 : 2;
  }

  function active(S, streetId) {
    return (
      normalize(S.ag).orders.filter(function (o) {
        return o.street === streetId;
      })[0] || null
    );
  }

  function reason(S, streetId, kind, target) {
    var st = streetBy(S, streetId);
    var o = KIND.indexOf(kind) >= 0 ? ORDERS[kind] : null;
    if (!st || !o) return "Böyle bir karar yok.";
    if (S.flags && S.flags.oyunSonu) return "Defter kapandı.";
    if (active(S, streetId)) return "Bu sokakta süren bir karar var.";
    if (normalize(S.ag).orders.length >= capacity(S))
      return "Ekip aynı anda en fazla " + capacity(S) + " sokak kararı taşır.";
    if (o.needs === "sen" && st.sahip !== "sen") return "Yalnız senin sokağında.";
    if (o.needs === "senVeyaBos" && st.sahip === "rakip") return "Rakip sokağa sermaye girmez.";
    if (o.needs === "senEvDegil" && (st.sahip !== "sen" || st.id === S.streetHome))
      return st.id === S.streetHome
        ? "Ev sokağından çekilinmez."
        : "Yalnız senin sokağından çekilirsin.";
    if (kind === "yatirim" && num(st.yatirim, 0) >= YATIRIM_MAX)
      return "Bu sokağa daha fazla sermaye sığmaz.";
    if (kind !== "cekil" && num(st.muhurLeft, 0) > 0) return "Mühürlü sokakta karar alınmaz.";
    if (target && (!streetBy(S, target) || !(st.komsular || []).includes(target)))
      return "Yalnız bağlı komşuya yön verilebilir.";
    if (target && kind === "koru" && streetBy(S, target)?.sahip !== "sen")
      return "Koru baskısı yalnız kontrolündeki komşuya yayılır.";
    var cost = o.cost + (target ? 250 : 0);
    if (num(S.kasa, 0) < cost) return "Kasada ₺" + cost.toLocaleString("tr-TR") + " gerekli.";
    return "";
  }

  /* Seçimden önce oyuncuya gösterilen tam etki. Zar yok: rakam neyse o. */
  function preview(S, streetId, kind, target) {
    var st = streetBy(S, streetId);
    var o = KIND.indexOf(kind) >= 0 ? ORDERS[kind] : null;
    if (!st || !o) return null;
    var ks = komsular(S, st);
    return {
      kind: kind,
      ad: o.ad,
      niyet: o.niyet,
      cost: o.cost + (target ? 250 : 0),
      weeks: o.weeks,
      now: o.now,
      weekly: o.weekly,
      end: o.end,
      komsu: {
        now: o.komsuNow || null,
        weekly: o.komsuWeekly || null,
        end: o.komsuEnd || null,
        streets:
          kind === "koru"
            ? ks
                .filter(function (k) {
                  return k.sahip === "sen";
                })
                .map(function (k) {
                  return k.ad;
                })
            : ks.map(function (k) {
                return k.ad;
              }),
      },
      extra:
        kind === "koru"
          ? "Süre boyunca rakip bu sokağa randevu veremez."
          : kind === "yatirim"
            ? "Sonunda: sokak sende kaldıkça haftalık ₺" +
              YATIRIM_GELIR.toLocaleString("tr-TR") +
              " ve haftalık ısınma 1 az. Sokak rakibe geçerse yatırım yanar."
            : kind === "cekil"
              ? "Sokak boşalır; rakip iki hafta sonra girebilir."
              : st.sahip === "rakip"
                ? "Sonunda sadakat 60 ve üstündeyse sokak rakipten düşer, boş kalır."
                : st.sahip === "bos"
                  ? "Süre boyunca rakip bu boş sokağa kolay giremez."
                  : "",
      reason: reason(S, streetId, kind, target),
      spread: spreadPlan(S, streetId, kind, target),
    };
  }

  function applyFx(S, st, fx, api) {
    if (!fx) return;
    if (fx.heat) st.heat = clamp(num(st.heat, 0) + fx.heat, 0, 100);
    if (fx.teror) st.terorMahalle = clamp(num(st.terorMahalle, 0) + fx.teror, 0, 100);
    if (fx.sadakat) st.sadakatMahalle = clamp(num(st.sadakatMahalle, 50) + fx.sadakat, 0, 100);
    if (fx.yatirim) st.yatirim = clamp(num(st.yatirim, 0) + fx.yatirim, 0, YATIRIM_MAX);
    if (fx.sahip) st.sahip = fx.sahip;
    if (fx.dosya) {
      if (api && api.filePressure) api.filePressure(fx.dosya, "Sokak kararı · " + st.ad);
      else S.dosya = clamp(num(S.dosya, 0) + fx.dosya, 0, 100);
    }
    if (fx.saygi && api && api.addRep) api.addRep("saygi", fx.saygi);
    if (fx.dokun) {
      S.flags = S.flags || {};
      S.flags.lastTouch = S.flags.lastTouch || {};
      S.flags.lastTouch[st.id] = S.week;
    }
    if (fx.esnaf && api && api.esnafRel) api.esnafRel(st.id, fx.esnaf);
    if (fx.favor && api && api.esnafFavor) api.esnafFavor(st.id, fx.favor);
  }

  function note(S, text) {
    var ag = S.ag || ensure(S);
    ag.log.push({ week: num(S.week, 1), text: text });
    if (ag.log.length > 12) ag.log = ag.log.slice(-12);
  }

  /* Kararı başlat: bedel ve anlık etki şimdi. */
  function start(S, streetId, kind, api, target) {
    if (reason(S, streetId, kind, target)) return false;
    ensure(S);
    flow(S);
    var st = streetBy(S, streetId);
    var o = KIND.indexOf(kind) >= 0 ? ORDERS[kind] : null;
    var cost = o.cost + (target ? 250 : 0);
    if (cost) {
      if (api && api.pay) api.pay(cost, st.ad);
      else S.kasa -= cost;
    }
    applyFx(S, st, o.now, api);
    send(S, { street: streetId, kind: kind, target: target }, "now");
    if (kind === "cekil") {
      S.flags = S.flags || {};
      S.flags.lastTouch = S.flags.lastTouch || {};
      S.flags.lastTouch[st.id] = S.week;
    }
    S.ag.orders.push({
      street: st.id,
      kind: kind,
      from: num(S.week, 1),
      left: o.weeks,
      ...(target ? { target: target } : {}),
    });
    note(S, st.ad + " · " + o.ad + " başladı.");
    return true;
  }

  /* Haftalık kapanış: süren kararlar, kalıcı yatırım geliri ve bitişler. */
  function weekly(S, api) {
    var ag = ensure(S);
    arrive(S, api);
    var done = [];
    ag.orders.forEach(function (ord) {
      var st = streetBy(S, ord.street);
      var o = ORDERS[ord.kind];
      if (!st) {
        ord.left = 0;
        return;
      }
      if (ord.kind === "yatirim" && st.sahip === "rakip") {
        ord.left = 0;
        note(S, st.ad + " · yatırım rakibe gitti, sermaye yandı.");
        return;
      }
      applyFx(S, st, o.weekly, api);
      send(S, ord, "weekly");
      ord.left -= 1;
      if (ord.left <= 0) done.push(ord);
    });
    done.forEach(function (ord) {
      var st = streetBy(S, ord.street);
      var o = ORDERS[ord.kind];
      applyFx(S, st, o.end, api);
      send(S, ord, "end");
      if (ord.kind === "iliski" && st.sahip === "rakip" && num(st.sadakatMahalle, 0) >= 60) {
        st.sahip = "bos";
        note(S, st.ad + " · mahalle rakipten yüz çevirdi; sokak boş.");
      }
      note(S, st.ad + " · " + o.ad + " tamamlandı.");
      if (api && api.inbox) api.inbox(st.ad + ": " + o.ad.toLowerCase() + " tamam.", o.niyet);
    });
    ag.orders = ag.orders.filter(function (o) {
      return o.left > 0;
    });
    var gelir = 0;
    (S.streets || []).forEach(function (st) {
      if (st.sahip === "sen" && num(st.yatirim, 0) > 0) gelir += num(st.yatirim, 0) * YATIRIM_GELIR;
    });
    if (gelir && api && api.income) api.income(gelir);
    return { finished: done.length, gelir: gelir };
  }

  /* Yatırım kalıcı olarak sokağın haftalık ısınmasını azaltır. */
  function heatStep(st) {
    if (st.sahip !== "sen") return st.heat > 0 ? -1 : 0;
    return Math.max(0, 2 - num(st.yatirim, 0));
  }

  function protectedFromRival(S, streetId) {
    var o = active(S, streetId);
    return !!(o && (o.kind === "koru" || o.kind === "iliski"));
  }

  /* Haritada okunan sinyaller. */
  function signals(S, st, extra) {
    extra = extra || {};
    var ks = komsular(S, st);
    var rakipKomsu = ks.filter(function (k) {
      return k.sahip === "rakip";
    }).length;
    var senKomsu = ks.filter(function (k) {
      return k.sahip === "sen";
    }).length;
    var randevu = !!extra.randevu;
    var tehditPuan = clamp(
      Math.round(
        num(st.heat, 0) * 0.5 +
          num(st.terorMahalle, 0) * 0.5 +
          (randevu ? 25 : 0) +
          (st.sahip === "sen" ? rakipKomsu * 8 : 0),
      ),
      0,
      100,
    );
    var tehdit = tehditPuan >= 60 ? "yüksek" : tehditPuan >= 30 ? "orta" : "düşük";
    var firsat = [];
    if (st.sahip === "bos")
      firsat.push(num(extra.touch, 0) >= 2 ? "Tutulabilir · ₺4.500" : "İki iş sonrası tutulabilir");
    if (st.sahip === "rakip" && num(st.sadakatMahalle, 0) >= 45)
      firsat.push("İlişkiyle rakipten düşürülebilir");
    if (st.komsuYumusak) firsat.push("Komşular sende: sokak yumuşak");
    /* Haritada rozet yalnız gerçek fırsat için yanar; yatırım payı ayrıntıda kalır. */
    var rozet =
      firsat.length > 0 && !(st.sahip === "bos" && num(extra.touch, 0) < 2 && firsat.length === 1);
    if (st.sahip !== "rakip" && num(st.yatirim, 0) < YATIRIM_MAX) firsat.push("Yatırıma açık");
    var uyari = [];
    if (randevu) uyari.push("Rakip randevu verdi");
    if (num(st.muhurLeft, 0) > 0) uyari.push("Mühürlü");
    if (st.sivilUyari) uyari.push("Sivil araç");
    if (st.sahip === "sen" && rakipKomsu) uyari.push("Rakip komşu: " + rakipKomsu);
    return {
      kontrol: st.sahip,
      saygi: num(st.saygiPuan, 0),
      sadakat: Math.round(num(st.sadakatMahalle, 50)),
      teror: Math.round(num(st.terorMahalle, 0)),
      heat: Math.round(num(st.heat, 0)),
      yatirim: num(st.yatirim, 0),
      gelir: st.sahip === "sen" ? num(st.yatirim, 0) * YATIRIM_GELIR : 0,
      tehdit: tehdit,
      tehditPuan: tehditPuan,
      firsat: firsat,
      rozet: rozet,
      uyari: uyari,
      senKomsu: senKomsu,
      rakipKomsu: rakipKomsu,
      karar: active(S, st.id),
    };
  }

  /* Komşuluk bağları (tekrarsız) ve bağın durumu. */
  function links(S) {
    var seen = {};
    var out = [];
    (S.streets || []).forEach(function (st) {
      (st.komsular || []).forEach(function (kid) {
        var key = [st.id, kid].sort().join("|");
        var k = streetBy(S, kid);
        if (!k || seen[key]) return;
        seen[key] = 1;
        var a = st.sahip,
          b = k.sahip;
        var kind =
          a === "sen" && b === "sen"
            ? "hat"
            : (a === "sen" && b === "rakip") || (a === "rakip" && b === "sen")
              ? "sinir"
              : "yol";
        out.push({ a: st.id, b: kid, kind: kind });
      });
    });
    return out;
  }

  // Fictional names keep old save IDs stable; these are not geographic coordinates.
  var NAMES = {
    st_fevzi: "Kırık Avlu",
    st_aksem: "Bakır Eşik",
    st_carsamba: "Çift Kandil",
    st_macar: "Kül Merdiven",
    st_draman: "Dilsiz Çatı",
    st_fener: "Son Kepenk",
  };
  var PHASES = { now: "komsuNow", weekly: "komsuWeekly", end: "komsuEnd" };
  function normalizeFlow(raw) {
    var seen = new Set();
    return {
      version: 1,
      seq: clamp(Math.floor(num(raw.seq, 0)), 0, 1000000),
      queue: (Array.isArray(raw.queue) ? raw.queue : [])
        .slice(0, 72)
        .filter(function (p) {
          if (
            !p ||
            !Number.isInteger(p.id) ||
            p.id < 1 ||
            p.id > 1000000 ||
            seen.has(p.id) ||
            KIND.indexOf(p.kind) < 0 ||
            !Object.hasOwn(PHASES, p.phase) ||
            !ORDERS[p.kind][PHASES[p.phase]] ||
            !Object.hasOwn(NAMES, p.from) ||
            !Object.hasOwn(NAMES, p.to) ||
            p.from === p.to ||
            !Number.isInteger(p.left) ||
            p.left < 1 ||
            p.left > 3
          )
            return false;
          seen.add(p.id);
          return true;
        })
        .map(function (p) {
          return {
            id: p.id,
            from: p.from,
            to: p.to,
            kind: p.kind,
            phase: p.phase,
            left: p.left,
            focus: p.focus === true,
          };
        }),
      history: (Array.isArray(raw.history) ? raw.history : [])
        .slice(-12)
        .filter(function (h) {
          return h && typeof h.text === "string";
        })
        .map(function (h) {
          return { week: clamp(Math.floor(num(h.week, 1)), 1, 100000), text: h.text.slice(0, 320) };
        }),
    };
  }
  function flow(S) {
    if (!S.ag.flow) S.ag.flow = normalizeFlow({});
    return S.ag.flow;
  }
  function delay(S, from, to) {
    var a = streetBy(S, from),
      b = streetBy(S, to);
    return a?.sahip === "sen" && b?.sahip === "sen" ? 1 : b?.sahip === "rakip" ? 3 : 2;
  }
  function spreadPlan(S, sid, kind, target) {
    var st = streetBy(S, sid),
      o = ORDERS[kind];
    if (!st || KIND.indexOf(kind) < 0) return [];
    return komsular(S, st)
      .filter(function (k) {
        return (!target || target === k.id) && (kind !== "koru" || k.sahip === "sen");
      })
      .map(function (k) {
        var phase = o.komsuNow ? "now" : o.komsuWeekly ? "weekly" : "end";
        var launch = phase === "now" ? 0 : phase === "weekly" ? 1 : o.weeks;
        return {
          from: sid,
          to: k.id,
          delay: kind === "cekil" ? (k.sahip === "rakip" ? 3 : 2) : delay(S, sid, k.id),
          first: launch + (kind === "cekil" ? (k.sahip === "rakip" ? 3 : 2) : delay(S, sid, k.id)),
          phase: phase,
          focus: !!target,
          fx: waveFx({ kind: kind, phase: phase, focus: !!target }, k),
          repeat: phase === "weekly" ? o.weeks : 1,
        };
      });
  }
  function waveFx(p, receiver) {
    var fx = ORDERS[p.kind][PHASES[p.phase]],
      out = {};
    Object.keys(fx).forEach(function (k) {
      out[k] = fx[k] * (p.focus ? 2 : 1);
    });
    // A strained street hears only half a positive trust signal; never amplify money/favours.
    if (out.sadakat > 0 && receiver.heat >= 60) out.sadakat = Math.floor(out.sadakat / 2);
    return out;
  }
  function send(S, ord, phase) {
    if (!ORDERS[ord.kind][PHASES[phase]]) return;
    var f = flow(S);
    spreadPlan(S, ord.street, ord.kind, ord.target).forEach(function (p) {
      if (f.queue.length >= 72) return;
      f.seq =
        Math.max(
          f.seq,
          ...f.queue.map(function (q) {
            return q.id;
          }),
        ) + 1;
      f.queue.push({
        id: f.seq,
        from: p.from,
        to: p.to,
        kind: ord.kind,
        phase: phase,
        left: p.delay,
        focus: p.focus,
      });
    });
  }
  function arrive(S, api) {
    if (!S.ag.flow) return;
    var f = S.ag.flow,
      due = [],
      totals = new Map();
    f.queue.forEach(function (p) {
      p.left--;
      if (p.left === 0) due.push(p);
    });
    f.queue = f.queue.filter(function (p) {
      return p.left > 0;
    });
    due
      .sort(function (a, b) {
        return a.id - b.id;
      })
      .forEach(function (p) {
        var st = streetBy(S, p.to);
        if (!st) return;
        var fx = waveFx(p, st),
          sum = totals.get(p.to) || {};
        Object.keys(fx).forEach(function (k) {
          sum[k] = (sum[k] || 0) + fx[k];
        });
        totals.set(p.to, sum);
        var text =
          NAMES[p.from] +
          " → " +
          NAMES[p.to] +
          " · " +
          ORDERS[p.kind].ad +
          " · " +
          Object.keys(fx)
            .map(function (k) {
              return (k === "heat" ? "baskı" : "güven") + " " + (fx[k] > 0 ? "+" : "") + fx[k];
            })
            .join(", ") +
          (fx.sadakat && st.heat >= 60 ? " (yüksek baskı: yarım güven)" : "");
        f.history.push({ week: S.week, text: text });
        note(S, text);
      });
    totals.forEach(function (fx, id) {
      applyFx(S, streetBy(S, id), fx, api);
    });
    f.history = f.history.slice(-12);
  }
  // Exact network + passive heat rehearsal, not a claim to predict rival AI or all weekly events.
  function forecast(S) {
    var copy = JSON.parse(JSON.stringify(S)),
      income = 0;
    copy.week++;
    copy.streets.forEach(function (st) {
      st.heat = clamp(st.heat + heatStep(st), 0, 100);
    });
    weekly(copy, {
      income: function (n) {
        income += n;
      },
    });
    return {
      income: income,
      streets: copy.streets.map(function (st) {
        var old = streetBy(S, st.id);
        return {
          id: st.id,
          heat: st.heat,
          trust: st.sadakatMahalle,
          heatDelta: st.heat - old.heat,
          trustDelta: st.sadakatMahalle - old.sadakatMahalle,
        };
      }),
    };
  }

  /* Şema yerleşimi: halka düzeninde 3×2 (geniş) ya da 2×3 (dar). Gerçek konum değil. */
  var LAYOUT = {
    wide: {
      st_fevzi: [0, 0],
      st_aksem: [1, 0],
      st_carsamba: [2, 0],
      st_macar: [2, 1],
      st_draman: [1, 1],
      st_fener: [0, 1],
    },
    narrow: {
      st_fevzi: [0, 0],
      st_aksem: [1, 0],
      st_carsamba: [1, 1],
      st_macar: [1, 2],
      st_draman: [0, 2],
      st_fener: [0, 1],
    },
  };
  function cell(id, mode, index) {
    var map = LAYOUT[mode];
    if (map[id]) return map[id];
    var cols = mode === "wide" ? 3 : 2;
    return [index % cols, Math.floor(index / cols)];
  }

  w.RaconAg = {
    NAMES: NAMES,
    delay: delay,
    spreadPlan: spreadPlan,
    waveFx: waveFx,
    forecast: forecast,
    ORDERS: ORDERS,
    KIND: KIND,
    YATIRIM_GELIR: YATIRIM_GELIR,
    YATIRIM_MAX: YATIRIM_MAX,
    LAYOUT: LAYOUT,
    normalize: normalize,
    ensure: ensure,
    capacity: capacity,
    active: active,
    reason: reason,
    preview: preview,
    start: start,
    weekly: weekly,
    heatStep: heatStep,
    protectedFromRival: protectedFromRival,
    signals: signals,
    links: links,
    cell: cell,
  };
})(typeof window !== "undefined" ? window : globalThis);
