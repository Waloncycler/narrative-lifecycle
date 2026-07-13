import type { OperatorReview } from '../../types/operator_review';

export interface BuildOperatorReviewUseCaseResult {
  review: OperatorReview;
  markdown: string;
}

export interface BuildOperatorReviewUseCaseDeps {
  build(): BuildOperatorReviewUseCaseResult;
  persist(result: BuildOperatorReviewUseCaseResult): void;
}

export class BuildOperatorReviewUseCase {
  constructor(private readonly deps: BuildOperatorReviewUseCaseDeps) {}

  execute(): BuildOperatorReviewUseCaseResult {
    const result = this.deps.build();
    this.deps.persist(result);
    return result;
  }
}
