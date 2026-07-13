import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { EvidenceNode } from '../src/domain/evidence';
import type { StageSnapshotHistory, StageSnapshotTopic } from '../src/types/diff';
import { artifactMetadata } from '../src/types/artifact_contract';
import { classifyStage } from '../src/services/stage_classifier';
import { buildStageDiff } from '../src/services/stage_diff_engine';
import { MemoryService } from '../src/services/memory_service';
import { createReactivationRecord } from '../src/services/reactivation_service';

const repoRoot = resolve(import.meta.dirname, '..');
const guardrail_check = {
  no_trading_advice: true,
  research_only_actions: true,
  parent_branch_separation_preserved: true,
  evidence_ids_visible: true,
  why_not_higher_present: true,
  data_confidence_present: true,
};

function evidence(overrides: Partial<EvidenceNode>): EvidenceNode {
  return {
    evidence_id: 'ev',
    topic_id: 'topic',
    event_date: '2026-07-01',
  available_at: '2026-07-01',
    event_title: 'Evidence',
    event_type: 'research',
    source_name: 'fixture',
    evidence_strength: 'E3',
    affected_layer: ['perception'],
    stage_effect: 'supports_S4',
    parent_or_branch: 'parent',
    ...overrides,
  };
}

function topic(overrides: Partial<StageSnapshotTopic> = {}): StageSnapshotTopic {
  return {
    topic_id: 'bci',
    topic_name: 'BCI',
    parent_narrative: 'BCI',
    current_stage: 'S4',
    gate_stage: 'S4',
    max_allowed_stage: 'S4',
    strongest_branch: 'medical rehab (S6)',
    weakest_layer: 'pricing',
    data_confidence: 'high',
    evidence_ids: ['parent_ev'],
    score_id: 'score_bci',
    dashboard_card_id: 'card_bci',
    why_not_higher_stage: 'Parent evidence remains incomplete.',
    gate_why_not_higher_stage: 'Parent pricing remains incomplete.',
    gate_evidence_ids: ['parent_ev'],
    branches: [{ branch_id: 'medical_rehab', branch_name: 'Medical rehab', current_stage: 'S6', evidence_ids: ['branch_ev'], reactivation_record_id: 'reactivation_bci' }],
    ...overrides,
  };
}

function snapshot(index: number, topicValue: StageSnapshotTopic): StageSnapshotHistory {
  const run_id = `run_2026072${index}T000000000_abcde${index}`;
  const generated_at = `2026-07-2${index}T00:00:00.000Z`;
  return {
    ...artifactMetadata({ artifact_type: 'stage_snapshot_history', rule_version: 'rules', run_id, generated_at }),
    snapshot_id: `stage_snapshot_${run_id}`,
    run_id,
    generated_at,
    source_report_id: `weekly_brief_${run_id}`,
    topics: [topicValue],
    early_radar_candidates: [],
    guardrail_check,
  };
}

