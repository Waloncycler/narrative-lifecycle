# 07 Data Sources and Evidence Table

## Principle

No Evidence Table, no scoring.

## Data Sources by Layer

> For the comprehensive 65+ external data sources catalog and mapping matrix from `worldmonitor-main`, see [27 World Monitor Data Sources Integration Map](file:///Users/walox/Documents/narrative-lifecycle/narrative-lifecycle-dashboard-handoff-v0.1/docs/27_worldmonitor_data_sources_integration_map.md).

### Perception

Policy files, authoritative media, financial media, research reports, industry conferences, search/social trends, trading software concept boards, World Monitor RSS feeds (`rss_feeds`), GDELT news events (`gdelt`), Telegram OSINT (`telegram_osint`), Reddit velocity (`reddit_velocity`).

### Capital

Stock performance, sector breadth, volume, turnover, leader stocks, pullback resilience, fund flows, ETF/fund holdings, IPO/financing, institutional research activity, Finnhub stock quotes (`market_quotes`), Gulf GCC quotes (`gulf_quotes`), CFTC COT positioning (`cftc_cot`), PBOC/China social financing (`china_macro`).

### Pricing

Deep research reports, valuation models, company earnings forecasts, market size, value-per-unit, penetration assumptions, core asset formation, institutional allocation language, Commodity futures curves (`commodity_quotes`), Prediction market odds (`prediction_markets`), FRED interest rates & yield curve (`fred_economy`), IMF GDP revisions (`imf_macro`).

### Reality

Company announcements, financial reports, regulatory approvals, clinical trial data, customer adoption, orders/contracts, revenue, profit, government procurement, product delivery, repeat purchase, IMF PortWatch transit volumes (`portwatch`), US EIA petroleum inventories (`eia_petroleum`), UN Comtrade critical minerals exports (`comtrade_trade`), NASA FIRMS thermal fire points (`firms_fires`), SAM.gov government tender awards (`defense_tenders`).

### Feedback

Event sequence, price-news linkage, financing-capex-order linkage, order-report-price linkage, branch formation, multi-wave market structure, World Monitor AI correlation engine (`llm_correlation`).

### Friction

Negative news, clarifications, valuation data, good-news fatigue, clinical failure, approval delay, order postponement, regulatory restriction, competition, supply bottleneck, ACLED conflict events (`acled`), OFAC/FATF sanctions (`sanctions`), OREF siren alerts (`oref_sirens`), AviationStack delays (`aviation_stack`), GPSJAM EW jamming (`gpsjam`), Cloudflare internet outages (`submarine_cables`).

## Required Evidence Fields

- evidence_id
- topic_id
- branch_id
- event_date
- event_title
- event_summary
- event_type
- source_name
- source_url
- source_type
- evidence_strength
- affected_layer
- stage_effect
- parent_or_branch
- branch_coverage_score
- interpretation
- limitation
- positive_or_negative
- confidence
