import { describe, expect, it } from 'vitest';
import { executeDeepMiningProbe } from '@/features/research/domain/deep_mining_probes';
import type { ResearchLeadTriageItem } from '@/features/research/types/research_lead_triage';

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
    });
    expect(result.retrievalItem.excerpts.length).toBeGreaterThan(0);
    expect(result.retrievalItem.excerpts[0].quote_start_offset).toBeGreaterThanOrEqual(0);
  });
});
