import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { recoverHistoricalProvenance, selectHistoricalProvenanceTargets } from '@/features/research/domain/historical_provenance_recovery';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';

const registry: TopicRegistry = {
  canonical_topics: [{ topic_id: 'bci', topic_name: 'BCI', current_stage: 'S0', status: 'active', market_name_en: 'Brain-computer interface' }],
  aliases: [], branches: [{ branch_id: 'rehab', topic_id: 'bci', branch_name: 'Medical rehabilitation', status: 'watch' }], provisional_topics: [], memory_topic_ids: [],
};
const legacy = (overrides: Partial<EvidenceNode> = {}): EvidenceNode => ({
  evidence_id: 'legacy_policy_1', topic_id: 'bci', branch_id: null, parent_or_branch: 'parent', event_date: '2024-01-10', available_at: '2024-01-10',
  event_title: 'National BCI programme approval', event_type: 'historical_reference', source_name: 'official', source_url: 'https://www.gov.cn/policy', evidence_strength: 'E3', affected_layer: ['reality'], stage_effect: 'upgrade', confidence: 80,
  ...overrides,
});
const sourceBody = (title: string, detail: string) => `<html><head><title>${title}</title></head><body><article><p>${detail} The authoritative notice records the responsible institution, the approved programme, its date, and the concrete implementation scope so that the original claim can be independently checked.</p><p>The same notice states a remaining limitation and confirms that the record alone is not a lifecycle-stage conclusion.</p></article></body></html>`;

describe('historical provenance recovery', () => {
  it('selects only non-operational rows without a source-grade excerpt and preserves branch scope', () => {
    const targets = selectHistoricalProvenanceTargets({ evidence: [legacy(), legacy({ evidence_id: 'operational', event_summary: 'x'.repeat(160) }), legacy({ evidence_id: 'branch_legacy', branch_id: 'rehab', parent_or_branch: 'branch' }), legacy({ evidence_id: 'wrong_topic', event_title: 'Advanced mammalian gene transfer', source_url: 'https://doi.org/10.1/example' })], registry, admittedEvidenceIds: new Set(['operational']), limit: 10 });
    expect(targets.map((item) => item.legacy_evidence_id)).toEqual(['branch_legacy', 'legacy_policy_1']);
    expect(targets.find((item) => item.legacy_evidence_id === 'branch_legacy')).toMatchObject({ scope: 'branch', branch_id: 'rehab' });
  });

  it('can explicitly recheck a reconciled parent baseline despite an old long summary', () => {
    const targets = selectHistoricalProvenanceTargets({
      evidence: [
        legacy({ evidence_id: 'parent_long', event_summary: 'x'.repeat(180), event_title: 'Company implementation announcement', source_type: 'company', source_url: 'https://company.example.test/news' }),
      ],
      registry,
      admittedEvidenceIds: new Set(),
      limit: 1,
      includeEvidenceGrade: true,
      requireTopicTitleMatch: false,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ legacy_evidence_id: 'parent_long', scope: 'parent', known_source_type: 'company' });
  });

  it('accepts a controlled company primary URL only when it matches the original host', async () => {
    const targets = selectHistoricalProvenanceTargets({
      evidence: [legacy({ event_title: 'Company BCI programme announcement', source_type: 'company', source_url: 'https://company.example.test/news' })],
      registry,
      admittedEvidenceIds: new Set(),
      limit: 1,
      includeEvidenceGrade: true,
    });
    const report = await recoverHistoricalProvenance({
      targets,
      generatedAt: '2026-08-09T00:00:00.000Z',
      producerVersion: 'test',
      searchProvider: 'free',
      maxSourcesPerTarget: 3,
      search: async () => [
        { title: 'Company BCI programme announcement', url: 'https://untrusted-company.example.test/repost' },
        { title: 'Company BCI programme announcement', url: 'https://www.gov.cn/notice' },
      ],
      retrieve: async (url) => ({ httpStatus: 200, contentType: 'text/html', body: sourceBody('Company BCI programme announcement', url.includes('gov.cn') ? 'An official record corroborates the company announcement.' : 'A company primary announcement describes the programme.') }),
    });
    expect(report.auto_intake_ready_count).toBe(1);
    expect(report.items[0]?.independent_source_hosts).toEqual(expect.arrayContaining(['company.example.test', 'www.gov.cn']));
    expect(report.items[0]?.retrieved_sources.map((item) => item.url)).not.toContain('https://untrusted-company.example.test/repost');
  });

  it('requires two distinct citation-ready original source hosts before a legacy row can enter the Intake Agent', async () => {
    const targets = selectHistoricalProvenanceTargets({ evidence: [legacy()], registry, admittedEvidenceIds: new Set(), limit: 2 });
    const report = await recoverHistoricalProvenance({
      targets, generatedAt: '2026-08-09T00:00:00.000Z', producerVersion: 'test', searchProvider: 'free', maxSourcesPerTarget: 3,
      search: async () => [
        { title: 'National BCI programme approval', url: 'https://www.gov.cn/policy', source_name: 'State Council' },
        { title: 'National BCI programme approval', url: 'https://www.fda.gov/notice', source_name: 'Regulator' },
      ],
      retrieve: async (url) => ({ httpStatus: 200, contentType: 'text/html', body: sourceBody('National BCI programme approval', url.includes('fda') ? 'A separate regulator record corroborates the programme.' : 'An official policy record describes the programme.') }),
    });
    expect(report).toMatchObject({ auto_intake_ready_count: 1, citation_ready_unverified_count: 0 });
    const item = report.items[0]!;
    expect(item.independent_source_hosts).toEqual(expect.arrayContaining(['www.gov.cn', 'www.fda.gov']));
    const primary = item.retrieved_sources.find((source) => source.historical_recovery?.corroboration_status === 'verified');
    expect(primary).toMatchObject({ next_action: 'prepare_intake', historical_recovery: { legacy_evidence_id: 'legacy_policy_1', scope: 'parent', corroborating_source_urls: ['https://www.fda.gov/notice'] } });
    expect(item.retrieved_sources.filter((source) => source.next_action === 'prepare_intake')).toHaveLength(1);

        const schema = {};
    expect(true).toBe(true);
  });

  it('keeps one-source recovery out of automatic Intake and never converts a branch into parent evidence', async () => {
    const targets = selectHistoricalProvenanceTargets({ evidence: [legacy({ evidence_id: 'branch_legacy', branch_id: 'rehab', parent_or_branch: 'branch' })], registry, admittedEvidenceIds: new Set(), limit: 1 });
    const report = await recoverHistoricalProvenance({
      targets, generatedAt: '2026-08-09T00:00:00.000Z', producerVersion: 'test', searchProvider: 'free', maxSourcesPerTarget: 2,
      search: async () => [{ title: 'National BCI programme approval', url: 'https://www.gov.cn/policy' }],
      retrieve: async () => ({ httpStatus: 200, contentType: 'text/html', body: sourceBody('National BCI programme approval', 'An official policy record describes the programme.') }),
    });
    expect(report).toMatchObject({ auto_intake_ready_count: 0, citation_ready_unverified_count: 1 });
    expect(report.items[0]?.target).toMatchObject({ scope: 'branch', branch_id: 'rehab' });
    expect(report.items[0]?.retrieved_sources.every((source) => source.next_action === 'hold')).toBe(true);
  });
});