describe('v0.4 product core scenarios', () => {
  it('keeps parent S4 when branch reaches S6', () => {
    const parent = classifyStage({
      evidence: [
        evidence({ evidence_id: 'parent_label', affected_layer: ['perception'], stage_effect: 'supports_S4', parent_or_branch: 'parent' }),
        evidence({ evidence_id: 'parent_capital', affected_layer: ['capital'], stage_effect: 'supports_S4', parent_or_branch: 'parent' }),
        evidence({ evidence_id: 'branch_s6', affected_layer: ['perception', 'capital', 'pricing', 'reality'], stage_effect: 'supports_S6', parent_or_branch: 'branch', branch_id: 'medical_rehab' }),
      ],
      scope: 'parent',
      requestedStage: 'S6',
      dataConfidence: 90,
    });

    const branch = classifyStage({
      evidence: [
        evidence({ evidence_id: 'branch_s6', affected_layer: ['perception', 'capital', 'pricing', 'reality'], stage_effect: 'supports_S6', parent_or_branch: 'branch', branch_id: 'medical_rehab' }),
      ],
      scope: 'branch',
      branchId: 'medical_rehab',
      requestedStage: 'S6',
      dataConfidence: 90,
    });

    expect(parent.current_stage).toBe('S4');
    expect(branch.current_stage).toBe('S6');
  });

  it('allows E4 reality evidence to move S5 to S6 when all parent gates exist', () => {
    const result = classifyStage({
      evidence: [
        evidence({ evidence_id: 'label', affected_layer: ['perception'], stage_effect: 'supports_S4' }),
        evidence({ evidence_id: 'capital', affected_layer: ['capital'], stage_effect: 'supports_S4' }),
        evidence({ evidence_id: 'pricing', affected_layer: ['pricing'], stage_effect: 'supports_S5' }),
        evidence({ evidence_id: 'reality_e4', evidence_strength: 'E4', affected_layer: ['reality'], stage_effect: 'supports_S6' }),
      ],
      scope: 'parent',
      requestedStage: 'S6',
      dataConfidence: 90,
    });
    expect(result.current_stage).toBe('S6');
  });

  it('detects key evidence deletion as downgrade and confidence high to low', () => {
    const diff = buildStageDiff(
      snapshot(2, topic({ current_stage: 'S4', evidence_ids: ['parent_ev'], data_confidence: 'low' })),
      snapshot(1, topic({ current_stage: 'S5', evidence_ids: ['parent_ev', 'reality_e4'], data_confidence: 'high' })),
    );
    expect(diff.topic_changes[0].detected_changes).toContain('stage_downgrade');
    expect(diff.topic_changes[0].detected_changes).toContain('evidence_removed');
    expect(diff.topic_changes[0].detected_changes).toContain('data_confidence_changed');
  });

  it('treats S7C branch mutation as branch-level, not parent upgrade', () => {
    const diff = buildStageDiff(
      snapshot(2, topic({ current_stage: 'S4', branches: [...topic().branches, { branch_id: 'crowded_asset', branch_name: 'Crowded asset', current_stage: 'S7C', evidence_ids: ['branch_s7c'], reactivation_record_id: 'reactivation_s7c' }] })),
      snapshot(1, topic({ current_stage: 'S4' })),
    );
    expect(diff.topic_changes[0].current_stage).toBe('S4');
    expect(diff.topic_changes[0].detected_changes).toContain('branch_mutation_candidate');
    expect(diff.topic_changes[0].branch_id).toBe('crowded_asset');
  });

  it('requires old theme reactivation through Narrative Memory', () => {
    const memory = new MemoryService([{ topic_id: 'bci', previous_peak_stage: 'S4', memory_confidence: 85 }]);
    expect(memory.requiresMemoryLookup('bci')).toBe(true);
    const record = createReactivationRecord({
      record_id: 'reactivation_bci',
      topic_id: 'bci',
      memory: memory.lookup('bci'),
      repeatedOldLogic: false,
      missingEvidenceFilled: ['pricing adoption'],
      branchMutationStrength: 20,
      realityCatchUp: true,
      expectationReset: 20,
      newEvidenceQuality: 80,
      stageGateImpact: 70,
      dataConfidence: 75,
    });
    expect(record.should_enter_radar).toBe(true);
  });

  it('rejects old stage diff schemas without explicit compatibility metadata', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/stage_diff.schema.json'), 'utf8')));
    const oldShape = { diff_id: 'stage_diff_run_20260720T000000000_abcde0', run_id: 'run_20260720T000000000_abcde0', generated_at: '2026-07-20T00:00:00.000Z', status: 'ok', previous_snapshot_id: null, current_snapshot_id: 'stage_snapshot_run_20260720T000000000_abcde0', summary: {}, topic_changes: [], early_radar_changes: [], guardrail_changes: [], next_operator_actions: [] };
    expect(validate(oldShape)).toBe(false);
  });
});
