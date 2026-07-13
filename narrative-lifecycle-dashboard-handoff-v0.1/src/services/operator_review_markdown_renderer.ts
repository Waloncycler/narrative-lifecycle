import type { OperatorReview, OperatorReviewTrendPoint } from '../types/operator_review';

function list(values: string[]): string {
  return values.length ? values.join(', ') : 'none';
}

function trendRows(points: OperatorReviewTrendPoint[], valueLabel = 'value'): string[] {
  return points.length
    ? points.map((point) =>
        `- ${point.run_id}: ${point.topic_name ?? point.topic_id ?? 'system'}; ${valueLabel}=${point.previous_value ?? 'none'} -> ${point.current_value ?? 'none'}; evidence_ids=${list(point.evidence_ids)}`,
      )
    : ['- none'];
}

export function renderOperatorReviewMarkdown(review: OperatorReview): string {
  const lines = [
    '# Historical Operator Review',
    '',
    '## 1. Review Window',
    '',
    `- review_id: ${review.review_id}`,
    `- generated_at: ${review.generated_at}`,
    `- status: ${review.status}`,
    `- first_run_id: ${review.review_window.first_run_id ?? 'none'}`,
    `- last_run_id: ${review.review_window.last_run_id ?? 'none'}`,
    `- run_count: ${review.run_summary.run_count}`,
    `- successful_run_count: ${review.run_summary.successful_run_count}`,
    `- failed_run_count: ${review.run_summary.failed_run_count}`,
    '',
    '## 2. Stage Upgrade/Downgrade Trends',
    '',
    '### Upgrades',
    ...trendRows(review.stage_trends.upgrades, 'stage'),
    '### Downgrades',
    ...trendRows(review.stage_trends.downgrades, 'stage'),
    '',
    '## 3. Evidence Added/Removed Trends',
    '',
    '### Added',
    ...trendRows(review.evidence_trends.added, 'evidence'),
    '### Removed',
    ...trendRows(review.evidence_trends.removed, 'evidence'),
    '',
    '## 4. Why Not Higher And Data Confidence',
    '',
    '### Why Not Higher Changes',
    ...trendRows(review.why_not_higher_changes, 'why_not_higher'),
    '### Data Confidence Changes',
    ...trendRows(review.data_confidence_changes, 'data_confidence'),
    '',
    '## 5. Branch Mutation And Early Radar',
    '',
    '### Branch Mutation Candidates',
    ...trendRows(review.branch_mutation_changes, 'branch'),
    '### Early Radar Changes',
    ...trendRows(review.early_radar_changes, 'early_radar'),
    '',
    '## 6. Guardrail Regression History',
    '',
    ...trendRows(review.guardrail_regressions, 'guardrail'),
    '',
    '## 7. Failure-Case Hits And Repeated Issues',
    '',
    ...(review.failure_case_hits.length
      ? review.failure_case_hits.map((hit) => `- ${hit.run_id}: ${hit.status}; issue=${hit.issue}; command=${hit.command ?? 'none'}`)
      : ['- none']),
    '',
    '### Repeated Issues',
    ...(review.repeated_issues.length
      ? review.repeated_issues.map((issue) => `- ${issue.issue}: count=${issue.count}; run_ids=${list(issue.run_ids)}`)
      : ['- none']),
    '',
    '## 8. Consecutive No Change Topics',
    '',
    ...(review.consecutive_no_change_topics.length
      ? review.consecutive_no_change_topics.map((topic) => `- ${topic.topic_name}: count=${topic.consecutive_run_count}; current_stage=${topic.current_stage}; run_ids=${list(topic.run_ids)}`)
      : ['- none']),
    '',
    '## 9. High-Priority Operator Alerts',
    '',
    ...(review.high_priority_operator_alerts.length
      ? review.high_priority_operator_alerts.map((alert) => `- ${alert.priority}: ${alert.category}; action=${alert.research_only_action}; message=${alert.message}; run_ids=${list(alert.run_ids)}`)
      : ['- none']),
    '',
    '## 10. Research-Only Next Actions',
    '',
    ...(review.research_only_next_actions.length
      ? review.research_only_next_actions.map((action) => `- ${action.action}: ${action.reason}; run_ids=${list(action.run_ids)}; evidence_ids=${list(action.evidence_ids)}`)
      : ['- observe: No additional historical review action required; continue artifact-based monitoring.']),
    '',
    '## 11. Source Artifacts',
    '',
    ...review.source_artifacts.map((artifact) => `- ${artifact}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}
