import { buildOperationalResearchState, type OperationalResearchState } from '@/features/reporting/domain/operational_research_state';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { RunContext } from '@/platform/types/run_context';

export interface RecomputeAllTopicStagesUseCaseDeps {
  readRegistry(): TopicRegistry;
  readOperationalEvidence(): EvidenceNode[];
  persist(state: OperationalResearchState, context: RunContext): void;
  validate(state: OperationalResearchState): void;
}

/** Rebuilds every visible Topic and Branch from the formal Evidence Table.
 * Registry stages are outputs of this use case, never inputs to classification. */
export class RecomputeAllTopicStagesUseCase {
  constructor(private readonly deps: RecomputeAllTopicStagesUseCaseDeps) {}

  execute(context: RunContext): OperationalResearchState {
    const state = buildOperationalResearchState({
      registry: this.deps.readRegistry(),
      evidence: this.deps.readOperationalEvidence(),
      runId: context.run_id,
      generatedAt: context.started_at,
    });
    this.deps.validate(state);
    this.deps.persist(state, context);
    return state;
  }
}
