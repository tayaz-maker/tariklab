import { themeMeta } from "./theme-meta.js";

const sndSeries = (n) =>
  n <= 12
    ? ["Sandık"]
    : n <= 26
      ? ["Kulis"]
      : n <= 42
        ? ["Kürsü"]
        : n <= 52
          ? ["Genel Merkez"]
          : n <= 64
            ? ["Anket"]
            : n <= 80
              ? ["Kurultay", "Koalisyon"]
              : ["Kampanya"];
const rcnSeries = (n) =>
  n <= 14
    ? ["Çayhane"]
    : n <= 26
      ? ["Taksi"]
      : n <= 40
        ? ["Çarşı"]
        : n <= 54
          ? ["Liman", "Gece"]
          : n <= 70
            ? ["Aile"]
            : n <= 80
              ? ["Baba", "Aile"]
              : n <= 90
                ? ["Yemin", "Aile"]
                : ["Racon"];
/**
 * Rules identity for copy limits and name locks.
 *
 * SND-066 and SND-080 are the source's reprints of SND-065 and SND-079: they
 * share one copy limit and one name lock even though each now shows its own
 * card name. Reading that shared identity from the ID — rather than storing a
 * field on the card — keeps every built definition byte-identical to the
 * frozen pre-expansion baseline while freeing the visible name.
 */
const COPY_GROUPS = {
  "SND-065": "SND-065",
  "SND-066": "SND-065",
  "SND-079": "SND-079",
  "SND-080": "SND-079",
};

export const copyKey = (card) => (card && COPY_GROUPS[card.id]) || card?.name?.tr;

export function buildCards(source, designs, theme) {
  return source.map((raw) => {
    const n = Number(raw.id.slice(4)),
      design = designs[n];
    if (!design?.name || !design.text) throw Error(`Missing bilingual design: ${raw.id}`);
    const series = design.series
      ? [...design.series]
      : theme === "veto-h"
        ? sndSeries(n)
        : rcnSeries(n);
    if (design.traits.extraSeries) series.push(design.traits.extraSeries);
    if (raw.kind === "trap" && !design.series)
      series.splice(0, series.length, themeMeta(theme).trapSeries);
    const responseOnly =
      !design.traits.allowProactive &&
      Object.keys(design.traits).some((key) => key.startsWith("response"));
    const response = design.traits.noResponse
      ? null
      : design.traits.responseTypes ||
        (responseOnly ||
        design.traits.responseFrom ||
        raw.kind === "trap" ||
        raw.subtype === "quick"
          ? ["activate", "attack", "summon", "special", "draw", "destroy", "battle-start"]
          : null);
    const costs = [],
      effects = structuredClone(design.effects);
    while (
      effects.length &&
      (effects[0].op === "selfMove" ||
        (effects[0].op === "points" && !effects[0].opponent && effects[0].amount < 0))
    )
      costs.push(effects.shift());
    return {
      ...raw,
      name: { tr: raw.name, en: raw.nameEn || design.name },
      text: { tr: raw.text, en: raw.textEn || design.text },
      series,
      rulesNote:
        theme === "veto-h" && n === 113
          ? {
              tr: "Tek tepki modeli uyarlaması: Bu kartı kendi sıranızda kullanın; bu tur ilan edeceğiniz sonraki işleme rakip tepki veremez.",
              en: "Single-response adaptation: play this on your turn; the opponent cannot respond to your next declared action this turn.",
            }
          : theme === "veto-h" && [65, 66, 74, 77].includes(n)
            ? {
                tr: "Kaynak açıklaması: Ayrı bir Kurultay büyüsü listelenmediği için Kurultay Delegesi ritüel işlemini başlatır; kendisi ritüel bedeline ek olarak mezarlığa gider.",
                en: "Source clarification: no separate Congress spell is listed. Congress Delegate starts the ritual and goes to the grave in addition to the required materials.",
              }
            : null,
      hint:
        design.hint ||
        (raw.kind === "unit"
          ? null
          : {
              tr: "Tuzaklar ve set Hızlı kartlar sonraki turu bekler. Hedef ve zamanlama koşullarını kontrol et.",
              en: "Traps and Set Quick-Play cards must wait until a later turn. Check timing and target requirements.",
            }),
      effects,
      costs,
      traits: design.traits,
      triggers: design.triggers,
      response,
      responseOnly,
      targets: raw.subtype === "equip" ? [{ owner: "own", zones: "units", count: 1 }] : [],
    };
  });
}
