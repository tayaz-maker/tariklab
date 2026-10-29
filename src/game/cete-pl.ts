/** Polish presentation copy keyed by existing content IDs. Canonical game data stays unchanged. */
export const PL_ITEMS: Record<string, { name: string; desc: string }> = {
  w101: { name: "Rozbita butelka Efes", desc: "Spod lokalu: nie kieliszek, lecz butelka. Wciąż się przyda." },
  w102: { name: "Nóż motylkowy (karambit)", desc: "Za paskiem tiktokowych twardzieli. Mieści się w kieszeni i budzi respekt." },
  w103: { name: "Canik TP9 bez numeru", desc: "Nielegalna produkcja, bez numeru. Może się zaciąć przy strzale." },
  w104: { name: "Sarsılmaz SAR9 Mega", desc: "Krajowa produkcja, kabura przy pasie. Położony na biurku ucina rozmowę." },
  w105: { name: "Draco (krótki AK)", desc: "Krótka lufa z tylnego siedzenia Range Rovera. Broń do konwoju, nie na osiedle." },
  w106: { name: "Sarsılmaz kaliber 12", desc: "Krótka strzelba pompka. Przemawia zza drzwi." },
  w107: { name: "Glock 19 (kopia)", desc: "Nie z Austrii, tylko z nielegalnego warsztatu. Ale na stole robi wrażenie." },
  a101: { name: "Kurtka Stone Island i różaniec", desc: "Kompas na ramieniu, różaniec w dłoni. Mundur Stambułu lat dwudziestych." },
  a102: { name: "Kamizelka balistyczna pod bluzą", desc: "Płyty pod kurtką North Face. Z zewnątrz sportowo, pod spodem pancerz." },
  a103: { name: "Opancerzony garnitur", desc: "Krój Loro Piana, w środku kevlar. Nada się na pogrzeb i na akcję." },
  a104: { name: "Gogle i kurtka CP Company", desc: "Lustrzane szkła, puchowa kurtka. Mundur twardziela z 2024 roku." },
  a105: { name: "Kaszmirowy płaszcz szefa", desc: "Zima, wiatr i reputacja. Płyt w nim nie ma, ale wygląda dostojnie." },
  v101: { name: "Kradziony Fiat Egea", desc: "Fałszywe tablice i niskie felgi. W sam raz, by zniknąć w wąskich uliczkach." },
  v102: { name: "BMW 520d z przyciemnionymi szybami", desc: "Służbowe tablice, bez koguta. Fotoradar to jedno, kontrola drogowa to drugie." },
  v103: { name: "Opancerzony Range Rover", desc: "Na czele konwoju. Folia na szybach i pancerz są nielegalne, ale nie ma zatrzymywania." },
  v104: { name: "Mercedes Vito dla ekipy", desc: "Pusty tył i przesuwne drzwi. Ten sam wóz na objazd dzielnicy i ucieczkę." },
  v105: { name: "Honda Forza bez tablic", desc: "Wąskie uliczki, chodnik, jedna osoba. Jeśli cię złapią, motor cię nie uratuje." },
  v106: { name: "Togg T10X z fałszywymi papierami", desc: "Krajowy elektryk z fałszywym dowodem. Fotoradar nadal łapie, a ładowanie to osobny kłopot." },
  v107: { name: "Mercedes E200 z przyciemnionymi szybami", desc: "Dyskretna limuzyna. Kierowca z przodu, ty z tyłu." },
  v108: { name: "Kradziony rower", desc: "Wąska uliczka, jeden bieg. Jeśli cię złapią, pedały cię nie uratują." },
  v109: { name: "Porsche 911 z fałszywymi papierami", desc: "Wyjazd spod Kanyon. Fotoradar błyska, ale ty już skręcasz." },
  v110: { name: "Śmigłowiec z nielegalnego lądowiska", desc: "Pas pod Silivri. Korków nie ma, radar to inna sprawa." },
  l101: { name: "iPhone 17 Pro Max", desc: "Tytanowa obudowa; stłuczona szyba to osobna sprawa. Leży na stole i budzi rozmowy." },
  l102: { name: "Rolex Datejust", desc: "Stal na nadgarstku. Nikt nie pyta o godzinę, wszyscy patrzą." },
  l103: { name: "Złoty łańcuch i bransoleta", desc: "Jubiler waży, dzielnica nie. Ma się błyszczeć i tyle." },
  l104: { name: "PS5 i telewizor 85 cali", desc: "Domowa wersja salonu do gry w okey. FIFA, szisza i kasa z tyłu." },
  l105: { name: "Zestaw Air Jordan / CP", desc: "Pudełka pełne, metki na miejscu. Do zdjęcia." },
  l106: { name: "Patek Nautilus (podróbka)", desc: "Na nadgarstek barona. Podróbka czy nie, szkło tak nie błyszczy bez powodu." },
};
export const PL_JOBS: Record<string, { name: string; desc: string }> = {
 j101:{name:"Okradanie pijanych pod lokalem",desc:"Podbieraj portfele tym, którzy wydali wszystko na hostessy i zasnęli."},
 j102:{name:"Nielegalne kasyno i bingo",desc:"Postaw czujkę przy wejściu i prowadź nielegalne bingo, zanim wpadnie policja."},
 j103:{name:"Dilerskie dostawy po dzielnicy",desc:"Dostawy Egeą między ulicami. Bez pinezek: z ręki do ręki, z czujką."},
 j109:{name:"Kopia terminala / kasa",desc:"Sklonuj terminal w kiosku. Małe wypłaty, żadnych dużych śladów."},
 j110:{name:"Złom miedziany i kable",desc:"Noc na budowie, szpula kabla, gotówka od złomiarza. Hałas działa na twoją niekorzyść."},
 j106:{name:"Telefon w fałszywym pudełku (Merter)",desc:"Zamknięte pudełko po iPhonie, w środku cegła. Kupiec z Telegramu, odbiór w Merter."},
 j107:{name:"Windykacja nielegalnych zakładów",desc:"Odwiedź tych, którzy mają ujemne saldo na stronie. Bez przelewów, tylko gotówka."},
 j108:{name:"Haracz z budowy",desc:"Brygadzista wpisze to jako ochronę. Ty pijesz herbatę, kasa się zapełnia."},
 j111:{name:"Fałszywa reklama zakładów",desc:"Na Instagramie kupon z pewną wygraną. Strona nie płaci, ty bierzesz prowizję."},
 j112:{name:"Fałszywa wycena w komisie",desc:"Cofnij licznik, ukryj uszkodzenia i wystaw auto jako bezwypadkowe na sahibinden."},
 j104:{name:"Wojna o przetarg i groźby",desc:"Odwiedź biuro wykonawcy startującego w miejskim przetargu i każ mu się wycofać."},
 j105:{name:"Przemyt przez urząd celny (Ambarlı)",desc:"Kontener o północy, koperta dla urzędnika, GPS w ciężarówce. Wyjazd z Ambarlı."},
 j113:{name:"Napad na willę i sejf",desc:"Zbocze w Sarıyer, martwe pole kamery, sejf w ścianie. Pies to osobna sprawa."},
 j114:{name:"Kradzież u jubilera na Wielkim Bazarze",desc:"Witryna przed zamknięciem rolet. Złoto na gramy i ucieczka przez Eminönü."},
};
export const PL_JOB_TIERS: Record<number,string> = {1:"Drobny handel i rogi ulic",2:"Kontrola dzielnicy",3:"Droga do pozycji barona"};
export const PL_CONTRACTS: Record<string,string> = {
 c101:"Pod lokalem zrobił się bałagan. Zajmij się pijakiem, ja płacę.",
 c102:"Dziś ty prowadzisz stolik. Podobno policja jest w innej dzielnicy.",
 c103:"Trzy przystanki. Egea jest gotowa. Wyślę ci adresy, ty dostarczysz towar.",
 c106:"Pudełko czeka w Merter. Kupiec jest na Telegramie. O cegle ani słowa.",
 c107:"Ktoś ma ujemne saldo na stronie. Ściągnij gotówkę, bez przelewów.",
 c108:"Na budowie wpiszą to jako ochronę. Pij herbatę i pozwól kasie rosnąć.",
 c104:"Facet od przetargu nie chce ustąpić. Odwiedź jego biuro. Range czeka na dole.",
 c105:"Noc w Ambarlı. Kontener, koperta, GPS wyłączony. Wiesz, co robić.",
 c109:"Sklonuj terminal na jedną noc. Małe wypłaty, bez śladów.",
 c110:"Miedź jest dziś w nocy. Zabierz szpulę.",
 c111:"Strona z kuponami gotowa. Puść reklamę, a ja wypłacę prowizję.",
 c112:"W komisie trzeba cofnąć licznik. Wpiszemy, że bezwypadkowy.",
 c113:"Sejf w Sarıyer. Jest pies, ale kamera ma martwe pole.",
 c114:"Na bazar, zanim opuszczą rolety. Złoto jest twoje.",
};
export const PL_HOODS: Record<string,{blurb:string;perk:string}> = {
 eyup:{blurb:"Przy wyjściu z mauzoleum: turyści i fałszywe różańce. W tłumie łatwo zniknąć.",perk:"Szansa powodzenia w klubie i bingo +6%"},
 tarlabasi:{blurb:"Wąskie uliczki, niski Tofaş i uliczne rogi. Jest gdzie uciec.",perk:"Limit energii +4. Punkt dilerski +20%"},
 kadikoy:{blurb:"Przystań w Modzie, bary i twardziele. Tutaj kończy się noc.",perk:"Dochód z nieruchomości +15%"},
 sultangazi:{blurb:"Sąsiedzka sieć, weksle i okey. Pieniądze płyną po cichu.",perk:"Atak +5"},
};
export const PL_ESTATES: Record<string, {name:string;desc:string}> = {
 r105:{name:"Osiedlowy fryzjer",desc:"Strzyżenie za gotówkę, herbata gratis. Zwrot po około 88 godzinach."},
 r101:{name:"Salon PlayStation i okey",desc:"Herbata, FIFA i pokątna gra w karty. Zwrot po około 89 godzinach."},
 r106:{name:"Nielegalna kawiarnia z sziszą",desc:"Piec, węgiel i zaplecze. Zwrot po około 91 godzinach."},
 r102:{name:"Lounge w Eyüp",desc:"Hostessy, DJ i kasa. Zwrot po około 92 godzinach."},
 r107:{name:"Magazyn celny w Dudullu",desc:"Pudła i wózek widłowy. Zwrot po około 94 godzinach."},
 r103:{name:"Biuro lichwiarza i komis",desc:"Weksle i używany Range. Zwrot po około 98 godzinach."},
 r104:{name:"Nielegalne kasyno nad Bosforem",desc:"Hazard dla VIP-ów. Zwrot po około 100 godzinach."},
 r201:{name:"Kawalerka w Kadıköy",desc:"Jeden pokój. Niski czynsz, zwrot po około 520 godzinach."},
 r202:{name:"Mieszkanie 3+1 w Ataşehir",desc:"Osiedle i basen. Zwrot po około 520 godzinach."},
 r108:{name:"Willa w Sarıyer",desc:"Widok i ogród. Zwrot po około 533 godzinach."},
 r203:{name:"Apartament nad wodą w Bebek",desc:"Bosfor i przeszklone ściany. Droższy od willi, zwrot po około 537 godzinach."},
 r204:{name:"Prywatna wyspa w Göcek",desc:"Pomost należy do ciebie. Zwrot po około 568 godzinach."},
};
export const PL_ASSETS: Record<string,{name:string;hint:string}> = {
 altin:{name:"Złoto w gramach",hint:"Wielki Bazar. Cena zmienia się powoli; złota nie można zrabować."},
 usd:{name:"Dolar",hint:"Dolary schowane pod materacem. Na ulicy szukają gotówki, nie papierów."},
 usdt:{name:"USDT",hint:"Portfel z ręki do ręki. Duże wahania, a łańcuch zostawia ślady."},
};
export const PL_CORNERS: Record<number,{name:string;desc:string}> = {
 1:{name:"Jeden punkt",desc:"Jedno skrzyżowanie i tygodniowy dochód. Policja może przerwać działalność nalotem."},
 2:{name:"Sieć w dzielnicy",desc:"Kilka punktów pod jednym zarządem. Rosną zyski i liczba patroli."},
 3:{name:"Rejonowa sieć",desc:"Cały rejon jest twój. Duży tygodniowy dochód, ale i dotkliwe naloty."},
};
export const PL_CREW: Record<string,{role:string;perk:string}> = {
 gozcu:{role:"Wejście / czujka",perk:"Ryzyko zatrzymania −18%. Naloty i zdrady zdarzają się rzadziej."},
 sofor:{role:"Ucieczka",perk:"Koszt energii zleceń −2."},
 tahsil:{role:"Haracz / weksle",perk:"Dochód z nieruchomości i dzielnic +15%."},
 tetik:{role:"Racon",perk:"Atak +10. Starcia na ulicy kończą się szybciej."},
 avukat:{role:"Dokumenty / areszt",perk:"Ryzyko zatrzymania −25%. Łapówki kosztują mniej."},
};
export const PL_CREW_NAMES: Record<string,string> = {gozcu:"Czujka Selim",sofor:"Kierowca Kenan",tahsil:"Windykatorka Leyla",tetik:"Strzelec Rıdvan",avukat:"Adwokat Cemil"};
export const PL_RIVAL_TITLES: Record<string,string> = {
 "Galata kabadayısı":"Twardziel z Galaty",
 "Kaçak kumar işletmecisi":"Właściciel nielegalnego kasyna",
 "Telegram dolandırıcısı":"Oszust z Telegramu",
 "Tarlabaşı torbacısı":"Diler z Tarlabaşı",
 "İhale aracısı":"Pośrednik przetargowy",
 "Tetikçi":"Strzelec",
 "Liman gözcüsü":"Czujka w porcie",
 "Pavyon patronu":"Szef lokalu",
 "Boğaz'ın sessiz ortağı":"Cichy wspólnik znad Bosforu",
 "Sanayi kabadayısı":"Twardziel z dzielnicy przemysłowej",
 "Tarlabaşı kiralık öfke":"Najemna siła z Tarlabaşı",
 "Senet tahsildarı":"Windykator weksli",
 "Lounge kasa ortağı":"Wspólnik od kasy w lounge",
};
export const PL_LIFE_ACTS: Record<string,{title:string;desc:string}> = {
 bira:{title:"Wypij piwo",desc:"Zimna butelka przy rogu. Zdrowie i racon rosną, presja policji nieco spada."},
 raki:{title:"Stolik z rakı",desc:"Białe i zimne. Stawia na nogi i rozwiązuje język."},
 esrar:{title:"Dym",desc:"Na zapleczu. Zdrowie i energia rosną, presja policji spada."},
 pavyon:{title:"Noc w lokalu",desc:"Światła sceny, hostessy i rachunek. Ludzie będą o tobie mówić; partnerka może się ochłodzić."},
 okey:{title:"Okey / karty",desc:"Para siódemek albo brak odpowiedniego kamienia. Stawka zależy od poziomu."},
};
export const PL_PARTNERS: Record<string,{title:string;desc:string}> = {
 p1:{title:"DJ-ka w lounge",desc:"Słuchawki na szyi, noc w Galacie. Mówi krótko i konkretnie."},
 p2:{title:"Aplikantka adwokacka",desc:"Biuro w Levent i zapach akt. Potrafi przełożyć racon na język sądu."},
 p3:{title:"Sprzedawczyni w komisie",desc:"Nie ogłoszenie, lecz wystawa. Ona sprzedaje Range'a, ty patrzysz."},
 p4:{title:"Kasa w lokalu",desc:"To ona pilnuje rachunków. Gdy siada przy stole, cała dzielnica o tym wie."},
};

