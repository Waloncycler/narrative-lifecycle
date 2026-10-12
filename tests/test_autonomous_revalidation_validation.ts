import { describe, expect, it } from 'vitest';
import { validateEvidenceImportDrafts } from '@/features/evidence/domain/evidence_import_rules';
import type { EvidenceImportDraft } from '@/features/evidence/types/evidence_import';

const draft: EvidenceImportDraft = {
  evidence_id: 'legacy_revalidated_1', topic_id: 'bci', branch_id: null, scope: 'parent',
  event_date: '2026-08-09', available_at: '2026-08-09', event_title: 'Verified source record',
  event_summary: 'A bounded original-source quote is available.', event_type: 'official_record',
  source_name: 'Official source', source_url: 'https://example.test/record', source_type: 'official',
  evidence_strength: 'E1', affected_layer: ['reality'], stage_effect: 'maintain', polarity: 'neutral',
  interpretation: 'This is a source-backed record only.', limitation: 'It does not establish a lifecycle stage.', confidence: 'medium',
};

describe('controlled autonomous revalidation validation', () => {
  it('permits only the explicitly revalidated legacy id', () => {
    const report = validateEvidenceImportDrafts({
      drafts: [draft], sourceFile: 'autonomous://test', generatedAt: '2026-08-09T00:00:00.000Z',
      existingEvidenceIds: new Set([draft.evidence_id]),
      permittedExistingEvidenceIds: new Set([draft.evidence_id]),
    });
    expect(report.status).toBe('passed');
  });

  it('continues to reject other existing ids and duplicate batch rows', () => {
    const existing = validateEvidenceImportDrafts({
      drafts: [draft], sourceFile: 'autonomous://test', generatedAt: '2026-08-09T00:00:00.000Z',
      existingEvidenceIds: new Set([draft.evidence_id]), permittedExistingEvidenceIds: new Set(['another_id']),
    });
    const repeated = validateEvidenceImportDrafts({
      drafts: [draft, draft], sourceFile: 'autonomous://test', generatedAt: '2026-08-09T00:00:00.000Z',
      permittedExistingEvidenceIds: new Set([draft.evidence_id]),
    });
    expect(existing.status).toBe('failed');
    expect(repeated.status).toBe('failed');
  });
});
