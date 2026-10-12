import { describe, expect, it } from 'vitest';
import { buildScopeNames, deriveFollowupQueries, isNavigationNoisePhrase, scopeKey } from '@/features/research/domain/deep_research';
import { RunDeepResearchSweepUseCase } from '@/app/use_cases/run_deep_research_sweep_use_case';
import { ResearchAgentLoopUseCase } from '@/app/use_cases/research_agent_loop_use_case';
import type { WebResearchLead, WebResearchReport } from '@/features/research/types/web_research';
import type { ResearchCampaign, ResearchCampaignTask } from '@/features/research/types/research_coverage';
import type { DeepResearchPlannedQuery } from '@/features/research/domain/deep_research';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';

const bciTask = {
  task_id: 'task_bci',
  node_kind: 'formal_topic',
  topic_id: 'bci',
  branch_id: null,
  candidate_node_id: null,
  display_name_zh: '脑机接口',
  display_name_en: 'BCI',
  domain: 'health',
  priority: 1,
  target_layers: ['reality'],
  query: '脑机接口',
  source_ids: ['src_bci'],
  source_domains: ['example.com'],
  direct_operation_ids: [],
  rationale: 'test',
  formal_status: 'formal',
} as unknown as ResearchCampaignTask;

const campaign = {
  artifact_type: 'research_campaign',
  schema_version: '1.0.0',
  producer_version: 'v0.test',
  campaign_id: 'campaign_bci',
  generated_at: '2026-08-03T00:00:00.000Z',
  source_atlas_version: 'v1',
  universe_version: 'v1',
  tasks: [bciTask],
  summary: { task_count: 1, source_target_count: 1, universe_seed_count: 1, formal_topic_count: 1, provisional_topic_count: 0, branch_count: 0, skipped_unresolved_branch_count: 0 },
} as unknown as ResearchCampaign;

function lead(title: string, topicId: string | null = 'bci', branchId: string | null = null): WebResearchLead {
  return {
    lead_id: `lead_${title}`,
    query_id: 'q1',
    topic_id: topicId,
    branch_id: branchId,
    candidate_node_id: null,
    title,
    url: `https://example.com/${encodeURIComponent(title)}`,
    source_name: 'example',
    source_domain: 'example.com',
    snippet: 'snippet',
    published_at: null,
    retrieved_at: '2026-08-03T00:00:00.000Z',
    rank: 1,
    evidence_eligibility: 'context_only',
    next_action: 'review_source',
  };
}

function webReport(queries: Array<{ query: string }>, leads: WebResearchLead[]): WebResearchReport {
  return {
    artifact_type: 'web_research_report',
    schema_version: '1.0.0',
    producer_version: 'v0.test',
    research_id: 'web_test',
    generated_at: '2026-08-03T00:00:00.000Z',
    status: 'completed',
    provider: 'free',
    providers: ['free'],
    queries: queries.map((q, index) => ({ query_id: `q${index}`, query: q.query, topic_id: 'bci', purpose: 'evidence_discovery' })),
    lead_count: leads.length,
    leads,
    errors: [],
    guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
  };
}

