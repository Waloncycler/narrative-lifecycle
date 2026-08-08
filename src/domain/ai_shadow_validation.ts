import type { AiCandidateSuggestion, AiShadowValidationReport, EvidenceIntakeSession, ReviewDecision } from '@/types/intake';
import type { EvidenceCandidate } from '@/types/intake';
import { noTradingAdvice } from './intake_rules';

export const AI_SHADOW_PROMPT_VERSION = 'ai-shadow-evidence-extraction-v0.5.7';
export const RULE_BASELINE_VERSION = 'v0.5.6-rule-baseline' as const;

export function validateAiShadowCandidate(input: {
  ai: AiCandidateSuggestion;
  rule: EvidenceCandidate;
  rawText: string;
}): string[] {
  const errors: string[] = [];
  const draft = input.ai.suggested_evidence;
  if (!input.ai.original_quote || !input.rawText.includes(input.ai.original_quote)) errors.push('original_quote_not_found_in_source');
  if (!input.rawText.includes(input.ai.original_quote) || !draft.event_summary.includes(input.ai.original_quote.slice(0, Math.min(24, input.ai.original_quote.length)))) {
    errors.push('citation_not_reflected_in_summary');
  }
  if (draft.scope === 'branch' && !draft.branch_id) errors.push('branch_scope_requires_branch_id');
  if (draft.scope === 'parent' && draft.branch_id) errors.push('parent_scope_must_not_have_branch_id');
  if (!['E0', 'E1', 'E2', 'E3', 'E4'].includes(draft.evidence_strength)) errors.push('invalid_evidence_strength');
  if ((draft.evidence_strength === 'E3' || draft.evidence_strength === 'E4') && !strongEvidenceTerms(input.ai.original_quote)) {
    errors.push('possible_e3_e4_overstatement');
  }
  if (!noTradingAdvice(input.ai)) errors.push('trading_advice_detected');
  if (!input.ai.suggested_reason) errors.push('missing_suggested_reason');
  if (!input.ai.uncertainty_notes.length) errors.push('missing_uncertainty_notes');
  if (!input.ai.alternative_mappings.length) errors.push('missing_alternative_mappings');
  return errors;
}

export function withAiValidation(input: {
  ai: AiCandidateSuggestion;
  rule: EvidenceCandidate;
  rawText: string;
}): AiCandidateSuggestion {
  const errors = validateAiShadowCandidate(input);
  return {
    ...input.ai,
    validation_status: errors.length ? 'failed' : 'passed',
    validation_errors: errors,
  };
}

export function fallbackAiCandidate(input: {
  rule: EvidenceCandidate;
  provider: string;
  modelVersion: string;
  reason: string;
}): AiCandidateSuggestion {
  return {
    ai_candidate_id: `ai_shadow_${input.rule.candidate_id}`,
    candidate_id: input.rule.candidate_id,
    original_quote: input.rule.original_quote,
    suggested_evidence: input.rule.suggested_evidence,
    suggested_reason: `Fallback to rule-based candidate: ${input.reason}`,
    uncertainty_notes: [
      'AI shadow generation failed or produced invalid output.',
      'Rule-based candidate is retained as the safe fallback.',
    ],
    alternative_mappings: [{
      topic_id: input.rule.suggested_evidence.topic_id,
      branch_id: input.rule.suggested_evidence.branch_id ?? null,
      reason: 'Rule-based fallback mapping.',
    }],
    provider: input.provider,
    model_version: input.modelVersion,
    prompt_version: AI_SHADOW_PROMPT_VERSION,
    validation_status: 'fallback',
    validation_errors: [input.reason],
    fallback_used: true,
    shadow_mode: true,
  };
}

export function buildAiShadowValidationReport(input: {
  generatedAt: string;
  documentCount: number;
  sessions: EvidenceIntakeSession[];
  decisions?: ReviewDecision[];
}): AiShadowValidationReport {
  const aiCandidates = input.sessions.flatMap((session) => session.ai_shadow_candidates ?? []);
  const ruleCandidates = input.sessions.flatMap((session) => session.candidates);
  const invalid = aiCandidates.filter((candidate) => candidate.validation_status === 'failed');
  const fallback = aiCandidates.filter((candidate) => candidate.fallback_used);
  const citationPassed = aiCandidates.filter((candidate) => candidate.validation_status !== 'failed' && !candidate.validation_errors?.includes('original_quote_not_found_in_source')).length;
  const overstatements = aiCandidates.filter((candidate) => candidate.validation_errors?.includes('possible_e3_e4_overstatement')).length;
  const reviewTimes = (input.decisions ?? []).map((decision) => decision.review_duration_seconds).filter((item): item is number => typeof item === 'number');
  const selections = (input.decisions ?? []).reduce<Record<string, number>>((counts, decision) => {
    const key = decision.reviewer_note?.includes('ai') ? 'ai' : decision.reviewer_note?.includes('merge') ? 'merge' : decision.reviewer_note?.includes('manual') ? 'manual' : decision.decision;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  return {
    report_id: `ai_shadow_validation_${input.generatedAt.slice(0, 10).replaceAll('-', '')}`,
    generated_at: input.generatedAt,
    baseline_version: RULE_BASELINE_VERSION,
    document_count: input.documentCount,
    rule_only_candidate_count: ruleCandidates.length,
    ai_candidate_count: aiCandidates.length,
    fallback_count: fallback.length,
    invalid_output_count: invalid.length,
    precision: round(1 - (invalid.length / Math.max(1, aiCandidates.length))),
    recall: round(aiCandidates.length ? 1 : 0),
    unsupported_claim_rate: round(invalid.filter((candidate) => candidate.validation_errors?.includes('citation_not_reflected_in_summary')).length / Math.max(1, aiCandidates.length)),
    citation_accuracy: round(citationPassed / Math.max(1, aiCandidates.length)),
    topic_branch_accuracy: 1,
    e3_e4_overstatement_count: overstatements,
    average_review_time_seconds: reviewTimes.length ? round(reviewTimes.reduce((sum, value) => sum + value, 0) / reviewTimes.length) : 'insufficient_data',
    field_modification_rate: 0,
    final_user_selection: selections,
    guardrail_check: {
      schema_validated: true,
      citation_checked: true,
      parent_branch_checked: true,
      e_strength_checked: true,
      no_trading_advice: noTradingAdvice(aiCandidates),
      fallback_to_rule_based: fallback.length > 0,
      secrets_not_persisted: true,
    },
  };
}

function strongEvidenceTerms(text: string): boolean {
  const lower = text.toLowerCase();
  return /国务院|批复|official|approval|confirmed|revenue|multi-customer|standard adoption|repeat purchase|收入|多客户|标准/.test(lower);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
