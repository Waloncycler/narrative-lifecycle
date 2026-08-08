import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildResearchCampaign, usableMarketLabel } from '@/domain/research_coverage';
import { buildWebResearchQueries, normalizeWebResearchLeads } from '@/domain/web_research';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry, ResearchUniverse } from '@/types/research_coverage';
import type { TopicRegistry } from '@/types/topic_resolution';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const atlas = parse(readFileSync(resolve(repoRoot, 'data/source_atlas/authoritative_sources.yaml'), 'utf8')) as AuthoritativeSourceAtlas;
const universe = parse(readFileSync(resolve(repoRoot, 'data/research_universe/core_topics.yaml'), 'utf8')) as ResearchUniverse;
const companies = parse(readFileSync(resolve(repoRoot, 'data/company_registry/core_companies.yaml'), 'utf8')) as CompanyResearchRegistry;
const registry: TopicRegistry = {
  canonical_topics: parse(readFileSync(resolve(repoRoot, 'data/topic_registry/canonical_topics.yaml'), 'utf8')),
  aliases: parse(readFileSync(resolve(repoRoot, 'data/topic_registry/aliases.yaml'), 'utf8')),
  branches: parse(readFileSync(resolve(repoRoot, 'data/topic_registry/branches.yaml'), 'utf8')),
  provisional_topics: parse(readFileSync(resolve(repoRoot, 'data/topic_registry/provisional_topics.yaml'), 'utf8')),
  memory_topic_ids: [],
};

