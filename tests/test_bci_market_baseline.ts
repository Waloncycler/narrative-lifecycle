import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { buildOperationalResearchState } from '@/domain/operational_research_state';
import { normalizeEvidenceImport } from '@/application/evidence_import_normalizer';
import type { EvidenceImportDraft } from '@/types/evidence_import';
import type { TopicRegistry } from '@/types/topic_resolution';

describe('BCI market baseline', () => {
  it('reaches S4 from parent-only label and capital evidence, without importing medical branch progress', () => {
    const drafts = parse(readFileSync(resolve(process.cwd(), 'data/imports/bci_market_baseline_2026_08.yaml'), 'utf8')) as EvidenceImportDraft[];
    const evidence = normalizeEvidenceImport({ drafts, sourceFile: 'data/imports/bci_market_baseline_2026_08.yaml', importedAt: '2026-08-03T00:00:00.000Z' }).map((item) => item.evidence);
    const registry: TopicRegistry = {
      canonical_topics: [{ topic_id: 'bci', topic_name: '脑机接口', market_name_zh: '脑机接口', current_stage: 'S0', status: 'active' }],
      aliases: [], branches: [{ branch_id: 'bci_medical_rehab', topic_id: 'bci', branch_name: '脑机接口医疗康复', status: 'active' }], provisional_topics: [], memory_topic_ids: [],
    };
    const state = buildOperationalResearchState({ registry, evidence, runId: 'run_bci_baseline', generatedAt: '2026-08-03T00:00:00.000Z' });
    expect(state.snapshot.topics[0]).toMatchObject({ current_stage: 'S4', max_allowed_stage: 'S4', topic_name: '脑机接口' });
    expect(state.snapshot.topics[0]?.why_not_higher_stage).toContain('Missing pricing adoption');
    expect(state.snapshot.topics[0]?.why_not_higher_stage).toContain('Missing hard reality evidence');
  });
});
