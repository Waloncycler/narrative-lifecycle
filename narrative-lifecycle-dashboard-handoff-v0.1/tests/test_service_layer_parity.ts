import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidenceImportDrafts } from '../src/domain/evidence_import_rules';
import { classifyStage as classifyStageDomain } from '../src/domain/stage_classifier';
import { buildStageDiff as buildStageDiffDomain } from '../src/domain/stage_diff_engine';
import { normalizeEvidenceImport as normalizeEvidenceImportApplication } from '../src/application/evidence_import_normalizer';
import { loadEvidenceImportDraft } from '../src/services/evidence_import_loader';
import { normalizeEvidenceImport as normalizeEvidenceImportService } from '../src/services/evidence_import_normalizer';
import { classifyStage as classifyStageService } from '../src/services/stage_classifier';
import { buildStageDiff as buildStageDiffService } from '../src/services/stage_diff_engine';
import type { EvidenceNode } from '../src/domain/evidence';
import type { StageSnapshotHistory, StageSnapshotTopic } from '../src/types/diff';
import { artifactMetadata } from '../src/types/artifact_contract';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function evidence(): EvidenceNode[] {
  return [
    { evidence_id: 'label', topic_id: 'topic', event_date: '2026-07-01', available_at: '2026-07-01', event_title: 'label', event_type: 'label', source_name: 'fixture', evidence_strength: 'E3', affected_layer: ['perception'], stage_effect: 'supports_S4', parent_or_branch: 'parent' },
    { evidence_id: 'capital', topic_id: 'topic', event_date: '2026-07-01', available_at: '2026-07-01', event_title: 'capital', event_type: 'capital', source_name: 'fixture', evidence_strength: 'E3', affected_layer: ['capital'], stage_effect: 'supports_S4', parent_or_branch: 'parent' },
  ];
}

function topic(stage: string): StageSnapshotTopic {
  return {
    topic_id: 'topic',
    topic_name: 'Topic',
    parent_narrative: 'Topic',
    current_stage: stage,
    gate_stage: stage,
    max_allowed_stage: stage,
    strongest_branch: 'none',
    weakest_layer: 'pricing',
    data_confidence: 'medium',
    evidence_ids: ['label', 'capital'],
    score_id: 'score_topic',
    dashboard_card_id: 'card_topic',
    why_not_higher_stage: 'Missing pricing.',
    gate_why_not_higher_stage: 'Missing pricing.',
    gate_evidence_ids: ['label', 'capital'],
    branches: [],
  };
}

function snapshot(run: string, stage: string): StageSnapshotHistory {
  const generated_at = `2026-07-${run}T00:00:00.000Z`;
  const run_id = `run_202607${run}T000000000_abc${run}0`;
  return {
    ...artifactMetadata({ artifact_type: 'stage_snapshot_history', rule_version: 'rules', run_id, generated_at }),
    snapshot_id: `stage_snapshot_${run_id}`,
    run_id,
    generated_at,
    source_report_id: `weekly_brief_${run_id}`,
    topics: [topic(stage)],
    early_radar_candidates: [],
    guardrail_check: {
      no_trading_advice: true,
      research_only_actions: true,
      parent_branch_separation_preserved: true,
      evidence_ids_visible: true,
      why_not_higher_present: true,
      data_confidence_present: true,
    },
  };
}

describe('service-to-layer parity', () => {
  it('keeps evidence import normalization identical through compatibility wrapper', () => {
    const drafts = loadEvidenceImportDraft(repoRoot, 'data/imports/evidence_draft.example.yaml');
    expect(normalizeEvidenceImportService({ drafts, sourceFile: 'x', importedAt: '2026-07-09T00:00:00.000Z' }))
      .toEqual(normalizeEvidenceImportApplication({ drafts, sourceFile: 'x', importedAt: '2026-07-09T00:00:00.000Z' }));
  });

  it('keeps domain evidence validation semantics available without infrastructure IO', () => {
    const drafts = loadEvidenceImportDraft(repoRoot, 'data/imports/evidence_draft.example.yaml');
    const report = validateEvidenceImportDrafts({
      drafts,
      sourceFile: 'data/imports/evidence_draft.example.yaml',
      generatedAt: '2026-07-09T00:00:00.000Z',
      existingEvidenceIds: new Set(),
      schemaErrors: [],
    });
    expect(report.status).toBe('passed');
    expect(report.accepted_evidence_ids).toEqual(['import_bci_medical_rehab_followup_001']);
  });

  it('keeps stage classification wrapper identical to domain implementation', () => {
    const input = { evidence: evidence(), scope: 'parent' as const, requestedStage: 'S6' as const, dataConfidence: 80 };
    expect(classifyStageService(input)).toEqual(classifyStageDomain(input));
  });

  it('keeps stage diff wrapper identical to domain implementation', () => {
    expect(buildStageDiffService(snapshot('21', 'S4'), snapshot('20', 'S5')))
      .toEqual(buildStageDiffDomain(snapshot('21', 'S4'), snapshot('20', 'S5')));
  });
});
