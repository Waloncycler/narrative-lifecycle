# 27 World Monitor Data Sources Integration Map

## Overview

This specification documents the source adaptation strategy for `worldmonitor-main`. It is not a claim that every upstream is live or configured. The canonical runtime inventory is generated from the reference OpenAPI contracts by `npm run sources:inventory`.

The goal is to expand the system's evidence intake capabilities by ingesting multi-domain intelligence signals (geopolitics, macroeconomics, capital markets, energy, supply chain, infrastructure, remote sensing, and OSINT), mapping them to the **7 Narrative Lifecycle Layers**, and converting them into candidate evidence nodes for operator review.

---

## The 7 Narrative Lifecycle Layers Mapping

Each ingested signal from World Monitor is mapped to one or more of the 7 core lifecycle layers:

1. **名 (Perception / `name` or `perception`)**: Early signals, media narratives, social velocity, research titles, policy directives.
2. **资 (Capital Confirmation / `capital`)**: Stock price breakouts, sector market breadth, ETF fund flows, futures trader positioning (COT), A-share corporate disclosures.
3. **定价 (Pricing Adoption / `pricing`)**: Commodity futures curves (WTI, Brent, NatGas, Gold), implied probabilities from prediction markets (Polymarket), macro rate/inflation expectations.
4. **实 (Reality Validation / `reality`)**: Physical transit volumes (PortWatch chokepoints), energy inventory drawdowns (EIA/JODI/GIE), customs trade flows (UN Comtrade), satellite thermal fire detections (FIRMS), government contract awards (SAM.gov).
5. **势 (Feedback Momentum / `momentum` or `feedback`)**: Cross-source signal correlation, price-news feedback loops, multi-wave narrative escalation clusters.
6. **阻力 (Friction & Negative Pressure / `friction`)**: Sanctions & regulatory listings (OFAC, FATF), port & strait blockades, infrastructure/power grid outages, GPS jamming, airspace closures.
7. **数据置信度 (Data Confidence / `data_confidence`)**: Source provenance tiering, multi-angle confirmation count (3+ independent sources), signal freshness.

---

## Detailed Data Source Inventory & Payload Schema

Below is a curated reference map, not the canonical runtime inventory. Any strength or layer is a review hint and cannot be copied into formal Evidence without fact-level validation.

### Category 1: Geopolitics, Armed Conflict, Protest & Military Intelligence

| Source Key | Upstream Provider | Default Evidence Strength | Primary Lifecycle Layer | Default Event Type | Conversion & Signal Extraction Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `acled` | ACLED Armed Conflict Data | `E2` | `friction` / `reality` | `CONFLICT_EVENT` | Extracts battle/protest locations, fatality counts, event type. Strong indicator for friction or real-world geopolitical impact. |
| `ucdp` | Uppsala Conflict Data Program | `E2` | `friction` | `STATE_CONFLICT` | Georeferenced state-based and non-state conflict events. Converts to conflict friction evidence. |
| `gdelt` | GDELT Event Database | `E1` | `perception` / `friction` | `GLOBAL_NEWS_EVENT` | Ingests QuadClass, Goldstein score (-10 to +10), news tone, and actor pairs. Tracks global media narrative momentum. |
| `military_bases` | OSM / MIRTA / Pizzint | `E2` | `reality` | `BASE_POSTURE_CHANGE` | Military base deployment status, asset surges, and posture shifts in critical regions (e.g. Middle East, Indo-Pacific). |
| `military_flights` | OpenSky / ADS-B Exchange | `E2` | `reality` / `friction` | `AIR_RECON_SURGE` | Tracks ISR reconnaissance, aerial refueling tankers, and military transport flights indicating operational escalation. |
| `military_maritime` | Defense News / RSS / Custom | `E2` | `reality` | `NAVAL_DEPLOYMENT` | Carrier Strike Group (CSG) & Amphibious Ready Group (ARG) movements, submarine maneuvers, exercises. |
| `oref_sirens` | IDF Home Front Command | `E3` | `friction` | `ROCKET_SIREN_ALERT` | Real-time air raid/rocket sirens in Israel. Immediate high-severity friction signal. |
| `iran_events` | Regional Scrapers | `E2` | `perception` / `friction` | `REGIONAL_TENSION_EVENT` | Regional escalation events in Middle East theater. |
| `cross_strait` | Maritime / ADIZ Scrapers | `E2` | `reality` / `friction` | `ADIZ_INCURSION` | Taiwan Strait maritime presence & ADIZ flight incursions. |
| `defense_tenders` | SAM.gov / TED EU | `E3` | `reality` | `GOVT_CONTRACT_AWARD` | Public defense procurement awards & military R&D contract announcements. |
| `sanctions` | OFAC / EU / UN / FATF | `E3` | `friction` | `SANCTION_IMPOSED` | SDN list additions, FATF grey/blacklisting, trade embargo enforcement notices. |

