import { describe, expect, it } from 'vitest';
import { cronMatches, nextCronTime, parseCron, ResearchAgentScheduler, type ResearchAgentSchedulerDeps } from '@/features/research/io/research_agent_scheduler';
import { DEFAULT_SCHEDULER_CONFIG } from '@/features/research/types/research_agent';

describe('research agent scheduler cron', () => {
  it('parses and matches a daily 06:00 cron in local time', () => {
    const parsed = parseCron('0 6 * * *');
    expect(cronMatches(parsed, new Date(2026, 7, 1, 6, 0, 0))).toBe(true);
    expect(cronMatches(parsed, new Date(2026, 7, 1, 5, 59, 0))).toBe(false);
    expect(cronMatches(parsed, new Date(2026, 7, 1, 6, 30, 0))).toBe(false);
  });

  it('rejects malformed cron expressions', () => {
    expect(() => parseCron('not-a-cron')).toThrow();
    expect(() => parseCron('* * *')).toThrow();
  });

  it('computes the next daily run after a given time', () => {
    const next = nextCronTime('0 6 * * *', new Date(2026, 7, 1, 8, 0, 0));
    expect(next.getTime()).toBe(new Date(2026, 7, 2, 6, 0, 0).getTime());
  });

  it('handles month/day-of-month constraints', () => {
    const next = nextCronTime('0 9 1 * *', new Date(2026, 7, 2, 0, 0, 0));
    expect(next.getTime()).toBe(new Date(2026, 8, 1, 9, 0, 0).getTime());
  });

  it('parses and matches the daily deep sweep cron', () => {
    expect(cronMatches(parseCron('0 7 * * *'), new Date(2026, 7, 3, 7, 0, 0))).toBe(true);
    expect(cronMatches(parseCron('0 7 * * *'), new Date(2026, 7, 3, 6, 59, 0))).toBe(false);
    expect(cronMatches(parseCron('0 7 * * *'), new Date(2026, 7, 4, 7, 0, 0))).toBe(true);
    expect(nextCronTime('0 7 * * *', new Date(2026, 7, 3, 8, 0, 0)).getTime()).toBe(new Date(2026, 7, 4, 7, 0, 0).getTime());
  });
});

describe('ResearchAgentScheduler deep scheduling', () => {
  const manifest = { run_id: 'run_1', status: 'completed' } as never;

  function schedulerWith(overrides: { deepEnabled?: boolean; deepCron?: string; deepMaxRounds?: number; deepQueriesPerRound?: number; quickEnabled?: boolean; now?: Date; runs?: Array<{ kind: string; trigger: string; options?: { deep_max_rounds?: number; deep_queries_per_round?: number } }> }): ResearchAgentScheduler {
    const runs = overrides.runs ?? [];
    const config = {
      ...DEFAULT_SCHEDULER_CONFIG,
      deep_enabled: overrides.deepEnabled ?? true,
      deep_cron: overrides.deepCron ?? DEFAULT_SCHEDULER_CONFIG.deep_cron,
      deep_max_rounds: overrides.deepMaxRounds ?? DEFAULT_SCHEDULER_CONFIG.deep_max_rounds,
      deep_queries_per_round: overrides.deepQueriesPerRound ?? DEFAULT_SCHEDULER_CONFIG.deep_queries_per_round,
      quick_enabled: overrides.quickEnabled ?? true,
    };
    const deps: ResearchAgentSchedulerDeps = {
      runLoop: async (kind, trigger, options) => { runs.push({ kind, trigger, options }); return manifest; },
      readConfig: () => config,
      writeConfig: () => undefined,
      now: () => overrides.now ?? new Date(2026, 7, 3, 7, 0, 0),
    };
    return new ResearchAgentScheduler(deps);
  }

  it('computes the next deep run from the daily cron', () => {
    const scheduler = schedulerWith({ now: new Date(2026, 7, 4, 8, 0, 0) });
    expect(scheduler.nextDeepRun()).toBe(new Date(2026, 7, 5, 7, 0, 0).toISOString());
  });

  it('returns null for the next deep run when the deep loop is disabled', () => {
    const scheduler = schedulerWith({ deepEnabled: false });
    expect(scheduler.nextDeepRun()).toBeNull();
  });

  it('runs a deep loop when the deep cron matches', async () => {
    const runs: Array<{ kind: string; trigger: string; options?: { deep_max_rounds?: number; deep_queries_per_round?: number } }> = [];
    const scheduler = schedulerWith({ now: new Date(2026, 7, 3, 7, 0, 0), deepMaxRounds: 20, deepQueriesPerRound: 50, runs });
    await (scheduler as unknown as { tick(): Promise<void> }).tick();
    expect(runs).toEqual([{ kind: 'deep', trigger: 'scheduler', options: { deep_max_rounds: 20, deep_queries_per_round: 50 } }]);
  });

  it('skips the deep loop when its cron does not match', async () => {
    const runs: Array<{ kind: string; trigger: string; options?: { deep_max_rounds?: number; deep_queries_per_round?: number } }> = [];
    const scheduler = schedulerWith({ now: new Date(2026, 7, 4, 7, 1, 0), quickEnabled: false, runs });
    await (scheduler as unknown as { tick(): Promise<void> }).tick();
    expect(runs).toEqual([]);
  });
});
