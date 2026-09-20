# Build & deploy target

TarikLab canonical production is **Cloudflare Workers**, not Vercel.

Existing production Worker:

`tariklab`

Canonical Workers endpoint:

`https://tariklab.tayaz29.workers.dev/`

The custom domain `www.tariklab.com` is verified against the same production
release.

## Required deployment path

Prefer **Cloudflare Workers Builds Git integration** for production.

Connect the existing `tariklab` Worker to:

- GitHub repository: `tayaz-maker/tariklab`
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

Workers Builds can generate and manage its own build token. Do not request,
paste, or commit a personal Cloudflare API token when the Git integration is
available.

The Nitro configuration in `vite.config.ts` defaults to
`cloudflare-module` and emits the Wrangler deployment configuration consumed
by `wrangler deploy`. The configured Worker name must remain exactly
`tariklab`; otherwise Cloudflare may reject the build or deploy a second,
unrouted Worker.

`NITRO_PRESET` may be used only when deliberately targeting another host.
Vercel is currently a legacy/non-canonical target and its commit status is not
the Cloudflare production release gate.

## Production verification

A successful build is not enough. After deployment verify:

- `/`
- all live catalog routes
- `/oyna/jitem-derin-ag`
- critical static assets / JS bundles are not HTML fallbacks
- TR/EN behavior
- save/reload
- mobile responsive smoke
- real offline reload where required

Do not claim production PASS until the Cloudflare deployment is serving the
intended canonical SHA.
