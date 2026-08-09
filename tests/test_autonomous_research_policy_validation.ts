import { describe, expect, it } from 'vitest';
import { buildAutonomousResearchPolicyAudit } from '@/features/research/domain/autonomous_research_policy_validation';
import type { AutonomousResearchPolicy } from '@/features/research/types/autonomous_research';

const policy: AutonomousResearchPolicy = {
  policy_id: 'review-first',
  enabled: true,
  auto_register_provisional_topics: true,
  auto_register_watch_branches: true,
  auto_promote_provisional_topics: true,
  auto_activate_watch_branches: true,
  minimum_independent_sources_for_topic_activation: 2,
  minimum_independent_sources_for_branch_activation: 2,
  require_parent_evidence_for_topic_activation: true,
  auto_publish_evidence: false,
  auto_recompute_stage: true,
  require_model_validation: true,
  allow_rule_verified_publication: false,
  minimum_evidence_strength: 'E2',
  minimum_confidence: 'medium',
  permitted_source_types: ['official', 'filing', 'research', 'academic', 'company'],
  allow_news_auto_publish: false,
  require_source_url: true,
  require_provenance: true,
  hold_parent_branch_risk: true,
  hold_conflicting_evidence: true,
  hold_stage_jump_above: 'S4',
};

describe('autonomous research policy validation', () => {
  it('accepts the review-first default while warning that graph changes remain held', () => {
    const audit = buildAutonomousResearchPolicyAudit({ policy, generatedAt: '2026-08-09T00:00:00.000Z', producerVersion: 'v0.test' });
    expect(audit).toMatchObject({ status: 'passed', automatic_publication_enabled: false, errors: [] });
    expect(audit.warnings.join(' ')).toContain('review-first');
    expect(audit.guardrail_check).toMatchObject({ parent_branch_separation: true, no_trading_advice: true });
  });

  it('rejects unsafe automatic publication settings before any Evidence can be written', () => {
    const audit = buildAutonomousResearchPolicyAudit({
      policy: {
        ...policy,
        auto_publish_evidence: true,
        minimum_evidence_strength: 'E1',
        minimum_confidence: 'low',
        require_provenance: false,
        require_source_url: false,
        require_model_validation: false,
        allow_news_auto_publish: true,
        permitted_source_types: [...policy.permitted_source_types, 'news'],
        hold_parent_branch_risk: false,
      },
      generatedAt: '2026-08-09T00:00:00.000Z',
      producerVersion: 'v0.test',
    });
    expect(audit.status).toBe('failed');
    expect(audit.errors.join(' ')).toMatch(/confidence|provenance|News|Parent/);
  });
});
