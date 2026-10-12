import type { ResearchAgentLoopKind, ResearchAgentRunManifest, ResearchAgentSchedulerConfig, ResearchAgentTrigger } from '@/features/research/types/research_agent';

/**
 * Embedded scheduling daemon for the autonomous research agent.
 *
 * Runs inside the web workbench process. Supports a standard 5-field cron
 * expression for the daily loop plus a repeat interval for quick loops.
 * Reads its configuration from a JSON file so the web UI can adjust it.
 */

export interface ResearchAgentSchedulerDeps {
  runLoop(kind: ResearchAgentLoopKind, trigger: ResearchAgentTrigger, options?: { deep_max_rounds?: number; deep_queries_per_round?: number }): Promise<ResearchAgentRunManifest>;
  readConfig(): ResearchAgentSchedulerConfig;
  writeConfig(config: ResearchAgentSchedulerConfig): void;
  now(): Date;
}

function parseField(value: string, min: number, max: number): Set<number> {
  const matches = new Set<number>();
  if (value === '*') {
    for (let i = min; i <= max; i += 1) matches.add(i);
    return matches;
  }
  for (const part of value.split(',')) {
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= min && n <= max) matches.add(n);
    }
  }
  return matches;
}

export interface CronExpression {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
}

export function parseCron(expression: string): CronExpression {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`invalid cron expression "${expression}": expected 5 fields`);
  return {
    minutes: parseField(parts[0], 0, 59),
    hours: parseField(parts[1], 0, 23),
    daysOfMonth: parseField(parts[2], 1, 31),
    months: parseField(parts[3], 1, 12),
    daysOfWeek: parseField(parts[4], 0, 6),
  };
}

export function cronMatches(expression: CronExpression, at: Date): boolean {
  const minute = at.getMinutes();
  const hour = at.getHours();
  const dayOfMonth = at.getDate();
  const month = at.getMonth() + 1;
  const dayOfWeek = at.getDay();
  return (
    expression.minutes.has(minute) &&
    expression.hours.has(hour) &&
    expression.daysOfMonth.has(dayOfMonth) &&
    expression.months.has(month) &&
    expression.daysOfWeek.has(dayOfWeek)
  );
}

export function nextCronTime(expression: string, from: Date): Date {
  const parsed = parseCron(expression);
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  for (let dayOffset = 0; dayOffset <= 400; dayOffset += 1) {
    const probe = new Date(candidate);
    probe.setDate(candidate.getDate() + dayOffset);
    if (!parsed.months.has(probe.getMonth() + 1)) continue;
    if (!parsed.daysOfMonth.has(probe.getDate())) continue;
    if (!parsed.daysOfWeek.has(probe.getDay())) continue;
    for (let hour = 0; hour < 24; hour += 1) {
      if (!parsed.hours.has(hour)) continue;
      for (const minute of [...parsed.minutes].sort((a, b) => a - b)) {
        const time = new Date(probe);
        time.setHours(hour, minute, 0, 0);
        if (time > from) return time;
      }
    }
  }
  throw new Error(`no next run found within 400 days for "${expression}"`);
}

export class ResearchAgentScheduler {
  private timer: NodeJS.Timeout | null = null;
  private lastQuickAt: string | null = null;
  private inFlight = false;

  constructor(private readonly deps: ResearchAgentSchedulerDeps) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get running(): boolean {
    return this.inFlight;
  }

  nextDailyRun(): string | null {
    const config = this.deps.readConfig();
    if (!config.enabled) return null;
    try {
      return nextCronTime(config.daily_cron, this.deps.now()).toISOString();
    } catch {
      return null;
    }
  }

  /** Next daily deep sweep run, or null when the deep loop is disabled. */
  nextDeepRun(): string | null {
    const config = this.deps.readConfig();
    if (!config.enabled || !config.deep_enabled) return null;
    try {
      return nextCronTime(config.deep_cron, this.deps.now()).toISOString();
    } catch {
      return null;
    }
  }

  async runNow(kind: ResearchAgentLoopKind): Promise<ResearchAgentRunManifest> {
    if (this.inFlight) throw new Error('a research agent loop is already running');
    return this.run(kind, 'manual', this.deepOptions(kind));
  }

  private async tick(): Promise<void> {
    if (this.inFlight) return;
    const config = this.deps.readConfig();
    if (!config.enabled) return;

    const now = this.deps.now();
    try {
      if (cronMatches(parseCron(config.daily_cron), now)) {
        await this.run('daily', 'scheduler');
        return;
      }
    } catch {
      // malformed daily cron: fall through to the remaining checks
    }

    if (config.deep_enabled) {
      try {
        if (cronMatches(parseCron(config.deep_cron), now)) {
          await this.run('deep', 'scheduler', this.deepOptions('deep'));
          return;
        }
      } catch {
        // malformed deep cron: fall through to quick loop only
      }
    }

    if (config.quick_enabled) {
      const intervalMs = config.quick_interval_hours * 3_600_000;
      const due = !this.lastQuickAt || now.getTime() - new Date(this.lastQuickAt).getTime() >= intervalMs;
      if (due) {
        this.lastQuickAt = now.toISOString();
        await this.run('quick', 'scheduler');
      }
    }
  }

  private deepOptions(kind: ResearchAgentLoopKind): { deep_max_rounds?: number; deep_queries_per_round?: number } | undefined {
    if (kind !== 'deep') return undefined;
    const config = this.deps.readConfig();
    return {
      deep_max_rounds: config.deep_max_rounds,
      deep_queries_per_round: config.deep_queries_per_round,
    };
  }

  private async run(kind: ResearchAgentLoopKind, trigger: ResearchAgentTrigger, options?: { deep_max_rounds?: number; deep_queries_per_round?: number }): Promise<ResearchAgentRunManifest> {
    this.inFlight = true;
    try {
      return await this.deps.runLoop(kind, trigger, options);
    } finally {
      this.inFlight = false;
    }
  }
}
