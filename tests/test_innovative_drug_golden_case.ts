import { describe, it, expect } from 'vitest';
import { expectGoldenCaseShape, loadGoldenCase } from './helpers/golden_case_loader';
import type { EvidenceNode } from '../src/domain/evidence';
import { classifyStage } from '../src/services/stage_classifier';
import { generateScore } from '../src/services/scoring_engine';
import { generateDashboardCardFromGoldenCase } from '../src/services/dashboard_card_generator';

describe('test_innovative_drug_golden_case', () => {
  const goldenCase = loadGoldenCase('innovative_drug_license_out.yaml');

  it('preserves the innovative drug license-out baseline judgment', () => {
    expectGoldenCaseShape(goldenCase);
    expect(goldenCase.topic_id).toBe('innovative_drug_license_out');
    expect(goldenCase.baseline_current_stage).toBe('S5-S6');
    expect(goldenCase.transition_target).toBe('S7A/S7C');
    expect(goldenCase.required_outputs.current_stage).toBe('S5-S6');
    expect(goldenCase.required_outputs.must_include).toContain('reality-first path');
    expect(goldenCase.required_outputs.must_include).toContain('milestone realization risk');
    expect(goldenCase.forbidden_outputs).toContain('treat_headline_deal_value_as_full_reality');
    expect(goldenCase.forbidden_outputs).toContain('ignore_partner_quality');
  });

  it('runs as a reality-first S5-S6 case while preserving headline realization warnings', () => {
    const evidence: EvidenceNode[] = [
      {
        evidence_id: 'licenseout_label',
        topic_id: 'innovative_drug_license_out',
        event_date: '2026-03-01',
  available_at: '2026-03-01',
        event_title: 'License-out label is stable across market and industry discussion',
        event_type: 'label_formation',
        source_name: 'industry source',
        evidence_strength: 'E2',
        affected_layer: ['perception'],
        stage_effect: 'supports_S3',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'licenseout_capital',
        topic_id: 'innovative_drug_license_out',
        event_date: '2026-03-02',
  available_at: '2026-03-02',
        event_title: 'Capital confirms high-quality license-out deal leaders',
        event_type: 'capital_confirmation',
        source_name: 'market data',
        evidence_strength: 'E2',
        affected_layer: ['capital'],
        stage_effect: 'supports_S4',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'licenseout_pricing',
        topic_id: 'innovative_drug_license_out',
        event_date: '2026-03-03',
  available_at: '2026-03-03',
        event_title: 'Upfront, milestone, and global rights terms support pricing adoption',
        event_type: 'pricing_adoption',
        source_name: 'company announcement',
        evidence_strength: 'E3',
        affected_layer: ['pricing'],
        stage_effect: 'supports_S5',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'licenseout_reality',
        topic_id: 'innovative_drug_license_out',
        event_date: '2026-03-04',
  available_at: '2026-03-04',
        event_title: 'Partner quality and clinical path provide hard reality evidence',
        event_type: 'clinical_partner_validation',
        source_name: 'company announcement',
        evidence_strength: 'E3',
        affected_layer: ['reality'],
        stage_effect: 'supports_S6',
        parent_or_branch: 'parent',
      },
    ];

    const stage = classifyStage({ evidence, scope: 'parent', requestedStage: 'S6', dataConfidence: 82 });
    const score = generateScore({
      score_id: 'licenseout_score',
      topic_id: 'innovative_drug_license_out',
      score_date: '2026-03-05',
      evidence,
      stageClassification: stage,
    });
    const card = generateDashboardCardFromGoldenCase(goldenCase, evidence);

    expect(stage.current_stage).toBe('S6');
    expect(score.dimensions.pricing_adoption?.evidence_ids).toContain('licenseout_pricing');
    expect(score.dimensions.parent_reality?.evidence_ids).toContain('licenseout_reality');
    expect(score.dimensions.narrative_delta_score?.missing_data).toContain('Narrative Memory comparison');
    expect(card.why_not_higher_stage).toContain('milestone realization risk');
    expect(card.failure_signals.join(' ')).toContain('headline deal value');
  });
});