/** Render the existing outcome values without changing the recorded outcome or save. */
export function describePolishOutcome(moment: import('./outcome-moment').OutcomeMoment, tickMinutes: number) {
 const signed = (value:number) => `${value > 0 ? '+' : ''}${new Intl.NumberFormat('pl-PL',{maximumFractionDigits:1}).format(value)}`;
 const titles = {contract:'KONTRAKT ZAMKNIĘTY',first:'PIERWSZE ZLECENIE',operation:'SIEĆ PO OPERACJI',rank:'NOWY PRÓG'};
 const title=titles[moment.kind];
 return {
  title,
  summary:`${title}. Gotówka ${signed(moment.cash)} ₺. Reputacja ${signed(moment.reputation)}. Presja ${signed(moment.pressure)}.`,
  crewSummary:moment.crew.count ? `Osoby z ekipy na zleceniu: ${moment.crew.count} · będą wolne za ${moment.crew.ticks * tickMinutes} min czasu gry.` : 'Nie przydzielono nowych osób z ekipy.',
  delaySummary:moment.reactions.count ? `Liczba uruchomionych lub przedłużonych liczników reakcji: ${moment.reactions.count}; ${moment.reactions.minTicks * tickMinutes}–${moment.reactions.maxTicks * tickMinutes} min czasu gry. Gdy jesteś na wolności i masz ponad 200 ₺, zagrożone są gotówka i zdrowie.` : 'Brak nowego licznika reakcji; dotychczasowe zagrożenia pozostają.',
 };
}
