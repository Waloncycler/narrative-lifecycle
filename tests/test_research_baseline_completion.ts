import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { buildResearchBaselineCompletion } from '@/features/research/domain/research_baseline_completion';
import { buildResearchCampaign } from '@/features/research/domain/research_coverage';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { AuthoritativeSourceAtlas, ResearchUniverse } from '@/features/research/types/research_coverage';

const registry: TopicRegistry = {
  canonical_topics: [
    { topic_id: 'mature_topic', topic_name: 'Mature topic', market_name_zh: '成熟主题', market_name_en: 'Mature topic', current_stage: 'S0', status: 'active', naming_status: 'provisional' },
    { topic_id: 'supported_topic', topic_name: 'Supported topic', market_name_zh: '已支持主题', current_stage: 'S4', status: 'active', naming_status: 'verified', naming_sources: [{ source_name: 'official', source_url: 'https://example.test/name', available_at: '2026-08-01', source_quote: '已支持主题' }] },
  ],
  aliases: [],
  branches: [
    { branch_id: 'bad_branch', topic_id: 'mature_topic', branch_name: 'NCT07530367', status: 'watch', naming_status: 'unresolved' },
    { branch_id: 'good_branch', topic_id: 'supported_topic', branch_name: '医疗康复', status: 'active', naming_status: 'verified', naming_sources: [{ source_name: 'official', source_url: 'https://example.test/branch', available_at: '2026-08-01', source_quote: '医疗康复' }] },
  ],
  provisional_topics: [], memory_topic_ids: [],
};

const snapshot = {
  snapshot_id: 'snapshot_1',
  topics: [
    { topic_id: 'mature_topic', current_stage: 'S0', evidence_ids: [] },
    { topic_id: 'supported_topic', current_stage: 'S4', evidence_ids: ['evidence_1'] },
  ],
} as unknown as StageSnapshotHistory;

describe('research baseline completion', () => {
  it('turns missing parent evidence and unverified names into context-only research work without altering lifecycle state', () => {
    const report = buildResearchBaselineCompletion({ snapshot, registry, generatedAt: '2026-08-04T00:00:00.000Z', producerVersion: 'test' });
    expect(report.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'parent_evidence_baseline', topic_id: 'mature_topic', branch_id: null, priority: 'high', required_layers: expect.arrayContaining(['name', 'capital', 'pricing', 'reality']) }),
      expect.objectContaining({ kind: 'topic_name_verification', topic_id: 'mature_topic' }),
      expect.objectContaining({ kind: 'branch_name_verification', branch_id: 'bad_branch', display_name_zh: '成熟主题' }),
    ]));
    expect(report.items.every((item) => item.evidence_eligibility === 'context_only')).toBe(true);
    expect(report.guardrail_check).toMatchObject({ existing_stage_unchanged: true, no_auto_evidence_import: true, parent_branch_separation: true, no_auto_registry_name_mutation: true });
  });

  it('is schema-valid and boosts only the missing parent-evidence topic in a campaign', () => {
    const report = buildResearchBaselineCompletion({ snapshot, registry, generatedAt: '2026-08-04T00:00:00.000Z', producerVersion: 'test' });
    const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/research_baseline_completion_report.schema.json'), 'utf8')) as object;
    expect(ajv.compile(schema)(report)).toBe(true);

    const atlas: AuthoritativeSourceAtlas = { atlas_version: 'test', sources: [{ source_id: 'official', display_name_zh: '官方', display_name_en: 'Official', operator: 'Official', authority_tier: 'regulator', domains: ['cross_industry'], coverage_layers: ['name', 'capital', 'pricing', 'reality'], access_mode: 'direct_api', base_url: 'https://example.test', terms_url: 'https://example.test/terms', automated_polling_allowed: true, review_required: true, evidence_ceiling: 'E3', topic_discovery_capable: true, branch_discovery_capable: true, languages: ['zh'] }] };
    const universe: ResearchUniverse = { universe_version: 'test', nodes: [] };
    const campaign = buildResearchCampaign({ registry, atlas, universe, generatedAt: '2026-08-04T00:00:00.000Z', producerVersion: 'test', maxTasks: 20, baselineCompletion: report });
    const mature = campaign.tasks.find((task) => task.topic_id === 'mature_topic');
    const supported = campaign.tasks.find((task) => task.topic_id === 'supported_topic');
    expect(mature?.priority).toBe(125);
    expect(mature?.target_layers).toEqual(expect.arrayContaining(['name', 'capital', 'pricing', 'reality']));
    expect(supported?.priority).toBe(95);
  });
});
