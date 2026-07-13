import { describe, expect, it } from 'vitest';
import { maxAllowedStage } from '../src/rules/stage_gate_rules';
import { classifyStage } from '../src/services/stage_classifier';
import type { EvidenceNode } from '../src/domain/evidence';

describe('stage gates', () => {
  it('caps stage when stable label is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: false, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: true })).toBe('S2');
  });

  it('caps stage when capital confirmation is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: false, hasPricingAdoption: true, hasHardRealityEvidence: true })).toBe('S3');
  });

  it('caps stage when pricing adoption is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: false, hasHardRealityEvidence: true })).toBe('S4');
  });

  it('caps stage when hard reality evidence is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: false })).toBe('S5');
  });

  it('allows S6 only when all stage gate evidence is present', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: true })).toBe('S6');
  });

  it('uses the earliest missing gate as the maximum allowed stage', () => {
    expect(maxAllowedStage({ hasStableLabel: false, hasCapitalConfirmation: false, hasPricingAdoption: false, hasHardRealityEvidence: false })).toBe('S2');
  });

  it('does not let branch, asset, unknown, or missing-scope evidence satisfy parent gates', () => {
    const nonParentEvidence: EvidenceNode[] = [
      {
        evidence_id: 'branch_full_stack',
        topic_id: 'scope_test',
        branch_id: 'medical_rehab',
        event_date: '2026-01-01',
  available_at: '2026-01-01',
        event_title: 'Branch has full validation',
        event_type: 'regulatory_approval',
        source_name: 'regulator',
        evidence_strength: 'E3',
        affected_layer: ['perception', 'capital', 'pricing', 'reality'],
        stage_effect: 'supports_branch_S6',
        parent_or_branch: 'branch',
        branch_coverage_score: 40,
      },
      {
        evidence_id: 'asset_full_stack',
        topic_id: 'scope_test',
        event_date: '2026-01-02',
  available_at: '2026-01-02',
        event_title: 'Single asset has validation',
        event_type: 'asset_revenue',
        source_name: 'company filing',
        evidence_strength: 'E3',
        affected_layer: ['perception', 'capital', 'pricing', 'reality'],
        stage_effect: 'supports_asset_S6',
        parent_or_branch: 'asset',
      },
      {
        evidence_id: 'unknown_full_stack',
        topic_id: 'scope_test',
        event_date: '2026-01-03',
  available_at: '2026-01-03',
        event_title: 'Unknown scope has validation',
        event_type: 'unknown_scope',
        source_name: 'research desk',
        evidence_strength: 'E3',
        affected_layer: ['perception', 'capital', 'pricing', 'reality'],
        stage_effect: 'supports_unknown_S6',
        parent_or_branch: 'unknown',
      },
    ];

    expect(() =>
      classifyStage({
        evidence: nonParentEvidence,
        scope: 'parent',
        requestedStage: 'S6',
        dataConfidence: 85,
      }),
    ).toThrow('No Evidence Table');
  });
});
