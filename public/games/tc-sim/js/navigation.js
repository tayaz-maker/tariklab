export const NAVIGATION_ITEMS = [
  { label: "Bugün", view: "dashboard" },
  { label: "Gelenler", view: "inbox" },
  { label: "Sen", view: "character" },
  { label: "Hafta", view: "calendar" },
  { label: "Para", view: "finance" },
  { label: "Çarşı", view: "market" },
  { label: "İş", view: "career" },
  { label: "Eğitim", view: "education" },
  { label: "İnsanlar", view: "people" },
  { label: "Yakınlar", view: "relationships" },
  { label: "Ev", view: "home" },
  { label: "Beden", view: "body" },
  { label: "Geçmiş", view: "history" },
  { label: "Yıl dosyası", view: "yearbook" },
];

export const getNavigationTarget = (view) =>
  NAVIGATION_ITEMS.some((item) => item.view === view) ? view : null;
