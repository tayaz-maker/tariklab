# Son 100 Gün — originality review (single-seat rebuild)

Engineering review for the implementation gate. Not legal advice. Not counsel sign-off.

| Risk | Rating | Control in this rebuild |
|---|---|---|
| Format or wording taken from a published "last hundred days" product | Removed from product text | The retired third-party format wording is gone from Resources (TR/EN/PL) and help. A test fails if it returns. The game is described only in its own words. |
| Rules or screen layout copied from another life-sim or narrative game | Low | One decision per period from three situations, a rhythm chosen on day 15, one breaking point on day 57 picked by the weakest area, four endings from three axes. Plain text cards with a preview list; no portrait art, no dialogue tree, no timeline wheel. |
| Real people, clinics, medicines or institutions | Avoided | Three fictional lives with first names only. No named illness, drug, hospital, company or city. The medical content stays general ("intensive treatment", "pain control", "a clinical study"). |
| Visual assets | None shipped | No image, icon font, web font or audio file. The light change is CSS colour tokens only. |
| Sensitive subject (terminal illness) | Handled with restraint | No death animation, no countdown alarm, no red. The early ending is stated in one plain sentence. |
| Old next-wave Son 100 Gün engine still in the repo | Residual, not the live page | `app.js`, `help.js` and `style.css` are no longer loaded by `index.html`; the engine in `public/games/next-wave/son100-*.js` stays for its existing tests. Old saves stay untouched in their own namespace. |

All card, ending and interface text in `public/games/son-100-gun/pov-data.js` and `pov-app.js` was written for TarikLab in this change.
