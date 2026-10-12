import { describe, expect, it } from 'vitest';
import { ResearchAgentLoopUseCase } from '@/app/use_cases/research_agent_loop_use_case';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';

describe('ResearchAgentLoopUseCase external research', () => {
  it('records web discovery as context-only activity without treating it as a formal import', async () => {
    const result = await new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.test', now: () => '2026-08-03T00:00:00.000Z',
      runWebResearch: async () => ({ artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'v0.test', research_id: 'web_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', provider: 'mcp_bridge', providers: ['mcp_bridge'], queries: [{ query_id: 'q1', query: '脑机接口', topic_id: 'bci', purpose: 'evidence_discovery' }], lead_count: 2, leads: [], errors: [], guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } }),
      runSourceSync: async () => ({ report: { requested_operation_count: 0, completed_operation_count: 0, failed_operation_count: 0 }, session: null } as never),
      runIntakeAgent: async () => { throw new Error('not called'); }, runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: () => ({ report: { published_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'run_1' } } as unknown as AutonomousResearchRun),
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    }).execute({ loop_kind: 'quick' });
    expect(result.metrics).toMatchObject({ web_research_queries: 1, web_research_leads: 2, imported_evidence_count: 0 });
    expect(result.guardrail_check.no_auto_import).toBe(true);
  });

  it('uses a bounded source-aware campaign before the legacy generic search path', async () => {
    let genericSearchCalled = false;
    let requestedOperationIds: string[] | undefined;
    const result = await new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.test', now: () => '2026-08-03T00:00:00.000Z',
      runWebResearch: async () => {
        genericSearchCalled = true;
        throw new Error('campaign execution must not append generic topic queries');
      },
      runResearchCampaign: async () => ({
        campaign: { summary: { task_count: 6, source_target_count: 9, universe_seed_count: 3 }, tasks: [{ direct_operation_ids: ['DirectClinicalTrialsGovStudies'] }] },
        webResearch: {
          queries: [{ query_id: 'campaign_q1' }, { query_id: 'campaign_q2' }],
          lead_count: 1,
        },
        directSourceResearch: { queries: [], lead_count: 0 },
        directSourceSession: null,
        sourceRetrieval: null,
      }) as never,
      runSourceSync: async (input) => {
        requestedOperationIds = input.operationIds;
        return { report: { requested_operation_count: 0, completed_operation_count: 0, failed_operation_count: 0 }, session: null } as never;
      },
      runIntakeAgent: async () => { throw new Error('not called'); }, runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: () => ({ report: { published_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'run_1' } } as unknown as AutonomousResearchRun),
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    }).execute({ loop_kind: 'quick' });

    expect(genericSearchCalled).toBe(false);
    expect(requestedOperationIds).toEqual(expect.arrayContaining([
      'DirectClinicalTrialsGovStudies',
      'DirectSinaFinance',
      'DirectWSJBusiness',
    ]));
    expect(result.metrics).toMatchObject({
      research_campaign_tasks: 6,
      research_campaign_source_targets: 9,
      research_campaign_seed_topics: 3,
      web_research_queries: 2,
      web_research_leads: 1,
    });
    expect(result.guardrail_check.no_auto_import).toBe(true);
  });

  it('routes only a double-source historic recovery session through the same Agent and publication boundary', async () => {
    let agentCalled = false;
    let publishedRequested: boolean | undefined;
    const result = await new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.test', now: () => '2026-08-03T00:00:00.000Z',
      runSourceSync: async () => ({ report: { requested_operation_count: 0, completed_operation_count: 0, failed_operation_count: 0 }, session: null } as never),
      runHistoricalProvenanceRecovery: async () => ({ auto_intake_ready: 1, session: { session_id: 'history_session' } as never }),
      runIntakeAgent: async () => { agentCalled = true; return { candidates: [] } as never; }, runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: (_bundle, publish) => { publishedRequested = publish; return ({ report: { published_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'run_history' } } as unknown as AutonomousResearchRun); },
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    }).execute({ loop_kind: 'daily', publish_auto: true });
    expect(agentCalled).toBe(true);
    expect(publishedRequested).toBe(true);
    expect(result.phases.some((phase) => phase.detail.includes('historic original-source re-acquisition'))).toBe(true);
  });
});
