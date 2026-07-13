import type { StageDiff } from '../types/diff';

function rows(diff: StageDiff, type: string): string {
  const matches = diff.topic_changes.filter((change) => change.detected_changes.includes(type as never));
  if (!matches.length) return 'None.\n';
  return `${matches.map((change) =>
    `- **${change.topic_name}**: ${change.previous_stage ?? 'none'} -> ${change.current_stage}; ${change.change_reason}`,
  ).join('\n')}\n`;
}

export function renderStageDiffMarkdown(diff: StageDiff): string {
  const summary = diff.status === 'no_previous_snapshot'
    ? 'No previous snapshot found. Current run saved as baseline.'
    : `${diff.summary.topic_count} topics compared against ${diff.previous_snapshot_id}.`;
  const radar = diff.early_radar_changes.length
    ? diff.early_radar_changes.map((change) => `- **${change.candidate_topic}**: ${change.change_type}; reactivation: ${change.reactivation_record_id}`).join('\n')
    : 'None.';
  const guardrails = diff.guardrail_changes.length
    ? diff.guardrail_changes.map((change) => `- **${change.guardrail}**: regression; action: ${change.research_only_action}`).join('\n')
    : 'None.';
  const actions = diff.next_operator_actions.length
    ? diff.next_operator_actions.map((action) => `- **${action.action}** ${action.topic_id ?? 'system'}: ${action.reason}`).join('\n')
    : '- observe system baseline and compare the next run.';

  return `# Narrative Stage Diff Report

## 1. Summary

${summary}

- Status: ${diff.status}
- Upgrades: ${diff.summary.stage_upgrade_count}
- Downgrades: ${diff.summary.stage_downgrade_count}
- Evidence additions: ${diff.summary.evidence_added_count}
- Branch mutation candidates: ${diff.summary.branch_mutation_candidate_count}
- Guardrail regressions: ${diff.summary.guardrail_regression_count}

## 2. Stage Upgrades

${rows(diff, 'stage_upgrade')}
## 3. Stage Downgrades

${rows(diff, 'stage_downgrade')}
## 4. Evidence Added Without Stage Change

${rows(diff, 'evidence_added')}
## 5. Why Not Higher Changes

${rows(diff, 'why_not_higher_changed')}
## 6. Branch Mutation Candidates

${rows(diff, 'branch_mutation_candidate')}
## 7. Early Radar Changes

${radar}

## 8. Guardrail Changes

${guardrails}

## 9. Next Operator Actions

${actions}

## 10. Snapshot Index

- Previous: ${diff.previous_snapshot_id ?? 'none'}
- Current: ${diff.current_snapshot_id}
- Diff: ${diff.diff_id}
`;
}
