import { buildAutonomousResearchPolicyAudit } from '@/features/research/domain/autonomous_research_policy_validation';
import type { AutonomousResearchPolicy } from '@/features/research/types/autonomous_research';
import type { AutonomousResearchPolicyAudit } from '@/features/research/types/autonomous_research_policy_audit';

export interface ValidateAutonomousResearchPolicyUseCaseDeps {
  readPolicy(): AutonomousResearchPolicy;
  writeAudit(audit: AutonomousResearchPolicyAudit): void;
  validateAudit(audit: AutonomousResearchPolicyAudit): void;
  now(): string;
  producerVersion(): string;
}

export class ValidateAutonomousResearchPolicyUseCase {
  constructor(private readonly deps: ValidateAutonomousResearchPolicyUseCaseDeps) {}

  execute(): AutonomousResearchPolicyAudit {
    const audit = buildAutonomousResearchPolicyAudit({
      policy: this.deps.readPolicy(),
      generatedAt: this.deps.now(),
      producerVersion: this.deps.producerVersion(),
    });
    this.deps.validateAudit(audit);
    this.deps.writeAudit(audit);
    return audit;
  }
}
