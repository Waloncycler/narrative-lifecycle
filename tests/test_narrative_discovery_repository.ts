import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileIntelligenceRepository } from '@/platform/io/intelligence_io';
import type { NarrativeDiscoveryReport } from '@/features/narrative/types/narrative_discovery';

function report(documentId: string, generatedAt: string): NarrativeDiscoveryReport {
  return {
    artifact_type: 'narrative_discovery_report', schema_version: '1.0.0', producer_version: 'test', report_id: `report_${documentId}`, generated_at: generatedAt, session_id: `session_${documentId}`,
    records: [{
      discovery_id: 'discovery_humanoid_robotics_warehouse_logistics', resolution: 'new_branch', topic_id: 'humanoid_robotics', topic_name: 'Humanoid robotics', branch_id: 'humanoid_robotics_warehouse_logistics', branch_name: 'warehouse logistics', scope: 'branch', confidence: 'medium', parent_match_score: 1, branch_novelty_score: 1, support_count: 1, independent_document_count: 1, registration_action: 'watch_branch', reason: 'test', uncertainty_notes: [], evidence_refs: [{ candidate_id: `candidate_${documentId}`, raw_document_id: documentId, provenance_id: `prov_${documentId}`, quote: 'warehouse logistics applications' }], audit_required: true,
      guardrail_check: { source_quotes_present: true, duplicate_checked: true, narrative_memory_checked: true, parent_stage_unchanged: true, branch_evidence_isolated: true, provisional_does_not_inherit_stage: true, no_trading_advice: true },
    }],
    summary: { existing_branch_count: 0, new_branch_count: 1, provisional_topic_count: 0, reactivation_count: 0, unresolved_count: 0 },
    guardrail_check: { source_quotes_present: true, no_forced_mapping: true, parent_stage_unchanged: true, branch_evidence_isolated: true, provisional_does_not_inherit_stage: true, no_trading_advice: true },
  };
}

describe('narrative discovery repository', () => {
  it('retains distinct source support for the same branch across runs without duplicating a rerun', () => {
    const root = mkdtempSync(join(tmpdir(), 'narrative-discovery-'));
    const repository = new FileIntelligenceRepository(root);
    repository.writeNarrativeDiscovery(report('raw_1', '2026-08-03T00:00:00.000Z'));
    repository.writeNarrativeDiscovery(report('raw_2', '2026-08-04T00:00:00.000Z'));
    repository.writeNarrativeDiscovery(report('raw_2', '2026-08-04T00:00:00.000Z'));
    const records = repository.readNarrativeDiscoveryRecords();
    expect(records).toHaveLength(2);
    expect(new Set(records.flatMap((record) => record.evidence_refs.map((ref) => ref.raw_document_id)))).toEqual(new Set(['raw_1', 'raw_2']));
    rmSync(root, { recursive: true, force: true });
  });
});
