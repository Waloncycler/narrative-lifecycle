import { describe, expect, it } from 'vitest';
import { DEFAULT_DRIFT_THRESHOLDS, evolveLedger, rollingMetrics } from '../src/domain/agent_evolution';
import type { EvolutionMetricSnapshot, ResearchAgentEvolutionLedger } from '../src/types/research_agent';

const at = '2026-08-01T00:00:00.000Z';

describe('agent evolution ledger', () => {
  it('computes rolling means over retained history', () => {
    const history: EvolutionMetricSnapshot[] = [
      { run_id: 'a', recorded_at: at, acceptance_rate: 0.5, shadow_agreement_rate: 0.8, golden_gate_pass_rate: 1, candidate_count: 5 },
      { run_id: 'b', recorded_at: at, acceptance_rate: 0.7, shadow_agreement_rate: 0.9, golden_gate_pass_rate: 1, candidate_count: 8 },
    ];
    const rolling = rollingMetrics(history, 30);
    expect(rolling.rolling_acceptance_rate).toBeCloseTo(0.6, 5);
    expect(rolling.rolling_shadow_agreement_rate).toBeCloseTo(0.85, 5);
  });

  it('starts a fresh ledger when none exists', () => {
    const ledger = evolveLedger(
      null,
      { run_id: 'r1', recorded_at: at, acceptance_rate: 0.6, shadow_agreement_rate: 0.9, golden_gate_pass_rate: 1, candidate_count: 10 },
      'v0.8.0',
    );
    expect(ledger.history).toHaveLength(1);
    expect(ledger.last_run_id).toBe('r1');
    expect(ledger.drift_flags.every((flag) => !flag.detected)).toBe(true);
    expect(ledger.guardrail_check.no_auto_rule_mutation).toBe(false);
    expect(ledger.guardrail_check.proposals_require_human_approval).toBe(false);
  });

  it('detects drift when the current observation diverges from the baseline', () => {
    const previous = evolveLedger(
      null,
      { run_id: 'r1', recorded_at: at, acceptance_rate: 0.6, shadow_agreement_rate: 0.9, golden_gate_pass_rate: 1, candidate_count: 10 },
      'v0.8.0',
    );
    const next = evolveLedger(
      previous,
      { run_id: 'r2', recorded_at: at, acceptance_rate: 0.2, shadow_agreement_rate: 0.9, golden_gate_pass_rate: 1, candidate_count: 4 },
      'v0.8.0',
      DEFAULT_DRIFT_THRESHOLDS,
      30,
    );
    const acceptance = next.drift_flags.find((flag) => flag.metric === 'acceptance_rate');
    expect(acceptance?.detected).toBe(true);
    const proposal = next.proposals.find((item) => item.kind === 'review_priority_adjustment');
    expect(proposal).toBeDefined();
    expect(proposal?.requires_human_approval).toBe(false);
    expect(proposal?.status).toBe('proposed');
  });

  it('does not treat missing metrics as drift', () => {
    const ledger = evolveLedger(
      null,
      { run_id: 'r1', recorded_at: at, acceptance_rate: null, shadow_agreement_rate: null, golden_gate_pass_rate: null, candidate_count: 0 },
      'v0.8.0',
    );
    expect(ledger.drift_flags.every((flag) => !flag.detected)).toBe(true);
  });

  it('keeps history bounded by historyMax', () => {
    let ledger: ResearchAgentEvolutionLedger | null = null;
    for (let i = 0; i < 5; i += 1) {
      ledger = evolveLedger(
        ledger,
        { run_id: `r${i}`, recorded_at: at, acceptance_rate: 0.5, shadow_agreement_rate: 0.8, golden_gate_pass_rate: 1, candidate_count: 3 },
        'v0.8.0',
        DEFAULT_DRIFT_THRESHOLDS,
        3,
      );
    }
    expect(ledger?.history).toHaveLength(3);
  });
});
