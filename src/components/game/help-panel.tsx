import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CETE_HELP_EN, useLang } from "@/lib/i18n";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Amaç",
    body: "Sokaktan başlayıp bir çete kurmak, para/itibar biriktirmek ve semtini elinde tutmak. Tek bir 'kazanma' anı yok; kasa, itibar ve hayatta kalma birlikte gider.",
  },
  {
    title: "Temel döngü",
    body: "İcraat'ten iş al, kazandığın parayla Tezgâh'tan silah/zırh/araç kuşan, Sokak'ta köşe bas veya semt sık, Emlak'ta torbacı köşesi büyüt. Zaman gerçek saatle akar; Hız ×N ile hızlandırabilir veya '1 saat geçir'le atlayabilirsin.",
  },
  {
    title: "Kontroller",
    body: "Alttaki (mobilde) veya soldaki (masaüstünde) sekmelerden Ben, İcraat, Tezgâh, Emlak, Sokak, Hayat ve Klinik'e geçersin. Defter simgesi son olayları gösterir.",
  },
  {
    title: "Kaynaklar ve göstergeler",
    body: "Mermi & Takat enerjini, Racon & Karizma dayanıklılığını, Can sağlığını, Emniyet ise polisin üstündeki dikkatini gösterir. Emniyet yükselince devriye ve rakip semt baskısı artar. Kasa, yatırım, itibar ve rüşvet fonun Detay altında.",
  },
  {
    title: "İlerleme",
    body: "İş yaptıkça XP kazanıp kıdem (level) atlarsın; her kıdemin kendi lakabı vardır. Sezon 14 gün sürer, sezon skoru birikir. Semt satın alıp köşe büyüterek düzenli haraç geliri kurarsın.",
  },
  {
    title: "Risk ve kayıp",
    body: "Can 20'nin altına düşerse ya da yakalanırsan Klinik'e veya Nezaret'e düşersin; o süre boyunca iş yapamazsın. Rüşvet kasan varsa nezareti kısaltabilir. Emniyet yüksekken kasaya yatırmadığın nakit sokakta risk altındadır.",
  },
  {
    title: "Kayıt",
    body: "Bu cihazda üç kayıt slotun var; açık olan slot otomatik kaydedilir, HUD'daki 'Kayıt N' düğmesinden slotlar arasında geçip elle de kaydedebilir veya silebilirsin. Hesap açıp giriş yaparsan ilerlemen ayrıca buluta da yedeklenir; misafir oynarken bulut senkronu devre dışıdır ve oyun yalnızca bu cihazda sürer.",
  },
  {
    title: "İlk oyun için ipuçları",
    body: "Önce birkaç iş yap, silah kuşanmadan sokağa çıkma. Emniyet yükseldiyse bir süre kasada bekle. Torbacı köşesini erken aç; düzenli gelir en büyük fark yaratan şey. Nakdi hep kasada tutma alışkanlığı kazan.",
  },
  {
    title: "Önemli not",
    body: "Kurgusal içerik; gerçek kumar, uyuşturucu ya da şiddet teşviki değildir. Hayat sekmesindeki kumar/bar aktiviteleri de oyun içi kurgudur.",
  },
];

const SECTIONS_PL = [
  { title: "Cel", body: "Zacznij na ulicy, zbuduj ekipę, zdobywaj pieniądze i szacunek oraz utrzymaj swoją dzielnicę. Nie ma jednego momentu zwycięstwa: liczą się pieniądze, reputacja i przetrwanie." },
  { title: "Jak to działa", body: "W zakładce Zlecenia bierz roboty, za zarobione pieniądze kupuj broń, pancerz i pojazdy w Sklepie, a na Ulicy przejmuj narożniki lub wywieraj presję na dzielnice. W Nieruchomościach rozwijaj punkt dilerski. Czas płynie w czasie rzeczywistym; możesz go przyspieszyć przez ×N lub przeskoczyć godzinę." },
  { title: "Sterowanie", body: "Zakładki na dole ekranu telefonu lub po lewej stronie na komputerze prowadzą do paneli Ja, Zlecenia, Sklep, Nieruchomości, Ulica, Życie i Klinika. Ikona dziennika pokazuje ostatnie wydarzenia." },
  { title: "Zasoby i wskaźniki", body: "Amunicja i siły oznaczają energię, racon i charyzma — wytrzymałość, zdrowie — stan postaci, a presja policji pokazuje, jak bardzo depcze ci ona po piętach. Gdy presja policji rośnie, nasilają się patrole i presja rywali. Kasę, inwestycje, reputację i fundusz łapówek znajdziesz w szczegółach." },
  { title: "Postępy", body: "Za zlecenia zdobywasz XP i awansujesz; każda ranga ma własny przydomek. Sezon trwa 14 dni, a jego wynik rośnie wraz z postępami. Kupuj dzielnice i rozwijaj punkty, by regularnie zbierać haracz." },
  { title: "Ryzyko i straty", body: "Jeśli zdrowie spadnie poniżej 20 lub zostaniesz złapany, trafisz do kliniki albo aresztu i przez ten czas nie wykonasz zleceń. Fundusz łapówek może skrócić pobyt w areszcie. Przy dużej presji policji gotówka, której nie wpłacisz do kasy, jest na ulicy zagrożona." },
  { title: "Zapisy", body: "Na tym urządzeniu masz trzy miejsca zapisu. Aktywne miejsce zapisuje się automatycznie; przyciskiem zapisu na pasku możesz zmienić miejsce, zapisać ręcznie lub usunąć zapis. Po zalogowaniu postępy są dodatkowo zapisywane w chmurze. Gra jako gość pozostaje tylko na tym urządzeniu." },
  { title: "Na początek", body: "Wykonaj kilka zleceń i nie wychodź na ulicę bez broni. Jeśli presja policji wzrośnie, przeczekaj jakiś czas. Wcześnie otwórz punkt dilerski: regularny dochód robi dużą różnicę. Wyrób sobie nawyk wpłacania gotówki do kasy." },
  { title: "Ważna informacja", body: "To fikcja, która nie zachęca do prawdziwego hazardu, narkotyków ani przemocy. Hazard i wizyty w barze w zakładce Życie również są fikcyjnymi elementami gry." },
];

export function HelpPanel({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const { lang, t } = useLang();
  const sections = lang === "pl" ? SECTIONS_PL : lang === "en" ? CETE_HELP_EN : SECTIONS;
  const how = t("common.howTo", "Nasıl Oynanır");
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-label={how}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-4" />
        <span className="hidden sm:inline">{how}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{how}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 grid gap-4">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="text-sm font-semibold text-accent">{section.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{section.body}</p>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
