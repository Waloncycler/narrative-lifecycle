import { describe, it, expect } from 'vitest';
import { classifyFailureTrap, validateFailureCase } from '../src/services/failure_case_service';

describe('test_failure_case_rules', () => {
  it('requires structured warning signals and classifies failure traps', () => {
    const validFailureCase = {
      case_id: 'policy_heat',
      case_name: 'Policy heat without follow-through',
      narrative_name: 'Short policy theme',
      time_period: '2021-2022',
      peak_stage: 'S3',
      failed_transition: 'S3_to_S4',
      failure_type: 'policy_heat_without_capital',
      false_positive_signals: ['policy naming without capital confirmation'],
      missed_warning_signals: ['no reality validation evidence'],
      corrective_rules: ['Policy naming alone cannot exceed S3.'],
      lessons_for_model: 'Do not treat policy attention as capital confirmation.',
    };

    expect(validateFailureCase(validFailureCase)).toEqual([]);
    expect(classifyFailureTrap(validFailureCase)).toBe('reality_gap');

    expect(validateFailureCase({ ...validFailureCase, false_positive_signals: [] })).toContain(
      'false_positive_signals must include at least one signal or rule',
    );
  });
});
