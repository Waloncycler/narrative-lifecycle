import { describe, expect, it } from 'vitest';
import { ResearchAgentLoopUseCase } from '@/app/use_cases/research_agent_loop_use_case';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';

const graphRun = {
  report: { published_count: 2 },
  graph_promotion: {
    summary: { provisional_topics_activated: 1, watch_branches_activated: 1, held_count: 2 },
  },
  manifest: { run_id: 'run_graph' },
} as unknown as AutonomousResearchRun;

describe('ResearchAgentLoopUseCase autonomous graph flow', () => {
  it('reports automatic Topic/Branch activation while preserving review holds', async () => {
    const manifests: unknown[] = [];
    const useCase = new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.11.0',
      now: () => '2026-08-03T00:00:00.000Z',
      runSourceSync: async () => ({ report: { requested_operation_count: 3, completed_operation_count: 3, failed_operation_count: 0 }, session: null } as never),
      runIntakeAgent: async () => { throw new Error('not called without new facts'); },
      runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); },
      runValidateTopics: () => undefined,
      runAutonomousResearch: () => graphRun,
      runReview: () => undefined,
      readStaleCandidates: () => [],
      readQueueItems: () => [],
      discardPurged: () => undefined,
      readEvolutionLedger: () => null,
      writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }),
      writeRunManifest: (manifest) => { manifests.push(manifest); },
    });

    const manifest = await useCase.execute();
    expect(manifest.status).toBe('completed');
    expect(manifest.metrics).toMatchObject({
      imported_evidence_count: 2,
      provisional_topics_activated: 1,
      watch_branches_activated: 1,
      graph_nodes_held: 2,
    });
    expect(manifest.guardrail_check).toMatchObject({
      no_auto_import: false,
      no_auto_topic_activation: false,
      human_review_required: true,
      no_auto_rule_mutation: true,
      no_trading_advice: true,
    });
    expect(manifests).toHaveLength(1);
  });
});
