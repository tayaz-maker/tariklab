# Unpublished local PR draft

**Add Kıyıyaka, a playable isometric district with a persistent society**

A new desktop browser game runs at the feature-gated `/oyna/social-engine` route. Work, trade, property, personal relationships, theft, witnesses and police share the same deterministic world. For example, an unpaid unit leaves a real shop's stock. Its identity survives a save; returning it restores that shop's stock without erasing the case.

The game loads separately, owns its assets and uses only the `tariklab-social-engine` IndexedDB namespace. The current reader migrates supported schemas 1–5 to 6, preserving an active historical command journal without giving formerly rejected commands new effects. Cold-start controls wait for the module before accepting a submission.

See the 60 original criteria and their current evidence in `docs/social-engine/ACCEPTANCE_MATRIX.md`. The separate four-contract audit lists additional human, hardware, resilience and release gates. Unit results, real browser traces, source fingerprints and time-series measurements are scoped to their actual inputs. Remote CI, production, rollback and human usability must not be described as verified.

Local draft only. No remote PR, merge, production deployment or rollback rehearsal has been performed for this candidate.
