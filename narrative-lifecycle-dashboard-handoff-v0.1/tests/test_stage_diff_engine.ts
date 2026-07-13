import { describe, expect, it } from 'vitest';
import type { StageSnapshotHistory, StageSnapshotTopic } from '../src/types/diff';
import { buildStageDiff } from '../src/services/stage_diff_engine';
import { artifactMetadata } from '../src/types/artifact_contract';

const guardrails = {
  no_trading_advice: true,
  research_only_actions: true,
  parent_branch_separation_preserved: true,
  evidence_ids_visible: true,
  why_not_higher_present: true,
  data_confidence_present: true,
};

function topic(overrides: Partial<StageSnapshotTopic> = {}): StageSnapshotTopic {
  return {
    topic_id: 'bci', topic_name: 'BCI', parent_narrative: 'BCI', current_stage: 'S4',
    gate_stage: 'S4', max_allowed_stage: 'S4', strongest_branch: 'rehab (S5-S6)',
    weakest_layer: 'pricing_adoption', data_confidence: 'medium', evidence_ids: ['parent_label'],
    gate_evidence_ids: ['parent_label'], score_id: 'score_bci', dashboard_card_id: 'card_bci',
    why_not_higher_stage: 'Parent pricing and reality evidence remain incomplete.',
    gate_why_not_higher_stage: 'Missing pricing adoption.',
    branches: [{ branch_id: 'rehab', branch_name: 'rehab', current_stage: 'S5-S6', evidence_ids: ['branch_reality'], reactivation_record_id: 'reactivation_bci' }],
    ...overrides,
  };
}

function snapshot(topicValue = topic(), overrides: Partial<StageSnapshotHistory> = {}): StageSnapshotHistory {
  return {
    ...artifactMetadata({
      artifact_type: 'stage_snapshot_history',
      rule_version: 'rules',
      run_id: overrides.run_id ?? 'run_20260705T000000000_abcdef',
      generated_at: overrides.generated_at ?? '2026-07-05T00:00:00.000Z',
    }),
    snapshot_id: 'stage_snapshot_run_20260705T000000000_abcdef', run_id: 'run_20260705T000000000_abcdef', generated_at: '2026-07-05T00:00:00.000Z',
    source_report_id: 'weekly_brief_run_20260705T000000000_abcdef', topics: [topicValue],
    early_radar_candidates: [], guardrail_check: { ...guardrails }, ...overrides,
  };
}

describe('stage diff engine', () => {
  it('creates a baseline when previous history does not exist', () => {
    const diff = buildStageDiff(snapshot(), null);
    expect(diff.status).toBe('no_previous_snapshot');
    expect(diff.topic_changes[0].change_type).toBe('initial_snapshot');
    expect(diff.topic_changes[0].change_reason).toContain('saved as baseline');
  });

  it('detects no change for identical snapshots', () => {
    const previous = snapshot();
    const current = snapshot(topic(), { snapshot_id: 'stage_snapshot_run_20260706T000000000_abcdef', run_id: 'run_20260706T000000000_abcdef', generated_at: '2026-07-06T00:00:00.000Z' });
    expect(buildStageDiff(current, previous).topic_changes[0].change_type).toBe('no_change');
  });

  it('detects evidence additions without changing the parent stage', () => {
    const current = snapshot(topic({ evidence_ids: ['new_parent_evidence', 'parent_label'] }));
    const change = buildStageDiff(current, snapshot()).topic_changes[0];
    expect(change.change_type).toBe('evidence_added');
    expect(change.current_stage).toBe('S4');
    expect(change.new_evidence_ids).toEqual(['new_parent_evidence']);
  });

  it.each([
    ['S4', 'S5', 'stage_upgrade', 'medium'],
    ['S5', 'S4', 'stage_downgrade', 'high'],
    ['S7A', 'S7C', 'stage_band_change', 'low'],
  ] as const)('compares %s to %s as %s', (from, to, expected, priority) => {
    const change = buildStageDiff(snapshot(topic({ current_stage: to })), snapshot(topic({ current_stage: from }))).topic_changes[0];
    expect(change.change_type).toBe(expected);
    expect(change.priority).toBe(priority);
  });

  it('retains simultaneous why-not-higher and confidence changes', () => {
    const current = snapshot(topic({ why_not_higher_stage: 'New explicit limit.', data_confidence: 'high' }));
    const change = buildStageDiff(current, snapshot()).topic_changes[0];
    expect(change.detected_changes).toContain('why_not_higher_changed');
    expect(change.detected_changes).toContain('data_confidence_changed');
  });

  it('retains branch mutation identity and reactivation reference', () => {
    const mutation = { branch_id: 'consumer', branch_name: 'consumer', current_stage: 'S3', evidence_ids: ['consumer_ev'], reactivation_record_id: 'reactivation_consumer' };
    const current = snapshot(topic({ branches: [...topic().branches, mutation], strongest_branch: 'consumer (S3)' }));
    const change = buildStageDiff(current, snapshot()).topic_changes[0];
    expect(change.detected_changes).toContain('branch_mutation_candidate');
    expect(change.branch_id).toBe('consumer');
    expect(change.reactivation_record_id).toBe('reactivation_consumer');
  });

  it('flags true-to-false guardrail regressions as high priority', () => {
    const current = snapshot(topic(), { guardrail_check: { ...guardrails, no_trading_advice: false } });
    const diff = buildStageDiff(current, snapshot());
    expect(diff.guardrail_changes).toEqual([expect.objectContaining({ guardrail: 'no_trading_advice', priority: 'high' })]);
  });

  it('detects Early Radar additions with reactivation references', () => {
    const candidate = { candidate_id: 'radar_bci', candidate_topic: 'BCI', reactivation_record_id: 'reactivation_bci', evidence_ids: ['branch_reality'] };
    const current = snapshot(topic(), { early_radar_candidates: [candidate] });
    expect(buildStageDiff(current, snapshot()).early_radar_changes[0]).toEqual(expect.objectContaining(candidate));
  });
});
