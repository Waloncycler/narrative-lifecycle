import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
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

describe('research source retrieval', () => {
  it('selects only governed review leads and extracts bounded source-citable text', () => {
    expect(selectSourceRetrievalTargets(triage, 6).map((item) => item.triage_id)).toEqual(['official_1', 'academic_1']);
    const parsed = extractReadableSource('<html><head><title>Official BCI record</title><script>bad()</script></head><body><p>This original official source contains a sufficiently long factual paragraph about a recorded clinical development and its date for independent review.</p><p>A second sufficiently long paragraph provides a distinct factual statement that can be checked against the original document before evidence intake.</p></body></html>', 'text/html');
    expect(parsed.title).toBe('Official BCI record');
    expect(parsed.text).not.toContain('bad()');
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

  it('writes a schema-valid context-only retrieval package without importing evidence', async () => {
    let saved: unknown;
    const report = await new RetrieveResearchSourcesUseCase({
      now: () => generatedAt, producerVersion: () => 'v0.test', readLeadTriage: () => triage,
      retrieve: async ({ url }) => ({ httpStatus: 200, contentType: 'text/html', body: `<html><title>Source page</title><body><p>This source page has a sufficiently detailed factual paragraph about ${url} and a reported official action that can be independently verified before any formal evidence decision.</p><p>The second factual paragraph describes a separate result, time, and limitation for a human researcher to inspect at the original page.</p></body></html>` }),
      writeReport: (value) => { saved = value; }, validateReport: () => undefined,
      writeQualityReport: () => undefined, validateQualityReport: () => undefined,
    }).execute({ maxItems: 5 });
    expect(report).toMatchObject({ requested_count: 2, retrieved_count: 2, failed_count: 0, guardrail_check: { bounded_excerpts_only: true, no_auto_evidence_import: true, parent_branch_separation: true } });
    expect(report.items.every((item) => item.evidence_eligibility === 'context_only' && item.next_action === 'prepare_intake' && item.citation_status === 'ready' && item.excerpts.length > 0)).toBe(true);
    expect(report.items.find((item) => item.branch_id === 'bci_medical_rehab')).toMatchObject({ topic_id: 'bci', evidence_eligibility: 'context_only' });
    expect(saved).toBe(report);

    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_source_retrieval_report.schema.json'), 'utf8')) as object;
    const validate = ajv.compile(schema);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
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
    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_source_quality_report.schema.json'), 'utf8')) as object;
    const validate = ajv.compile(schema);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });
});
