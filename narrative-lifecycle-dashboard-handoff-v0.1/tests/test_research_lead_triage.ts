import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildResearchLeadTriage } from '../src/domain/research_lead_triage';
import type { AuthoritativeSourceAtlas, CompanyResearchRegistry } from '../src/types/research_coverage';
import type { DirectSourceResearchReport } from '../src/types/direct_source_research';
import type { WebResearchReport } from '../src/types/web_research';

const generatedAt = '2026-08-04T00:00:00.000Z';
const sourceAtlas: AuthoritativeSourceAtlas = {
  atlas_version: 'test',
  sources: [{
    source_id: 'fda', display_name_zh: '美国食品药品监督管理局', display_name_en: 'FDA', operator: 'FDA', authority_tier: 'regulator', domains: ['fda.gov'], coverage_layers: ['reality'], access_mode: 'direct_api', base_url: 'https://www.fda.gov/', terms_url: 'https://www.fda.gov/', automated_polling_allowed: true, review_required: true, evidence_ceiling: 'E3', topic_discovery_capable: false, branch_discovery_capable: true, languages: ['en'],
  }],
};
const companies: CompanyResearchRegistry = { registry_version: 'test', companies: [] };

function webReport(): WebResearchReport {
  return {
    artifact_type: 'web_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'web_1', generated_at: generatedAt, status: 'completed', provider: 'free',
    queries: [
      { query_id: 'parent_query', query: 'Brain-computer interface', topic_id: 'bci', branch_id: null, candidate_node_id: null, purpose: 'evidence_discovery' },
      { query_id: 'branch_query', query: 'Brain-computer interface rehabilitation', topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, purpose: 'evidence_discovery' },
      { query_id: 'seed_query', query: 'Quantum sensing', topic_id: null, branch_id: null, candidate_node_id: 'quantum_sensing', purpose: 'evidence_discovery' },
    ],
    lead_count: 3,
    leads: [
      { lead_id: 'web_parent', query_id: 'parent_query', topic_id: 'bci', branch_id: null, candidate_node_id: null, title: 'Brain-computer interface regulatory update', url: 'https://www.fda.gov/bci?utm_source=search', source_name: 'FDA', source_domain: 'www.fda.gov', snippet: 'Brain-computer interface update.', published_at: '2026-07-25', retrieved_at: generatedAt, rank: 1, evidence_eligibility: 'context_only', next_action: 'review_source' },
      { lead_id: 'web_branch', query_id: 'branch_query', topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, title: 'Brain-computer interface rehabilitation update', url: 'https://www.fda.gov/bci', source_name: 'FDA', source_domain: 'www.fda.gov', snippet: 'Brain-computer interface rehabilitation update.', published_at: '2026-07-25', retrieved_at: generatedAt, rank: 1, evidence_eligibility: 'context_only', next_action: 'review_source' },
      { lead_id: 'web_seed', query_id: 'seed_query', topic_id: null, branch_id: null, candidate_node_id: 'quantum_sensing', title: 'Quantum sensing overview', url: 'https://en.wikipedia.org/wiki/Quantum_sensing', source_name: 'Wikipedia', source_domain: 'en.wikipedia.org', snippet: 'Quantum sensing overview.', published_at: null, retrieved_at: generatedAt, rank: 1, evidence_eligibility: 'context_only', next_action: 'review_source' },
    ],
    errors: [],
    guardrail_check: { search_snippets_not_formal_evidence: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
  };
}

function directReport(): DirectSourceResearchReport {
  return {
    artifact_type: 'direct_source_research_report', schema_version: '1.0.0', producer_version: 'test', research_id: 'direct_1', generated_at: generatedAt, status: 'completed', queries: [], lead_count: 1,
    leads: [{ lead_id: 'direct_parent', task_id: 'campaign_bci', topic_id: 'bci', branch_id: null, candidate_node_id: null, source_id: 'fda', source_name: 'FDA', title: 'Brain-computer interface regulatory update', url: 'https://www.fda.gov/bci', snippet: 'Original regulator record.', published_at: '2026-07-25', evidence_eligibility: 'context_only', next_action: 'review_source' }],
    guardrail_check: { direct_source_results_not_formal_evidence: true, original_source_url_required: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_auto_import: true, no_trading_advice: true },
  };
}

describe('research lead triage', () => {
  it('is schema-valid, deduplicates only within scope, and never grants evidence eligibility', () => {
    const report = buildResearchLeadTriage({ webResearch: webReport(), directResearch: directReport(), sourceAtlas, companies, generatedAt, producerVersion: 'v0.test' });
    const parent = report.items.find((item) => item.topic_id === 'bci' && item.branch_id === null)!;
    const branch = report.items.find((item) => item.branch_id === 'bci_medical_rehab')!;
    const seed = report.items.find((item) => item.candidate_node_id === 'quantum_sensing')!;

    expect(report).toMatchObject({ input_lead_count: 4, triaged_lead_count: 3, guardrail_check: { no_auto_evidence_import: true, parent_branch_separation: true } });
    expect(parent).toMatchObject({ origin: 'direct', source_class: 'official', disposition: 'priority_review', evidence_eligibility: 'context_only' });
    expect(parent.duplicate_origin_lead_ids).toEqual(['web_parent']);
    expect(branch).toMatchObject({ topic_id: 'bci', branch_id: 'bci_medical_rehab', disposition: 'priority_review', evidence_eligibility: 'context_only' });
    expect(branch.reasons).toContain('保持分支 scope，不得升级父主题');
    expect(seed).toMatchObject({ topic_id: null, candidate_node_id: 'quantum_sensing', disposition: 'reference_only', evidence_eligibility: 'context_only' });
    expect(seed.reasons).toContain('研究种子仅作 provisional 候选，不继承正式主题阶段');

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_lead_triage_report.schema.json'), 'utf8')) as object;
    const validate = ajv.compile(schema);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });

  it('classifies official stock exchange disclosures and regulatory domains as official source class', () => {
    const customWebReport: WebResearchReport = {
      ...webReport(),
      leads: [
        { lead_id: 'lead_hkex', query_id: 'parent_query', topic_id: 'bci', branch_id: null, candidate_node_id: null, title: 'HKEX Brain-computer interface disclosure notice', url: 'https://www.hkexnews.hk/listedco/listconews/sehk/2026/0807/123.pdf', source_name: 'HKEX', source_domain: 'www.hkexnews.hk', snippet: 'HKEX official Brain-computer interface disclosure document.', published_at: '2026-08-07', retrieved_at: generatedAt, rank: 1, evidence_eligibility: 'context_only', next_action: 'review_source' },
      ],
      lead_count: 1,
    };
    const report = buildResearchLeadTriage({ webResearch: customWebReport, directResearch: null, sourceAtlas, companies, generatedAt, producerVersion: 'v0.test' });
    expect(report.items[0]).toMatchObject({ source_class: 'official', disposition: 'priority_review', evidence_eligibility: 'context_only' });
  });
});
