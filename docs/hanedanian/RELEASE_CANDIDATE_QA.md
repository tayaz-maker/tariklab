# HANEDANIAN / İHTİLAL release candidate — 2026-09-19

**Historical implementation receipt; see the release-candidate continuation below.
Merge requires the selected SHA’s acceptance jobs to pass.** The attached mandate
requires real browser, mobile, offline reload and production checks. Automated
fixtures and successful deployment builds do not satisfy those requirements.

## Provenance and publication

| Item | Evidence |
| --- | --- |
| User-supplied starting reference | `e091644e70f5d257adb96591d0690d065416b701` |
| Verified canonical main / production baseline | `9e747ebf6de55cfb0eb526d0c56b63e4320259cf` |
| Canonical web repository | `tayaz-maker/tariklab`, renamed from `cete-savaslari` |
| Native repository | `tayaz-maker/tariklab-app`; paused, unchanged |
| Branch | `astra/hanedanian-ihtilal-upgrade` |
| Tested implementation commit on GitHub | `3801fca832f64de45e455cc0cf0d76637cfa3ad2` |
| Tested implementation tree | `a8acb5cd3800403e9146b356a3ae590c36fe4947` |
| Preview deployment | `dpl_5p5FYSdd7msQo5TaeSXksPrk8wfB`, Vercel `READY` |
| Preview | https://cete-savaslari-n0dnttixm-cete-d532.vercel.app |
| Existing production | https://www.tariklab.com and https://tariklab-six.vercel.app |
| Existing production deployment | `dpl_H1keGtCHASPveniexaSMAU1GyYHB`, still baseline SHA |

Eight focused implementation commits were published through the connected GitHub
API because native HTTPS push had no credentials. The fetched remote tree is
identical to the tested local tree. Subsequent receipts and the responsive
harness target correction do not change the tested runtime. Production was
not updated by this work.

## What changed

- New original strategy runtime: seeded 49×49 world, nine terrain types,
  strategic points, eight AI dynasties, resource production/storage/upkeep,
  building and recruitment queues, expansion, distance/terrain travel, combat,
  dated scout intelligence, trade, diplomacy, dynasty choices and three victory
  paths. Default paused; 1×/4×/12×; hidden/closed play does not accrue attacks.
- Canvas map workspace with viewport culling, zoom levels, anchored pinch and
  wheel zoom, pointer pan, drag/tap separation, keyboard navigation, selection,
  minimap, settlement/army/point markers and mobile selection sheets. These
  interaction implementations pass fixture tests; actual touch/layout remains
  unverified.
- IndexedDB automatic/previous/manual archives, transactional rotation,
  checksummed and validated exports/imports, interrupted-session journal,
  corruption recovery, cross-tab stale-write protection and visible failures.
- Dedicated content-versioned game service worker installs a complete local
  package and retains the old package if an update fails. Readiness is reported
  only after the worker confirms cached files. The portal's existing worker and
  module fallback policy are retained.
- Canonical title/route is HANEDANIAN at `/oyna/hanedanian`.
  `/oyna/hanedan` remains compatible. Original HANEDAN is preserved byte-for-byte
  at `/games/hanedan/legacy.html` with its old keys; legacy saves are not converted
  into the unrelated new world model. The new UI links to legacy play/export.
- İHTİLAL now explains role, 10-Hüküm objective, resource purposes, legal first
  move, target/cost/effect and resulting changes. It has engine-derived previews,
  clear win/loss comparison, persistent human/AI feedback, delayed-file timing
  and automatic continuation in addition to the existing three manual slots.
- İHTİLAL engine opens a counter window only when a legal counter exists and
  checks terminal victory after passing a counter. The same 50-seed exercise
  went from 419 windows (350 empty) to 69 windows (zero empty), removing 351
  interactions. The user's explicit engine-replacement permission is recorded;
  these measured defects justified engine changes without discarding the core.
