import { desc, eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { db } from '@/db/index';
import { branches, evidence, genericArtifacts, operatorReviews, stageDiffs, stageSnapshots, systemRuns, topics, weeklyBriefs } from '@/db/schema';
import type { OperatorReview } from '@/features/reporting/types/operator_review';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type { StageDiff, StageSnapshotHistory } from '@/features/stages/types/diff';
import type { RunManifest } from '@/platform/types/run_context';
import type { RegisteredNarrativeTopic } from '@/features/narrative/types/registered_topic';
export type { RegisteredNarrativeTopic } from '@/features/narrative/types/registered_topic';

/** Read model for the operator workbench. It owns SQLite details so the UI
 * never has to know whether an artifact was formerly a file. */
export class DbNarrativeMonitorRepository {
  constructor(private readonly repoRoot: string) {}

  readLatestSnapshot(): StageSnapshotHistory | null {
    const row = db.select().from(stageSnapshots).orderBy(desc(stageSnapshots.generated_at)).limit(1).get();
    return row ? parseJson<StageSnapshotHistory>(row.snapshot_json) : null;
  }

  readLatestWeeklyBrief(): WeeklyBrief | null {
    const row = db.select().from(weeklyBriefs).orderBy(desc(weeklyBriefs.generated_at)).limit(1).get();
    return row ? parseJson<WeeklyBrief>(row.report_json) : null;
  }

  readLatestStageDiff(): StageDiff | null {
    const row = db.select().from(stageDiffs).orderBy(desc(stageDiffs.generated_at)).limit(1).get();
    return row ? parseJson<StageDiff>(row.diff_json) : null;
  }

  readLatestOperatorReview(): OperatorReview | null {
    const row = db.select().from(operatorReviews).orderBy(desc(operatorReviews.generated_at)).limit(1).get();
    return row ? parseJson<OperatorReview>(row.review_json) : null;
  }

  readLatestRun(): RunManifest | null {
    const row = db.select().from(systemRuns).orderBy(desc(systemRuns.started_at)).limit(1).get();
    return row ? parseJson<RunManifest>(row.manifest_json) : null;
  }

  listRecentRuns(limit = 30): RunManifest[] {
    return db.select().from(systemRuns).orderBy(desc(systemRuns.started_at)).limit(limit).all()
      .flatMap((row) => {
        const manifest = parseJson<RunManifest>(row.manifest_json);
        return manifest ? [manifest] : [];
      });
  }

  readRegisteredTopics(): RegisteredNarrativeTopic[] {
    const branchRows = db.select().from(branches).all();
    const evidenceRows = db.select().from(evidence).all();
    const evidenceByTopic = new Map<string, string[]>();
    const evidenceByBranch = new Map<string, string[]>();
    for (const row of evidenceRows) {
      if (row.branch_id || row.parent_or_branch === 'branch') {
        if (row.branch_id) evidenceByBranch.set(row.branch_id, [...(evidenceByBranch.get(row.branch_id) ?? []), row.evidence_id]);
      } else {
        evidenceByTopic.set(row.topic_id, [...(evidenceByTopic.get(row.topic_id) ?? []), row.evidence_id]);
      }
    }
    return db.select().from(topics).orderBy(topics.topic_name).all().map((topic) => ({
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      current_stage: topic.current_stage,
      updated_at: topic.updated_at,
      parent_evidence_ids: evidenceByTopic.get(topic.topic_id) ?? [],
      branches: branchRows.filter((branch) => branch.topic_id === topic.topic_id).map((branch) => ({
        branch_id: branch.branch_id,
        branch_name: branch.market_name_zh,
        evidence_ids: evidenceByBranch.get(branch.branch_id) ?? [],
      })),
    }));
  }

  readArtifact<T>(relativePath: string): T | null {
    const normalized = relativePath.replace(/^outputs\//, '');
    const ids = [...new Set([
      normalized,
      relativePath,
      resolve(this.repoRoot, normalized),
      resolve(this.repoRoot, relativePath),
    ])];
    for (const artifactId of ids) {
      const row = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, artifactId)).get();
      const parsed = row ? parseJson<T>(row.content_json) : null;
      if (parsed !== null) return parsed;
    }
    return null;
  }
}

function parseJson<T>(value: string): T | null {
  try { return JSON.parse(value) as T; } catch { return null; }
}