### Category 2: Financial Markets, Macroeconomics & Sentiment

| Source Key | Upstream Provider | Default Evidence Strength | Primary Lifecycle Layer | Default Event Type | Conversion & Signal Extraction Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `market_quotes` | Finnhub / Yahoo Finance | `E2` | `capital` | `STOCK_INDEX_BREAKOUT` | Global equity index returns (S&P 500, Nasdaq, Nikkei, DAX, A-shares), volume surges. |
| `gulf_quotes` | Gulf Exchanges / Yahoo | `E2` | `capital` | `GULF_MARKET_SHIFT` | Saudi TASI, UAE DFM/ADX, Qatar stock indices & Gulf sovereign energy equities. |
| `commodity_quotes` | Finnhub / Yahoo | `E3` | `pricing` / `reality` | `COMMODITY_PRICE_SPIKE` | Crude oil (WTI, Brent), NatGas (TTF, HH), Gold, Silver, Copper, Agricultural futures. |
| `fred_economy` | US Federal Reserve FRED | `E3` | `pricing` / `capital` | `MACRO_RATE_REVISION` | Fed Funds Rate, Treasury yield curve (10Y-2Y spread), CPI/PCE inflation, M2, Non-farm payrolls. |
| `imf_macro` | IMF SDMX / WEO | `E2` | `pricing` | `IMF_GDP_FORECAST_REVISION` | Global & country-level GDP growth projections, central bank gold reserves. |
| `wb_indicators` | World Bank WDI | `E2` | `pricing` / `reality` | `WB_INDICATOR_UPDATE` | External debt sustainability, import concentration index (HHI), macroeconomic resilience. |
| `bis_data` | Bank for Int'l Settlements | `E2` | `pricing` / `capital` | `BIS_CREDIT_GAP` | Credit-to-GDP gaps, real effective exchange rates (REER), international banking flows. |
| `eurostat` | Eurostat REST API | `E2` | `reality` / `pricing` | `EU_INDUSTRIAL_PRODUCTION` | EU industrial production indices, government debt ratios, housing price trends. |
| `china_macro` | PBOC / NBS / CNINFO | `E3` | `capital` / `reality` | `CHINA_TSF_POLICY_SHIFT` | PBOC policy rates (MLF/LPR), Total Social Financing (TSF), M2 growth, real estate metrics. |
| `cftc_cot` | CFTC COT Reports | `E2` | `capital` | `COT_POSITIONING_SHIFT` | Net long/short positioning of commercial hedgers vs money managers in energy/metals. |
| `aaii_sentiment` | AAII / Fear & Greed | `E1` | `perception` / `capital` | `SENTIMENT_EXTREME` | Retail investor Bull/Bear ratio, CNN Fear & Greed Index extreme reads. |
| `crypto_quotes` | CoinGecko / Hyperliquid | `E1` | `capital` | `CRYPTO_LIQUIDITY_SHIFT` | BTC/ETH prices, stablecoin market cap expansion/contraction (USDT/USDC), DEX flows. |
| `prediction_markets` | Polymarket / Kalshi | `E2` | `pricing` | `PREDICTION_ODDS_SHIFT` | Real-time market-implied probability changes for political, geopolitical, and rate decisions. |

