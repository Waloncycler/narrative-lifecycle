export interface FailureCase {
  case_id: string;
  case_name: string;
  narrative_name: string;
  time_period: string;
  peak_stage: string;
  failed_transition: string;
  failure_type: string;
  false_positive_signals: string[];
  missed_warning_signals: string[];
  corrective_rules: string[];
  lessons_for_model: string;
}

export function validateFailureCase(failureCase: FailureCase): string[] {
  const errors: string[] = [];
  for (const field of ['case_id', 'case_name', 'time_period', 'peak_stage', 'failed_transition', 'failure_type', 'lessons_for_model'] as const) {
    if (!failureCase[field]) errors.push(`missing ${field}`);
  }
  for (const field of ['false_positive_signals', 'missed_warning_signals', 'corrective_rules'] as const) {
    if (!Array.isArray(failureCase[field]) || failureCase[field].length === 0) {
      errors.push(`${field} must include at least one signal or rule`);
    }
  }
  return errors;
}

export function classifyFailureTrap(failureCase: FailureCase): string {
  if (failureCase.missed_warning_signals.some((signal) => signal.includes('reality'))) {
    return 'reality_gap';
  }
  if (failureCase.false_positive_signals.some((signal) => signal.includes('policy'))) {
    return 'policy_heat_without_capital';
  }
  return failureCase.failure_type;
}
