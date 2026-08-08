import type { EvidenceImportDraft } from '@/types/evidence_import';
import type { AiCandidateSuggestion, CandidateGenerationComparison, CandidateReviewFeedback, EvidenceCandidate, EvidenceIntakeApplyResult, EvidenceIntakeSession, IntakeEvaluationReport, ReviewDecision } from '@/types/intake';
import { noTradingAdvice } from './intake_rules';
import type { TopicResolutionAudit } from '@/types/topic_resolution';

const comparedFields: Array<keyof EvidenceImportDraft> = [
  'topic_id',
  'branch_id',
  'scope',
  'event_title',
  'event_summary',
  'source_type',
  'evidence_strength',
  'affected_layer',
  'stage_effect',
  'polarity',
  'interpretation',
  'limitation',
  'confidence',
];

export function compareRuleAndAiCandidates(input: {
  ruleCandidates: EvidenceCandidate[];
  aiCandidates: AiCandidateSuggestion[];
}): CandidateGenerationComparison[] {
  const aiByCandidate = new Map(input.aiCandidates.map((candidate) => [candidate.candidate_id, candidate]));
  return input.ruleCandidates.map((rule) => {
    const ai = aiByCandidate.get(rule.candidate_id);
    const aiEvidence = ai?.suggested_evidence;
    const differs = Boolean(aiEvidence && (
      aiEvidence.topic_id !== rule.suggested_evidence.topic_id
      || (aiEvidence.branch_id ?? null) !== (rule.suggested_evidence.branch_id ?? null)
      || aiEvidence.scope !== rule.suggested_evidence.scope
      || aiEvidence.evidence_strength !== rule.suggested_evidence.evidence_strength
      || JSON.stringify(aiEvidence.affected_layer) !== JSON.stringify(rule.suggested_evidence.affected_layer)
      || aiEvidence.limitation !== rule.suggested_evidence.limitation
    ));
    return {
      candidate_id: rule.candidate_id,
      rule_topic_id: rule.suggested_evidence.topic_id,
      ai_topic_id: aiEvidence?.topic_id ?? null,
      rule_branch_id: rule.suggested_evidence.branch_id ?? null,
      ai_branch_id: aiEvidence?.branch_id ?? null,
      rule_scope: rule.suggested_evidence.scope,
      ai_scope: aiEvidence?.scope ?? null,
      rule_strength: rule.suggested_evidence.evidence_strength,
      ai_strength: aiEvidence?.evidence_strength ?? null,
      rule_layers: rule.suggested_evidence.affected_layer,
      ai_layers: aiEvidence?.affected_layer ?? [],
      rule_limitation: rule.suggested_evidence.limitation,
      ai_limitation: aiEvidence?.limitation ?? null,
      differs,
      difference_summary: ai
        ? differs ? `AI shadow suggested ${aiEvidence?.topic_id}/${aiEvidence?.branch_id ?? 'parent'} instead of ${rule.suggested_evidence.topic_id}/${rule.suggested_evidence.branch_id ?? 'parent'}.` : 'AI shadow matched the rule-based topic and branch.'
        : 'No AI shadow suggestion was generated.',
      human_decision_required: false,
    };
  });
}

