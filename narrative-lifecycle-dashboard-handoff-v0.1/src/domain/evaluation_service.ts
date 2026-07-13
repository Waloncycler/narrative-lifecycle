import type { EvaluationResult } from './audit';
import type { FailureCase } from './failure_case_service';

export interface FailureCaseCalibration {
  case_id: string;
  status: 'covered' | 'missing_evaluation' | 'failed';
  corrective_rules: string[];
  evaluation_ids: string[];
}

export function calibrateFailureCases(
  failureCases: FailureCase[],
  evaluationResults: EvaluationResult[],
): FailureCaseCalibration[] {
  return failureCases.map((failureCase) => {
    const related = evaluationResults.filter((result) => result.case_id === failureCase.case_id);
    const hasFailure = related.some((result) => result.result === 'fail');

    return {
      case_id: failureCase.case_id,
      status: related.length === 0 ? 'missing_evaluation' : hasFailure ? 'failed' : 'covered',
      corrective_rules: failureCase.corrective_rules,
      evaluation_ids: related.map((result) => result.evaluation_id),
    };
  });
}
