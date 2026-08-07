import type { AuditLog, EvaluationResult, IncrementalMarker, ManualOverride } from './audit';

export const RULE_VERSION = 'narrative-lifecycle-rules-v0.1';

export function createRuleVersion() {
  return {
    rule_version_id: RULE_VERSION,
    name: 'Narrative Lifecycle Stage Gates',
    version: '0.1',
    effective_date: '2026-07-04',
    changed_rules: [
      'stage gates',
      'parent branch separation',
      'data confidence caps',
      'narrative memory reactivation',
    ],
  };
}

export function createManualOverride(input: Omit<ManualOverride, 'created_at' | 'rule_version'>): ManualOverride {
  return {
    ...input,
    created_at: new Date(0).toISOString(),
    rule_version: RULE_VERSION,
  };
}

export function createAuditLog(input: Omit<AuditLog, 'created_at' | 'rule_version'>): AuditLog {
  return {
    ...input,
    created_at: new Date(0).toISOString(),
    rule_version: RULE_VERSION,
  };
}

export function createEvaluationResult(input: Omit<EvaluationResult, 'created_at'>): EvaluationResult {
  return {
    ...input,
    created_at: new Date(0).toISOString(),
  };
}

export function buildIncrementalMarker(input: Omit<IncrementalMarker, 'dirty_flag'> & { previous?: IncrementalMarker }): IncrementalMarker {
  const dirty =
    !input.previous ||
    input.previous.event_hash !== input.event_hash ||
    input.previous.evidence_hash !== input.evidence_hash;

  return {
    target_id: input.target_id,
    event_hash: input.event_hash,
    evidence_hash: input.evidence_hash,
    dirty_flag: dirty,
    last_processed_at: input.last_processed_at,
  };
}
