import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildResearchPackTriage, selectResearchPackRetrievalTargets } from '@/features/research/domain/research_pack';
import { RunResearchPackUseCase } from '@/app/use_cases/run_research_pack_use_case';
import type { ResearchPack } from '@/features/research/types/research_pack';

const generatedAt = '2026-08-09T10:00:00.000Z';
const pack: ResearchPack = {
  pack_id: 'test_innovative_drugs', title: 'Test pack', description: 'Test curated primary sources.', research_questions: ['Can sources be retrieved safely?'],
  proposed_taxonomy: { parent_name: 'China innovative drugs', parent_topic_id: null, proposed_branches: [{ branch_name: 'License-out', branch_id: 'innovative_drug_license_out', rationale: 'Separate capital evidence.' }] },
  sources: [
    { source_id: 'parent_official', title: 'Official parent source', url: 'https://official.example/parent', published_at: '2026-07-14', topic_id: 'innovative_drug_license_out', branch_id: null, candidate_node_id: null, source_class: 'official', rationale: 'Parent source.' },
    { source_id: 'branch_company', title: 'Company branch source', url: 'https://company.example/branch', published_at: '2026-07-15', topic_id: 'innovative_drug_license_out', branch_id: 'adc_license_out', candidate_node_id: null, source_class: 'company_primary', rationale: 'Branch source.' },
    { source_id: 'secondary_pointer', title: 'Secondary pointer', url: 'https://news.example/pointer', published_at: '2026-07-15', topic_id: null, branch_id: null, candidate_node_id: 'new_innovation', source_class: 'secondary', rationale: 'Locator only.' },
  ],
  guardrail_check: { source_urls_are_retrieval_targets_not_evidence: true, proposed_taxonomy_is_not_auto_registered: true, parent_branch_separation: true, no_auto_evidence_import: true, no_trading_advice: true },
};

describe('research pack retrieval', () => {
  it('keeps proposed taxonomy and branch sources out of parent promotion while selecting only primary sources', () => {
    const triage = buildResearchPackTriage({ pack, generatedAt, producerVersion: 'v0.test' });
    expect(triage.items).toHaveLength(3);
    expect(triage.items.find((item) => item.branch_id === 'adc_license_out')).toMatchObject({ topic_id: 'innovative_drug_license_out', evidence_eligibility: 'context_only' });
    expect(triage.items.find((item) => item.candidate_node_id === 'new_innovation')).toMatchObject({ disposition: 'hold' });
    expect(selectResearchPackRetrievalTargets(triage, 10).map((item) => item.triage_id)).toHaveLength(2);
  });

  it('produces schema-valid bounded retrieval artifacts without importing evidence', async () => {
    let saved: unknown;
    const report = await new RunResearchPackUseCase({
      now: () => generatedAt, producerVersion: () => 'v0.test', readPack: () => pack, validatePack: () => undefined,
      retrieve: async ({ url }) => ({ httpStatus: 200, contentType: 'text/html', body: `<html><title>Original ${url}</title><body><p>This original primary source describes a signed action, responsible party, date, concrete scope, and a limitation that a researcher can independently inspect before formal Evidence review.</p><p>A second detailed factual paragraph remains available for citation and confirms that a source package is not a lifecycle conclusion.</p></body></html>` }),
      validateRetrieval: () => undefined, validateReport: () => undefined, writeReport: (value) => { saved = value; },
    }).execute({ file: 'data/research_packs/test.yaml' });
    expect(report.retrieval).toMatchObject({ requested_count: 2, retrieved_count: 2, guardrail_check: { no_auto_evidence_import: true, parent_branch_separation: true } });
    expect(report.retrieval.items.every((item) => item.evidence_eligibility === 'context_only')).toBe(true);
    expect(report.proposed_taxonomy.parent_topic_id).toBeNull();
    expect(saved).toBe(report);
    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_pack_retrieval_report.schema.json'), 'utf8')) as object;
    expect(ajv.compile(schema)(report)).toBe(true);
  });
});
