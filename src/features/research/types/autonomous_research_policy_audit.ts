import type { AutonomousResearchPolicy } from '@/features/research/types/autonomous_research';

export interface AutonomousResearchPolicyAudit {
  artifact_type: 'autonomous_research_policy_audit';
  schema_version: '1.0.0';
  producer_version: string;
  generated_at: string;
  policy_id: string;
  status: 'passed' | 'failed';
  automatic_publication_enabled: boolean;
  errors: string[];
  warnings: string[];
  guardrail_check: {
    explicit_policy_required: true;
    evidence_table_required_for_stage: true;
    parent_branch_separation: true;
    no_trading_advice: true;
  };
}

export type AutonomousResearchPolicyAuditInput = {
  policy: AutonomousResearchPolicy;
  generatedAt: string;
  producerVersion: string;
};
