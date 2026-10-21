export const NAVIGATION_ITEMS = [
  { label: "Bugün", view: "dashboard" },
  { label: "Gelenler", view: "inbox" },
  { label: "Sen", view: "character" },
  { label: "Hafta", view: "calendar" },
  { label: "Para", view: "finance" },
  { label: "Bankalar", view: "banks" },
  { label: "Araç ve Eşya", view: "emlak" },
  { label: "Çarşı", view: "market" },
  { label: "İş", view: "career" },
  { label: "Eğitim", view: "education" },
  { label: "İnsanlar", view: "people" },
  { label: "Yakınlar", view: "relationships" },
  { label: "Ev", view: "home" },
  { label: "Şehir Haritası", view: "city" },
  { label: "Zaman / Odak", view: "decisions" },
  { label: "Hedefler", view: "goals" },
  { label: "Kayıt", view: "saves" },
  { label: "Ayarlar", view: "settings" },
  { label: "Beden", view: "body" },
  { label: "Geçmiş", view: "history" },
  { label: "Yıl dosyası", view: "yearbook" },
];

export const getNavigationTarget = (view) =>
  NAVIGATION_ITEMS.some((item) => item.view === view) ? view : null;
// One canonical screen per route; quick access never creates another renderer.
export const NAVIGATION_GROUPS = [
  ["finance", "banks", "emlak", "market"],
  ["people", "relationships"], ["body"], ["career", "education"],
  ["home", "city"], ["history", "yearbook"], ["settings"],
];
const screenNames = {
  tr: ["Hayatın", "Gelen kutusu", "Sen", "Hafta ve takvim", "Paran ve borcun", "Hesaplar, kredi ve yatırım", "Araç ve kalıcı eşya", "Çarşı", "İş ve kariyer", "Eğitim ve yeterlilik", "Sosyal çevre", "İlişkiler ve aile", "Ev ve konut", "Şehir Haritası", "Haftalık kararlar · Zaman / Odak", "Hedefler", "Kayıt yönetimi", "Ayarlar ve yardım", "Beden ve sağlık", "Olay geçmişi", "Yıl dosyası"],
  en: ["Your life", "Inbox", "You", "Week and calendar", "Money and debts", "Accounts, credit and investments", "Vehicles and owned goods", "Market", "Work and career", "Education and qualifications", "Social circle", "Relationships and family", "Home and housing", "City map", "Weekly decisions · Time / Focus", "Goals", "Save management", "Settings and help", "Body and health", "Event history", "Yearbook"],
  pl: ["Twoje życie", "Skrzynka odbiorcza", "Ty", "Tydzień i kalendarz", "Finanse i długi", "Rachunki, kredyty i inwestycje", "Pojazdy i trwałe przedmioty", "Sklep", "Praca i kariera", "Edukacja i kwalifikacje", "Krąg znajomych", "Relacje i rodzina", "Dom i mieszkanie", "Mapa miasta", "Decyzje tygodnia · Czas / Skupienie", "Cele", "Zarządzanie zapisami", "Ustawienia i pomoc", "Ciało i zdrowie", "Historia wydarzeń", "Rocznik"],
};
export function screenTitle(view, language = "tr") {
  const index = NAVIGATION_ITEMS.findIndex(item => item.view === view);
  return (screenNames[language] || screenNames.tr)[index] || screenNames.tr[0];
}
export function screenFromLocation(location) {
  try { return getNavigationTarget(new URLSearchParams((location?.hash || "").slice(1)).get("screen") || new URLSearchParams(location?.search || "").get("screen")); }
  catch { return null; }
}
