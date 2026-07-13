import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { buildOperatorReview } from '../src/services/operator_review_aggregator';
import { loadOperatorReviewArtifacts } from '../src/services/operator_review_loader';
import { renderOperatorReviewMarkdown } from '../src/services/operator_review_markdown_renderer';
import type { StageDiff, TopicChange } from '../src/types/diff';
import type { WeeklyBrief } from '../src/types/report';
import type { RunManifest } from '../src/types/run_context';
import { artifactMetadata } from '../src/types/artifact_contract';

const repoRoot = resolve(import.meta.dirname, '..');

const guardrails = {
  no_trading_advice: true,
  research_only_actions: true,
  parent_branch_separation_preserved: true,
  evidence_ids_visible: true,
  why_not_higher_present: true,
  data_confidence_present: true,
};

function runId(index: number): string {
  return `run_2026071${index}T000000000_abcde${index}`;
}

function manifest(index: number, overrides: Partial<RunManifest> = {}): RunManifest {
  const id = runId(index);
  return {
    ...artifactMetadata({
      artifact_type: 'run_manifest',
      rule_version: 'narrative-lifecycle-rules-v0.1',
      run_id: id,
      generated_at: `2026-07-1${index}T00:00:00.000Z`,
    }),
    run_id: id,
    started_at: `2026-07-1${index}T00:00:00.000Z`,
    rule_version: 'narrative-lifecycle-rules-v0.1',
    artifact_version: '0.4.0',
    completed_at: `2026-07-1${index}T00:01:00.000Z`,
    status: 'ok',
    commands: ['pipeline', 'diff', 'report'],
    artifacts: [
      `outputs/runs/${id}/stage_diff.json`,
      `outputs/runs/${id}/weekly_brief.json`,
    ],
    previous_run_id: index > 1 ? runId(index - 1) : null,
    current_snapshot_id: `stage_snapshot_${id}`,
    previous_snapshot_id: index > 1 ? `stage_snapshot_${runId(index - 1)}` : null,
    guardrail_status: 'ok',
    ...overrides,
  };
}

function topicChange(overrides: Partial<TopicChange> = {}): TopicChange {
  return {
    topic_id: 'bci',
    topic_name: 'BCI',
    change_type: 'no_change',
    detected_changes: ['no_change'],
    previous_stage: 'S4',
    current_stage: 'S4',
    previous_evidence_ids: ['ev_parent'],
    current_evidence_ids: ['ev_parent'],
    new_evidence_ids: [],
    removed_evidence_ids: [],
    previous_why_not_higher_stage: 'Parent evidence remains incomplete.',
    current_why_not_higher_stage: 'Parent evidence remains incomplete.',
    previous_data_confidence: 'medium',
    current_data_confidence: 'medium',
    change_reason: 'Fixture diff from persisted artifacts.',
    priority: 'low',
    research_only_action: 'observe',
    branch_id: null,
    reactivation_record_id: null,
    ...overrides,
  };
}

function diff(index: number, changes: TopicChange[], overrides: Partial<StageDiff> = {}): StageDiff {
  const id = runId(index);
  return {
    ...artifactMetadata({
      artifact_type: 'stage_diff',
      rule_version: 'narrative-lifecycle-rules-v0.1',
      run_id: id,
      generated_at: `2026-07-1${index}T00:00:00.000Z`,
    }),
    diff_id: `stage_diff_${id}`,
    run_id: id,
    generated_at: `2026-07-1${index}T00:00:00.000Z`,
    status: index === 1 ? 'no_previous_snapshot' : 'ok',
    previous_snapshot_id: index > 1 ? `stage_snapshot_${runId(index - 1)}` : null,
    current_snapshot_id: `stage_snapshot_${id}`,
    summary: {
      topic_count: changes.length,
      stage_upgrade_count: changes.filter((change) => change.detected_changes.includes('stage_upgrade')).length,
      stage_downgrade_count: changes.filter((change) => change.detected_changes.includes('stage_downgrade')).length,
      evidence_added_count: changes.filter((change) => change.detected_changes.includes('evidence_added')).length,
      branch_mutation_candidate_count: changes.filter((change) => change.detected_changes.includes('branch_mutation_candidate')).length,
      guardrail_regression_count: overrides.guardrail_changes?.length ?? 0,
    },
    topic_changes: changes,
    early_radar_changes: [],
    guardrail_changes: [],
    next_operator_actions: [],
    ...overrides,
  };
}

