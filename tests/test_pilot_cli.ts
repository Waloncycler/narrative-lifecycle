import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { PilotObservation, PilotResearchLedger, PilotTopic } from '../src/types/pilot';

const repoRoot = resolve(import.meta.dirname, '..');
const runId = 'run_20260720T000000000_abc123';
const generatedAt = '2026-07-20T00:00:00.000Z';

function writeJson(root: string, path: string, value: unknown): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function writeYaml(root: string, path: string, value: unknown): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, stringify(value));
}

function seedArtifacts(root: string): void {
  cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });
  writeJson(root, 'outputs/runs/latest_run.json', {
    artifact_type: 'run_manifest',
    schema_version: '1.0.0',
    producer_version: '0.4.0',
    rule_version: 'rules',
    run_id: runId,
    generated_at: generatedAt,
    started_at: generatedAt,
    completed_at: generatedAt,
    status: 'ok',
    commands: ['pipeline', 'diff', 'report'],
    artifacts: [],
    previous_run_id: null,
    current_snapshot_id: `stage_snapshot_${runId}`,
    previous_snapshot_id: null,
    artifact_version: '0.4.0',
    guardrail_status: 'ok',
  });
  writeJson(root, 'outputs/reports/weekly_brief.json', {
    artifact_type: 'weekly_brief',
    schema_version: '1.0.0',
    producer_version: '0.4.0',
    rule_version: 'rules',
    run_id: runId,
    generated_at: generatedAt,
    report_id: `weekly_brief_${runId}`,
    source_artifacts: [],
    executive_summary: { dashboard_card_count: 3, score_count: 3, golden_case_passed: 3, golden_case_total: 3, early_radar_candidate_count: 1, system_status: 'ok' },
    stage_snapshot: [
      { topic_id: 'bci', topic_name: 'BCI', current_stage: 'S4', parent_narrative: 'BCI', strongest_branch: 'medical rehab (S6)', weakest_layer: 'pricing', data_confidence: 74 },
      { topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', current_stage: 'S5-S6', parent_narrative: 'Humanoid robotics', strongest_branch: 'actuator (S5-S6)', weakest_layer: 'friction', data_confidence: 70 },
      { topic_id: 'innovative_drug_license_out', topic_name: 'License-out', current_stage: 'S5-S6', parent_narrative: 'License-out', strongest_branch: 'ADC (S5-S6)', weakest_layer: 'regulatory', data_confidence: 70 },
    ],
    stage_change_summary: { previous_snapshot_id: null, current_snapshot_id: `stage_snapshot_${runId}`, upgrade_count: 0, downgrade_count: 1, evidence_added_count: 1, branch_mutation_candidate_count: 1, guardrail_regression_count: 0 },
    stage_changes: [],
    strongest_evidence: [],
    why_not_higher: [
      { topic_id: 'bci', topic_name: 'BCI', current_stage: 'S4', why_not_higher_stage: 'Parent evidence remains incomplete.', evidence_ids: ['bci_parent_label'] },
      { topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', current_stage: 'S5-S6', why_not_higher_stage: 'Durability still needs validation.', evidence_ids: ['robot_reality'] },
      { topic_id: 'innovative_drug_license_out', topic_name: 'License-out', current_stage: 'S5-S6', why_not_higher_stage: 'Milestone realization remains uncertain.', evidence_ids: ['license_pricing'] },
    ],
    early_radar_candidates: [],
    guardrail_check: { no_trading_advice: true, research_only_actions: true, parent_branch_separation_preserved: true, evidence_ids_visible: true, why_not_higher_present: true, data_confidence_present: true },
    next_operator_actions: [],
    artifact_index: [],
  });
  writeJson(root, 'outputs/diffs/latest_stage_diff.json', {
    artifact_type: 'stage_diff',
    schema_version: '1.0.0',
    producer_version: '0.4.0',
    rule_version: 'rules',
    run_id: runId,
    generated_at: generatedAt,
    diff_id: `stage_diff_${runId}`,
    status: 'ok',
    previous_snapshot_id: null,
    current_snapshot_id: `stage_snapshot_${runId}`,
    summary: { topic_count: 4, stage_upgrade_count: 0, stage_downgrade_count: 1, evidence_added_count: 1, branch_mutation_candidate_count: 1, guardrail_regression_count: 0 },
    topic_changes: [
      { topic_id: 'bci', topic_name: 'BCI', change_type: 'branch_mutation_candidate', detected_changes: ['branch_change', 'branch_mutation_candidate'], previous_stage: 'S4', current_stage: 'S4', previous_evidence_ids: ['bci_parent_label'], current_evidence_ids: ['bci_parent_label', 'branch_s6'], new_evidence_ids: ['branch_s6'], removed_evidence_ids: [], previous_why_not_higher_stage: 'Parent evidence remains incomplete.', current_why_not_higher_stage: 'Parent evidence remains incomplete.', previous_data_confidence: 'medium', current_data_confidence: 'medium', change_reason: 'Branch changed without parent upgrade.', priority: 'medium', research_only_action: 'review', branch_id: 'medical_rehab', reactivation_record_id: 'reactivation_bci' },
      { topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', change_type: 'stage_downgrade', detected_changes: ['stage_downgrade', 'evidence_removed'], previous_stage: 'S6', current_stage: 'S5-S6', previous_evidence_ids: ['robot_reality', 'robot_removed'], current_evidence_ids: ['robot_reality'], new_evidence_ids: [], removed_evidence_ids: ['robot_removed'], previous_why_not_higher_stage: 'Prior.', current_why_not_higher_stage: 'Durability still needs validation.', previous_data_confidence: 'high', current_data_confidence: 'medium', change_reason: 'Evidence removed.', priority: 'high', research_only_action: 'flag_risk', branch_id: null, reactivation_record_id: null },
      { topic_id: 'innovative_drug_license_out', topic_name: 'License-out', change_type: 'evidence_added', detected_changes: ['evidence_added'], previous_stage: 'S5-S6', current_stage: 'S5-S6', previous_evidence_ids: ['license_pricing'], current_evidence_ids: ['license_pricing', 'license_new'], new_evidence_ids: ['license_new'], removed_evidence_ids: [], previous_why_not_higher_stage: 'Milestone realization remains uncertain.', current_why_not_higher_stage: 'Milestone realization remains uncertain.', previous_data_confidence: 'medium', current_data_confidence: 'medium', change_reason: 'Evidence added.', priority: 'low', research_only_action: 'review', branch_id: null, reactivation_record_id: null },
      { topic_id: 'solid_state_battery', topic_name: 'Solid-state battery', change_type: 'no_change', detected_changes: ['no_change'], previous_stage: 'S4', current_stage: 'S4', previous_evidence_ids: [], current_evidence_ids: [], new_evidence_ids: [], removed_evidence_ids: [], previous_why_not_higher_stage: 'Seed.', current_why_not_higher_stage: 'Seed.', previous_data_confidence: 'medium', current_data_confidence: 'medium', change_reason: 'No change.', priority: 'low', research_only_action: 'observe', branch_id: null, reactivation_record_id: null },
    ],
    early_radar_changes: [],
    guardrail_changes: [],
    next_operator_actions: [],
  });
  writeJson(root, 'outputs/reviews/latest_operator_review.json', {
    artifact_type: 'operator_review',
    schema_version: '1.0.0',
    producer_version: '0.4.0',
    rule_version: 'rules',
    run_id: runId,
    generated_at: generatedAt,
    review_id: `operator_review_${runId}`,
    status: 'ok',
    source_artifacts: [],
    review_window: { first_run_id: runId, last_run_id: runId, first_started_at: generatedAt, last_completed_at: generatedAt },
    run_summary: { run_count: 3, successful_run_count: 3, failed_run_count: 0 },
    runs: [],
    stage_trends: { upgrades: [], downgrades: [] },
    evidence_trends: { added: [], removed: [] },
    why_not_higher_changes: [],
    data_confidence_changes: [],
    branch_mutation_changes: [],
    early_radar_changes: [],
    guardrail_regressions: [],
    failure_case_hits: [],
    repeated_issues: [],
    consecutive_no_change_topics: [{ topic_id: 'solid_state_battery', topic_name: 'Solid-state battery', consecutive_run_count: 4, run_ids: [runId], current_stage: 'S4' }],
    high_priority_operator_alerts: [],
    research_only_next_actions: [],
  });
}

function pilotTopics(): PilotTopic[] {
  return [
    { topic_id: 'bci', current_hypothesis: 'BCI parent remains S4.', competing_hypothesis: 'Medical rehab is branch-only.', current_stage: 'S4', prior_band: 'medium', posterior_direction: 'up', event_intensity: 'burst', tail_structure: 'right_tail_candidate', strongest_evidence_ids: ['bci_parent_label'], why_not_higher_stage: 'Parent evidence remains incomplete.', falsification_trigger: 'Branch evidence fails to broaden to parent.', next_validation_window: '4-6 weeks', operator_agreement: 'disagree', operator_comment: 'Branch changed but parent should not upgrade.', outcome_status: 'confirmed' },
    { topic_id: 'humanoid_robotics', current_hypothesis: 'Humanoid validation weakened.', competing_hypothesis: 'Evidence removal is temporary noise.', current_stage: 'S5-S6', prior_band: 'medium', posterior_direction: 'down', event_intensity: 'high', tail_structure: 'left_tail_risk', strongest_evidence_ids: ['robot_reality'], why_not_higher_stage: 'Durability still needs validation.', falsification_trigger: 'Reality validation fails again.', next_validation_window: '4-6 weeks', operator_agreement: 'agree', operator_comment: 'Evidence removal supports caution.', outcome_status: 'weakened' },
    { topic_id: 'innovative_drug_license_out', current_hypothesis: 'License-out remains validated.', competing_hypothesis: 'Deal evidence may not convert to reality evidence.', current_stage: 'S5-S6', prior_band: 'medium', posterior_direction: 'up', event_intensity: 'medium', tail_structure: 'right_tail_candidate', strongest_evidence_ids: ['license_pricing'], why_not_higher_stage: 'Milestone realization remains uncertain.', falsification_trigger: 'Milestones fail to materialize.', next_validation_window: '4-6 weeks', operator_agreement: 'agree', operator_comment: 'Outcome follow-through looks confirmed.', outcome_status: 'confirmed' },
    { topic_id: 'solid_state_battery', current_hypothesis: 'Solid-state battery remains unchanged.', competing_hypothesis: 'Evidence may be too early to matter.', current_stage: 'S4', prior_band: 'medium', posterior_direction: 'unchanged', event_intensity: 'low', tail_structure: 'normal', strongest_evidence_ids: [], why_not_higher_stage: 'No new validated reality evidence.', falsification_trigger: 'No validation evidence during window.', next_validation_window: '4-6 weeks', operator_agreement: 'uncertain', operator_comment: 'No change is acceptable.', outcome_status: 'pending' },
    { topic_id: 'fusion_energy_supply_chain', current_hypothesis: 'Fusion supply chain remains early.', competing_hypothesis: 'The topic may be a funding headline cluster.', current_stage: 'S2', prior_band: 'low', posterior_direction: 'up', event_intensity: 'medium', tail_structure: 'right_tail_candidate', strongest_evidence_ids: [], why_not_higher_stage: 'Missing capital and reality layers.', falsification_trigger: 'No credible validation appears.', next_validation_window: '4-6 weeks', operator_agreement: 'agree', operator_comment: 'Initial setup later falsified.', outcome_status: 'falsified' },
  ];
}

describe('pilot CLI', () => {
  it('initializes a 10-topic pilot template from latest weekly artifacts', () => {
    const root = join(tmpdir(), `pilot-init-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    seedArtifacts(root);
    execFileSync('npm', ['run', 'pilot:init'], { cwd: repoRoot, env: { ...process.env, NARRATIVE_REPO_ROOT: root }, stdio: 'pipe' });
    const topics = readFileSync(resolve(root, 'data/pilot/pilot_topics.yaml'), 'utf8');
    expect(topics.match(/topic_id:/g)?.length).toBe(10);
    expect(topics).toContain('competing_hypothesis:');
    expect(topics).toContain('falsification_trigger:');
  });

  it('builds a schema-valid research ledger without parent upgrade from branch mutation', () => {
    const root = join(tmpdir(), `pilot-review-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    seedArtifacts(root);
    writeYaml(root, 'data/pilot/pilot_topics.yaml', pilotTopics());
    const observations: PilotObservation[] = [
      { topic_id: 'bci', run_id: runId, operator_agreement: 'disagree', event_intensity: 'burst', tail_structure: 'right_tail_candidate', outcome_status: 'confirmed', missed_change: true },
    ];
    writeYaml(root, 'data/pilot/operator_observations.yaml', observations);

    execFileSync('npm', ['run', 'pilot:review'], { cwd: repoRoot, env: { ...process.env, NARRATIVE_REPO_ROOT: root }, stdio: 'pipe' });
    const ledger = JSON.parse(readFileSync(resolve(root, 'outputs/pilot/latest_research_ledger.json'), 'utf8')) as PilotResearchLedger;
    const summary = JSON.parse(readFileSync(resolve(root, 'outputs/pilot/pilot_evaluation_summary.json'), 'utf8')) as Record<string, unknown>;
    const markdown = readFileSync(resolve(root, 'outputs/pilot/latest_research_ledger.md'), 'utf8');

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(root, 'schemas/pilot_research_ledger.schema.json'), 'utf8')));
    expect(validate(ledger), JSON.stringify(validate.errors)).toBe(true);

    const byTopic = new Map(ledger.ledger_entries.map((entry) => [entry.topic_id, entry]));
    expect(byTopic.get('bci')).toMatchObject({
      latest_artifact_stage: 'S4',
      posterior_direction: 'up',
      event_intensity: 'burst',
      tail_structure: 'right_tail_candidate',
      operator_agreement: 'disagree',
      outcome_status: 'confirmed',
      branch_mutation_detected: true,
      missed_change_detected: true,
      research_only_action: 'review',
    });
    expect(byTopic.get('humanoid_robotics')).toMatchObject({ posterior_direction: 'down', tail_structure: 'left_tail_risk', outcome_status: 'weakened' });
    expect(byTopic.get('solid_state_battery')).toMatchObject({ posterior_direction: 'unchanged', research_only_action: 'wait' });
    expect(byTopic.get('fusion_energy_supply_chain')).toMatchObject({ outcome_status: 'falsified' });
    expect(summary.falsification_count).toBe(1);
    expect(summary.missed_change_count).toBe(1);
    expect(markdown).toContain('Live Research Pilot Ledger');
    expect(JSON.stringify(ledger)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
  });
});
