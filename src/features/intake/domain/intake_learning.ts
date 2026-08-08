import type { EvidenceIntakeSession, IntakeEvaluationReport, ReviewDecision } from '@/features/intake/types/intake';
import type { IntakeLearningFieldSignal, IntakeLearningProfile, IntakeLearningRejectionSignal, IntakeLearningTopicSignal } from '@/features/intake/types/intake_learning';

export function buildIntakeLearningProfile(input: {
  session: EvidenceIntakeSession;
  decisions: ReviewDecision[];
  evaluation: IntakeEvaluationReport;
  previous?: IntakeLearningProfile | null;
  generatedAt: string;
}): IntakeLearningProfile {
  if (input.previous?.source_evaluation_ids.includes(input.evaluation.evaluation_id)) {
    return input.previous;
  }
  const candidates = new Map(input.session.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const fields = new Map<string, IntakeLearningFieldSignal>(
    (input.previous?.field_corrections ?? []).map((item) => [item.field, structuredClone(item)]),
  );
  const topics = new Map<string, IntakeLearningTopicSignal>(
    (input.previous?.topic_corrections ?? []).map((item) => [
      JSON.stringify({
        from_topic_id: item.from_topic_id,
        to_topic_id: item.to_topic_id,
        from_branch_id: item.from_branch_id,
        to_branch_id: item.to_branch_id,
      }),
      structuredClone(item),
    ]),
  );
  const rejections = new Map<string, IntakeLearningRejectionSignal>(
    (input.previous?.rejection_patterns ?? []).map((item) => [item.reason, structuredClone(item)]),
  );
  let splitCount = input.previous?.split_count ?? 0;
  let parentBranchErrors = input.previous?.guardrail_incidents.parent_branch_errors ?? 0;
  let duplicateHits = input.previous?.guardrail_incidents.duplicate_hits ?? 0;

  for (const feedback of input.evaluation.feedback) {
    const candidate = candidates.get(feedback.candidate_id);
    const decision = input.decisions.find((item) => item.candidate_id === feedback.candidate_id);
    if (!candidate || !decision) continue;
    if (feedback.final_decision === 'split') splitCount += 1;
    if (feedback.parent_branch_error) parentBranchErrors += 1;
    if (feedback.duplicate_hit) duplicateHits += 1;
    for (const field of feedback.modified_fields) incrementField(fields, field, feedback.candidate_id);
    if (decision.decision === 'reject') {
      const reason = normalizeReason(decision.rejection_reason ?? 'unspecified');
      incrementRejection(rejections, reason, feedback.candidate_id);
    }
    if (decision.modified_evidence && (
      decision.modified_evidence.topic_id !== candidate.suggested_evidence.topic_id
      || (decision.modified_evidence.branch_id ?? null) !== (candidate.suggested_evidence.branch_id ?? null)
    )) {
      incrementTopic(topics, {
        from_topic_id: candidate.suggested_evidence.topic_id,
        to_topic_id: decision.modified_evidence.topic_id,
        from_branch_id: candidate.suggested_evidence.branch_id ?? null,
        to_branch_id: decision.modified_evidence.branch_id ?? null,
      }, feedback.candidate_id);
    }
  }

  const previousIds = input.previous?.source_evaluation_ids ?? [];
  return {
    profile_id: `intake_learning_${input.generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}_${input.evaluation.evaluation_id}`,
    profile_version: 'v0.6.2',
    generated_at: input.generatedAt,
    source_evaluation_ids: [...new Set([...previousIds, input.evaluation.evaluation_id])],
    observed_session_count: (input.previous?.observed_session_count ?? 0) + 1,
    observed_candidate_count: (input.previous?.observed_candidate_count ?? 0) + input.session.candidates.length,
    field_corrections: sortSignals([...fields.values()]),
    topic_corrections: sortSignals([...topics.values()]),
    rejection_patterns: sortSignals([...rejections.values()]),
    split_count: splitCount,
    guardrail_incidents: {
      parent_branch_errors: parentBranchErrors,
      duplicate_hits: duplicateHits,
      trading_advice_attempts: input.previous?.guardrail_incidents.trading_advice_attempts ?? 0,
    },
    adaptation_mode: 'autonomous',
    auto_rule_mutation: true,
    auto_stage_change: true,
    auto_topic_activation: true,
  };
}

function incrementField(map: Map<string, IntakeLearningFieldSignal>, field: string, candidateId: string): void {
  const current = map.get(field) ?? { field, correction_count: 0, example_candidate_ids: [] };
  current.correction_count += 1;
  if (current.example_candidate_ids.length < 12) current.example_candidate_ids.push(candidateId);
  map.set(field, current);
}

function incrementRejection(map: Map<string, IntakeLearningRejectionSignal>, reason: string, candidateId: string): void {
  const current = map.get(reason) ?? { reason, count: 0, example_candidate_ids: [] };
  current.count += 1;
  if (current.example_candidate_ids.length < 12) current.example_candidate_ids.push(candidateId);
  map.set(reason, current);
}

function incrementTopic(map: Map<string, IntakeLearningTopicSignal>, change: Omit<IntakeLearningTopicSignal, 'count' | 'example_candidate_ids'>, candidateId: string): void {
  const key = JSON.stringify(change);
  const current = map.get(key) ?? { ...change, count: 0, example_candidate_ids: [] };
  current.count += 1;
  if (current.example_candidate_ids.length < 12) current.example_candidate_ids.push(candidateId);
  map.set(key, current);
}

function normalizeReason(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
}

function sortSignals<T extends { count?: number; correction_count?: number }>(values: T[]): T[] {
  return values.sort((a, b) => (b.count ?? b.correction_count ?? 0) - (a.count ?? a.correction_count ?? 0));
}