function brief(index: number): Partial<WeeklyBrief> {
  return {
    report_id: `weekly_brief_${runId(index)}`,
    generated_at: `2026-07-1${index}T00:00:00.000Z`,
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeRun(root: string, index: number, options: {
  manifest?: Partial<RunManifest>;
  diff?: StageDiff;
  brief?: Partial<WeeklyBrief>;
}): void {
  const id = runId(index);
  const runRoot = resolve(root, 'outputs/runs', id);
  writeJson(resolve(runRoot, 'run_manifest.json'), manifest(index, options.manifest));
  if (options.diff) writeJson(resolve(runRoot, 'stage_diff.json'), options.diff);
  if (options.brief) writeJson(resolve(runRoot, 'weekly_brief.json'), options.brief);
}

describe('operator review', () => {
  it('aggregates historical run artifacts without changing parent stage from branch mutation', () => {
    const root = mkRoot();
    writeRun(root, 1, {
      diff: diff(1, [topicChange({ change_type: 'initial_snapshot', detected_changes: ['initial_snapshot'], previous_stage: null })]),
      brief: brief(1),
    });
    writeRun(root, 2, {
      diff: diff(2, [topicChange({
        change_type: 'stage_upgrade',
        detected_changes: ['stage_upgrade', 'evidence_added'],
        previous_stage: 'S3',
        current_stage: 'S4',
        new_evidence_ids: ['ev_upgrade'],
        current_evidence_ids: ['ev_parent', 'ev_upgrade'],
        priority: 'medium',
        research_only_action: 'review',
      })]),
      brief: brief(2),
    });
    writeRun(root, 3, {
      diff: diff(3, [topicChange({
        change_type: 'stage_downgrade',
        detected_changes: ['stage_downgrade', 'evidence_removed', 'why_not_higher_changed', 'data_confidence_changed'],
        previous_stage: 'S5',
        current_stage: 'S4',
        removed_evidence_ids: ['ev_removed'],
        previous_why_not_higher_stage: 'Prior limit.',
        current_why_not_higher_stage: 'Reality evidence weakened.',
        previous_data_confidence: 'high',
        current_data_confidence: 'medium',
        priority: 'high',
        research_only_action: 'flag_risk',
      })]),
      brief: brief(3),
    });
    writeRun(root, 4, {
      diff: diff(4, [topicChange({
        change_type: 'branch_mutation_candidate',
        detected_changes: ['branch_change', 'branch_mutation_candidate'],
        previous_stage: 'S4',
        current_stage: 'S4',
        branch_id: 'medical_rehab',
        reactivation_record_id: 'reactivation_bci_medical',
        new_evidence_ids: ['ev_branch'],
        current_evidence_ids: ['ev_parent', 'ev_branch'],
        priority: 'medium',
        research_only_action: 'review',
      })], {
        early_radar_changes: [{
          candidate_id: 'radar_bci',
          candidate_topic: 'BCI medical rehab',
          change_type: 'early_radar_added',
          reactivation_record_id: 'reactivation_bci_medical',
          evidence_ids: ['ev_branch'],
          priority: 'medium',
          research_only_action: 'review',
        }],
      }),
      brief: brief(4),
    });
    writeRun(root, 5, {
      manifest: { status: 'failed', commands: ['pipeline', 'diff'], artifacts: [], guardrail_status: 'review_required' },
    });
    writeRun(root, 6, {
      diff: diff(6, [topicChange()], {
        guardrail_changes: [{
          guardrail: 'parent_branch_separation_preserved',
          change_type: 'guardrail_regression',
          previous_value: true,
          current_value: false,
          priority: 'high',
          research_only_action: 'flag_risk',
        }],
      }),
      brief: brief(6),
    });
    writeRun(root, 7, {
      diff: diff(7, [topicChange()]),
      brief: brief(7),
    });
    writeRun(root, 8, {
      manifest: { status: 'failed', commands: ['pipeline', 'diff'], artifacts: [], guardrail_status: 'ok' },
    });

    const review = buildOperatorReview(loadOperatorReviewArtifacts(root), '2026-07-20T00:00:00.000Z');
    const markdown = renderOperatorReviewMarkdown(review);

    expect(review.status).toBe('ok');
    expect(review.run_summary).toEqual({ run_count: 8, successful_run_count: 6, failed_run_count: 2 });
    expect(review.stage_trends.upgrades).toHaveLength(1);
    expect(review.stage_trends.downgrades).toHaveLength(1);
    expect(review.evidence_trends.added[0].evidence_ids).toEqual(['ev_upgrade']);
    expect(review.evidence_trends.removed[0].evidence_ids).toEqual(['ev_removed']);
    expect(review.why_not_higher_changes[0].current_value).toBe('Reality evidence weakened.');
    expect(review.data_confidence_changes[0]).toMatchObject({ previous_value: 'high', current_value: 'medium' });
    expect(review.branch_mutation_changes[0]).toMatchObject({ branch_id: 'medical_rehab', current_value: undefined });
    expect(review.early_radar_changes[0]).toMatchObject({ reactivation_record_id: 'reactivation_bci_medical' });
    expect(review.guardrail_regressions[0].change_type).toBe('parent_branch_separation_preserved');
    expect(review.failure_case_hits.some((hit) => hit.status === 'failed')).toBe(true);
    expect(review.repeated_issues.some((issue) => issue.issue.includes('weekly workflow failed'))).toBe(true);
    expect(review.consecutive_no_change_topics[0]).toMatchObject({ topic_id: 'bci', consecutive_run_count: 2 });
    expect(review.high_priority_operator_alerts.map((alert) => alert.category)).toContain('stage_downgrade');
    expect(JSON.stringify(review)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
    expect(markdown).toContain('## 10. Research-Only Next Actions');
  });

  it('writes schema-valid insufficient_history output when no run history exists', () => {
    const root = mkRoot();
    cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });

    execFileSync('npx', ['tsx', resolve(repoRoot, 'src/cli/run_review.ts')], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });

    const review = JSON.parse(readFileSync(resolve(root, 'outputs/reviews/latest_operator_review.json'), 'utf8')) as Record<string, unknown>;
    const markdown = readFileSync(resolve(root, 'outputs/reviews/latest_operator_review.md'), 'utf8');
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(root, 'schemas/operator_review.schema.json'), 'utf8')));

    expect(validate(review), JSON.stringify(validate.errors)).toBe(true);
    expect(review.status).toBe('insufficient_history');
    expect(markdown).toContain('status: insufficient_history');
  });
});

function mkRoot(): string {
  return join(tmpdir(), `narrative-operator-review-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}
