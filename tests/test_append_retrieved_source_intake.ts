import { describe, expect, it } from 'vitest';
import { AppendRetrievedSourceIntakeUseCase } from '@/app/use_cases/append_retrieved_source_intake_use_case';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

const base: EvidenceIntakeSession = {
  session_id: 'session_1', generated_at: '2026-08-09T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_1', source_name: 'direct source', source_kind: 'pasted_text', ingested_at: '2026-08-09T00:00:00.000Z', text: 'Short API summary.', character_count: 18 },
  chunks: [{ chunk_id: 'chunk_1', raw_document_id: 'raw_1', index: 0, text: 'Short API summary.', start_offset: 0, end_offset: 18 }],
  provenance_records: [{ provenance_id: 'prov_1', raw_document_id: 'raw_1', chunk_id: 'chunk_1', quote: 'Short API summary.', quote_start_offset: 0, quote_end_offset: 18, location_label: 'API', extraction_reason: 'test' }],
  candidates: [{
    candidate_id: 'candidate_direct', raw_document_id: 'raw_1', chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: 'Short API summary.',
    suggested_evidence: { evidence_id: 'direct_1', topic_id: 'bci', branch_id: 'bci_medical_rehab', scope: 'branch', event_date: '2026-06-05', available_at: '2026-06-05', event_title: 'BCI trial', event_summary: 'Short API summary.', event_type: 'DIRECT_SOURCE_RECORD', source_name: 'ClinicalTrials.gov', source_url: 'https://clinicaltrials.gov/study/NCT1', source_type: 'official', evidence_strength: 'E1', affected_layer: ['reality'], stage_effect: 'split_branch', polarity: 'neutral', interpretation: 'test', limitation: 'test', confidence: 'medium' },
    suggested_reason: 'test', uncertainty_notes: [], field_explanations: {}, e_strength_rationale: 'test', temporal_provenance: { event_date_source: 'source_metadata', available_at_source: 'source_metadata', requires_operator_confirmation: false }, publication_eligibility: 'rule_verified', guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }], review_template: [],
};

const report = {
  items: [
    { retrieval_id: 'r1', triage_id: 't1', origin_lead_id: 'l1', topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, source_class: 'official', disposition: 'priority_review', title: 'BCI trial', url: 'https://clinicaltrials.gov/study/NCT1', fetched_at: '2026-08-09T00:00:00.000Z', status: 'retrieved', http_status: 200, content_type: 'application/json', page_title: 'BCI trial detail', extractor_id: 'clinicaltrials_api', excerpts: [{ quote: 'The official record reports an active rehabilitation BCI study with defined outcomes and current enrollment.', quote_start_offset: 0, quote_end_offset: 100, location_label: 'Study summary' }], citation_status: 'ready', citation_notes: [], source_text_chars: 200, content_hash: 'x', error: null, evidence_eligibility: 'context_only', next_action: 'prepare_intake' },
    { retrieval_id: 'r2', triage_id: 't2', origin_lead_id: 'l2', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_class: 'academic', disposition: 'review', title: 'BCI methods', url: 'https://arxiv.org/abs/1', fetched_at: '2026-08-09T00:00:00.000Z', status: 'retrieved', http_status: 200, content_type: 'text/html', page_title: 'BCI methods', extractor_id: 'arxiv_abstract', excerpts: [{ quote: 'The study describes a reproducible BCI method and reports its stated experimental limitation in the original abstract.', quote_start_offset: 0, quote_end_offset: 110, location_label: 'Abstract' }], citation_status: 'ready', citation_notes: [], source_text_chars: 200, content_hash: 'y', error: null, evidence_eligibility: 'context_only', next_action: 'prepare_intake' },
  ],
} as unknown as ResearchSourceRetrievalReport;

