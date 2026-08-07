import type { EvidenceNode } from '../../domain/evidence';
import type { GoldenCase } from '../../domain/golden_case';
import type { StageDiff, StageSnapshotHistory } from '../../types/diff';
import type { EvidenceImportDraft, EvidenceImportReport, EvidenceValidationReport } from '../../types/evidence_import';
import type { OperatorReview } from '../../types/operator_review';
import type { WeeklyBrief } from '../../types/report';
import type { RunManifest } from '../../types/run_context';

export interface EvidenceRepository {
  listEvidence(): EvidenceNode[];
  saveImportedEvidence(rows: EvidenceNode[]): void;
}

export interface TopicRepository {
  listTopics(): TopicRecordPort[];
}

export interface ArtifactRepository {
  readPipelineArtifacts(): unknown;
  writePipelineArtifacts(value: unknown): void;
  readWeeklyBrief(): WeeklyBrief;
  writeWeeklyBrief(report: WeeklyBrief, markdown: string): void;
}

export interface RunRepository {
  listRunManifests(): RunManifest[];
  readLatestRun(): RunManifest | null;
  writeRunManifest(manifest: RunManifest, updateLatest: boolean): void;
}

export interface HistoryRepository {
  readLatestSnapshot(): StageSnapshotHistory | null;
  writeSnapshot(snapshot: StageSnapshotHistory): void;
  writeDiff(diff: StageDiff, markdown: string): void;
}

export interface FailureCaseRepository {
  listFailureCases(): unknown[];
}

export interface ReviewRepository {
  writeOperatorReview(review: OperatorReview, markdown: string): void;
}

export interface EvidenceImportRepository {
  loadDraft(file: string): EvidenceImportDraft[];
  readDraftSource(file: string): string;
  writeValidationReport(report: EvidenceValidationReport): void;
  writeAcceptedImport(report: EvidenceValidationReport, normalized: unknown[]): EvidenceImportReport;
  writeRejectedImport(report: EvidenceValidationReport, sourceBody: string): EvidenceImportReport;
}

export interface GoldenCaseRepository {
  listGoldenCases(): GoldenCase[];
}
export interface TopicRecordPort {
  topic_id: string;
  topic_name: string;
  current_stage?: string;
  transition_target?: string;
  watch_status?: string;
}
