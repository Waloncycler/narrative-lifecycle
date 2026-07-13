import type {
  ArtifactRepository,
  EvidenceRepository,
  FailureCaseRepository,
  HistoryRepository,
  ReviewRepository,
  RunRepository,
  TopicRecordPort,
  TopicRepository,
} from '../application/ports/repositories';
import type { EvidenceNode } from '../domain/evidence';
import type { StageDiff, StageSnapshotHistory } from '../types/diff';
import type { OperatorReview } from '../types/operator_review';
import type { WeeklyBrief } from '../types/report';
import type { RunManifest } from '../types/run_context';

export class InMemoryEvidenceRepository implements EvidenceRepository {
  constructor(private rows: EvidenceNode[] = []) {}
  listEvidence(): EvidenceNode[] { return [...this.rows]; }
  saveImportedEvidence(rows: EvidenceNode[]): void { this.rows = [...rows]; }
}

export class InMemoryTopicRepository implements TopicRepository {
  constructor(private topics: TopicRecordPort[] = []) {}
  listTopics(): TopicRecordPort[] { return [...this.topics]; }
}

export class InMemoryRunRepository implements RunRepository {
  constructor(private manifests: RunManifest[] = []) {}
  listRunManifests(): RunManifest[] { return [...this.manifests]; }
  readLatestRun(): RunManifest | null { return this.manifests.at(-1) ?? null; }
  writeRunManifest(manifest: RunManifest): void { this.manifests.push(manifest); }
}

export class InMemoryHistoryRepository implements HistoryRepository {
  snapshots: StageSnapshotHistory[] = [];
  diffs: StageDiff[] = [];
  readLatestSnapshot(): StageSnapshotHistory | null { return this.snapshots.at(-1) ?? null; }
  writeSnapshot(snapshot: StageSnapshotHistory): void { this.snapshots.push(snapshot); }
  writeDiff(diff: StageDiff): void { this.diffs.push(diff); }
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  pipelineArtifacts: unknown = null;
  weeklyBrief: WeeklyBrief | null = null;
  readPipelineArtifacts(): unknown { return this.pipelineArtifacts; }
  writePipelineArtifacts(value: unknown): void { this.pipelineArtifacts = value; }
  readWeeklyBrief(): WeeklyBrief { if (!this.weeklyBrief) throw new Error('weekly brief missing'); return this.weeklyBrief; }
  writeWeeklyBrief(report: WeeklyBrief): void { this.weeklyBrief = report; }
}

export class InMemoryFailureCaseRepository implements FailureCaseRepository {
  constructor(private cases: unknown[] = []) {}
  listFailureCases(): unknown[] { return [...this.cases]; }
}

export class InMemoryReviewRepository implements ReviewRepository {
  reviews: OperatorReview[] = [];
  writeOperatorReview(review: OperatorReview): void { this.reviews.push(review); }
}