describe('citation-ready queue advancement', () => {
  it('can isolate an acquisition batch from a large historical intake queue', () => {
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => base, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => undefined,
      validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(report, { freshSession: true })!;
    expect(session.session_id).not.toBe(base.session_id);
    expect(session.candidates.some((candidate) => candidate.candidate_id === 'candidate_direct')).toBe(false);
    expect(session.candidates).toHaveLength(2);
  });

  it('enriches a matching direct candidate and appends a separately governed new source', () => {
    let written: EvidenceIntakeSession | null = null;
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => base, existingEvidenceIds: () => new Set(),
      writeIntakeSession: (session) => { written = session; }, resolveTopics: () => undefined,
      validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(report)!;
    const direct = session.candidates.find((candidate) => candidate.candidate_id === 'candidate_direct')!;
    const retrieved = session.candidates.find((candidate) => candidate.suggested_evidence.source_url === 'https://arxiv.org/abs/1')!;
    expect(direct.original_quote).toContain('official record reports');
    expect(direct.suggested_evidence).toMatchObject({ event_date: '2026-06-05', scope: 'branch', branch_id: 'bci_medical_rehab' });
    expect(direct.publication_eligibility).toBe('rule_verified');
    expect(retrieved).toMatchObject({ publication_eligibility: 'manual_review', temporal_provenance: { requires_operator_confirmation: true } });
    expect(retrieved.suggested_evidence).toMatchObject({ topic_id: 'bci', scope: 'parent', source_type: 'academic' });
    expect((written as EvidenceIntakeSession | null)?.candidates).toHaveLength(2);
  });

  it('keeps a double-source historical recovery at E1 but marks it rule-verified for the existing policy chain', () => {
    let written: EvidenceIntakeSession | null = null;
    const recovered = structuredClone(report);
    recovered.items = [{
      ...recovered.items[1]!,
      title: 'Historic BCI record', url: 'https://arxiv.org/abs/1',
      historical_recovery: {
        legacy_evidence_id: 'legacy_bci_1', event_date: '2024-01-01', scope: 'parent', branch_id: null,
        corroboration_status: 'verified', corroborating_source_urls: ['https://www.gov.cn/notice'], independent_source_hosts: ['arxiv.org', 'www.gov.cn'],
      },
      next_action: 'prepare_intake',
    }, {
      ...recovered.items[1]!,
      retrieval_id: 'r2_corroborator',
      url: 'https://www.gov.cn/notice',
      excerpts: [{ quote: 'A separate official record corroborates the historical event title, date, responsible institution, and bounded scope for independent review.', quote_start_offset: 0, quote_end_offset: 130, location_label: 'Notice' }],
      historical_recovery: undefined,
      next_action: 'hold',
    }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => null, existingEvidenceIds: () => new Set(['legacy_bci_1']),
      writeIntakeSession: (session) => { written = session; }, resolveTopics: () => undefined,
      validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(recovered)!;
    expect(session.candidates[0]).toMatchObject({
      publication_eligibility: 'rule_verified', duplicate_of_evidence_id: 'legacy_bci_1',
      suggested_evidence: { evidence_id: 'legacy_bci_1', event_date: '2024-01-01', scope: 'parent', evidence_strength: 'E1', confidence: 'medium' },
    });
    expect(session.raw_document.text).toContain('Cross-source corroboration: https://www.gov.cn/notice');
    expect(session.candidates).toHaveLength(1);
  });

  it('preserves a governed lead publication date so a citation-ready original page can use the existing E1 policy path', () => {
    const dated = structuredClone(report);
    dated.items = [{ ...dated.items[1]!, source_published_at: '2024-11-14T06:15:05Z', next_action: 'prepare_intake' }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => null, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => undefined, validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(dated)!;
    expect(session.candidates[0]).toMatchObject({
      publication_eligibility: 'rule_verified',
      temporal_provenance: { event_date_source: 'source_metadata', requires_operator_confirmation: false },
      suggested_evidence: { event_date: '2024-11-14', available_at: '2024-11-14', evidence_strength: 'E1', confidence: 'medium' },
    });
  });

  it('maps a dated governed market taxonomy page to perception-only E1 evidence', () => {
    const naming = structuredClone(report);
    naming.items = [{
      ...naming.items[1]!, topic_id: 'solid_state_battery', source_class: 'secondary',
      url: 'https://data.eastmoney.com/bkzj/BK0968.html', source_published_at: '2026-08-14', next_action: 'prepare_intake',
    }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-19T01:00:00.000Z', readLatestSession: () => null, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => undefined, validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(naming, { freshSession: true })!;
    expect(session.candidates[0]).toMatchObject({
      publication_eligibility: 'rule_verified',
      temporal_provenance: { requires_operator_confirmation: false },
      suggested_evidence: { topic_id: 'solid_state_battery', evidence_strength: 'E1', affected_layer: ['name'], confidence: 'medium' },
    });
  });

  it('upgrades a matching low-confidence API pointer after a dated original page is retrieved', () => {
    const pending = structuredClone(base);
    pending.candidates[0]!.publication_eligibility = 'manual_review';
    pending.candidates[0]!.suggested_evidence.confidence = 'low';
    pending.candidates[0]!.temporal_provenance = {
      event_date_source: 'ingested_at', available_at_source: 'ingested_at', requires_operator_confirmation: true,
    };
    const dated = structuredClone(report);
    dated.items = [{ ...dated.items[0]!, source_published_at: '2026-06-05', next_action: 'prepare_intake' }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => pending, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => undefined, validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(dated)!;
    expect(session.candidates[0]).toMatchObject({
      publication_eligibility: 'rule_verified',
      temporal_provenance: { event_date_source: 'source_metadata', requires_operator_confirmation: false },
      suggested_evidence: { event_type: 'RETRIEVED_SOURCE_EXCERPT', event_date: '2026-06-05', confidence: 'medium' },
    });
  });

  it('can append a curated research-pack candidate without auto-registering its proposed topic', () => {
    let resolverCalls = 0;
    const curated = structuredClone(report);
    curated.items = [{ ...curated.items[1]!, topic_id: null, branch_id: null, candidate_node_id: 'china_innovative_drugs_domestic_access', next_action: 'prepare_intake' }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => null, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => { resolverCalls += 1; }, validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const session = useCase.execute(curated, { resolveTopics: false })!;
    expect(session.candidates[0]?.suggested_evidence.topic_id).toBe('provisional_china_innovative_drugs_domestic_access');
    expect(resolverCalls).toBe(0);
  });

  it('replaces a news lead with two-source primary provenance without changing branch scope', () => {
    const pending = structuredClone(base);
    pending.candidates[0]!.suggested_evidence.source_type = 'news';
    pending.candidates[0]!.suggested_evidence.source_url = 'https://finance.sina.com.cn/news/1';
    pending.candidates[0]!.publication_eligibility = 'manual_review';
    const verified = structuredClone(report);
    verified.items = [{
      ...verified.items[0]!, url: 'https://www.fda.gov/drugs/approval', topic_id: 'bci', branch_id: 'bci_medical_rehab', next_action: 'prepare_intake',
      news_corroboration: { news_candidate_id: 'candidate_direct', seed_source_url: 'https://finance.sina.com.cn/news/1', corroboration_status: 'verified', claim_similarity: 0.8, corroborating_source_urls: ['https://company.example.com/newsroom/approval'], independent_source_hosts: ['www.fda.gov', 'company.example.com'] },
    }, { ...verified.items[0]!, retrieval_id: 'r_company', url: 'https://company.example.com/newsroom/approval', next_action: 'hold' }];
    const useCase = new AppendRetrievedSourceIntakeUseCase({
      now: () => '2026-08-09T01:00:00.000Z', readLatestSession: () => pending, existingEvidenceIds: () => new Set(),
      writeIntakeSession: () => undefined, resolveTopics: () => undefined, validateSession: () => undefined, validateCandidate: () => undefined,
    });
    const output = useCase.execute(verified)!;
    expect(output.candidates[0]).toMatchObject({
      publication_eligibility: 'rule_verified',
      suggested_evidence: { topic_id: 'bci', branch_id: 'bci_medical_rehab', scope: 'branch', stage_effect: 'split_branch', source_type: 'official', evidence_strength: 'E1' },
    });
    expect(output.raw_document.text).toContain('Cross-source corroboration');
  });
});
