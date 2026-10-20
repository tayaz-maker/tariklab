# JITEM canonical production acceptance

Accepted published main: `a4e8b2619dcd508f5e96c7f4e5e4b86736b2f111`; main rechecked unchanged after both hosts completed. CI 39506238480, TC 39506238578 and Workers build `b700400a-fe0d-40d1-802f-6c91ff4df42a` completed successfully for that SHA.

`www.tariklab.com` and `tariklab.tayaz29.workers.dev` each passed all 31 canonical file SHA256 comparisons and six TR/EN/PL×390/1280 real browser cases: fresh campaign/event, budget decision, schema 5 save, locale switching with byte-identical save, and reload/continue. No overflow or browser console/page errors. Canonical upstream remains 006c7e73 and runtime 687d785f05eb69153811815b41e7060b33d96e3d771a37b00047bcc4852e0ee3. Atlas and save format were unchanged.

The original API-request hash transport encountered a network timeout before gameplay. The production-only acceptance copy reads bytes through real Chromium fetch and retains exact hash/status assertions and all gameplay checks. Both hosts then passed. No product or guard changes were made.

Polish uses the documented English standalone fallback beneath the Polish portal shell. Visual inspection confirmed readable mobile/desktop gameplay and the translated decision receipt. One English source-claim record still contains canonical authored Turkish text (`KAYNAK İDDİASI`, `Fiilî oluşum`, `Kanıt: GÜÇLÜ`); authored relationship labels and proper names may also remain Turkish. This receipt does not certify complete authored-story localization. That bounded copy limitation is reported separately from the successful canonical integration/save acceptance.

Durable matrix and byte hashes: [production evidence](evidence/PRODUCTION_2026-10-21.json). Raw receipts and screenshots remain under `work/jitem-production-v2/{www-browser,workers-browser}`. No full Cloudflare workflow was dispatched by this supplemental acceptance.
