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

export function HelpPanel({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const { lang, t } = useLang();
  const sections = lang !== "tr" ? CETE_HELP_EN : SECTIONS;
  const how = t("common.howTo", "Nasıl Oynanır");
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-label="Nasıl Oynanır"
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
