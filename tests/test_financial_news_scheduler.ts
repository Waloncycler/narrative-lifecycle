import { describe, expect, it } from 'vitest';
import { ResearchAgentLoopUseCase } from '@/app/use_cases/research_agent_loop_use_case';

describe('financial news scheduler', () => {
  it('adds the governed financial-news pulse to a quick run without requesting publication', async () => {
    const requested: string[][] = [];
    let probeCalls = 0;
    const useCase = new ResearchAgentLoopUseCase({
      producerVersion: () => 'test', now: () => '2026-08-13T00:00:00.000Z',
      runResearchCampaign: async () => ({ campaign: { tasks: [], summary: { task_count: 0, source_target_count: 0, universe_seed_count: 0 } } as never, webResearch: { queries: [], lead_count: 0 } as never, directSourceResearch: { queries: [], lead_count: 0 } as never, directSourceSession: null, sourceRetrievalSession: null }),
      runSourceSync: async (input) => { requested.push(input.operationIds ?? []); return { report: { requested_operation_count: input.operationIds?.length ?? 0, completed_operation_count: 0, failed_operation_count: 0 }, session: { session_id: 'news' } } as never; },
      probePrioritizedNews: async () => { probeCalls += 1; return { selected_news_count: 1, verified_news_count: 0, session: null }; },
      runIntakeAgent: async () => ({ candidates: [], verification: {} as never, audit: {} as never } as never), runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: () => ({ report: { published_count: 0, held_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'weekly' } } as never),
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    });
    await useCase.execute({ loop_kind: 'quick', triggered_by: 'cli', publish_auto: false });
    expect(requested[0]).toEqual(expect.arrayContaining([
      'DirectSinaFinance', 'DirectWSJBusiness', 'DirectReutersBiz', 'DirectYicaiNews',
      'DirectBusinessWire', 'DirectGelonghui', 'DirectGovCnPolicy', 'DirectSseAnnouncements',
    ]));
    expect(requested[0]).not.toContain('DirectCailianTelegraph');
    expect(probeCalls).toBe(1);
  });
});
