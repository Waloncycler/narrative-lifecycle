import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateNarrativeGraphPromotions } from '../src/domain/narrative_graph_promotion';
import type { EvidenceNode } from '../src/domain/evidence';
import type { AutonomousResearchPolicy } from '../src/types/autonomous_research';
import type { TopicRegistry } from '../src/types/topic_resolution';

const policy: AutonomousResearchPolicy = {
  policy_id: 'test-autonomy', enabled: true,
  auto_register_provisional_topics: true, auto_register_watch_branches: true,
  auto_promote_provisional_topics: true, auto_activate_watch_branches: true,
  minimum_independent_sources_for_topic_activation: 2,
  minimum_independent_sources_for_branch_activation: 2,
  require_parent_evidence_for_topic_activation: true,
  auto_publish_evidence: true, auto_recompute_stage: true,
  require_model_validation: true, allow_rule_verified_publication: true,
  minimum_evidence_strength: 'E2', minimum_confidence: 'high',
  permitted_source_types: ['official', 'filing', 'research', 'academic', 'company'],
  allow_news_auto_publish: false, require_source_url: true, require_provenance: true,
  hold_parent_branch_risk: true, hold_conflicting_evidence: true, hold_stage_jump_above: 'S4',
};

const registry: TopicRegistry = {
  canonical_topics: [
    { topic_id: 'provisional_synthetic_biology', topic_name: '合成生物学', market_name_zh: '合成生物学', naming_status: 'verified', naming_sources: [{ source_name: 'Test source', source_url: 'https://official.example/name', available_at: '2026-08-03', source_quote: '合成生物学' }], current_stage: 'S0', status: 'provisional' },
    { topic_id: 'innovative_drug_license_out', topic_name: 'Innovative drug license-out', current_stage: 'S4', status: 'active' },
  ],
  aliases: [],
  branches: [{ branch_id: 'innovative_drug_license_out_rc148', topic_id: 'innovative_drug_license_out', branch_name: 'RC148', market_name_zh: 'RC148', naming_status: 'verified', naming_sources: [{ source_name: 'Test source', source_url: 'https://official.example/asset', available_at: '2026-08-03', source_quote: 'RC148' }], status: 'watch' }],
  provisional_topics: [{ provisional_topic_id: 'provisional_synthetic_biology', proposed_name: 'Synthetic biology', source_candidate_id: 'candidate_1', created_at: '2026-08-03T00:00:00.000Z', status: 'provisional', reason: 'New direction.' }],
  memory_topic_ids: [],
};

function evidence(overrides: Partial<EvidenceNode>): EvidenceNode {
  return {
    evidence_id: 'evidence', topic_id: 'provisional_synthetic_biology', branch_id: null,
    event_date: '2026-08-03', available_at: '2026-08-03', event_title: 'Formal validation', event_summary: 'Formal source fact.',
    event_type: 'validation', source_name: 'Official source', source_url: 'https://source.example/a', source_type: 'official',
    evidence_strength: 'E3', affected_layer: ['reality'], stage_effect: 'upgrade_parent', parent_or_branch: 'parent',
    interpretation: 'Verified fact.', limitation: 'No extrapolation.', positive_or_negative: 'positive', confidence: 90,
    ...overrides,
  };
}

function evaluate(rows: EvidenceNode[]) {
  return evaluateNarrativeGraphPromotions({
    registry, evidence: rows, policy, runId: 'run_20260803T000000000_graph', generatedAt: '2026-08-03T00:00:00.000Z',
  });
}

describe('narrative graph autonomous promotion', () => {
  it('activates a provisional topic only after two independent parent-scope formal sources', () => {
    const report = evaluate([
      evidence({ evidence_id: 'topic_a', source_url: 'https://official.example/a' }),
      evidence({ evidence_id: 'topic_b', source_url: 'https://academic.example/b', source_type: 'academic' }),
    ]);
    expect(report.summary.provisional_topics_activated).toBe(1);
    expect(report.items.find((item) => item.node_kind === 'topic')).toMatchObject({
      node_id: 'provisional_synthetic_biology', decision: 'activated', independent_source_count: 2,
    });
  });

  it('allows an asset-like watch branch to accumulate independently without activating its parent topic', () => {
    const report = evaluate([
      evidence({
        evidence_id: 'rc148_a', topic_id: 'innovative_drug_license_out', branch_id: 'innovative_drug_license_out_rc148', parent_or_branch: 'branch',
        source_url: 'https://official.example/rc148-a',
      }),
      evidence({
        evidence_id: 'rc148_b', topic_id: 'innovative_drug_license_out', branch_id: 'innovative_drug_license_out_rc148', parent_or_branch: 'branch',
        source_url: 'https://company.example/rc148-b', source_type: 'company',
      }),
    ]);
    expect(report.summary.watch_branches_activated).toBe(1);
    expect(report.summary.provisional_topics_activated).toBe(0);
    expect(report.items.find((item) => item.node_kind === 'topic')).toMatchObject({ decision: 'held', independent_source_count: 0 });
    expect(report.items.find((item) => item.node_kind === 'branch')?.guardrail_check.branch_does_not_upgrade_parent).toBe(true);
  });

  it('holds a graph transition when formal evidence conflicts, even with enough independent sources', () => {
    const report = evaluate([
      evidence({ evidence_id: 'topic_a', source_url: 'https://official.example/a' }),
      evidence({ evidence_id: 'topic_b', source_url: 'https://official.example/b', positive_or_negative: 'negative', stage_effect: 'downgrade' }),
    ]);
    expect(report.items.find((item) => item.node_kind === 'topic')).toMatchObject({ decision: 'held' });
    expect(report.items.find((item) => item.node_kind === 'topic')?.reasons.join(' ')).toContain('conflicting');
  });

  it('holds a discovered node without a source-backed Chinese market name', () => {
    const unverified = {
      ...registry,
      canonical_topics: registry.canonical_topics.map((topic) => topic.topic_id === 'provisional_synthetic_biology'
        ? { ...topic, naming_status: 'unresolved' as const, naming_sources: [] }
        : topic),
    };
    const report = evaluateNarrativeGraphPromotions({
      registry: unverified,
      evidence: [
        evidence({ evidence_id: 'topic_a', source_url: 'https://official.example/a' }),
        evidence({ evidence_id: 'topic_b', source_url: 'https://academic.example/b', source_type: 'academic' }),
      ],
      policy,
      runId: 'run_20260803T000000000_unverified',
      generatedAt: '2026-08-03T00:00:00.000Z',
    });
    expect(report.items.find((item) => item.node_kind === 'topic')).toMatchObject({ decision: 'held' });
    expect(report.items.find((item) => item.node_kind === 'topic')?.reasons.join(' ')).toContain('source-backed Chinese market name');
  });

  it('emits a schema-valid artifact with no Stage or Score bypass', () => {
    const report = evaluate([]);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(process.cwd(), 'schemas/narrative_graph_promotion_report.schema.json'), 'utf8')) as object);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
    expect(report.guardrail_check).toMatchObject({ evidence_table_required: true, stage_first_score_second: true, no_model_stage_or_score_control: true });
  });
});
