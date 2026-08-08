import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { extractReadableSource, selectSourceRetrievalTargets } from '@/features/research/domain/research_source_retrieval';
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

  it('writes a schema-valid context-only retrieval package without importing evidence', async () => {
    let saved: unknown;
    const report = await new RetrieveResearchSourcesUseCase({
      now: () => generatedAt, producerVersion: () => 'v0.test', readLeadTriage: () => triage,
      retrieve: async ({ url }) => ({ httpStatus: 200, contentType: 'text/html', body: `<html><title>Source page</title><body><p>This source page has a sufficiently detailed factual paragraph about ${url} and a reported official action that can be independently verified before any formal evidence decision.</p><p>The second factual paragraph describes a separate result, time, and limitation for a human researcher to inspect at the original page.</p></body></html>` }),
      writeReport: (value) => { saved = value; }, validateReport: () => undefined,
    }).execute({ maxItems: 5 });
    expect(report).toMatchObject({ requested_count: 2, retrieved_count: 2, failed_count: 0, guardrail_check: { bounded_excerpts_only: true, no_auto_evidence_import: true, parent_branch_separation: true } });
    expect(report.items.every((item) => item.evidence_eligibility === 'context_only' && item.next_action === 'prepare_intake' && item.excerpts.length > 0)).toBe(true);
    expect(report.items.find((item) => item.branch_id === 'bci_medical_rehab')).toMatchObject({ topic_id: 'bci', evidence_eligibility: 'context_only' });
    expect(saved).toBe(report);

    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_source_retrieval_report.schema.json'), 'utf8')) as object;
    const validate = ajv.compile(schema);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });
});
