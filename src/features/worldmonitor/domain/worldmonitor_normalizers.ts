import type {
  WorldMonitorNormalizedFact,
  WorldMonitorPayload,
} from '@/features/worldmonitor/types/worldmonitor_adapter';
import {
  FEED_OPERATION_IDS,
  feedRecordsForOperation,
  isFeedOperation,
  normalizeFeedSource,
  normalizerIdForFeedOperation,
} from '@/features/worldmonitor/domain/worldmonitor_feed_parsing';

type RecordValue = Record<string, unknown>;
type Normalizer = (record: RecordValue, payload: WorldMonitorPayload) => WorldMonitorNormalizedFact | null;

const NORMALIZERS: Partial<Record<string, Normalizer>> = {
  DirectUSGSEarthquakes: normalizeUsgs,
  DirectNASAEonetEvents: normalizeEonet,
  DirectGDACSEvents: normalizeGdacs,
  DirectNWSAlerts: normalizeNws,
  DirectWHODiseaseOutbreaks: normalizeWho,
  DirectUSTreasuryDebt: normalizeTreasury,
  DirectCFTCCotFinancial: normalizeCftc,
  DirectWorldBankGDP: normalizeWorldBank,
  DirectGdeltDocArticles: normalizeGdelt,
  DirectCoinbaseSpotPrice: normalizeCoinbase,
  DirectEastmoneyConceptBoards: normalizeEastmoneyBoards,
  DirectEastmoneyStockQuote: normalizeEastmoneyQuote,
  DirectClinicalTrialsGovStudies: normalizeClinicalTrials,
  DirectUnComtradePreview: normalizeUnComtrade,
  DirectSecEdgarNvidia: normalizeSecEdgar,
  DirectSecEdgarApple: normalizeSecEdgar,
  DirectSecEdgarTsmc: normalizeSecEdgar,
  DirectHackerNewsStories: normalizeHackerNews,
  DirectFearGreedIndex: normalizeFearGreed,
  DirectCoinGeckoTrending: normalizeCoinGecko,
};

const NORMALIZER_IDS: Record<string, string> = {
  DirectUSGSEarthquakes: 'usgs_earthquake',
  DirectNASAEonetEvents: 'nasa_eonet_event',
  DirectGDACSEvents: 'gdacs_event',
  DirectNWSAlerts: 'nws_alert',
  DirectWHODiseaseOutbreaks: 'who_disease_outbreak',
  DirectUSTreasuryDebt: 'us_treasury_debt',
  DirectCFTCCotFinancial: 'cftc_positioning',
  DirectWorldBankGDP: 'world_bank_gdp',
  DirectGdeltDocArticles: 'gdelt_doc_article',
  DirectCoinbaseSpotPrice: 'coinbase_spot_price',
  DirectEastmoneyConceptBoards: 'eastmoney_concept_board',
  DirectEastmoneyStockQuote: 'eastmoney_stock_quote',
  DirectClinicalTrialsGovStudies: 'clinical_trial_update',
  DirectUnComtradePreview: 'un_comtrade_flow',
  DirectSecEdgarNvidia: 'sec_edgar_submission',
  DirectSecEdgarApple: 'sec_edgar_submission',
  DirectSecEdgarTsmc: 'sec_edgar_submission',
  DirectHackerNewsStories: 'hacker_news_story',
  DirectFearGreedIndex: 'fear_greed_index',
  DirectCoinGeckoTrending: 'coingecko_trending',
};

// Category 8 (v0.8.1+): vendor official blogs, arXiv, open-source and
// reference feeds. They share one generic normalizer family defined in
// worldmonitor_feed_parsing.ts (RSS/Atom, HTML list and JSON list extraction).
for (const operationId of FEED_OPERATION_IDS) {
  NORMALIZERS[operationId] = (record, payload) => normalizeFeedSource(operationId, record, payload);
  NORMALIZER_IDS[operationId] = normalizerIdForFeedOperation(operationId);
}

export function normalizerIdForOperation(operationId: string): string {
  return NORMALIZER_IDS[operationId] ?? 'generic_record';
}

