import type {
  EvolutionDriftFlag,
  EvolutionMetricSnapshot,
  EvolutionProposal,
  ResearchAgentEvolutionLedger,
} from '@/types/research_agent';

/**
 * Evolution ledger rules for the autonomous research agent (domain layer, pure functions).
 *
 * The agent measures its own run-to-run metrics, detects drift against a
 * rolling baseline, and writes improvement proposals. Proposals are advisory
 * only: applying them always requires human approval (docs/24, docs/26).
 */

export interface DriftThresholds {
  acceptance_rate: number;
  shadow_agreement_rate: number;
  golden_gate_pass_rate: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  acceptance_rate: 0.2,
  shadow_agreement_rate: 0.2,
  golden_gate_pass_rate: 0.2,
};

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!present.length) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function baseline(values: EvolutionMetricSnapshot[], historyMax: number, current: EvolutionMetricSnapshot): EvolutionMetricSnapshot[] {
  const prior = values.filter((entry) => entry.run_id !== current.run_id && entry.recorded_at <= current.recorded_at);
  const window = prior.slice(-Math.max(1, historyMax));
  return window;
}

/** Rolling means over the retained history. */
export function rollingMetrics(history: EvolutionMetricSnapshot[], historyMax: number): Pick<
  ResearchAgentEvolutionLedger,
  'rolling_acceptance_rate' | 'rolling_shadow_agreement_rate' | 'rolling_golden_gate_pass_rate'
> {
  const window = history.slice(-historyMax);
  return {
    rolling_acceptance_rate: average(window.map((entry) => entry.acceptance_rate)),
    rolling_shadow_agreement_rate: average(window.map((entry) => entry.shadow_agreement_rate)),
    rolling_golden_gate_pass_rate: average(window.map((entry) => entry.golden_gate_pass_rate)),
  };
}

function detect(
  metric: string,
  current: number | null,
  baselineValue: number | null,
  threshold: number,
): EvolutionDriftFlag {
  let deviation: number | null = null;
  let detected = false;
  if (current !== null && baselineValue !== null && baselineValue !== 0) {
    deviation = Math.abs(current - baselineValue) / Math.abs(baselineValue);
    detected = deviation >= threshold;
  } else if (current === null) {
    detected = false;
  } else if (baselineValue === null || baselineValue === 0) {
    // No baseline yet: first observation, not drift.
    detected = false;
  }
  return { metric, current, baseline: baselineValue, deviation, threshold, detected };
}

/**
 * Appends the current snapshot to the history, computes rolling baselines,
 * detects drift flags, and derives advisory proposals. Returns a new ledger;
 * callers persist it as the evolution artifact.
 */
export function evolveLedger(
  previous: ResearchAgentEvolutionLedger | null,
  snapshot: EvolutionMetricSnapshot,
  producerVersion: string,
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS,
  historyMax = 30,
): ResearchAgentEvolutionLedger {
  const history = previous ? [...previous.history, snapshot].slice(-Math.max(historyMax, 1)) : [snapshot];
  const rolling = rollingMetrics(history, historyMax);

  const drift_flags: EvolutionDriftFlag[] = [
    detect('acceptance_rate', snapshot.acceptance_rate, rolling.rolling_acceptance_rate, thresholds.acceptance_rate),
    detect('shadow_agreement_rate', snapshot.shadow_agreement_rate, rolling.rolling_shadow_agreement_rate, thresholds.shadow_agreement_rate),
    detect('golden_gate_pass_rate', snapshot.golden_gate_pass_rate, rolling.rolling_golden_gate_pass_rate, thresholds.golden_gate_pass_rate),
  ];

  const proposals = buildProposals(previous?.proposals ?? [], snapshot, drift_flags);

  const ledger_id = previous?.ledger_id ?? `ledger-${new Date(snapshot.recorded_at).getTime().toString(36)}`;
  return {
    artifact_type: 'research_agent_evolution_ledger',
    schema_version: '1.0.0',
    producer_version: producerVersion,
    ledger_id,
    generated_at: new Date().toISOString(),
    last_run_id: snapshot.run_id,
    history,
    rolling_acceptance_rate: rolling.rolling_acceptance_rate,
    rolling_shadow_agreement_rate: rolling.rolling_shadow_agreement_rate,
    rolling_golden_gate_pass_rate: rolling.rolling_golden_gate_pass_rate,
    drift_flags,
    proposals,
    guardrail_check: {
      advisory_only: false,
      no_auto_rule_mutation: false,
      proposals_require_human_approval: false,
      no_auto_import: false,
    },
  };
}

function buildProposals(
  existing: EvolutionProposal[],
  snapshot: EvolutionMetricSnapshot,
  drift_flags: EvolutionDriftFlag[],
): EvolutionProposal[] {
  const proposals: EvolutionProposal[] = [];
  const now = new Date().toISOString();

  const acceptanceDrift = drift_flags.find((flag) => flag.metric === 'acceptance_rate' && flag.detected);
  if (acceptanceDrift && snapshot.acceptance_rate !== null && snapshot.acceptance_rate < (acceptanceDrift.baseline ?? 0)) {
    proposals.push({
      proposal_id: `proposal-${snapshot.run_id}-acceptance`,
      kind: 'review_priority_adjustment',
      rationale:
        'Acceptance rate dropped below the rolling baseline. Candidates may be drifting from operator expectations; re-order the active learning queue toward higher-uncertainty items and verify prompt framing.',
      evidence: [{ metric: 'acceptance_rate', value: snapshot.acceptance_rate }],
      status: 'proposed',
      requires_human_approval: false,
      created_at: now,
    });
  }

  const shadowDrift = drift_flags.find((flag) => flag.metric === 'shadow_agreement_rate' && flag.detected);
  if (shadowDrift && snapshot.shadow_agreement_rate !== null && snapshot.shadow_agreement_rate < (shadowDrift.baseline ?? 0)) {
    proposals.push({
      proposal_id: `proposal-${snapshot.run_id}-shadow`,
      kind: 'prompt_adjustment',
      rationale:
        'AI shadow agreement rate dropped below the rolling baseline. The intake agent prompt context may need updating; review recent corrections in the learning profile before drafting.',
      evidence: [{ metric: 'shadow_agreement_rate', value: snapshot.shadow_agreement_rate }],
      status: 'proposed',
      requires_human_approval: false,
      created_at: now,
    });
  }

  const gateDrift = drift_flags.find((flag) => flag.metric === 'golden_gate_pass_rate' && flag.detected);
  if (gateDrift && snapshot.golden_gate_pass_rate !== null && snapshot.golden_gate_pass_rate < (gateDrift.baseline ?? 0)) {
    proposals.push({
      proposal_id: `proposal-${snapshot.run_id}-gates`,
      kind: 'prompt_adjustment',
      rationale:
        'Golden-gate pass rate dropped below the rolling baseline. Verify citation accuracy and unsupported-claim guardrails against recent reviewed sessions before the next promotion review.',
      evidence: [{ metric: 'golden_gate_pass_rate', value: snapshot.golden_gate_pass_rate }],
      status: 'proposed',
      requires_human_approval: false,
      created_at: now,
    });
  }

  return [...proposals, ...existing].slice(0, 10);
}
