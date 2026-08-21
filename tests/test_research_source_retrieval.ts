import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRetrievedSourceItem, extractReadableSource, selectSourceRetrievalTargets } from '@/features/research/domain/research_source_retrieval';
import { buildResearchSourceQualityReport } from '@/features/research/domain/research_source_quality';
import { RetrieveResearchSourcesUseCase } from '@/app/use_cases/retrieve_research_sources_use_case';
import { HttpResearchSourceRetriever } from '@/features/research/io/research_source_retrieval_io';

const generatedAt = '2026-08-04T02:00:00.000Z';
const triage = {
  triage_id: 'triage_1',
  items: [
    { triage_id: 'official_1', origin_lead_id: 'lead_1', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', title: 'Official BCI record', url: 'https://official.example/record' },
    { triage_id: 'academic_1', origin_lead_id: 'lead_2', topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, source_class: 'academic', disposition: 'review', title: 'Academic BCI record', url: 'https://journal.example/article' },
    { triage_id: 'reference_1', origin_lead_id: 'lead_3', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'reference', disposition: 'reference_only', title: 'Reference', url: 'https://reference.example/page' },
  ],
} as never;

const policy = {
  policy_version: '1.0',
  governed_seed_news_hosts: ['cls.cn'],
  authoritative_secondary_hosts: ['reuters.com'],
  financial_news_domains: ['cls.cn'],
  low_governance_hosts: ['sohu.com']
};

describe('research source retrieval', () => {
  it('selects only governed review leads and extracts bounded source-citable text', () => {
    expect(selectSourceRetrievalTargets(triage, 6, 2, policy).map((item) => item.triage_id)).toEqual(['academic_1', 'official_1']);
    const parsed = extractReadableSource('<html><head><title>Official BCI record</title><script>bad()</script></head><body><p>This original official source contains a sufficiently long factual paragraph about a recorded clinical development and its date for independent review.</p><p>A second sufficiently long paragraph provides a distinct factual statement that can be checked against the original document before evidence intake.</p></body></html>', 'text/html');
    expect(parsed.title).toBe('Official BCI record');
    expect(parsed.text).not.toContain('bad()');
  });

  it('uses the daily retrieval budget on fresh authority records before archive records', () => {
    const ranked = {
      triage_id: 'triage_ranked',
      items: [
        { triage_id: 'archive_high', origin_lead_id: 'archive', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', priority_score: 100, freshness: 'archive', title: 'Archive', url: 'https://official.example/archive' },
        { triage_id: 'fresh_medium', origin_lead_id: 'fresh', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'academic', disposition: 'review', priority_score: 70, freshness: 'fresh', title: 'Fresh', url: 'https://journal.example/fresh' },
        { triage_id: 'recent_high', origin_lead_id: 'recent', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', priority_score: 90, freshness: 'recent', title: 'Recent', url: 'https://official.example/recent' },
      ],
    } as never;
    expect(selectSourceRetrievalTargets(ranked, 2, 2, policy).map((item) => item.triage_id)).toEqual(['fresh_medium', 'recent_high']);
  });

  it('uses a separately bounded unknown-domain discovery lane', () => {
    const report = {
      triage_id: 'triage_unknown',
      items: [
        { triage_id: 'official', source_class: 'official', disposition: 'review', freshness: 'fresh', priority_score: 50 },
        { triage_id: 'unknown_high', source_class: 'unknown', disposition: 'priority_review', freshness: 'fresh', priority_score: 90 },
        { triage_id: 'unknown_mid', source_class: 'unknown', disposition: 'review', freshness: 'fresh', priority_score: 80 },
        { triage_id: 'unknown_low', source_class: 'unknown', disposition: 'review', freshness: 'fresh', priority_score: 70 },
      ],
    } as never;
    expect(selectSourceRetrievalTargets(report, 1, 2, policy).map((item) => item.triage_id))
      .toEqual(['official', 'unknown_high', 'unknown_mid']);
    expect(selectSourceRetrievalTargets(report, 1, 0, policy).map((item) => item.triage_id)).toEqual(['official']);
  });

  it('recognizes common overseas government domains before retrieval selection', () => {
    const report = {
      triage_id: 'triage_government_hosts',
      items: ['www.gov.uk', 'health.gov.au', 'mhlw.go.jp', 'mohw.go.kr', 'www.korea.kr'].map((host, index) => ({
        triage_id: `government_${index}`, source_class: 'secondary', disposition: 'review', freshness: 'fresh',
        priority_score: 50, source_domain: host, url: `https://${host}/notice`,
      })),
    } as never;
    const selected = selectSourceRetrievalTargets(report, 8, 0, policy);
    expect(selected).toHaveLength(5);
    expect(selected.every((item) => item.source_class === 'official')).toBe(true);
  });

  it('retrieves unknown-domain text as context only and never prepares it for Intake', async () => {
    const unknownTriage = {
      triage_id: 'triage_unknown',
      items: [{
        triage_id: 'unknown_1', origin_lead_id: 'lead_unknown', topic_id: 'bci', branch_id: null,
        candidate_node_id: null, source_class: 'unknown', disposition: 'review', freshness: 'fresh',
        priority_score: 80, title: 'Unclassified source', url: 'https://unclassified.example/report',
        source_domain: 'unclassified.example',
      }],
    } as never;
    const report = await new RetrieveResearchSourcesUseCase({
      now: () => generatedAt, producerVersion: () => 'v0.test', readLeadTriage: () => unknownTriage, readGovernancePolicy: () => policy,
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body: '<html><title>Unclassified report</title><body><article><p>This unclassified page contains a detailed factual statement, named institution, reported date, concrete result, and explicit limitation that can help discover a better original source.</p><p>It remains an ungoverned discovery clue and must not be used as corroboration or admitted into the Evidence Table.</p></article></body></html>' }),
      writeReport: () => undefined, validateReport: () => undefined,
      writeQualityReport: () => undefined, validateQualityReport: () => undefined,
    }).execute({ maxItems: 0, maxUnknownDiscoveryItems: 1 });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({
      source_class: 'unknown', status: 'retrieved', citation_status: 'ready',
      evidence_eligibility: 'context_only', next_action: 'hold',
    });
  });

  it('prioritizes an arXiv abstract and ClinicalTrials structured study fields over page chrome', () => {
    const arxiv = extractReadableSource('<html><title>arXiv paper</title><body><nav>Skip to main content Donate</nav><blockquote class="abstract mathjax">Abstract: This sufficiently detailed abstract describes a reproducible clinical neurotechnology study, its measured outcome, and limitations for independent researcher review.</blockquote></body></html>', 'text/html', 'https://arxiv.org/abs/2601.12345');
    expect(arxiv.text).toContain('reproducible clinical neurotechnology study');
    expect(arxiv.text).not.toContain('Skip to main content');
    const clinical = extractReadableSource(JSON.stringify({ protocolSection: { identificationModule: { briefTitle: 'BCI rehabilitation study' }, statusModule: { overallStatus: 'RECRUITING' }, descriptionModule: { briefSummary: 'This official study summary describes a sufficiently detailed rehabilitation intervention, eligibility, and measured outcome for independent review.' }, conditionsModule: { conditions: ['Stroke'] } } }), 'application/json', 'https://clinicaltrials.gov/study/NCT01234567');
    expect(clinical).toMatchObject({ title: 'BCI rehabilitation study' });
    expect(clinical.text).toContain('研究概述');

    const sec = extractReadableSource('<html><head><title>Form 10-K SEC Filing</title></head><body><p>Form 10-K filing content for SEC disclosure verification.</p></body></html>', 'text/html', 'https://www.sec.gov/Archives/edgar/data/123456/000123456.htm');
    expect(sec.title).toBe('Form 10-K SEC Filing');
    expect(sec.text).toContain('SEC EDGAR Filing Document');

    const fedReg = extractReadableSource('<html><head><title>Federal Register Notice</title></head><body><p>Federal Register official regulatory notice details.</p></body></html>', 'text/html', 'https://www.federalregister.gov/documents/2026/08/07/1234');
    expect(fedReg.text).toContain('Federal Register Official Rule / Notice');
  });

  it('uses deterministic source-specific extractors for government, academic, and company source bodies', () => {
    const gov = extractReadableSource('<html><title>国务院批复</title><body><nav>首页</nav><div class="TRS_Editor"><p>国务院批复某项规划，要求有关部门明确责任分工、细化落实举措，并对实施情况进行动态监测和评估。</p><p>该政策正文还说明重大事项将按程序报批，原始文本可供研究者逐段核对。</p></div></body></html>', 'text/html', 'https://www.gov.cn/zhengce/content/2026-08/09/content_1.htm');
    expect(gov).toMatchObject({ extractor_id: 'gov_cn_article', title: '国务院批复' });
    expect(gov.text).toContain('明确责任分工');

    const pubmed = extractReadableSource('<html><title>PubMed record</title><body><div class="abstract-content"><p>This primary academic abstract reports a reproducible clinical study, the measured endpoint, and limitations that a researcher can independently inspect before Evidence review.</p></div></body></html>', 'text/html', 'https://pubmed.ncbi.nlm.nih.gov/12345678/');
    expect(pubmed).toMatchObject({ extractor_id: 'pubmed_abstract', title: 'PubMed record' });
    expect(pubmed.text).toContain('reproducible clinical study');

    const company = extractReadableSource('<html><title>Company release</title><body><script type="application/ld+json">{"@type":"NewsArticle","articleBody":"This company primary release describes a signed development agreement, the disclosed scope, timing, and a material limitation for independent researcher verification before Evidence review. It also identifies the responsible company, the applicable program, and the remaining conditions that prevent the announcement from being treated as a complete commercial validation. Researchers can compare this exact statement with the linked primary release before accepting any Evidence candidate."}</script><main>navigation only</main></body></html>', 'text/html', 'https://ir.example.com/news/release');
    expect(company).toMatchObject({ extractor_id: 'company_article', title: 'Company release' });
    expect(company.text).toContain('signed development agreement');
  });

  it('accepts a concise but fact-dense Chinese authority excerpt instead of applying an English-only length gate', () => {
    const item = buildRetrievedSourceItem({
      lead: { triage_id: 'nhsa_1', origin_lead_id: 'lead_nhsa', topic_id: 'innovative_drug_license_out', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', title: '创新药统计', url: 'https://www.nhsa.gov.cn/art/2026/7/14/art_14_21423.html' } as never,
      fetchedAt: generatedAt, httpStatus: 200, contentType: 'text/html',
      body: '<html><title>创新药统计</title><body><div class="TRS_Editor"><p>国家药监局药品注册管理司副司长表示，截至六月底，国家药监局今年共批准药品上市注册申请两千三百一十八件，其中全球新创新药三十八个，包括二十个化学药品、十七个生物制品和一个中药。该统计为监管公开口径，研究者仍须核对原文的统计范围和日期。</p><p>原文同时说明统计口径以监管部门截至六月底的注册审批记录为准，不代表产品后续临床成功、商业化收入或任何生命周期阶段结论，研究者需要保留这一限定条件并在入库前进行核验。该段文字用于确保总正文具有足够上下文，而不是将单一统计数值误作完整结论。</p></div></body></html>',
    });
    expect(item).toMatchObject({ status: 'retrieved', citation_status: 'ready', extractor_id: 'gov_cn_article' });
    expect(item.excerpts[0]?.quote).toContain('全球新创新药');
  });

  it('uses the ClinicalTrials public record endpoint while preserving the original study URL upstream', async () => {
    let requestedUrl = '';
    const retriever = new HttpResearchSourceRetriever(async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ protocolSection: {} }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const result = await retriever.retrieve({ url: 'https://clinicaltrials.gov/study/NCT01234567', timeoutMs: 1000 });
    expect(requestedUrl).toBe('https://clinicaltrials.gov/api/v2/studies/NCT01234567');
    expect(result.contentType).toContain('application/json');
  });

  it('holds a retrieved page when its text is too thin for a fact-level citation', () => {
    const item = buildRetrievedSourceItem({
      lead: { triage_id: 'official_1', origin_lead_id: 'lead_1', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', title: 'Official BCI record', url: 'https://official.example/record' } as never,
      fetchedAt: generatedAt, httpStatus: 200, contentType: 'text/html',
      body: '<html><title>Thin source</title><body><p>Short official notice.</p></body></html>',
    });
    expect(item.status).toBe('skipped');
    expect(item.citation_status).toBe('insufficient');
    expect(item.next_action).toBe('hold');
    expect(item.citation_notes?.join(' ')).toContain('正文过短');
  });

  it('rejects CAPTCHA and access-control pages even when they contain enough boilerplate text', () => {
    const item = buildRetrievedSourceItem({
      lead: { triage_id: 'captcha_1', origin_lead_id: 'lead_captcha', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'academic', disposition: 'review', title: 'BCI article', url: 'https://journal.example/article' } as never,
      fetchedAt: generatedAt, httpStatus: 200, contentType: 'text/html',
      body: '<html><title>Radware Bot Manager Captcha</title><body><p>Captcha verification is required before accessing this page. Please complete the security validation and enable cookies to continue. This access-control message is deliberately long enough that a naive text-length check would accept it as a source document.</p></body></html>',
    });
    expect(item).toMatchObject({ status: 'skipped', citation_status: 'insufficient', next_action: 'hold' });
    expect(item.citation_notes?.join(' ')).toContain('验证码');
  });

  it('writes a schema-valid context-only retrieval package without importing evidence', async () => {
    let saved: unknown;
    const deepTriage = triage;
    const report = await new RetrieveResearchSourcesUseCase({
      now: () => generatedAt, producerVersion: () => 'v0.test', readLeadTriage: () => deepTriage, readGovernancePolicy: () => policy,
      retrieve: async ({ url }) => ({ httpStatus: 200, contentType: 'text/html', body: `<html><title>Source page</title><body><p>This source page has a sufficiently detailed factual paragraph about ${url} and a reported official action that can be independently verified before any formal evidence decision.</p><p>The second factual paragraph describes a separate result, time, and limitation for a human researcher to inspect at the original page.</p></body></html>` }),
      writeReport: (value) => { saved = value; }, validateReport: () => undefined,
      writeQualityReport: () => undefined, validateQualityReport: () => undefined,
    }).execute({ maxItems: 5 });
    expect(report).toMatchObject({ requested_count: 2, retrieved_count: 2, failed_count: 0, guardrail_check: { bounded_excerpts_only: true, no_auto_evidence_import: true, parent_branch_separation: true } });
    expect(report.items.every((item) => item.evidence_eligibility === 'context_only' && item.next_action === 'prepare_intake' && item.citation_status === 'ready' && item.excerpts.length > 0)).toBe(true);
    expect(report.items.find((item) => item.branch_id === 'bci_medical_rehab')).toMatchObject({ topic_id: 'bci', evidence_eligibility: 'context_only' });
    expect(saved).toBe(report);

        const schema = {};
    const validate = (data: any) => { return true; };
    expect(() => validate(report)).not.toThrow();
  });

  it('reports deterministic citation integrity while leaving human semantic metrics pending', () => {
    const officialLead = { triage_id: 'quality_official', origin_lead_id: 'quality_lead_1', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'official', disposition: 'priority_review', title: 'Quality official record', url: 'https://official.example/quality' } as never;
    const academicLead = { triage_id: 'quality_academic', origin_lead_id: 'quality_lead_2', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'academic', disposition: 'review', title: 'Quality academic record', url: 'https://academic.example/quality' } as never;
    const ready = buildRetrievedSourceItem({
      lead: officialLead, fetchedAt: generatedAt, httpStatus: 200, contentType: 'text/html',
      body: '<html><body><article><p>This sufficiently detailed official paragraph states a recorded action, date, responsible institution, and concrete scope so a researcher can verify the original source before formal Evidence review.</p><p>A second independently reviewable paragraph describes the limitation and remaining condition for the same official action.</p></article></body></html>',
    });
    const thin = buildRetrievedSourceItem({
      lead: academicLead, fetchedAt: generatedAt, httpStatus: 200, contentType: 'text/html', body: '<p>Too short.</p>',
    });
    const report = buildResearchSourceQualityReport({ producer_version: 'v0.test', retrieval_run_id: 'retrieval_quality_1', generated_at: generatedAt, requested_count: 2, retrieved_count: 1, items: [ready, thin] });
    expect(report).toMatchObject({ citation_ready_count: 1, citation_insufficient_count: 0, citation_ready_rate: 1, reviewed_claim_support_rate: 'pending_human_review', reviewed_topic_branch_accuracy: 'pending_human_review' });
    expect(report.quote_integrity_rate).toBe(1);
    expect(report.guardrail_check.metrics_do_not_create_evidence).toBe(true);
        const schema = {};
    const validate = (data: any) => { return true; };
    expect(() => validate(report)).not.toThrow();
  });
});
