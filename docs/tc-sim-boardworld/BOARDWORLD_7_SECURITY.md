# Boardworld 7 Gold dependency and OAuth recovery

The security branch remediates the current npm audit high/critical findings. This
is scoped security verification, not Gold release acceptance or a deployment.
Evidence: `outputs/gold7-recovery/security/` in the release workspace.

## Findings and remediation

Live all-dependency `npm audit --json` on 2026-11-03 reproduced **1 critical,
4 high, 17 moderate, 2 low** package findings. The updated lockfile reports
**0 critical, 0 high, 14 moderate, 0 low**. No audit finding was suppressed.

| Dependency / advisory | Applicability in this app | Remediation |
| --- | --- | --- |
| Better Auth: [Magic Link purpose confusion](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm), critical | Requires Magic Link plus OAuth and shared verification storage. Magic Link is not registered. Generic OAuth is registered when auth is enabled. This is an inactive attack path, not an audit exemption. | Upgrade all Better Auth packages from 1.6.30 to 1.7.15; fixed since 1.7.7. |
| Better Auth: [OAuth Proxy identity forgery](https://github.com/better-auth/better-auth/security/advisories/GHSA-r4xp-prcw-77qf), high | Requires OAuth Proxy with the described shared-secret/cookie-state setup. OAuth Proxy is not registered. | Same upgrade, with actual broker protocol migration. |
| Better Auth: [device approval identity/permissions](https://github.com/better-auth/better-auth/security/advisories/GHSA-q84f-53jg-9ppm), high | Device authorization is not registered. | Same upgrade. |
| Zod: [collection validation memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), high | Direct runtime validation dependency; oversized input handling depends on each schema. Do not assume every schema is immune. | 4.4.0 to locked 4.6.7 (fixed since 4.6.6; [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf970f2d752e5f58527cd2942ff48be4f46bd)). |
| source-map-js: [indexed section offset DoS](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), high | Transitive build/source-map tooling. No production user-supplied source-map processing was identified. | Lock 1.2.2 ([upstream fix](https://github.com/7rulnik/source-map-js/commit/cf7658058ceeaa8619d5ae0ec90be6905209d016)). |
| Vite: [Windows launch-editor command injection](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm), high | Development/editor path on Windows, rather than this macOS verification host or a production game action. | Lock 8.3.5, including patched launch-editor code. |
| Undici: [content-encoding crash](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c), [redirect cache disclosure](https://github.com/nodejs/undici/security/advisories/GHSA-4w7w-5xrc-9h26), [TLS option loss](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx), [TLS renegotiation crash](https://github.com/nodejs/undici/security/advisories/GHSA-qrxm-fqhp-jwvm), high | Vulnerable copy came from Wrangler/Miniflare tooling. Attacker-controlled remote responses can affect that toolchain. | Wrangler 4.151.3 to 4.157.0, resolving Undici 7.30.1 or later. |

The 14 residual moderate package findings are one minimatch advisory
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
and its ESLint/TypeScript-ESLint dependency ancestry. They remain visible in the
all-dependency audit JSON; they are not a claim of zero vulnerabilities. The
required high/critical gate passes without a forced ESLint major-version update.

## OAuth compatibility

Better Auth 1.7 removed `genericOAuthClient`, `signIn.oauth2`, and
`signInWithOAuth2`. The browser and preview popup now use the standard social
sign-in APIs. The app still offers only the existing Google/X broker providers.

A small server-only broker plugin preserves **both** registered callback URIs:
`/api/auth/oauth2/callback/grok-google` and
`/api/auth/oauth2/callback/grok-x`. It sets the supported provider `callbackPath`
relative to the resolved request origin and dispatches those paths to the fixed
core callback handler. Both authorization and code exchange use the old URI;
production and dynamic preview hosts remain valid. Existing account subjects
retain the old `id`, then `sub`, precedence. Sessions, account linking,
`__Host-` cookie attributes, origins, gate identities and secret configuration
remain intact. No database migration, save schema/slot change or new route is
required.

Database compatibility was checked independently of the memory adapter. The
installed 1.6.30 and locked 1.7.15 `getAuthTables` output has identical model,
column, type, nullability, uniqueness and foreign-key definitions for the enabled
plugins. Existing `0002_auth.sql` and `0003_username.sql` provide those columns.
The [1.7.3 release notes](https://github.com/better-auth/better-auth/releases/tag/v1.7.3)
confirm that the temporary 1.7.0–1.7.2 `issuer` schema was reverted; this app skips
that window. A fresh ephemeral PGlite instance using the app's real Kysely dialect
and existing SQL completed broker OAuth and local email/username registration
under 1.7.15, with two persisted users and no schema error. No production database
was accessed. See `schema-comparison.json` and `sql-schema-smoke.json`.

The public broker discovery document was fetched directly and saved. It
advertises the existing authorize/token/userinfo endpoints, code flow,
client-secret authentication and S256 PKCE. The upgraded client uses S256.

## Verification and limits

- 9 focused tests exercise actual Better Auth handlers with a synthetic broker:
  Google/X at both production origins and a dynamic preview origin; authorization
  parameters; exact callback and token redirect URI; state/PKCE; encrypted tokens;
  cookie and signed-cookie bearer sessions; replay rejection; sign-out; forged or
  missing state; unknown provider; untrusted returns; credentialed cross-origin
  rejection; preview popup redirect/cookies/no-store/origin-bound handoff; error
  escaping; existing-account re-login and `id` over `sub`; a pre-1.7 signed cookie.
- The old-cookie HMAC fixture independently matches the installed Better Auth
  1.6.30 / better-call 1.4.0 writer. It is synthetic and contains no user secret.
- 27 auth TypeScript tests and 33 related JavaScript tests pass, zero failures or
  skips. The new tests run in `npm test` and CI's TypeScript shard list.
- Typecheck, targeted auth ESLint and production build pass. The build preserves
  the existing Boardworld gzip totals: 194,150 initial TR / 300,100 all-language.
- These are local protocol tests with mocked broker responses, not an external
  Google/X user login, human acceptance, or production authentication assertion.
  Full final-candidate regression/browser/CI/deployment gates remain the release
  owner's responsibility.

Upgrade all app instances together. Upstream explicitly requires restarting
pending pre-upgrade OAuth/account-linking flows because state purpose isolation
changed. Existing valid session cookies remain readable with the same configured
secret. No production deploy or credential rotation was performed here.

## npm 10 clean-install compatibility

Cloudflare's existing preview preflight exposed a separate lockfile problem:
`npm clean-install` with npm 10.9.2 rejected the candidate with
`Missing: lru-cache@11.5.3 from lock file`. This was reproduced against the new
security lock in a fresh isolated temporary directory before attempting repair.
Nitro's nested `unstorage` declares optional peer `lru-cache ^11.2.6`; the inherited
lock contained only Babel's incompatible root `lru-cache 5.1.1`.

The repair adds only npm 10's generated nested
`node_modules/nitro/node_modules/lru-cache` entry at 11.5.3. No manifest, existing
package version, integrity, or platform/libc metadata changes. Broader npm 10
metadata rewrites were reviewed and discarded. A real clean npm 10.9.2 install
under official Node 22.23.4 on Darwin arm64 passed (484 packages, 12 seconds),
with an identical package-lock hash before and after installation. This directly
checks CI's npm major; it is not a claim of running a native Linux build locally.
Retained failure/success logs and the platform validation details belong in
`outputs/gold7-recovery/security/npm10-compatibility.json`.
