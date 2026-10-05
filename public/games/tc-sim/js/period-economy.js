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
// calibration is an illustrative bridge, never a claim that all game salaries
// or product prices were observed at their displayed values.
export const GAME_TO_2025_TL = 22104.67 / 9000;
export const ECONOMY_SOURCE = Object.freeze({
  cpi: "https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR",
  wage: "https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf",
  redenomination: "https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Banka+Hakkinda/Tarihce/",
});

export function economyYear(state) {
  const candidate = Number(state?.world?.scenario?.currentDate?.slice(0, 4) || state?.time?.year || 2025);
  return Math.max(1980, Math.min(2030, Number.isFinite(candidate) ? candidate : 2025));
}

export function periodCurrency(year) {
  if (year < 2005) return "TL (eski)";
  if (year < 2009) return "YTL";
  return "TL";
}

export function approximateNominal(gameAmount, year) {
  if (!Number.isFinite(gameAmount)) return 0;
  const observedYear = Math.max(1980, Math.min(2025, Math.trunc(year)));
  const cpi = TURKEY_CPI[observedYear];
  const oldLiraMultiplier = observedYear < 2005 ? 1_000_000 : 1;
  return gameAmount * GAME_TO_2025_TL * cpi / TURKEY_CPI[2025] * oldLiraMultiplier;
}

export function formatPeriodMoney(gameAmount, year) {
  const observedYear = Math.max(1980, Math.min(2025, Math.trunc(year)));
  const amount = approximateNominal(gameAmount, observedYear);
  const digits = amount < 10 ? 1 : 0;
  const formatted = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(amount);
  return `${formatted} ${periodCurrency(observedYear)}`;
}

export function periodEconomyNote(year) {
  if (year > 2025) return "2026–2030 fiyatları tahmin edilmedi; tutarlar 2025 alım gücüyle gösterilir. Gelecek olayları kurgudur.";
  return `${year} için yıllık TÜFE'ye göre yaklaşık nominal karşılık. Oyun hesapları sabit 2025 alım gücü puanlarıyla yürür; bu bir tarihsel fiyat veya ücret kataloğu değildir.`;
}
