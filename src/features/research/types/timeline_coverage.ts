export interface TimelineCoverageMetric {
  topic_id: string;
  stage_gate: string;
  source_class: string;
  coverage_status: 'complete' | 'missing';
}

export interface TimelineCoverageReport {
  metrics: TimelineCoverageMetric[];
  summary: {
    total_gates: number;
    complete_gates: number;
    missing_gates: number;
    complete_ratio: number;
  };
}
