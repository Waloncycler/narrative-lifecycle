import type { AgentPurgeDecision } from '@/types/research_agent';

/**
 * Purge rules for the autonomous research agent (domain layer, pure functions).
 *
 * The agent may discard only artifacts it produced itself and that were never
 * human-reviewed: stale intake candidates and aged review queue entries.
 * Evidence that has been imported, reviewed decisions, and audit artifacts are
 * never touched by these rules.
 */

export interface StaleCandidateInput {
  candidate_id: string;
  created_at: string;
  reviewed: boolean;
  imported: boolean;
  status?: string;
}

export interface AgedQueueItemInput {
  item_id: string;
  created_at: string;
  priority: 'high' | 'medium' | 'low';
  status?: string;
}

export interface PurgeThresholds {
  stale_candidate_max_age_days: number;
  queue_high_priority_max_age_days: number;
  queue_medium_priority_max_age_days: number;
  queue_low_priority_max_age_days: number;
}

function ageDays(iso: string | undefined, now: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const at = new Date(iso).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(at) || Number.isNaN(current)) return Number.POSITIVE_INFINITY;
  return (current - at) / 86_400_000;
}

/** Candidates that the agent produced, were never reviewed, and are older than the threshold. */
export function staleCandidates(candidates: StaleCandidateInput[], now: string, maxAgeDays: number): AgentPurgeDecision[] {
  return candidates
    .filter((candidate) => !candidate.reviewed && !candidate.imported)
    .map((candidate) => {
      const age = ageDays(candidate.created_at, now);
      const expired = age >= maxAgeDays;
      return {
        discard: expired,
        reason: expired
          ? `unreviewed candidate aged ${age.toFixed(1)} days exceeds the ${maxAgeDays}-day purge threshold`
          : `unreviewed candidate aged ${age.toFixed(1)} days (below ${maxAgeDays}-day threshold)`,
        age_days: age,
        category: 'stale_candidate' as const,
        target_id: candidate.candidate_id,
      };
    });
}

const QUEUE_THRESHOLD_KEYS: Record<AgedQueueItemInput['priority'], keyof PurgeThresholds> = {
  high: 'queue_high_priority_max_age_days',
  medium: 'queue_medium_priority_max_age_days',
  low: 'queue_low_priority_max_age_days',
};

/** Review queue entries that aged beyond their priority-specific threshold. */
export function agedQueueItems(items: AgedQueueItemInput[], now: string, thresholds: PurgeThresholds): AgentPurgeDecision[] {
  return items.map((item) => {
    const maxAge = thresholds[QUEUE_THRESHOLD_KEYS[item.priority]];
    const age = ageDays(item.created_at, now);
    const expired = age >= maxAge;
    return {
      discard: expired,
      reason: expired
        ? `queue item aged ${age.toFixed(1)} days exceeds the ${item.priority}-priority ${maxAge}-day threshold`
        : `queue item aged ${age.toFixed(1)} days (below ${item.priority}-priority threshold)`,
      age_days: age,
      category: 'aged_queue_item' as const,
      target_id: item.item_id,
    };
  });
}

/** Decisions that should actually be applied (discard === true). */
export function purgeDecisions(decisions: AgentPurgeDecision[]): AgentPurgeDecision[] {
  return decisions.filter((decision) => decision.discard);
}
