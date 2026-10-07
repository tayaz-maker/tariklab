# TC SIM exchange and business extension — 2026-10-07

Base: main 6fe1facd8606c0f0b7d5dc5e8814a123ed0d4151 (#137 historical economy and #138 creation/save closure). UI baseline #135/#136 remains unchanged.

## Observed data

- TCMB dated XML indicator/foreign-banknote bulletins. Every bundled observation stores its source URL, actual bulletin date, SHA256 and unit-normalized quotes. EVDS discovery: https://evds2.tcmb.gov.tr/ and https://www.tcmb.gov.tr/kurlar/kurlar_tr.html . No EVDS API key is required for the public XML archive.
- Quarterly samples (January/April/July/October, seventh day or preceding available business day), plus exact 2017-04-18 and 1999-04-16 (Sunday 1999-04-18 has no bulletin). Missing observations are recorded, never filled with invented historical quotes. Carry forward only observations at or before game date; no hindsight interpolation.
- Pre-2005 rates divided by 1,000,000; JPY and other published multi-unit quotes divided by their published Unit. Internal quote unit is redenominated TRY per unit. Existing wage-budget conversion then converts to the authoritative cash ledger, exactly once.
- Gold: World Bank Pink Sheet monthly nominal USD/troy ounce. Workbook source/hash in bundled data. Only completed preceding months are available to the simulation. This is a monthly reference, NOT a daily Turkish retail gold price.
- Pure gram gold reference = monthly USD/oz × TCMB USD/TRY midpoint / 31.1034768. Ziynet uses Darphane published weights (1.754g, 3.508g, 7.016g) × 0.9166 purity. Source: https://www.darphane.gov.tr/cumhuriyet-altini-uretimi . Gram option is a pure-gold weight equivalent, not a claim about availability of a particular branded bullion product.
- Euro cash begins 2002-01-01. Euro accounting began 1999 but is not offered as cash before 2002. DEM substitutes before 2002; retained DEM is sellable through the fixed 1.95583 DEM/EUR conversion, never silently deleted. ECB: https://www.ecb.europa.eu/euro/intro/html/index.en.html .

## Explicit simulation assumptions

Bureau spread (0.8% each side for USD/EUR/DEM, 2% others), fee (0.2%), gold buy discount (3%), gold sale premium (3% pure gram / 6% coins) are gameplay assumptions, not historical retail observations. Liquidation value is bid less fee. No direct FX cross-trading/conversion creates a second cash source. Buy cash rounds up, sell cash rounds down, quantities are positive safe integers. Each operation requotes and checks balance/holdings synchronously.

After the final available observation, an explicitly marked deterministic fictional scenario changes quotes. No future value is labelled TCMB history or a forecast. Earlier gaps carry the last published sample with the source date displayed. Quarterly FX sampling is an intentional fidelity limit. Currency popularity is not claimed as a researched ranking: availability follows cash history and primary-vs-secondary spread assumptions.

Existing balances remain purchasing-power budget units, as in #137; they are not retroactively rewritten into nominal historical cash. Physical FX/gold quantities have changing budget-unit values. Legacy abstract investment baskets remain intact and separately labelled; their values/basis are not converted or lost.

## Business

Extends flags.business and processBusinessMonth; no second business engine. Legacy fields receive neutral defaults. Scale 1–10 controls capacity; employees require onboarding and recurring wages. Revenue responds to sector era, existing skill/energy inputs, deterministic risk, competition, staffing and explicitly modelled crisis pressure. Expense report splits supply, wages, rent, operations, tax, interest and principal. Rates are balance assumptions, not historical tax or loan schedules.

Expansion consumes capital. Downsizing recovers only 25% of retired equipment and pays staff separation costs. Business loans require three months and a profitable last settlement; one outstanding loan, capped at 10% of invested equipment so liquidation covers secured principal. Downsizing first repays debt from equipment proceeds. Restructuring adds 8% principal and lengthens repayment, once per loan. Sale/closure pays debt from proceeds with any shortfall retained in personal cash. Six loss months plus a cash deficit triggers liquidation; debt is not forgiven. Net worth includes conservative equipment liquidation less business debt, not speculative company goodwill.
