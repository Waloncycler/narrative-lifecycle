import { describe, expect, it } from 'vitest';
import { ProbePrioritizedNewsUseCase } from '@/app/use_cases/probe_prioritized_news_use_case';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { WebResearchReport } from '@/features/research/types/web_research';

const session: EvidenceIntakeSession = {
  session_id: 'news_session', generated_at: '2026-08-14T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_news', source_name: 'news', source_kind: 'pasted_text', ingested_at: '2026-08-14T00:00:00.000Z', text: 'news', character_count: 4 },
  chunks: [], provenance_records: [], review_template: [],
  candidates: [{
    candidate_id: 'candidate_news_1', raw_document_id: 'raw_news', chunk_id: 'chunk', provenance_id: 'prov', original_quote: '国家药监局批准38个创新药上市。',
    suggested_evidence: {
      evidence_id: 'news_1', topic_id: 'unknown_topic', branch_id: null, scope: 'parent', event_date: '2026-08-13', available_at: '2026-08-13',
      event_title: '国家药监局批准38个创新药上市', event_summary: '国家药监局批准38个创新药上市，其中11个属于新靶点新机制药物。', event_type: 'NEWS_ARTICLE_PUBLISHED',
      source_name: '新浪财经', source_url: 'https://finance.sina.com.cn/news/1', source_type: 'news', evidence_strength: 'E1', affected_layer: ['name'], stage_effect: 'maintain', polarity: 'neutral', interpretation: 'lead', limitation: 'needs probing', confidence: 'low',
    },
    suggested_reason: 'important news', uncertainty_notes: [], field_explanations: { news_importance_score: '82', deep_probe_recommended: 'yes' }, e_strength_rationale: 'news stays E1', publication_eligibility: 'manual_review', guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }],
};

function webReport(hosts: string[]): WebResearchReport {
  const queries = [
    { query_id: 'q1', query: 'drug approval official', topic_id: 'innovative_drugs', branch_id: 'domestic_approval', campaign_task_id: 'news_probe__candidate_news_1__official', purpose: 'evidence_discovery' as const },
    { query_id: 'q2', query: 'drug approval independent', topic_id: 'innovative_drugs', branch_id: 'domestic_approval', campaign_task_id: 'news_probe__candidate_news_1__independent', purpose: 'evidence_discovery' as const },
  ];
  return {
    artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web', generated_at: '2026-08-14T00:00:00.000Z', status: 'completed', provider: 'free', providers: ['free'], queries,
    lead_count: hosts.length, leads: hosts.map((host, index) => ({ lead_id: `lead_${index}`, query_id: queries[index % 2]!.query_id, topic_id: 'innovative_drugs', branch_id: 'domestic_approval', title: '国家药监局批准38个创新药上市', url: `https://${host}/newsroom/approval-${index}`, source_name: host, source_domain: host, snippet: '批准38个创新药上市，其中11个属于新靶点新机制药物。', published_at: '2026-08-13', retrieved_at: '2026-08-14T00:00:00.000Z', rank: index + 1, evidence_eligibility: 'context_only', next_action: 'review_source' })), errors: [],
    guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
  };
}

const body = '<html><head><title>Official approval</title></head><body><article>国家药监局正式批准38个创新药上市，其中11个属于新靶点新机制药物，相关批准记录可由研究人员独立复核。</article></body></html>';

