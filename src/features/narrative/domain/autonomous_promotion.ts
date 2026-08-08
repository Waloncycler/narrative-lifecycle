import { evidenceStrengthRank, type EvidenceNode } from '@/features/evidence/domain/evidence';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { AgentEvidenceCandidate, IntakeAgentAudit } from '@/features/intake/types/intake_agent';
import type { TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type {
  AutonomousPromotionItem,
  AutonomousResearchPolicy,
} from '@/features/research/types/autonomous_research';

const confidenceRank = { low: 1, medium: 2, high: 3 } as const;
const disallowedText = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;
const resolvableStatuses = new Set([
  'existing_topic',
  'alias_of',
  'new_branch',
  'reactivation',
  'new_provisional_topic',
]);

export interface AutonomousPromotionEvaluation {
  items: AutonomousPromotionItem[];
  drafts: EvidenceCandidate['suggested_evidence'][];
}

/**
 * Decides whether a model-enriched candidate can enter the operational
 * Evidence Table. This is deliberately deterministic: the Agent proposes
 * facts, while publication depends only on policy and verifiable fields.
 */
export function evaluateAutonomousPromotion(input: {
  session: EvidenceIntakeSession;
  topicAudit: TopicResolutionAudit | null;
  agentCandidates: AgentEvidenceCandidate[];
  agentAudit: IntakeAgentAudit | null;
  existingEvidence: EvidenceNode[];
  policy: AutonomousResearchPolicy;
}): AutonomousPromotionEvaluation {
  const resolutionByCandidate = new Map(input.topicAudit?.resolutions.map((item) => [item.candidate_id, item]) ?? []);
  const agentBySource = new Map(input.agentCandidates.map((item) => [item.source_candidate_id, item]));
  const existingIds = new Set(input.existingEvidence.map((item) => item.evidence_id));
  const items: AutonomousPromotionItem[] = [];
  const drafts: EvidenceCandidate['suggested_evidence'][] = [];

  for (const candidate of input.session.candidates) {
    const draft = candidate.suggested_evidence;
    const resolution = resolutionByCandidate.get(candidate.candidate_id);
    const agent = agentBySource.get(candidate.candidate_id);
    const reasons: string[] = [];
    // Resolver audit, not the raw candidate, is the only source of truth for
    // the formal Topic/Branch identity. Rule drafts legitimately start as
    // unknown_topic and must not lose a later model/resolver mapping here.
    const topicId = resolution?.resolved_topic_id ?? resolution?.provisional_topic_id ?? (draft.topic_id === 'unknown_topic' ? null : draft.topic_id);
    const branchId = resolution?.resolved_branch_id ?? draft.branch_id ?? null;
    const resolvedDraft = {
      ...draft,
      topic_id: topicId ?? draft.topic_id,
      branch_id: branchId,
      scope: branchId ? 'branch' as const : draft.scope,
    };

    if (!input.policy.enabled || !input.policy.auto_publish_evidence) reasons.push('autonomous publication is disabled by policy');
    if (!resolution || !resolvableStatuses.has(resolution.status)) reasons.push('Topic Resolver did not produce a publishable Topic or Branch mapping');
    if (!topicId || topicId === 'unknown_topic') reasons.push('unknown Topic cannot enter the Evidence Table');
    if (candidate.duplicate_of_evidence_id || existingIds.has(resolvedDraft.evidence_id)) reasons.push('duplicate Evidence ID is already present');
    const modelValidated = (input.agentAudit?.status === 'passed' || input.agentCandidates.length > 0)
      && (agent?.validation_status === 'passed' || candidate.publication_eligibility === 'rule_verified');
    const ruleVerified = candidate.publication_eligibility === 'rule_verified'
      && candidate.guardrail_check.provenance_present
      && (resolvedDraft.source_type !== 'news' || input.policy.allow_news_auto_publish);
    if (input.policy.require_model_validation && !modelValidated && !(input.policy.allow_rule_verified_publication && ruleVerified)) {
      reasons.push('model validation did not pass; fallback candidates cannot auto-publish');
    }
    if (input.policy.require_provenance && !input.session.provenance_records.some((item) => item.provenance_id === candidate.provenance_id && item.quote.trim().length > 0)) {
      reasons.push('verifiable source provenance is required');
    }
    if (input.policy.require_source_url && !resolvedDraft.source_url) reasons.push('source_url is required');
    if (!input.policy.permitted_source_types.includes(resolvedDraft.source_type)) reasons.push(`source type ${resolvedDraft.source_type} is not permitted by policy`);
    if (!input.policy.allow_news_auto_publish && resolvedDraft.source_type === 'news') reasons.push('news evidence requires corroboration before auto-publication');
    if (evidenceStrengthRank[resolvedDraft.evidence_strength] < evidenceStrengthRank[input.policy.minimum_evidence_strength]) reasons.push(`evidence strength ${resolvedDraft.evidence_strength} is below policy minimum ${input.policy.minimum_evidence_strength}`);
    if (confidenceRank[resolvedDraft.confidence] < confidenceRank[input.policy.minimum_confidence]) reasons.push(`confidence ${resolvedDraft.confidence} is below policy minimum ${input.policy.minimum_confidence}`);
    if (resolvedDraft.scope === 'branch' && !resolvedDraft.branch_id) reasons.push('branch evidence requires branch_id');
    if (input.policy.hold_parent_branch_risk && resolvedDraft.scope === 'parent' && /branch-only|branch evidence cannot upgrade/i.test(`${resolvedDraft.event_title} ${resolvedDraft.event_summary} ${resolvedDraft.interpretation} ${resolvedDraft.limitation}`)) {
      reasons.push('parent/branch risk requires review');
    }
    if (input.policy.hold_conflicting_evidence && (resolvedDraft.polarity === 'mixed' || resolvedDraft.stage_effect === 'downgrade')) reasons.push('conflicting or negative evidence requires review');
    if (disallowedText.test(JSON.stringify(resolvedDraft))) reasons.push('trading advice is prohibited');

    const decision = reasons.length ? (!topicId || resolution?.status === 'unresolved' ? 'rejected' : 'held') : 'published';
    items.push({
      candidate_id: candidate.candidate_id,
      evidence_id: resolvedDraft.evidence_id,
      topic_id: topicId,
      branch_id: branchId,
      scope: resolvedDraft.scope,
      decision,
      reasons,
    });
    if (decision === 'published') {
      drafts.push({
        ...resolvedDraft,
        limitation: `${resolvedDraft.limitation} Automatically published under policy ${input.policy.policy_id}; deterministic Stage Gate remains authoritative.`,
      });
    }
  }
  return { items, drafts };
}
