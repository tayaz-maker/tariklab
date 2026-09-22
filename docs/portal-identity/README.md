# Portal categories and install identity

Continues PR #56 at `0c372fa8974ee9207d06f54e303e1c6f12b72b71`.

The existing nineteen-card grouping is retained: Yönetim & Strateji, Dosya & Karar, Kart & Düello, Klasikler & Bulmaca. Cards keep their route, identity and status. New unclassified live entries remain visible in the first group until assigned; they cannot silently disappear.

Install identity uses TarikLab consistently, one manifest link, a high-contrast TL monogram, 192/512 PNG icons, a separate safe-zone maskable 512 icon and a 180 apple-touch icon. The platform branding injector remains intact and recognizes an already-present manifest/apple icon. App id/start URL/scope stay `/`, preserving installed app identity.

Real Chromium checks: one manifest selected with no parsing errors, correct name/icons/scope, desktop and 390px portal without horizontal overflow or page errors. [Desktop](portal-desktop.webp), [mobile](portal-mobile.webp), [actual icon in browser](pwa-icon-browser.webp). Targeted category/PWA tests, build/typecheck and changed-file lint passed.

Mac Dock and the native macOS install dialog cannot be exercised in this Linux browser environment. Existing installations may retain their icon until the browser refreshes the manifest.