export function recordsForWorldMonitorPayload(payload: WorldMonitorPayload): RecordValue[] {
  const body = payload.body;
  if (!isObject(body) && !Array.isArray(body)) return [];
  switch (payload.descriptor.operation_id) {
    case 'DirectUSGSEarthquakes':
    case 'DirectGDACSEvents':
    case 'DirectNWSAlerts':
      return objectArray(isObject(body) ? body.features : null);
    case 'DirectNASAEonetEvents':
      return objectArray(isObject(body) ? body.events : null);
    case 'DirectWHODiseaseOutbreaks':
      return objectArray(isObject(body) ? body.value : null);
    case 'DirectUSTreasuryDebt':
      return objectArray(isObject(body) ? body.data : null);
    case 'DirectCFTCCotFinancial':
      return objectArray(body);
    case 'DirectWorldBankGDP':
      return Array.isArray(body) ? objectArray(body[1]) : [];
    case 'DirectGdeltDocArticles':
      return objectArray(isObject(body) ? body.articles : null);
    case 'DirectCoinbaseSpotPrice': {
      const quote = object(isObject(body) ? body.data : null);
      return quote ? [quote] : [];
    }
    case 'DirectEastmoneyConceptBoards':
      return objectArray(object(isObject(body) ? body.data : null)?.diff);
    case 'DirectEastmoneyStockQuote': {
      const quote = object(isObject(body) ? body.data : null);
      return quote ? [quote] : [];
    }
    case 'DirectClinicalTrialsGovStudies':
      return objectArray(isObject(body) ? body.studies : null);
    case 'DirectUnComtradePreview':
      return objectArray(isObject(body) ? body.data : null);
    case 'DirectSecEdgarNvidia':
    case 'DirectSecEdgarApple':
    case 'DirectSecEdgarTsmc':
      return secEdgarRecords(body);
    case 'DirectHackerNewsStories':
      return objectArray(isObject(body) ? body.hits : null);
    case 'DirectFearGreedIndex':
      return objectArray(isObject(body) ? body.data : null);
    case 'DirectCoinGeckoTrending':
      return objectArray(isObject(body) ? body.coins : null).flatMap((coin) => object(coin.item) ? [object(coin.item) as RecordValue] : []);
    default:
      return isFeedOperation(payload.descriptor.operation_id)
        ? feedRecordsForOperation(payload.descriptor.operation_id, body)
        : recordsFromWorldMonitorPayload(body);
  }
}

export function normalizedFactsFromWorldMonitorPayload(payload: WorldMonitorPayload): WorldMonitorNormalizedFact[] {
  const normalize = NORMALIZERS[payload.descriptor.operation_id] ?? normalizeGeneric;
  return recordsForWorldMonitorPayload(payload)
    .map((record) => normalize(record, payload))
    .filter((fact): fact is WorldMonitorNormalizedFact => fact !== null);
}

export function recordsFromWorldMonitorPayload(body: unknown): RecordValue[] {
  if (Array.isArray(body)) return objectArray(body).slice(0, 250);
  if (!isObject(body)) return [];
  const arrays = collectRecordArrays(body, 0);
  if (arrays.length) return arrays.flat().slice(0, 250);
  return Object.keys(body).length ? [body] : [];
}

function normalizeUsgs(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const properties = object(record.properties) ?? record;
  const geometry = object(record.geometry);
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const magnitude = number(properties.mag);
  const place = string(properties.place);
  const sourceTitle = string(properties.title) ?? [magnitude === null ? null : `M ${magnitude}`, place].filter(Boolean).join(' - ');
  if (!sourceTitle) return null;
  const eventAt = iso(properties.time, payload.fetched_at);
  const depth = number(coordinates[2]);
  const metrics = numericRecord({
    magnitude,
    depth_km: depth,
    felt_reports: number(properties.felt),
    significance: number(properties.sig),
    tsunami_flag: number(properties.tsunami),
  });
  return fact({
    record,
    payload,
    id: string(record.id) ?? string(properties.code),
    eventAt,
    availableAt: eventAt,
    title: sourceTitle,
    summary: sentence([
      `Magnitude ${magnitude ?? 'unknown'} earthquake`,
      place ? `near ${place}` : null,
      depth === null ? null : `at ${depth} km depth`,
      string(properties.status) ? `status ${string(properties.status)}` : null,
    ]),
    eventType: 'EARTHQUAKE_RECORDED',
    sourceUrl: string(properties.url) ?? payload.source_url,
    sourceQuote: JSON.stringify({
      title: sourceTitle,
      magnitude,
      place,
      time: properties.time,
      depth_km: depth,
      status: properties.status,
      url: properties.url,
    }),
    location: {
      lng: number(coordinates[0]) ?? undefined,
      lat: number(coordinates[1]) ?? undefined,
      region_name: place ?? undefined,
    },
    metrics,
    normalizerId: 'usgs_earthquake',
  });
}

