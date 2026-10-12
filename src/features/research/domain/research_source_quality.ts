import type { ResearchSourceQualityInput, ResearchSourceQualityReport } from '@/features/research/types/research_source_quality';
import type { IntakeEvaluationReport } from '@/features/intake/types/intake';

export function buildResearchSourceQualityReport(input: ResearchSourceQualityInput): ResearchSourceQualityReport {
  const retrieved = input.items.filter((item) => item.status === 'retrieved');
  const ready = retrieved.filter((item) => item.citation_status === 'ready');
  const completeQuotes = retrieved.filter((item) => item.excerpts.length > 0 && item.excerpts.every((excerpt) => (
    excerpt.quote.length >= 120
    && excerpt.quote_start_offset >= 0
    && excerpt.quote_end_offset > excerpt.quote_start_offset
  )));
  const extractor_counts = retrieved.reduce<Record<string, number>>((counts, item) => {
    const key = item.extractor_id ?? 'generic_html';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const source_class_summary = retrieved.reduce<Record<string, { retrieved_count: number; citation_ready_count: number }>>((summary, item) => {
    const current = summary[item.source_class] ?? { retrieved_count: 0, citation_ready_count: 0 };
    current.retrieved_count += 1;
    if (item.citation_status === 'ready') current.citation_ready_count += 1;
    summary[item.source_class] = current;
    return summary;
  }, {});

  return {
    artifact_type: 'research_source_quality_report',
    schema_version: '1.0.0',
    producer_version: input.producer_version,
    retrieval_run_id: input.retrieval_run_id,
    generated_at: input.generated_at,
    requested_count: input.requested_count,
    retrieved_count: input.retrieved_count,
    citation_ready_count: ready.length,
    citation_insufficient_count: retrieved.length - ready.length,
    citation_ready_rate: rate(ready.length, retrieved.length),
    quote_integrity_rate: rate(completeQuotes.length, retrieved.length),
    average_source_text_chars: retrieved.length ? round(retrieved.reduce((sum, item) => sum + (item.source_text_chars ?? 0), 0) / retrieved.length) : 'insufficient_data',
    extractor_counts,
    source_class_summary,
    reviewed_claim_support_rate: 'pending_human_review',
    reviewed_topic_branch_accuracy: 'pending_human_review',
    guardrail_check: {
      metrics_do_not_create_evidence: true,
      claim_support_requires_human_review: true,
      topic_branch_accuracy_requires_human_review: true,
      no_trading_advice: true,
    },
  };
}

export function updateQualityReportWithReviewDecisions(
  report: ResearchSourceQualityReport,
  evaluation: IntakeEvaluationReport
): ResearchSourceQualityReport {
  if (evaluation.candidate_count === 0) {
    return { ...report };
  }

  const supportedCount = evaluation.feedback.filter(f => f.final_decision !== 'reject').length;
  const accurateTopicCount = evaluation.feedback.filter(f => !f.parent_branch_error).length;

  return {
    ...report,
    reviewed_claim_support_rate: rate(supportedCount, evaluation.candidate_count),
    reviewed_topic_branch_accuracy: rate(accurateTopicCount, evaluation.candidate_count),
  };
}

function rate(numerator: number, denominator: number): number | 'insufficient_data' {
  return denominator ? round(numerator / denominator) : 'insufficient_data';
}

function round(value: number): number { return Math.round(value * 1000) / 1000; }