describe('prioritized news deep probing', () => {
  it('requires two independent primary hosts and preserves branch scope', async () => {
    let appended = false;
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test',
      readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.nmpa.gov.cn', 'company.example.com']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: (report) => { appended = true; expect(report.items[0]).toMatchObject({ topic_id: 'innovative_drugs', branch_id: 'domestic_approval', news_corroboration: { corroboration_status: 'verified' } }); return session; },
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session);
    expect(result.verified_news_count).toBe(1);
    expect(appended).toBe(true);
    expect(result.report.items).toHaveLength(2);
    expect(result.report.items[0]?.next_action).toBe('prepare_intake');
    expect(result.report.items[1]?.next_action).toBe('hold');
  });

  it('does not advance a single-source package or media cross-posts', async () => {
    let appended = false;
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test',
      readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.nmpa.gov.cn', 'www.cls.cn']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => { appended = true; return session; }, writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session);
    expect(result.verified_news_count).toBe(0);
    expect(appended).toBe(false);
    expect(result.report.items.every((item) => item.next_action === 'hold')).toBe(true);
    expect(result.report.items.some((item) => item.error === 'no_independent_primary_source_candidates')).toBe(false);
  });

  it('writes an auditable hold row when search recovers no primary source', async () => {
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.cls.cn']), retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => session, writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session);
    expect(result.report.items).toHaveLength(2);
    expect(result.report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'retrieved', next_action: 'hold', source_class: 'unknown' }),
      expect.objectContaining({ status: 'skipped', next_action: 'hold', error: 'no_independent_primary_source_candidates', source_class: 'secondary' }),
    ]));
  });

  it('accepts a primary source plus an independent authoritative report and records the funnel', async () => {
    let diagnostics: unknown;
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.nmpa.gov.cn', 'www.reuters.com']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => session, writeReport: () => undefined,
      writeDiagnostics: (value) => { diagnostics = value; }, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session);
    expect(result.verified_news_count).toBe(1);
    expect(diagnostics).toMatchObject({ search_lead_count: 2, retrieval_attempt_count: 2, citation_ready_count: 2, verified_news_count: 1 });
  });

  it('fetches unknown domains within a discovery budget but excludes them from corroboration and Intake', async () => {
    let appended = false;
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['unknown-one.example', 'unknown-two.example', 'unknown-three.example']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => { appended = true; return session; },
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session, { maxUnknownSourcesPerNews: 2 });
    const unknownItems = result.report.items.filter((item) => item.source_class === 'unknown');
    expect(unknownItems).toHaveLength(2);
    expect(unknownItems.every((item) => item.status === 'retrieved' && item.next_action === 'hold' && !item.news_corroboration)).toBe(true);
    expect(result).toMatchObject({ verified_news_count: 0, diagnostics: { unknown_discovery_attempt_count: 2, unknown_discovery_ready_count: 2 } });
    expect(appended).toBe(false);
  });

  it('recognizes common UK, Australian, Japanese, and Korean government hosts as official', async () => {
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.gov.uk', 'health.gov.au', 'mhlw.go.jp', 'mohw.go.kr', 'www.korea.kr']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => session,
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(session, { maxSourcesPerNews: 8 });
    expect(result.report.items).toHaveLength(5);
    expect(result.report.items.every((item) => item.source_class === 'official')).toBe(true);
    expect(result.diagnostics.unknown_discovery_attempt_count).toBe(0);
  });

  it('counts a substantive governed seed article plus one independent primary as two-source verification', async () => {
    const fullArticleSession: EvidenceIntakeSession = JSON.parse(JSON.stringify(session));
    fullArticleSession.candidates[0]!.original_quote = '国家药监局发布正式统计，截至六月底共批准38个创新药上市，其中11个属于新靶点新机制药物，并列明化学药、生物制品与中药的构成。该报道援引药品注册管理司负责人并说明统计口径，原文内容可按来源网址复核。';
    let appended = false;
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: emptyAtlas, readCompanies: emptyCompanies,
      search: async () => webReport(['www.nmpa.gov.cn']),
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }),
      appendRetrievedSourceIntake: () => { appended = true; return fullArticleSession; },
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    const result = await useCase.execute(fullArticleSession);
    expect(result.verified_news_count).toBe(1);
    expect(result.diagnostics.seed_citation_ready_count).toBe(1);
    expect(result.report.items[0]?.news_corroboration?.independent_source_hosts).toEqual(expect.arrayContaining(['finance.sina.com.cn', 'www.nmpa.gov.cn']));
    expect(appended).toBe(true);
  });

  it('strictly targets a named regulator domain instead of broad web results', async () => {
    let plans: Array<{ campaign_task_id: string; source_domains: string[]; strict_source_domains?: string[] }> = [];
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test', readRegistry: () => registry(),
      readSourceAtlas: () => ({ ...emptyAtlas(), sources: [...emptyAtlas().sources, { ...emptyAtlas().sources[0]!, source_id: 'nmpa', display_name_zh: '国家药品监督管理局', base_url: 'https://www.nmpa.gov.cn/', authority_tier: 'regulator' as const }] }),
      readCompanies: emptyCompanies,
      search: async ({ plannedQueries }) => { plans = plannedQueries; return webReport([]); },
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }), appendRetrievedSourceIntake: () => session,
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: () => undefined, validateReport: () => undefined,
    });
    await useCase.execute(session);
    expect(plans.find((plan) => plan.campaign_task_id.endsWith('__official'))).toMatchObject({ source_domains: ['www.nmpa.gov.cn'], strict_source_domains: ['www.nmpa.gov.cn'] });
  });

  it('uses the company registry to map news and target governed company and filing domains', async () => {
    const amdSession: EvidenceIntakeSession = JSON.parse(JSON.stringify(session));
    amdSession.candidates[0]!.suggested_evidence.event_title = 'AMD拟发行50亿美元债券支持AI基础设施';
    amdSession.candidates[0]!.suggested_evidence.event_summary = 'AMD plans a bond issue tied to AI infrastructure investment.';
    let plans: Array<{ topic_id: string | null; source_domains: string[]; strict_source_domains?: string[] }> = [];
    const mappedSessions: EvidenceIntakeSession[] = [];
    const useCase = new ProbePrioritizedNewsUseCase({
      now: () => '2026-08-14T01:00:00.000Z', producerVersion: () => 'test',
      readRegistry: () => ({ ...registry(), canonical_topics: [...registry().canonical_topics, { topic_id: 'computing_infrastructure', topic_name: '算力基础设施', current_stage: 'S0', status: 'active' as const }] }),
      readSourceAtlas: () => ({ ...emptyAtlas(), sources: [...emptyAtlas().sources, { ...emptyAtlas().sources[0]!, source_id: 'sec_edgar', authority_tier: 'filing' as const, domains: ['sec.gov'], base_url: 'https://www.sec.gov/' }] }),
      readCompanies: () => ({ registry_version: 'test', companies: [{ company_id: 'amd', display_name_zh: '超威半导体', display_name_en: 'AMD', market: 'us', official_source_url: 'https://ir.amd.com/', disclosure_source_ids: ['sec_edgar'], coverage_node_ids: ['computing_infrastructure'], aliases: ['Advanced Micro Devices'], status: 'curated' }] }),
      search: async ({ plannedQueries }) => { plans = plannedQueries; return webReport([]); },
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body }), appendRetrievedSourceIntake: () => amdSession,
      writeReport: () => undefined, writeDiagnostics: () => undefined, writeMappedSession: (value) => { mappedSessions.push(value); }, validateReport: () => undefined,
    });
    const result = await useCase.execute(amdSession);
    expect(plans.every((plan) => plan.topic_id === 'computing_infrastructure')).toBe(true);
    expect(plans).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_domains: ['ir.amd.com'], strict_source_domains: ['ir.amd.com'] }),
      expect.objectContaining({ source_domains: ['www.sec.gov'], strict_source_domains: ['www.sec.gov'] }),
    ]));
    expect(result.diagnostics.holds[0]?.topic_id).toBe('computing_infrastructure');
    expect(mappedSessions[0]?.candidates[0]?.suggested_evidence.topic_id).toBe('computing_infrastructure');
    expect(result.session?.candidates[0]?.suggested_evidence.topic_id).toBe('computing_infrastructure');
  });
});

function emptyAtlas() {
  return { atlas_version: 'test', sources: [{ source_id: 'company_test', display_name_zh: '测试公司', display_name_en: 'Test Company', operator: 'test', authority_tier: 'company' as const, domains: ['company.example.com'], coverage_layers: ['reality' as const], access_mode: 'rss_or_html' as const, base_url: 'https://company.example.com/', terms_url: 'https://company.example.com/terms', automated_polling_allowed: true, review_required: true, evidence_ceiling: 'E2' as const, topic_discovery_capable: false, branch_discovery_capable: false, languages: ['en'] }] };
}
function emptyCompanies() { return { registry_version: 'test', companies: [] }; }

function registry() {
  return {
    canonical_topics: [{ topic_id: 'innovative_drugs', topic_name: '创新药', current_stage: 'S0', status: 'active' as const }],
    aliases: [{ alias: '创新药上市', topic_id: 'innovative_drugs', reason: 'test' }],
    branches: [{ branch_id: 'domestic_approval', topic_id: 'innovative_drugs', branch_name: '新靶点新机制药物', status: 'active' as const }],
    provisional_topics: [], memory_topic_ids: [],
  };
}
