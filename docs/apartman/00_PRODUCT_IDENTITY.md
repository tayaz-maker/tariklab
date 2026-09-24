# Kapı Nöbeti — Product Identity

Public catalog name is **Kapı Nöbeti**. The slug stays `apartman` so existing saves (`meta.id` apartman, version 2) keep loading. A simple web search on 24 Sep 2026 found an active App Store role-playing game titled "Apartman Yöneticisi"; that phrase is not the public name. This note is not a trademark clearance.

## Player fantasy
You manage a living apartment building full of conflicting residents. It is a social-and-financial balancing act, not a construction game.

## What it is
- People: owners, tenants, families, elderly residents, students, difficult personalities.
- Building systems that fail and need decisions, not just money.
- A recurring vote/meeting where politics, not just budget, decides outcomes.

## What it is NOT
- **Not** Racon Manager with apartment vocabulary — no crew, no turf, no heat, no personal-progression leveling. The engine is reused; the fantasy, resources, and resolution mechanic are not.
- **Not** a construction tycoon — the player does not design or build the building, only manages what exists.
- **Not** a city builder — scope is one building, not a neighborhood or city.

## Signature mechanic: Toplantı Gecesi / Yönetim Kurulu
A recurring meeting where an agenda of proposals is voted on by resident blocs. The tension is between the cheap fix, the durable fix, the popular fix, the legal/safe fix, and the politically convenient fix — and a chosen fix updates residents' trust/satisfaction/influence in ways that resurface in later meetings. This is the one mechanic no other TarikLab game has (Racon has no vote/bloc system; Hanedan's league has no persuasion layer).

## Base engine
Primary reuse: **Racon Manager** (weekly management loop, task/issue queue, roster-of-people cards, finance ledger, calendar). Secondary reuse: TC SIM's `openCases[]` delayed-consequence pattern (an issue deferred at a meeting resurfaces later, worse); TarikLab 3-slot save standard; existing responsive UI shell (Button/Dialog/StatBar-equivalent components).

## Progression model
No XP/levels. Progress is: building health, financial stability, resident trust, manager legitimacy, issue backlog size, and term/election outcome. See `02_STATE_AND_EVENT_CONTRACT.md`.

## Ending
Re-elected, voted out, resign, building crisis (forced ending), or multi-year continuation (soft-open, no forced end). Sprint 1 proves one term (8 weeks, 1 meeting) — do not build the full election/multi-term arc before the vertical slice is validated.
