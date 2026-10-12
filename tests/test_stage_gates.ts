import { describe, expect, it } from 'vitest';
import { maxAllowedStage } from '@/features/stages/rules/stage_gate_rules';
import { classifyStage } from '@/features/stages/domain/stage_classifier';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

describe('stage gates', () => {
  it('caps stage when stable label is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: false, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: true, independentSourceCount: 3 })).toBe('S2');
  });

  it('S3 limit if capital confirmation is missing despite hard reality', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: false, hasPricingAdoption: true, hasHardRealityEvidence: true, independentSourceCount: 3 })).toBe('S3');
  });

  it('S4 limit if pricing adoption is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: false, hasHardRealityEvidence: true, independentSourceCount: 3 })).toBe('S4');
  });

  it('S5 limit if hard reality evidence is missing', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: false, independentSourceCount: 3 })).toBe('S5');
  });

  it('S6 allowed if all gates satisfied and source count met', () => {
    expect(maxAllowedStage({ hasStableLabel: true, hasCapitalConfirmation: true, hasPricingAdoption: true, hasHardRealityEvidence: true, independentSourceCount: 3 })).toBe('S6');
  });

  it('S0 starts out at S2 maximum for minimal reality', () => {
    expect(maxAllowedStage({ hasStableLabel: false, hasCapitalConfirmation: false, hasPricingAdoption: false, hasHardRealityEvidence: false, independentSourceCount: 0 })).toBe('S2');
  });

  it('does not let E1 trending rows unlock label or capital gates', () => {
    const rows: EvidenceNode[] = ['one', 'two', 'three'].map((id) => ({
      evidence_id: id,
      topic_id: 'crypto',
      event_date: '2026-08-08',
      available_at: '2026-08-08',
      event_title: `${id} trending on CoinGecko`,
      event_type: 'MARKET_TRENDING_ASSET',
      source_name: 'Direct public / CoinGeckoTrending',
      source_url: `https://www.coingecko.com/en/coins/${id}`,
      evidence_strength: 'E1',
      affected_layer: ['perception', 'capital'],
      stage_effect: 'maintain_parent',
      parent_or_branch: 'parent',
    }));

    const result = classifyStage({ evidence: rows, scope: 'parent' });
    expect(result.current_stage).toBe('S2');
    expect(result.gate_input).toMatchObject({
      hasStableLabel: false,
      hasCapitalConfirmation: false,
      independentSourceCount: 1,
    });
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
