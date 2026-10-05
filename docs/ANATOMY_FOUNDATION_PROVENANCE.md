# Anatomy foundation — content and provenance

Status: **DRAFT_LEARNING_PREVIEW; NOT_REVIEWED; releaseEligible=false**. Content owner: Astra. Independent anatomy reviewer: **unassigned**. Polish native-language reviewer: **unassigned**. Model, unit tests and browser evidence cannot satisfy either human review requirement.

## Scope and production meaning

`public/atlas/yapi/content.js` is an original, concise TR/EN/PL learning draft: seven broad skeletal groups and six organ examples (brain, heart, lungs, liver, stomach, kidneys). Surface is an orientation layer, not a completed skin module; skeleton is not a complete bone catalogue; the organ layer does not claim complete organ systems. No symptoms, personal health data, diagnosis, treatment or dosing content is included.

“Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.”

“Anatomik doğruluk için kaynak ve uzman inceleme kaydı olmadan tam/klinik kesin iddiası koymayacağız.”

“Eğitim amaçlıdır; kişisel tıbbi tavsiye, tanı veya tedavi aracı değildir.”

These notices, the unreviewed draft notice and the Polish review limitation are bundled as text in all three languages. First use and sources must show the educational/draft status. Offline content must retain the same notices and source/review metadata; caching cannot make content reviewed. Publication of this implementation, if allowed, is only a visibly unreviewed learning preview, never expert-approved or clinically reliable content.

## Sources: facts only, no art or copied explanatory text

Each source record retains URL, original title, narrowly supported claim, owner, access date and source date/precision/kind. `fieldSources` maps every anatomical label, description, function, location, layer assignment and search term to source IDs; the enclosing structure review applies to every field and translation. System labels/descriptions have the same linkage. UI scope descriptions identify our implementation limits, not facts asserted by NIH.

All access dates: **2026-10-05**. Source dates below are source editorial metadata, not TarikLab review dates. NCI “Suggested Citation / Cited” dates are access/citation dates; absent publication/review dates remain `null`.

| Registry ID | Official factual source | Source date / limited use |
| --- | --- | --- |
| `nci-body-terminology` | https://training.seer.cancer.gov/anatomy/body/terminology.html | Unknown (`null`); axes, directions and body cavities. |
| `nci-skeleton-introduction` | https://training.seer.cancer.gov/anatomy/skeletal/ | Unknown; support, protection and movement, introductory normal-function paragraphs. |
| `nci-skeleton-divisions` | https://training.seer.cancer.gov/anatomy/skeletal/divisions/ | Unknown; axial/appendicular grouping. |
| `nci-axial-groups` | https://training.seer.cancer.gov/anatomy/skeletal/divisions/axial.html | Unknown; skull, spine and thoracic groups, not universal bone counts. |
| `nci-appendicular-groups` | https://training.seer.cancer.gov/anatomy/skeletal/divisions/appendicular.html | Unknown; limb/shoulder/pelvic girdle groups. Pelvic girdle is not presented as synonymous with the complete pelvis. |
| `nci-brain-cns` | https://training.seer.cancer.gov/anatomy/nervous/organization/cns.html | Unknown; normal location, CNS relationship and brain–spinal signal pathways only. |
| `nhlbi-heart-anatomy` | https://www.nhlbi.nih.gov/health/heart/anatomy | Updated 2022-03-24, day precision; chest location and pumping. |
| `nhlbi-lungs` | https://www.nhlbi.nih.gov/health/lungs | Updated 2022-03-24, day precision; paired chest organs and gas exchange. |
| `niddk-kidneys` | https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work | Reviewed 2018-06, month precision; position and waste/water removal. |
| `niddk-digestion` | https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works | Reviewed 2017-12, month precision; liver bile production and stomach mixing. |
| `nci-liver-location` | https://training.seer.cancer.gov/anatomy/digestive/regions/accessory.html | Unknown; upper abdomen below diaphragm, chiefly right/central. |
| `nci-stomach-location` | https://training.seer.cancer.gov/ugi/anatomy/stomach.html | Unknown; upper abdomen, mainly left of midline; normal location only. |
| `nci-kidney-location` | https://training.seer.cancer.gov/kidney/anatomy/regional.html | Unknown; retroperitoneal placement beside spine only. |

Source paragraphs were used for factual verification. Their illustrations, photographs, page layouts, logos and clinical passages were not used. No OpenStax content, image pack, external model, downloaded body geometry, image-generation plate, audio or video is part of this content contribution. A factual citation is neither artwork permission nor institutional endorsement; no legal guarantee is made.

## Geometry and expert gate

Original body/structure geometry is a separate implementation surface; this content record does **not** attest that a drawing is accurate. Normalized front/back projections, adult variants, scale, laterality, organ overlap, bone contours, hands and posterior relationships require independent anatomical review. Realistic shading is not anatomical evidence. Approximate projection and individual-variation notes accompany all structures.

Before any expert-reviewed claim or full-system release: appoint a qualified independent reviewer; record identity, qualification, scope, findings and review date; bind approval to SHA-256 hashes of the exact content, translations and geometry reviewed; address findings and rerun the gate. A relevant content/geometry change invalidates the corresponding approval. Current `reviewer`, `reviewedAt`, `contentHash` and `geometryHash` are all `null`. The v1 schema rejects invented approval or `releaseEligible=true`; future approval requires an explicit reviewed schema/release change, not an automated boolean flip.

Additional systems remain `LATER`: muscular, full circulatory/respiratory/digestive/nervous, endocrine/lymphatic and a separate age-appropriate clinical reproductive education module. Detailed bone catalogues and anatomical variants are not completed.

## Name and verification boundary

Name: **TarikLab Beden Katmanları / TarikLab Body Layers / TarikLab Warstwy Ciała**. Root's name discovery on 2026-10-05 at 13:28 UTC found existing published books using the generic “İnsan Anatomisi Atlası”; an exact search for the chosen descriptive name returned no match. That is not trademark clearance or a legal guarantee.

Targeted content gate: `node --test scripts/atlas-content.test.mjs`. It validates offline-serializable text, exact ID coverage, TR/EN/PL fields, per-field sources, date precision/nulls, required notices, draft-only status and malformed data handling. Passing this gate is **not** clinical review, native-language review, browser evidence, offline-cache evidence or a production release claim. Those evidence owners record their independent results in the release checkpoint.


## Implementation and asset record

All shipped geometry, gradients, UI styles and the small product icon are original code authored for this foundation. `geometry.js` defines bounded adult front/back paths; `svg-view.js` provides locally computed material gradients and a maximum four-projection cache. `atlas-view.css` and `styles.css` use local system fonts and no external texture, photograph, model or raster. Female/male proportions and organ contours are approximate draft illustrations, not measured patient anatomy. The icon is an original abstract layer mark, not an institutional emblem.

The static runtime, language data, source/review records, smoke fixture and manifest are packaged under `/atlas/yapi/`; each build generates byte/hash/MIME evidence. Build emission uses the same single read of every runtime asset as its manifest, preventing stale incremental copies from claiming a newer hash. No game engine, save schema, root worker or card-art integration file changes. A separate first learning preview entry avoids silently adding the atlas to the playable-game catalog.

Local verification at this checkpoint:52 targeted tests; full suite1,874 passed/one existing opt-in skip; typecheck, lint and production build. An actual HTTP inventory/hash gate covers12 runtime files plus manifest/worker. Local Cloudflare preview is blocked by the environment's `uv_interface_addresses` failure; browser, network transfer and two-host release claims require the dedicated CI artifacts. Rasterized geometry contact sheets are design inspection only, not browser or expert anatomy evidence.