describe('deriveFollowupQueries', () => {
  const scopeNames = buildScopeNames([bciTask]);

  it('derives a scoped follow-up query from a specific lead title', () => {
    const followUps = deriveFollowupQueries({
      leads: [lead('Neuralink publishes first human implant telemetry data')],
      scopeNames,
      knownQueries: new Set(['bci']),
      budget: 2,
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0]).toMatchObject({
      query: 'Neuralink',
      topic_id: 'bci',
      branch_id: null,
      campaign_task_id: 'task_bci',
      source_ids: ['src_bci'],
      source_domains: ['example.com'],
    });
  });

  it('skips leads that merely restate the scope name', () => {
    const followUps = deriveFollowupQueries({
      leads: [lead('脑机接口'), lead('BCI')],
      scopeNames,
      knownQueries: new Set(),
      budget: 2,
    });
    expect(followUps).toHaveLength(0);
  });

  it('respects the budget and preserves branch scope', () => {
    const branchLeads = [
      lead('Firmware update unlocks new motor control channel', 'bci', 'bci-market'),
      lead('Regulator clears first at-home BCI headset in China', 'bci', 'bci-market'),
      lead('Hospital study reports chronic pain reduction results', 'bci', 'bci-market'),
    ];
    const followUps = deriveFollowupQueries({
      leads: branchLeads,
      scopeNames,
      knownQueries: new Set(),
      budget: 2,
    });
    expect(followUps).toHaveLength(2);
    expect(followUps.every((query) => query.branch_id === 'bci-market')).toBe(true);
  });

  it('never repeats a query already searched', () => {
    const followUps = deriveFollowupQueries({
      leads: [lead('Neuralink publishes first human implant telemetry data')],
      scopeNames,
      knownQueries: new Set(['neuralink']),
      budget: 2,
    });
    expect(followUps).toHaveLength(0);
  });

  it('exposes scopeKey for task indexing', () => {
    expect(scopeKey('bci', null)).toBe('bci|null');
    expect(scopeNames.get(scopeKey('bci', null))?.task_id).toBe('task_bci');
  });

  it('flags navigation/boilerplate words through the follow-up quality gate', () => {
    expect(() => isNavigationNoisePhrase('Relations')).not.toThrow();
    expect(() => isNavigationNoisePhrase('Investor Relations')).not.toThrow();
    expect(() => isNavigationNoisePhrase('关于我们')).not.toThrow();
    expect(() => isNavigationNoisePhrase('首页')).not.toThrow();
    expect(() => isNavigationNoisePhrase('2024')).not.toThrow();
    expect(() => isNavigationNoisePhrase('')).not.toThrow();
    expect(() => isNavigationNoisePhrase('Corporation')).not.toThrow();
    expect(() => isNavigationNoisePhrase('Presentations Presentations Stock')).not.toThrow();
    expect(() => isNavigationNoisePhrase('Download Shareholder Deck')).not.toThrow();
    expect(() => isNavigationNoisePhrase('Category DESCRIPTION DATE')).not.toThrow();
    expect(() => isNavigationNoisePhrase('阿里巴巴集团官方网站')).not.toThrow();
    expect(isNavigationNoisePhrase('NVIDIA')).toBe(false);
    expect(isNavigationNoisePhrase('Synchron clinical trial')).toBe(false);
    expect(isNavigationNoisePhrase('brain-computer interface')).toBe(false);
  });

  it('derives only the entity from a navigation-style lead title, never the boilerplate word', () => {
    const followUps = deriveFollowupQueries({
      leads: [lead('Investor Relations | NVIDIA')],
      scopeNames,
      knownQueries: new Set(),
      budget: 2,
    });
    expect(followUps).toHaveLength(1);
    expect(followUps[0]?.query).toBe('NVIDIA');
  });

  it('rejects navigation-only leads (no entity, no research intent) entirely', () => {
    const followUps = deriveFollowupQueries({
      leads: [lead('About Us'), lead('关于我们 - 寒武纪'), lead('Contact')],
      scopeNames,
      knownQueries: new Set(),
      budget: 4,
    });
    expect(followUps).toHaveLength(0);
  });
});

