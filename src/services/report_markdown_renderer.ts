import type { WeeklyBrief } from '../types/report';

function bool(value: boolean): string {
  return value ? 'true' : 'false';
}

function list(values: string[]): string {
  return values.length ? values.join(', ') : 'none';
}

export function renderWeeklyBriefMarkdown(report: WeeklyBrief): string {
  const lines: string[] = [
    '# Weekly Narrative Lifecycle Brief',
    '',
    '## 1. Executive Summary',
    '',
    `- report_id: ${report.report_id}`,
    `- generated_at: ${report.generated_at}`,
    `- rule_version: ${report.executive_summary.rule_version ?? 'unknown'}`,
    `- dashboard_card_count: ${report.executive_summary.dashboard_card_count}`,
    `- score_count: ${report.executive_summary.score_count}`,
    `- golden_case_passed: ${report.executive_summary.golden_case_passed}`,
    `- golden_case_total: ${report.executive_summary.golden_case_total}`,
    `- early_radar_candidate_count: ${report.executive_summary.early_radar_candidate_count}`,
    `- system_status: ${report.executive_summary.system_status}`,
    '',
    '## 2. Stage Snapshot',
    '',
    ...report.stage_snapshot.flatMap((item) => [
      `- ${item.topic_name} (${item.topic_id})`,
      `  - current_stage: ${item.current_stage}`,
      `  - parent_narrative: ${item.parent_narrative}`,
      `  - strongest_branch: ${item.strongest_branch}`,
      `  - weakest_layer: ${item.weakest_layer}`,
      `  - data_confidence: ${item.data_confidence}`,
    ]),
    '',
    '## 3. Stage Changes',
    '',
    `- previous_snapshot_id: ${report.stage_change_summary.previous_snapshot_id ?? 'none'}`,
    `- current_snapshot_id: ${report.stage_change_summary.current_snapshot_id}`,
    ...(report.stage_changes.every((item) => item.change_type === 'no_change')
      ? [`No narrative state changes detected compared with ${report.stage_change_summary.previous_snapshot_id ?? 'no previous snapshot'}.`]
      : []),
    '',
    '### Upgrades',
    ...changeLines(report, 'stage_upgrade'),
    '### Downgrades',
    ...changeLines(report, 'stage_downgrade'),
    '### Evidence Added Without Stage Change',
    ...changeLines(report, 'evidence_added'),
    '### Why Not Higher Changes',
    ...changeLines(report, 'why_not_higher_changed'),
    '### Data Confidence Changes',
    ...changeLines(report, 'data_confidence_changed'),
    '### Branch Mutation Candidates',
    ...changeLines(report, 'branch_mutation_candidate'),
    '### Guardrail Regressions',
    ...(report.stage_change_summary.guardrail_regression_count
      ? ['- High-priority guardrail regression detected; review canonical diff artifacts.']
      : ['- none']),
    '',
    '## 4. Strongest Evidence',
    '',
    ...report.strongest_evidence.map((item) =>
      `- ${item.evidence_id}: ${item.topic}; strength=${item.evidence_strength}; layer=${list(item.affected_layer)}; interpretation=${item.interpretation}`,
    ),
    '',
    '## 5. Why Not Higher',
    '',
    ...report.why_not_higher.flatMap((item) => [
      `- ${item.topic_name} (${item.current_stage})`,
      `  - why_not_higher_stage: ${item.why_not_higher_stage}`,
      `  - evidence_ids: ${list(item.evidence_ids)}`,
    ]),
    '',
    '## 6. Early Radar Candidates',
    '',
    ...(report.early_radar_candidates.length
      ? report.early_radar_candidates.flatMap((item) => [
          `- ${item.candidate_topic}`,
          `  - candidate_id: ${item.candidate_id}`,
          `  - reason: ${item.reason}`,
          `  - reactivation_record_id: ${item.reactivation_record_id}`,
          `  - evidence_ids: ${list(item.evidence_ids)}`,
          `  - research_only_action: ${item.research_only_action}`,
        ])
      : ['- none']),
    '',
    '## 7. Guardrail Check',
    '',
    `- no_trading_advice: ${bool(report.guardrail_check.no_trading_advice)}`,
    `- research_only_actions: ${bool(report.guardrail_check.research_only_actions)}`,
    `- parent_branch_separation_preserved: ${bool(report.guardrail_check.parent_branch_separation_preserved)}`,
    `- evidence_ids_visible: ${bool(report.guardrail_check.evidence_ids_visible)}`,
    `- why_not_higher_present: ${bool(report.guardrail_check.why_not_higher_present)}`,
    `- data_confidence_present: ${bool(report.guardrail_check.data_confidence_present)}`,
    '',
    '## 8. Next Operator Actions',
    '',
    ...report.next_operator_actions.map((item) =>
      `- ${item.action}: ${item.topic_id ?? 'system'}; reason=${item.reason}; evidence_ids=${list(item.evidence_ids)}`,
    ),
    '',
    '## 9. Artifact Index',
    '',
    ...report.artifact_index.map((item) => `- ${item}`),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function changeLines(report: WeeklyBrief, type: string): string[] {
  const changes = report.stage_changes.filter((item) => item.detected_changes.includes(type));
  return changes.length
    ? changes.map((item) => `- ${item.topic_name}: ${item.previous_stage ?? 'none'} -> ${item.current_stage}; priority=${item.priority}; action=${item.research_only_action}; evidence_added=${list(item.new_evidence_ids)}`)
    : ['- none'];
}