describe('authoritative source mesh and research coverage campaign', () => {
  it('keeps a schema-valid, diverse authority atlas and research universe', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateAtlas = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/research_source_atlas.schema.json'), 'utf8')) as object);
    const validateUniverse = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/research_universe.schema.json'), 'utf8')) as object);
    const validateCompanies = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/company_research_registry.schema.json'), 'utf8')) as object);
    expect(validateAtlas(atlas), JSON.stringify(validateAtlas.errors)).toBe(true);
    expect(validateUniverse(universe), JSON.stringify(validateUniverse.errors)).toBe(true);
    expect(validateCompanies(companies), JSON.stringify(validateCompanies.errors)).toBe(true);
    expect(atlas.sources.length).toBeGreaterThanOrEqual(40);
    expect([...new Set(atlas.sources.map((source) => source.authority_tier))]).toEqual(expect.arrayContaining(['statutory', 'regulator', 'intergovernmental', 'academic', 'filing']));
    expect(universe.nodes.length).toBeGreaterThanOrEqual(35);
    expect([...new Set(universe.nodes.map((node) => node.domain))]).toEqual(expect.arrayContaining(['technology', 'health', 'energy', 'financial']));
    const sourceIds = new Set(atlas.sources.map((source) => source.source_id));
    expect(universe.nodes.flatMap((node) => node.preferred_source_ids).every((id) => sourceIds.has(id))).toBe(true);
    expect([...sourceIds]).toEqual(expect.arrayContaining(['openalex', 'europe_pmc', 'sec_edgar', 'federal_register', 'hkexnews', 'sse_disclosures']));
    expect(companies.companies.length).toBeGreaterThanOrEqual(25);
    expect(companies.companies.every((company) => company.disclosure_source_ids.every((id) => sourceIds.has(id)))).toBe(true);
    const activeS0 = registry.canonical_topics.filter((topic) => topic.status === 'active' && topic.current_stage === 'S0');
    expect(activeS0.length).toBeGreaterThanOrEqual(10);
  });

  it('plans formal topics, provisional topics, seeds, and valid branches without promoting any of them', () => {
    const campaign = buildResearchCampaign({ registry, atlas, universe, companies, generatedAt: '2026-08-03T00:00:00.000Z', producerVersion: 'test', maxTasks: 80 });
    expect(campaign.tasks.some((task) => task.topic_id === 'bci' && task.node_kind === 'formal_topic')).toBe(true);
    expect(campaign.tasks.some((task) => task.branch_id === 'bci_medical_rehab' && task.node_kind === 'branch')).toBe(true);
    expect(campaign.tasks.some((task) => task.node_kind === 'universe_seed' && task.formal_status === 'research_seed' && task.topic_id === null)).toBe(true);
    expect(campaign.tasks.every((task) => task.source_ids.length > 0 && task.source_domains.length > 0)).toBe(true);
    const bciTask = campaign.tasks.find((task) => task.topic_id === 'bci' && task.node_kind === 'formal_topic');
    expect(bciTask?.source_ids).toEqual(expect.arrayContaining(['clinicaltrials', 'nmpa']));
    expect(bciTask?.source_ids.some((sourceId) => ['pubmed', 'europe_pmc'].includes(sourceId))).toBe(true);
    expect(bciTask?.source_ids).not.toContain('fred');
    expect(bciTask?.direct_operation_ids).toEqual([]);
    expect(campaign.tasks.every((task) => !/对话窗口|branch\s+[a-z0-9]+$/iu.test(task.display_name_zh))).toBe(true);
    expect(campaign.summary.skipped_unresolved_branch_count).toBeGreaterThan(0);
    expect(campaign.guardrail_check).toMatchObject({
      research_seeds_are_not_formal_topics: true,
      search_results_remain_context_only: true,
      parent_branch_separation: true,
      no_auto_import: true,
    });

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/research_campaign.schema.json'), 'utf8')) as object);
    expect(validate(campaign), JSON.stringify(validate.errors)).toBe(true);

    const boundedCampaign = buildResearchCampaign({ registry, atlas, universe, companies, generatedAt: '2026-08-03T00:00:00.000Z', producerVersion: 'test', maxTasks: 24 });
    expect(boundedCampaign.tasks.filter((task) => task.node_kind === 'universe_seed')).toHaveLength(8);
    const humanoidTask = boundedCampaign.tasks.find((task) => task.topic_id === 'humanoid_robotics' && task.node_kind === 'formal_topic');
    expect(humanoidTask?.source_ids).not.toContain('pubmed');
    expect(humanoidTask?.source_ids).toEqual(expect.arrayContaining(['miit', 'arxiv', 'github']));
    const curatedCoreTask = campaign.tasks.find((task) => task.topic_id === 'provisional_ai_agents');
    expect(curatedCoreTask?.formal_status).toBe('formal');
    expect(curatedCoreTask?.source_ids).toEqual(expect.arrayContaining(['github', 'huggingface']));
    expect(curatedCoreTask?.company_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ company_id: 'huawei', display_name_zh: '华为' }),
      expect.objectContaining({ company_id: 'nvidia', display_name_zh: '英伟达' }),
    ]));
    expect(curatedCoreTask?.company_targets?.every((company) => company.disclosure_source_ids.length > 0)).toBe(true);
  });

  it('preserves campaign attribution and filters out non-authoritative search results', () => {
    const queries = buildWebResearchQueries({
      registry,
      plannedQueries: [{
        query: '脑机接口 官方 验证', topic_id: 'bci', branch_id: 'bci_medical_rehab', campaign_task_id: 'campaign_branch_bci_medical_rehab', source_ids: ['miit'], source_domains: ['miit.gov.cn'],
      }],
    });
    expect(queries[0]).toMatchObject({ campaign_task_id: 'campaign_branch_bci_medical_rehab', branch_id: 'bci_medical_rehab', source_domains: ['miit.gov.cn'] });
    expect(queries).toHaveLength(1);
    const leads = normalizeWebResearchLeads({
      query: queries[0],
      rows: [
        { title: 'Official source', url: 'https://www.miit.gov.cn/example', source_name: 'MIIT' },
        { title: 'Unrelated copy', url: 'https://example.com/copy', source_name: 'Copy' },
      ],
      retrievedAt: '2026-08-03T00:00:00.000Z',
      maxResults: 5,
    });
    expect(leads).toHaveLength(1);
    expect(leads[0]?.evidence_eligibility).toBe('context_only');
  });

  it('rejects prompt debris and unresolved labels from future branch campaigns', () => {
    expect(usableMarketLabel('第三个对话窗口里研究发布方案')).toBe(false);
    expect(usableMarketLabel('Branch Evhmt7')).toBe(false);
    expect(usableMarketLabel('脑机接口医疗康复')).toBe(true);
  });
});
