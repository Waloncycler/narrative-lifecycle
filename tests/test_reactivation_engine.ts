import { describe, expect, it } from 'vitest';
import { shouldEnterRadar } from '../src/rules/reactivation_rules';

describe('reactivation engine', () => {
  it('does not enter radar for ordinary repeated old story', () => {
    expect(shouldEnterRadar('repeated_old_story', 80)).toBe(false);
  });

  it('allows repeated old stories only with exceptional material narrative delta', () => {
    expect(shouldEnterRadar('repeated_old_story', 85)).toBe(true);
  });

  it('enters radar for material stage reactivation', () => {
    expect(shouldEnterRadar('stage_reactivation', 65)).toBe(true);
  });

  it('keeps weak old-topic signal out of radar', () => {
    expect(shouldEnterRadar('dormant_signal_reactivation', 30)).toBe(false);
  });
});
