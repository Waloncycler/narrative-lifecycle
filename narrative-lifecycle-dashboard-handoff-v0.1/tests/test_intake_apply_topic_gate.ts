import { describe, expect, it } from 'vitest';
import { ApplyEvidenceIntakeReviewUseCase, RetryEvidenceIntakePipelineUseCase } from '../src/application/use_cases/intake_use_cases';
import type { EvidenceIntakeSession } from '../src/types/intake';
import type { TopicResolutionAudit } from '../src/types/topic_resolution';

const session = {
  session_id: 'session_source_sync',
  generated_at: '2026-07-28T12:00:00.000Z',
  raw_document: {},
  chunks: [],
  provenance_records: [],
  candidates: [{ candidate_id: 'candidate_unresolved' }],
  review_template: [],
} as unknown as EvidenceIntakeSession;

describe('intake apply Topic gate', () => {
  it('requires a Topic Resolution Audit for the same session', () => {
    const useCase = useCaseWithAudit(null);
    expect(() => useCase.execute({})).toThrow(/topic resolution audit is required/);
  });

  it('imports accepted unresolved or provisional candidates without blocking (autonomous mode)', () => {
    const unresolvedSession = {
      ...session,
      candidates: [{
        candidate_id: 'candidate_unresolved',
        suggested_evidence: {
          evidence_id: 'evidence_unresolved',
          topic_id: 'unknown_topic',
          branch_id: null,
          scope: 'parent',
          event_date: '2026-07-28',
          available_at: '2026-07-28',
          event_title: 'Unresolved source fact',
          event_summary: 'Unresolved source fact summary.',
          event_type: 'TEST',
          source_name: 'test',
          source_url: 'https://example.test/unresolved',
          source_type: 'official',
          evidence_strength: 'E1',
          affected_layer: ['name'],
          stage_effect: 'maintain',
          polarity: 'neutral',
          interpretation: 'Research-only interpretation.',
          limitation: 'Requires continued validation.',
          confidence: 'low',
        },
      }],
    } as unknown as EvidenceIntakeSession;
    const audit = {
      session_id: session.session_id,
      resolutions: [{ candidate_id: 'candidate_unresolved', status: 'unresolved' }],
    } as unknown as TopicResolutionAudit;
    let imported = false;
    const useCase = new ApplyEvidenceIntakeReviewUseCase({
      readLatestSession: () => unresolvedSession,
      readTopicResolutionAudit: () => audit,
      readReviewDecisions: () => [{
        candidate_id: 'candidate_unresolved',
        decision: 'accept',
        reviewer: 'auto_agent',
        reviewed_at: '2026-07-28T12:00:00.000Z',
      }],
      existingEvidenceIds: () => new Set(),
      writeEvidenceDraft: () => 'draft.yaml',
      writeApplyResult: () => undefined,
      importEvidence: () => { imported = true; return { report: { import_id: 'import_unresolved', status: 'passed' }, failed: false } as never; },
      runWeekly: () => ({ run_id: 'run_ok' } as never),
      readStageChangeSummary: () => null,
      now: () => '2026-07-28T12:00:00.000Z',
    });
    expect(() => useCase.execute({})).not.toThrow(/unresolved or provisional Topic cannot be imported/);
    expect(imported).toBe(true);
  });

  it('persists an imported_pipeline_failed result when Weekly fails after import', () => {
    const safeSession = {
      ...session,
      candidates: [{
        candidate_id: 'candidate_safe',
        suggested_evidence: {
          evidence_id: 'evidence_safe',
          topic_id: 'bci',
          branch_id: null,
          scope: 'parent',
          event_date: '2026-07-28',
          available_at: '2026-07-28',
          event_title: 'Validated source fact',
          event_summary: 'Validated source fact summary.',
          event_type: 'TEST',
          source_name: 'test',
          source_url: 'https://example.test/fact',
          source_type: 'official',
          evidence_strength: 'E1',
          affected_layer: ['name'],
          stage_effect: 'maintain',
          polarity: 'neutral',
          interpretation: 'Research-only interpretation.',
          limitation: 'Requires continued validation.',
          confidence: 'low',
        },
      }],
    } as unknown as EvidenceIntakeSession;
    const audit = {
      audit_id: 'audit_safe',
      session_id: safeSession.session_id,
      resolutions: [{ candidate_id: 'candidate_safe', status: 'existing_topic' }],
    } as unknown as TopicResolutionAudit;
    let written = null;
    const useCase = new ApplyEvidenceIntakeReviewUseCase({
      readLatestSession: () => safeSession,
      readTopicResolutionAudit: () => audit,
      readReviewDecisions: () => [{ candidate_id: 'candidate_safe', decision: 'accept', reviewer: 'operator', reviewed_at: '2026-07-28T12:00:00.000Z' }],
      existingEvidenceIds: () => new Set(),
      writeEvidenceDraft: () => 'draft.yaml',
      writeApplyResult: (result) => { written = result; },
      importEvidence: () => ({ report: { import_id: 'import_safe', status: 'passed' }, failed: false } as never),
      runWeekly: () => { throw new Error('pipeline failed'); },
      readStageChangeSummary: () => null,
      now: () => '2026-07-28T12:00:00.000Z',
    });
    const result = useCase.execute({});
    expect(result).toMatchObject({ imported: true, import_status: 'imported_pipeline_failed', import_id: 'import_safe', weekly_run_id: null });
    expect(written).toEqual(result);
  });

  it('retries Weekly without importing Evidence again and persists recovery', () => {
    let written = null;
    let weeklyRuns = 0;
    const failedApply = {
      session_id: session.session_id,
      topic_audit_id: 'audit_safe',
      generated_at: '2026-07-28T12:00:00.000Z',
      accepted_count: 1,
      modified_count: 0,
      split_count: 0,
      rejected_count: 0,
      duplicate_count: 0,
      accepted_evidence_ids: ['evidence_safe'],
      evidence_draft_path: 'draft.yaml',
      imported: true,
      import_status: 'imported_pipeline_failed',
      import_id: 'import_safe',
      weekly_run_id: null,
      stage_change_summary: null,
      pipeline_retry_count: 0,
      pipeline_error: 'weekly command failed: report',
      guardrail_check: {
        human_review_required: true,
        no_trading_advice: true,
        duplicate_detection_applied: true,
        parent_branch_guardrail_applied: true,
      },
    } as import('../src/types/intake').EvidenceIntakeApplyResult;
    const useCase = new RetryEvidenceIntakePipelineUseCase({
      readLatestSession: () => session,
      readApplyResult: () => failedApply,
      writeApplyResult: (result) => { written = result; },
      runWeekly: () => {
        weeklyRuns += 1;
        return { run_id: 'run_recovered' } as never;
      },
      readStageChangeSummary: () => ({ stage_change_count: 0 }),
      now: () => '2026-07-28T12:05:00.000Z',
    });

    const result = useCase.execute({ sessionId: session.session_id });
    expect(weeklyRuns).toBe(1);
    expect(result).toMatchObject({
      import_status: 'imported_pipeline_recovered',
      import_id: 'import_safe',
      weekly_run_id: 'run_recovered',
      pipeline_retry_count: 1,
      pipeline_error: null,
    });
    expect(written).toEqual(result);
  });

  it('rejects pipeline retry when the Apply result is not recoverable', () => {
    const useCase = new RetryEvidenceIntakePipelineUseCase({
      readLatestSession: () => session,
      readApplyResult: () => ({
        session_id: session.session_id,
        imported: false,
        import_status: 'no_accepted_evidence',
        weekly_run_id: null,
      } as never),
      writeApplyResult: () => { throw new Error('must not write'); },
      runWeekly: () => { throw new Error('must not run'); },
      readStageChangeSummary: () => null,
      now: () => '2026-07-28T12:05:00.000Z',
    });
    expect(() => useCase.execute({ sessionId: session.session_id })).toThrow(/only allowed/);
  });
});

function useCaseWithAudit(audit: TopicResolutionAudit | null) {
  const unreachable = () => { throw new Error('unreachable'); };
  return new ApplyEvidenceIntakeReviewUseCase({
    readLatestSession: () => session,
    readTopicResolutionAudit: () => audit,
    readReviewDecisions: () => [{
      candidate_id: 'candidate_unresolved',
      decision: 'accept',
      reviewer: 'operator',
      reviewed_at: '2026-07-28T12:00:00.000Z',
    }],
    existingEvidenceIds: () => new Set(),
    writeEvidenceDraft: unreachable,
    writeApplyResult: unreachable,
    importEvidence: unreachable,
    runWeekly: unreachable,
    readStageChangeSummary: unreachable,
    now: () => '2026-07-28T12:00:00.000Z',
  });
}
