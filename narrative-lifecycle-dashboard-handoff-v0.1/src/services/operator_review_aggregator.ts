import type { TopicChange } from '../types/diff';
import type {
  OperatorReview,
  OperatorReviewAlert,
  OperatorReviewFailureHit,
  OperatorReviewNextAction,
  OperatorReviewNoChangeStreak,
  OperatorReviewRepeatedIssue,
  OperatorReviewTrendPoint,
} from '../types/operator_review';
import type { ResearchSafeActionVerb } from '../types/report';
import { artifactMetadata } from '../types/artifact_contract';
import { type OperatorReviewRunArtifact, runEntry } from './operator_review_loader';
import { RULE_VERSION } from '../domain/versioning_service';

const forbiddenAdvicePattern = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;
const confidenceRank: Record<string, number> = { low: 0, medium: 1, high: 2 };

function issueKey(hit: OperatorReviewFailureHit): string {
  return `${hit.status}:${hit.issue}`;
}

function latestSuccessfulRun(artifacts: OperatorReviewRunArtifact[]): OperatorReviewRunArtifact | null {
  return [...artifacts].reverse().find((artifact) => artifact.manifest.status === 'ok') ?? null;
}

function trendFromTopic(runId: string, generatedAt: string, change: TopicChange, changeType: string): OperatorReviewTrendPoint {
  return {
    run_id: runId,
    generated_at: generatedAt,
    topic_id: change.topic_id,
    topic_name: change.topic_name,
    change_type: changeType,
    previous_value: changeType.includes('stage') ? change.previous_stage : undefined,
    current_value: changeType.includes('stage') ? change.current_stage : undefined,
    evidence_ids: change.new_evidence_ids.length ? change.new_evidence_ids : change.current_evidence_ids,
    branch_id: change.branch_id,
    reactivation_record_id: change.reactivation_record_id,
  };
}

function repeatedIssues(hits: OperatorReviewFailureHit[]): OperatorReviewRepeatedIssue[] {
  const grouped = new Map<string, OperatorReviewRepeatedIssue>();
  for (const hit of hits) {
    const key = issueKey(hit);
    const current = grouped.get(key) ?? { issue: hit.issue, count: 0, run_ids: [] };
    current.count += 1;
    current.run_ids.push(hit.run_id);
    grouped.set(key, current);
  }
  return [...grouped.values()].filter((item) => item.count > 1);
}

function noChangeStreaks(artifacts: OperatorReviewRunArtifact[]): OperatorReviewNoChangeStreak[] {
  const streaks = new Map<string, OperatorReviewNoChangeStreak>();
  for (const artifact of [...artifacts].reverse()) {
    const diff = artifact.stage_diff;
    if (!diff || artifact.manifest.status !== 'ok') continue;
    for (const change of diff.topic_changes) {
      const existing = streaks.get(change.topic_id);
      if (change.change_type === 'no_change') {
        if (!existing) {
          streaks.set(change.topic_id, {
            topic_id: change.topic_id,
            topic_name: change.topic_name,
            consecutive_run_count: 1,
            run_ids: [artifact.manifest.run_id],
            current_stage: change.current_stage,
          });
        } else {
          existing.consecutive_run_count += 1;
          existing.run_ids.unshift(artifact.manifest.run_id);
        }
      } else if (!existing) {
        streaks.set(change.topic_id, {
          topic_id: change.topic_id,
          topic_name: change.topic_name,
          consecutive_run_count: 0,
          run_ids: [],
          current_stage: change.current_stage,
        });
      }
    }
  }
  return [...streaks.values()].filter((item) => item.consecutive_run_count >= 2);
}

function failureHits(artifacts: OperatorReviewRunArtifact[]): OperatorReviewFailureHit[] {
  return artifacts.flatMap((artifact) => {
    const hits: OperatorReviewFailureHit[] = [];
    if (artifact.manifest.status === 'failed') {
      hits.push({
        run_id: artifact.manifest.run_id,
        status: 'failed',
        issue: 'weekly workflow failed before complete artifact set',
        command: artifact.manifest.commands.at(-1),
      });
    }
    if (artifact.manifest.guardrail_status === 'review_required') {
      hits.push({
        run_id: artifact.manifest.run_id,
        status: 'review_required',
        issue: 'run manifest reported guardrail review required',
      });
    }
    for (const regression of artifact.stage_diff?.guardrail_changes ?? []) {
      hits.push({
        run_id: artifact.manifest.run_id,
        status: 'review_required',
        issue: `guardrail regression: ${regression.guardrail}`,
      });
    }
    return hits;
  });
}

