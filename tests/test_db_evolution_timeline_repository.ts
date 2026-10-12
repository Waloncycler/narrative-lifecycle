import { describe, expect, it } from 'vitest';
import { buildEvolutionTimelineProjection } from '@/platform/io/db_evolution_timeline_repository';

describe('database evolution timeline projection', () => {
  it('builds every visible topic and maps evidence from a merged legacy topic id', () => {
    const timelines = buildEvolutionTimelineProjection([
      topic('canonical_topic', '中文主题', 'active', '["legacy_topic"]'),
      topic('legacy_topic', '旧主题', 'archived', null),
      topic('empty_topic', '空主题', 'provisional', null),
    ], [evidence('legacy_evidence', 'legacy_topic')]);

    expect(timelines.map((item) => item.topic_id)).toEqual(['canonical_topic', 'empty_topic']);
    expect(timelines[0]).toMatchObject({ total_evidence_count: 1, eligible_parent_evidence_count: 1 });
    expect(timelines[0].evidence_timeline[0].evidence_id).toBe('legacy_evidence');
    expect(timelines[1]).toMatchObject({ history_status: 'no_parent_evidence', transitions: [] });
    expect(timelines[1].snapshot_observations).toEqual([{
      observed_at: '2026-01-01T00:00:00.000Z', stage: 'S0', evidence_ids: [], observation_kind: 'topic_registered',
    }]);
  });

  it('folds repeated snapshots and resolves snapshots written under a legacy id', () => {
    const timelines = buildEvolutionTimelineProjection(
      [topic('canonical_topic', '中文主题', 'active', '["legacy_topic"]')],
      [evidence('e1', 'canonical_topic', 'E1', '["friction"]'), evidence('e2', 'canonical_topic', 'E2', '["perception"]')],
      [snapshot('one', '2026-01-02T00:00:00.000Z', 'legacy_topic', 'S2', ['e1']), snapshot('two', '2026-01-03T00:00:00.000Z', 'canonical_topic', 'S2', ['e1']), snapshot('three', '2026-01-04T00:00:00.000Z', 'canonical_topic', 'S3', ['e1', 'e2'])],
    );
    expect(timelines[0].snapshot_observations?.map((item) => item.stage)).toEqual(['S2', 'S3']);
  });

  it('hides empty and non-reproducible legacy snapshots from the operator timeline', () => {
    const timelines = buildEvolutionTimelineProjection(
      [topic('canonical_topic', '中文主题', 'active', null)],
      [evidence('e1', 'canonical_topic', 'E1', '["friction"]')],
      [snapshot('empty', '2026-01-02T00:00:00.000Z', 'canonical_topic', 'S0', []), snapshot('inflated', '2026-01-03T00:00:00.000Z', 'canonical_topic', 'S6', ['e1'])],
    );
    expect(timelines[0].snapshot_observations).toEqual([{
      observed_at: '2026-01-01T00:00:00.000Z', stage: 'S0', evidence_ids: [], observation_kind: 'topic_registered',
    }]);
  });
});

function topic(topic_id: string, topic_name: string, status: string, aliases_json: string | null) {
  return {
    topic_id, topic_name, market_name_en: null, status, current_stage: 'S0', domain: 'test',
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', aliases_json,
  };
}

function snapshot(snapshot_id: string, generated_at: string, topic_id: string, current_stage: string, evidence_ids: string[]) {
  return { snapshot_id, run_id: snapshot_id, generated_at, snapshot_json: JSON.stringify({ topics: [{ topic_id, current_stage, evidence_ids }] }) };
}

function evidence(evidence_id: string, topic_id: string, evidence_strength = 'E2', affected_layer_json = '["perception"]') {
  return {
    evidence_id, topic_id, branch_id: null, event_date: '2026-01-01', available_at: '2026-01-01',
    event_title: '已核验事件', event_summary: '完整事实摘要', event_type: 'disclosure', source_name: '权威来源',
    source_url: `https://example.test/source/${evidence_id}`, source_type: 'official', evidence_strength,
    stage_effect: 'supports_parent', parent_or_branch: 'parent', interpretation: '支持已陈述的事实。',
    limitation: '不证明其他门槛。', positive_or_negative: 'neutral', confidence: 80,
    affected_layer_json,
  };
}
