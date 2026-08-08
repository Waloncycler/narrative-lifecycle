import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import {
  aggregateLayerSupport,
  calculateModelCost,
  circuitBreakerReasons,
  computeDataConfidence,
  computeNarrativeDelta,
  computeTransitionReadiness,
  evaluateAgentOptimization,
  evidenceContribution,
} from '@/features/scoring/domain/quantitative_framework';

function evidence(overrides: Partial<EvidenceNode> = {}): EvidenceNode {
  return {
    evidence_id: 'ev_1',
    topic_id: 'topic',
    event_date: '2026-07-01',
    available_at: '2026-07-01',
    event_title: 'Validated event',
    event_type: 'validation',
    source_name: 'Regulator A',
    source_type: 'regulator',
    evidence_strength: 'E3',
    affected_layer: ['reality'],
    stage_effect: 'supports_S6',
    parent_or_branch: 'parent',
    positive_or_negative: 'positive',
    confidence: 80,
    ...overrides,
  };
}

describe('quantitative framework', () => {
  it('computes source-grounded evidence quality with time decay', () => {
    const fresh = evidenceContribution(evidence(), '2026-07-01');
    const stale = evidenceContribution(evidence(), '2027-07-01');
    expect(fresh.quality).toBeCloseTo(53.2, 1);
    expect(stale.quality).toBeLessThan(fresh.quality);
  });

  it('deduplicates same-source evidence before noisy-OR aggregation', () => {
    const sameSource = aggregateLayerSupport([
      evidence({ evidence_id: 'a' }),
      evidence({ evidence_id: 'b' }),
    ], 'reality', '2026-07-01');
    const independentSources = aggregateLayerSupport([
      evidence({ evidence_id: 'a' }),
      evidence({ evidence_id: 'b', source_name: 'Regulator B' }),
    ], 'reality', '2026-07-01');
    expect(sameSource.independent_source_count).toBe(1);
    expect(independentSources.positive_support).toBeGreaterThan(sameSource.positive_support);
  });

  it('makes Data Confidence auditable as five bounded components', () => {
    const confidence = computeDataConfidence([
      evidence(),
      evidence({ evidence_id: 'ev_2', source_name: 'Research B', source_type: 'research', affected_layer: ['pricing'], positive_or_negative: 'negative' }),
    ], '2026-07-01');
    expect(confidence.score).toBeGreaterThan(0);
    expect(confidence.polarity_coverage).toBe(100);
    expect(confidence.layer_coverage).toBeCloseTo(33.33, 1);
  });

  it('labels transition readiness as uncalibrated rather than probability', () => {
    const readiness = computeTransitionReadiness({
      gateInput: {
        hasStableLabel: true,
        hasCapitalConfirmation: true,
        hasPricingAdoption: false,
        hasHardRealityEvidence: false,
        independentSourceCount: 3,
      },
      dataConfidence: 70,
      frictionSupport: 20,
    });
    expect(readiness.score).toBeCloseTo(25.2, 1);
    expect(readiness.calibration_status).toBe('uncalibrated');
    expect(readiness.interpretation).toContain('not an empirical transition probability');
  });

  it('refuses Narrative Delta without Narrative Memory', () => {
    const delta = computeNarrativeDelta({
      memoryAvailable: false,
      newEvidenceQuality: 80,
      gateImpact: 80,
      missingEvidenceFilled: 80,
      branchMutationStrength: 40,
      expectationReset: 40,
      dataConfidence: 70,
    });
    expect(delta.score).toBeNull();
    expect(delta.calibration_status).toBe('insufficient_memory');
  });

  it('requires reviewed quality and budget gates before Agent promotion', () => {
    const result = evaluateAgentOptimization({
      sampleSize: 24,
      citationAccuracy: 0.96,
      fieldAccuracy: 0.9,
      resolverAccuracy: 0.88,
      factRecall: 0.9,
      unsupportedClaimRate: 0.03,
      parentBranchErrorRate: 0.02,
      e3e4OverstatementRate: 0.01,
      costPerRun: 0.02,
      maxCostPerRun: 0.01,
      latencyMs: 2000,
      maxLatencyMs: 5000,
    });
    expect(result.eligible_for_reviewed_promotion).toBe(false);
    expect(result.blockers).toContain('minimum 50 reviewed samples');
    expect(result.blockers).toContain('cost per run exceeds budget');
  });

  it('trips deterministic cost, failure, traffic, and retry circuit breakers', () => {
    expect(circuitBreakerReasons({
      costPerRun: 0.06,
      maxCostPerRun: 0.05,
      consecutiveFailures: 3,
      rollingErrorRate: 0.3,
      rollingSampleSize: 10,
      rateVsBaseline: 5,
      retryCount: 2,
      maxRetries: 2,
    })).toEqual([
      'cost_budget_exceeded',
      'consecutive_failures',
      'rolling_error_rate',
      'traffic_spike',
      'retry_budget_exhausted',
    ]);
    expect(calculateModelCost({
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      inputCostPerMillion: 1,
      outputCostPerMillion: 2,
    })).toBe(2);
  });
});
