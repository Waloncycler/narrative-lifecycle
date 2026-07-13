import { describe, it, expect } from 'vitest';
import { createRuleVersion, RULE_VERSION } from '../src/services/versioning_service';

describe('test_stage_gate_versioning', () => {
  it('exposes explicit rule version metadata for auditability', () => {
    const version = createRuleVersion();

    expect(version.rule_version_id).toBe(RULE_VERSION);
    expect(version.version).toBe('0.1');
    expect(version.changed_rules).toContain('stage gates');
    expect(version.changed_rules).toContain('parent branch separation');
  });
});
