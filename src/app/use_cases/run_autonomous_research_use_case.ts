import { buildStageDiff } from '@/features/stages/domain/stage_diff_engine';
import { evaluateAutonomousPromotion } from '@/features/narrative/domain/autonomous_promotion';
import { evaluateNarrativeGraphPromotions } from '@/features/narrative/domain/narrative_graph_promotion';
import { buildOperationalResearchState } from '@/features/reporting/domain/operational_research_state';
import { buildOperationalWeeklyBrief } from '@/features/reporting/domain/operational_weekly_brief';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { NormalizedEvidenceImport, EvidenceValidationReport } from '@/features/evidence/types/evidence_import';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';
import type { TopicRegistry, TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { AutonomousPromotionReport, AutonomousResearchPolicy, AutonomousResearchRun } from '@/features/research/types/autonomous_research';
import type { NarrativeGraphPromotionReport } from '@/features/narrative/types/narrative_graph_promotion';
import type { RunContext } from '@/platform/types/run_context';
import { artifactMetadata } from '@/platform/types/artifact_contract';
import { stageRank, type Stage } from '@/features/stages/domain/stages';

export interface RunAutonomousResearchUseCaseDeps {
  createRunContext(): RunContext;
  now(): string;
  readPolicy(): AutonomousResearchPolicy;
  readLatestSession(): EvidenceIntakeSession | null;
  readLatestAgentBundle(): IntakeAgentReviewBundle | null;
  readTopicAudit(): TopicResolutionAudit | null;
  readRegistry(): TopicRegistry;
  readOperationalEvidence(): EvidenceNode[];
  readPreviousOperatorRunId(): string | null;
  operationalArtifactPaths(runId: string): {
    sourceArtifacts: string[];
    artifactIndex: string[];
    runArtifacts: string[];
  };
  validateDrafts(input: { drafts: import('@/features/evidence/types/evidence_import').EvidenceImportDraft[]; sourceFile: string; generatedAt: string }): EvidenceValidationReport;
  normalizeDrafts(input: { drafts: import('@/features/evidence/types/evidence_import').EvidenceImportDraft[]; sourceFile: string; importedAt: string }): NormalizedEvidenceImport[];
  writePublishedEvidence(rows: EvidenceNode[]): void;
  applyNarrativeGraphPromotions(report: NarrativeGraphPromotionReport): void;
  writeNarrativeGraphPromotion(report: NarrativeGraphPromotionReport): void;
  readLatestSnapshot(): StageSnapshotHistory | null;
  writeRun(result: AutonomousResearchRun): void;
  validatePromotionReport(report: AutonomousPromotionReport): void;
  validateNarrativeGraphPromotion(report: NarrativeGraphPromotionReport): void;
  validateSnapshot(snapshot: StageSnapshotHistory): void;
  validateDiff(diff: import('@/features/stages/types/diff').StageDiff): void;
  validateWeeklyBrief(brief: import('@/features/reporting/types/report').WeeklyBrief): void;
}

export class RunAutonomousResearchUseCase {
  constructor(private readonly deps: RunAutonomousResearchUseCaseDeps) {}

  execute(input: { bundle?: IntakeAgentReviewBundle | null; publish?: boolean } = {}): AutonomousResearchRun {
    const context = this.deps.createRunContext();
    const artifactPaths = this.deps.operationalArtifactPaths(context.run_id);
    const generatedAt = this.deps.now();
    const policy = this.deps.readPolicy();
    const session = this.deps.readLatestSession();
    const bundle = input.bundle ?? this.deps.readLatestAgentBundle();
    const existingEvidence = this.deps.readOperationalEvidence();
    const evaluation = session && input.publish !== false
      ? evaluateAutonomousPromotion({
          session,
          topicAudit: this.deps.readTopicAudit(),
          agentCandidates: bundle?.candidates ?? [],
          agentAudit: bundle?.audit ?? null,
          existingEvidence,
          policy,
        })
      : { items: [], drafts: [] };

    let validation: EvidenceValidationReport | null = null;
    let published: EvidenceNode[] = [];
    let normalized: EvidenceNode[] = [];
    if (evaluation.drafts.length) {
      validation = this.deps.validateDrafts({
        drafts: evaluation.drafts,
        sourceFile: `autonomous://${session?.session_id ?? 'unknown'}`,
        generatedAt,
      });
      if (validation.status === 'passed') {
        normalized = this.deps.normalizeDrafts({
          drafts: evaluation.drafts,
          sourceFile: `autonomous://${session?.session_id ?? 'unknown'}`,
          importedAt: generatedAt,
        }).map((item) => ({
          ...item.evidence,
          source_type: item.draft.source_type,
          schema_version: '0.9-autonomous-research',
        }));
      }
    }

    const publicationFailed = Boolean(validation && validation.status === 'failed');
    const prospectiveState = normalized.length
      ? buildOperationalResearchState({
        registry: this.deps.readRegistry(),
        evidence: [...existingEvidence, ...normalized],
        runId: context.run_id,
        generatedAt,
      })
      : null;
    const heldTopicIds = prospectiveState
      ? topicsWithUnsafeStageJump(prospectiveState.snapshot, this.deps.readLatestSnapshot(), policy)
      : new Set<string>();
    if (!publicationFailed && heldTopicIds.size) {
      normalized = normalized.filter((item) => !heldTopicIds.has(item.topic_id) || item.parent_or_branch === 'branch');
    }
    if (!publicationFailed && normalized.length) {
      published = normalized;
      this.deps.writePublishedEvidence(published);
    }
    const items = evaluation.items.map((item) => publicationFailed && item.decision === 'published'
      ? { ...item, decision: 'held' as const, reasons: ['Evidence schema validation failed; automatic publication was stopped.'] }
      : heldTopicIds.has(item.topic_id ?? '') && item.scope === 'parent' && item.decision === 'published'
        ? { ...item, decision: 'held' as const, reasons: [`Prospective parent stage exceeds policy review ceiling ${policy.hold_stage_jump_above}.`] }
      : item);
    const report: AutonomousPromotionReport = {
      artifact_type: 'autonomous_promotion_report',
      schema_version: '1.0.0',
      producer_version: 'v0.11.0',
      run_id: context.run_id,
      generated_at: generatedAt,
      session_id: session?.session_id ?? null,
      policy_id: policy.policy_id,
      model_status: bundle?.audit.status ?? 'not_run',
      candidate_count: items.length,
      published_count: published.length,
      held_count: items.filter((item) => item.decision === 'held').length,
      rejected_count: items.filter((item) => item.decision === 'rejected').length,
      published_evidence_ids: published.map((item) => item.evidence_id),
      items,
      validation,
      guardrail_check: {
        evidence_table_required: true,
        stage_first_score_second: true,
        parent_branch_separation: true,
        no_trading_advice: true,
        provenance_required: policy.require_provenance,
        model_validation_required: policy.require_model_validation,
      },
    };
    const operationalEvidence = this.deps.readOperationalEvidence();
    const graphPromotion = evaluateNarrativeGraphPromotions({
      registry: this.deps.readRegistry(),
      evidence: operationalEvidence,
      policy,
      runId: context.run_id,
      generatedAt,
    });
    this.deps.validateNarrativeGraphPromotion(graphPromotion);
    this.deps.applyNarrativeGraphPromotions(graphPromotion);
    this.deps.writeNarrativeGraphPromotion(graphPromotion);
    const state = buildOperationalResearchState({
      registry: this.deps.readRegistry(),
      evidence: operationalEvidence,
      runId: context.run_id,
      generatedAt,
    });
    const diff = buildStageDiff(state.snapshot, this.deps.readLatestSnapshot());
    const weekly_brief = buildOperationalWeeklyBrief({
      context,
      snapshot: state.snapshot,
      diff,
      evidence: operationalEvidence,
      artifacts: {
        source_artifacts: artifactPaths.sourceArtifacts,
        artifact_index: artifactPaths.artifactIndex,
      },
    });
    const manifest = {
      ...artifactMetadata({
        artifact_type: 'run_manifest',
        rule_version: context.rule_version,
        run_id: context.run_id,
        generated_at: generatedAt,
      }),
      ...context,
      completed_at: this.deps.now(),
      status: 'ok' as const,
      commands: ['diff', 'report'],
      artifacts: artifactPaths.runArtifacts,
      previous_run_id: this.deps.readPreviousOperatorRunId(),
      current_snapshot_id: diff.current_snapshot_id,
      previous_snapshot_id: diff.previous_snapshot_id,
      guardrail_status: diff.guardrail_changes.length ? 'review_required' as const : 'ok' as const,
    };
    const result = { report, graph_promotion: graphPromotion, snapshot: state.snapshot, diff, weekly_brief, manifest };
    this.deps.validatePromotionReport(report);
    this.deps.validateSnapshot(state.snapshot);
    this.deps.validateDiff(diff);
    this.deps.validateWeeklyBrief(weekly_brief);
    this.deps.writeRun(result);
    return result;
  }
}

function topicsWithUnsafeStageJump(
  prospective: StageSnapshotHistory,
  previous: StageSnapshotHistory | null,
  policy: AutonomousResearchPolicy,
): Set<string> {
  const ceiling = stageRank[policy.hold_stage_jump_above as Stage];
  const previousById = new Map(previous?.topics.map((topic) => [topic.topic_id, topic]) ?? []);
  return new Set(prospective.topics
    .filter((topic) => topic.evidence_ids.length > 0)
    .filter((topic) => {
      const prior = previousById.get(topic.topic_id);
      const before = prior ? stageRank[prior.current_stage as Stage] : 0;
      const after = stageRank[topic.current_stage as Stage];
      return after > ceiling && after > before;
    })
    .map((topic) => topic.topic_id));
}
