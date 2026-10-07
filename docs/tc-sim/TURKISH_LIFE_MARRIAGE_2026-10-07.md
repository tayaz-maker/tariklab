# TC SIM — Turkish life and marriage depth

Baseline verified: #140 merged, main `f895560d62a360695f71a0d37e052cd9e898c269`, Vercel `dpl_3tHmqXuCCHLgZ76Tarpk12Nkdobw` READY on www.

## Audit before implementation

| Existing system | Before | Action in this wave |
| --- | --- | --- |
| Meeting, social contact, romantic interest, trusted partnership | DONE | Retain social engine; explicit adulthood gate at romantic entry |
| NPC memory, delayed cases, calendar, Year File | DONE | Reuse the existing household chains/history; no second scheduler |
| Shared home, contributions and prorated monthly costs | DONE | Preserve settlement; expose shared budget beside marriage plan |
| Separation, delayed divorce, reconciliation | DONE | Preserve; add voluntary breakup before marriage and keep debts after separation |
| Marriage proposal / engagement | PARTIAL | Separate paid engagement from delayed preparation; use existing marriage event |
| Family introduction / isteme and differing expectations | MISSING | Optional direct conversation; recorded support/reservations without parental veto |
| Marriage path | PARTIAL | Remove mandatory prior cohabitation; civil, small celebration and hall alternatives |
| Wedding economy | PARTIAL | Replace flat cost/gift figures with itemized period-scaled quote, guests, support and actual gold holdings |
| Wedding loan, repayment | PARTIAL | Reuse small personal bank credit and existing monthly debt settlement; two activities |
| Honeymoon and later budget reflection | MISSING | Optional home/trip follow-up; annual shared-responsibility review through existing cases |
| Mutual child intention, pregnancy, birth, care, school and adulthood | DONE | Retain engine, allow cohabiting unmarried planning; validate adult context |
| Consensual intimacy/protection | PARTIAL | Retain authored route; reject separated/underage context, unaffordable protection, overwritten pending follow-up |

## Sources and simulation boundary

Reviewed 2026-10-07:
- TÜİK, Türkiye Aile Yapısı Araştırması 2021: https://www.tuik.gov.tr/media/announcements/turkiye_aile_yapisi_ara%C5%9Ftirmasi_2021.pdf
- Ministry of Culture, Ordu wedding traditions: https://ordu.ktb.gov.tr/TR-340205/evlenme-gelenekleri.html
- Ministry of Culture, Afyon wedding traditions: https://afyon.ktb.gov.tr/TR-63450/evlenme-gelenekleri.html
- Ministry of Culture, Tunceli wedding traditions: https://tunceli.ktb.gov.tr/TR-398428/evlenme-gelenekleri.html

The survey describes multiple routes to marriage, while the regional accounts describe distinct local practices and means-dependent preparation. None establishes one universal Turkish family. The game therefore makes family visits, isteme/söz, engagement and large weddings optional. Family approval cannot replace the adult couple's agreement. No coercive/underage route is added.

These sources are cultural context, not price observations or coefficients. Cost factors (.75 before 1990, .9 before 2010, 1 before 2020, 1.15 thereafter), guest counts and family responses are explicit fictional balance rules. Individual family background, existing family marriage-pressure modifier, era, current trust/tension, money and chosen celebration matter; no ethnicity or province receives a fixed personality. Provincial tariffs and a geography simulator are out of scope for this wave.

Money uses the accepted period economy's wage/CPI conversion. Wedding line items are modelled budgets, never advertised as historical venue quotes. #139 FX/gold datasets, spreads, credits and business formulas are unchanged. Gold gifts use its past-observation quarter-gold quote; before verified data exists, gifts remain cash rather than inventing a gold price.

## Accounting / state boundaries

- Existing `household.union` remains authoritative for cohabitation, marriage, separation and family intent. Optional `household.wedding` records only preparation/settlement facts; absent legacy records stay absent.
- Preparation consumes actual weekly time and cash. At most one ceremony/preparation decision per week. Follow-up identity, due week, current partner and expiry are revalidated by the household event gate.
- Itemized cost covers paperwork, ring, clothes, basic household setup, venue, catering and organization. Existing engagement ring cost is not charged twice.
- Family support is available only after a meeting, bounded by gross cost, and reduced for a tight family budget. It is not an infinite cash action.
- Bank-funded wedding calls the existing credit availability/issuer. The normal personal loan limit, income threshold, debt-service ratio, principal and month-end payment rules apply. There is no wedding-specific debt engine. A loan plus wedding uses two activities.
- Gifts arrive after the expense. Receipt budget is bounded below gross costs, based on guests, current social ties and a deterministic story outcome. Quarter-gold units enter `wealth.exchange`; their value is deducted from the receipt budget before cash is credited, so no double counting. Gift acquisition cost is zero, visibly recorded as a gift. Selling uses the unchanged spread/fee engine.
- Divorce/breakup never erases bank debts or previously spent cash. This is not a Turkish divorce/property law simulator; no legal asset allocation is asserted.
- Adult intimacy remains the authored Elif route; arbitrary imported characters are not silently assigned adulthood or reproductive biology. Explicit age under 18 overrides the original authored adult-peer fallback. Pregnancy probabilities and timing remain fictional existing mechanics, not medical advice.

## Validation

New deterministic scenarios: real relationship → family → engagement → delayed marriage → shared home/budget → mutual child plan; civil ceremony without cohabitation; objection; insufficient cash; existing credit repayment and divorce debt survival; 1985/1999/2017/2025 costs and gift sale anti-profit; replay rejection; breakup; legacy normalization; adult/protection gates. Existing 520-week household and parenting trajectories remain covered.

Targeted household/parenthood/intimacy/new cases: 45/45 PASS before full regression. Build/typecheck and exact-head CI browser gate follow. Browser gate adds a synthetic household save for cost presentation, conversation dispatch and reload persistence. UI shell/styles and #140 body module are untouched. Production visual acceptance remains with the user. Stop after release; city/neighborhood work is not started.