export function buildIntakeEvaluation(input: {
  session: EvidenceIntakeSession;
  decisions: ReviewDecision[];
  applyResult?: EvidenceIntakeApplyResult | null;
  topicAudit?: TopicResolutionAudit | null;
  generatedAt: string;
}): IntakeEvaluationReport {
  const candidates = new Map(input.session.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  // Rates describe completed reviews. Newly generated, unreviewed candidates stay in
  // candidate_count but must not dilute a reviewer's observed decision rates.
  const reviewedDecisions = input.decisions.filter((decision) => candidates.has(decision.candidate_id));
  const feedback = reviewedDecisions
    .map((decision) => feedbackForDecision(candidates.get(decision.candidate_id)!, decision, input.applyResult));
  const total = Math.max(1, reviewedDecisions.length);
  const accepted = reviewedDecisions.filter((decision) => decision.decision === 'accept').length;
  const modified = reviewedDecisions.filter((decision) => decision.decision === 'modify').length;
  const rejected = reviewedDecisions.filter((decision) => decision.decision === 'reject').length;
  const split = reviewedDecisions.filter((decision) => decision.decision === 'split').length;
  const reviewTimes = feedback.map((item) => item.review_duration_seconds).filter((item): item is number => typeof item === 'number');
  const unresolved = input.topicAudit?.unresolved_queue.map((item) => item.candidate_id) ?? [];

  return {
    evaluation_id: `intake_evaluation_${input.generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}_${input.session.session_id}`,
    generated_at: input.generatedAt,
    session_id: input.session.session_id,
    candidate_count: input.session.candidates.length,
    acceptance_rate: round(accepted / total),
    modification_rate: round(modified / total),
    rejection_rate: round(rejected / total),
    split_rate: round(split / total),
    field_accuracy: round(average(feedback.map((item) => item.field_accuracy))),
    average_review_time_seconds: reviewTimes.length ? round(average(reviewTimes)) : 'insufficient_data',
    duplicate_prevention_count: input.applyResult?.duplicate_count ?? feedback.filter((item) => item.duplicate_hit).length,
    parent_branch_error_rate: round(feedback.filter((item) => item.parent_branch_error).length / total),
    ai_shadow_difference_count: input.session.candidate_comparisons?.filter((item) => item.differs).length ?? 0,
    feedback,
    unresolved_candidate_ids: unresolved,
    guardrail_check: {
      human_review_required: false,
      no_trading_advice: noTradingAdvice(input),
      ai_shadow_only: true,
      no_auto_topic_activation: false,
    },
  };
}

function feedbackForDecision(candidate: EvidenceCandidate, decision: ReviewDecision, applyResult?: EvidenceIntakeApplyResult | null): CandidateReviewFeedback {
  const finalDrafts = finalEvidenceFor(decision, candidate);
  const finalDraft = finalDrafts[0] ?? candidate.suggested_evidence;
  const modifiedFields = decision.decision === 'reject' ? [] : changedFields(candidate.suggested_evidence, finalDraft);
  const duplicateHit = Boolean(candidate.duplicate_of_evidence_id)
    || Boolean(applyResult?.duplicate_count && decision.decision !== 'reject');
  return {
    candidate_id: candidate.candidate_id,
    final_decision: decision.decision,
    modified_fields: modifiedFields,
    rejection_reason: decision.rejection_reason ?? null,
    review_duration_seconds: reviewDuration(decision),
    duplicate_hit: duplicateHit,
    parent_branch_error: parentBranchError(candidate.suggested_evidence, finalDraft),
    field_accuracy: decision.decision === 'reject' ? 0 : round((comparedFields.length - modifiedFields.length) / comparedFields.length),
  };
}

function finalEvidenceFor(decision: ReviewDecision, candidate: EvidenceCandidate): EvidenceImportDraft[] {
  if (decision.decision === 'modify') return [decision.modified_evidence ?? candidate.suggested_evidence];
  if (decision.decision === 'split') return decision.split_evidence ?? [];
  if (decision.decision === 'accept') return [candidate.suggested_evidence];
  return [];
}

function changedFields(original: EvidenceImportDraft, finalDraft: EvidenceImportDraft): string[] {
  return comparedFields.filter((field) => JSON.stringify(original[field] ?? null) !== JSON.stringify(finalDraft[field] ?? null)).map(String);
}

function parentBranchError(original: EvidenceImportDraft, finalDraft: EvidenceImportDraft): boolean {
  return original.scope !== finalDraft.scope
    || (original.branch_id ?? null) !== (finalDraft.branch_id ?? null)
    || original.topic_id !== finalDraft.topic_id;
}

function reviewDuration(decision: ReviewDecision): number | null {
  if (typeof decision.review_duration_seconds === 'number') return decision.review_duration_seconds;
  if (!decision.review_started_at) return null;
  const start = Date.parse(decision.review_started_at);
  const end = Date.parse(decision.reviewed_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
