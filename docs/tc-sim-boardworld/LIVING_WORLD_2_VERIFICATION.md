# Boardworld Living World 2.0 verification

This wave starts at merged PR261, `2b1ede2be7466348e3933eba26b83a3831241bce`.
It extends the existing engine, expansion, ledgers, history and four navigation areas.
No other game, Social Engine, native runtime or deployment architecture changes.

## Geography and transport

The explicit hierarchy is Türkiye → İstanbul/Ankara/İzmir → 31 districts →
32 neighborhoods → functional locations. İstanbul has the requested 15 districts,
Ankara 8 and İzmir 8. Original Kadıköy, Beşiktaş and Şişli IDs remain unchanged.
The old `ankara:kizilay` area remains a lossless alias for the Kızılay neighborhood
inside Çankaya, including old saves at its center without a venue. Old venue,
property, account and history IDs are retained.

The other neighborhoods are explicitly marked fictional “Oyun Mahallesi” in all
three languages. District administrative names are checked against the
[İstanbul municipal district directory](https://kudeb.ibb.istanbul/ilce-bolge-semasi/),
[Ankara provincial district directory](https://ankara.ktb.gov.tr/TR-152322/ilceler.html),
[İzmir municipal boundary directory](https://www.izmir.bel.tr/tr/buyuksehirsinirharitasi/125/212)
and [Çankaya's neighborhood directory](https://www.cankaya.bel.tr/rehber/muhtarlarimiz/muhtarlarimiz).
Game fares, operating hours, fictional businesses and service levels are simulation rules.

A single route quote supplies player and NPC movement. District graph edges,
local venue access, city hubs and intercity legs compose complete journeys.
Walking cannot cross the Bosphorus or cities. Transit must finish during its
operating window. Route terms, action timing, payment, calendar conflicts and
arrival use the same quote. Gold6 retains its released route semantics.

## Connected authority

District traits affect real firms, employment, prices, housing and services.
Every local wage debits its existing employer, inventory purchases debit supplier
stock, and property leases settle from their signed terms. Regional resident
accounts retain employment, tenure, housing, health, debt, generations, contacts
and bounded activity. Death transfers the existing account and obligations;
limited living credit prevents an unemployed household from accumulating
unbounded new subsistence debt. Work presence uses scheduled work windows;
independent social trips retain paid routes and arrival timestamps. This is a
bounded simulation, not a claim that every commuter is integrated every minute.

Seven organizations retain their existing rosters, treasuries, resources, leaders,
succession, rivalry and legal records. District influence requires funded travel
and finite resources and can decline under competition. The same local economy
and security projection reads that influence. Historical incidents and legal
liabilities remain attributed to the correct person and generation.

The HUD, Life, Career and Finance surfaces read active local contracts. Obsolete
core roommate/lease proposals are suppressed while an expansion home is active;
prior unresolved shared claims remain accessible. Actual home actions use that
home's district and assets. New content supports Turkish, English and Polish,
mobile layout and keyboard navigation.

## Save and load contract

Living World 2 uses an explicit capability marker, dictionary envelope and
`tariklab.boardworld.v7.living-world-2` canonical slot inside the existing global
IndexedDB transaction/generation and Web Lock. Original Gold/v7/living envelopes
and backups remain byte-for-byte preserved. Old active and refreshed cached
clients cannot replace the new canonical slot. Corruption cannot silently load
an older branch. Valid old saves receive deterministic additive domain migration;
loading and pure views never replay old earnings or mutate recorded history.
The expansion remains deferred and binds to the single Gold runtime.

## Verification methods

- `boardworld-lw2-city-browser.mjs`: fresh UI character, actual travel and local
  meal in all 31 districts, paid local job, housing office and lease, public course,
  exact reload, truthful contract HUD, TR/EN/PL mobile and real keyboard activation.
- `boardworld-lw2-simulation-browser.mjs`: fresh UI Ümraniye shift, enterprise,
  stock purchase, customer acquisition and sale. Wage555 and supply552 debit the
  same firm accounts; sale598 and reload are checked. No state injection.
- `boardworld-lw2-generation-browser.mjs`: fresh UI creation, job/income, housing,
  partnership, marriage, adoption, retirement, natural death, adult successor and
  continued play. All mutations use visible controls; state/action inspection is
  read-only. Full traces and screenshots are CI artifacts.
- Root's independent CUA journey: actual Üsküdar job and lease; Kadıköy recruitment,
  three funded depot tasks (+300), day2 promotion, Beşiktaş shipment (+120), day3
  report, day5 hearing and day7 conviction (fine420, compensation120, restriction
  through day37). Natural wait/eat/sleep/story controls; no injected state.
- `boardworld-lw2-simulation.test.mjs`: declared prepared stress scenarios and
  paired 2,160-day/72-simulation-year replay. The opening labor-market shock is
  explicitly a fixture, not natural browser evidence. It checks finite balances,
  employment, estate/debt continuity, bounded contacts/history, paid independent
  trips, organization territory gain/loss and causal adjudication.
- `boardworld-lw2-save.test.mjs` and `boardworld-lw2-legacy-browser.mjs`: frozen PR261
  compatibility, Kızılay center/venue migration, exact original backups, native
  stale writer rejection and refreshed old-client isolation. Prepared save probes
  are distinct from actual play journeys.

All original deterministic, package, translation, browser, stale-tab and recovery
checks remain enabled. Immutable gzip ceilings remain Gold301836, initialTR205874,
expansion96000 and combined400000, counting every emitted forwarder and asset.
Exact-head CI, protected merge, exact-main deployment and both production origins
must be verified before the release is called complete. Historical checkpoints
in older documents retain their original scope.

Final packed runtime checkpoint: `bw-runtime-6b42651257b2f3aa.mjs` and
`expansion-runtime-5e19591005c855ce.mjs`. The package gate passes 3/3:

| Gzip category | Bytes | Unchanged ceiling |
| --- | ---: | ---: |
| Gold | 300161 | 301836 |
| Initial Turkish | 201145 | 205874 |
| Deferred expansion | 79763 | 96000 |
| Combined | 379924 | 400000 |

Integrated changed-domain/flow/save/recovery checks pass 57/57. The preceding full
historical run passed all Gold annual endurance cases and 712/722 overall; its ten
identified outdated migration, geography, UI snapshot and journey expectations
were repaired and their focused assertions rerun. The final full exact-head CI
must pass independently. The packed UI life checkpoint completes 1377 visible
actions and natural day 1501 succession; final CI repeats the entire journey on
its exact production build and verifies successor reload plus unchanged asset hashes.
