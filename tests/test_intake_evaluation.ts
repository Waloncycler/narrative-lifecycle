import { describe, expect, it } from 'vitest';
import type { EvidenceCandidate, EvidenceIntakeSession, ReviewDecision } from '@/types/intake';
import { buildIntakeEvaluation, compareRuleAndAiCandidates } from '@/domain/intake_evaluation';
import { EvaluateIntakeUseCase } from '@/application/use_cases/intake_use_cases';

function candidate(id: string, topicId = 'bci', branchId: string | null = 'bci_medical_rehab'): EvidenceCandidate {
  return {
    candidate_id: id,
    raw_document_id: 'raw',
    chunk_id: 'chunk',
    provenance_id: 'prov',
    original_quote: 'BCI branch validation.',
    suggested_reason: 'test',
    uncertainty_notes: [],
    field_explanations: {},
    e_strength_rationale: 'test',
    suggested_evidence: {
      evidence_id: id,
      topic_id: topicId,
      branch_id: branchId,
      scope: branchId ? 'branch' : 'parent',
      event_date: '2026-07-13',
      available_at: '2026-07-13',
      event_title: 'BCI branch validation',
      event_summary: 'BCI branch validation.',
      event_type: 'test',
      source_name: 'test',
      source_type: 'research',
      evidence_strength: 'E2',
      affected_layer: ['reality'],
      stage_effect: branchId ? 'split_branch' : 'maintain',
      polarity: 'positive',
      interpretation: 'test',
      limitation: 'branch does not upgrade parent',
      confidence: 'low',
    },
    guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  };
}

function session(candidates: EvidenceCandidate[]): EvidenceIntakeSession {
  return {
    session_id: 'session',
    generated_at: '2026-07-13T00:00:00.000Z',
    raw_document: { raw_document_id: 'raw', source_name: 'test', source_kind: 'markdown', ingested_at: '2026-07-13T00:00:00.000Z', text: 'test', character_count: 4 },
    chunks: [],
    provenance_records: [],
    candidates,
    candidate_comparisons: [],
    ai_shadow_candidates: [],
    review_template: [],
  };
}

describe('intake evaluation', () => {
  it('calculates review feedback metrics, field accuracy, review time, duplicate prevention, and branch errors', () => {
    const candidates = [candidate('a'), candidate('b'), candidate('c')];
    const decisions: ReviewDecision[] = [
      { candidate_id: 'a', decision: 'accept', reviewer: 'tester', review_started_at: '2026-07-13T00:00:00.000Z', reviewed_at: '2026-07-13T00:01:00.000Z' },
      { candidate_id: 'b', decision: 'modify', reviewer: 'tester', reviewed_at: '2026-07-13T00:02:00.000Z', review_duration_seconds: 30, modified_evidence: { ...candidates[1].suggested_evidence, scope: 'parent', branch_id: null, evidence_strength: 'E3' } },
      { candidate_id: 'c', decision: 'reject', reviewer: 'tester', reviewed_at: '2026-07-13T00:03:00.000Z', rejection_reason: 'duplicate source' },
    ];
    const report = buildIntakeEvaluation({
      session: session(candidates),
      decisions,
      applyResult: { session_id: 'session', topic_audit_id: 'audit_session', generated_at: '2026-07-13T00:04:00.000Z', accepted_count: 1, modified_count: 1, split_count: 0, rejected_count: 1, duplicate_count: 1, accepted_evidence_ids: ['ev_a'], evidence_draft_path: null, imported: false, import_status: 'duplicates_rejected', import_id: null, weekly_run_id: null, stage_change_summary: null, guardrail_check: { human_review_required: true, no_trading_advice: true, duplicate_detection_applied: true, parent_branch_guardrail_applied: true } },
      generatedAt: '2026-07-13T00:05:00.000Z',
    });
    expect(report.acceptance_rate).toBe(0.333);
    expect(report.modification_rate).toBe(0.333);
    expect(report.rejection_rate).toBe(0.333);
    expect(report.average_review_time_seconds).toBe(45);
    expect(report.duplicate_prevention_count).toBe(1);
    expect(report.parent_branch_error_rate).toBe(0.333);
    expect(report.feedback.find((item) => item.candidate_id === 'b')?.modified_fields).toContain('scope');
  });

  it('records AI shadow differences without changing the rule-based candidate', () => {
    const rule = candidate('a', 'unknown_topic', null);
    const comparisons = compareRuleAndAiCandidates({
      ruleCandidates: [rule],
      aiCandidates: [{
        ai_candidate_id: 'ai_a',
        candidate_id: 'a',
        original_quote: rule.original_quote,
        suggested_evidence: { ...rule.suggested_evidence, topic_id: 'bci', branch_id: 'bci_medical_rehab', scope: 'branch' },
        suggested_reason: 'AI shadow alternative.',
        uncertainty_notes: ['shadow only'],
        alternative_mappings: [{ topic_id: 'unknown_topic', branch_id: null, reason: 'rule mapping' }],
        shadow_mode: true,
      }],
    });
    expect(comparisons[0]).toMatchObject({ differs: true, rule_topic_id: 'unknown_topic', ai_topic_id: 'bci', human_decision_required: false });
    expect(rule.suggested_evidence.topic_id).toBe('unknown_topic');
  });

  it('does not dilute completed-review rates with newly generated but unreviewed candidates', () => {
    const reviewed = candidate('reviewed');
    const report = buildIntakeEvaluation({
      session: session([reviewed, candidate('awaiting_review')]),
      decisions: [{
        candidate_id: reviewed.candidate_id,
        decision: 'modify',
        reviewer: 'tester',
        reviewed_at: '2026-07-13T00:02:00.000Z',
        modified_evidence: { ...reviewed.suggested_evidence, limitation: 'Human-added limitation.' },
      }],
      generatedAt: '2026-07-13T00:05:00.000Z',
    });

    expect(report.candidate_count).toBe(2);
    expect(report.modification_rate).toBe(1);
    expect(report.acceptance_rate).toBe(0);
  });

  it('rejects evaluation artifacts from a different intake session', () => {
    const current = session([candidate('a')]);
    const useCase = new EvaluateIntakeUseCase({
      readLatestSession: () => current,
      readReviewDecisions: () => [],
      readApplyResult: () => ({
        session_id: 'older_session',
        topic_audit_id: 'audit_older_session',
        generated_at: current.generated_at,
        accepted_count: 0,
        modified_count: 0,
        split_count: 0,
        rejected_count: 0,
        duplicate_count: 0,
        accepted_evidence_ids: [],
        evidence_draft_path: null,
        imported: false,
        import_status: 'no_accepted_evidence',
        import_id: null,
        weekly_run_id: null,
        stage_change_summary: null,
        guardrail_check: {
          human_review_required: true,
          no_trading_advice: true,
          duplicate_detection_applied: true,
          parent_branch_guardrail_applied: true,
        },
      }),
      readTopicResolutionAudit: () => null,
      writeIntakeEvaluation: () => undefined,
      validateEvaluation: () => undefined,
      now: () => current.generated_at,
    });
    expect(() => useCase.execute({})).toThrow('apply result session mismatch');
  });
});
