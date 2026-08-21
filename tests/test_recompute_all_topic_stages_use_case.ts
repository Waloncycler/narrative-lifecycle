import { describe, expect, it, vi } from 'vitest';
import { RecomputeAllTopicStagesUseCase } from '@/app/use_cases/recompute_all_topic_stages_use_case';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

const context = {
  run_id: 'run_recompute_test',
  started_at: '2026-08-19T00:00:00.000Z',
  rule_version: 'test',
  artifact_version: 'test',
};

function evidence(overrides: Partial<EvidenceNode>): EvidenceNode {
  return {
    evidence_id: 'ev_parent', topic_id: 'topic_a', branch_id: null,
    event_date: '2026-08-01', available_at: '2026-08-01', event_title: 'Stable market label',
    event_type: 'market_label', source_name: 'Publisher A', source_url: 'https://example.com/a',
    source_type: 'official', evidence_strength: 'E2', affected_layer: ['perception'],
    stage_effect: 'Supports stable label', parent_or_branch: 'parent', interpretation: 'Label adopted',
    limitation: 'One source', positive_or_negative: 'positive', confidence: 80,
    ...overrides,
  };
}

describe('RecomputeAllTopicStagesUseCase', () => {
  it('recomputes every visible topic while keeping branch evidence out of the parent', () => {
    const persist = vi.fn();
    const validate = vi.fn();
    const useCase = new RecomputeAllTopicStagesUseCase({
      readRegistry: () => ({
        canonical_topics: [
          { topic_id: 'topic_a', topic_name: '主题 A', current_stage: 'S6', status: 'active' },
          { topic_id: 'topic_empty', topic_name: '空主题', current_stage: 'S6', status: 'active' },
        ],
        aliases: [],
        branches: [{ branch_id: 'branch_a', topic_id: 'topic_a', branch_name: '分支 A', status: 'active' }],
        provisional_topics: [], memory_topic_ids: [],
      }),
      readOperationalEvidence: () => [
        evidence({}),
        evidence({ evidence_id: 'ev_branch', branch_id: 'branch_a', parent_or_branch: 'branch', affected_layer: ['reality'], evidence_strength: 'E4' }),
      ],
      persist,
      validate,
    });

    const state = useCase.execute(context);
    const topic = state.snapshot.topics.find((item) => item.topic_id === 'topic_a');
    const empty = state.snapshot.topics.find((item) => item.topic_id === 'topic_empty');
    expect(topic?.evidence_ids).toEqual(['ev_parent']);
    expect(topic?.branches[0]?.evidence_ids).toEqual(['ev_branch']);
    expect(empty?.current_stage).toBe('S0');
    expect(validate).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith(state, context);
  });
});
