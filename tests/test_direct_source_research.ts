import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthoritativeDirectSourceProvider } from '@/infrastructure/authoritative_direct_source_provider';
import { RunDirectSourceResearchUseCase } from '@/application/use_cases/run_direct_source_research_use_case';
import { PrepareDirectSourceIntakeUseCase } from '@/application/use_cases/prepare_direct_source_intake_use_case';
import { RunResearchCampaignUseCase } from '@/application/use_cases/run_research_campaign_use_case';
import { matchesCampaignTerms } from '@/domain/direct_source_research';
import type { DirectSourceResearchReport } from '@/types/direct_source_research';
import type { AuthoritativeResearchSource, ResearchCampaign } from '@/types/research_coverage';

const clinicalTrials: AuthoritativeResearchSource = {
  source_id: 'clinicaltrials', display_name_zh: 'ClinicalTrials.gov', display_name_en: 'ClinicalTrials.gov', operator: 'NIH', authority_tier: 'statutory',
  domains: ['health'], coverage_layers: ['reality'], access_mode: 'direct_api', base_url: 'https://clinicaltrials.gov/', terms_url: 'https://clinicaltrials.gov/data-api/api',
  automated_polling_allowed: true, review_required: true, evidence_ceiling: 'E2', topic_discovery_capable: true, branch_discovery_capable: true, languages: ['en'],
};

const crossref: AuthoritativeResearchSource = {
  source_id: 'crossref', display_name_zh: 'Crossref', display_name_en: 'Crossref', operator: 'Crossref', authority_tier: 'academic',
  domains: ['technology'], coverage_layers: ['reality'], access_mode: 'direct_api', base_url: 'https://api.crossref.org/', terms_url: 'https://www.crossref.org/',
  automated_polling_allowed: true, review_required: true, evidence_ceiling: 'E2', topic_discovery_capable: true, branch_discovery_capable: true, languages: ['en'],
};

const openAlex: AuthoritativeResearchSource = {
  ...crossref, source_id: 'openalex', display_name_zh: 'OpenAlex', display_name_en: 'OpenAlex', base_url: 'https://api.openalex.org/', terms_url: 'https://docs.openalex.org/',
};

const europePmc: AuthoritativeResearchSource = {
  ...clinicalTrials, source_id: 'europe_pmc', display_name_zh: 'Europe PMC', display_name_en: 'Europe PMC', base_url: 'https://www.ebi.ac.uk/europepmc/', terms_url: 'https://dev.europepmc.org/RestfulWebService', authority_tier: 'academic',
};

const secEdgar: AuthoritativeResearchSource = {
  ...crossref, source_id: 'sec_edgar', display_name_zh: '美国证券交易委员会 EDGAR', display_name_en: 'SEC EDGAR', authority_tier: 'filing',
  base_url: 'https://data.sec.gov/', terms_url: 'https://www.sec.gov/about/developer-resources', languages: ['en'],
};

const federalRegister: AuthoritativeResearchSource = {
  ...clinicalTrials, source_id: 'federal_register', display_name_zh: '美国联邦公报', display_name_en: 'Federal Register',
  base_url: 'https://www.federalregister.gov/api/v1/', terms_url: 'https://www.federalregister.gov/developers/documentation/api/v1', languages: ['en'],
};

const campaign: ResearchCampaign = {
  artifact_type: 'research_campaign', schema_version: '1.0.0', producer_version: 'test', campaign_id: 'campaign_1', generated_at: '2026-08-03T00:00:00.000Z', source_atlas_version: 'test', universe_version: 'test',
  tasks: [{
    task_id: 'campaign_formal_bci', node_kind: 'formal_topic', topic_id: 'bci', branch_id: null, candidate_node_id: null,
    display_name_zh: '脑机接口', display_name_en: 'Brain-computer interface', domain: 'health', priority: 90, target_layers: ['reality'],
    query: '脑机接口 官方', source_ids: ['clinicaltrials'], source_domains: ['clinicaltrials.gov'], direct_operation_ids: [], rationale: 'test', formal_status: 'formal',
  }],
  summary: { formal_topic_count: 1, provisional_topic_count: 0, universe_seed_count: 0, branch_count: 0, source_target_count: 1, task_count: 1, skipped_unresolved_branch_count: 0 },
  guardrail_check: { research_seeds_are_not_formal_topics: true, source_capability_is_not_connectivity_claim: true, search_results_remain_context_only: true, parent_branch_separation: true, evidence_table_required_for_stage: true, no_auto_import: true, no_trading_advice: true },
};

