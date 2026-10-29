import { ALL_ITEMS, ALL_MISSIONS, CONTRACTS, ESTATES, JOB_FLAVOR } from "./data";
import { PL_CONTRACTS, PL_ESTATES, PL_ITEMS, PL_JOBS } from "./cete-pl";
import { PL_JOB_FLAVOR } from "./cete-pl-job-flavor";

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
 [/^Okey masası\. Çift 7\. \+(.+) ₺$/, n=>`Stolik do okey. Para siódemek. +${n} ₺`],
 [/^Okey masası\. Taş gelmedi\. −(.+) ₺$/, n=>`Stolik do okey. Nie trafił się potrzebny kamień. −${n} ₺`],
 [/^Slot (\S+) (\S+) (\S+)\. (Tuttu|Boş)\. ([+−].+ ₺)$/, (a,b,c,result,amount)=>`Automat: ${[a,b,c].map(x=>({ÜZÜM:"WINOGRONA",KIRAZ:"WIŚNIA",AT:"KOŃ"} as Record<string,string>)[x] ?? x).join(' ')}. ${result==='Tuttu'?'Wygrana':'Pusto'}. ${amount}`],
 [/^Kazı kazan\. (Altın çizgi|Çizgi boş)\. ([+−].+ ₺)$/, (result,amount)=>`Zdrapka. ${result==='Altın çizgi'?'Złota linia':'Pusta linia'}. ${amount}`],
 [/^Rulet (\d+)\. Sen (\d+)\. (Tek sayı tuttu|Yok)\. ([+−].+ ₺)$/, (n,guess,result,amount)=>`Ruletka: ${n}. Twój numer: ${guess}. ${result==='Tek sayı tuttu'?'Trafiony numer':'Nietrafiony'}. ${amount}`],
 [/^Rulet (\d+) (yeşil|kırmızı|siyah)\. ([+−].+ ₺)$/, (n,color,amount)=>`Ruletka: ${n}, ${({yeşil:'zielone',kırmızı:'czerwone',siyah:'czarne'} as Record<string,string>)[color]}. ${amount}`],
 [/^Blackjack\. 22\. Yandın\. ([+−].+ ₺)$/, amount=>`Blackjack. 22 — przekroczyłeś limit. ${amount}`],
 [/^Blackjack\. Krupiye yandı\. ([+−].+ ₺)$/, amount=>`Blackjack. Krupier przekroczył limit. ${amount}`],
 [/^Blackjack\. (\d+)–(\d+)\. (Masa senin|Berabere, bahis döndü|Krupiye aldı)\. ([+−].+ ₺)$/, (a,b,result,amount)=>`Blackjack. ${a}–${b}. ${{'Masa senin':'Wygrywasz','Berabere, bahis döndü':'Remis, stawka zwrócona','Krupiye aldı':'Wygrywa krupier'}[result]}. ${amount}`],
 [/^(.+) ile gece\. Sabah ağız kokusu, gönül ısındı\.( Sabah haber: çocuk\. Kapıda üç yol var\.)?$/, (name,news)=>`Noc z ${name}. Rano nieświeży oddech, ale uczucie cieplejsze.${news?' Rano wiadomość: dziecko. Masz trzy możliwości.':''}`],
 [/^(.+) ile nikâh\. Çocuk (\d+)\. Mahalle alkışladı, sen damat oldun, racon ağırlaştı\.$/, (name,n)=>`Ślub z ${name}. Liczba dzieci: ${n}. Dzielnica bije brawo; zostajesz panem młodym i zyskujesz racon.`],
 [/^Gizledin\. Çocuk (\d+), masraf saatte kesilir, mahalle resmen duymadı, gayriresmen herkes biliyor\.$/, n=>`Ukrywasz sprawę. Liczba dzieci: ${n}; wydatki naliczane są co godzinę. Oficjalnie dzielnica nic nie słyszała, nieoficjalnie wszyscy wiedzą.`],
 [/^Yoktun, duymadın, görmedin\. (.+) kapıyı çarptı\. İtibar ve racon yerlerde\.$/, name=>`Nic nie widziałeś, nic nie słyszałeś. ${name} trzasnęła drzwiami. Reputacja i racon spadły.`],
 [/^Canın sıfırlandı\. Mafya doktorunun gizli kliniğine kaldırıldın\. Tedavi (.+) ₺ — nakitinin yüzde 15'i\.$/, n=>`Zdrowie spadło do zera. Trafiasz do tajnej kliniki mafijnego lekarza. Leczenie: ${n} ₺ — 15% twojej gotówki.`],
 [/^(.+) referansı\. İkinize de 5\.000 ₺ — bir kez\.$/, name=>`Polecenie od ${name}. Oboje otrzymujecie jednorazowo po 5 000 ₺.`],
 [/^(.+) yere serildi\. (.+) ₺ gasp edildi\.( Hayalet Canik tutukluk yaptı\.)?$/, (name,n,jam)=>`${name} został(a) powalony(a). Zabrano ${n} ₺.${jam?' Canik bez numeru się zaciął.':''}`],
 [/^(.+) raconu kesti\. (.+) ₺ kaptırdın\.( Hayalet Canik tutukluk yaptı\.)?$/, (name,n,jam)=>`${name} wygrał(a) starcie. Straciłeś ${n} ₺.${jam?' Canik bez numeru się zaciął.':''}`],
 [/^(.+) ölüm listesine yazıldı\. Ödül (.+) ₺\. Saat ilerleyince sokak mermi kusar\.$/, (name,n)=>`${name} trafia na listę. Nagroda: ${n} ₺. Z czasem ulica przejdzie do działania.`],
 [/^Topuktan vurma emri tamam\. (.+) düştü\. Ödül (.+) ₺\.$/, (name,n)=>`Zlecenie wykonane. ${name} pada. Nagroda: ${n} ₺.`],
 [/^(.+) basıldı\. Kontrol %(.+)\. Haraç (.+) ₺ cebine\.(.*)$/, (hood,control,cash,note)=>`Przejęto róg w ${hood}. Kontrola ${control}%. Haracz ${cash} ₺ trafia do kieszeni.${({"":"", " Yarı semt sende — haraç şişti.":" Połowa dzielnicy jest twoja — haracz wzrósł.", " Ağır el. Saldırı ve iş açıldı.":" Silna pozycja. Odblokowano atak i zlecenia.", " Semt kapandı. Haraç +%20.":" Dzielnica jest pod kontrolą. Haracz +20%."} as Record<string,string>)[note] ?? note}`],
 [/^(.+) bölgesinde baskı kurdu\. Kontrol −1,4 puan\. Serbest gözcü, tetikçi ve zırh baskıyı azaltır\.$/, name=>`${name}: presja w dzielnicy. Kontrola −1,4 punktu. Wolna czujka, strzelec i pancerz zmniejszają presję.`],
 [/^(.+) emniyet yüksekken semti taradı\. Cebinden (.+) ₺ kaptı\.$/, (name,n)=>`${name} przeczesuje dzielnicę przy wysokiej presji policji. Zabrano ci ${n} ₺.`],
 [/^(.+) çalıştı\. Hız (.+), form (.+)\.$/, (name,speed,form)=>`${name}: trening zakończony. Prędkość ${speed}, forma ${form}.`],
 [/^(.+) senin\. Veliefendi defterine yazıldı\.$/, name=>`${name} należy do ciebie. Koń wpisany do rejestru Veliefendi.`],
 [/^(.+) birinci\. Kupa ve (.+) ₺\.$/, (name,n)=>`${name} zajmuje pierwsze miejsce. Puchar i ${n} ₺.`],
 [/^(.+) geride kaldı\. Form düştü\.$/, name=>`${name} zostaje w tyle. Forma spada.`],
 [/^Yeni sezon\. Unvan: (.+)\. \+(.+) ₺$/, (title,n)=>`Nowy sezon. Tytuł: ${title === "İstanbul'un babası"?'Ojciec Stambułu':title === 'Sezon bitti'?'Koniec sezonu':title}. +${n} ₺`],
 [/^Kıdem yükseldi: (.+)$/, rank=>`Awans: ${({"Çaylak":"Nowicjusz","Köşe Başı":"Szef rogu","Mahalle Kabadayısı":"Dzielnicowy osiłek","Tetikçi":"Strzelec","Kabadayı":"Osiłek","Ağabey":"Starszy brat","Bölge Patronu":"Szef dzielnicy","Baron":"Baron","Baba":"Ojciec chrzestny"} as Record<string,string>)[rank] ?? rank}`],
 [/^Başarım: (.+)$/, achievement=>`Osiągnięcie: ${({"İlk milyon":"Pierwszy milion","100 iş":"100 zleceń","Dört semt":"Cztery dzielnice","İstanbul'un babası":"Ojciec Stambułu","7 günlük seri":"Seria 7 dni"} as Record<string,string>)[achievement] ?? achievement}`],
 [/^(.+), Çaylak olarak (.+) sokaklarına indi\. Elinde kırık bir Efes şişesi, cebin bomboş\. İş yapmadan ₺ basmaz\.$/, (name,hood)=>`${name} zaczyna jako nowicjusz na ulicach ${hood}. W ręku rozbita butelka Efes, kieszenie puste. Bez zleceń nie ma pieniędzy.`],
 [/^(.+)'e (.+) ₺ senet\. İki güne (.+) ₺ döner\.$/, (name,principal,due)=>`Weksel dla ${name}: ${principal} ₺. Za dwa dni wróci ${due} ₺.`],
 [/^(\d+(?:[.,]\d+)?) (gram altın|dolar|USDT) alındı\. (.+) ₺\.$/, (qty,label,price)=>`Kupiono ${qty} ${({"gram altın":"g złota","dolar":"dolarów","USDT":"USDT"} as Record<string,string>)[label] ?? label}. ${price} ₺.`],
 [/^(\d+(?:[.,]\d+)?) (gram altın|dolar|USDT) satıldı\. (.+) ₺\.$/, (qty,label,price)=>`Sprzedano ${qty} ${({"gram altın":"g złota","dolar":"dolarów","USDT":"USDT"} as Record<string,string>)[label] ?? label}. ${price} ₺.`],
 [/^İhanet\. İtibar düşükken (.+) defteri emniyete sızdırdı, (.+) ₺ ile kayboldu\.$/, (name,n)=>`Zdrada. Przy niskiej reputacji ${name} przekazał(a) dziennik policji i zniknął(a) z ${n} ₺.`],
 [/^İhanet riski tuttu\. (.+) (.+) ₺ kesti, semti ısıttı\.$/, (name,n)=>`Doszło do zdrady. ${name} zabrał(a) ${n} ₺ i zwrócił(a) uwagę na dzielnicę.`],
 [/^Veliefendi: (.+) birinci\. (.+) (tuttu|kaldı)\. ([+−].+ ₺)$/, (winner,horse,result,amount)=>`Veliefendi: wygrywa ${winner}. ${horse}: ${result==='tuttu'?'trafiony zakład':'nietrafiony zakład'}. ${amount}`],
 [/^(.+) gitti\. Avukat kesti, mahalle konuştu\.$/, name=>`${name} odeszła. Adwokat pobrał opłatę, a dzielnica plotkuje.`],
];
export function polishLog(text:string):string {
 if (Object.hasOwn(exact,text)) return exact[text]!;
 for (const mission of ALL_MISSIONS) {
  const prefix = `${mission.name} — `;
  if (!text.startsWith(prefix)) continue;
  const source = JOB_FLAVOR[mission.id];
  const translated = PL_JOB_FLAVOR[mission.id];
  if (!source || !translated || !PL_JOBS[mission.id]) break;
  const rest = text.slice(prefix.length);
  for (const result of ["win", "lose"] as const) {
   for (let i = 0; i < source[result].length; i++) {
    const flavor = source[result][i]!;
    if (!rest.startsWith(flavor) || !translated[result][i]) continue;
    const tail = rest.slice(flavor.length);
    const win = /^ \+(.+) ₺\.(?: (.+) bonus (.+) ₺\.)? Emniyet (\d+)\.$/.exec(tail);
    let ending: string | null = win ? ` +${win[1]} ₺.${win[2] ? ` Premia od ${win[2]}: ${win[3]} ₺.` : ""} Presja policji: ${win[4]}.` : null;
    if (tail === " Yerde kaldın.") ending = " Upadasz na ziemię.";
    if (tail === " Polis yakaladı. Bir saat nezarethane. Zarfı Klinik'ten uzatabilirsin.") ending = " Policja cię złapała. Godzina w areszcie. Łapówkę możesz wręczyć w klinice.";
    const injury = /^ −(\d+) can\.$/.exec(tail);
    if (injury) ending = ` Zdrowie −${injury[1]}.`;
    if (ending !== null) return `${PL_JOBS[mission.id]!.name} — ${translated[result][i]}${ending}`;
   }
  }
  break;
 }
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
