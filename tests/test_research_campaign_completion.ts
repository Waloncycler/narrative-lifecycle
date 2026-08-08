import { describe, expect, it } from 'vitest';
import { RunResearchCampaignUseCase } from '@/application/use_cases/run_research_campaign_use_case';

describe('research campaign completion loop', () => {
  it('creates lead triage and then a bounded context-only source package', async () => {
    const calls: string[] = [];
    const result = await new RunResearchCampaignUseCase({
      buildCampaign: () => ({ tasks: [], summary: { task_count: 0 } } as never),
      runWebResearch: async () => ({ status: 'completed' } as never),
      runDirectSourceResearch: async () => ({ status: 'completed' } as never),
      prepareDirectSourceIntake: () => null,
      buildLeadTriage: () => { calls.push('triage'); return { triage_id: 'triage_1' } as never; },
      retrieveSources: async () => { calls.push('retrieve'); return { retrieved_count: 2, failed_count: 0, guardrail_check: { no_auto_evidence_import: true, parent_branch_separation: true } } as never; },
    }).execute({ maxTasks: 6, maxQueries: 2 });
    expect(calls).toEqual(['triage', 'retrieve']);
    expect(result.sourceRetrieval).toMatchObject({ retrieved_count: 2, failed_count: 0, guardrail_check: { no_auto_evidence_import: true } });
  });
});
