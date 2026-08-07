import { describe, it, expect } from 'vitest';
import { buildIncrementalMarker } from '../src/services/versioning_service';

describe('test_incremental_update', () => {
  it('marks records dirty only when event or evidence hashes change', () => {
    const first = buildIncrementalMarker({
      target_id: 'topic_1',
      event_hash: 'event_a',
      evidence_hash: 'evidence_a',
    });

    expect(first.dirty_flag).toBe(true);

    const unchanged = buildIncrementalMarker({
      target_id: 'topic_1',
      event_hash: 'event_a',
      evidence_hash: 'evidence_a',
      previous: first,
    });

    expect(unchanged.dirty_flag).toBe(false);

    const changed = buildIncrementalMarker({
      target_id: 'topic_1',
      event_hash: 'event_a',
      evidence_hash: 'evidence_b',
      previous: first,
    });

    expect(changed.dirty_flag).toBe(true);
  });
});
