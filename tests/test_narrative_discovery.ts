import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyNarrativeDiscoveryMappings, discoverNarrativeGraph } from '@/domain/narrative_discovery';
import type { EvidenceIntakeSession } from '@/types/intake';
import type { TopicRegistry } from '@/types/topic_resolution';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const registry: TopicRegistry = {
  canonical_topics: [
    { topic_id: 'bci', topic_name: 'Brain computer interface', current_stage: 'S4', status: 'active' },
    { topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', current_stage: 'S4', status: 'active' },
    { topic_id: 'innovative_drug_license_out', topic_name: 'Innovative drug license out', current_stage: 'S4', status: 'active' },
  ],
  aliases: [
    { alias: 'brain-computer interface', topic_id: 'bci', reason: 'Common name.' },
    { alias: 'licensing deal', topic_id: 'innovative_drug_license_out', reason: 'Common deal label.' },
  ],
  branches: [
    { branch_id: 'bci_medical_rehab', topic_id: 'bci', branch_name: 'medical rehabilitation', status: 'active' },
  ],
  provisional_topics: [],
  memory_topic_ids: ['bci'],
};

function session(input: { text: string; topicId?: string; branchId?: string | null; scope?: 'parent' | 'branch' }): EvidenceIntakeSession {
  const topicId = input.topicId ?? 'unknown_topic';
  const branchId = input.branchId ?? null;
  const text = input.text;
  return {
    session_id: `session_${topicId}`,
    generated_at: '2026-08-03T00:00:00.000Z',
    raw_document: { raw_document_id: `raw_${topicId}_${text.length}`, source_name: 'test source', source_kind: 'pasted_text', ingested_at: '2026-08-03T00:00:00.000Z', text, character_count: text.length },
    chunks: [],
    provenance_records: [{ provenance_id: 'prov_1', raw_document_id: `raw_${topicId}_${text.length}`, chunk_id: 'chunk_1', quote: text, quote_start_offset: 0, quote_end_offset: text.length, location_label: 'source', extraction_reason: 'test' }],
    candidates: [{
      candidate_id: 'candidate_1', raw_document_id: `raw_${topicId}_${text.length}`, chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: text,
      suggested_evidence: {
        evidence_id: 'evidence_1', topic_id: topicId, branch_id: branchId, scope: input.scope ?? (branchId ? 'branch' : 'parent'), event_date: '2026-08-03', available_at: '2026-08-03', event_title: text.slice(0, 80), event_summary: text, event_type: 'test', source_name: 'test source', source_type: 'research', evidence_strength: 'E2', affected_layer: ['reality'], stage_effect: 'maintain', polarity: 'positive', interpretation: 'Test interpretation.', limitation: 'Test limitation.', confidence: 'medium',
      },
      suggested_reason: 'test', uncertainty_notes: ['test'], field_explanations: {}, e_strength_rationale: 'test', guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
    }],
    review_template: [],
  };
}

describe('narrative graph discovery', () => {
  it('discovers a new branch from Chinese source language, maps it as branch-only, and never changes the parent stage', () => {
    const source = session({ text: '脑机接口在家庭康复场景完成了患者随访验证。这一家庭康复应用仍是 BCI 的独立分支。' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records).toHaveLength(1);
    expect(report.records[0]).toMatchObject({ resolution: 'new_branch', topic_id: 'bci', scope: 'branch', branch_name: '家庭康复', registration_action: 'watch_branch' });

    const mapped = applyNarrativeDiscoveryMappings(source, report);
    expect(mapped.candidates[0].suggested_evidence).toMatchObject({ topic_id: 'bci', scope: 'branch', stage_effect: 'split_branch' });
    expect(mapped.candidates[0].suggested_evidence.limitation).toContain('cannot upgrade the parent');
    expect(report.guardrail_check.parent_stage_unchanged).toBe(true);
  });

  it('finds a new English branch from a generic application signal rather than relying on a hard-coded industry taxonomy', () => {
    const source = session({ text: 'Humanoid robotics warehouse logistics applications completed customer pilot validation.', topicId: 'humanoid_robotics' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'new_branch', topic_id: 'humanoid_robotics', scope: 'branch', branch_name: 'warehouse logistics' });
  });

  it('turns a source-named molecule or asset into a separately accumulating watch branch', () => {
    const source = session({
      text: 'AbbVie announced a licensing agreement for RemeGen\'s RC148 for advanced solid tumors.',
      topicId: 'innovative_drug_license_out',
    });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({
      resolution: 'new_branch', topic_id: 'innovative_drug_license_out', branch_id: 'innovative_drug_license_out_rc148', branch_name: 'RC148', scope: 'branch',
    });
    const mapped = applyNarrativeDiscoveryMappings(source, report);
    expect(mapped.candidates[0].suggested_evidence).toMatchObject({ branch_id: 'innovative_drug_license_out_rc148', scope: 'branch', stage_effect: 'split_branch' });
  });

  it('maps a near-duplicate label to an existing branch instead of creating a second branch', () => {
    const source = session({ text: 'Brain-computer interface medical rehabilitation therapy reported follow-up validation.', topicId: 'bci' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'existing_branch', topic_id: 'bci', branch_id: 'bci_medical_rehab', registration_action: 'none' });
  });

  it('uses model-proposed provisional topics without treating their branch as an active topic or stage', () => {
    const source = session({ text: 'Synthetic biology biofoundry services opened a new application direction.', topicId: 'provisional_synthetic_biology', branchId: 'biofoundry_services', scope: 'branch' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'new_provisional_topic', topic_id: 'provisional_synthetic_biology', scope: 'branch', branch_id: 'biofoundry_services', registration_action: 'provisional_topic_and_watch_branch' });
    expect(report.records[0].guardrail_check.provisional_does_not_inherit_stage).toBe(true);
  });

  it('normalizes a source-grounded plain model topic into a provisional topic instead of losing it as unresolved', () => {
    const source = session({ text: 'Innovative drug approvals opened a distinct new direction.', topicId: 'innovative_drug_approval' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'new_provisional_topic', topic_id: 'provisional_innovative_drug_approval', scope: 'parent', registration_action: 'provisional_topic' });
  });

  it('deduplicates the same discovered branch across documents and accumulates independent support', () => {
    const first = session({ text: 'BCI sports rehabilitation application completed clinic validation.' });
    const previous = discoverNarrativeGraph({ session: first, registry, priorRecords: [], generatedAt: first.generated_at });
    const second = session({ text: 'Brain-computer interface sports rehabilitation therapy added an independent hospital follow-up.', topicId: 'bci' });
    second.raw_document.raw_document_id = 'raw_second';
    second.candidates[0].raw_document_id = 'raw_second';
    second.provenance_records[0].raw_document_id = 'raw_second';
    const report = discoverNarrativeGraph({ session: second, registry, priorRecords: previous.records, generatedAt: '2026-08-04T00:00:00.000Z' });
    expect(report.records[0]).toMatchObject({ resolution: 'new_branch', branch_name: 'sports rehabilitation', support_count: 2, independent_document_count: 2 });
  });

  it('keeps support accumulation after a registered branch resolves as existing', () => {
    const first = session({ text: 'BCI sports rehabilitation application completed clinic validation.' });
    const previous = discoverNarrativeGraph({ session: first, registry, priorRecords: [], generatedAt: first.generated_at });
    const registryAfterRegistration: TopicRegistry = { ...registry, branches: [...registry.branches, { branch_id: previous.records[0].branch_id as string, topic_id: 'bci', branch_name: 'sports rehabilitation', status: 'watch' }] };
    const second = session({ text: 'Brain-computer interface sports rehabilitation therapy added hospital follow-up.', topicId: 'bci' });
    second.raw_document.raw_document_id = 'raw_second_existing';
    second.candidates[0].raw_document_id = 'raw_second_existing';
    second.provenance_records[0].raw_document_id = 'raw_second_existing';
    const report = discoverNarrativeGraph({ session: second, registry: registryAfterRegistration, priorRecords: previous.records, generatedAt: '2026-08-04T00:00:00.000Z' });
    expect(report.records[0]).toMatchObject({ resolution: 'existing_branch', branch_id: previous.records[0].branch_id, support_count: 2, independent_document_count: 2 });
  });

  it('keeps broad or ambiguous material unresolved instead of forcing a branch', () => {
    const source = session({ text: 'The industry may change over time and researchers discussed several opportunities.' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'unresolved', topic_id: null, branch_id: null, registration_action: 'none' });
  });

  it('rejects generic Chinese coverage language as a branch label', () => {
    const source = session({ text: '脑机接口覆盖范围广泛应用，研究者尚未说明具体场景。' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'unresolved', topic_id: null, branch_id: null });
  });

  it('rejects model prompt debris instead of registering it as a market branch', () => {
    const source = session({ text: '脑机接口第三个对话窗口里研究发布方案完成了讨论。' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'unresolved', topic_id: null, branch_id: null });
  });

  it('checks narrative memory before proposing an old topic as new', () => {
    const source = session({ text: 'The old BCI theme returns again through a medical rehabilitation follow-up.', topicId: 'bci' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    expect(report.records[0]).toMatchObject({ resolution: 'reactivation', topic_id: 'bci', registration_action: 'none' });
  });

  it('emits a schema-valid, research-only discovery artifact', () => {
    const source = session({ text: 'Humanoid robotics warehouse logistics applications completed customer pilot validation.', topicId: 'humanoid_robotics' });
    const report = discoverNarrativeGraph({ session: source, registry, priorRecords: [], generatedAt: source.generated_at });
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/narrative_discovery_report.schema.json'), 'utf8')) as object);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
    expect(report.guardrail_check).toMatchObject({ parent_stage_unchanged: true, branch_evidence_isolated: true, no_trading_advice: true });
  });
});
