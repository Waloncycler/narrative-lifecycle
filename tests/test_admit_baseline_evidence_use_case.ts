import { describe, expect, it } from 'vitest';
import { AdmitBaselineEvidenceUseCase } from '@/app/use_cases/admit_baseline_evidence_use_case';

const report = {
  artifact_type: 'baseline_evidence_reconciliation_report', schema_version: '1.0.0', producer_version: 'test', report_id: 'report_1', generated_at: '2026-08-09T00:00:00.000Z',
  summary: {}, items: [{ topic_id: 'humanoid_robotics', status: 'ready_for_review', eligible_parent_evidence: [{ evidence_id: 'evidence_1' }] }],
  guardrail_check: {},
} as never;

describe('admit baseline evidence use case', () => {
  it('requires a topic and delegates a named, report-bound admission', () => {
    const calls: unknown[] = [];
    const useCase = new AdmitBaselineEvidenceUseCase({
      reconcile: () => report,
      now: () => '2026-08-09T00:00:01.000Z',
      appendAdmission: (input) => { calls.push(input); return 'migration_baseline_humanoid'; },
    });
    expect(useCase.execute({ topicId: 'humanoid_robotics', reviewer: 'research-operator' }).admission_id).toBe('migration_baseline_humanoid');
    expect(calls[0]).toMatchObject({ topicId: 'humanoid_robotics', reviewer: 'research-operator', report });
    expect(() => useCase.execute({ topicId: '', reviewer: 'research-operator' })).toThrow('baseline_topic_id_is_required');
  });
});
