import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { reconstructTopicEvolution } from '@/features/stages/domain/stage_evolution_reconstructor';

function evidence(overrides: Partial<EvidenceNode>): EvidenceNode {
  return {
    evidence_id: 'evidence',
    topic_id: 'credible_topic',
    branch_id: null,
    event_date: '2026-01-01',
    available_at: '2026-01-01',
    event_title: 'A cited topic event',
    event_summary: 'A complete source-backed event summary.',
    event_type: 'disclosure',
    source_name: `Official source ${overrides.evidence_id ?? 'evidence'}`,
    source_url: 'https://example.test/evidence',
    source_type: 'official',
    evidence_strength: 'E2',
    affected_layer: ['perception'],
    stage_effect: 'supports_parent',
    parent_or_branch: 'parent',
    branch_coverage_score: 0,
    interpretation: 'Supports only the cited parent-narrative fact.',
    limitation: 'Does not establish unrelated gates.',
    positive_or_negative: 'neutral',
    confidence: 82,
    ...overrides,
  };
}

describe('stage evolution reconstruction credibility', () => {
  it('replays verified parent evidence by date rather than input order', () => {
    const timeline = reconstructTopicEvolution('credible_topic', '可信主题', [
      evidence({ evidence_id: 'reality', event_date: '2026-05-01', available_at: '2026-05-01', affected_layer: ['reality'], source_url: 'https://example.test/reality' }),
      evidence({ evidence_id: 'pricing', event_date: '2026-04-01', available_at: '2026-04-01', affected_layer: ['pricing'], source_url: 'https://example.test/pricing' }),
      evidence({ evidence_id: 'capital', event_date: '2026-03-01', available_at: '2026-03-01', affected_layer: ['capital'], source_url: 'https://example.test/capital' }),
      evidence({ evidence_id: 'label', event_date: '2026-02-01', available_at: '2026-02-01', affected_layer: ['perception'], source_url: 'https://example.test/label' }),
      evidence({ evidence_id: 'signal', event_date: '2026-01-01', available_at: '2026-01-01', affected_layer: ['friction'], evidence_strength: 'E1', source_url: 'https://example.test/signal' }),
    ]);

    expect(timeline.current_stage).toBe('S6');
    expect(timeline.history_status).toBe('verified');
    expect(timeline.transitions.map((transition) => transition.transition_date)).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
    ]);
    expect(timeline.transitions.map((transition) => `${transition.from_stage}->${transition.to_stage}`)).toEqual([
      'S0->S2', 'S2->S3', 'S3->S4', 'S4->S5', 'S5->S6',
    ]);
    expect(timeline.transitions.every((transition) => transition.transition_kind === 'verified_gate_transition')).toBe(true);
  });

  it('records a historical evidence gap instead of inventing intermediate stages', () => {
    const timeline = reconstructTopicEvolution('credible_topic', '可信主题', [
      evidence({ evidence_id: 'signal', event_date: '2026-01-01', affected_layer: ['friction'], evidence_strength: 'E1', source_url: 'https://example.test/signal' }),
      evidence({ evidence_id: 'second-source', event_date: '2026-01-15', affected_layer: ['friction'], evidence_strength: 'E1', source_url: 'https://example.test/second-source' }),
      evidence({ evidence_id: 'compressed', event_date: '2026-02-01', affected_layer: ['perception', 'capital', 'pricing', 'reality'], source_url: 'https://example.test/compressed' }),
    ]);

    const jump = timeline.transitions.at(-1);
    expect(jump).toMatchObject({ from_stage: 'S2', to_stage: 'S6', transition_kind: 'historical_evidence_gap' });
    expect(jump?.missing_intermediate_stages).toEqual(['S3', 'S4', 'S5']);
    expect(timeline.history_status).toBe('partial');
    expect(timeline.evolution_path).toBe('S0 → S2 → S6');
  });

  it('excludes unverified historical backfill and branch-only evidence from parent history', () => {
    const timeline = reconstructTopicEvolution('credible_topic', '可信主题', [
      evidence({ evidence_id: 'legacy_backfill', event_type: 'historical_backfill', affected_layer: ['perception', 'capital', 'pricing', 'reality'] }),
      evidence({ evidence_id: 'branch_s6', branch_id: 'rehab', parent_or_branch: 'branch', affected_layer: ['perception', 'capital', 'pricing', 'reality'] }),
    ]);

    expect(timeline.current_stage).toBe('S0');
    expect(timeline.history_status).toBe('insufficient');
    expect(timeline.excluded_evidence).toEqual([expect.objectContaining({ evidence_id: 'legacy_backfill', reason: 'unverified_historical_backfill', event_title: 'A cited topic event' })]);
  });

  it('does not accept rows missing citation, summary, interpretation, or limitation', () => {
    const timeline = reconstructTopicEvolution('credible_topic', '可信主题', [
      evidence({ evidence_id: 'incomplete', source_url: undefined, event_summary: '', interpretation: '', limitation: '' }),
    ]);

    expect(timeline.history_status).toBe('insufficient');
    expect(timeline.eligible_parent_evidence_count).toBe(0);
    expect(timeline.excluded_evidence).toEqual([expect.objectContaining({ evidence_id: 'incomplete', reason: 'missing_provenance', missing_fields: ['source_url', 'event_summary', 'interpretation', 'limitation'] })]);
  });
});
