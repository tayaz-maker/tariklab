# TLab — Çete Savaşları

İstanbul yeraltı simülasyonu. Kayıt tarayıcıda (localStorage); isteğe bağlı e-posta hesabı ile bulut.

18+ kurgusal içerik. Gerçek kumar, uyuşturucu veya şiddet teşviki değil.

**Aktif ürün:** [www.tariklab.com](https://www.tariklab.com). Native/Godot şu an durduruldu. Anlamlı web değişiklikleri sonra native eşlemesi için [docs/WEB_APP_SYNC_LEDGER.md](docs/WEB_APP_SYNC_LEDGER.md) dosyasına yazılır. Oyunlar ileride ayrı indirilebilir başlıklar olacak; tek bir dev native uygulama değil.

## Geliştirme

```
npm install
npm run dev
```

Önizleme `0.0.0.0:8080`.

```
npm run typecheck
npm run build
```

## Ortam

Değer yazma; isimler:

- `DATABASE_URL` — Postgres (yoksa PGLite)
- `BETTER_AUTH_URL` — Better Auth kök URL
- `BETTER_AUTH_SECRET` — oturum imzası
- `VITE_AUTH_ENABLED` — hesap kapısı

Oyun hesabı Supabase üzerindedir. URL ve publishable key `src/lib/supabase.ts` içindedir; service-role key istemciye verilmez.

## Yayın

GitHub `main` → Cloudflare Workers + Static Assets (`tariklab`). Yayın, aynı SHA için CI PASS kontrolünden sonra mevcut Workers Builds bağlantısıyla yapılır. `npm run deploy:cloudflare`; ayrıntılar `OPS.md`. Force-push kapalı tutulmalı.

## Oyun

`/` katalog. `/cete-savaslari` oyun. `?sekme=` derin bağlantı. `?ref=` davet.
