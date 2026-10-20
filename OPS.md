# OPS — tariklab.com

## Git

`main` force-push kilitli tutulacak. Geçmişi ezme; revert veya ileri commit.

## Production deploy — Cloudflare Workers

Canonical production is the existing Cloudflare Worker `tariklab`:
`https://tariklab.tayaz29.workers.dev/`.

Use Cloudflare Workers Builds with the GitHub repository
`tayaz-maker/tariklab`, production branch `main`.

Build settings (existing integration; do not create a second Worker):
- Build command: `npm run build`
- Production deploy command: `npm run deploy:cloudflare`
- Non-production version command: `npx wrangler versions upload`
- Root: `/`; production branch: `main`; Worker: `tariklab`
- Wrangler is pinned in package-lock.json. Nitro merges root `wrangler.json`
  and emits `.output/server/wrangler.json` plus `.wrangler/deploy/config.json`.
  SSR and API use the Worker; `.output/public` uses the ASSETS binding.
- `deploy:cloudflare` checks current main and the newest exact-SHA main `ci`
  and `tc-job-start-outcome` runs. Missing/pending/failing checks stop publication.
  Retry the main build once after CI succeeds; there is no polling loop.
- Branch builds upload isolated candidate versions and never publish production.
- Run the **Cloudflare production acceptance** GitHub workflow after publishing,
  supplying the exact main SHA. Both www and workers.dev must pass exact game
  hashes, real TR/EN/PL mobile/desktop crew, police, region and portal reload cases.

Cloudflare Workers Builds manages the existing build token through Wrangler.
Do not read it into application code or require `CLOUDFLARE_API_TOKEN` in a
custom HTTP client; the managed authentication is not necessarily an env var.
No additional GitHub Actions Cloudflare secret is required for this pipeline.

Runtime secrets already exist: `BETTER_AUTH_SECRET` and `DATABASE_URL`.
`keep_vars: true` preserves dashboard variables. Secrets remain encrypted.
`nodejs_compat` supports the existing Postgres/Better Auth server code. The
legacy database migration only runs when a build DATABASE_URL is supplied;
Workers Builds currently has none. Do not copy production DB credentials into
PR builds or introduce schema changes as part of hosting migration.

Supabase game auth uses the existing public URL/key in `src/lib/supabase.ts`.
The key is publishable, not a service role. Preserve `cete-sb-auth`, PKCE and
origin-local game saves. Callback/reset URLs must use www.tariklab.com (and
workers.dev for that host's flow), never a Vercel deployment. Existing Supabase
project/SMTP settings must be audited in its dashboard separately when access
is available; anonymous health checks do not prove a real email sign-in.

DNS/TLS target: existing Worker custom domain `www.tariklab.com`, plus
`tariklab.tayaz29.workers.dev`; apex redirects to www. Preserve mail/MX/TXT.
Do not detach legacy Vercel domains until CI and both real production hosts
pass. Project deletion and domain registration transfer require owner approval.

Vercel inventory: no direct @vercel package, Vercel workflow, or VERCEL_ runtime
variable is required. Nitro retains its transitive optional provider adapters;
template PWA helpers reject Vercel system hosts and retain compatibility code.
The Grok auth broker is an external upstream; its internal hosting is outside
this repository. The committed `vercel.json` disables Git deployments for all branches containing
that config. Disconnect the external Vercel Git integration after production
acceptance to also stop triggers from older branches; a
quota failure is not an application CI pass. Preserve the project for rollback
until the owner separately approves deletion.

## Cloudflare WAF

`/api/auth/*` için IP başına 10 istek / 60 sn (Better Auth + sunucu Map ile
aynı tavan). Cloudflare’de rate-limit kuralı:

- Eşleşme: `http.request.uri.path` starts with `/api/auth/`
- Eşik: 10 istek / dakika / IP
- Aşım: 429

## Plausible

`tariklab.com` için Plausible proje aç, snippet’i site head’ine ekle
(`window.plausible`). DSN/key kodda yok; `track()` varsa Plausible’a
iletmekle yetinir. Olaylar: `yas_onay`, `karakter_olusturuldu`,
`ilk_is_yapildi`, `hesap_acildi`, `sezon_tamamlandi`, `liderlik_goruldu`.

## Neon / migration

`npm run build` içinde `scripts/migrate.mjs` çalışır. `DATABASE_URL` yoksa
atlanır. Sıkı ortamda `GROK_STRICT_MIGRATE=1` ile URL yoksa exit 1.
Uygulanan dosyalar `_migrations` tablosunda. Şema kırmayan ek kolon +
varsayılan.

## SMTP

`noreply@tariklab.com` için domain DNS + Resend + Supabase SMTP panelde.
Kod gizli anahtar taşımaz.