describe('authoritative direct-source research', () => {
  it('uses the campaign terms for a public ClinicalTrials.gov query', async () => {
    let requestUrl = '';
    const provider = new AuthoritativeDirectSourceProvider(async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({
        studies: [{ protocolSection: { identificationModule: { nctId: 'NCT01234567', briefTitle: 'Brain computer interface rehabilitation trial' }, statusModule: { overallStatus: 'RECRUITING', lastUpdatePostDateStruct: { date: '2026-07-01' } }, conditionsModule: { conditions: ['Stroke'] } } }],
      }), { status: 200 });
    });
    const rows = await provider.search({ source: clinicalTrials, task: campaign.tasks[0]!, maxResults: 3, timeoutMs: 1_000 });
    expect(requestUrl).toContain('query.term=Brain-computer+interface');
    expect(rows).toEqual([expect.objectContaining({ title: 'Brain computer interface rehabilitation trial', url: 'https://clinicaltrials.gov/study/NCT01234567' })]);
  });

  it('normalizes OpenAlex and Europe PMC records through their public query APIs', async () => {
    const requests: string[] = [];
    const provider = new AuthoritativeDirectSourceProvider(async (input) => {
      const request = String(input);
      requests.push(request);
      if (request.includes('openalex')) {
        return new Response(JSON.stringify({ results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1000/example', title: 'Brain interface paper', publication_date: '2026-07-02', primary_location: { source: { display_name: 'Journal' } } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ resultList: { result: [{ id: '12345', source: 'MED', title: 'Brain interface clinical review', journalTitle: 'Clinical Journal', firstPublicationDate: '2026-07-03' }] } }), { status: 200 });
    });
    const [openAlexRows, europePmcRows] = await Promise.all([
      provider.search({ source: openAlex, task: campaign.tasks[0]!, maxResults: 2, timeoutMs: 1_000 }),
      provider.search({ source: europePmc, task: campaign.tasks[0]!, maxResults: 2, timeoutMs: 1_000 }),
    ]);
    expect(requests.some((url) => url.includes('api.openalex.org/works'))).toBe(true);
    expect(requests.some((url) => url.includes('europepmc/webservices/rest/search'))).toBe(true);
    expect(openAlexRows[0]).toMatchObject({ title: 'Brain interface paper', url: 'https://doi.org/10.1000/example' });
    expect(europePmcRows[0]).toMatchObject({ title: 'Brain interface clinical review', url: 'https://europepmc.org/article/MED/12345' });
  });

  it('keeps SEC and Federal Register source-backed search results as review-only leads', async () => {
    const requests: string[] = [];
    const provider = new AuthoritativeDirectSourceProvider(async (input) => {
      const request = String(input);
      requests.push(request);
      if (request.includes('efts.sec.gov')) {
        return new Response(JSON.stringify({
          hits: { hits: [{
            _id: '0000000000-26-000001:example.htm',
            _source: { adsh: '0000000000-26-000001', ciks: ['0000000000'], display_names: ['Example Technologies Inc.'], form: '10-K', file_date: '2026-07-01' },
          }] },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        results: [{ title: 'Artificial Intelligence Accountability Notice', html_url: 'https://www.federalregister.gov/documents/2026/07/01/example', abstract: 'Official notice.', publication_date: '2026-07-01' }],
      }), { status: 200 });
    });
    const secRows = await provider.search({ source: secEdgar, task: campaign.tasks[0]!, maxResults: 2, timeoutMs: 1_000 });
    const federalRows = await provider.search({ source: federalRegister, task: campaign.tasks[0]!, maxResults: 2, timeoutMs: 1_000 });
    expect(requests.some((url) => url.includes('efts.sec.gov/LATEST/search-index'))).toBe(true);
    expect(requests.some((url) => url.includes('federalregister.gov/api/v1/documents.json'))).toBe(true);
    expect(secRows[0]).toMatchObject({ title: 'Example Technologies Inc. · 10-K', term_match_verified: true });
    expect(secRows[0]?.url).toContain('www.sec.gov/Archives/edgar/data/0/000000000026000001/example.htm');
    expect(federalRows[0]).toMatchObject({ title: 'Artificial Intelligence Accountability Notice', term_match_verified: true });
  });

  it('retries one transient direct-source failure and still preserves the returned official row', async () => {
    let attempts = 0;
    const provider = new AuthoritativeDirectSourceProvider(async () => {
      attempts += 1;
      if (attempts === 1) return new Response('temporary failure', { status: 500 });
      return new Response(JSON.stringify({
        hits: { hits: [{
          _id: '0000000000-26-000001:example.htm',
          _source: { adsh: '0000000000-26-000001', ciks: ['0000000000'], display_names: ['Example Technologies Inc.'], form: '10-K', file_date: '2026-07-01' },
        }] },
      }), { status: 200 });
    });
    const rows = await provider.search({ source: secEdgar, task: campaign.tasks[0]!, maxResults: 1, timeoutMs: 1_000 });
    expect(attempts).toBe(2);
    expect(rows).toHaveLength(1);
  });

  it('writes schema-valid context-only leads and filters advice language', async () => {
    let saved: unknown;
    const useCase = new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test', readSourceAtlas: () => ({ atlas_version: 'test', sources: [clinicalTrials] }),
      supports: () => true,
      search: async () => [
        { title: 'Brain-computer interface primary trial record', url: 'https://clinicaltrials.gov/study/NCT01234567', snippet: 'recruiting', published_at: '2026-07-01' },
        { title: 'Unrelated trial record', url: 'https://clinicaltrials.gov/study/NCT07654321', snippet: 'Brain-computer interface is only mentioned in a broad API summary.', published_at: '2026-07-01' },
        { title: 'Buy this theme', url: 'https://example.test/advice', snippet: 'buy now', published_at: null },
      ],
      writeReport: (report) => { saved = report; }, validateReport: () => undefined,
    });
    const report = await useCase.execute({ campaign });
    expect(report).toMatchObject({ status: 'completed', lead_count: 1, guardrail_check: { direct_source_results_not_formal_evidence: true, no_auto_import: true } });
    expect(report.leads[0]).toMatchObject({ topic_id: 'bci', evidence_eligibility: 'context_only', next_action: 'review_source' });
    expect(saved).toBe(report);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/direct_source_research_report.schema.json'), 'utf8')) as object);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });

  it('requires source records to repeat the campaign concept before candidate creation', () => {
    expect(matchesCampaignTerms(campaign.tasks[0]!, 'Brain-computer interface rehabilitation trial')).toBe(true);
    expect(matchesCampaignTerms(campaign.tasks[0]!, 'Coding agents benchmark for hierarchical repair')).toBe(false);
    expect(matchesCampaignTerms(
      { ...campaign.tasks[0]!, display_name_zh: '跨境电商', display_name_en: 'Cross-border e-commerce' },
      'Linkage Global Inc (LGCB) (CIK 0001969401) filing',
    )).toBe(false);
  });

  it('rejects a server-verified official full-text result when visible context omits the campaign concept', async () => {
    const report = await new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test', readSourceAtlas: () => ({ atlas_version: 'test', sources: [secEdgar] }),
      supports: () => true,
      search: async () => [{ title: 'Example Technologies Inc. · 10-K', url: 'https://www.sec.gov/Archives/example.htm', snippet: 'The full-text index matched the campaign query.', published_at: '2026-07-01', term_match_verified: true }],
      writeReport: () => undefined, validateReport: () => undefined,
    }).execute({ campaign: { ...campaign, tasks: [{ ...campaign.tasks[0]!, source_ids: ['sec_edgar'], source_domains: ['sec.gov'] }] } });
    expect(report.leads).toHaveLength(0);
  });

  it('keeps a relevant company name in SEC queries without relaxing concept matching', async () => {
    let requestUrl = '';
    const provider = new AuthoritativeDirectSourceProvider(async (input) => {
      requestUrl = String(input);
      return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200 });
    });
    await provider.search({
      source: secEdgar,
      task: {
        ...campaign.tasks[0]!,
        company_targets: [{
          company_id: 'nvidia', display_name_zh: '英伟达', display_name_en: 'NVIDIA', market: 'us',
          official_source_url: 'https://investor.nvidia.com/', disclosure_source_ids: ['sec_edgar'],
        }],
      },
      maxResults: 2,
      timeoutMs: 1_000,
    });
    expect(requestUrl).toContain('q=NVIDIA+Brain-computer+interface');
  });

  it('allows a compact SEC filing title only when the tracked company and concept excerpt both match', async () => {
    const task: ResearchCampaign['tasks'][number] = {
      ...campaign.tasks[0]!,
      source_ids: ['sec_edgar'],
      source_domains: ['sec.gov'],
      company_targets: [{
        company_id: 'nvidia', display_name_zh: '英伟达', display_name_en: 'NVIDIA', market: 'us',
        official_source_url: 'https://investor.nvidia.com/', disclosure_source_ids: ['sec_edgar'],
      }],
    };
    const report = await new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test', readSourceAtlas: () => ({ atlas_version: 'test', sources: [secEdgar] }),
      supports: () => true,
      search: async () => [{ title: 'NVIDIA Corporation · 10-K', url: 'https://www.sec.gov/Archives/example.htm', snippet: 'Brain-computer interface development disclosure.', published_at: '2026-07-01', term_match_verified: true }],
      writeReport: () => undefined, validateReport: () => undefined,
    }).execute({ campaign: { ...campaign, tasks: [task] } });
    expect(report.leads).toHaveLength(1);
    expect(report.leads[0]).toMatchObject({ source_id: 'sec_edgar', evidence_eligibility: 'context_only' });
  });

  it('rotates queryable sources across domains and rejects future-indexed records', async () => {
    const balancedCampaign: ResearchCampaign = {
      ...campaign,
      tasks: [
        campaign.tasks[0]!,
        { ...campaign.tasks[0]!, task_id: 'campaign_technology', topic_id: 'ai_agents', display_name_zh: 'AI 智能体', display_name_en: 'AI agents', domain: 'technology', priority: 80, source_ids: ['crossref'], source_domains: ['api.crossref.org'] },
        { ...campaign.tasks[0]!, task_id: 'campaign_health_second', topic_id: 'innovative_drugs', display_name_zh: '创新药', display_name_en: 'Innovative drugs', domain: 'health', priority: 70 },
      ],
    };
    const queried: string[] = [];
    const report = await new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test', readSourceAtlas: () => ({ atlas_version: 'test', sources: [clinicalTrials, crossref] }),
      supports: () => true,
      search: async ({ source, task }) => {
        queried.push(source.source_id);
        return [
          { title: `${task.display_name_en} current record`, url: `https://example.test/${source.source_id}/current`, snippet: 'source record', published_at: '2026-07-01' },
          { title: `${task.display_name_en} future record`, url: `https://example.test/${source.source_id}/future`, snippet: 'source record', published_at: '2027-01-01' },
        ];
      },
      writeReport: () => undefined, validateReport: () => undefined,
    }).execute({ campaign: balancedCampaign, maxTasks: 3, maxQueries: 2 });
    expect(queried).toEqual(['clinicaltrials', 'crossref']);
    expect(report.leads).toHaveLength(2);
    expect(report.leads.every((lead) => !lead.title.includes('future'))).toBe(true);
  });

  it('reserves direct-query opportunities for a parent, branch, and research seed', async () => {
    const diverseCampaign: ResearchCampaign = {
      ...campaign,
      tasks: [
        campaign.tasks[0]!,
        { ...campaign.tasks[0]!, task_id: 'campaign_branch_bci_medical_rehab', node_kind: 'branch', branch_id: 'bci_medical_rehab', display_name_zh: '脑机接口医疗康复', display_name_en: 'BCI medical rehabilitation', formal_status: 'watch_branch' },
        { ...campaign.tasks[0]!, task_id: 'campaign_seed_solid_state_battery', node_kind: 'universe_seed', topic_id: null, branch_id: null, candidate_node_id: 'solid_state_battery', display_name_zh: '固态电池', display_name_en: 'Solid-state batteries', formal_status: 'research_seed' },
      ],
    };
    const queriedTaskIds: string[] = [];
    await new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test', readSourceAtlas: () => ({ atlas_version: 'test', sources: [clinicalTrials] }), supports: () => true,
      search: async ({ task }) => {
        queriedTaskIds.push(task.task_id);
        return [{ title: `${task.display_name_en} current record`, url: `https://example.test/${task.task_id}`, snippet: 'source record', published_at: '2026-07-01' }];
      },
      writeReport: () => undefined, validateReport: () => undefined,
    }).execute({ campaign: diverseCampaign, maxTasks: 3, maxQueries: 3 });
    expect(queriedTaskIds).toEqual(expect.arrayContaining(['campaign_formal_bci', 'campaign_branch_bci_medical_rehab', 'campaign_seed_solid_state_battery']));
  });

  it('keeps non-queryable catalog APIs out of a term-query run instead of reporting them as failures', async () => {
    const staticApi: AuthoritativeResearchSource = {
      ...clinicalTrials,
      source_id: 'static_api',
      display_name_zh: '静态权威 API',
      access_mode: 'direct_api',
    };
    const report = await new RunDirectSourceResearchUseCase({
      now: () => '2026-08-03T00:00:00.000Z', producerVersion: () => 'test',
      readSourceAtlas: () => ({ atlas_version: 'test', sources: [clinicalTrials, staticApi] }),
      supports: (source) => source.source_id === 'clinicaltrials',
      search: async () => [{ title: 'Brain-computer interface study', url: 'https://clinicaltrials.gov/study/NCT01234567', snippet: 'record', published_at: '2026-07-01' }],
      writeReport: () => undefined, validateReport: () => undefined,
    }).execute({ campaign: { ...campaign, tasks: [{ ...campaign.tasks[0]!, source_ids: ['static_api', 'clinicaltrials'] }] } });
    expect(report.status).toBe('completed');
    expect(report.queries).toEqual([expect.objectContaining({ source_id: 'clinicaltrials', status: 'completed' })]);
    expect(report.queries.some((query) => query.status === 'skipped')).toBe(false);
  });

  it('keeps the direct-source budget independent from the shorter web-search budget', async () => {
    let directInput: { maxTasks: number; maxQueries: number } | undefined;
    const webResearch = { artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'unconfigured', provider: 'none', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } } as never;
    const directResearch = { artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', queries: [], lead_count: 0, leads: [], guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } } as never;
    await new RunResearchCampaignUseCase({
      buildCampaign: () => campaign,
      runWebResearch: async () => webResearch,
      runDirectSourceResearch: async (input) => { directInput = input; return directResearch; },
      prepareDirectSourceIntake: () => null,
    }).execute({ maxTasks: 24, maxQueries: 2, maxDirectQueries: 6 });
    expect(directInput).toMatchObject({ maxTasks: 24, maxQueries: 6 });
  });

  it('builds the read-only lead triage only after research reports complete', async () => {
    let triageCalls = 0;
    const webResearch = { artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', provider: 'free', queries: [], lead_count: 1, leads: [], errors: [], guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } } as never;
    const directResearch = { artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', queries: [], lead_count: 1, leads: [], guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } } as never;
    const result = await new RunResearchCampaignUseCase({
      buildCampaign: () => campaign,
      runWebResearch: async () => webResearch,
      runDirectSourceResearch: async () => directResearch,
      prepareDirectSourceIntake: () => null,
      buildLeadTriage: () => {
        triageCalls += 1;
        return { triaged_lead_count: 2, summary: { priority_review_count: 1 } } as never;
      },
    }).execute({ maxTasks: 1, maxQueries: 1 });
    expect(triageCalls).toBe(1);
    expect(result.leadTriage).toMatchObject({ triaged_lead_count: 2, summary: { priority_review_count: 1 } });
    expect(result.directSourceSession).toBeNull();
  });

  it('reserves bounded official-company queries without losing Topic attribution or branch scope', async () => {
    let plannedQueries: Array<{ query: string; topic_id: string | null; branch_id: string | null; campaign_task_id: string; source_ids: string[]; source_domains: string[] }> = [];
    await new RunResearchCampaignUseCase({
      buildCampaign: () => ({
        ...campaign,
        tasks: [{
          ...campaign.tasks[0]!,
          company_targets: [{
            company_id: 'nvidia', display_name_zh: '英伟达', display_name_en: 'NVIDIA', market: 'us',
            official_source_url: 'https://investor.nvidia.com/', disclosure_source_ids: ['sec_edgar'],
          }],
        }],
      }),
      runWebResearch: async (input) => {
        plannedQueries = input.plannedQueries;
        return { artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'unconfigured', provider: 'disabled', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } };
      },
      runDirectSourceResearch: async () => ({ artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', queries: [], lead_count: 0, leads: [], guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } }),
      prepareDirectSourceIntake: () => null,
    }).execute({ maxQueries: 3 });
    const companyQuery = plannedQueries.find((query) => query.campaign_task_id.endsWith('__company_nvidia'));
    expect(companyQuery).toMatchObject({ topic_id: 'bci', branch_id: null, source_ids: ['sec_edgar'], source_domains: ['investor.nvidia.com'] });
    expect(companyQuery?.query).toContain('NVIDIA');
    expect(plannedQueries).toHaveLength(2);
    // Topic queries stay a wide-net discovery pass and must not inherit the
    // authoritative-domain whitelist that would zero out free-aggregate results.
    const topicQuery = plannedQueries.find((query) => !query.campaign_task_id.includes('__company_'));
    expect(topicQuery).toMatchObject({ topic_id: 'bci', source_ids: [], source_domains: [] });
    expect(topicQuery?.query).not.toContain('官方');
    expect(topicQuery?.query.length).toBeGreaterThan(0);
  });

  it('reserves web-query slots for a parent, branch, and research seed', async () => {
    let plannedQueries: Array<{ topic_id: string | null; branch_id: string | null; candidate_node_id?: string | null }> = [];
    await new RunResearchCampaignUseCase({
      buildCampaign: () => ({
        ...campaign,
        tasks: [
          campaign.tasks[0]!,
          { ...campaign.tasks[0]!, task_id: 'campaign_branch_bci_medical_rehab', node_kind: 'branch', branch_id: 'bci_medical_rehab', display_name_zh: '脑机接口医疗康复', display_name_en: 'BCI medical rehabilitation', formal_status: 'watch_branch' },
          { ...campaign.tasks[0]!, task_id: 'campaign_seed_solid_state_battery', node_kind: 'universe_seed', topic_id: null, branch_id: null, candidate_node_id: 'solid_state_battery', display_name_zh: '固态电池', display_name_en: 'Solid-state batteries', formal_status: 'research_seed' },
        ],
      }),
      runWebResearch: async (input) => {
        plannedQueries = input.plannedQueries;
        return { artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', provider: 'free', queries: [], lead_count: 0, leads: [], errors: [], guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } };
      },
      runDirectSourceResearch: async () => ({ artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed', queries: [], lead_count: 0, leads: [], guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true } }),
      prepareDirectSourceIntake: () => null,
    }).execute({ maxQueries: 3 });
    expect(plannedQueries).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic_id: 'bci', branch_id: null, candidate_node_id: null }),
      expect.objectContaining({ topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null }),
      expect.objectContaining({ topic_id: null, branch_id: null, candidate_node_id: 'solid_state_battery' }),
    ]));
  });

  it('creates a provenance-complete E1 review session without allowing a parent-stage shortcut', () => {
    let saved: unknown;
    let resolved = false;
    const report: DirectSourceResearchReport = {
      artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed',
      queries: [], lead_count: 1,
      leads: [{ lead_id: 'lead_1', task_id: 'campaign_formal_bci', topic_id: 'bci', branch_id: null, source_id: 'clinicaltrials', source_name: 'ClinicalTrials.gov', title: 'Rehabilitation BCI study after stroke', url: 'https://clinicaltrials.gov/study/NCT01234567', snippet: 'RECRUITING', published_at: '2026-07-01', evidence_eligibility: 'context_only', next_action: 'review_source' }],
      guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
    };
    const session = new PrepareDirectSourceIntakeUseCase({
      now: () => '2026-08-03T00:00:00.000Z', existingEvidenceIds: () => new Set(), writeIntakeSession: (value) => { saved = value; },
      resolveTopics: () => { resolved = true; }, validateSession: () => undefined, validateCandidate: () => undefined,
    }).execute(report);
    expect(session?.candidates[0]).toMatchObject({
      original_quote: 'Rehabilitation BCI study after stroke',
      publication_eligibility: 'manual_review',
      suggested_evidence: { topic_id: 'bci', branch_id: 'bci_medical_rehab', scope: 'branch', evidence_strength: 'E1', confidence: 'low', stage_effect: 'split_branch' },
      guardrail_check: { human_review_required: true, provenance_present: true, no_trading_advice: true },
    });
    const provenance = session?.provenance_records[0]!;
    const raw = session?.raw_document.text ?? '';
    expect(raw.slice(provenance.quote_start_offset, provenance.quote_end_offset)).toBe(provenance.quote);
    expect(saved).toBe(session);
    expect(resolved).toBe(true);
  });

  it('keeps a universe seed as a provisional S0 candidate instead of losing it as unknown', () => {
    const report: DirectSourceResearchReport = {
      artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_seed', generated_at: '2026-08-03T00:00:00.000Z', status: 'completed',
      queries: [], lead_count: 1,
      leads: [{ lead_id: 'lead_seed', task_id: 'campaign_seed_commercial_space', topic_id: null, branch_id: null, candidate_node_id: 'commercial_space', source_id: 'crossref', source_name: 'Crossref', title: 'Commercial space launch systems', url: 'https://doi.org/10.1000/example', snippet: 'source record', published_at: '2026-07-01', evidence_eligibility: 'context_only', next_action: 'review_source' }],
      guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
    };
    const session = new PrepareDirectSourceIntakeUseCase({
      now: () => '2026-08-03T00:00:00.000Z', existingEvidenceIds: () => new Set(), writeIntakeSession: () => undefined,
      resolveTopics: () => undefined, validateSession: () => undefined, validateCandidate: () => undefined,
    }).execute(report);
    expect(session?.candidates[0]?.suggested_evidence).toMatchObject({ topic_id: 'provisional_commercial_space', scope: 'parent', stage_effect: 'maintain', evidence_strength: 'E1', confidence: 'low' });
    expect(session?.candidates[0]?.uncertainty_notes).toContain('This record came from a research seed and can only accumulate under a provisional S0 topic.');
  });
});
