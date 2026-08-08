import { describe, expect, it } from 'vitest';
import { cronMatches, nextCronTime, parseCron } from '@/features/research/io/research_agent_scheduler';

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
});
