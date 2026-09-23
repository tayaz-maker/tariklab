# TarikLab — kalan iş durumu

Kaynak: `TARIKLAB_REMAINING_WORK_COMPLETION_QUEUE.md`. Satır, merge ve production kanıtı olmadan DONE sayılmaz.

| İş | Durum | PR | main SHA | Production | Kalan risk |
|---|---|---|---|---|---|
| Main CI kapısı (#77 sonrası campaign-browser) | DONE | [#81](https://github.com/tayaz-maker/tariklab/pull/81) | `d3fbe23` | [run 35900250542](https://github.com/tayaz-maker/tariklab/actions/runs/35900250542) campaign-browser success; production adımı `Verify exact production game code` success. `www` ve workers `app.js` `bc89ed1ec0187076`, `map.js` `518b6406b6985096`, `mapintel.js` `8bee7505fd1131ec` yerel ağaçla aynı. | Yok. Kök neden: ray metni `hazırlanıyor` içinde `hazır` geçtiği için bekleme hemen dönüyor, menü henüz doğrulanmamış paketi gösteriyordu. |
| HANEDANIAN strateji / campaign-start | DONE | [#81](https://github.com/tayaz-maker/tariklab/pull/81) | `d3fbe23` | Aynı byte eşlemesi. PR CI [35897431597](https://github.com/tayaz-maker/tariklab/actions/runs/35897431597) build, campaign-browser (24m23s) ve campaign-balance yeşil. | 49×49, seed ve kayıt şeması duruyor. Katmanlar atlası yeniden kurmuyor. |
| İHTİLÂL tek oyunculu yeniden inşa | TODO | — | — | — | Eski masa hâlâ varsayılan oyun. Bu dalgada kodlanmadı. |
| Son 100 Gün | TODO | — | — | — | — |
| Racon Manager | TODO | — | — | — | — |
| TC SIM | TODO | — | — | — | — |
| SON KÖY MANAGER | TODO | — | — | — | — |
| TC SIM: DEVLET | TODO | — | — | — | Harita [#76](https://github.com/tayaz-maker/tariklab/pull/76) ile duruyor; derinlik ayrı iş. |
| JITEM | TODO | — | — | — | Runtime sync [#75](https://github.com/tayaz-maker/tariklab/pull/75) ile duruyor. |
| Apartman / transit hukuk | BLOCKED | [#78](https://github.com/tayaz-maker/tariklab/pull/78) [#79](https://github.com/tayaz-maker/tariklab/pull/79) draft | — | Yayın yok | İnsan marka araştırması yok. Merge yok. |
| Novella | LATER | — | — | — | Bu dalga dışı. |
| Kaynaklar / hak zinciri | TODO | — | — | — | — |
| Final closure | TODO | — | — | — | Kuyruk bitmeden yazılmaz. |