function normalizeEonet(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const title = string(record.title);
  if (!title) return null;
  const geometries = objectArray(record.geometry);
  const latest = geometries.at(-1) ?? {};
  const coordinates = Array.isArray(latest.coordinates) ? latest.coordinates : [];
  const categories = objectArray(record.categories).flatMap((item) => string(item.title) ?? []);
  const eventAt = iso(latest.date ?? record.closed, payload.fetched_at);
  const magnitude = number(latest.magnitudeValue);
  return fact({
    record,
    payload,
    id: string(record.id),
    eventAt,
    availableAt: eventAt,
    title,
    summary: sentence([
      categories.length ? `NASA EONET ${categories.join(', ')} event` : 'NASA EONET event',
      string(record.description),
      magnitude === null ? null : `latest magnitude ${magnitude} ${string(latest.magnitudeUnit) ?? ''}`.trim(),
      `last observed ${eventAt.slice(0, 10)}`,
    ]),
    eventType: 'NATURAL_EVENT_OBSERVED',
    sourceUrl: string(record.link) ?? payload.source_url,
    sourceQuote: JSON.stringify({
      id: record.id,
      title,
      description: record.description,
      categories: record.categories,
      latest_geometry: latest,
      link: record.link,
    }),
    location: {
      lng: number(coordinates[0]) ?? undefined,
      lat: number(coordinates[1]) ?? undefined,
    },
    metrics: numericRecord({ magnitude }),
    normalizerId: 'nasa_eonet_event',
  });
}

function normalizeGdacs(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const properties = object(record.properties) ?? record;
  const name = string(properties.name) ?? string(properties.description);
  if (!name) return null;
  const geometry = object(record.geometry);
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const urls = object(properties.url);
  const severity = object(properties.severitydata);
  const eventAt = iso(properties.fromdate, payload.fetched_at);
  const availableAt = iso(properties.datemodified ?? properties.todate, eventAt);
  const alertLevel = string(properties.alertlevel);
  return fact({
    record,
    payload,
    id: [string(properties.eventtype), string(properties.eventid)].filter(Boolean).join('-') || null,
    eventAt,
    availableAt,
    title: name,
    summary: sentence([
      alertLevel ? `${alertLevel} GDACS alert` : 'GDACS alert',
      string(properties.country),
      string(properties.htmldescription),
      string(severity?.severitytext),
    ]),
    eventType: `GDACS_${string(properties.eventtype) ?? 'EVENT'}`,
    sourceUrl: string(urls?.report) ?? payload.source_url,
    sourceQuote: JSON.stringify({
      eventtype: properties.eventtype,
      eventid: properties.eventid,
      name,
      country: properties.country,
      fromdate: properties.fromdate,
      todate: properties.todate,
      datemodified: properties.datemodified,
      alertlevel: properties.alertlevel,
      alertscore: properties.alertscore,
      severitydata: properties.severitydata,
      report_url: urls?.report,
    }),
    location: {
      lng: number(coordinates[0]) ?? undefined,
      lat: number(coordinates[1]) ?? undefined,
      country: string(properties.country) ?? undefined,
    },
    metrics: numericRecord({
      alert_level: rank(string(properties.alertlevel), ['green', 'orange', 'red']),
      alert_score: number(properties.alertscore),
      episode_alert_score: number(properties.episodealertscore),
      severity: number(severity?.severity),
    }),
    normalizerId: 'gdacs_event',
  });
}

