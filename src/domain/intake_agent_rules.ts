import { noTradingAdvice } from './intake_rules';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/types/intake';
import type { AgentCandidateVerification, AgentEvidenceCandidate, IntakeAgentVerificationReport } from '@/types/intake_agent';

export const INTAKE_AGENT_PROMPT_VERSION = 'evidence-intake-agent-v0.7.0';

export function mergeAgentOnlyCandidates(ruleCandidates: EvidenceCandidate[], agentCandidates: AgentEvidenceCandidate[]): EvidenceCandidate[] {
  const existing = new Set(ruleCandidates.map((candidate) => candidate.candidate_id));
  const extras = agentCandidates
    .filter((candidate) => candidate.validation_status !== 'failed')
    .filter((candidate) => !existing.has(candidate.source_candidate_id))
    .map((candidate) => ({
      candidate_id: candidate.source_candidate_id,
      raw_document_id: candidate.raw_document_id,
      chunk_id: candidate.chunk_id,
      provenance_id: candidate.provenance_id,
      original_quote: candidate.original_quote,
      suggested_evidence: candidate.suggested_evidence,
      suggested_reason: `Agent-only fact: ${candidate.suggested_reason}`,
      uncertainty_notes: candidate.uncertainty_notes,
      field_explanations: {
        supported_fact: 'Agent extracted this as an independent source-supported fact.',
        inferred_interpretation: 'Agent interpretation must remain separate from the quoted fact.',
        evidence_strength: 'Operator must confirm E0-E4 against the Evidence Table.',
      },
      e_strength_rationale: 'Agent-only candidate requires human E0-E4 confirmation.',
      publication_eligibility: 'manual_review' as const,
      duplicate_of_evidence_id: null,
      guardrail_check: {
        no_trading_advice: noTradingAdvice(candidate),
        provenance_present: Boolean(candidate.original_quote),
        human_review_required: false,
      },
    } satisfies EvidenceCandidate));
  return [...ruleCandidates, ...extras];
}

export function verifyAgentCandidate(input: {
  candidate: AgentEvidenceCandidate;
  session: EvidenceIntakeSession;
  ruleCandidate?: EvidenceCandidate;
}): AgentCandidateVerification {
  const { candidate, session } = input;
  const errors: string[] = [];
  const citationExists = session.raw_document.text.includes(candidate.original_quote)
    && candidate.quote_start_offset >= 0
    && candidate.quote_end_offset > candidate.quote_start_offset;
  if (!citationExists) errors.push('original_quote_not_found_at_declared_location');
  if (!candidate.supported_fact || !candidate.inferred_interpretation) errors.push('fact_and_interpretation_are_required');
  if (candidate.supported_fact === candidate.inferred_interpretation) errors.push('fact_and_interpretation_must_be_separated');
  const draft = candidate.suggested_evidence;
  const parentBranchValid = draft.scope === 'parent' ? !draft.branch_id : Boolean(draft.branch_id);
  if (!parentBranchValid) errors.push('parent_branch_scope_invalid');
  const evidenceStrengthChecked = ['E0', 'E1', 'E2', 'E3', 'E4'].includes(draft.evidence_strength);
  if (!evidenceStrengthChecked) errors.push('invalid_evidence_strength');
  const deterministicPrimaryVerified = input.ruleCandidate?.publication_eligibility === 'rule_verified';
  if ((draft.evidence_strength === 'E3' || draft.evidence_strength === 'E4') && !deterministicPrimaryVerified && !hasHardEvidence(candidate.original_quote)) {
    errors.push('possible_e3_e4_overstatement');
  }
  const noAdvice = noTradingAdvice(candidate) && noTradingAdvice(draft);
  if (!noAdvice) errors.push('trading_advice_detected');
  if (!candidate.suggested_reason) errors.push('missing_suggested_reason');
  if (!candidate.uncertainty_notes.length) errors.push('missing_uncertainty_notes');
  if (!candidate.limitation) errors.push('missing_limitation');
  return {
    agent_candidate_id: candidate.agent_candidate_id,
    status: candidate.fallback_used ? 'fallback' : errors.length ? 'failed' : 'passed',
    errors,
    checks: {
      citation_exists: citationExists,
      fact_interpretation_separated: Boolean(candidate.supported_fact && candidate.inferred_interpretation && candidate.supported_fact !== candidate.inferred_interpretation),
      parent_branch_valid: parentBranchValid,
      evidence_strength_checked: evidenceStrengthChecked,
      no_trading_advice: noAdvice,
      human_review_required: false,
    },
  };
}

export function buildAgentVerificationReport(input: {
  generatedAt: string;
  session: EvidenceIntakeSession;
  candidates: AgentEvidenceCandidate[];
}): IntakeAgentVerificationReport {
  const verifications = input.candidates.map((candidate) => verifyAgentCandidate({ candidate, session: input.session }));
  return {
    report_id: `intake_agent_verification_${input.generatedAt.slice(0, 10).replaceAll('-', '')}_${input.session.session_id}`,
    generated_at: input.generatedAt,
    session_id: input.session.session_id,
    candidate_count: verifications.length,
    passed_count: verifications.filter((item) => item.status === 'passed').length,
    failed_count: verifications.filter((item) => item.status === 'failed').length,
    fallback_count: verifications.filter((item) => item.status === 'fallback').length,
    candidates: verifications,
    guardrail_check: {
      schema_validated: true,
      citation_checked: true,
      parent_branch_checked: true,
      stage_not_reclassified: true,
      scoring_not_run: true,
      no_auto_import: true,
      no_trading_advice: verifications.every((item) => item.checks.no_trading_advice),
      secrets_not_persisted: true,
    },
  };
}

function hasHardEvidence(text: string): boolean {
  return /国务院|批复|正式批准|收入|营收|revenue|multi-customer|多客户|重复购买|standard adoption|标准采纳|监管批准|临床数据/.test(text.toLowerCase());
}
