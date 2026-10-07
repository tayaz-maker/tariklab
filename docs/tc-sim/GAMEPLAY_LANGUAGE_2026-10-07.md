# TC SIM gameplay language and notifications

Baseline: #142 merged as bd8280ec43ce20aa246b05791e940de9a4bf1bd1; production deployment dpl_XtS4xqrLgXoh3QzEUeeNy3TboGNr READY from this SHA.

Audit covered dashboard, inbox, character, calendar, finance, market, career, education, people, relationships, home, body, history, yearbook and existing event text. Existing authored event voice is retained: 431 event definitions had no matches for the audited prototype terminology. Existing job-start outcome panel remains authoritative for salary/workload feedback. Body and family wording already usable; no blanket rewriting.

Presentation changes:
- Shared terminology adapter supports legacy displayed text without changing saved history.
- Inbox prioritizes overdue/current known cases, avoids duplicating the active case, and explains the next step without inventing a consequence. Same-week duplicate notices collapse; recurring notices from other weeks remain.
- Decision feedback projects already-public wallet/ledger, rent, commute, holdings, relationship gauges and business capacity changes. Failed actions retain their reason. Hidden cases, NPC memory secrets and unknown health never enter the projection.
- Historical methodology and exchange formula detail stay available in expandable explanations; primary copy describes the player's decision.
- Existing simulation, state, save/migration and event definition files are byte-identical to baseline. No new save fields, random draws, event dispatch or gameplay branches. UI shell, styles, palette and other games unchanged.

Validation: targeted read-only/hidden-state, old-save, duplicate notice, real exchange buy/full sell, real relocation and social feedback tests. Existing browser city flow checks actual outcome copy and reload. Full TC regression, build/typecheck and targeted browser release gate required. Production visual acceptance: USER PENDING. Final mobile QA deferred. Stop after release; no weekly balance work.
