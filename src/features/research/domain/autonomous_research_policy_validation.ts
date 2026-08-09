import type { AutonomousResearchPolicy } from '@/features/research/types/autonomous_research';
import type { AutonomousResearchPolicyAudit, AutonomousResearchPolicyAuditInput } from '@/features/research/types/autonomous_research_policy_audit';

const strengthRank = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4 } as const;
const confidenceRank = { low: 0, medium: 1, high: 2 } as const;

export function buildAutonomousResearchPolicyAudit(input: AutonomousResearchPolicyAuditInput): AutonomousResearchPolicyAudit {
  const { policy } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!policy.policy_id.trim()) errors.push('policy_id is required.');
  if (policy.minimum_independent_sources_for_topic_activation < 1) errors.push('Topic activation requires at least one independent source.');
  if (policy.minimum_independent_sources_for_branch_activation < 1) errors.push('Branch activation requires at least one independent source.');
  if (policy.auto_publish_evidence) {
    if (!policy.enabled) errors.push('Automatic publication cannot be enabled while the policy is disabled.');
    if (strengthRank[policy.minimum_evidence_strength] < strengthRank.E2) errors.push('Automatic publication requires minimum Evidence strength E2 or higher.');
    if (confidenceRank[policy.minimum_confidence] < confidenceRank.medium) errors.push('Automatic publication requires medium or high minimum confidence.');
    if (!policy.require_source_url || !policy.require_provenance) errors.push('Automatic publication requires source URL and provenance.');
    if (!policy.require_model_validation) errors.push('Automatic publication requires model validation.');
    if (!policy.hold_parent_branch_risk || !policy.hold_conflicting_evidence) errors.push('Automatic publication requires Parent/Branch and conflicting-evidence holds.');
    if (policy.allow_news_auto_publish || policy.permitted_source_types.includes('news')) errors.push('News sources cannot be automatically published.');
  }
  if (!policy.auto_publish_evidence && (policy.auto_promote_provisional_topics || policy.auto_activate_watch_branches)) {
    warnings.push('Graph promotion settings exist, but review-first execution will hold graph changes until controlled publication is explicitly enabled.');
  }
  if (!policy.require_parent_evidence_for_topic_activation) warnings.push('Provisional Topic activation does not require parent evidence; review this setting carefully.');

  return {
    artifact_type: 'autonomous_research_policy_audit',
    schema_version: '1.0.0',
    producer_version: input.producerVersion,
    generated_at: input.generatedAt,
    policy_id: policy.policy_id,
    status: errors.length ? 'failed' : 'passed',
    automatic_publication_enabled: policy.auto_publish_evidence,
    errors,
    warnings,
    guardrail_check: {
      explicit_policy_required: true,
      evidence_table_required_for_stage: true,
      parent_branch_separation: true,
      no_trading_advice: true,
    },
  };
}
