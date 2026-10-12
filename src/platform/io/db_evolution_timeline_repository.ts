import { db } from '@/db/index';
import { evidence, stageSnapshots, systemRuns, topics } from '@/db/schema';
import type { EvidenceNode, EvidenceLayer, EvidenceScope, EvidenceStrength } from '@/features/evidence/domain/evidence';
import {
  reconstructAllTopicEvolutions,
  reconstructTopicEvolution,
  type TopicEvolutionTimeline,
} from '@/features/stages/domain/stage_evolution_reconstructor';

type TopicRow = typeof topics.$inferSelect;
type EvidenceRow = typeof evidence.$inferSelect;
type SnapshotRow = typeof stageSnapshots.$inferSelect;

/** Database-backed read projection used by both the CLI and operator UI. */
export class DbEvolutionTimelineRepository {
  readAll(): TopicEvolutionTimeline[] {
    const acceptedRunIds = new Set(db.select().from(systemRuns).all()
      .filter((run) => run.status === 'ok' && run.guardrail_status === 'ok')
      .map((run) => run.run_id));
    return buildEvolutionTimelineProjection(
      db.select().from(topics).all(),
      db.select().from(evidence).all(),
      db.select().from(stageSnapshots).all().filter((snapshot) => acceptedRunIds.has(snapshot.run_id)),
    );
  }
}

export function buildEvolutionTimelineProjection(
  topicRows: TopicRow[],
  evidenceRows: EvidenceRow[],
  snapshotRows: SnapshotRow[] = [],
): TopicEvolutionTimeline[] {
  const visibleTopics = topicRows.filter((topic) => topic.status !== 'archived');
  const canonicalByAlias = new Map<string, string>();

  for (const topic of visibleTopics) {
    canonicalByAlias.set(topic.topic_id, topic.topic_id);
    for (const alias of parseStringArray(topic.aliases_json)) canonicalByAlias.set(alias, topic.topic_id);
  }

  const normalizedEvidence = evidenceRows.flatMap((row) => {
    const canonicalTopicId = canonicalByAlias.get(row.topic_id);
    if (!canonicalTopicId) return [];
    return [{
      evidence_id: row.evidence_id,
      topic_id: canonicalTopicId,
      branch_id: row.branch_id,
      event_date: row.event_date,
      available_at: row.available_at,
      event_title: row.event_title,
      event_summary: row.event_summary ?? undefined,
      event_type: row.event_type,
      source_name: row.source_name,
      source_url: row.source_url ?? undefined,
      source_type: row.source_type ?? undefined,
      evidence_strength: row.evidence_strength as EvidenceStrength,
      affected_layer: parseStringArray(row.affected_layer_json) as EvidenceLayer[],
      stage_effect: row.stage_effect,
      parent_or_branch: (row.parent_or_branch ?? undefined) as EvidenceScope | undefined,
      interpretation: row.interpretation ?? undefined,
      limitation: row.limitation ?? undefined,
      positive_or_negative: (row.positive_or_negative ?? undefined) as EvidenceNode['positive_or_negative'],
      confidence: row.confidence ?? undefined,
    } satisfies EvidenceNode];
  });

  const timelines = reconstructAllTopicEvolutions(
    normalizedEvidence,
    visibleTopics.map((topic) => ({ topic_id: topic.topic_id, topic_name: topic.topic_name })),
  );

  return timelines.map((timeline) => {
    const topic = visibleTopics.find((item) => item.topic_id === timeline.topic_id)!;
    const acceptedIds = new Set([topic.topic_id, ...parseStringArray(topic.aliases_json)]);
    const observations = snapshotObservations(
      snapshotRows,
      acceptedIds,
      topic.topic_id,
      topic.topic_name,
      normalizedEvidence,
    ).slice(-12);
    if (observations.length === 0) {
      observations.push({
        observed_at: topic.created_at,
        stage: 'S0',
        evidence_ids: [],
        observation_kind: 'topic_registered',
      });
    }
    return { ...timeline, snapshot_observations: observations };
  });
}

function snapshotObservations(
  rows: SnapshotRow[],
  acceptedTopicIds: Set<string>,
  canonicalTopicId: string,
  topicName: string,
  allEvidence: EvidenceNode[],
) {
  const observations: NonNullable<TopicEvolutionTimeline['snapshot_observations']> = [];
  const evidenceById = new Map(allEvidence.map((item) => [item.evidence_id, item]));
  for (const row of [...rows].sort((left, right) => left.generated_at.localeCompare(right.generated_at))) {
    let parsed: { topics?: Array<{ topic_id: string; current_stage?: string; evidence_ids?: string[] }> };
    try { parsed = JSON.parse(row.snapshot_json) as typeof parsed; } catch { continue; }
    const topic = parsed.topics?.find((item) => acceptedTopicIds.has(item.topic_id));
    if (!topic?.current_stage || !Array.isArray(topic.evidence_ids) || topic.evidence_ids.length === 0) continue;
    const referencedEvidence = topic.evidence_ids.flatMap((evidenceId) => {
      const item = evidenceById.get(evidenceId);
      return item?.topic_id === canonicalTopicId ? [item] : [];
    });
    if (referencedEvidence.length !== topic.evidence_ids.length) continue;
    const replay = reconstructTopicEvolution(canonicalTopicId, topicName, referencedEvidence);
    if (replay.excluded_evidence.length > 0 || replay.current_stage !== topic.current_stage) continue;
    const previous = observations.at(-1);
    if (previous?.stage === topic.current_stage) continue;
    observations.push({
      observed_at: row.generated_at,
      stage: topic.current_stage,
      evidence_ids: topic.evidence_ids,
      observation_kind: 'stage_snapshot',
    });
  }
  return observations;
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
