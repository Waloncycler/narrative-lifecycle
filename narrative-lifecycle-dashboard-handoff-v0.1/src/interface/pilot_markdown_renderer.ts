import type { PilotResearchLedger } from '../types/pilot';

function list(values: string[]): string {
  return values.length ? values.join(', ') : 'none';
}

export function renderPilotLedgerMarkdown(ledger: PilotResearchLedger): string {
  const lines = [
    '# Live Research Pilot Ledger',
    '',
    '## 1. Run Context',
    '',
    `- ledger_id: ${ledger.ledger_id}`,
    `- run_id: ${ledger.run_id}`,
    `- generated_at: ${ledger.generated_at}`,
    `- status: ${ledger.status}`,
    `- pilot_topic_count: ${ledger.pilot_topic_count}`,
    '',
    '## 2. Topic Ledger',
    '',
    ...ledger.ledger_entries.flatMap((entry) => [
      `- ${entry.topic_id}`,
      `  - current_hypothesis: ${entry.current_hypothesis}`,
      `  - competing_hypothesis: ${entry.competing_hypothesis}`,
      `  - current_stage: ${entry.current_stage}`,
      `  - latest_artifact_stage: ${entry.latest_artifact_stage ?? 'none'}`,
      `  - posterior_direction: ${entry.posterior_direction}`,
      `  - event_intensity: ${entry.event_intensity}`,
      `  - tail_structure: ${entry.tail_structure}`,
      `  - operator_agreement: ${entry.operator_agreement}`,
      `  - outcome_status: ${entry.outcome_status}`,
      `  - missed_change_detected: ${entry.missed_change_detected}`,
      `  - research_only_action: ${entry.research_only_action}`,
      `  - strongest_evidence_ids: ${list(entry.strongest_evidence_ids)}`,
      `  - falsification_trigger: ${entry.falsification_trigger}`,
      `  - status_note: ${entry.status_note}`,
    ]),
    '',
    '## 3. Evaluation Summary',
    '',
    `- research_time_saved: ${ledger.evaluation_summary.research_time_saved}`,
    `- operator_agreement_rate: ${ledger.evaluation_summary.operator_agreement_rate}`,
    `- stage_change_precision: ${ledger.evaluation_summary.stage_change_precision}`,
    `- early_radar_follow_through: ${ledger.evaluation_summary.early_radar_follow_through}`,
    `- false_positive_count: ${ledger.evaluation_summary.false_positive_count}`,
    `- missed_change_count: ${ledger.evaluation_summary.missed_change_count}`,
    `- falsification_count: ${ledger.evaluation_summary.falsification_count}`,
    `- consecutive_no_change_runs: ${ledger.evaluation_summary.consecutive_no_change_runs}`,
    '',
    '## 4. Guardrails',
    '',
    `- no_trading_advice: ${ledger.guardrail_check.no_trading_advice}`,
    `- required_hypotheses_present: ${ledger.guardrail_check.required_hypotheses_present}`,
    `- required_falsification_triggers_present: ${ledger.guardrail_check.required_falsification_triggers_present}`,
    `- research_only_actions: ${ledger.guardrail_check.research_only_actions}`,
    `- branch_parent_separation_preserved: ${ledger.guardrail_check.branch_parent_separation_preserved}`,
    '',
    '## 5. Source Artifacts',
    '',
    ...ledger.source_artifacts.map((artifact) => `- ${artifact}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}