function alerts(input: {
  failures: OperatorReviewFailureHit[];
  downgrades: OperatorReviewTrendPoint[];
  guardrails: OperatorReviewTrendPoint[];
  confidence: OperatorReviewTrendPoint[];
  mutations: OperatorReviewTrendPoint[];
}): OperatorReviewAlert[] {
  const confidenceDrops = input.confidence.filter((point) =>
    point.previous_value && point.current_value && confidenceRank[point.current_value] < confidenceRank[point.previous_value],
  );
  return [
    ...input.guardrails.map((point) => ({
      priority: 'high' as const,
      category: 'guardrail_regression',
      message: `${point.change_type} requires operator review.`,
      run_ids: [point.run_id],
      research_only_action: 'flag_risk' as ResearchSafeActionVerb,
      evidence_ids: [],
    })),
    ...input.downgrades.map((point) => ({
      priority: 'high' as const,
      category: 'stage_downgrade',
      message: `${point.topic_name ?? point.topic_id} moved ${point.previous_value} -> ${point.current_value}.`,
      run_ids: [point.run_id],
      research_only_action: 'flag_risk' as ResearchSafeActionVerb,
      evidence_ids: point.evidence_ids,
    })),
    ...confidenceDrops.map((point) => ({
      priority: 'medium' as const,
      category: 'data_confidence_drop',
      message: `${point.topic_name ?? point.topic_id} confidence moved ${point.previous_value} -> ${point.current_value}.`,
      run_ids: [point.run_id],
      research_only_action: 'review' as ResearchSafeActionVerb,
      evidence_ids: point.evidence_ids,
    })),
    ...input.failures.map((hit) => ({
      priority: 'high' as const,
      category: 'failed_run',
      message: hit.issue,
      run_ids: [hit.run_id],
      research_only_action: 'review' as ResearchSafeActionVerb,
      evidence_ids: [],
    })),
    ...input.mutations.map((point) => ({
      priority: 'medium' as const,
      category: 'branch_mutation',
      message: `${point.topic_name ?? point.topic_id} has branch mutation ${point.branch_id ?? 'unknown branch'}; parent stage remains artifact-derived.`,
      run_ids: [point.run_id],
      research_only_action: 'review' as ResearchSafeActionVerb,
      evidence_ids: point.evidence_ids,
    })),
  ];
}

function nextActions(alertsValue: OperatorReviewAlert[], repeated: OperatorReviewRepeatedIssue[]): OperatorReviewNextAction[] {
  const actions: OperatorReviewNextAction[] = alertsValue.map((alert) => ({
    action: alert.research_only_action,
    reason: alert.message,
    run_ids: alert.run_ids,
    evidence_ids: alert.evidence_ids,
  }));
  for (const issue of repeated) {
    actions.push({
      action: 'review',
      reason: `Repeated issue: ${issue.issue}`,
      run_ids: issue.run_ids,
      evidence_ids: [],
    });
  }
  return actions;
}

