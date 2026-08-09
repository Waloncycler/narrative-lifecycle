import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { normalizeOperationalEvidenceSourceType } from '@/features/evidence/domain/evidence_source_normalization';

const base = {
  evidence_id: 'legacy_1', topic_id: 'topic', parent_or_branch: 'parent', event_date: '2026-01-01', event_title: 'Record',
  source_name: 'official', source_url: 'https://official.example.test/', evidence_strength: 'E3', affected_layer: ['reality'], stage_effect: 'fills_gap', confidence: 80,
} as EvidenceNode;

describe('operational legacy source normalization', () => {
  it('uses only an exact legacy source-name enum when source_type is absent', () => {
    expect(normalizeOperationalEvidenceSourceType(base)).toMatchObject({ source_type: 'official' });
    expect(normalizeOperationalEvidenceSourceType({ ...base, source_name: 'Official issuer homepage' })).not.toHaveProperty('source_type');
  });
});