- Previous post-launch fixes remain included. Other games' rules, shared duel
  engine and native/content repositories were not changed. No dependency added.

## Executed checks

| Check | Result and scope |
| --- | --- |
| Full `npm test` | **1,415 passed, 0 failed, 1 skipped**: JS 1,365/1,366; TS 50/50. JS duration ~224 seconds. |
| Skipped test | Existing opt-in `DARBE_H_CLOSURE=1` 3,000-match matrix. Regular sibling balance regressions ran. |
| `npm run typecheck` | Passed |
| `npm run lint` | 0 errors, 50 existing warnings; no warning suppression |
| `NITRO_PRESET=vercel npm run build` | Passed; Vercel static/function output generated |
| Vercel preview build | `READY` at the tested GitHub implementation SHA |
| GitHub Vercel status | `success` |
| GitHub Workers Builds check | `failure`; also fails on baseline main. No diagnostic annotations returned. Separate integration issue, not a green CI claim. |
| Core / saves / map fixtures | 18 / 19 / 9 passed |
| Actual app adapter with controlled DOM/map/storage | 10 passed; **not browser execution** |
| Offline worker / build plugin fixtures | 12 / 3 passed; **not a real offline reload** |
| İHTİLAL tests | 43 passed, including 1,296-match matrix and real-engine UI fixtures |
| İHTİLAL matrix | 608/656 seat wins, 32 draws; median 10 turns, p95 25 |

The save fixtures exercise transaction failures, corrupted data, checksums,
future schema rejection, stale saves and recovery. The map fixtures exercise
coordinates, input cancellation, anchored zoom, drag suppression, culling and
state replacement. The app fixtures exercise actual engine commands and error
feedback. These are specific evidence, not substitutes for device usability.

The baseline Actions run `35444408457` passed its compile/build and duel-browser
steps but failed two `/ihtilal` responsive checks. The harness selected an iframe
only from the original `/oyna/` URL; after `/ihtilal` redirected, it measured the
outer portal instead. This candidate waits for that redirect and chooses the
game surface from the resulting URL, keeping all nonempty/overflow/duplicate-ID
assertions. Syntax validation passed; a fresh Actions/browser result is still
required. The unrelated Cloudflare failure has no confirmed root cause.

## Blocked real-world checks

The supported cloud browser repeatedly failed with `CDP operation refresh tabs
timed out after 20000ms` and recovery-superseded errors. A final retry created a
tab, but opening the deployed preview and querying its URL failed. No page was
successfully inspected; no screenshot, mobile interaction or offline reload is
claimed. The local Vite server separately failed during environment interface
enumeration (`uv_interface_addresses`, system error 1).

Preview build readiness was confirmed through Vercel. Public HTTP requested the
preview game path and returned 302; the connected Vercel protected-fetch action
returned `Failed to check deployment: 403 Forbidden`. Deployed runtime bytes
therefore have not been verified. Deployment protection was not changed.

Still required before acceptance:

1. Desktop 1280×720 and 1920×1080: launch through the portal, map workspace,
   zoom/selection/keyboard, economy, expansion, travel/scout/report, save/load,
   console and overflow checks; inspect screenshots.
2. Real mobile/touch at 360px for **20+ minutes**: pinch/pan without page scroll,
   tap versus drag, map edges, selection sheet, menus, keyboard, safe areas,
   settlement/trade/army actions and browser Back.
3. Real IndexedDB/service-worker sequence: online launch → wait for package
   readiness → save → network off → reload → continue/play/save → reload again
   → reconnect. Test failed/updated cache, corrupt import, recovery and legacy
   save access without touching non-test player data.
4. İHTİLAL fresh first minute and first five minutes in TR/EN: who/goal/next
   action/reason/result are visible; play a legal move and counter, finish,
   resume and save/load, including mobile and offline shell reload.
5. Address campaign pacing and check all victory paths with actual play.
6. Only after the candidate passes, integrate latest main, deploy production,
   and repeat production route/mobile/offline checks on the released SHA.