function normalizeNws(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const properties = object(record.properties) ?? record;
  const headline = string(properties.headline) ?? string(properties.event);
  if (!headline) return null;
  const eventAt = iso(properties.onset ?? properties.effective ?? properties.sent, payload.fetched_at);
  const availableAt = iso(properties.sent, eventAt);
  return fact({
    record,
    payload,
    id: string(properties.id) ?? string(record.id),
    eventAt,
    availableAt,
    title: headline,
    summary: sentence([
      string(properties.event),
      string(properties.areaDesc) ? `area ${string(properties.areaDesc)}` : null,
      string(properties.severity) ? `severity ${string(properties.severity)}` : null,
      string(properties.urgency) ? `urgency ${string(properties.urgency)}` : null,
      string(properties.certainty) ? `certainty ${string(properties.certainty)}` : null,
      string(properties.expires) ? `expires ${iso(properties.expires, eventAt)}` : null,
    ]),
    eventType: 'NWS_WEATHER_ALERT',
    sourceUrl: string(properties['@id']) ?? string(record.id) ?? payload.source_url,
    sourceQuote: JSON.stringify({
      id: properties.id,
      headline,
      event: properties.event,
      areaDesc: properties.areaDesc,
      sent: properties.sent,
      onset: properties.onset,
      expires: properties.expires,
      severity: properties.severity,
      urgency: properties.urgency,
      certainty: properties.certainty,
      source_url: properties['@id'],
    }),
    location: { region_name: string(properties.areaDesc) ?? undefined },
    metrics: {
      severity_level: rank(string(properties.severity), ['unknown', 'minor', 'moderate', 'severe', 'extreme']),
      urgency_level: rank(string(properties.urgency), ['unknown', 'past', 'future', 'expected', 'immediate']),
      certainty_level: rank(string(properties.certainty), ['unknown', 'unlikely', 'possible', 'likely', 'observed']),
    },
    normalizerId: 'nws_alert',
  });
}

