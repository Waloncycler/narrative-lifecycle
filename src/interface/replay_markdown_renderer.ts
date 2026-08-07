import type { ReplayLedger } from '../types/replay';

function list(values: string[]): string {
  return values.length ? values.join(', ') : 'none';
}

export function renderReplayLedgerMarkdown(ledger: ReplayLedger): string {
  const lines = [
    '# Historical Narrative Replay',
    '',
    '## 1. Replay Window',
    '',
    `- ledger_id: ${ledger.ledger_id}`,
    `- run_id: ${ledger.run_id}`,
    `- generated_at: ${ledger.generated_at}`,
    `- status: ${ledger.status}`,
    `- case_count: ${ledger.case_count}`,
    '',
    '## 2. Aggregate Results',
    '',
    `- success_count: ${ledger.aggregate.success_count}`,
    `- failure_count: ${ledger.aggregate.failure_count}`,
    `- misclassification_count: ${ledger.aggregate.misclassification_count}`,
    `- missed_change_count: ${ledger.aggregate.missed_change_count}`,
    `- false_positive_count: ${ledger.aggregate.false_positive_count}`,
    `- average_lead_time_days: ${ledger.aggregate.average_lead_time_days}`,
    `- parent_branch_separation_preserved: ${ledger.aggregate.parent_branch_separation_preserved}`,
    '',
    '## 3. Case Results',
    '',
    ...ledger.replay_cases.flatMap((item) => [
      `- ${item.case_id}`,
      `  - topic_id: ${item.topic_id}`,
      `  - scenario_type: ${item.scenario_type}`,
      `  - final_stage_before_outcome: ${item.final_stage_before_outcome}`,
      `  - correct_stage: ${item.correct_stage}`,
      `  - outcome_status: ${item.outcome_status}`,
      `  - misclassification: ${item.misclassification}`,
      `  - lead_time_days: ${item.lead_time_days}`,
      `  - missed_change: ${item.missed_change}`,
      `  - false_positive: ${item.false_positive}`,
      `  - calibration_suggestion: ${item.calibration_suggestion}`,
      ...item.stage_path.map((slice) =>
        `  - ${slice.slice_id} as_of ${slice.as_of}: parent ${slice.parent_stage}; evidence ${list(slice.evidence_ids_used)}; future_excluded ${list(slice.future_evidence_excluded)}; radar ${list(slice.early_radar_candidate_ids)}`,
      ),
    ]),
    '',
    '## 4. Guardrails',
    '',
    `- no_future_evidence_used: ${ledger.guardrail_check.no_future_evidence_used}`,
    `- no_trading_advice: ${ledger.guardrail_check.no_trading_advice}`,
    `- no_price_based_outcome_inference: ${ledger.guardrail_check.no_price_based_outcome_inference}`,
    `- parent_branch_separation_preserved: ${ledger.guardrail_check.parent_branch_separation_preserved}`,
    '',
    '## 5. Source Artifacts',
    '',
    ...ledger.source_artifacts.map((artifact) => `- ${artifact}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}
