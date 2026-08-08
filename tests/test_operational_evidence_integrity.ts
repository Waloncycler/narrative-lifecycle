import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { FileAutonomousResearchRepository } from '@/infrastructure/autonomous_research_io';
import type { EvidenceNode } from '@/domain/evidence';

function evidence(evidenceId: string): EvidenceNode {
  return {
    evidence_id: evidenceId,
    topic_id: 'topic',
    branch_id: null,
    event_date: '2026-08-03',
    event_title: evidenceId,
    event_summary: 'A provenance-complete source record.',
    event_type: 'FACT',
    source_name: 'test',
    source_url: 'https://example.test/source',
    source_type: 'official',
    evidence_strength: 'E3',
    affected_layer: ['reality'],
    stage_effect: 'maintain_parent',
    parent_or_branch: 'parent',
    available_at: '2026-08-03',
    branch_coverage_score: 0,
    interpretation: 'fact only',
    limitation: 'limited to the cited fact',
    positive_or_negative: 'neutral',
    confidence: 85,
    schema_version: 'test',
  };
}

describe('operational evidence integrity', () => {
  it('uses explicitly admitted manual imports and controlled automated evidence, not legacy bulk rows', () => {
    const root = mkdtempSync(join(tmpdir(), 'operational-evidence-'));
    mkdirSync(join(root, 'data/sample_evidence'), { recursive: true });
    mkdirSync(join(root, 'data/live_evidence'), { recursive: true });
    mkdirSync(join(root, 'data/audit'), { recursive: true });
    writeFileSync(join(root, 'data/sample_evidence/manual_imported_evidence.yaml'), stringify([
      evidence('audited_manual'),
      evidence('legacy_unreviewed'),
    ]));
    writeFileSync(join(root, 'data/live_evidence/automated_evidence.yaml'), stringify([evidence('controlled_auto')]));
    writeFileSync(join(root, 'data/audit/evidence_import_audit.jsonl'), `${JSON.stringify({
      operator_action: 'evidence_import',
      evidence_ids: ['legacy_unreviewed'],
    })}\nnot-json\n`);
    writeFileSync(join(root, 'data/audit/operational_evidence_admission.jsonl'), `${JSON.stringify({
      admission_type: 'manual_import',
      evidence_ids: ['audited_manual'],
    })}\nnot-json\n`);

    const repository = new FileAutonomousResearchRepository(root);

    expect(repository.readOperationalEvidence().map((item) => item.evidence_id).sort())
      .toEqual(['audited_manual', 'controlled_auto']);
    expect(repository.operationalArtifactPaths('run_test').sourceArtifacts)
      .toContain('data/audit/operational_evidence_admission.jsonl');
  });
});
