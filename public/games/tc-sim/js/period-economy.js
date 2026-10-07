/**
 * Annual CPI, Türkiye, 2010 = 100 (World Bank indicator FP.CPI.TOTL,
 * downloaded 2026-10-06; source: IMF International Financial Statistics).
 * https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR
 * These are annual averages, not individual product prices or wage observations.
 */
export const TURKEY_CPI = Object.freeze({
  1980: 0.0017273164, 1981: 0.0023770427, 1982: 0.0030696539,
  1983: 0.0040332266, 1984: 0.0059849986, 1985: 0.0086759576,
  1986: 0.0116787131, 1987: 0.0162165756, 1988: 0.0273751434,
  1989: 0.0446960954, 1990: 0.0716495703, 1991: 0.1189229307,
  1992: 0.2022594871, 1993: 0.3359405549, 1994: 0.6894003643,
  1995: 1.303747898, 1996: 2.3521196282, 1997: 4.3671654989,
  1998: 8.0635930493, 1999: 13.2942432735, 2000: 20.5948262332,
  2001: 31.7984505792, 2002: 46.0963443572, 2003: 56.0542787743,
  2004: 60.8739723468, 2005: 65.8529521674, 2006: 72.173019432,
  2007: 78.4926195815, 2008: 86.6904895366, 2009: 92.1094917788,
  2010: 100, 2011: 106.4718796712, 2012: 115.9389013453,
  2013: 124.6263079223, 2014: 135.6614349776, 2015: 146.0678251121,
  2016: 157.4247944694, 2017: 174.9687032885, 2018: 203.5454035874,
  2019: 234.4371263079, 2020: 263.2235612855, 2021: 314.8061472347,
  2022: 542.4388079223, 2023: 834.5931427504, 2024: 1322.8839686099,
  2025: 1784.3212817638,
});

// 2025 net minimum wage from the Ministry of Labour was TRY 22,104.67.
// One low-wage game job has base salary 9,000 purchasing-power points. This
// calibration is the pre-1999 CPI fallback. From 1999, the dated wage
// schedule below calibrates all budget units; only its wage anchor is observed.
export const GAME_TO_2025_TL = 22104.67 / 9000;
export const ECONOMY_SOURCE = Object.freeze({
  cpi: "https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR",
  wage: "https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf",
  redenomination: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Banka+Hakkinda/Tarihce/",
});

export function economyYear(state) {
  const candidate = Number(state?.time?.date?.slice(0, 4) || state?.world?.scenario?.currentDate?.slice(0, 4) || state?.time?.year || 2025);
  return Math.max(1980, Math.min(2030, Number.isFinite(candidate) ? candidate : 2025));
}

export function periodCurrency(year) {
  if (year < 2005) return "TL (eski)";
  if (year < 2009) return "YTL";
  return "TL";
}

// Adult net minimum-wage schedule, Ministry of Labour. Pre-2005 entries use
// redenominated TL here; old-lira display multiplies once. All other prices
// remain explicitly modelled wage-budget ratios, not claimed observations.
export const NET_WAGE_SCHEDULE = [
  ["1999-01-01",58.948065],["1999-07-01",70.222320],["1999-08-16",70.110000],
  ["2000-01-01",82.4175],["2000-04-01",80.5509],["2000-07-01",86.9229],
  ["2001-01-01",102.3696],["2001-07-01",107.32383],["2001-08-01",122.18652],
  ["2002-01-01",163.563536],["2002-07-01",184.251937],["2003-01-01",225.999],
  ["2004-01-01",303.0795],["2004-07-01",318.233475],["2005-01-01",350.15],
  ["2006-01-01",380.46],["2007-01-01",403.03],["2007-07-01",419.15],
  ["2008-01-01",481.55],["2008-07-01",503.26],["2009-01-01",527.13],["2009-07-01",546.48],
  ["2010-01-01",576.57],["2010-07-01",599.12],["2011-01-01",629.96],["2011-07-01",658.95],
  ["2012-01-01",701.13],["2012-07-01",739.79],["2013-01-01",773.01],["2013-07-01",803.68],
  ["2014-01-01",846],["2014-07-01",891.03],["2015-01-01",949.07],["2015-07-01",1000.54],
  ["2016-01-01",1300.99],["2017-01-01",1404.06],["2018-01-01",1603.12],
  ["2019-01-01",2020.90],["2020-01-01",2324.71],["2021-01-01",2825.90],
  ["2022-01-01",4253.40],["2022-07-01",5500.35],["2023-01-01",8506.80],["2023-07-01",11402.32],
  ["2024-01-01",17002.12],["2025-01-01",22104.67],
];
export const WAGE_HISTORY_SOURCE = "https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf";

export function approximateNominal(gameAmount, year, date = `${year}-01-01`) {
  if (!Number.isFinite(gameAmount)) return 0;
  const observedYear = Math.max(1980, Math.min(2025, Math.trunc(year)));
  const cpi = TURKEY_CPI[observedYear];
  const oldLiraMultiplier = observedYear < 2005 ? 1_000_000 : 1;
  const wage = year >= 1999 ? NET_WAGE_SCHEDULE.findLast(([effective]) => effective <= date)?.[1] : null;
  const unit = wage ? wage / 9000 : GAME_TO_2025_TL * cpi / TURKEY_CPI[2025];
  return gameAmount * unit * oldLiraMultiplier;
}

export function formatPeriodMoney(gameAmount, year, date = `${year}-01-01`) {
  const observedYear = Math.max(1980, Math.min(2025, Math.trunc(year)));
  const amount = approximateNominal(gameAmount, observedYear, date);
  const digits = Math.abs(amount) < 10 ? 1 : 0;
  if (observedYear < 2005 && Math.abs(amount) >= 1_000_000) return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} milyon TL (eski)`;
  const formatted = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(amount);
  return `${formatted} ${periodCurrency(observedYear)}`;
}

export function periodEconomyNote(year) {
  if (year > 2025) return "2026–2030 fiyatları tahmin edilmedi; tutarlar 2025 ücret ölçeğiyle gösterilir. Gelecek olayları kurgudur.";
  return year >= 1999
    ? `${year}: giriş işi dönem net asgari ücretine kalibredir. Diğer gelir, fiyat, varlık ve borçlar aynı ücret ölçeğindeki oyun bütçesidir; tarihsel ürün fiyatı, kira veya banka teklifi değildir. Mevcut birikimler aynı bütçe biriminde korunur; nominal enflasyon kazancı üretilmez. TÜFE yalnız dönem belirsizliği için kullanılır.`
    : `${year}: ücret serisi kapsamı dışında yıllık TÜFE ile yaklaşık nominal karşılık; gözlenmiş ürün fiyatı veya ücret değildir.`;
}

/** Qualitative game context; coefficients below are balance rules, not observations. */
export function periodContext(state) {
  const year = economyYear(state);
  const inflation = year <= 2025 && TURKEY_CPI[year - 1]
    ? TURKEY_CPI[year] / TURKEY_CPI[year - 1] - 1 : null;
  return {
    year, inflation,
    label: year > 2025 ? "Kurgu gelecek: dijital rekabet, bakım ve onarım" : year < 2000 ? "Nakit, basılı yayın ve yerel ticaret" : year < 2010 ? "Ev bilgisayarı, internet kafe ve mobil iletişim" : year < 2020 ? "Akıllı telefon, çevrimiçi hizmet ve küçük e-ticaret" : "Dijital hizmetler, platform rekabeti ve onarım",
    uncertainty: inflation === null ? 0.2 : Math.min(0.5, Math.max(0.1, inflation)),
    future: year > 2025,
  };
}
