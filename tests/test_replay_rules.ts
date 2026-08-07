import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '../src/domain/evidence';
import { branchStagesForReplay, evidenceAvailableAt, parentStageForReplay } from '../src/domain/replay_rules';

const parentLabel: EvidenceNode = {
  evidence_id: 'parent_label',
  topic_id: 'bci',
  event_date: '2026-01-01',
  available_at: '2026-01-01',
  event_title: 'Parent label',
  event_type: 'label',
  source_name: 'fixture',
  evidence_strength: 'E2',
  affected_layer: ['perception', 'capital'],
  stage_effect: 'supports_parent_S4',
  parent_or_branch: 'parent',
  confidence: 75,
};

const futureBranch: EvidenceNode = {
  evidence_id: 'branch_future_s7c',
  topic_id: 'bci',
  branch_id: 'medical_rehab',
  event_date: '2026-01-10',
  available_at: '2026-02-01',
  event_title: 'Future branch mutation',
  event_type: 'branch_mutation',
  source_name: 'fixture',
  evidence_strength: 'E4',
  affected_layer: ['perception', 'capital', 'pricing', 'reality'],
  stage_effect: 'supports_branch_S7C',
  parent_or_branch: 'branch',
  confidence: 82,
};

describe('replay rules', () => {
  it('filters evidence by available_at rather than event_date', () => {
    expect(evidenceAvailableAt([parentLabel, futureBranch], '2026-01-15').map((item) => item.evidence_id)).toEqual(['parent_label']);
  });

  it('keeps branch S7C from upgrading the parent narrative', () => {
    const available = evidenceAvailableAt([parentLabel, futureBranch], '2026-02-02');
    const parent = parentStageForReplay({ evidence: available, requestedStage: 'S6', dataConfidence: 80 });
    const branches = branchStagesForReplay(available, 80);

    expect(parent.current_stage).toBe('S4');
    expect(branches).toEqual([expect.objectContaining({ branch_id: 'medical_rehab', current_stage: 'S7C' })]);
  });
});
