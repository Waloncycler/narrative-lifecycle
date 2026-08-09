import { describe, expect, it } from 'vitest';
import { VerifyBaselineEvidenceUseCase } from '@/app/use_cases/verify_baseline_evidence_use_case';

const baseline = {
  items: [
    { topic_id: 'parent_ready', status: 'ready_for_review', eligible_parent_evidence: [{ evidence_id: 'parent_a' }, { evidence_id: 'parent_b' }] },
    { topic_id: 'branch_only', status: 'blocked', eligible_parent_evidence: [] },
  ],
} as never;

describe('verify baseline evidence use case', () => {
  it('selects only reconciled parent candidates and does not run the agent without double-source recovery', async () => {
    const calls: unknown[] = [];
    const useCase = new VerifyBaselineEvidenceUseCase({
      reconcile: () => baseline,
      recover: async (input) => {
        calls.push(input);
        return { report: { auto_intake_ready_count: 0 }, retrieval: {} } as never;
      },
      appendRetrievedSourceIntake: () => { throw new Error('must_not_append'); },
      runIntakeAgent: async () => { throw new Error('must_not_run_agent'); },
      runAiShadow: async () => { throw new Error('must_not_run_shadow'); },
      runAutonomousResearch: () => { throw new Error('must_not_publish'); },
    });
    const result = await useCase.execute({ maxTopics: 2, maxEvidence: 1 });
    expect(result.selectedTopicIds).toEqual(['parent_ready']);
    expect(result.requestedEvidenceIds).toEqual(['parent_a']);
    expect(calls[0]).toMatchObject({ evidenceIds: ['parent_a'], includeEvidenceGrade: true, requireTopicTitleMatch: false });
    expect(result.autonomy).toBeNull();
  });

  it('runs the existing Agent and policy chain only after verified recovery, with publication opt-in', async () => {
    const calls: string[] = [];
    const useCase = new VerifyBaselineEvidenceUseCase({
      reconcile: () => baseline,
      recover: async () => ({ report: { auto_intake_ready_count: 1 }, retrieval: {} } as never),
      appendRetrievedSourceIntake: () => ({ session_id: 'intake' } as never),
      runIntakeAgent: async () => ({ audit: {} } as never),
      runAiShadow: async () => { calls.push('shadow'); },
      runAutonomousResearch: (_bundle, publish) => {
        calls.push(`autonomy:${publish}`);
        return { report: { published_count: 0, held_count: 1 } } as never;
      },
    });
    const result = await useCase.execute({ topicIds: ['parent_ready'], publish: true });
    expect(calls).toEqual(['shadow', 'autonomy:true']);
    expect(result.autonomy).toEqual({ published: 0, held: 1 });
  });
});
