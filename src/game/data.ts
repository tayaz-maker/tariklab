import type {
  ContractDef,
  CrewDef,
  CrewId,
  Estate,
  JobTier,
  Neighborhood,
  NeighborhoodId,
  Partner,
  Player,
  RaceEntry,
  Rival,
  ShopItem,
  InvestId,
  Market,
} from "./types";

export const NEIGHBORHOODS: Neighborhood[] = [
	{
		id: "eyup",
		name: "Eyüp",
		blurb: "Türbe çıkışı, turist, sahte tespih. Kalabalıkta kaybolursun.",
		perk: "Pavyon ve tombala işlerinde başarı +6%"
	},
	{
		id: "tarlabasi",
		name: "Tarlabaşı",
		blurb: "Dar sokak, basık Tofaş, köşe başı. Kaçacak delik çoktur.",
		perk: "Mermi & Takat tavanı +4. Torbacı köşesi +20%"
	},
	{
		id: "kadikoy",
		name: "Kadıköy",
		blurb: "Moda iskele, bar, kabadayı. Gece burada biter.",
		perk: "Emlak geliri +15%"
	},
	{
		id: "sultangazi",
		name: "Sultangazi",
		blurb: "Mahalle ağı, senet, okey. Para sessiz akar.",
		perk: "Saldırı +5"
	}
];
export const HOOD_IDS: NeighborhoodId[] = [
	"eyup",
	"tarlabasi",
	"kadikoy",
	"sultangazi"
];
export function hoodName(id: NeighborhoodId) {
	return NEIGHBORHOODS.find((n) => n.id === id)?.name ?? id;
}
export function migrateHood(id: string | undefined | null): NeighborhoodId {
	if (id === "karakoy") return "eyup";
	if (id === "zeytinburnu") return "kadikoy";
	if (id === "eyup" || id === "tarlabasi" || id === "kadikoy" || id === "sultangazi") return id;
	return "eyup";
}
export const JOB_TIERS: JobTier[] = [
	{
		tier: 1,
		title: "Torba Tutma ve Köşe Başları",
		missions: [
			{
				id: "j101",
				name: "Pavyon Çıkışı Sarhoş Soyma",
				energyCost: 4,
				rewardCashMin: 220,
				rewardCashMax: 520,
				xpGain: 2,
				risk: "Düşük",
				desc: "Konsomatrislere para saçıp sızan tiplerin cüzdanını tırtıkla."
			},
			{
				id: "j102",
				name: "Korsan Kumarhane ve Tombala Oynatmak",
				energyCost: 7,
				rewardCashMin: 650,
				rewardCashMax: 1700,
				xpGain: 5,
				risk: "Orta",
				desc: "Polis basmasın diye kapıya gözcü koy, kaçak tombala çevir."
			},
			{
				id: "j103",
				name: "Torbacılık ve Mahalle Dağıtımı",
				energyCost: 12,
				rewardCashMin: 2200,
				rewardCashMax: 5200,
				xpGain: 12,
				risk: "Yüksek",
				requiredItems: ["v101"],
				desc: "Egea ile sokak arası teslimat. Konum atma, elden teslim, dikiz."
			},
			{
				id: "j109",
				name: "POS Kopya / Yazar Kasa",
				energyCost: 5,
				rewardCashMin: 380,
				rewardCashMax: 980,
				xpGain: 3,
				risk: "Düşük",
				desc: "Büfe POS'una klon. Küçük çekimler, büyük iz bırakma."
			},
			{
				id: "j110",
				name: "Hurda Bakır ve Kablo",
				energyCost: 8,
				rewardCashMin: 850,
				rewardCashMax: 2400,
				xpGain: 6,
				risk: "Orta",
				desc: "Şantiye gece, kablo makarası, hurdacı nakit. Gürültü senin aleyhine."
			}
		]
	},
	{
		tier: 2,
		title: "Mahalle Kontrolü",
		missions: [
			{
				id: "j106",
				name: "Sahte Kutu Telefon (Merter)",
				energyCost: 14,
				rewardCashMin: 3500,
				rewardCashMax: 9500,
				xpGain: 16,
				risk: "Orta",
				desc: "Kapalı kutu iPhone, içi tuğla. Telegram'dan alıcı, Merter'den çıkış."
			},
			{
				id: "j107",
				name: "Kaçak Bahis Tahsilatı",
				energyCost: 18,
				rewardCashMin: 1e4,
				rewardCashMax: 26e3,
				xpGain: 24,
				risk: "Yüksek",
				requiredItems: ["w102"],
				desc: "Site bakiyesi eksiye düşenleri evinden kaldır. IBAN değil, nakit."
			},
			{
				id: "j108",
				name: "İnşaat Sahası Haraç",
				energyCost: 22,
				rewardCashMin: 16e3,
				rewardCashMax: 44e3,
				xpGain: 32,
				risk: "Yüksek",
				requiredItems: ["v101", "a101"],
				desc: "Kalfa 'güvenlik' diye yazar. Sen çay içersin, kasa dolar."
			},
			{
				id: "j111",
				name: "Sahte Bahis Reklamı",
				energyCost: 16,
				rewardCashMin: 5500,
				rewardCashMax: 15e3,
				xpGain: 18,
				risk: "Orta",
				desc: "Instagram'da 'kesin yatan' kupon. Ödemeyen site, sen komisyon."
			},
			{
				id: "j112",
				name: "Sahte Ekspertiz / Galeri",
				energyCost: 20,
				rewardCashMin: 13e3,
				rewardCashMax: 36e3,
				xpGain: 28,
				risk: "Yüksek",
				requiredItems: ["v101"],
				desc: "Kilometre düşür, hasar gizle, sahibinden'de 'hatasız' yaz."
			}
		]
	},
	{
		tier: 3,
		title: "Baronluğa Doğru Racon",
		missions: [
			{
				id: "j104",
				name: "İhale Savaşları ve Tehdit",
				energyCost: 30,
				rewardCashMin: 42e3,
				rewardCashMax: 105e3,
				xpGain: 45,
				risk: "Çok Yüksek",
				requiredItems: ["w104", "v102"],
				desc: "Belediye ihalesine giren müteahhidin ofisine kon, çekilmesini söyle."
			},
			{
				id: "j105",
				name: "Gümrükten Kaçak Mal Geçirme (Ambarlı)",
				energyCost: 50,
				rewardCashMin: 24e4,
				rewardCashMax: 62e4,
				xpGain: 110,
				risk: "Kritik",
				requiredItems: ["w105", "v103"],
				desc: "Gece yarısı konteyner, memura zarf, TIR'a GPS. Ambarlı çıkışı."
			},
			{
				id: "j113",
				name: "Villa ve Kasa Basma",
				energyCost: 36,
				rewardCashMin: 68e3,
				rewardCashMax: 175e3,
				xpGain: 60,
				risk: "Çok Yüksek",
				requiredItems: ["w104", "a102"],
				desc: "Sarıyer yamaç, kamera kör, kasa duvarda. Köpek ayrı mesele."
			},
			{
				id: "j114",
				name: "Kapalıçarşı Kuyum Tırnak",
				energyCost: 55,
				rewardCashMin: 32e4,
				rewardCashMax: 82e4,
				xpGain: 130,
				risk: "Kritik",
				requiredItems: ["w105", "v102"],
				desc: "Kepenk inmeden vitrin. Gram altın, kaçış Eminönü altı."
			}
		]
	}
];
export const ALL_MISSIONS = JOB_TIERS.flatMap((t) => t.missions);
export const WEAPONS: ShopItem[] = [
	{
		id: "w101",
		name: "Kırık Efes Şişesi",
		price: 0,
		attackBonus: 2,
		defenseBonus: 0,
		kind: "weapon",
		desc: "Lounge çıkışı, kadeh değil şişe. Hâlâ iş görür."
	},
	{
		id: "w102",
		name: "Kelebek Bıçak (Karambit)",
		price: 600,
		attackBonus: 9,
		defenseBonus: 1,
		kind: "weapon",
		desc: "TikTok kabadayılarının belinde. Cebe sığar, laf dinletir."
	},
	{
		id: "w103",
		name: "Hayalet Canik TP9",
		price: 3200,
		attackBonus: 24,
		defenseBonus: 5,
		kind: "weapon",
		desc: "Numarasız, merdiven altı. Tetikte tutukluk yapma riski var."
	},
	{
		id: "w104",
		name: "Sarsılmaz SAR9 Mega",
		price: 24e3,
		attackBonus: 58,
		defenseBonus: 14,
		kind: "weapon",
		desc: "Yerli üretim, bel holster. Ofis masasına kondu mu konuşma biter."
	},
	{
		id: "w105",
		name: "Draco (Kısa Namlulu AK)",
		price: 125e3,
		attackBonus: 155,
		defenseBonus: 42,
		kind: "weapon",
		desc: "Range Rover'ın arka koltuğundan çıkan kısa namlu. Mahalle değil, konvoy silahı."
	},
	{
		id: "w106",
		name: "Sarsılmaz 12 Kalibre",
		price: 9500,
		attackBonus: 36,
		defenseBonus: 4,
		kind: "weapon",
		desc: "Kısa namlu pompalı. Kapı arkasında konuşur."
	},
	{
		id: "w107",
		name: "Glock 19 (Klon)",
		price: 58e3,
		attackBonus: 88,
		defenseBonus: 18,
		kind: "weapon",
		desc: "Avusturya değil, merdiven altı. Yine de masada durur."
	}
];
export const ARMOR: ShopItem[] = [
	{
		id: "a101",
		name: "Stone Island Mont + Tespih",
		price: 12e3,
		attackBonus: 3,
		defenseBonus: 14,
		kind: "armor",
		desc: "Pusula omuzda, tespih parmakta. 2020'ler İstanbul'unun üniforması."
	},
	{
		id: "a102",
		name: "Plaka Yelek (Hoodie Altı)",
		price: 22e3,
		attackBonus: 0,
		defenseBonus: 48,
		kind: "armor",
		desc: "North Face altı sac. Dışarıdan spor, içeriden plaka."
	},
	{
		id: "a103",
		name: "Zırhlı Makam Takımı",
		price: 11e4,
		attackBonus: 16,
		defenseBonus: 145,
		kind: "armor",
		desc: "Loro Piana kesim, içi Kevlar. Cenazeye de gider, basmaya da."
	},
	{
		id: "a104",
		name: "CP Company Gözlük + Mont",
		price: 5500,
		attackBonus: 2,
		defenseBonus: 8,
		kind: "armor",
		desc: "Lens ayna, mont şişme. 2024 kabadayı üniforması."
	},
	{
		id: "a105",
		name: "Makam Palto (Kaşmir)",
		price: 42e3,
		attackBonus: 8,
		defenseBonus: 72,
		kind: "armor",
		desc: "Kış, rüzgar, itibar. İçinde plaka yok ama duruş var."
	}
];
export const VEHICLES: ShopItem[] = [
	{
		id: "v101",
		name: "Çalıntı Fiat Egea",
		price: 11e3,
		attackBonus: 6,
		defenseBonus: 6,
		kind: "vehicle",
		desc: "Sahte plaka, basık jant. Dar sokakta kaybolmanın güncel hali."
	},
	{
		id: "v102",
		name: "Siyah Camlı BMW 520d",
		price: 21e4,
		attackBonus: 28,
		defenseBonus: 44,
		kind: "vehicle",
		desc: "Makam plaka, çakarsız. EDS yese de çevirme ayrı mesele."
	},
	{
		id: "v103",
		name: "Zırhlı Range Rover",
		price: 82e4,
		attackBonus: 85,
		defenseBonus: 200,
		kind: "vehicle",
		desc: "Konvoyun önü. Cam film yasal değil, zırh paket yasal değil, durmak yok."
	},
	{
		id: "v104",
		name: "Mercedes Vito (Ekip)",
		price: 29e4,
		attackBonus: 40,
		defenseBonus: 70,
		kind: "vehicle",
		desc: "Koltuk arkası boş, sürgü kapı. Mahalle turu ve kaçış aynı araç."
	},
	{
		id: "v105",
		name: "Honda Forza (Plakasız)",
		price: 3800,
		attackBonus: 4,
		defenseBonus: 2,
		kind: "vehicle",
		desc: "Dar sokak, kaldırım, tek kişi. Yakalanırsan motor senden hızlı değil."
	},
	{
		id: "v106",
		name: "Togg T10X (Sahte)",
		price: 95e3,
		attackBonus: 18,
		defenseBonus: 28,
		kind: "vehicle",
		desc: "Yerli elektrikli, sahte ruhsat. EDS yine yer, şarj ayrı dert."
	},
	{
		id: "v107",
		name: "Mercedes E200 Cam Film",
		price: 42e4,
		attackBonus: 52,
		defenseBonus: 90,
		kind: "vehicle",
		desc: "Makamın sessiz hali. Şoför önde, sen arkada."
	},
	{
		id: "v108",
		name: "Çalıntı Bisiklet",
		price: 500,
		attackBonus: 0,
		defenseBonus: 0,
		kind: "vehicle",
		desc: "Dar sokak, tek vites. Yakalanırsan pedal senden hızlı değil."
	},
	{
		id: "v109",
		name: "Porsche 911 (Sahte Ruhsat)",
		price: 12e5,
		attackBonus: 70,
		defenseBonus: 110,
		kind: "vehicle",
		desc: "Kanyon çıkışı, EDS yer, sen çoktan sapmışsındır."
	},
	{
		id: "v110",
		name: "Helikopter (Kaçak Pist)",
		price: 48e5,
		attackBonus: 40,
		defenseBonus: 160,
		kind: "vehicle",
		desc: "Silivri kenarı pist. Trafik yok, radar ayrı mesele."
	}
];
export const LUXURY: ShopItem[] = [
	{
		id: "l101",
		name: "iPhone 17 Pro Max",
		price: 85e3,
		attackBonus: 0,
		defenseBonus: 0,
		kind: "luxury",
		itibarBonus: 6,
		desc: "Titanyum kasa, kırık cam ayrı. Masada durur, konuşulur."
	},
	{
		id: "l102",
		name: "Rolex Datejust",
		price: 32e4,
		attackBonus: 0,
		defenseBonus: 2,
		kind: "luxury",
		itibarBonus: 18,
		desc: "Bilekte çelik. Saat sormazlar, bakarlar."
	},
	{
		id: "l103",
		name: "Gram zincir + künye",
		price: 18e3,
		attackBonus: 1,
		defenseBonus: 0,
		kind: "luxury",
		itibarBonus: 4,
		desc: "Kuyumcu tartar, mahalle tartmaz. Parıldar yeter."
	},
	{
		id: "l104",
		name: "PS5 + 85 inç",
		price: 55e3,
		attackBonus: 0,
		defenseBonus: 0,
		kind: "luxury",
		itibarBonus: 5,
		desc: "Okey salonunun ev hali. FIFA, nargile, kasa arkada."
	},
	{
		id: "l105",
		name: "Air Jordan / CP set",
		price: 8500,
		attackBonus: 0,
		defenseBonus: 1,
		kind: "luxury",
		itibarBonus: 3,
		desc: "Ayakkabı kutusu dolu, etiket duruyor. Fotoğraf için."
	},
	{
		id: "l106",
		name: "Patek Nautilus (sahte seri)",
		price: 14e5,
		attackBonus: 0,
		defenseBonus: 4,
		kind: "luxury",
		itibarBonus: 42,
		desc: "Baron bileği. Sahte olsa da cam öyle parlamaz."
	}
];
export const ALL_ITEMS = [
	...WEAPONS,
	...ARMOR,
	...VEHICLES,
	...LUXURY
];
export const ITEM_MAP: Record<string, ShopItem> = Object.fromEntries(
	ALL_ITEMS.map((i) => [i.id, i]),
);
export const ESTATES: Estate[] = [
	{
		id: "r105",
		name: "Mahalle Berberi / Tıraş",
		cost: 15000,
		hourlyIncome: 170,
		kind: "is",
		desc: "Tıraş nakit, çay ikram. İş ~88 saat amorti.",
	},
	{
		id: "r101",
		name: "PlayStation & Okey Salonu",
		cost: 32000,
		hourlyIncome: 360,
		kind: "is",
		desc: "Çay, FIFA, el altı kâğıt. ~89 saat amorti.",
	},
	{
		id: "r106",
		name: "Nargile Cafe (Kaçak)",
		cost: 75000,
		hourlyIncome: 820,
		kind: "is",
		desc: "Ocak, kömür, arka oda. ~91 saat amorti.",
	},
	{
		id: "r102",
		name: "Eyüp Lounge / Pavyon",
		cost: 220000,
		hourlyIncome: 2400,
		kind: "is",
		desc: "Konsomatris, DJ, kasa. ~92 saat amorti.",
	},
	{
		id: "r107",
		name: "Depo / Antrepo (Dudullu)",
		cost: 450000,
		hourlyIncome: 4800,
		kind: "is",
		desc: "Koli, forklift. ~94 saat amorti.",
	},
	{
		id: "r103",
		name: "Tefeci Ofisi / Sahibinden Galeri",
		cost: 980000,
		hourlyIncome: 10000,
		kind: "is",
		desc: "Senet, ikinci el Range. ~98 saat amorti.",
	},
	{
		id: "r104",
		name: "Boğazda Kaçak Casino",
		cost: 4200000,
		hourlyIncome: 42000,
		kind: "is",
		desc: "VIP kumar. ~100 saat amorti.",
	},
	{
		id: "r201",
		name: "Kadıköy Stüdyo",
		cost: 52000,
		hourlyIncome: 100,
		kind: "konut",
		prestige: 8,
		desc: "Tek oda. Kira ince, ~520 saat.",
	},
	{
		id: "r202",
		name: "Ataşehir 3+1",
		cost: 260000,
		hourlyIncome: 500,
		kind: "konut",
		prestige: 18,
		desc: "Site, havuz. ~520 saat.",
	},
	{
		id: "r108",
		name: "Sarıyer Villa",
		cost: 1600000,
		hourlyIncome: 3000,
		kind: "konut",
		prestige: 50,
		desc: "Manzara, bahçe. Konut ~533 saat.",
	},
	{
		id: "r203",
		name: "Bebek Yalı Katı",
		cost: 2900000,
		hourlyIncome: 5400,
		kind: "konut",
		prestige: 68,
		desc: "Boğaz, cam. Villadan pahalı, ~537 saat.",
	},
	{
		id: "r204",
		name: "Göcek Özel Ada",
		cost: 8800000,
		hourlyIncome: 15500,
		kind: "konut",
		prestige: 95,
		desc: "İskele senin. ~568 saat.",
	},
];
export const ESTATE_MAP: Record<string, Estate> = Object.fromEntries(
	ESTATES.map((e) => [e.id, e]),
);
export function estatePaybackHours(estate: Estate) {
	return Math.max(1, Math.round(estate.cost / Math.max(1, estate.hourlyIncome)));
}
export const HOSPITAL_THRESHOLD = 20;
export const HEALTH_MAX = 100;
export const TICK_MINUTES = 10;
export const TICKS_PER_HOUR = 6;
export const REAL_MS_PER_TICK = 2000;
export const JAIL_TICKS = 6;
export const CLINIC_TICKS = 6;
export const CLINIC_VOLUNTARY_TICKS = 4;
export const RIVAL_CLINIC_TICKS = 10;
export const ENERGY_PER_TICK = 3;
export const STAMINA_PER_TICK = 2;
export const HEALTH_PER_TICK = 2;
export const CLINIC_HEALTH_PER_TICK = 14;
export const SAVE_VERSION = 15;
export const SAVE_KEY = "cete-savaslari-save-v1";
export const LOG_CAP = 60;
export const HITLIST_CASH_THRESHOLD = 50_000;
export const PVP_STAMINA_COST = 8;
export const EVENT_CHANCE = 0.16;
export const EVENT_COOLDOWN = 3;
export const SELL_RATE = 0.55;
export const HEAT_MAX = 100;
export const SEASON_DAYS = 14;
export const TURF_STAMINA = 5;
export const IHBAR_STAMINA = 4;
export const ESNAF_STAMINA = 3;
export const ESNAF_COST = 650;
export const BANK_RATE_PER_TICK = 0.00045;
export const LIFE_KID_MAX = 3;
export const LIFE_KID_HOURLY = 35;
export const MARKET_START: Market = {
	altin: 4320,
	usd: 41.8,
	usdt: 42.1
};
export const ASSETS: {
	id: InvestId;
	name: string;
	unit: string;
	hint: string;
	lots: number[];
}[] = [
	{
		id: "altin",
		name: "Gram altın",
		unit: "g",
		hint: "Kapalıçarşı. Yavaş yürür, gasp edilmez.",
		lots: [
			1,
			5,
			10
		]
	},
	{
		id: "usd",
		name: "Dolar",
		unit: "$",
		hint: "Yastık altı yeşil. Nakit aranır, kâğıt sormazlar.",
		lots: [
			100,
			500,
			2e3
		]
	},
	{
		id: "usdt",
		name: "USDT",
		unit: "₮",
		hint: "Elden cüzdan. Dalga büyük, zincir iz bırakır.",
		lots: [
			100,
			500,
			2e3
		]
	}
];
export function walkMarket(m: Market): Market {
	const step = (price: number, vol: number, drift: number, lo: number, hi: number) => {
		const n = price * (1 + drift + (Math.random() - .47) * vol);
		return Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100;
	};
	return {
		altin: step(m.altin, .006, 35e-5, 2800, 9800),
		usd: step(m.usd, .004, 12e-5, 28, 72),
		usdt: step(m.usdt, .028, 2e-4, 12, 88)
	};
}
export function holdingOf(player: Player, id: InvestId) {
	return id === "altin" ? player.altin : id === "usd" ? player.usd : player.usdt;
}
export function portfolioTRY(player: Player, market: Market) {
	return player.altin * market.altin + player.usd * market.usd + player.usdt * market.usdt;
}
export const KOSE_TIERS = [
	{
		lvl: 1,
		name: "Tek köşe",
		cost: 8e3,
		weekly: 11e3,
		desc: "Bir kavşak. Haftalık gelir. Emniyet basar, baskında köşe susar."
	},
	{
		lvl: 2,
		name: "Mahalle ağı",
		cost: 32e3,
		weekly: 42e3,
		desc: "Birkaç köşe tek elden. Getiri şişer, devriye de."
	},
	{
		lvl: 3,
		name: "Semt hattı",
		cost: 11e4,
		weekly: 14e4,
		desc: "Semtin kâğıdı sende. Haftalık ağır, baskın da ağır."
	}
];
export function koseWeekly(player: Player) {
	if (!player.kose) return 0;
	const t = KOSE_TIERS[Math.min(3, player.kose) - 1];
	if (!t) return 0;
	let n = t.weekly;
	if (player.neighborhood === "tarlabasi") n *= 1.2;
	return Math.round(n);
}
export function koseUpgradeCost(player: Player) {
	if (player.kose >= 3) return 0;
	const next = KOSE_TIERS[player.kose];
	const prev = player.kose === 0 ? 0 : KOSE_TIERS[player.kose - 1].cost;
	return next.cost - prev;
}
export function koseDaysLeft(player: Player) {
	if (!player.kose) return 0;
	const elapsed = player.gun - (player.koseGun || player.gun);
	return Math.max(0, 7 - elapsed);
}
export function hoodIncomeMult(n: NeighborhoodId) {
	return n === "kadikoy" ? 1.15 : 1;
}
export const RISK_HEAT: Record<string, number> = {
	Düşük: 4,
	Orta: 8,
	Yüksek: 14,
	"Çok Yüksek": 22,
	Kritik: 32
};
export const HOOD_HARAÇ: Record<NeighborhoodId, number> = {
	eyup: 720,
	tarlabasi: 540,
	kadikoy: 640,
	sultangazi: 680
};
export const CREW: CrewDef[] = [
	{
		id: "gozcu",
		name: "Gözcü Selim",
		role: "Kapı / dikiz",
		wage: 35,
		hire: 1800,
		itibar: 4,
		perk: "Yakalanma −18%. Baskın ve ihanet daha seyrek."
	},
	{
		id: "sofor",
		name: "Şoför Kenan",
		role: "Kaçış",
		wage: 50,
		hire: 3200,
		itibar: 8,
		perk: "İcraat mermi maliyeti −2."
	},
	{
		id: "tahsil",
		name: "Tahsildar Leyla",
		role: "Haraç / senet",
		wage: 70,
		hire: 5500,
		itibar: 14,
		perk: "Emlak ve semt geliri +15%."
	},
	{
		id: "tetik",
		name: "Tetikçi Rıdvan",
		role: "Racon",
		wage: 110,
		hire: 11e3,
		itibar: 20,
		perk: "Saldırı +10. Sokak daha kısa kesilir."
	},
	{
		id: "avukat",
		name: "Avukat Cemil",
		role: "Kâğıt / nezaret",
		wage: 150,
		hire: 2e4,
		itibar: 26,
		perk: "Yakalanma −25%. Zarf ucuzlar."
	}
];
export const CREW_MAP: Record<string, CrewDef> = Object.fromEntries(
	CREW.map((c) => [c.id, c]),
);
export const CONTRACTS: ContractDef[] = [
	{
		id: "c101",
		npc: "Naci Bey",
		missionId: "j101",
		bonus: 900,
		text: "Pavyon çıkışı kirlendi. Sarhoşu sen temizle, hesap bende."
	},
	{
		id: "c102",
		npc: "Tombalacı Rıza",
		missionId: "j102",
		bonus: 2200,
		text: "Bu gece masayı sen çevir. Polis başka semtte, diyorlar."
	},
	{
		id: "c103",
		npc: "Çakır Metin",
		missionId: "j103",
		bonus: 4800,
		text: "Üç durak. Egea hazır. Konum atarım, sen götür."
	},
	{
		id: "c106",
		npc: "Kripto Cemo",
		missionId: "j106",
		bonus: 6500,
		text: "Merter'de kutu bekliyor. Alıcı Telegram'da. Tuğla konuşulmaz."
	},
	{
		id: "c107",
		npc: "Sarı Recep",
		missionId: "j107",
		bonus: 14e3,
		text: "Site bakiyesi eksiye düşen var. Tahsilat nakit, IBAN yok."
	},
	{
		id: "c108",
		npc: "Jilet Semih",
		missionId: "j108",
		bonus: 18e3,
		text: "Şantiye 'güvenlik' yazacak. Sen çay iç, kasa dolsun."
	},
	{
		id: "c104",
		npc: "Haydar Usta",
		missionId: "j104",
		bonus: 42e3,
		text: "İhale adamı çekilmiyor. Ofisine kon. Range aşağıda bekler."
	},
	{
		id: "c105",
		npc: "Piranha Orhan",
		missionId: "j105",
		bonus: 12e4,
		text: "Ambarlı gece. Konteyner, zarf, GPS kapalı. Sen bilirsin."
	},
	{
		id: "c109",
		npc: "Büfeci Hasan",
		missionId: "j109",
		bonus: 700,
		text: "POS'u bir gece klonla. Küçük çekim, iz yok."
	},
	{
		id: "c110",
		npc: "Hurdacı Veli",
		missionId: "j110",
		bonus: 1600,
		text: "Bakır bu gece. Makarayı sen kaldır."
	},
	{
		id: "c111",
		npc: "Kripto Cemo",
		missionId: "j111",
		bonus: 8e3,
		text: "Kupon sayfası hazır. Sen reklamı bas, komisyon bende."
	},
	{
		id: "c112",
		npc: "Sarı Recep",
		missionId: "j112",
		bonus: 16e3,
		text: "Galeriye kilometre lazım. Hatasız yazacağız."
	},
	{
		id: "c113",
		npc: "Piranha Orhan",
		missionId: "j113",
		bonus: 55e3,
		text: "Sarıyer'de kasa. Köpek var, kamera kör."
	},
	{
		id: "c114",
		npc: "Haydar Usta",
		missionId: "j114",
		bonus: 15e4,
		text: "Çarşı kepenk inmeden. Gramlar senin."
	}
];
export const CONTRACT_MAP: Record<string, ContractDef> = Object.fromEntries(
	CONTRACTS.map((c) => [c.id, c]),
);
export function blankTurf(_home: NeighborhoodId): Record<NeighborhoodId, number> {
	return {
		eyup: 0,
		tarlabasi: 0,
		kadikoy: 0,
		sultangazi: 0,
	};
}
export function hydratePlayer(raw: Partial<Player> & Pick<Player, "name" | "neighborhood">): Player {
	const finite = (value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) =>
		typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
	const crew = [...new Set(Array.isArray(raw.crew) ? raw.crew.filter(id => Object.hasOwn(CREW_MAP, id)) : [])];
	const crewBusy: Partial<Record<CrewId, number>> = {};
	for (const id of crew) {
		const ticks = Math.ceil(finite(raw.crewBusy?.[id], 0, 8));
		if (ticks > 0) crewBusy[id] = ticks;
	}
	const neighborhood = migrateHood(raw.neighborhood);
	const oldTurf = (raw.turf ?? {}) as Record<string, number>;
	const turf = blankTurf(neighborhood);
	{
		turf.eyup = oldTurf.eyup ?? oldTurf.karakoy ?? turf.eyup;
		turf.tarlabasi = oldTurf.tarlabasi ?? turf.tarlabasi;
		turf.kadikoy = oldTurf.kadikoy ?? oldTurf.zeytinburnu ?? turf.kadikoy;
		turf.sultangazi = oldTurf.sultangazi ?? turf.sultangazi;
	}
	for (const id of Object.keys(turf) as NeighborhoodId[]) turf[id] = finite(turf[id], 0, 100);
	return {
		name: raw.name,
		neighborhood,
		level: raw.level ?? 1,
		xp: raw.xp ?? 0,
		energy: raw.energy ?? 24,
		stamina: raw.stamina ?? 14,
		health: raw.health ?? 100,
		cash: finite(raw.cash),
		rusvet: raw.rusvet ?? 0,
		itibar: raw.itibar ?? 0,
		inventory: Array.isArray(raw.inventory) ? raw.inventory : ["w101"],
		equippedWeapon: raw.equippedWeapon ?? "w101",
		equippedArmor: raw.equippedArmor ?? null,
		equippedVehicle: raw.equippedVehicle ?? null,
		properties: Array.isArray(raw.properties) ? raw.properties : [],
		gun: raw.gun ?? 1,
		saat: raw.saat ?? 20,
		dakika: raw.dakika ?? 0,
		durum: raw.durum ?? "serbest",
		durumTick: raw.durumTick ?? 0,
		incomeMult: hoodIncomeMult(neighborhood),
		eventCooldown: raw.eventCooldown ?? 0,
		isi: finite(raw.isi, 6, 100),
		crew,
		crewBusy,
		turf,
		bank: finite(raw.bank),
		bankAcc: finite(raw.bankAcc),
		senet: raw.senet ?? null,
		contractId: raw.contractId === void 0 ? "c101" : raw.contractId,
		contractGun: raw.contractGun ?? raw.gun ?? 1,
		seasonScore: raw.seasonScore ?? 0,
		seasonGun: raw.seasonGun ?? raw.gun ?? 1,
		upgrades: raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {},
		jobsDone: raw.jobsDone ?? 0,
		married: raw.married ?? false,
		spouse: raw.spouse ?? null,
		kids: raw.kids ?? 0,
		buzz: raw.buzz ?? 0,
		high: raw.high ?? 0,
		horse: raw.horse ?? null,
		relations: raw.relations && typeof raw.relations === "object" ? raw.relations : {},
		girlfriend: raw.girlfriend ?? null,
		pendingFamily: raw.pendingFamily ?? null,
		altin: Math.max(0, raw.altin ?? 0),
		usd: Math.max(0, raw.usd ?? 0),
		usdt: Math.max(0, raw.usdt ?? 0),
		kose: Math.max(0, Math.min(3, Math.floor(raw.kose ?? 0))),
		koseGun: raw.koseGun ?? raw.gun ?? 1,
		saglikIzi: Math.max(0, raw.saglikIzi ?? 0),
		senetPaid: Math.max(0, raw.senetPaid ?? 0),
		senetDefaults: Math.max(0, raw.senetDefaults ?? 0),
		pendingSeasonCeremony: raw.pendingSeasonCeremony ?? null,
		streak: Math.max(0, raw.streak ?? 0),
		streakDay: raw.streakDay ?? "",
		refFrom: raw.refFrom ?? null,
		refClaimed: Boolean(raw.refClaimed),
		achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
		tutorialStep: typeof raw.tutorialStep === "number" ? raw.tutorialStep : 0,
	};
}
export function crewWageHourly(player: Player) {
	return player.crew.reduce((a: number, id: CrewId) => a + (CREW_MAP[id]?.wage ?? 0), 0);
}
export function estateLevel(player: Player, id: string) {
	return Math.max(0, Math.min(2, player.upgrades?.[id] ?? 0));
}
export function estateIncomeHourly(player: Player, estate: Estate) {
	const lvl = estateLevel(player, estate.id);
	let n = estate.hourlyIncome * (1 + .35 * lvl) * hoodIncomeMult(player.neighborhood);
	if (player.crew.includes("tahsil")) n *= 1.15;
	if (player.married) n *= 1.05;
	return Math.round(n);
}
export function upgradeCost(estate: Estate, lvl: number) {
	return Math.round(estate.cost * (.48 + .42 * lvl));
}
export function estateOrtalik(estate: Estate) {
	if (estate.prestige) return Math.max(1, Math.min(100, estate.prestige));
	const n = 6 + Math.round(Math.pow(estate.cost / 5_000_000, 0.48) * 82);
	return Math.max(4, Math.min(90, n));
}
export function toplamOrtalik(player: Player) {
	if (!player.properties.length) return 0;
	let sum = 0;
	let peak = 0;
	for (const id of player.properties) {
		const e = ESTATE_MAP[id];
		if (!e) continue;
		const v = estateOrtalik(e);
		sum += v;
		if (v > peak) peak = v;
	}
	return Math.max(0, Math.min(100, Math.round(peak * 0.62 + sum * 0.18)));
}
export function tefeciKrediNotu(player: Player) {
	let n = 38;
	n += Math.min(28, player.itibar * 0.45);
	n += player.properties.length * 5;
	n += player.bank >= 25000 ? 12 : player.bank >= 5000 ? 6 : 0;
	n += (player.senetPaid ?? 0) * 7;
	n -= (player.senetDefaults ?? 0) * 16;
	if (player.senet?.kind === "borc") n -= 14;
	n -= Math.min(14, (player.isi ?? 0) / 8);
	if ((player.kids ?? 0) > 1) n -= 4;
	return Math.max(5, Math.min(100, Math.round(n)));
}
export function tefeciLoanTerms(player: Player) {
	const note = tefeciKrediNotu(player);
	const ok = note >= 18;
	const principal = ok
		? Math.max(1400, Math.round(player.level * 3000 * (0.5 + note / 120)))
		: 0;
	const rate = note >= 72 ? 1.16 : note >= 48 ? 1.32 : 1.52;
	return { note, ok, principal, due: Math.round(principal * rate) };
}
export type IhanetSeviye = "yok" | "düşük" | "orta" | "yüksek";
export function ihanetSeviye(player: Player): IhanetSeviye {
	if (!player.crew.length) return "yok";
	if (player.itibar < 6) return "yüksek";
	if (player.itibar < 14) return "orta";
	if (player.itibar < 22) return "düşük";
	return "yok";
}
export function ihanetChancePerTick(player: Player) {
	if (!player.crew.length) return 0;
	const sev = ihanetSeviye(player);
	let p =
		sev === "yüksek" ? 0.014 : sev === "orta" ? 0.007 : sev === "düşük" ? 0.0025 : 0;
	if (player.crew.includes("gozcu")) p *= 0.7;
	return p;
}
export function jobEnergyCost(player: Player, base: number) {
	return player.crew.includes("sofor") ? Math.max(1, base - 2) : base;
}
export function turfHaraçHourly(player: Player) {
	let n = 0;
	(Object.keys(HOOD_HARAÇ) as NeighborhoodId[]).forEach((id) => {
		const pct = player.turf[id] ?? 0;
		let piece = pct / 100 * HOOD_HARAÇ[id];
		if (pct >= 100) piece *= 1.2;
		else if (pct >= 75) piece *= 1.12;
		else if (pct >= 50) piece *= 1.08;
		n += piece;
	});
	if (player.crew.includes("tahsil")) n *= 1.15;
	if ((player.isi ?? 0) >= 70) n *= 0.72;
	else if ((player.isi ?? 0) >= 45) n *= 0.88;
	return Math.round(n);
}
export function turfHourlyOf(player: Player, id: NeighborhoodId) {
	const pct = player.turf[id] ?? 0;
	let piece = pct / 100 * HOOD_HARAÇ[id];
	if (pct >= 100) piece *= 1.2;
	else if (pct >= 75) piece *= 1.12;
	else if (pct >= 50) piece *= 1.08;
	if (player.crew.includes("tahsil")) piece *= 1.15;
	if ((player.isi ?? 0) >= 70) piece *= 0.72;
	else if ((player.isi ?? 0) >= 45) piece *= 0.88;
	return Math.round(piece);
}
export function turfPressCash(hood: NeighborhoodId, pct: number) {
	return Math.round(HOOD_HARAÇ[hood] * (.42 + pct / 180) + 80);
}
export function turfPerkLine(pct: number) {
	if (pct >= 100) return "Tam kontrol: haraç +%20 · iş +%12 · saldırı +4";
	if (pct >= 75) return "Ağır el: haraç +%12 · iş +%9 · saldırı +3";
	if (pct >= 50) return "Yarı semt: haraç +%8 · iş +%6 · saldırı +2";
	if (pct >= 25) return "Köşe tutuldu: iş +%3 · saldırı +1";
	return "Basınca nakit haraç + XP. Yüzde yükseldikçe bonus kilit açılır.";
}
export function ledger(player: Player, market: Market) {
	const emlakSaat = player.properties.reduce((a: number, id: string) => {
		const e = ESTATE_MAP[id];
		return e ? a + estateIncomeHourly(player, e) : a;
	}, 0);
	const haracSaat = turfHaraçHourly(player);
	const ceteSaat = crewWageHourly(player);
	const cocukSaat = (player.kids ?? 0) * LIFE_KID_HOURLY;
	const koseHafta = koseWeekly(player);
	const netSaat = emlakSaat + haracSaat - ceteSaat - cocukSaat;
	const port = portfolioTRY(player, market);
	const emlakDeger = player.properties.reduce((a: number, id: string) => a + (ESTATE_MAP[id]?.cost ?? 0), 0);
	const koseDeger = player.kose ? KOSE_TIERS[player.kose - 1].cost : 0;
	const atDeger = player.horse ? HORSE_PRICE : 0;
	return {
		emlakSaat,
		haracSaat,
		ceteSaat,
		cocukSaat,
		koseHafta,
		netSaat,
		netHafta: netSaat * 24 * 7 + koseHafta,
		port,
		emlakDeger,
		koseDeger,
		nakit: player.cash,
		kasa: player.bank,
		rusvet: player.rusvet,
		varlik: player.cash + player.bank + port + emlakDeger + koseDeger + atDeger
	};
}
export function makeRivals(): Rival[] {
	return [
		{
			name: "Kör Cevat",
			title: "Galata kabadayısı",
			level: 2,
			cash: 4800,
			health: 100,
			attack: 16,
			defense: 10,
			hood: "eyup"
		},
		{
			name: "Tombalacı Rıza",
			title: "Kaçak kumar işletmecisi",
			level: 3,
			cash: 22e3,
			health: 100,
			attack: 24,
			defense: 18,
			hood: "eyup"
		},
		{
			name: "Kripto Cemo",
			title: "Telegram dolandırıcısı",
			level: 4,
			cash: 38e3,
			health: 100,
			attack: 28,
			defense: 16,
			hood: "tarlabasi"
		},
		{
			name: "Çakır Metin",
			title: "Tarlabaşı torbacısı",
			level: 4,
			cash: 41e3,
			health: 100,
			attack: 32,
			defense: 22,
			hood: "tarlabasi"
		},
		{
			name: "Sarı Recep",
			title: "İhale aracısı",
			level: 6,
			cash: 18e4,
			health: 100,
			attack: 48,
			defense: 36,
			hood: "sultangazi"
		},
		{
			name: "Jilet Semih",
			title: "Tetikçi",
			level: 5,
			cash: 67e3,
			health: 100,
			attack: 55,
			defense: 20,
			hood: "kadikoy"
		},
		{
			name: "Haydar Usta",
			title: "Liman gözcüsü",
			level: 8,
			cash: 62e4,
			health: 100,
			attack: 70,
			defense: 58,
			hood: "kadikoy"
		},
		{
			name: "Naci Bey",
			title: "Pavyon patronu",
			level: 7,
			cash: 34e4,
			health: 100,
			attack: 40,
			defense: 50,
			hood: "eyup"
		},
		{
			name: "Piranha Orhan",
			title: "Boğaz'ın sessiz ortağı",
			level: 11,
			cash: 21e5,
			health: 100,
			attack: 110,
			defense: 95,
			hood: "sultangazi"
		},
		{
			name: "Deli Tarık",
			title: "Sanayi kabadayısı",
			level: 3,
			cash: 19e3,
			health: 100,
			attack: 30,
			defense: 14,
			hood: "kadikoy"
		},
		{
			name: "Fatoş Abla",
			title: "Tarlabaşı kiralık öfke",
			level: 5,
			cash: 54e3,
			health: 100,
			attack: 44,
			defense: 28,
			hood: "tarlabasi"
		},
		{
			name: "Vanlı Cuma",
			title: "Senet tahsildarı",
			level: 7,
			cash: 21e4,
			health: 100,
			attack: 52,
			defense: 48,
			hood: "sultangazi"
		},
		{
			name: "DJ Barış",
			title: "Lounge kasa ortağı",
			level: 6,
			cash: 125e3,
			health: 100,
			attack: 34,
			defense: 40,
			hood: "eyup"
		}
	].map((t, i): Rival => ({
		...t,
		id: `rv${i + 1}`,
		alive: true,
		bounty: 0,
		hospitalTicks: 0,
		revengeTicks: 0,
		hood: t.hood as NeighborhoodId,
	}));
}
export const JOB_FLAVOR: Record<string, { win: string[]; lose: string[] }> = {
	j101: {
		win: [
			"Karaköy'ün arka sokağı. Adam konsomatrise son kâğıdı basmış, merdiven boşluğunda sızmış. Cüzdan iç cepteydi.",
			"Pavyon çıkışı, yağmur çiseiyor. Sarhoş ceketini omzuna alamadan yere yığılmış. Sen sadece eğildin.",
			"Kapıdaki koruma içeri bakıyordu. Sen kaldırımda işini bitirdin. Islak 200'lükler, bir de fotoğraf."
		],
		lose: [
			"Adam sızmamıştı. Yere yatmış, bekliyordu. Bağırınca devriye köşeyi döndü.",
			"Cüzdan boştu, kartlar sahtesiydi. Kapıdaki adam seni sırtından yakaladı.",
			"Konsomatris camdan gördü, içerideki korumayı çağırdı. Merdiven senin aleyhine daraldı."
		]
	},
	j102: {
		win: [
			"Gözcü kapıda çay içti, içeride tombala tıkır tıkır döndü. Polis bu gece başka mahallede.",
			"Masa doluydu. Sen kasa tuttun, kâğıt dağıttın, kimse kural sormadı. Gece bittiğinde torba ağırdı.",
			"İki elin kırıltısı, bir elin evi. Mahalleli kaybettiğini racon sanıyor. Sen sayıyorsun."
		],
		lose: [
			"Kapıdaki gözcü uyumuş. Devriye içeri daldı, kâğıtlar havada, sen köşede.",
			"Masadaki herif kaybedince emniyeti aramış. Baskın sessiz geldi.",
			"Tombala çarkı takıldı, kargaşa çıktı. Siren duyulunca herkes dağıldı — sen en arkadaydın."
		]
	},
	j103: {
		win: [
			"Basık Egea dar sokakta kayboldu. Üç durak, üç teslimat, dikiz aynasında kimse yok.",
			"Konum atıldı, el değişti, IBAN yok. Motor hâlâ sıcaktı, kasa da.",
			"Köşe başı temizdi. Kurye çantası sahte, içi mal. Dağıtım bitti."
		],
		lose: [
			"Dikiz aynasında drone ışığı. Egea çıkmazda sıkıştı, torba koltuğun altındaydı.",
			"Alıcı muhbir çıktı. Teslimatta kapı açılınca içeride sivil vardı.",
			"Köşe boş değildi. Bekçi kılığına girmişlerdi. Kontağı çeviremedin."
		]
	},
	j106: {
		win: [
			"Kutu ağırdı, alıcı tartmadı. Merter çıkışı, nakit elden. Tuğla yerinde duruyor.",
			"Telegram'da 'orijinal kapalı kutu'. Sen zaten koli bandını biliyorsun.",
			"iPhone yazıyor, içinde tuğla. Adam şarj aletine bakmadan gitti."
		],
		lose: [
			"Alıcı kutuyu o anda açtı. Tuğla düşünce ortam değişti.",
			"Merter'de zabıta koli kontrolü. Sahte seri numarası ekranda kaldı.",
			"Adamın yanındaki 'kuzen' sivilmiş. Kutu delil, sen koştun."
		]
	},
	j107: {
		win: [
			"Site bakiyesi eksi. Kapıyı açınca cüzdan masadaydı. Konuşmaya gerek kalmadı.",
			"Bahisçi senin olduğunu biliyor. Nakit poşet, bir de özür.",
			"IBAN dönmedi, sen döndün. Tahsilat temiz, kelebek cebinde uyudu."
		],
		lose: [
			"Kapıyı karısı açtı, içeride kayınço vardı. Sayı denk gelmedi.",
			"Adam kaydı emniyete atmış. Tahsilat değil, pusu.",
			"Site patronu senin arkanı bırakmış. Borçlu değil, sen açıkta kaldın."
		]
	},
	j108: {
		win: [
			"Kalfa 'güvenlik' yazdı, sen çay içtin. Vinç çalışırken kasa doldu.",
			"İnşaatın önünde Stone Island yeter. Müteahhit itiraz etmedi.",
			"Hakedişten pay. Sen imza atmadın, onlar attı."
		],
		lose: [
			"Şantiye şefi jandarmayı aramış. Baretler arasında üniforma.",
			"Başka mahallenin ekibi aynı sahadaymış. Racon çakıştı.",
			"Kamera 4K. Montun pusulası yakın planda kaldı."
		]
	},
	j104: {
		win: [
			"İş adamı evrak çantasını bıraktı. SAR9 masanın üstündeydi, konuşmaya gerek kalmadı.",
			"Ofis camı boğazı kesiyor. Adam imzayı çekti, sesi titredi. Range aşağıda bekliyordu.",
			"Tehdit kısa sürdü. Çekilme yazısı sabah hesaplara düştü. Sen gece kasanı saydın."
		],
		lose: [
			"Adamın arkasında devlet vardı, senin belindeki SAR9 değil. Koruma kademesi seni çevirdi.",
			"Ofise girer girmez alarm. Range Rover aşağıda kilitlendi, merdiven dolmuştu.",
			"İhale savaşı senin sandığın gibi mahalle kavgası değilmiş. Karşı taraf önce konuşmuş."
		]
	},
	j105: {
		win: [
			"Ambarlı gece yarısı. Konteyner kapısı açıldı, memur zarfı cebine indirdi. Vinç sessiz.",
			"Rüşvet, damga, yeşil ışık. Draco arka koltukta uyudu. Mal TIR'a bindi.",
			"Sis, tuz, GPS kapalı. Sevkiyat bittiğinde rıhtım yine boştu."
		],
		lose: [
			"Memur zarfı aldı, sonra telsizi açtı. Rıhtım bir anda aydınlandı.",
			"Konteyner yanlış mühürlenmişti. Gümrük köpeği daha kapı açılmadan oturdu.",
			"Konvoyun arkası koptu. Çıkışta dur ihtarı, sonra uzun namlu."
		]
	},
	j109: {
		win: ["POS klonu takıldı, üç çekim geçti. Büfeci fark etmedi.", "Yazar kasa gece sıfırlandı. Sen kopyayı cebine indirdin."],
		lose: ["Kart şişti, alarm öttü. Büfe sahibi sopayla çıktı.", "Sivil, kuyrukta bekliyormuş. POS senin elinde kaldı."]
	},
	j110: {
		win: ["Makara kamyonete bindi. Hurdacı tartmadan nakit uzattı.", "Şantiye bekçisi uyuyordu. Bakır gece yolculuğu yaptı."],
		lose: ["Makara gürültü yaptı. Bekçi telsizi açtı.", "Hurdacı muhbir çıktı. Kantarda jandarma vardı."]
	},
	j111: {
		win: ["Kupon sayfası patladı. Komisyon USDT, sen nakite çevirdin.", "Reklam 'kesin yatar' dedi. Yatan olmadı, sen kazandın."],
		lose: ["Reklam şikâyet yedi. Hesap kilit, sen açıkta.", "Site patronu komisyonu yedi. Sen sadece iz kaldın."]
	},
	j112: {
		win: ["Kilometre 80 binden 40'a indi. İlan 'hatasız' yayınlandı.", "Alıcı ekspertizi sormadı. Sen kâğıdı imzalattın."],
		lose: ["Alıcı kendi ustasını getirdi. Kaput altı yalan söyledi.", "Noter evrakı sahte çıktı. Galeri basıldı."]
	},
	j113: {
		win: ["Kasa duvardan çıktı. Köpek bağırdı, kimse inmedi.", "Kamera kör noktadaydı. Gram ve nakit aynı çantada."],
		lose: ["Köpek zinciri kopardı. Sen bahçede kaldın.", "Alarm sessizdi, ekip değildi. Kapıda üç adam."]
	},
	j114: {
		win: ["Vitrin indirmeden boşaldı. Eminönü altı, BMW sıcaktı.", "Gramlar poşette, kepenk yarıda. Sen çoktan çıktın."],
		lose: ["Kuyumcu butona bastı. Kepenk senin üstüne indi.", "Çarşı esnafı zincir oldu. Kaçış yoktu."]
	}
};
export const SPOUSES = [
	"Sibel",
	"Demet",
	"Gülşah",
	"Merve",
	"Elif",
	"Aslı"
];
export const PARTNERS: Partner[] = [
	{
		id: "p1",
		name: "Cansu",
		title: "Lounge DJ",
		gift: 900,
		date: 700,
		desc: "Kulaklık boynunda, gece Galata. Lafı kısa keser."
	},
	{
		id: "p2",
		name: "Melis",
		title: "Stajyer avukat",
		gift: 1200,
		date: 900,
		desc: "Levent ofisi, dosya kokusu. Raconu mahkeme diline çevirir."
	},
	{
		id: "p3",
		name: "Ebru",
		title: "Galeri satışı",
		gift: 1100,
		date: 800,
		desc: "Sahibinden değil, vitrin. Range'i o satar, sen bakarsın."
	},
	{
		id: "p4",
		name: "Yasemin",
		title: "Kasa / pavyon",
		gift: 1500,
		date: 1100,
		desc: "Hesabı o tutar. Masaya oturunca semt duyar."
	}
];
export const PARTNER_MAP: Record<string, Partner> = Object.fromEntries(
	PARTNERS.map((p) => [p.id, p]),
);
export const RACE_FIELD = [
	{
		name: "Karayel",
		odds: 2.2
	},
	{
		name: "Fırtına",
		odds: 3.4
	},
	{
		name: "Paşa",
		odds: 5.1
	},
	{
		name: "Yıldırım",
		odds: 8.8
	}
];
export const HORSE_NAMES = [
	"Külhan",
	"Zeybek",
	"Alabora",
	"Kırat"
];
export const HORSE_PRICE = 22e3;
export const HORSE_TRAIN = 1200;
export function pickRaceWinner(field: RaceEntry[]) {
	const weights = field.map((h: RaceEntry) => 1 / h.odds);
	const total = weights.reduce((a: number, b: number) => a + b, 0);
	let r = Math.random() * total;
	for (let i = 0; i < field.length; i++) {
		r -= weights[i];
		if (r <= 0) return i;
	}
	return field.length - 1;
}