### Category 3: Energy, Supply Chain & Maritime Tracking

| Source Key | Upstream Provider | Default Evidence Strength | Primary Lifecycle Layer | Default Event Type | Conversion & Signal Extraction Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ais_vessels` | AISStream WebSocket | `E2` | `reality` | `VESSEL_TRANSIT_ANOMALY` | Tanker & container vessel movement anomalies in strategic choke points. |
| `portwatch` | IMF PortWatch API | `E3` | `reality` / `friction` | `PORT_DISRUPTION_ALERT` | Daily transit counts and disruption risk scores at Suez Canal, Strait of Hormuz, Bab el-Mandeb, Panama Canal. |
| `eia_petroleum` | US EIA Open Data API | `E3` | `reality` | `EIA_INVENTORY_DRAWDOWN` | Weekly US crude oil stocks, Strategic Petroleum Reserve (SPR) changes, refinery utilization. |
| `iea_jodi` | IEA / JODI Oil & Gas | `E3` | `reality` | `GLOBAL_OIL_STOCK_CHANGE` | Global commercial oil reserves, national oil demand/supply balances. |
| `gie_gas` | AGSI+ GIE Gas Storage | `E3` | `reality` | `EU_GAS_STORAGE_LEVEL` | European underground natural gas storage fullness % relative to 5-year average. |
| `electricity_grid` | ENTSO-E / Ember / Power | `E2` | `reality` / `friction` | `POWER_PRICE_SPIKE` | Day-ahead electricity spot prices, fossil vs clean generation share, grid reliability. |
| `pipelines_storage` | GEM (Global Energy Monitor) | `E2` | `reality` | `PIPELINE_FLOW_UPDATE` | Major oil/gas pipeline operational status and crude storage tank farm capacity. |
| `comtrade_trade` | UN Comtrade API | `E3` | `reality` | `CRITICAL_MINERAL_EXPORTS` | Bilateral trade volumes for Lithium, Cobalt, Rare Earths, Semiconductors, Energy equipment. |
| `consumer_prices` | Country Scrapers / FAO | `E2` | `pricing` / `friction` | `FOOD_PRICE_INDEX_RISE` | Scraped retail grocery basket prices, FAO Global Food Price Index changes. |

### Category 4: Aviation, Infrastructure & Remote Sensing

| Source Key | Upstream Provider | Default Evidence Strength | Primary Lifecycle Layer | Default Event Type | Conversion & Signal Extraction Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `aviation_stack` | AviationStack API | `E2` | `reality` / `friction` | `FLIGHT_DELAY_SPIKE` | Airport delay indices, airspace closures (NOTAMs), carrier operational disruptions. |
| `gpsjam` | GPSJAM / ADS-B Exchange | `E2` | `friction` | `GPS_JAMMING_HOTSPOT` | Aircraft-reported GPS degradation regions, indicating electronic warfare (EW) activity. |
| `submarine_cables` | TeleGeography / Cloudflare | `E3` | `friction` | `INTERNET_OUTAGE_ALERT` | Subsea optical cable breaks, nationwide internet connectivity drops. |
| `firms_fires` | NASA FIRMS FIRMS API | `E3` | `reality` / `friction` | `THERMAL_ANOMALY_DETECTED` | Thermal anomaly satellite detection (industrial fires, pipeline explosions, combat strikes). |
| `climate_disasters` | USGS / NOAA / ReliefWeb | `E2` | `friction` / `reality` | `NATURAL_DISASTER_EVENT` | Earthquakes (M>4.5), hurricane/typhoon landfalls, flood disasters. |
| `disease_outbreaks` | WHO DON / ProMED | `E2` | `friction` | `EPIDEMIC_OUTBREAK_NOTICE` | WHO Disease Outbreak News (DON) alerts, global pandemic/epidemic tracking. |
| `radiation_watch` | EURDEP / Safecast | `E3` | `friction` | `RADIATION_LEVEL_ELEVATED` | Gamma dose rate readings near European nuclear power facilities. |

### Category 5: News, Social Media, OSINT & Intelligence Aggregation

| Source Key | Upstream Provider | Default Evidence Strength | Primary Lifecycle Layer | Default Event Type | Conversion & Signal Extraction Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `rss_feeds` | 200+ Global RSS Feeds | `E1` | `perception` | `NEWS_ARTICLE_PUBLISHED` | Global financial, policy, defense, and energy news coverage. |
| `telegram_osint` | Telegram MTProto Client | `E1` | `perception` / `friction` | `TELEGRAM_BREAKING_ALERT` | Real-time conflict, geopolitical, and market posts from monitored channels. |
| `reddit_velocity` | ScrapeCreators / Reddit | `E1` | `perception` / `capital` | `SOCIAL_VELOCITY_BURST` | Subreddit post volume & ticker sentiment spikes (e.g. r/WallStreetBets). |
| `llm_correlation` | Groq / OpenRouter / Ollama | `E2` | `momentum` | `CORRELATION_CLUSTER_IDENTIFIED` | Multi-source event clustering, AI composite threat score calculation, cross-domain narrative linkage. |

---

## Integration Architecture & Data Flow

```text
World Monitor Raw Feed / Seed Snapshot JSON
       │
       ▼
