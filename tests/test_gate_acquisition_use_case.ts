import { describe, expect, it, vi } from 'vitest';
import { RunGateAcquisitionUseCase } from '@/app/use_cases/run_gate_acquisition_use_case';

describe('RunGateAcquisitionUseCase', () => {
  it('includes empty active topics and keeps search leads context-only', async () => {
    const writeReport = vi.fn();
    const runSearch = vi.fn(async ({ plannedQueries }) => ({
      status: 'completed', providers: ['free', 'minimax'], lead_count: plannedQueries.length,
    }));
    const useCase = new RunGateAcquisitionUseCase({
      now: () => '2026-08-19T00:00:00.000Z',
      readRegistry: () => ({
        canonical_topics: [{ topic_id: 'empty_topic', topic_name: '空主题', current_stage: 'S0', status: 'active' }],
        aliases: [], branches: [], provisional_topics: [], memory_topic_ids: [],
      }),
      readOperationalEvidence: () => [],
      readSourceAtlas: () => ({ atlas_version: 'test', sources: [] }),
      readCompanyRegistry: () => ({ registry_version: 'test', companies: [] }),
      runSearch: runSearch as never,
      buildTriage: () => ({}) as never,
      retrieve: async () => ({ failed_count: 0, retrieved_count: 0, items: [] }) as never,
      appendIntake: () => null,
      runAgent: vi.fn() as never,
      publish: vi.fn() as never,
      writeReport,
    });

    const report = await useCase.execute({ maxTasks: 1, queriesPerTask: 1 });
    expect(report.selected_tasks[0]?.topic_id).toBe('empty_topic');
    expect(report.minimax_used).toBe(true);
    expect(report.guardrail_check.search_results_context_only).toBe(true);
    expect(report.source_coverage.atlas_source_count).toBe(0);
    expect(report.published_evidence_count).toBe(0);
    expect(writeReport).toHaveBeenCalledOnce();
  });
});