export function buildOperatorReview(artifacts: OperatorReviewRunArtifact[], generatedAt = new Date().toISOString()): OperatorReview {
  const latest = latestSuccessfulRun(artifacts);
  const lastRun = artifacts.at(-1) ?? null;
  const sourceArtifacts = artifacts.flatMap((artifact) => artifact.source_artifacts);
  const reviewId = latest ? `operator_review_${latest.manifest.run_id}` : `operator_review_${generatedAt.replace(/[-:.]/g, '').slice(0, 15)}`;
  const runs = artifacts.map(runEntry);
  const failures = failureHits(artifacts);

  const upgrades: OperatorReviewTrendPoint[] = [];
  const downgrades: OperatorReviewTrendPoint[] = [];
  const evidenceAdded: OperatorReviewTrendPoint[] = [];
  const evidenceRemoved: OperatorReviewTrendPoint[] = [];
  const whyNotHigher: OperatorReviewTrendPoint[] = [];
  const dataConfidence: OperatorReviewTrendPoint[] = [];
  const branchMutations: OperatorReviewTrendPoint[] = [];
  const earlyRadar: OperatorReviewTrendPoint[] = [];
  const guardrails: OperatorReviewTrendPoint[] = [];

  for (const artifact of artifacts) {
    const diff = artifact.stage_diff;
    if (!diff || artifact.manifest.status !== 'ok') continue;
    for (const change of diff.topic_changes) {
      if (change.detected_changes.includes('stage_upgrade')) upgrades.push(trendFromTopic(diff.run_id, diff.generated_at, change, 'stage_upgrade'));
      if (change.detected_changes.includes('stage_downgrade')) downgrades.push(trendFromTopic(diff.run_id, diff.generated_at, change, 'stage_downgrade'));
      if (change.detected_changes.includes('evidence_added') || change.detected_changes.includes('evidence_changed')) {
        evidenceAdded.push({ ...trendFromTopic(diff.run_id, diff.generated_at, change, 'evidence_added'), evidence_ids: change.new_evidence_ids });
      }
      if (change.detected_changes.includes('evidence_removed') || change.detected_changes.includes('evidence_changed')) {
        evidenceRemoved.push({ ...trendFromTopic(diff.run_id, diff.generated_at, change, 'evidence_removed'), evidence_ids: change.removed_evidence_ids });
      }
      if (change.detected_changes.includes('why_not_higher_changed')) {
        whyNotHigher.push({
          ...trendFromTopic(diff.run_id, diff.generated_at, change, 'why_not_higher_changed'),
          previous_value: change.previous_why_not_higher_stage,
          current_value: change.current_why_not_higher_stage,
        });
      }
      if (change.detected_changes.includes('data_confidence_changed')) {
        dataConfidence.push({
          ...trendFromTopic(diff.run_id, diff.generated_at, change, 'data_confidence_changed'),
          previous_value: change.previous_data_confidence,
          current_value: change.current_data_confidence,
        });
      }
      if (change.detected_changes.includes('branch_mutation_candidate')) branchMutations.push(trendFromTopic(diff.run_id, diff.generated_at, change, 'branch_mutation_candidate'));
    }
    for (const change of diff.early_radar_changes) {
      earlyRadar.push({
        run_id: diff.run_id,
        generated_at: diff.generated_at,
        topic_name: change.candidate_topic,
        change_type: change.change_type,
        evidence_ids: change.evidence_ids,
        reactivation_record_id: change.reactivation_record_id,
      });
    }
    for (const change of diff.guardrail_changes) {
      guardrails.push({
        run_id: diff.run_id,
        generated_at: diff.generated_at,
        change_type: change.guardrail,
        previous_value: String(change.previous_value),
        current_value: String(change.current_value),
        evidence_ids: [],
      });
    }
  }

  const repeated = repeatedIssues(failures);
  const alertList = alerts({ failures, downgrades, guardrails, confidence: dataConfidence, mutations: branchMutations });
  const review: OperatorReview = {
    ...artifactMetadata({
      artifact_type: 'operator_review',
      rule_version: latest?.manifest.rule_version ?? RULE_VERSION,
      run_id: latest?.manifest.run_id ?? 'run_00000000T000000000_000000',
      generated_at: generatedAt,
    }),
    review_id: reviewId,
    generated_at: generatedAt,
    status: artifacts.length >= 2 ? 'ok' : 'insufficient_history',
    source_artifacts: sourceArtifacts,
    review_window: {
      first_run_id: artifacts[0]?.manifest.run_id ?? null,
      last_run_id: lastRun?.manifest.run_id ?? null,
      first_started_at: artifacts[0]?.manifest.started_at ?? null,
      last_completed_at: lastRun?.manifest.completed_at ?? null,
    },
    run_summary: {
      run_count: artifacts.length,
      successful_run_count: artifacts.filter((artifact) => artifact.manifest.status === 'ok').length,
      failed_run_count: artifacts.filter((artifact) => artifact.manifest.status === 'failed').length,
    },
    runs,
    stage_trends: { upgrades, downgrades },
    evidence_trends: { added: evidenceAdded, removed: evidenceRemoved },
    why_not_higher_changes: whyNotHigher,
    data_confidence_changes: dataConfidence,
    branch_mutation_changes: branchMutations,
    early_radar_changes: earlyRadar,
    guardrail_regressions: guardrails,
    failure_case_hits: failures,
    repeated_issues: repeated,
    consecutive_no_change_topics: noChangeStreaks(artifacts),
    high_priority_operator_alerts: alertList,
    research_only_next_actions: nextActions(alertList, repeated),
  };

  if (forbiddenAdvicePattern.test(JSON.stringify(review))) {
    throw new Error('Operator review contains forbidden trading language');
  }
  return review;
}