Source Registry + HTTP Adapter (src/infrastructure/worldmonitor_source_adapter.ts)
       │
       ├─► 1. Classify access and evidence eligibility from OpenAPI
       ├─► 2. Apply terms, sensitivity, retention and polling governance
       ├─► 3. Fetch sandbox or live payload with truthful runtime state
       ├─► 4. Dispatch by operation ID to a versioned source normalizer
       ├─► 5. Separate event/availability time and extract URL, metrics and location
       ├─► 6. Hash payload and generate bounded, cited live records
       ├─► 7. Generate conservative E1 / low-confidence / unresolved candidates
       │
       ▼
Application Use Case (src/application/use_cases/sync_worldmonitor_sources_use_case.ts)
       │
       ▼
Operator Review Gate (Human Researcher Review) -> Accept / Modify / Reject
       │
       ▼
Validated Evidence Node -> Evidence Table -> Stage Gate -> Scoring
```

---

## Guardrails & Non-Goals

1. **Human Operator Approval Required**: Ingested World Monitor signals are imported as **Candidates** (`EvidenceCandidate`). No signal automatically changes Narrative Stage, mutates rules, or updates scoring without explicit operator approval.
2. **No Unvalidated Financial Advice**: Ingestion logic extracts empirical factual signals only (e.g. transit count, price move, inventory change); it does not issue buy/sell signals.
3. **Traceability**: Every candidate preserves the exact source URL, timestamp, raw payload hash, and quote location label.

## Governed Source Contract

Every operation records:

- `source_class`: direct public or World Monitor hosted.
- `governance_state`: research ready, review required, restricted, or blocked.
- `terms_status`, `license_id`, and `terms_url`.
- attribution and redistribution policy.
- public, potential-PII, operational, or restricted sensitivity.
- raw-payload handling and retention period.
- expected freshness window and automated-polling permission.

The default is fail closed. Public endpoints may produce local research candidates only when explicitly marked `research_ready`; raw redistribution remains disabled. World Monitor-hosted operations require a configured key and applicable entitlement. Operationally sensitive services remain review-required. Raw payloads are transient and are not written into artifacts.

## Source-Specific Normalizers

The first versioned normalizer registry covers:

- USGS earthquake event time, magnitude, depth, significance, coordinates, and event URL.
- NASA EONET latest observation, category, magnitude/unit, coordinates, and event URL.
- GDACS event/availability dates, alert level, severity, country, coordinates, and report URL.
- NWS sent/onset/expiry times, severity, certainty, urgency, area, and alert URL.
- WHO DON publication date, notice ID, title, and canonical item URL.
- US Treasury record date and total public debt metric.
- CFTC positioning metrics and World Bank indicator values as context-only records.

Unknown operations retain a bounded generic normalizer. A normalizer describes source facts only; Topic, Branch, Evidence strength, Stage effect, and lifecycle classification remain outside this layer.
