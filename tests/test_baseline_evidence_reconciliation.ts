import { describe, expect, it } from 'vitest';
import { buildBaselineEvidenceReconciliation } from '@/features/research/domain/baseline_evidence_reconciliation';

const registry = {
  canonical_topics: [{ topic_id: 'mature_topic', topic_name: '成熟主题', market_name_zh: '成熟主题', status: 'active' }],
} as never;

function evidence(overrides: Record<string, unknown> = {}) {
  return {
    evidence_id: 'evidence_1', topic_id: 'mature_topic', parent_or_branch: 'parent', branch_id: null,
    event_title: '可复核事件', event_date: '2026-01-01', available_at: '2026-01-01T00:00:00.000Z',
    source_url: 'https://official.example.test/a', source_type: 'official', source_name: '官方来源',
    evidence_strength: 'E3', confidence: 80, affected_layer: ['reality'], stage_effect: 'fills_gap',
    ...overrides,
  };
}

describe('baseline evidence reconciliation', () => {
  it('offers only independently sourced parent evidence for named review', () => {
    const report = buildBaselineEvidenceReconciliation({
      registry,
      evidence: [
        evidence(), evidence({ evidence_id: 'evidence_2', source_url: 'https://filing.example.test/b', source_type: 'filing' }),
        evidence({ evidence_id: 'branch_evidence', parent_or_branch: 'branch', branch_id: 'narrow_branch', source_url: 'https://branch.example.test/c' }),
      ] as never,
      admittedEvidenceIds: new Set(), generatedAt: '2026-08-09T00:00:00.000Z', producerVersion: 'test',
    });
    expect(report.items[0]).toMatchObject({ status: 'ready_for_review', independent_source_count: 2 });
    expect(report.items[0]?.eligible_parent_evidence.map((item) => item.evidence_id)).toEqual(['evidence_1', 'evidence_2']);
    expect(report.guardrail_check).toMatchObject({ parent_branch_separation: true, no_automatic_admission: true });
  });

  it('does not admit weak, malformed, or single-source historical material', () => {
    const report = buildBaselineEvidenceReconciliation({
      registry,
      evidence: [
        evidence({ evidence_id: 'weak', evidence_strength: 'E1' }),
        evidence({ evidence_id: 'bad_url', source_url: 'not-a-url' }),
        evidence({ evidence_id: 'same_host', source_url: 'https://official.example.test/b' }),
      ] as never,
      admittedEvidenceIds: new Set(), generatedAt: '2026-08-09T00:00:00.000Z', producerVersion: 'test',
    });
    expect(report.items[0]).toMatchObject({ status: 'insufficient_evidence', independent_source_count: 1 });
    expect(report.items[0]?.excluded_evidence_ids).toEqual(expect.arrayContaining(['weak', 'bad_url']));
  });
});
