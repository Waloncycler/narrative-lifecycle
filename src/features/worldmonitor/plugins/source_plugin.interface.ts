export type SourcePluginCategory = 'official' | 'financial' | 'technology' | 'research' | 'geopolitics';

export interface PluginExecutionContext {
  today?: string;
  timeoutMs?: number;
  maxItems?: number;
  userAgent?: string;
}

export interface PluginNormalizedFact {
  source_id: string;
  source_name: string;
  source_url: string;
  source_kind: 'MINISTRY_POLICY' | 'BROKERAGE_REPORT' | 'CNINFO_DISCLOSURE' | 'VIP_SPEECH' | 'GOVERNMENT_TENDER' | 'CLINICAL_TRIAL' | 'COMMODITY_PRICING' | 'FINANCIAL_WIRE' | 'ACADEMIC_PAPER';
  title: string;
  summary: string;
  event_date: string;
  evidence_strength: 'E1' | 'E2' | 'E3' | 'E4';
  event_type: 'OFFICIAL_POLICY' | 'OFFICIAL_CONTRACT' | 'CLINICAL_TRIAL_UPDATE' | 'RESEARCH_REPORT' | 'MARKET_FACT';
  affected_layers: ('reality' | 'capital' | 'pricing' | 'friction' | 'name')[];
  topic_inference_hint?: string;
  remote_pdf_url?: string | null;
  raw_payload?: Record<string, unknown>;
}

export interface SourcePlugin<TRawItem = unknown> {
  readonly id: string;
  readonly name: string;
  readonly category: SourcePluginCategory;
  readonly domain: string;
  readonly defaultEvidenceStrength: 'E1' | 'E2' | 'E3' | 'E4';
  readonly defaultTargetLayers: readonly ('reality' | 'capital' | 'pricing' | 'friction' | 'name')[];
  readonly rateLimitConfig?: {
    maxConcurrent?: number;
    minIntervalMs?: number;
  };

  /**
   * Fetches raw items from the external data source with timeout and error resilience.
   */
  fetchRaw(ctx: PluginExecutionContext): Promise<TRawItem[]>;

  /**
   * Normalizes a raw item into a standard institutional fact candidate.
   */
  normalize(item: TRawItem, ctx: PluginExecutionContext): PluginNormalizedFact | null;
}
