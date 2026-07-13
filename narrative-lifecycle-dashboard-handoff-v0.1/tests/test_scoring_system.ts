import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { generateScore } from '../src/services/scoring_engine';
import { classifyStage } from '../src/services/stage_classifier';
import { parentS4Evidence, parentS6Evidence } from './helpers/sample_evidence';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('test_scoring_system', () => {
  it('requires stage classification and structured evidence before scoring', () => {
    expect(() =>
      generateScore({
        score_id: 'score_empty',
        topic_id: 'sample_topic',
        score_date: '2026-01-05',
        evidence: [],
        stageClassification: undefined as never,
      }),
    ).toThrow('No Evidence Table');

    expect(() =>
      generateScore({
        score_id: 'score_no_stage',
        topic_id: 'sample_topic',
        score_date: '2026-01-05',
        evidence: parentS6Evidence,
        stageClassification: undefined as never,
      }),
    ).toThrow('Stage classification is required before scoring');

    const stageClassification = classifyStage({
      evidence: parentS6Evidence,
      scope: 'parent',
      requestedStage: 'S6',
      dataConfidence: 85,
    });
    const score = generateScore({
      score_id: 'score_1',
      topic_id: 'sample_topic',
      score_date: '2026-01-05',
      evidence: parentS6Evidence,
      stageClassification,
    });

    expect(score.dimensions.pricing_adoption?.evidence_ids).toContain('ev_pricing');
    expect(score.dimensions.data_confidence?.reasoning).toContain('source breadth');
    expect(score.dimensions.parent_reality?.missing_data).toEqual([]);
    expect(Object.keys(score.dimensions).sort()).toEqual([
      'branch_coverage',
      'branch_reality',
      'capital_confirmation',
      'data_confidence',
      'execution_friction',
      'feedback',
      'market_perception',
      'narrative_delta_score',
      'parent_reality',
      'policy_perception',
      'pricing_adoption',
      'trading_perception',
      'transition_probability',
      'valuation_friction',
    ]);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateScore = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/score.schema.json'), 'utf8')));
    expect(validateScore(score), JSON.stringify(validateScore.errors)).toBe(true);
  });

  it('rejects forged high-stage classifications that do not match the evidence table gates', () => {
    expect(() =>
      generateScore({
        score_id: 'score_forged',
        topic_id: 'sample_topic',
        score_date: '2026-01-05',
        evidence: parentS4Evidence,
        stageClassification: {
          current_stage: 'S6',
          max_allowed_stage: 'S6',
          gate_input: {
            hasStableLabel: true,
            hasCapitalConfirmation: true,
            hasPricingAdoption: true,
            hasHardRealityEvidence: true,
          },
          why_not_higher_stage: 'forged',
          evidence_ids: parentS4Evidence.map((item) => item.evidence_id),
          data_confidence_cap_applied: false,
        },
      }),
    ).toThrow('Stage classification does not match Evidence Table gates');
  });
});
