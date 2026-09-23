# Trademark clearance log

> **Not legal advice.** This is an engineering risk log kept by the implementation
> team. No name, logo or icon here is cleared for publication. Every public name
> needs a TÜRKPATENT search and written sign-off from Turkish IP/trademark counsel
> (marka vekili). Where a search could not be run, that is a **blocker**, not a pass.

## Status summary (2026-09-23)

| Item | Status | Why |
|---|---|---|
| Apartment community slice: public name | **BLOCKED** | No TÜRKPATENT search yet (access failure below). |
| Transit-network slice: public name | **BLOCKED** | Working name "Akış Hatları" collides with a live web game (below); TÜRKPATENT search not run. |
| Interactive novella slice: public name | **BLOCKED** | No TÜRKPATENT search yet. |
| TarikLab T monogram (PR #73) | **BLOCKED for trademark use** | New figurative mark; no figurative (Vienna class) search run. Use as a favicon is a separate decision for the owner. |
| Live title "Apartman: Apartman Yöneticisi" (`apartman`) | **RISK — needs counsel** | The subtitle matches the name of a third-party commercial mobile game seen in the reference set. Rename or clearance is the owner's decision after counsel review. The slug and saves are unaffected by any display-name change. |

Until a name is cleared, the slices ship under **neutral descriptive placeholders**
(e.g. "Apartman topluluğu — prototip") with no logo, and are not added to the sitemap,
share cards, store listings or marketing copy.

## Search attempts and results

### Official registers

| Date (UTC) | Register | Result |
|---|---|---|
| 2026-09-23 | TÜRKPATENT marka araştırması (`turkpatent.gov.tr/arastirma-yap`) | **Not performed.** The search form is protected by reCAPTCHA and offers e-Devlet login. Automated access was not attempted beyond loading the page; a human must run it. |
| 2026-09-23 | WIPO Global Brand Database (`branddb.wipo.int`) | **Not performed.** CAPTCHA-protected. A human must run it. |
| 2026-09-23 | EUIPO / TMview | Not attempted in this wave. |

Classes to search when a human runs these: **9** (downloadable software, games),
**41** (online game services, entertainment), **42** (SaaS / non-downloadable software),
and **16/41** for the novella series if print or e-book editions are considered.

### Web and store searches (general web search, 2026-09-23)

These searches are indicative only. The search tool covers the open web, not the
full App Store / Google Play catalogues, so absence of a hit is **not** clearance.

| Candidate | Query | Finding | Assessment |
|---|---|---|---|
| Akış Hatları | `"Akış Hatları" oyun` | A browser puzzle game titled "Akış Hatları" is listed on a Turkish free-games portal (game-game.web.tr). | **Do not use publicly.** Stays an internal working name only. |
| Kıyı Ritmi | `"Kıyı Ritmi" game` | No game or app with this name found. | Candidate; needs register search. |
| Liman Nabzı / Kent Nabzı | `"Liman Nabzı" OR "Kent Nabzı" oyun ulaşım` | No game with either name found. | Candidates; need register search. |
| Gece Hatları | `"Dolmuş Hattı" OR "Gece Hatları" oyun mobil ağ` | No game with this exact name found; many generic dolmuş/bus games. | Candidate; descriptive, weak distinctiveness. |
| Ortak Duvar | `"Ortak Duvar" oyun apartman` | No game with this name found; generic building-law usage. | Candidate; needs register search. |
| Merdiven Boşluğu | `"Merdiven Boşluğu" oyun` | Only unrelated stair-climbing casual games; no title match. | Candidate; descriptive. |
| Kat Hafızası | `"Kat Hafızası" OR "Ortak Pay" apartman oyunu` | No match. | Candidate; needs register search. |
| Bina Defteri | `"Bina Defteri" uygulama` | Many "Defter"-named finance/ledger apps; "bina karar defteri" is a generic legal term. | Weak; avoid. |
| Arşiv Odası | `"Arşiv Odası" interaktif hikaye oyun` | No title match; generic phrase. | Candidate for a story title (not a series brand). |
| Kıyıdaki Son Vardiya / Boş Evler Sokağı | combined query | No title match; a film titled "Son Vardiya" exists. | Candidates for story titles; "Son Vardiya" alone should be avoided. |
| Apartman Yöneticisi | `"Apartman Yöneticisi" oyun uygulama App Store Google Play` | Numerous building-management apps use near-identical phrases; the reference set shows a commercial game using it. | Confirms the live-title risk above. |

## Private candidate names (not for publication)

Candidates are recorded here only so counsel can search them. None may appear in
UI, metadata, share cards or marketing until cleared.

- **Apartment community slice:** Ortak Duvar · Kat Hafızası · Merdiven Boşluğu · Avlu Kurulu
- **Transit-network slice:** Kıyı Ritmi · Liman Nabzı · Gece Hatları · Akış Hatları (*working name only, collision found*)
- **Interactive novella series:** series brand TBD; story titles Arşiv Odası · Kıyıdaki Son Vardiya · Boş Evler Sokağı

Selection rationale must be written here once a name is chosen: register results
per class, similar marks found, distinctiveness, and counsel's written opinion.

## Blocked terms

The following third-party names, and confusingly similar variants, must never
appear in TarikLab product names, metadata, in-game text or marketing. They are
listed only so that `scripts/ip-blocked-terms.test.mjs` can enforce it for new titles:
the transit puzzle game named in the handoff, the apartment-manager game named in the
handoff, and the interactive-fiction studio named in the handoff. The exact strings live
in the test file, not in product code.

## Legacy catalogue findings (for counsel; no change made in this wave)

These are pre-existing live titles. They are recorded because a truthful audit found
them; renaming live products is an owner decision after counsel review.

1. **"Apartman: Apartman Yöneticisi"** — see status table.
2. **VETO-H! / GETT-OH! / DARBE-H!** — the names' rhythm and the "-OH!" ending echo a
   well-known trading-card-game trademark, and the shared engine uses a familiar
   phase structure (Draw → Standby → Main 1 → Battle → Main 2 → End) and 8000-point
   life total. Rules and numbers are generally not protected by copyright, but name
   similarity is a trademark question. Counsel to assess.
3. **Son 100 Gün** — the credits text in `public/credits.html` and `public/i18n/tlab-i18n.js`
   describes it as being in "Extreme Last 100 Days format", which names a third-party
   format. Remove from product copy (scheduled for the Resources update).
4. **Racon Manager** — the internal spec (`docs/racon/SPEC-V1-ORIJINAL.md`) states that it
   takes a named commercial sports-management game's screen skeleton. The shipped UI
   should be reviewed for overall screen appearance; internal docs should not describe
   borrowing a layout.
5. **Son Mahalle Bükücü** — dice/deed/auction/trade board-game rules. The rules are
   generic; the board layout, card text and names should be checked against the
   well-known property-trading game's trade dress.
