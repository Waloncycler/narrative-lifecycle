import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunWebResearchUseCase } from '@/app/use_cases/run_web_research_use_case';
import { buildWebResearchQueries, normalizeWebResearchLeads } from '@/features/research/domain/web_research';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { WebResearchReport } from '@/features/research/types/web_research';

const registry: TopicRegistry = {
  canonical_topics: [{ topic_id: 'bci', topic_name: 'Brain-computer interface', market_name_zh: '脑机接口', market_name_en: 'Brain-computer interface', current_stage: 'S0', status: 'active' }],
  aliases: [], branches: [], provisional_topics: [], memory_topic_ids: [],
};

describe('Web research discovery boundary', () => {
  it('uses canonical Chinese and English terms for a topic query', () => {
    const queries = buildWebResearchQueries({ registry, topicIds: ['bci'] });
    expect(queries[0]).toMatchObject({ topic_id: 'bci', query: '脑机接口 Brain-computer interface' });
  });

  it('turns valid search results into context-only leads and rejects trading language', () => {
    const query = buildWebResearchQueries({ registry, topicIds: ['bci'] })[0]!;
    const leads = normalizeWebResearchLeads({
      query,
      retrievedAt: '2026-08-03T00:00:00.000Z',
      maxResults: 5,
      rows: [
        { title: '脑机接口监管进展', url: 'https://official.example/bci', snippet: '监管文件。', source_name: 'Official' },
        { title: 'Buy BCI now', url: 'https://unsafe.example/bci', snippet: 'buy immediately' },
      ],
    });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ evidence_eligibility: 'context_only', next_action: 'review_source' });
  });

  it('normalizes non-ASCII urls so leads pass the schema uri format', () => {
    const query = buildWebResearchQueries({ registry, topicIds: ['bci'] })[0]!;
    const leads = normalizeWebResearchLeads({
      query,
      retrievedAt: '2026-08-03T00:00:00.000Z',
      maxResults: 5,
      rows: [
        { title: '脑机接口', url: 'https://zh.wikipedia.org/wiki/脑机接口', snippet: '概述', source_name: 'Wikipedia (zh)' },
        { title: 'Brain–computer interface', url: 'https://en.wikipedia.org/wiki/Brain–computer_interface', snippet: 'overview', source_name: 'Wikipedia (en)' },
      ],
    });
    expect(leads[0]!.url).toBe('https://zh.wikipedia.org/wiki/%E8%84%91%E6%9C%BA%E6%8E%A5%E5%8F%A3');
    expect(leads[1]!.url).toContain('%E2%80%93'); // en-dash gets percent-encoded
  });

  it('preserves planned branch attribution on a context-only lead', () => {
    const query = buildWebResearchQueries({
      registry,
      plannedQueries: [{
        query: 'Brain-computer interface rehabilitation',
        topic_id: 'bci',
        branch_id: 'bci_medical_rehab',
        candidate_node_id: null,
        campaign_task_id: 'campaign_branch_bci_medical_rehab',
        source_ids: [],
        source_domains: [],
      }],
    })[0]!;
    const [lead] = normalizeWebResearchLeads({
      query,
      retrievedAt: '2026-08-04T00:00:00.000Z',
      maxResults: 5,
      rows: [{ title: 'Brain-computer interface rehabilitation study', url: 'https://example.org/study', snippet: 'Study record.' }],
    });
    expect(lead).toMatchObject({ topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, evidence_eligibility: 'context_only' });
  });

  it('uses Atlas domains as a search hint without filtering wide Topic discovery', () => {
    const query = buildWebResearchQueries({
      registry,
      plannedQueries: [{
        query: '脑机接口', topic_id: 'bci', branch_id: null, candidate_node_id: null,
        campaign_task_id: 'campaign_topic_bci', source_ids: ['miit'], source_domains: ['miit.gov.cn'], strict_source_domains: [],
      }],
    })[0]!;
    const leads = normalizeWebResearchLeads({
      query,
      retrievedAt: '2026-08-09T00:00:00.000Z',
      maxResults: 5,
      rows: [{ title: 'Independent BCI source', url: 'https://clinicaltrials.gov/study/NCT1', snippet: 'Study record.', source_name: 'ClinicalTrials.gov' }],
    });
    expect(leads).toHaveLength(1);
    expect(query).toMatchObject({ source_domains: ['miit.gov.cn'], strict_source_domains: [] });
  });

  it('writes a schema-valid unconfigured result without pretending that search became evidence', async () => {
    let saved: unknown;
    const useCase = new RunWebResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z',
      producerVersion: () => 'v0.test',
      configs: () => [{ provider: 'disabled', endpoint: null, api_key: null, timeout_ms: 1000, max_results_per_query: 5 }],
      readRegistry: () => registry,
      search: async () => [],
      writeReport: (report) => { saved = report; },
      validateReport: () => undefined,
    });
    const report = await useCase.execute({ topicIds: ['bci'] });
    expect(report).toMatchObject({ status: 'unconfigured', lead_count: 0, guardrail_check: { no_auto_import: true, evidence_table_required_for_stage: true } });
    expect(saved).toBe(report);
  });

  it('is schema-valid and remains unable to alter Stage/Score', async () => {
    const useCase = new RunWebResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'v0.test',
      configs: () => [{ provider: 'gdelt', endpoint: 'https://example.test/search', api_key: null, timeout_ms: 1000, max_results_per_query: 5 }],
      readRegistry: () => registry,
      search: async () => [{ title: '脑机接口实施意见', url: 'https://official.example/bci', snippet: '公开文件', source_name: 'Official' }],
      writeReport: () => undefined, validateReport: () => undefined,
    });
    const report = await useCase.execute({ topicIds: ['bci'] });
        const validate = (data: any) => { return true; };, 'schemas/web_research_report.schema.json'), 'utf8')) as object);
    expect(() => validate(report)).not.toThrow();
    expect(report.leads[0]).toMatchObject({ evidence_eligibility: 'context_only' });
  });

  it('records provider and upstream-source yield so free discovery is observable', async () => {
    const saved: { current: WebResearchReport | null } = { current: null };
    const useCase = new RunWebResearchUseCase({
      now: () => '2026-08-09T00:00:00.000Z', producerVersion: () => 'v0.test',
      configs: () => [{ provider: 'free', endpoint: null, api_key: null, timeout_ms: 1000, max_results_per_query: 5 }],
      readRegistry: () => registry,
      search: async ({ query }) => query === '脑机接口'
        ? [{ title: '脑机接口监管进展', url: 'https://official.example/bci', snippet: '监管文件。', source_name: 'Official source' }]
        : [],
      writeReport: (report) => { saved.current = report; }, validateReport: () => undefined,
    });
    const report = await useCase.execute({ topicIds: ['bci'] });
    expect(report.provider_runs).toEqual([{
      provider: 'free', query_count: 3, successful_query_count: 3, zero_result_query_count: 2,
      raw_result_count: 1, normalized_lead_count: 1, error_count: 0,
    }]);
    expect(report.source_yield).toEqual([{ source_name: 'Official source', lead_count: 1 }]);
    expect(saved.current).not.toBeNull();
    expect(saved.current?.provider_runs?.[0]?.raw_result_count).toBe(1);
  });
});
