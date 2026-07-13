import { describe, expect, it } from 'vitest';
import { createRunContext, resolveRunContext } from '../src/services/run_context';

describe('run context', () => {
  it('uses an injected clock and suffix for deterministic IDs', () => {
    const context = createRunContext({ now: () => new Date('2026-07-11T19:30:45.123Z') }, 'abc123');
    expect(context).toMatchObject({
      run_id: 'run_20260711T193045123_abc123',
      started_at: '2026-07-11T19:30:45.123Z',
    });
  });

  it('uses an externally supplied context without generating a replacement ID', () => {
    const context = resolveRunContext({ NARRATIVE_RUN_ID: 'run_20260711T193045123_abc123', NARRATIVE_RUN_STARTED_AT: '2026-07-11T19:30:45.123Z' });
    expect(context.run_id).toBe('run_20260711T193045123_abc123');
  });
});
