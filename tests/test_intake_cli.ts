import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { EvidenceCandidate, EvidenceIntakeApplyResult, EvidenceIntakeSession, IntakeEvaluationReport, ReviewDecision } from '@/features/intake/types/intake';
import type { TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { EvidenceImportDraft } from '@/features/evidence/types/evidence_import';

const repoRoot = resolve(import.meta.dirname, '..');

function seedWorkspace(): string {
  const root = join(tmpdir(), `intake-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });
  cpSync(resolve(repoRoot, 'configs'), resolve(root, 'configs'), { recursive: true });
  cpSync(resolve(repoRoot, 'data'), resolve(root, 'data'), { recursive: true });
  return root;
}

function writeYaml(root: string, path: string, value: unknown): void {
  const target = resolve(root, path);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, stringify(value));
}

function validator(root: string, schema: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(resolve(root, 'schemas', schema), 'utf8')));
}

describe('evidence intake CLI', () => {
  it('prepares candidate evidence with provenance and applies human-reviewed import through weekly', () => {
    const root = seedWorkspace();
    execFileSync('npm', ['run', 'intake:prepare', '--', '--file', 'data/intake/examples/bci_branch_note.md'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });

    const session = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_session.json'), 'utf8')) as EvidenceIntakeSession;
    const candidates = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_candidates.json'), 'utf8')) as EvidenceCandidate[];
    const html = readFileSync(resolve(root, 'outputs/intake/latest_workbench.html'), 'utf8');
    const validateSession = validator(root, 'intake_session.schema.json');
    const validateCandidate = validator(root, 'evidence_candidate.schema.json');

    expect(validateSession(session), JSON.stringify(validateSession.errors)).toBe(true);
    expect(validateCandidate(candidates[0]), JSON.stringify(validateCandidate.errors)).toBe(true);
    expect(html).toContain('研究材料智能解析工作台');
    expect(html).toContain('接受');
    expect(html).toContain('拆分');
    expect(session.provenance_records[0].quote).toContain('branch');
    expect(candidates[0].suggested_evidence.scope).toBe('branch');

    const reviewed: EvidenceImportDraft = {
      ...candidates[0].suggested_evidence,
      evidence_id: 'intake_bci_medical_rehab_reviewed_001',
      source_type: 'research',
      evidence_strength: 'E2',
      confidence: 'medium',
    };
    const decisions: ReviewDecision[] = [
      {
        candidate_id: candidates[0].candidate_id,
        decision: 'modify',
        reviewer: 'tester',
        review_started_at: '2026-07-13T00:00:00.000Z',
        reviewed_at: '2026-07-13T00:00:00.000Z',
        review_duration_seconds: 45,
        modified_evidence: reviewed,
      },
      ...candidates.slice(1).map((candidate) => ({
        candidate_id: candidate.candidate_id,
        decision: 'reject' as const,
        reviewer: 'tester',
        review_started_at: '2026-07-13T00:00:00.000Z',
        reviewed_at: '2026-07-13T00:00:00.000Z',
        review_duration_seconds: 10,
        rejection_reason: 'not needed for this intake test',
      })),
    ];
    writeYaml(root, 'outputs/intake/test_review_decisions.yaml', decisions);

    execFileSync('npm', ['run', 'topic:validate'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });
    execFileSync('npm', ['run', 'intake:apply', '--', '--decisions', 'outputs/intake/test_review_decisions.yaml'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });
    execFileSync('npm', ['run', 'intake:evaluate', '--', '--decisions', 'outputs/intake/test_review_decisions.yaml'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });

    const result = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_apply_result.json'), 'utf8')) as EvidenceIntakeApplyResult;
    const audit = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_topic_resolution_audit.json'), 'utf8')) as TopicResolutionAudit;
    const evaluation = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_evaluation.json'), 'utf8')) as IntakeEvaluationReport;
    const weekly = JSON.parse(readFileSync(resolve(root, 'outputs/operator_runs/latest_weekly_brief.json'), 'utf8')) as { stage_snapshot: Array<{ topic_id: string; current_stage: string }>; stage_change_summary: unknown };
    const validateResult = validator(root, 'intake_apply_result.schema.json');
    const validateAudit = validator(root, 'topic_resolution_audit.schema.json');
    const validateEvaluation = validator(root, 'intake_evaluation.schema.json');
    expect(validateResult(result), JSON.stringify(validateResult.errors)).toBe(true);
    expect(validateAudit(audit), JSON.stringify(validateAudit.errors)).toBe(true);
    expect(validateEvaluation(evaluation), JSON.stringify(validateEvaluation.errors)).toBe(true);
    expect(result.imported).toBe(true);
    expect(result.weekly_run_id).toEqual(expect.stringMatching(/^run_/));
    expect(readdirSync(resolve(root, 'outputs/intake/history')).some((file) => file.startsWith(`apply_${result.session_id}_`))).toBe(true);
    expect(audit.resolutions[0].status).toBe('existing_topic');
    expect(evaluation.modification_rate).toBe(1);
    expect(evaluation.average_review_time_seconds).toBe(45);
    // The workspace includes the reviewed BCI parent baseline. This branch
    // import must not lift it beyond its independent S4 parent evidence.
    expect(weekly.stage_snapshot.find((topic) => topic.topic_id === 'bci')?.current_stage).toBe('S4');
    expect(JSON.stringify(result)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
  });

  it('rejects duplicate reviewed candidates before formal import', () => {
    const root = seedWorkspace();
    execFileSync('npm', ['run', 'intake:prepare', '--', '--file', 'data/intake/examples/bci_branch_note.md'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      stdio: 'pipe',
    });
    const candidates = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_candidates.json'), 'utf8')) as EvidenceCandidate[];
    const decisions: ReviewDecision[] = [{
      candidate_id: candidates[0].candidate_id,
      decision: 'modify',
      reviewer: 'tester',
      reviewed_at: '2026-07-13T00:00:00.000Z',
      modified_evidence: { ...candidates[0].suggested_evidence, evidence_id: 'bci_parent_label' },
    }];
    writeYaml(root, 'outputs/intake/duplicate_review_decisions.yaml', decisions);

    const result = spawnSync('npm', ['run', 'intake:apply', '--', '--decisions', 'outputs/intake/duplicate_review_decisions.yaml'], {
      cwd: repoRoot,
      env: { ...process.env, NARRATIVE_REPO_ROOT: root },
      encoding: 'utf8',
    });
    const apply = JSON.parse(readFileSync(resolve(root, 'outputs/intake/latest_apply_result.json'), 'utf8')) as EvidenceIntakeApplyResult;

    expect(result.status).toBe(1);
    expect(apply.imported).toBe(false);
    expect(apply.import_status).toBe('duplicates_rejected');
    expect(apply.duplicate_count).toBe(1);
  });
});
