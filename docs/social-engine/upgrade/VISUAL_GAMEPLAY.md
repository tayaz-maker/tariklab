# Art direction, UX and depth

Target: grounded Istanbul-inspired original urban crime-drama, polished compact 2.5D isometric browser game. No direct copying of GTA/Bully/Sleeping Dogs assets.

Screenshot issues to address: repetitive oversized roofs, sparse street detail, miniature indistinct characters, boxy static cars, visually synchronized NPC clusters, HUD hierarchy with Kıyıyaka larger than SOCIAL ENGINE. Improve perspective consistency, sprite pivots, readable walk/run/idle/fight animation, car turn frames, shadows, varied storefronts, street signs, crossings, interiors, props, lighting and ambient life. Render signage/UI text programmatically to avoid generated artifacts.

Game loop: character creation → neighborhood exploration → meet NPCs → employment and money → shopping and property → relationships and reputation → legal/criminal choices → police and consequences → dynamic missions → save and continue. Provide at least two distinct careers, three persistent consequence chains, meaningful 30–60 minute gameplay, accessible onboarding and real interactions in all advertised menus. Every UI action needs input, state change, feedback, persistence, failure mode and E2E test.

Keep SOCIAL ENGINE primary title in HUD, site listing and metadata. District labels only as subordinate world context. Test 1366×768 and 1920×1080; prevent HUD occlusion. Maintain original asset inventory, licenses, atlas frame mapping, compression and memory budgets.
