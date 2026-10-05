export const NAVIGATION_ITEMS = [
  { label: "ANA SAYFA", view: "dashboard" },
  { label: "GELEN KUTUSU", view: "inbox" },
  { label: "BEN", view: "character" },
  { label: "TAKVİM", view: "calendar" },
  { label: "FİNANS", view: "finance" },
  { label: "MARKET", view: "market" },
  { label: "İŞ", view: "career" },
  { label: "EĞİTİM", view: "education" },
  { label: "KİŞİLER", view: "people" },
  { label: "AİLE / İLİŞKİLER", view: "relationships" },
  { label: "EV", view: "home" },
  { label: "BEDEN", view: "body" },
  { label: "GEÇMİŞ", view: "history" },
  { label: "YIL DOSYASI", view: "yearbook" },
];

export const getNavigationTarget = (view) =>
  NAVIGATION_ITEMS.some((item) => item.view === view) ? view : null;
