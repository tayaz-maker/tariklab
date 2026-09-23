# Originality risk review — apartment, transit and novella concepts

> **This is an engineering risk review, not legal advice or a legal opinion.** It was
> prepared by the implementation team (Claude) to structure the questions for counsel.
> Publication of any new title requires human Turkish IP/trademark counsel sign-off.
> Where this review is uncertain, the item is a **blocker**, not an assumption.

## Working assumptions (to be confirmed by counsel)

- Copyright generally protects original expression: visual, textual, audio and
  software expression. It does not protect a game idea, method or rules as such.
  WIPO and the U.S. Copyright Office say this; the handoff cites both.
- Turkey's FSEK (Law No. 5846) protects works bearing the author's characteristics.
  The general term is life plus 70 years.
- A combination of screens, overall look, names, logos, text, illustration, music
  and story can still infringe, or create unfair-competition or trademark risk,
  even when each rule is free.
- "Fair use" or "fair dealing" is not a publication strategy. Any asset without a
  clear chain of title is rejected.

## Risk matrix

Ratings are the team's engineering judgement: Low / Medium / High / **Blocker**.

### A. Apartment community and maintenance game

| Risk | Rating | Control |
|---|---|---|
| Overall screen appearance similar to the reference apartment game | Medium → Low after controls | Courtyard plan instead of vertical cut-away; desktop-first three-column layout; own palette. Adversarial review required. |
| Name confusion with the live "Apartman Yöneticisi" subtitle and the reference game | **Blocker** for any public name | New name only after TÜRKPATENT search and counsel. Placeholder until then. |
| Event texts or problem cards resembling the reference | Low | All texts written from scratch; no reference text was read beyond the category glance. |
| Resident characters resembling reference characters | Low | Text-only residents with original names; no character art in the slice. |
| AI art provenance | n/a in slice | Slice uses code-drawn SVG/CSS only. Any future art must be registered per ASSET_REGISTER. |

### B. Transit-network game

| Risk | Rating | Control |
|---|---|---|
| Perceived as a clone of the well-known minimalist transit puzzle game | **High** inherently for the genre; Medium after controls | Turn-based rhythm windows, terrain-bound modes, need flows instead of shapes, agreements instead of weekly upgrades, dark topographic look, no clock dial, no overflow timer. Never marketed by comparison. Adversarial review is mandatory. |
| Name collision ("Akış Hatları" exists as a web game) | **Blocker** for that name | Internal working name only. |
| Map geometry resembling a real city's transit map | Low | Fictional coastline generated from hand-authored control points; no real map consulted. |
| Station and line iconography | Low | District plates and mode strokes designed for this game. |

### C. Interactive novella

| Risk | Rating | Control |
|---|---|---|
| Text copied or derived from another work | Low | Original text written for TarikLab in this wave; version history in git. |
| Presentation resembling the reference interactive-book app (bound-book look, chapter cards) | Low–Medium | Archive-folder metaphor, index-card choices, no leather or page-curl; adversarial review. |
| Real people or places defamation / personality rights | Low | Fictional municipality, fictional names; checked in story review. |
| Public-domain adaptation | **Blocker** (not used) | No public-domain work is adapted. The work itself, every translation, edition, illustration and audio would each need separate verification for every launch territory. |

## Open questions for counsel

1. Should the live subtitle "Apartman Yöneticisi" be withdrawn now, or after a search?
2. Is a neutral descriptive placeholder ("Apartman topluluğu — prototip") acceptable on
   a public but unlisted URL, or must slices stay on preview deployments only?
3. For AI-generated legacy art whose provider terms were not recorded (ASSET_REGISTER
   A008, A010–A012), is retroactive recording of provider terms enough, or must the
   art be replaced?
4. Do the duel-family names (VETO-H!, GETT-OH!, DARBE-H!) need a trademark opinion?
