import { describe, expect, it } from 'vitest';
import { executeDeepMiningProbe } from '@/features/research/domain/deep_mining_probes';
import type { ResearchLeadTriageItem } from '@/features/research/types/research_lead_triage';
import { research_source_retrieval_reportSchema } from '@/app/ports/zod_schemas';

const sampleLead: ResearchLeadTriageItem = {
  triage_id: 'triage_sec_1',
  origin: 'direct',
  origin_lead_id: 'lead_sec_1',
  duplicate_origin_lead_ids: [],
  topic_id: 'bci',
  branch_id: null,
  candidate_node_id: null,
  title: 'SEC Filing Disclosure',
  url: 'https://www.sec.gov/Archives/edgar/data/12345/doc.htm',
  source_name: 'SEC EDGAR',
  source_domain: 'www.sec.gov',
  snippet: 'SEC EDGAR filing disclosure content.',
  published_at: '2026-08-07',
  retrieved_at: '2026-08-07T00:00:00.000Z',
  source_class: 'official',
  relevance: 'explicit',
  freshness: 'fresh',
  priority_score: 90,
  priority: 'high',
  disposition: 'priority_review',
  reasons: ['权威来源'],
  next_action: 'review_original',
  evidence_eligibility: 'context_only',
};

describe('deep mining probes & agent skills alignment', () => {
  it('executes a deep mining probe and returns structured excerpts matching system schema', () => {
    const rawBody = `<html><head><title>Form 10-K SEC Filing</title></head><body><p>Form 10-K filing official disclosure document containing recorded clinical neurotechnology development and regulatory filing details.</p><p>A second factual paragraph provides primary reality evidence for independent researcher verification.</p></body></html>`;
    const result = executeDeepMiningProbe({
      lead: sampleLead,
      rawBody,
      contentType: 'text/html',
      fetchedAt: '2026-08-07T00:00:00.000Z',
    });

    expect(result.probe_metadata).toMatchObject({
      source_class: 'official',
      deep_mining_passed: true,
      evidence_strength_ceiling: 'E4',
    });
    expect(result.retrievalItem).toMatchObject({
      triage_id: 'triage_sec_1',
      evidence_eligibility: 'context_only',
      status: 'retrieved',
      citation_status: 'ready',
      extractor_id: 'sec_edgar_filing',
    });
    expect(result.retrievalItem.excerpts.length).toBeLessThanOrEqual(3);
    expect(result.retrievalItem.excerpts.every((excerpt) => excerpt.quote.length <= 700)).toBe(true);
    expect(result.retrievalItem.excerpts.length).toBeGreaterThan(0);
    expect(result.retrievalItem.excerpts[0].quote_start_offset).toBeGreaterThanOrEqual(0);
    const report = {
      artifact_type: 'research_source_retrieval_report', schema_version: '1.0.0', producer_version: 'test', retrieval_run_id: 'probe_test', generated_at: '2026-08-07T00:00:00.000Z', triage_id: null,
      requested_count: 1, retrieved_count: 1, skipped_count: 0, failed_count: 0, items: [result.retrievalItem],
      guardrail_check: { only_governed_source_classes_requested: true, bounded_excerpts_only: true, original_url_preserved: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true },
    };
    expect(research_source_retrieval_reportSchema.safeParse(report).success).toBe(true);
  });

  it('forces unknown-domain probes to E0 context-only hold', () => {
    const result = executeDeepMiningProbe({
      lead: { ...sampleLead, triage_id: 'triage_unknown', source_class: 'unknown', url: 'https://unclassified.example/report' },
      rawBody: '<html><body><article><p>This unknown-domain report contains a detailed factual claim, a publication date, named organizations, concrete figures, and limitations useful only for discovering an authoritative original source.</p></article></body></html>',
      contentType: 'text/html', fetchedAt: '2026-08-07T00:00:00.000Z',
    });
    expect(result.probe_metadata).toMatchObject({ evidence_strength_ceiling: 'E0', primary_layer_hint: [] });
    expect(result.retrievalItem).toMatchObject({
      source_class: 'unknown', status: 'retrieved', citation_status: 'ready',
      evidence_eligibility: 'context_only', next_action: 'hold',
    });
    expect(result.retrievalItem).not.toHaveProperty('news_corroboration');
    expect(result.retrievalItem.citation_notes?.join(' ')).toContain('cannot corroborate or enter Evidence');
  });
});