## Remaining product limits

- **10–20 hours of meaningful progression is not delivered or established.**
  A bot using legal commands reached one wealth victory after 5,430 game minutes:
  approximately 90.5 real minutes at 1× or 7.5 at 12×, excluding decisions and
  pauses. This exposes a campaign pacing gap; simply adding idle waits would
  not meet the meaningful-progression requirement. Other victory-path durations
  and human difficulty have not been measured.
  Probe seed: `TL-LEGAL-CAMPAIGN`, default world/AI, auto-pause off, decisions
  every 30 game minutes. It builds farm/lumber/quarry/mine to 4, warehouse to 4,
  hall to 3 and market to 2; expands to five nearby legal settlements and trades
  150 food between its towns when storage permits. No resources, troops or XP
  are injected. End state: five towns, trade volume 20,038.09, stored wealth
  49,865.15, influence 401, successful victory command and valid state.
- Travel samples terrain along a direct corridor; no shortest-path road routing.
- Founding capitals are protected from capture and recover; this is not a full
  conquest/elimination or generational succession simulation. Heir choices are
  present, but complete dynasty succession is not.
- HANEDANIAN runtime is Turkish; portal/catalog and İHTİLAL are bilingual.
- Legacy campaigns remain in the legacy game. New saves are schema V1, with
  strict format/version handling; there is no invented old-world conversion.
- Browser storage is per origin/device. Moving between the preview and the
  production domain requires explicit export/import; it is not cloud sync.
- PWA installation, mobile frame rate, accessibility and visual polish have not
  been validated on real devices. No 60-FPS or flawless-mobile claim is made.

This document is a handoff of reviewable code and measured evidence, not a
production completion certificate.

## Release-candidate continuation — pacing and real Chromium

Continuation starts at `9a5b2550a96438e4efe306c7335e887bbd3fb123`, on the same
branch and Draft PR #33. Main was rechecked and remains
`9e747ebf6de55cfb0eb526d0c56b63e4320259cf`. Earlier fixture-only limitations above
are historical; current evidence is produced by the dedicated jobs in `ci.yml`.

- `CAMPAIGN_BALANCE_REPORT.json`: 60/60 route completions, 60/60 adversarial
  no-victory policies. Stockpile/circular trade cannot bypass regional development.
- Local full regression: 1,421 passes, one pre-existing opt-in skip; typecheck and
  Vercel production build pass. Lint has zero errors and 50 existing warnings.
- Real Chromium: desktop 1280×720 and 1920×1080, touch 360×800. Launch, rendered
  map, wheel/pinch, pan without accidental selection, edge selection, queue, scout,
  army/claim, actual new settlement, reports, save/reload and mobile Back passed.
  Screenshots reviewed; no uncaught errors or horizontal overflow.
- İHTİLAL: role/objective/action within 15 seconds; cost/effect and persistent
  outcome within one minute; legal repeated decisions through a completed match
  on both viewports. No additional gameplay redesign justified.
- Dedicated job also gates actual service-worker/IndexedDB offline reload,
  mutation/save/reload, reconnect, manual archive, corrupted-auto previous-archive
  recovery, valid/invalid import, and a 20-minute touch soak with repeated reloads.
  **Use the selected SHA’s completed job result; pending execution is not a pass.**
- On main, `campaign-production.mjs` requires SHA-256 equality of the deployed
  game sources before driving both games in real Chromium. No deployment or
  production success is inferred from a local build.

Evidence: PR #33 / GitHub Actions artifacts `campaign-browser`, `campaign-balance`,
`duel-responsive`, `sitewide-responsive`. Production URL: https://www.tariklab.com.

Limits: 1× completion measurements exclude player thinking/pauses; 12× equivalents
are 1/12, not a claimed 10–20-hour human study. Political maximum is 20.9h. Touch
QA is Chromium device emulation, not a physical iPhone/Safari hardware test.
