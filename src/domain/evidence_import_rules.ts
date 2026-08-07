import type {
  EvidenceImportDraft,
  EvidenceImportGuardrailCheck,
  EvidenceValidationIssue,
  EvidenceValidationReport,
} from '../types/evidence_import';

const allowedStrength = new Set(['E0', 'E1', 'E2', 'E3', 'E4']);
const allowedLayers = new Set(['name', 'capital', 'pricing', 'reality', 'momentum', 'friction', 'data_confidence']);
const allowedSourceTypes = new Set(['official', 'filing', 'news', 'research', 'academic', 'company', 'other']);
const allowedConfidence = new Set(['low', 'medium', 'high']);
const hardEvidenceTerms = [
  'revenue confirmation',
  'profit improvement',
  'repeat purchase',
  'multi-customer replication',
  'supply shortage',
  'standard adoption',
];
const tradingAdvicePattern = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i;

function issue(evidence: EvidenceImportDraft, message: string, field?: string): EvidenceValidationIssue {
  return {
    evidence_id: evidence.evidence_id || 'unknown',
    field,
    message,
  };
}

function isValidDate(value: string): boolean {
  const timestamp = Date.parse(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function validatesSourceMetadata(evidence: EvidenceImportDraft): boolean {
  if (evidence.evidence_strength !== 'E3' && evidence.evidence_strength !== 'E4') return true;
  return Boolean(evidence.source_name && evidence.source_type !== 'other' && evidence.source_url);
}

function validatesHardEvidenceExplanation(evidence: EvidenceImportDraft): boolean {
  if (evidence.evidence_strength !== 'E4') return true;
  const text = `${evidence.event_summary} ${evidence.interpretation} ${evidence.limitation}`.toLowerCase();
  return hardEvidenceTerms.some((term) => text.includes(term));
}

function isParentBranchScopeValid(evidence: EvidenceImportDraft): boolean {
  if (evidence.scope === 'branch') return Boolean(evidence.branch_id);
  const text = `${evidence.event_title} ${evidence.event_summary} ${evidence.interpretation} ${evidence.limitation}`.toLowerCase();
  return !evidence.branch_id && !text.includes('branch-only') && !text.includes('branch evidence cannot upgrade');
}

export function validateEvidenceImportDrafts(input: {
  drafts: EvidenceImportDraft[];
  sourceFile: string;
  generatedAt: string;
  existingEvidenceIds?: Set<string>;
  schemaErrors?: EvidenceValidationIssue[];
}): EvidenceValidationReport {
  const existingIds = input.existingEvidenceIds ?? new Set<string>();
  const seen = new Set<string>();
  const errors: EvidenceValidationIssue[] = [...(input.schemaErrors ?? [])];
  const warnings: EvidenceValidationIssue[] = [];
  const rejectedIds = new Set<string>();

  for (const evidence of input.drafts) {
    const text = JSON.stringify(evidence);

    if (!evidence.evidence_id) errors.push(issue(evidence, 'evidence_id is required', 'evidence_id'));
    if (seen.has(evidence.evidence_id) || existingIds.has(evidence.evidence_id)) {
      errors.push(issue(evidence, 'evidence_id must be unique', 'evidence_id'));
    }
    seen.add(evidence.evidence_id);

    if (!evidence.topic_id) errors.push(issue(evidence, 'topic_id is required', 'topic_id'));
    if (evidence.scope !== 'parent' && evidence.scope !== 'branch') errors.push(issue(evidence, 'scope must be parent or branch', 'scope'));
    if (evidence.scope === 'branch' && !evidence.branch_id) errors.push(issue(evidence, 'branch evidence requires branch_id', 'branch_id'));
    if (evidence.scope === 'parent' && !isParentBranchScopeValid(evidence)) {
      errors.push(issue(evidence, 'parent evidence cannot contain branch-only evidence', 'scope'));
    }
    if (!allowedStrength.has(evidence.evidence_strength)) errors.push(issue(evidence, 'invalid evidence_strength', 'evidence_strength'));
    if (!Array.isArray(evidence.affected_layer) || evidence.affected_layer.some((layer) => !allowedLayers.has(layer))) {
      errors.push(issue(evidence, 'invalid affected_layer', 'affected_layer'));
    }
    if (!isValidDate(evidence.event_date)) errors.push(issue(evidence, 'event_date must be YYYY-MM-DD', 'event_date'));
    if (!isValidDate(evidence.available_at)) errors.push(issue(evidence, 'available_at must be YYYY-MM-DD', 'available_at'));
    if (!evidence.interpretation) errors.push(issue(evidence, 'interpretation is required', 'interpretation'));
    if (!evidence.limitation) errors.push(issue(evidence, 'limitation is required', 'limitation'));
    if (!evidence.source_name) errors.push(issue(evidence, 'source_name is required', 'source_name'));
    if (!allowedSourceTypes.has(evidence.source_type)) errors.push(issue(evidence, 'invalid source_type', 'source_type'));
    if (!allowedConfidence.has(evidence.confidence)) errors.push(issue(evidence, 'invalid confidence', 'confidence'));
    if (tradingAdvicePattern.test(text)) errors.push(issue(evidence, 'trading advice terms are not allowed'));
    if (!validatesSourceMetadata(evidence)) {
      errors.push(issue(evidence, 'E3/E4 evidence requires source_url and non-other source_type', 'source_url'));
    }
    if (!validatesHardEvidenceExplanation(evidence)) {
      errors.push(issue(evidence, 'E4 evidence must explain hard evidence basis', 'interpretation'));
    }
    if (evidence.evidence_strength === 'E0') {
      warnings.push(issue(evidence, 'E0 evidence can be imported for audit but will not support scoring or stage classification', 'evidence_strength'));
    }
  }

  for (const error of errors) rejectedIds.add(error.evidence_id);
  const acceptedIds = input.drafts
    .map((item) => item.evidence_id)
    .filter((id) => id && !rejectedIds.has(id));
  const status = errors.length === 0 ? 'passed' : 'failed';
  const guardrailCheck: EvidenceImportGuardrailCheck = {
    no_trading_advice: input.drafts.every((item) => !tradingAdvicePattern.test(JSON.stringify(item))),
    parent_branch_scope_valid: input.drafts.every(isParentBranchScopeValid),
    evidence_strength_valid: input.drafts.every((item) => allowedStrength.has(item.evidence_strength)),
    affected_layer_valid: input.drafts.every((item) =>
      Array.isArray(item.affected_layer) && item.affected_layer.every((layer) => allowedLayers.has(layer)),
    ),
    source_metadata_present: input.drafts.every(validatesSourceMetadata),
  };

  return {
    validation_id: `validation_${input.generatedAt.slice(0, 10).replaceAll('-', '')}`,
    generated_at: input.generatedAt,
    source_file: input.sourceFile,
    status,
    accepted_count: status === 'passed' ? input.drafts.length : 0,
    rejected_count: status === 'passed' ? 0 : input.drafts.length,
    errors,
    warnings,
    accepted_evidence_ids: status === 'passed' ? acceptedIds : [],
    rejected_evidence_ids: status === 'passed' ? [] : input.drafts.map((item) => item.evidence_id || 'unknown'),
    guardrail_check: guardrailCheck,
  };
}
