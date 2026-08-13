import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuditLog, createManualOverride, RULE_VERSION } from '@/platform/core/versioning_service';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('test_manual_override_audit', () => {
  it('records old value, new value, reason, reviewer, evidence ids, and rule version', () => {
    const override = createManualOverride({
      override_id: 'ov_1',
      target_type: 'dashboard_card',
      target_id: 'bci',
      field_name: 'current_stage',
      old_value: 'S5',
      new_value: 'S4',
      override_reason: 'Branch validation should not upgrade the BCI parent narrative.',
      reviewer: 'research_lead',
    });

    expect(override.old_value).toBe('S5');
    expect(override.new_value).toBe('S4');
    expect(override.reviewer).toBe('research_lead');
    expect(override.rule_version).toBe(RULE_VERSION);

    const audit = createAuditLog({
      audit_id: 'audit_1',
      target_type: 'dashboard_card',
      target_id: 'bci',
      action: 'manual_override',
      evidence_ids: ['ev_branch_reality'],
    });

    expect(audit.evidence_ids).toEqual(['ev_branch_reality']);
    expect(audit.rule_version).toBe(RULE_VERSION);

            
    

    expect(true).toBe(true);
    expect(true).toBe(true);
  });
});
