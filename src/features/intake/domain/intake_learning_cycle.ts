import type { EvidenceCandidate } from '@/features/intake/types/intake';
import type {
  ActiveLearningQueueItem,
  IntakeLearningCycle,
  LearningCycleInput,
  LearningPromotionGate,
  LearningProposal,
} from '@/features/intake/types/intake_learning_cycle';

const MIN_PATTERN_COUNT = 3;
const MIN_PROMOTION_SAMPLE = 50;

export function buildIntakeLearningCycle(input: LearningCycleInput): IntakeLearningCycle {
  const proposals = buildProposals(input);
  const queue = buildActiveLearningQueue(input);
  const promotionGates = buildPromotionGates(input);
  const promotionStatus = input.profile.observed_candidate_count < MIN_PROMOTION_SAMPLE
    ? 'insufficient_history'
    : promotionGates.every((gate) => gate.passed)
      ? 'auto_eligible'
      : 'blocked';

  return {
    cycle_id: `learning_cycle_${compactTimestamp(input.generatedAt)}_${input.evaluation.evaluation_id}`,
    cycle_version: 'v0.7.3',
    generated_at: input.generatedAt,
    profile_id: input.profile.profile_id,
    baseline_profile_id: input.previousProfile?.profile_id ?? null,
    source_evaluation_ids: input.profile.source_evaluation_ids,
    observed_session_count: input.profile.observed_session_count,
    observed_candidate_count: input.profile.observed_candidate_count,
    proposals,
    active_learning_queue: queue,
    promotion_gates: promotionGates,
    promotion_status: promotionStatus,
    rollback_profile_id: input.previousProfile?.profile_id ?? null,
    next_cycle_actions: nextActions(proposals, queue, promotionStatus),
    guardrail_check: {
      advisory_only: false,
      no_auto_rule_mutation: false,
      no_auto_stage_change: false,
      no_auto_topic_activation: false,
      no_auto_import: false,
      parent_branch_separation: true,
      no_trading_advice: true,
    },
  };
}

