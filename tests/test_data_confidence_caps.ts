import { describe, it, expect } from 'vitest';
import { calculateDataConfidence, capStageByDataConfidence, maximumStageByDataConfidence } from '../src/rules/data_confidence_rules';
import { classifyStage } from '../src/services/stage_classifier';
import { parentS6Evidence } from './helpers/sample_evidence';

describe('test_data_confidence_caps', () => {
  it('caps stage upgrades when data confidence is insufficient', () => {
    expect(calculateDataConfidence({ sourceBreadth: 20, sourceAuthority: 50, sourceRecency: 50, positiveNegativeBalance: 40, layerCoverage: 30 })).toBe(38);
    expect(maximumStageByDataConfidence(38)).toBe('S4');
    expect(capStageByDataConfidence('S6', 38)).toBe('S4');
    expect(capStageByDataConfidence('S6', 64)).toBe('S5');
    expect(capStageByDataConfidence('S6', 80)).toBe('S6');
  });

  it('integrates data confidence caps into stage classification', () => {
    const lowConfidenceStage = classifyStage({
      evidence: parentS6Evidence,
      scope: 'parent',
      requestedStage: 'S6',
      dataConfidence: 38,
    });

    expect(lowConfidenceStage.current_stage).toBe('S4');
    expect(lowConfidenceStage.max_allowed_stage).toBe('S4');
    expect(lowConfidenceStage.why_not_higher_stage).toContain('Data confidence caps');
  });
});
