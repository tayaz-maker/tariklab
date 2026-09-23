# TarikLab IP and originality gate

> **Bu bir mühendislik risk sürecidir, hukuki görüş değildir.** Yeni bir oyun veya
> kitabın yayımlanması, Türkiye'de fikrî mülkiyet avukatı veya marka vekilinin yazılı
> onayını gerektirir. Belirsizlik bir engeldir (blocker), varsayım değildir.
>
> *This is an engineering risk process, not legal advice. Publishing any new title
> requires written sign-off from Turkish IP/trademark counsel. Legal uncertainty is a
> blocker, never an assumption.*

## Files

| File | Purpose |
|---|---|
| [CONCEPT_ORIGIN.md](CONCEPT_ORIGIN.md) | Abstract problems taken; expression explicitly excluded |
| [ASSET_REGISTER.csv](ASSET_REGISTER.csv) | Every font, library, data source, map, stock, AI and hand-made asset, with provenance and status |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | Full license text for third-party code shipped to browsers (generated) |
| [client-packages.json](client-packages.json) | Input list for the notices generator |
| [TRADEMARK_CLEARANCE.md](TRADEMARK_CLEARANCE.md) | Candidate names, search attempts and results, blocked terms, legacy findings |
| [VISUAL_DIFFERENTIATION.md](VISUAL_DIFFERENTIATION.md) | Abstract comparison and TarikLab's own visual decisions |
| [ORIGINALITY_RISK_REVIEW.md](ORIGINALITY_RISK_REVIEW.md) | Risk matrix for the three new concepts; questions for counsel |

## Chain-of-title checklist (every new asset)

- [ ] Creator named (person, agency or AI service with account/plan).
- [ ] Date and, for AI output, the provider's commercial-use terms in force on that
      date (link + archived copy).
- [ ] Prompt or brief recorded. It must contain no third-party brand, character or
      work names, and no reference image.
- [ ] Reverse image search on the output and a human review, both recorded.
- [ ] Written, transferable commercial-use grant and originality warranty from any
      external artist or agency.
- [ ] License text in THIRD_PARTY_NOTICES.md for any open-licensed input.
- [ ] No audio of any kind. TarikLab games are silent.
- [ ] For public-domain text: the original work, every translation, every edition,
      every illustration and every recording verified separately for every launch
      territory. Until then: **not used**.

## Release gate for a new title PR

A new-title PR may be **opened** once it carries:

- its IP register rows;
- a visual differentiation note;
- tests;
- desktop and 390 px QA;
- a performance check;
- a production-build verification;
- an adversarial similarity review;
- a human-readable release note.

It may be **merged**, which deploys it to production, only when all of these also hold:

1. TRADEMARK_CLEARANCE.md shows a cleared public name, or the owner and counsel
   accept a neutral placeholder in writing.
2. Counsel has signed off in writing. Record the date and reference here.
3. Every ASSET_REGISTER row for the title is `CLEARED`.

`scripts/ip-register.test.mjs` enforces the register's shape, the blocked-terms scan
and that new-title rows are never marked cleared without a counsel reference.

## Model roles in this wave

- The handoff assigned art briefs to **Grok** and story review to **GPT**. Neither is
  available to this implementation team.
- Art briefs and story critique were done by Claude subagents and are labelled as such.
- Implementation is by Claude.
- The adversarial similarity review is by a separate Claude Sonnet subagent that did
  not write the code.
