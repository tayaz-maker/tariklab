# Non-negotiable acceptance and release gates

- All P0 and P1 bugs closed; issue register records repro, cause, fix, tests, screenshot/video and retest. P0: crashes, corrupted saves, softlocks, old-game regression. P1: sideways cars, synchronized NPC packs, invalid routes/collisions, unusable combat/vehicles, nonfunctional UI, wrong game title or wrong DARAMCIK district display name, mission loops, serious perf failures.
- All visible controls and promised features work. No fake buttons, placeholder screens or unverifiable claims.
- 365-day deterministic simulation, save/load/migration, 2-hour soak, Firefox latency regression, low-end hardware and two human playtests verified. Missing evidence is not PASS.
- Browser E2E on Chromium, Firefox, WebKit; visual captures for walking, vehicles, NPC crowds, work, missions, interiors, police and combat.
- Measured 60 FPS desktop target, 30 FPS low-end floor, p95 frame time, 1% low, memory, sim tick time, compressed bundle size. Record hardware, seeds and actual results.
- Full repo CI and TC SIM, Boardworld, Racon Manager regressions pass. Other Astra's work untouched.
- Branch isolation, non-destructive integration, and automatic merge/deploy ONLY after all mandatory gates pass and competing agent production operations are safely serialized. User has explicitly authorized this release; no additional approval required when safe.
- Production means actual `https://www.tariklab.com/oyna/social-engine` live with verified Cloudflare deployment ID, SHA and real browser smoke test. Localhost is not production.
- Status `READY_TO_RELEASE` if gates pass but a concurrent release must finish first; `GOLD_BLOCKED` if criteria fail; `BLOCKED` if tool/auth access stops release; `RELEASE_VERIFIED` only after live evidence.

- Discover and use the existing authorized Cloudflare deploy hook; do not invent a URL or leak credentials. Verify build, active deployment, production traffic, deployed SHA, and real gameplay at the public URL.
- Player-visible game title SOCIAL ENGINE, district DARAMCIK; legacy save IDs may remain internal with migration/alias tests.
