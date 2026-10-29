import { ALL_ITEMS, CONTRACTS, ESTATES } from "./data";
import { PL_CONTRACTS, PL_ESTATES, PL_ITEMS } from "./cete-pl";

/** Translate known historic Turkish log messages at render time; stored log entries remain untouched. */
const exact: Record<string,string> = {
 "Bir saat geçti. Sokak kendi işini gördü.":"Minęła godzina. Ulica żyła swoim życiem.",
 "Devriye köşeyi dağıttı. Haftalık yandı.":"Patrol rozbił punkt. Tygodniowy przychód przepadł.",
 "Ortalıklık yüksek. Villanın ışığı, lounge'ın kapısı — devriye sordu. Emniyet +3.":"Zbytnio rzucasz się w oczy. Światła willi i wejście do lokalu zwróciły uwagę patrolu. Presja policji +3.",
 "Doktor sırtını sıvazladı: dikişler tuttu, kalk git. Klinikten çıktın. Sağlık izi kaldı — can yavaş dolar.":"Lekarz poklepał cię po plecach: szwy trzymają, możesz iść. Opuszczasz klinikę. Po urazie zdrowie wraca wolniej.",
 "Nezarethanenin kapısı açıldı. Serbestsin.":"Drzwi aresztu się otworzyły. Jesteś na wolności.",
 "Gönül soğudu. Sevgili gitti.":"Uczucie wygasło. Partnerka odeszła.",
 "Tefeci Nuri notuna baktı. Kredi yok — önce senet kapat, itibar bas.":"Lichwiarz Nuri sprawdził twoją ocenę. Pożyczki nie będzie — najpierw spłać weksel i popraw reputację.",
 "Soğuk bira. Can açıldı, racon gevşedi.":"Zimne piwo. Zdrowie i racon wróciły do sił.",
 "Rakı masası. Kan yerine geldi, dil açıldı.":"Stolik z rakı. Wracasz do sił, język się rozwiązuje.",
 "Duman. Can doldu, emniyet düştü, mermi yerine geldi.":"Dym. Zdrowie i energia wzrosły, presja policji spadła.",
 "E-5 üzerinde çevrilme. Ehliyet yerine selam, tanıdık çıktı. −6 rüşvet bütçesi.":"Kontrola na E-5. Zamiast prawa jazdy wystarczyło pozdrowienie znajomego. Fundusz łapówek −6.",
 "Mahallede bir kavgayı ayırdın. Esnaf gruplarında adın döndü. +4 itibar.":"Rozdzieliłeś bójkę w dzielnicy. Kupcy rozmawiają o tobie w swoich grupach. Reputacja +4.",
 "Ekipler drone kaldırmış. Köşe başı bir süre ölü. −5 mermi & takat.":"Służby wysłały drona. Róg ulicy na jakiś czas zamiera. Energia −5.",
 "Düğün konvoyu semti kilitledi. Polis meşgul, sen görünür oldun. +4 racon.":"Konwój weselny zablokował dzielnicę. Policja jest zajęta, a ciebie zauważono. Racon +4.",
 "Instagram reels'ında suratın dönmüş. Mahalle gülüyor, racon incindi. −3 itibar.":"Twoja twarz trafiła na rolki na Instagramie. Dzielnica się śmieje, a racon ucierpiał. Reputacja −3.",
};
const patterns: Array<[RegExp, (...parts:string[])=>string]> = [
 [/^Yeni gün\. (\d+)\. gün sokakta\.$/, d=>`Nowy dzień. Dzień ${d} na ulicy.`],
 [/^Sezon kapandı\. Skor (\d+)\. Sokak unutur, sen unutma\.$/, n=>`Sezon dobiegł końca. Wynik: ${n}. Ulica zapomni, ty nie.`],
 [/^USDT (fırladı|çöktü)\. (.+) → (.+) ₺\.$/, (v,a,b)=>`USDT ${v==='fırladı'?'gwałtownie wzrósł':'gwałtownie spadł'}. ${a} → ${b} ₺.`],
 [/^Senet döndü\. (.+) (.+) ₺'yi kasaya yatırdı\.$/, (name,n)=>`Weksel spłacony. ${name} wpłacił(a) ${n} ₺ do kasy.`],
 [/^Senet ödenmedi\. (.+) faizle geldi\. Emniyet yükseldi, itibar düştü\. Kalan (.+) ₺ silindi\.$/, (name,n)=>`Weksel nie został spłacony. ${name} wrócił(a) po pieniądze z odsetkami. Presja policji wzrosła, reputacja spadła. Pozostałe ${n} ₺ umorzono.`],
 [/^Borç kapatıldı\. (.+) (.+) ₺ kesti\.$/, (name,n)=>`Dług spłacony. ${name}: pobrano ${n} ₺.`],
 [/^Köşe haftalık getirdi\. \+(.+) ₺\.$/, n=>`Tygodniowy dochód z punktu: +${n} ₺.`],
 [/^Rüşvet kasasına (.+) ₺ ayrıldı\.$/, n=>`Do funduszu łapówek odłożono ${n} ₺.`],
 [/^Emniyet amiri zarfı aldı\. Bu gece nezarethane yok\. −(.+) ₺$/, n=>`Komendant przyjął kopertę. Tej nocy ominie cię areszt. −${n} ₺`],
 [/^Kliniğe kendin gittin\. Doktor peşin istedi: (.+) ₺\. 40 dakika\.$/, n=>`Sam zgłosiłeś się do kliniki. Lekarz zażądał z góry ${n} ₺. Leczenie trwa 40 minut.`],
 [/^Kasaya (.+) ₺ indi\. Sokak bunu gasp etmez\.$/, n=>`Wpłacono ${n} ₺ do kasy. Tam pieniądze są bezpieczne przed napadem.`],
 [/^Kasadan (.+) ₺ çekildi\. Cebin ısındı\.$/, n=>`Wypłacono ${n} ₺ z kasy. Gotówka jest znów przy tobie.`],
 [/^Tefeci Nuri not (.+)\. (.+) ₺ uzattı\. İki güne (.+) ₺\.$/, (score,amount,due)=>`Ocena lichwiarza Nuriego: ${score}. Pożyczył ${amount} ₺. Za dwa dni do spłaty ${due} ₺.`],
 [/^(.+) esnaf barı\. Çay, lahmacun, kulağa laf\. Kontrol %(.+)\. −(.+) ₺\.$/, (hood,control,cost)=>`${hood}: spotkanie z kupcami. Herbata, lahmacun i rozmowy. Kontrola ${control}%. −${cost} ₺.`],
 [/^(.+) ihbarı boş döndü\. Muhbir yandı, emniyet ısındı\.$/, hood=>`Donos w ${hood} nie przyniósł skutku. Informator został spalony, presja policji wzrosła.`],
 [/^(.+) ihbarı işledi\. (.+) kliniğe çekildi\. Semt %4 açıldı, emniyet yükseldi\.$/, (hood,name)=>`Donos w ${hood} zadziałał. ${name} trafił(a) do kliniki. Kontrola dzielnicy +4%, presja policji wzrosła.`],
 [/^(.+) ekibe girdi\. Saatlik (.+) ₺ yer\.$/, (name,wage)=>`Do ekipy dołącza ${name}. Płaca: ${wage} ₺ na godzinę.`],
 [/^(.+) defterden silindi\.$/, name=>`${name}: usunięto z ekipy.`],
 [/^(.+) kademe (\d+)\. Saatlik gelir şişti\.$/, (name,level)=>`${name}: poziom ${level}. Dochód godzinowy wzrósł.`],
 [/^Köşe (\d+)\. kademe\. Haftalık döner\.$/, n=>`Punkt dilerski: poziom ${n}. Dochód wpływa co tydzień.`],
 [/^Günlük seri (\d+)\. \+(.+) ₺$/, (n,cash)=>`Dzienna seria: ${n}. +${cash} ₺`],
 [/^(.+) intikamını aldı\. Cebinden (.+) ₺ kaptı, sağlık izi açıldı\.$/, (name,n)=>`${name} się zemścił(a). Zabrał(a) ci ${n} ₺ i zostawił(a) ślad po urazie.`],
 [/^Listeyi başka bir ekip tamamladı: (.+) kliniğe kaldırıldı\. Ödül o ekibe gitti\.$/, name=>`Inna ekipa wykonała zlecenie z listy: ${name} trafił(a) do kliniki. Nagroda przypadła tamtej ekipie.`],
 [/^(.+) ile laf\. Gönül (.+)\.$/, (name,n)=>`Rozmowa: ${name}. Sympatia: ${n}.`],
 [/^(.+) hediyeyi aldı\. Gönül (.+)\.$/, (name,n)=>`${name} przyjęła prezent. Sympatia: ${n}.`],
 [/^(.+) ile akşam\. Masa, muhabbet, hesap sende\.$/, name=>`Wieczór z ${name}. Stolik, rozmowa i rachunek po twojej stronie.`],
 [/^(.+) ile ilişki başladı\. Mahalle duymuş\.$/, name=>`Związek z ${name} się rozpoczął. Dzielnica już wie.`],
 [/^(.+) ile bitti\.$/, name=>`Związek z ${name} się skończył.`],
 [/^(.+) ile nikâh\. Mahalle duymuş\. Mekan geliri biraz şişer\.$/, name=>`Ślub: ${name}. Dzielnica już wie. Dochód z lokali nieco wzrośnie.`],
 [/^Çocuk (\d+)\. Sünnet ileride, harcama şimdi\.$/, n=>`Liczba dzieci: ${n}. Uroczystość później, wydatki już teraz.`],
 [/^Eski bir dost, Telegram'dan yazıp borcunu getirdi\. \+(.+) ₺$/, n=>`Dawny znajomy napisał na Telegramie i oddał dług. +${n} ₺`],
 [/^Yolda çevirme\. Nakit aldılar\. −(.+) ₺$/, n=>`Kontrola drogowa. Zabrali gotówkę. −${n} ₺`],
 [/^Kimliği belirsiz biri araca taş attı, cam elini kesti\. −(.+) can\.$/, n=>`Nieznana osoba rzuciła kamieniem w samochód, a szkło rozcięło ci rękę. Zdrowie −${n}.`],
 [/^(.+) zabıta ve sivil ekipten yem oldu\. Ceza −(.+) ₺$/, (name,n)=>`${name}: straż miejska i funkcjonariusze po cywilnemu wystawili karę. −${n} ₺`],
 [/^Gece yarısı lounge çıkışı: masadan unutulan kart ve nakit\. \+(.+) ₺$/, n=>`Po północy przy wyjściu z lounge: karta i gotówka zostawione na stole. +${n} ₺`],
 [/^Kripto cüzdana yanlışlıkla düşen USDT'yi nakite çevirdin\. \+(.+) ₺$/, n=>`Wymieniłeś na gotówkę USDT omyłkowo przesłane do portfela. +${n} ₺`],
 [/^Sahte kurye kapıyı çaldı, "Trendyol iade" dedi\. −(.+) ₺$/, n=>`Fałszywy kurier zapukał i powiedział: „zwrot Trendyol”. −${n} ₺`],
 [/^HGS kaçak, EDS yedi\. Plaka senin değil ama ceza geldi\. −(.+) ₺$/, n=>`Nieopłacony przejazd i fotoradar. Tablica nie jest twoja, ale mandat przyszedł. −${n} ₺`],
 [/^Sokak spekülasyonu: (.+) için 18\.000 ₺ konuşuluyor\. Liste ısındı\.$/, name=>`Plotki na ulicy: za ${name} mówią o 18 000 ₺. Lista się rozgrzewa.`],
 [/^Karakola kumanya \+ karton çay\. Amirin hatırını aldın\. −(.+) ₺ · \+8 rüşvet$/, n=>`Proviant i karton herbaty dla komisariatu. Zyskałeś przychylność komendanta. −${n} ₺ · fundusz łapówek +8`],
];
export function polishLog(text:string):string {
 if (Object.hasOwn(exact,text)) return exact[text]!;
 for (const item of ALL_ITEMS) {
  const name = PL_ITEMS[item.id]?.name;
  if (!name) continue;
  if (text === `${item.name} alındı.`) return `Kupiono: ${name}.`;
  const prefix = `${item.name} elden çıkarıldı. +`;
  if (text.startsWith(prefix) && text.endsWith(" ₺")) return `Sprzedano: ${name}. +${text.slice(prefix.length)}`;
 }
 for (const estate of ESTATES) {
  const name = PL_ESTATES[estate.id]?.name;
  if (!name) continue;
  const prefix = `${estate.name} senin. Saatlik `;
  if (text.startsWith(prefix) && text.endsWith(" ₺ akar.")) return `Kupiono: ${name}. Dochód na godzinę: ${text.slice(prefix.length, -" ₺ akar.".length)} ₺.`;
 }
 for (const contract of CONTRACTS) {
  if (text === `${contract.npc} aradı: ${contract.text}` && PL_CONTRACTS[contract.id]) return `${contract.npc} dzwoni: ${PL_CONTRACTS[contract.id]}`;
 }
 for(const [pattern, render] of patterns){const match=pattern.exec(text);if(match)return render(...match.slice(1));}
 return text;
}