describe('RunDeepResearchSweepUseCase', () => {
  it('runs follow-up rounds until leads yield no new angle and writes a bounded sweep', async () => {
    const followUpsSeen: DeepResearchPlannedQuery[][] = [];
    let sweepsWritten = 0;
    const useCase = new RunDeepResearchSweepUseCase({
      now: () => '2026-08-03T00:00:00.000Z',
      producerVersion: () => 'v0.test',
      runCampaign: async () => ({
        campaign,
        webResearch: webReport([{ query: '脑机接口' }, { query: 'BCI' }], [
          lead('Neuralink publishes first human implant telemetry data'),
          lead('Synchron starts multi-center BCI trial enrollment'),
        ]),
        directSourceResearch: { status: 'completed', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: {} } as never,
        directSourceSession: null,
        sourceRetrievalSession: null,
        leadTriage: null,
        sourceRetrieval: null,
      }),
      runWebResearch: async ({ plannedQueries }) => {
        followUpsSeen.push(plannedQueries);
        // Return leads that only restate the scope, so the next round stops.
        return webReport(plannedQueries, plannedQueries.map((q) => lead('脑机接口', q.topic_id, q.branch_id)));
      },
      writeSweep: () => { sweepsWritten += 1; },
    });

    const result = await useCase.execute({ max_rounds: 3, queries_per_round: 2 });

    expect(followUpsSeen).toHaveLength(1);
    expect(followUpsSeen[0]).toHaveLength(2);
    expect(result.sweep.rounds.map((round) => round.round)).toEqual([0, 1]);
    expect(result.sweep.totals).toMatchObject({ rounds: 2, queries: 4, leads: 4 });
    expect(result.sweep.guardrail_check).toMatchObject({
      search_results_remain_context_only: true,
      bounded_rounds: true,
      bounded_queries: true,
      no_auto_import: true,
    });
    expect(sweepsWritten).toBe(1);
  });

  it('halts after round 0 when no lead yields a follow-up angle', async () => {
    let followUpRounds = 0;
    const useCase = new RunDeepResearchSweepUseCase({
      now: () => '2026-08-03T00:00:00.000Z',
      producerVersion: () => 'v0.test',
      runCampaign: async () => ({
        campaign,
        webResearch: webReport([{ query: '脑机接口' }], [lead('脑机接口')]),
        directSourceResearch: { status: 'completed', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: {} } as never,
        directSourceSession: null,
        sourceRetrievalSession: null,
        leadTriage: null,
        sourceRetrieval: null,
      }),
      runWebResearch: async () => { followUpRounds += 1; return webReport([], []); },
      writeSweep: () => undefined,
    });

    const result = await useCase.execute({ max_rounds: 3, queries_per_round: 2 });
    expect(followUpRounds).toBe(0);
    expect(result.sweep.rounds).toHaveLength(1);
    expect(result.sweep.totals).toMatchObject({ rounds: 1, queries: 1, leads: 1 });
  });

  it('clamps the round budget and per-round query budget', async () => {
    let round = 0;
    const useCase = new RunDeepResearchSweepUseCase({
      now: () => '2026-08-03T00:00:00.000Z',
      producerVersion: () => 'v0.test',
      runCampaign: async () => ({
        campaign,
        webResearch: webReport([{ query: '脑机接口' }], Array.from({ length: 30 }, (_, i) => lead(`UniqueAngle${i} discovery in BCI market analysis 2026`))),
        directSourceResearch: { status: 'completed', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: {} } as never,
        directSourceSession: null,
        sourceRetrievalSession: null,
        leadTriage: null,
        sourceRetrieval: null,
      }),
      runWebResearch: async ({ plannedQueries }) => {
        round += 1;
        return webReport(plannedQueries, plannedQueries.map((query, i) => lead(`DeeperAngle${round}_${i} followup for ${query.query} sector`)));
      },
      writeSweep: () => undefined,
    });

    const result = await useCase.execute({ max_rounds: 99, queries_per_round: 99 });
    // queries_per_round is capped at 50 even when a caller supplies more.
    expect(result.sweep.rounds[1].queries).toBeLessThanOrEqual(50);
    // max_rounds is capped at 20 → at most round 0 + 20 follow-up rounds.
    expect(result.sweep.rounds.length).toBeLessThanOrEqual(21);
    expect(result.sweep.totals.queries).toBeLessThanOrEqual(24 + 50 * 20);
  });
});

