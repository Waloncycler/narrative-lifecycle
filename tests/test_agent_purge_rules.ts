import { describe, expect, it } from 'vitest';
import { agedQueueItems, purgeDecisions, staleCandidates } from '@/features/research/domain/agent_purge_rules';

const now = '2026-08-01T00:00:00.000Z';
const daysAgo = (days: number): string => new Date(Date.parse(now) - days * 86_400_000).toISOString();

describe('agent purge rules', () => {
  it('flags unreviewed candidates older than the threshold', () => {
    const decisions = staleCandidates(
      [
        { candidate_id: 'old', created_at: daysAgo(40), reviewed: false, imported: false },
        { candidate_id: 'recent', created_at: daysAgo(5), reviewed: false, imported: false },
      ],
      now,
      30,
    );
    const byId = Object.fromEntries(decisions.map((d) => [d.target_id, d]));
    expect(byId.old.discard).toBe(true);
    expect(byId.old.category).toBe('stale_candidate');
    expect(byId.recent.discard).toBe(false);
  });

  it('never discards reviewed or imported candidates', () => {
    const decisions = staleCandidates(
      [
        { candidate_id: 'reviewed', created_at: daysAgo(60), reviewed: true, imported: false },
        { candidate_id: 'imported', created_at: daysAgo(60), reviewed: false, imported: true },
      ],
      now,
      30,
    );
    expect(decisions.every((d) => !d.discard)).toBe(true);
  });

  it('applies priority-specific thresholds to queue items', () => {
    const decisions = agedQueueItems(
      [
        { item_id: 'high', created_at: daysAgo(20), priority: 'high' },
        { item_id: 'medium', created_at: daysAgo(20), priority: 'medium' },
        { item_id: 'low', created_at: daysAgo(20), priority: 'low' },
      ],
      now,
      { stale_candidate_max_age_days: 30, queue_high_priority_max_age_days: 14, queue_medium_priority_max_age_days: 21, queue_low_priority_max_age_days: 30 },
    );
    const byId = Object.fromEntries(decisions.map((d) => [d.target_id, d]));
    expect(byId.high.discard).toBe(true);
    expect(byId.medium.discard).toBe(false);
    expect(byId.low.discard).toBe(false);
  });

  it('returns only discard decisions from purgeDecisions', () => {
    const decisions = [
      { discard: true, reason: 'a', age_days: 40, category: 'stale_candidate' as const, target_id: 'x' },
      { discard: false, reason: 'b', age_days: 5, category: 'stale_candidate' as const, target_id: 'y' },
    ];
    const applied = purgeDecisions(decisions);
    expect(applied).toHaveLength(1);
    expect(applied[0].target_id).toBe('x');
  });
});
