import { describe, it, expect } from 'vitest';
import { expectGoldenCaseShape, loadGoldenCase } from './helpers/golden_case_loader';
import { classifyStage } from '../src/services/stage_classifier';
import type { EvidenceNode } from '../src/domain/evidence';

describe('test_bci_golden_case', () => {
  const goldenCase = loadGoldenCase('bci.yaml');

  it('preserves the BCI parent and branch baseline judgment', () => {
    expectGoldenCaseShape(goldenCase);
    expect(goldenCase.topic_id).toBe('bci');
    expect(goldenCase.baseline_current_stage).toBe('S4');
    expect(goldenCase.transition_target).toBe('S5');
    expect(goldenCase.required_outputs.current_stage).toBe('S4');
    expect(goldenCase.required_outputs.branch_medical_rehab_stage).toBe('S5-S6');
    expect(goldenCase.required_outputs.must_include).toContain('parent reality insufficient');
    expect(goldenCase.forbidden_outputs).toContain('parent_stage_S6_without_parent_reality');
  });

  it('keeps BCI parent capped below S6 even when medical rehab branch has S5-S6 evidence', () => {
    const evidence: EvidenceNode[] = [
      {
        evidence_id: 'bci_parent_label',
        topic_id: 'bci',
        event_date: '2026-01-01',
  available_at: '2026-01-01',
        event_title: 'BCI label and beneficiary map reactivates',
        event_type: 'label_formation',
        source_name: 'research desk',
        evidence_strength: 'E2',
        affected_layer: ['perception'],
        stage_effect: 'supports_parent_S3',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'bci_parent_capital',
        topic_id: 'bci',
        event_date: '2026-01-02',
  available_at: '2026-01-02',
        event_title: 'Capital tests BCI parent theme',
        event_type: 'capital_confirmation',
        source_name: 'market breadth data',
        evidence_strength: 'E2',
        affected_layer: ['capital'],
        stage_effect: 'supports_parent_S4',
        parent_or_branch: 'parent',
      },
      {
        evidence_id: 'bci_branch_label',
        topic_id: 'bci',
        branch_id: 'bci_medical_rehab',
        event_date: '2026-01-03',
  available_at: '2026-01-03',
        event_title: 'Medical rehab branch label is stable',
        event_type: 'branch_label',
        source_name: 'clinical research source',
        evidence_strength: 'E2',
        affected_layer: ['perception', 'capital', 'pricing'],
        stage_effect: 'supports_branch_S5',
        parent_or_branch: 'branch',
        branch_coverage_score: 45,
      },
      {
        evidence_id: 'bci_branch_reality',
        topic_id: 'bci',
        branch_id: 'bci_medical_rehab',
        event_date: '2026-01-04',
  available_at: '2026-01-04',
        event_title: 'Medical rehab branch regulatory validation',
        event_type: 'regulatory_approval',
        source_name: 'regulator',
        evidence_strength: 'E3',
        affected_layer: ['reality'],
        stage_effect: 'supports_branch_S6',
        parent_or_branch: 'branch',
        branch_coverage_score: 45,
      },
    ];

    const parent = classifyStage({ evidence, scope: 'parent', requestedStage: 'S6', dataConfidence: 80 });
    const branch = classifyStage({
      evidence,
      scope: 'branch',
      branchId: 'bci_medical_rehab',
      requestedStage: 'S6',
      dataConfidence: 80,
    });

    expect(parent.current_stage).toBe('S4');
    expect(parent.why_not_higher_stage).toContain('pricing adoption');
    expect(parent.why_not_higher_stage).toContain('hard reality evidence');
    expect(parent.evidence_ids).not.toContain('bci_branch_reality');
    expect(branch.current_stage).toBe('S6');
    expect(branch.evidence_ids).toContain('bci_branch_reality');
  });
});