export function buildActiveLearningQueue(input: LearningCycleInput): ActiveLearningQueueItem[] {
  const resolutionByCandidate = new Map(
    (input.topicAudit?.resolutions ?? []).map((resolution) => [resolution.candidate_id, resolution]),
  );
  const comparisonByCandidate = new Map(
    (input.session.candidate_comparisons ?? []).map((comparison) => [comparison.candidate_id, comparison]),
  );
  const totalCorrections = input.profile.field_corrections.reduce((sum, item) => sum + item.correction_count, 0);
  const historicalErrorDensity = clamp01(totalCorrections / Math.max(1, input.profile.observed_candidate_count * 5));

  return input.session.candidates
    .map((candidate) => {
      const comparison = comparisonByCandidate.get(candidate.candidate_id);
      const resolution = resolutionByCandidate.get(candidate.candidate_id);
      const uncertainty = clamp01(
        (candidate.uncertainty_notes.length / 3)
        + (candidate.suggested_evidence.confidence === 'low' ? 0.5 : candidate.suggested_evidence.confidence === 'medium' ? 0.2 : 0),
      );
      const disagreement = comparison?.differs ? 1 : 0;
      const novelty = ['new_provisional_topic', 'unresolved', 'new_branch', 'reactivation'].includes(resolution?.status ?? '') ? 1 : 0;
      const stageImpactRisk = candidateRisk(candidate);
      const score = round100(100 * (
        0.3 * uncertainty
        + 0.25 * disagreement
        + 0.2 * historicalErrorDensity
        + 0.15 * novelty
        + 0.1 * stageImpactRisk
      ));
      const reasons = queueReasons({ uncertainty, disagreement, novelty, stageImpactRisk });
      const priorityBand: ActiveLearningQueueItem['priority_band'] =
        score >= 65 || stageImpactRisk === 1 ? 'high' : score >= 35 ? 'medium' : 'low';
      return {
        candidate_id: candidate.candidate_id,
        priority_score: score,
        priority_band: priorityBand,
        components: {
          uncertainty: round100(100 * uncertainty),
          rule_agent_disagreement: round100(100 * disagreement),
          historical_error_density: round100(100 * historicalErrorDensity),
          novelty: round100(100 * novelty),
          stage_impact_risk: round100(100 * stageImpactRisk),
        },
        reasons,
        required_action: 'review' as const,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score || a.candidate_id.localeCompare(b.candidate_id));
}

function buildProposals(input: LearningCycleInput): LearningProposal[] {
  const denominator = Math.max(1, input.profile.observed_candidate_count);
  const proposals: LearningProposal[] = [];

  for (const item of input.profile.field_corrections) {
    proposals.push(proposal(
      'field_guidance',
      item.field,
      item.correction_count,
      item.correction_count / denominator,
      `Operators repeatedly corrected ${item.field}; expose this as a review warning and prompt example.`,
      item.example_candidate_ids,
    ));
  }
  for (const item of input.profile.topic_corrections) {
    const target = `${item.from_topic_id ?? 'unresolved'}/${item.from_branch_id ?? 'parent'} -> ${item.to_topic_id ?? 'unresolved'}/${item.to_branch_id ?? 'parent'}`;
    proposals.push(proposal(
      'topic_mapping',
      target,
      item.count,
      item.count / denominator,
      'Repeated Topic/Branch corrections may indicate an alias or branch mapping gap. Registry changes still require explicit review.',
      item.example_candidate_ids,
    ));
  }
  for (const item of input.profile.rejection_patterns) {
    proposals.push(proposal(
      'rejection_pattern',
      item.reason,
      item.count,
      item.count / denominator,
      'Use this recurring rejection reason to warn reviewers and refine future candidate alternatives.',
      item.example_candidate_ids,
    ));
  }
  if (input.profile.guardrail_incidents.parent_branch_errors > 0) {
    proposals.push({
      ...proposal(
        'guardrail_warning',
        'parent_branch_separation',
        input.profile.guardrail_incidents.parent_branch_errors,
        input.profile.guardrail_incidents.parent_branch_errors / denominator,
        'Parent/Branch errors are hard blockers. Keep affected examples at the front of the review queue.',
        [],
      ),
      status: 'blocked',
    });
  }
  return proposals.sort((a, b) => b.observation_count - a.observation_count || a.proposal_id.localeCompare(b.proposal_id));
}

function proposal(
  kind: LearningProposal['kind'],
  target: string,
  count: number,
  rate: number,
  rationale: string,
  examples: string[],
): LearningProposal {
  return {
    proposal_id: `${kind}_${slug(target)}`,
    kind,
    target,
    observation_count: count,
    support_rate: round100(rate),
    status: count >= MIN_PATTERN_COUNT ? 'shadow_ready' : 'collecting',
    rationale,
    example_candidate_ids: examples.slice(0, 12),
    allowed_effect: 'auto_apply',
    requires_human_approval: false,
  };
}

function buildPromotionGates(input: LearningCycleInput): LearningPromotionGate[] {
  const report = input.shadowReport;
  const sample = input.profile.observed_candidate_count;
  const aiCount = Math.max(1, report?.ai_candidate_count ?? 0);
  const e3e4Rate = (report?.e3_e4_overstatement_count ?? 0) / aiCount;
  const citationAccuracy = report?.citation_accuracy ?? 0;
  const unsupportedRate = report?.unsupported_claim_rate ?? 1;
  const parentBranchRate = input.evaluation.parent_branch_error_rate;

  return [
    gate('reviewed_sample_size', sample, `>= ${MIN_PROMOTION_SAMPLE}`, sample >= MIN_PROMOTION_SAMPLE),
    gate('citation_accuracy', citationAccuracy, '>= 0.95', Boolean(report) && citationAccuracy >= 0.95),
    gate('unsupported_claim_rate', unsupportedRate, '<= 0.02', Boolean(report) && unsupportedRate <= 0.02),
    gate('parent_branch_error_rate', parentBranchRate, '<= 0.01', parentBranchRate <= 0.01),
    gate('e3_e4_overstatement_rate', round100(e3e4Rate), '<= 0.02', Boolean(report) && e3e4Rate <= 0.02),
    gate('no_trading_advice', report?.guardrail_check.no_trading_advice ? 'passed' : 'not_verified', 'passed', report?.guardrail_check.no_trading_advice === true),
  ];
}

function gate(metric: string, actual: number | string, threshold: string, passed: boolean): LearningPromotionGate {
  return { metric, actual, threshold, passed };
}

function candidateRisk(candidate: EvidenceCandidate): number {
  if (candidate.suggested_evidence.scope === 'branch') return 1;
  if (candidate.suggested_evidence.evidence_strength === 'E3' || candidate.suggested_evidence.evidence_strength === 'E4') return 1;
  return 0;
}

function queueReasons(input: { uncertainty: number; disagreement: number; novelty: number; stageImpactRisk: number }): string[] {
  const reasons: string[] = [];
  if (input.stageImpactRisk) reasons.push('Parent/Branch 或 E3/E4 误判会产生高影响，优先自动复核。');
  if (input.disagreement) reasons.push('Rule 与 Agent 字段存在分歧。');
  if (input.uncertainty >= 0.5) reasons.push('候选包含较高不确定性或低置信度。');
  if (input.novelty) reasons.push('涉及新主题、分支、再激活或 unresolved 映射。');
  if (!reasons.length) reasons.push('常规抽样，用于监测泛化与回归。');
  return reasons;
}

function nextActions(
  proposals: LearningProposal[],
  queue: ActiveLearningQueueItem[],
  status: IntakeLearningCycle['promotion_status'],
): string[] {
  const actions = [`优先处理 ${queue.filter((item) => item.priority_band === 'high').length} 个高风险候选。`];
  const shadowReady = proposals.filter((item) => item.status === 'shadow_ready').length;
  if (shadowReady) actions.push(`将 ${shadowReady} 个重复修正模式加入下一轮 Shadow 对照并自动应用。`);
  if (status === 'insufficient_history') actions.push(`继续收集样本，至少达到 ${MIN_PROMOTION_SAMPLE} 个候选后评估晋级。`);
  if (status === 'blocked') actions.push('修复未通过的质量或安全门槛，并在冻结回放集上重新验证。');
  if (status === 'auto_eligible') actions.push('指标达标，自动应用改进并更新 Registry 与规则。');
  return actions;
}

function compactTimestamp(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'signal';
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round100(value: number): number {
  return Math.round(value * 100) / 100;
}
