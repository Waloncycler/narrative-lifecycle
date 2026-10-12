import { describe, expect, it } from 'vitest';
import { mergeEvidenceIntakeSessions } from '@/app/use_cases/merge_evidence_intake_sessions';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';

describe('merge evidence intake sessions', () => {
  it('retains direct and news candidates with valid rebased provenance', () => {
    const merged = mergeEvidenceIntakeSessions([
      sourceSession('direct', candidate('direct_1', 'official', 'rule_verified', '算力设施投资公告')),
      sourceSession('news', candidate('news_1', 'news', 'manual_review', '媒体报道算力需求')),
    ], '2026-08-14T02:00:00.000Z');
    expect(merged?.candidates.map((item) => item.candidate_id)).toEqual(['direct_1', 'news_1']);
    expect(merged?.candidates[0]?.publication_eligibility).toBe('rule_verified');
    for (const candidate of merged?.candidates ?? []) {
      const provenance = merged?.provenance_records.find((item) => item.provenance_id === candidate.provenance_id);
      expect(provenance).toBeTruthy();
      expect(merged?.raw_document.text.slice(provenance!.quote_start_offset, provenance!.quote_end_offset)).toBe(candidate.original_quote);
    }
  });

  it('deduplicates the same Evidence identity across direct and retrieval sessions', () => {
    const direct = candidate('direct_1', 'official', 'rule_verified', '原始公告');
    const retrieved = structuredClone(direct);
    retrieved.candidate_id = 'retrieved_copy';
    retrieved.suggested_evidence.source_url = 'https://direct_1.example.com/retrieved';
    const merged = mergeEvidenceIntakeSessions([sourceSession('direct', direct), sourceSession('retrieval', retrieved)], '2026-08-14T02:00:00.000Z');
    expect(merged?.candidates).toHaveLength(1);
    expect(merged?.candidates[0]?.suggested_evidence.evidence_id).toBe('direct_1');
  });
});

function sourceSession(id: string, candidate: EvidenceCandidate): EvidenceIntakeSession {
  return {
    session_id: id, generated_at: '2026-08-14T01:00:00.000Z',
    raw_document: { raw_document_id: `raw_${id}`, source_name: id, source_kind: 'pasted_text', ingested_at: '2026-08-14T01:00:00.000Z', text: candidate.original_quote, character_count: candidate.original_quote.length },
    chunks: [], provenance_records: [], candidates: [candidate], review_template: [],
  };
}

function candidate(id: string, sourceType: 'official' | 'news', eligibility: 'rule_verified' | 'manual_review', quote: string): EvidenceCandidate {
  return {
    candidate_id: id, raw_document_id: `raw_${id}`, chunk_id: `chunk_${id}`, provenance_id: `prov_${id}`, original_quote: quote,
    suggested_evidence: { evidence_id: id, topic_id: 'computing_infrastructure', branch_id: null, scope: 'parent', event_date: '2026-08-14', available_at: '2026-08-14', event_title: quote, event_summary: quote, event_type: 'TEST', source_name: id, source_url: `https://${id}.example.com/source`, source_type: sourceType, evidence_strength: 'E1', affected_layer: ['reality'], stage_effect: 'maintain', polarity: 'neutral', interpretation: 'test', limitation: 'test', confidence: eligibility === 'rule_verified' ? 'medium' : 'low' },
    suggested_reason: 'test', uncertainty_notes: [], field_explanations: {}, e_strength_rationale: 'E1', publication_eligibility: eligibility,
    guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  };
}
