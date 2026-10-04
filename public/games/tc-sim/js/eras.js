export const PRESENT_DAY_ERA_ID = "present_day";

export const ERAS = [
  { id: PRESENT_DAY_ERA_ID, title: "Günümüz", playable: true },
  { id: "1999-04-18", title: "18 Nisan 1999", playable: true },
  { id: "1980s", title: "1980'lerden rastgele başlangıç", playable: true },
];

export const getEraById = (eraId) => ERAS.find((era) => era.id === eraId) || null;
