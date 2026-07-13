import { describe, it, expect } from 'vitest';
import { expectGoldenCaseShape, loadGoldenCase } from './helpers/golden_case_loader';
import type { EvidenceNode } from '../src/domain/evidence';
import { classifyStage } from '../src/services/stage_classifier';
import { generateScore } from '../src/services/scoring_engine';
import { generateDashboardCardFromGoldenCase } from '../src/services/dashboard_card_generator';

describe('test_humanoid_robotics_golden_case', () => {
  const goldenCase = loadGoldenCase('humanoid_robotics.yaml');

  it('preserves the humanoid robotics baseline judgment', () => {
    expectGoldenCaseShape(goldenCase);
    expect(goldenCase.topic_id).toBe('humanoid_robotics');
    expect(goldenCase.baseline_current_stage).toBe('S5-S6');
    expect(goldenCase.transition_target).toBe('S7A/S7C');
    expect(goldenCase.required_outputs.current_stage).toBe('S5-S6');
    expect(goldenCase.required_outputs.must_include).toContain('pricing adoption');
    expect(goldenCase.required_outputs.must_include).toContain('reality validation');
    expect(goldenCase.required_outputs.must_include).toContain('S7B risk for crowded edge assets');
    expect(goldenCase.forbidden_outputs).toContain('classify_as_S3_without_explanation');
  });

  it('runs through stage classification, scoring, and dashboard generation without falling back to S3/S4', () => {
    const evidence: EvidenceNode[] = [
      {
        evidence_id: 'humanoid_label',
        topic_id: 'humanoid_robotics',
        event_date: '2026-02-01',
  available_at: '2026-02-01',
        event_title: 'Stable embodied intelligence label and stock mapping',
        event_type: 'label_formation',
        source_name: 'industry source',
        evidence_strength: 'E2',
        affected_layer: ['perception'],
        stage_effect: 'supports_S3',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'humanoid_capital',
        topic_id: 'humanoid_robotics',
        event_date: '2026-02-02',
  available_at: '2026-02-02',
        event_title: 'Leaders, breadth, and persistence confirm capital testing',
        event_type: 'capital_confirmation',
        source_name: 'market data',
        evidence_strength: 'E3',
        affected_layer: ['capital'],
        stage_effect: 'supports_S4',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'humanoid_pricing',
        topic_id: 'humanoid_robotics',
        event_date: '2026-02-03',
  available_at: '2026-02-03',
        event_title: 'Value-per-unit and penetration model enters institutional pricing language',
        event_type: 'pricing_adoption',
        source_name: 'institutional model',
        evidence_strength: 'E3',
        affected_layer: ['pricing'],
        stage_effect: 'supports_S5',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'humanoid_reality',
        topic_id: 'humanoid_robotics',
        event_date: '2026-02-04',
  available_at: '2026-02-04',
        event_title: 'Industrial testing and delivery evidence validates reality layer',
        event_type: 'product_delivery',
        source_name: 'customer evidence',
        evidence_strength: 'E3',
        affected_layer: ['reality'],
        stage_effect: 'supports_S6',
        parent_or_branch: 'parent',
      },
    ];

    const stage = classifyStage({ evidence, scope: 'parent', requestedStage: 'S6', dataConfidence: 82 });
    const score = generateScore({
      score_id: 'humanoid_score',
      topic_id: 'humanoid_robotics',
      score_date: '2026-02-05',
      evidence,
      stageClassification: stage,
    });
    const card = generateDashboardCardFromGoldenCase(goldenCase, evidence);

    expect(stage.current_stage).toBe('S6');
    expect(stage.current_stage).not.toBe('S3');
    expect(stage.current_stage).not.toBe('S4');
    expect(score.dimensions.pricing_adoption?.evidence_ids).toContain('humanoid_pricing');
    expect(score.dimensions.branch_reality?.score).toBe(20);
    expect(score.dimensions.branch_reality?.missing_data).toContain('branch-level hard reality evidence');
    expect(score.dimensions.transition_probability?.evidence_ids.length).toBeGreaterThan(0);
    expect(card.why_not_higher_stage).toContain('S7B risk for crowded edge assets');
  });
});