function normalizeWho(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const title = string(record.Title);
  if (!title) return null;
  const publishedAt = iso(record.PublicationDateAndTime, payload.fetched_at);
  const path = string(record.ItemDefaultUrl);
  const sourceUrl = path?.startsWith('http')
    ? path
    : path
      ? `https://www.who.int/emergencies/disease-outbreak-news/item${path}`
      : payload.source_url;
  return fact({
    record,
    payload,
    id: path?.replace(/^\//, '') ?? null,
    eventAt: publishedAt,
    availableAt: publishedAt,
    title,
    summary: `WHO Disease Outbreak News notice published ${publishedAt.slice(0, 10)}: ${title}.`,
    eventType: 'WHO_DISEASE_OUTBREAK_NOTICE',
    sourceUrl,
    sourceQuote: JSON.stringify(record),
    normalizerId: 'who_disease_outbreak',
  });
}

function normalizeTreasury(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const date = string(record.record_date);
  const amount = number(record.tot_pub_debt_out_amt);
  if (!date || amount === null) return null;
  const eventAt = iso(date, payload.fetched_at);
  return fact({
    record,
    payload,
    id: date,
    eventAt,
    availableAt: eventAt,
    title: `US public debt recorded on ${date}`,
    summary: `US Treasury reported total public debt outstanding of $${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} on ${date}.`,
    eventType: 'US_PUBLIC_DEBT_RECORDED',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: { total_public_debt_usd: amount },
    normalizerId: 'us_treasury_debt',
  });
}

function normalizeCftc(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const date = string(record.report_date_as_yyyy_mm_dd);
  const market = string(record.market_and_exchange_names) ?? string(record.contract_market_name);
  if (!date || !market) return null;
  const eventAt = iso(date, payload.fetched_at);
  const net = difference(number(record.noncomm_positions_long_all), number(record.noncomm_positions_short_all));
  return fact({
    record,
    payload,
    id: `${date}-${market}`,
    eventAt,
    availableAt: eventAt,
    title: `CFTC positioning report: ${market}`,
    summary: sentence([`CFTC report dated ${date}`, net === null ? null : `non-commercial net position ${net} contracts`]),
    eventType: 'CFTC_POSITIONING_REPORTED',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: numericRecord({ noncommercial_net_contracts: net }),
    normalizerId: 'cftc_positioning',
  });
}

function normalizeWorldBank(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const country = object(record.country);
  const countryName = string(country?.value) ?? string(record.countryiso3code);
  const date = string(record.date);
  const value = number(record.value);
  if (!countryName || !date || value === null) return null;
  const eventAt = iso(`${date}-01-01`, payload.fetched_at);
  return fact({
    record,
    payload,
    id: string(record.id) ?? `${countryName}-${date}`,
    eventAt,
    availableAt: payload.fetched_at,
    title: `World Bank GDP indicator: ${countryName}, ${date}`,
    summary: `World Bank indicator NY.GDP.MKTP.CD reports ${value.toLocaleString('en-US')} current US dollars for ${countryName} in ${date}.`,
    eventType: 'WORLD_BANK_GDP_REPORTED',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    location: { country: countryName },
    metrics: { gdp_current_usd: value },
    normalizerId: 'world_bank_gdp',
  });
}

function normalizeGdelt(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const title = string(record.title);
  const url = string(record.url);
  if (!title) return null;
  const country = string(record.sourcecountry);
  const eventAt = gdeltIso(string(record.seendate), payload.fetched_at);
  return fact({
    record,
    payload,
    id: url ?? null,
    eventAt,
    availableAt: eventAt,
    title,
    summary: sentence([
      string(record.domain) ? `source domain ${string(record.domain)}` : null,
      string(record.language) ? `language ${string(record.language)}` : null,
      country ? `country ${country}` : null,
      `seen ${eventAt.slice(0, 10)}`,
    ]),
    eventType: 'GLOBAL_NEWS_EVENT',
    sourceUrl: url ?? payload.source_url,
    sourceQuote: JSON.stringify({
      title,
      url,
      domain: record.domain,
      language: record.language,
      sourcecountry: record.sourcecountry,
      seendate: record.seendate,
    }),
    location: country ? { country } : undefined,
    normalizerId: 'gdelt_doc_article',
  });
}

function normalizeCoinbase(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const base = string(record.base);
  const currency = string(record.currency);
  const amount = number(record.amount);
  if (!base || !currency || amount === null) return null;
  const pair = `${base}-${currency}`;
  return fact({
    record,
    payload,
    id: pair,
    eventAt: payload.fetched_at,
    availableAt: payload.fetched_at,
    title: `${pair} spot price ${amount} ${currency}`,
    summary: sentence([
      `Coinbase public spot quote ${pair}`,
      `price ${amount} ${currency}`,
    ]),
    eventType: 'CRYPTO_SPOT_PRICE',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: numericRecord({ spot_price: amount }),
    normalizerId: 'coinbase_spot_price',
  });
}

function normalizeEastmoneyBoards(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const name = string(record.f14);
  const code = string(record.f12);
  if (!name) return null;
  const changePct = number(record.f3);
  const eventAt = payload.fetched_at;
  return fact({
    record,
    payload,
    id: code ?? null,
    eventAt,
    availableAt: eventAt,
    title: changePct === null ? `A股概念板块 ${name} 异动` : `A股概念板块 ${name} ${changePct >= 0 ? '涨' : '跌'} ${Math.abs(changePct)}%`,
    summary: sentence([
      `A股概念板块 ${name}${code ? ` (${code})` : ''}`,
      changePct === null ? null : `变动 ${changePct}%`,
      number(record.f2) === null ? null : `最新价 ${number(record.f2)}`,
      number(record.f8) === null ? null : `换手率 ${number(record.f8)}%`,
    ]),
    eventType: 'CONCEPT_BOARD_MOVE',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    location: { country: 'China', region_name: 'A股概念板块' },
    metrics: numericRecord({
      change_pct: changePct,
      price: number(record.f2),
      amount_yi: number(record.f6),
      turnover_rate: number(record.f8),
      volume_ratio: number(record.f10),
      total_market_cap_yi: number(record.f20),
    }),
    normalizerId: 'eastmoney_concept_board',
  });
}

function normalizeEastmoneyQuote(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const name = string(record.f58);
  const code = string(record.f57);
  const latest = number(record.f43);
  if (!name || latest === null) return null;
  const eventAt = payload.fetched_at;
  const changePct = number(record.f170);
  return fact({
    record,
    payload,
    id: code ?? null,
    eventAt,
    availableAt: eventAt,
    title: changePct === null ? `A股 ${name}${code ? ` (${code})` : ''} 报 ${latest}` : `A股 ${name}${code ? ` (${code})` : ''} ${changePct >= 0 ? '涨' : '跌'} ${Math.abs(changePct)}%`,
    summary: sentence([
      `A股 ${name}${code ? ` (${code})` : ''}`,
      `最新价 ${latest}`,
      changePct === null ? null : `变动 ${changePct}%`,
      number(record.f44) === null ? null : `最高 ${number(record.f44)}`,
      number(record.f45) === null ? null : `最低 ${number(record.f45)}`,
    ]),
    eventType: 'A_SHARE_QUOTE',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    location: { country: 'China', region_name: 'A股' },
    metrics: numericRecord({
      latest: latest,
      open: number(record.f46),
      high: number(record.f44),
      low: number(record.f45),
      change_pct: changePct,
      volume: number(record.f47),
      amount_yi: number(record.f48),
    }),
    normalizerId: 'eastmoney_stock_quote',
  });
}

function normalizeClinicalTrials(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const section = object(record.protocolSection);
  const identification = object(section?.identificationModule);
  const title = string(identification?.briefTitle);
  const nctId = string(identification?.nctId);
  if (!title && !nctId) return null;
  const status = object(section?.statusModule);
  const design = object(section?.designModule);
  const enrollment = object(design?.enrollmentInfo);
  const conditionsModule = object(section?.conditionsModule);
  const conditions = Array.isArray(conditionsModule?.conditions)
    ? conditionsModule.conditions.flatMap((item) => string(item) ?? [])
    : [];
  const locations = objectArray(object(section?.contactsLocationsModule)?.locations);
  const country = string(object(locations[0] ?? null)?.country);
  const eventAt = iso(string(object(status?.lastUpdatePostDateStruct)?.date) ?? string(object(status?.studyFirstPostDateStruct)?.date), payload.fetched_at);
  return fact({
    record,
    payload,
    id: nctId,
    eventAt,
    availableAt: eventAt,
    title: title ?? `${nctId ?? 'Clinical trial'} update`,
    summary: sentence([
      string(status?.overallStatus) ? `status ${string(status?.overallStatus)}` : null,
      conditions.length ? `conditions: ${conditions.join(', ')}` : null,
      string(design?.studyType) ? `type ${string(design?.studyType)}` : null,
      number(enrollment?.count) === null ? null : `enrollment ${number(enrollment?.count)}`,
    ]),
    eventType: 'CLINICAL_TRIAL_UPDATE',
    sourceUrl: nctId ? `https://clinicaltrials.gov/study/${nctId}` : payload.source_url,
    sourceQuote: JSON.stringify({
      nctId,
      briefTitle: title,
      overallStatus: status?.overallStatus,
      conditions: conditions,
      lastUpdate: status?.lastUpdatePostDateStruct,
    }),
    location: country ? { country } : undefined,
    metrics: numericRecord({ enrollment_count: number(enrollment?.count) }),
    normalizerId: 'clinical_trial_update',
  });
}

function normalizeUnComtrade(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const reporter = string(record.reporterCode) ?? string(record.reporterISO);
  const cmdCode = string(record.cmdCode);
  const flow = string(record.flowCode);
  const year = string(record.refYear);
  if (!reporter && !cmdCode) return null;
  const value = number(record.primaryValue);
  const eventAt = iso(year ? `${year}-01-01` : null, payload.fetched_at);
  return fact({
    record,
    payload,
    id: [year, reporter, flow, cmdCode, string(record.partnerCode)].filter(Boolean).join('-') || null,
    eventAt,
    availableAt: payload.fetched_at,
    title: `UN Comtrade record HS ${cmdCode ?? 'unknown'} reporter ${reporter ?? 'unknown'}${flow ? ` flow ${flow}` : ''}${year ? ` (${year})` : ''}`,
    summary: sentence([
      `UN Comtrade ${year ?? 'latest'} record`,
      cmdCode ? `HS code ${cmdCode}` : null,
      reporter ? `reporter ${reporter}` : null,
      string(record.partnerCode) ? `partner ${string(record.partnerCode)}` : null,
      value === null ? null : `trade value $${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    ]),
    eventType: 'TRADE_FLOW_RECORDED',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: numericRecord({
      trade_value_usd: value,
      quantity: number(record.qty),
      net_weight_kg: number(record.netWeight),
    }),
    normalizerId: 'un_comtrade_flow',
  });
}

function normalizeSecEdgar(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const form = string(record.form);
  const filingDate = string(record.filingDate);
  const accession = string(record.accessionNumber);
  if (!form || !filingDate) return null;
  const body = object(payload.body);
  const company = string(body?.name) ?? 'SEC registrant';
  const eventAt = iso(filingDate, payload.fetched_at);
  const primaryDocument = string(record.primaryDocument);
  const reportDate = string(record.reportDate);
  const accessionSlug = accession?.replace(/[^A-Za-z0-9-]/g, '');
  return fact({
    record,
    payload,
    id: accession ?? null,
    eventAt,
    availableAt: eventAt,
    title: `${company} filed ${form} on ${filingDate}`,
    summary: sentence([
      `${company} official SEC EDGAR submission`,
      `form type ${form}`,
      reportDate ? `report period ending ${reportDate}` : null,
      primaryDocument ? `document ${primaryDocument}` : null,
    ]),
    eventType: 'OFFICIAL_SEC_FILING',
    sourceUrl: accessionSlug
      ? `https://www.sec.gov/Archives/edgar/data/${string(body?.cik) ?? '0'}/${accessionSlug.replaceAll('-', '')}/${primaryDocument ?? 'index.json'}`
      : payload.source_url,
    sourceQuote: JSON.stringify({ form, filingDate, reportDate, accessionNumber: accession, primaryDocument }),
    metrics: numericRecord({ filing_order: number(record.order) }),
    normalizerId: 'sec_edgar_submission',
  });
}

function normalizeHackerNews(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const title = string(record.title);
  const objectId = string(record.objectID);
  if (!title && !objectId) return null;
  const eventAt = iso(record.created_at, payload.fetched_at);
  const discussionUrl = objectId ? `https://news.ycombinator.com/item?id=${objectId}` : null;
  return fact({
    record,
    payload,
    id: objectId ?? null,
    eventAt,
    availableAt: eventAt,
    title: title ?? `Hacker News discussion ${objectId}`,
    summary: sentence([
      string(record.url) ? `link ${string(record.url)}` : null,
      number(record.points) === null ? null : `${number(record.points)} points`,
      number(record.num_comments) === null ? null : `${number(record.num_comments)} comments`,
      `discussed ${eventAt.slice(0, 10)}`,
    ]),
    eventType: 'COMMUNITY_DISCUSSION_SIGNAL',
    sourceUrl: string(record.url) ?? discussionUrl ?? payload.source_url,
    sourceQuote: JSON.stringify({
      objectID: objectId,
      title,
      url: record.url,
      author: record.author,
      points: record.points,
      num_comments: record.num_comments,
    }),
    metrics: numericRecord({ points: number(record.points), comments: number(record.num_comments) }),
    normalizerId: 'hacker_news_story',
  });
}

function normalizeFearGreed(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const value = number(record.value);
  const classification = string(record.value_classification);
  if (value === null) return null;
  const timestamp = string(record.timestamp);
  const parsed = timestamp ? new Date(Number(timestamp) * 1000) : null;
  const eventAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : payload.fetched_at;
  return fact({
    record,
    payload,
    id: timestamp ?? null,
    eventAt,
    availableAt: eventAt,
    title: `Crypto Fear & Greed index ${value} (${classification ?? 'unknown'})`,
    summary: sentence([
      'Crypto market sentiment index',
      classification ? `classification ${classification}` : null,
      `reading ${value} of 100`,
      `measured ${eventAt.slice(0, 10)}`,
    ]),
    eventType: 'MARKET_SENTIMENT_INDEX',
    sourceUrl: payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: numericRecord({ sentiment_index: value }),
    normalizerId: 'fear_greed_index',
  });
}

function normalizeCoinGecko(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const name = string(record.name);
  const id = string(record.id);
  if (!name) return null;
  const eventAt = payload.fetched_at;
  return fact({
    record,
    payload,
    id: id ?? null,
    eventAt,
    availableAt: eventAt,
    title: `${name}${string(record.symbol) ? ` (${string(record.symbol)})` : ''} trending on CoinGecko`,
    summary: sentence([
      'CoinGecko trending search signal',
      string(record.symbol) ? `symbol ${string(record.symbol)}` : null,
      number(record.market_cap_rank) === null ? null : `market cap rank ${number(record.market_cap_rank)}`,
    ]),
    eventType: 'MARKET_TRENDING_ASSET',
    sourceUrl: id ? `https://www.coingecko.com/en/coins/${id}` : payload.source_url,
    sourceQuote: JSON.stringify(record),
    metrics: numericRecord({ market_cap_rank: number(record.market_cap_rank), price_btc: number(record.price_btc) }),
    normalizerId: 'coingecko_trending',
  });
}

function normalizeGeneric(record: RecordValue, payload: WorldMonitorPayload): WorldMonitorNormalizedFact | null {
  const flat = object(record.properties) ? { ...object(record.properties), geometry: record.geometry, feature_id: record.id } : record;
  const title = firstString(flat, ['title', 'Title', 'headline', 'name', 'place', 'areaDesc', 'eventname', 'description', 'id'])
    ?? payload.descriptor.summary;
  if (!title) return null;
  const eventAt = firstIso(flat, payload.fetched_at);
  return fact({
    record,
    payload,
    id: string(flat.id) ?? string(flat.feature_id),
    eventAt,
    availableAt: eventAt,
    title,
    summary: boundedJson(flat),
    eventType: screamingSnake(payload.descriptor.operation_id),
    sourceUrl: firstString(flat, ['sourceUrl', 'url', 'ItemDefaultUrl']) ?? payload.source_url,
    sourceQuote: boundedJson(record),
    normalizerId: 'generic_record',
  });
}

function fact(input: {
  record: RecordValue;
  payload: WorldMonitorPayload;
  id: string | null;
  eventAt: string;
  availableAt: string;
  title: string;
  summary: string;
  eventType: string;
  sourceUrl: string;
  sourceQuote: string;
  location?: WorldMonitorNormalizedFact['location'];
  metrics?: Record<string, number>;
  normalizerId: string;
}): WorldMonitorNormalizedFact {
  return {
    upstream_record_id: input.id,
    event_at: input.eventAt,
    available_at: input.availableAt,
    title: input.title.slice(0, 240),
    summary: input.summary.slice(0, 1600),
    event_type: input.eventType,
    source_url: input.sourceUrl,
    source_quote: input.sourceQuote.slice(0, 1600),
    ...(input.location ? { location: input.location } : {}),
    ...(input.metrics && Object.keys(input.metrics).length ? { metrics: input.metrics } : {}),
    raw_record: input.record,
    normalizer_id: input.normalizerId,
    normalizer_version: '1.0.0',
  };
}

function collectRecordArrays(value: RecordValue, depth: number): RecordValue[][] {
  if (depth > 3) return [];
  const result: RecordValue[][] = [];
  for (const child of Object.values(value)) {
    if (Array.isArray(child) && child.some(isObject)) result.push(objectArray(child));
    else if (isObject(child)) result.push(...collectRecordArrays(child, depth + 1));
  }
  return result;
}

function objectArray(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

/**
 * Zips the parallel arrays inside SEC EDGAR submissions JSON (filings.recent)
 * into one record per filing so the normalizer receives a single filing row.
 */
function secEdgarRecords(body: unknown): RecordValue[] {
  const root = object(body);
  const recent = object(root?.filings)?.recent;
  if (!isObject(recent)) return [];
  const keys = Object.keys(recent).filter((key) => Array.isArray(recent[key]));
  const length = Math.min(...keys.map((key) => (recent[key] as unknown[]).length), 30);
  if (!keys.length || !Number.isFinite(length) || length <= 0) return [];
  return Array.from({ length }, (_, index) => {
    const row: RecordValue = { order: index };
    for (const key of keys) row[key] = (recent[key] as unknown[])[index];
    return row;
  });
}

function object(value: unknown): RecordValue | null {
  return isObject(value) ? value : null;
}

function isObject(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function rank(value: string | null, ordered: string[]): number {
  if (!value) return 0;
  const index = ordered.indexOf(value.toLowerCase());
  return index < 0 ? 0 : index;
}

function iso(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value}Z`
    : value;
  const date = typeof normalized === 'number' ? new Date(normalized) : typeof normalized === 'string' ? new Date(normalized) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
}

function gdeltIso(value: string | null, fallback: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(value ?? '');
  if (!match) return fallback;
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ));
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function firstString(record: RecordValue, keys: string[]): string | null {
  for (const key of keys) {
    const value = string(record[key]);
    if (value) return value;
  }
  return null;
}

function firstIso(record: RecordValue, fallback: string): string {
  for (const key of ['timestamp', 'time', 'updatedAt', 'createdAt', 'date', 'eventDate', 'publishedAt', 'issuedAt', 'record_date']) {
    if (record[key] !== undefined) return iso(record[key], fallback);
  }
  return fallback;
}

function sentence(parts: Array<string | null>): string {
  const value = parts.filter((part): part is string => Boolean(part)).join('; ');
  return value ? `${value.replace(/[.;]\s*$/, '')}.` : '';
}

function numericRecord(values: Record<string, number | null>): Record<string, number> {
  return Object.fromEntries(Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null));
}

function difference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function boundedJson(value: RecordValue): string {
  const json = JSON.stringify(value);
  return json.length <= 1600 ? json : `${json.slice(0, 1597)}...`;
}

function screamingSnake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}