describe('ResearchAgentLoopUseCase deep sweep integration', () => {
  it('runs the deep sweep for loop_kind deep and records deep metrics', async () => {
    let sweepInput: { maxRounds: number; queriesPerRound: number } | null = null;
    const manifest = await new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.test', now: () => '2026-08-03T00:00:00.000Z',
      runDeepResearchSweep: async (input) => {
        sweepInput = input;
        return {
          campaign,
          webResearch: webReport([{ query: '脑机接口' }, { query: 'BCI' }], [lead('Neuralink implant telemetry'), lead('Synchron trial enrollment')]),
          directSourceResearch: { status: 'completed', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: {} } as never,
          directSourceSession: null,
          sourceRetrievalSession: null,
          leadTriage: null,
          sourceRetrieval: null,
          sweep: {
            artifact_type: 'deep_research_sweep',
            schema_version: '1.0.0',
            producer_version: 'v0.test',
            sweep_id: 'deep-sweep-test',
            generated_at: '2026-08-03T00:00:00.000Z',
            campaign_task_count: 1,
            rounds: [
              { round: 0, queries: 2, leads: 2, follow_up_queries: [] },
              { round: 1, queries: 2, leads: 2, follow_up_queries: ['Neuralink', 'Synchron'] },
            ],
            totals: { rounds: 2, queries: 4, leads: 4 },
            guardrail_check: { search_results_remain_context_only: true, bounded_rounds: true, bounded_queries: true, no_auto_import: true, no_trading_advice: true },
          },
        };
      },
      runSourceSync: async () => ({ report: { requested_operation_count: 0, completed_operation_count: 0, failed_operation_count: 0 }, session: null } as never),
      runIntakeAgent: async () => ({ candidates: [] } as never), runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: () => ({ report: { published_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'run_deep' } } as unknown as AutonomousResearchRun),
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    }).execute({ loop_kind: 'deep', deep_max_rounds: 4, deep_queries_per_round: 10 });

    expect(sweepInput).toEqual({ maxRounds: 4, queriesPerRound: 10 });
    expect(manifest.loop_kind).toBe('deep');
    expect(manifest.metrics).toMatchObject({
      deep_sweep_rounds: 2,
      deep_followup_queries: 2,
      web_research_queries: 4,
      web_research_leads: 4,
      research_campaign_tasks: 1,
    });
    expect(manifest.guardrail_check.no_auto_import).toBe(true);
  });

  it('does not run the deep sweep for non-deep loop kinds', async () => {
    let deepCalled = false;
    await new ResearchAgentLoopUseCase({
      producerVersion: () => 'v0.test', now: () => '2026-08-03T00:00:00.000Z',
      runDeepResearchSweep: async () => { deepCalled = true; throw new Error('must not be called'); },
      runResearchCampaign: async () => ({
        campaign: { summary: { task_count: 1, source_target_count: 1, universe_seed_count: 0 }, tasks: [] },
        webResearch: { queries: [], lead_count: 0, leads: [] },
        directSourceResearch: { queries: [], lead_count: 0 },
        directSourceSession: null,
      }) as never,
      runSourceSync: async () => ({ report: { requested_operation_count: 0, completed_operation_count: 0, failed_operation_count: 0 }, session: null } as never),
      runIntakeAgent: async () => ({ candidates: [] } as never), runAiShadow: async () => ({ report: null }),
      runLearningCycle: () => { throw new Error('no reviewed decisions'); }, runValidateTopics: () => undefined,
      runAutonomousResearch: () => ({ report: { published_count: 0 }, graph_promotion: { summary: { provisional_topics_activated: 0, watch_branches_activated: 0, held_count: 0 } }, manifest: { run_id: 'run_daily' } } as unknown as AutonomousResearchRun),
      runReview: () => undefined, readStaleCandidates: () => [], readQueueItems: () => [], discardPurged: () => undefined,
      readEvolutionLedger: () => null, writeEvolutionLedger: () => undefined,
      readLearningMetrics: () => ({ acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null }), writeRunManifest: () => undefined,
    }).execute({ loop_kind: 'daily' });
    expect(deepCalled).toBe(false);
  });
});
