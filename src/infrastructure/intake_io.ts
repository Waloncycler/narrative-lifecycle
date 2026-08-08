import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, extname, basename, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { EvidenceNode } from '@/domain/evidence';
import type { EvidenceImportDraft } from '@/types/evidence_import';
import type { AiShadowAuditRecord, AiShadowValidationReport, EvidenceIntakeApplyResult, EvidenceIntakeSession, IntakeEvaluationReport, RawDocument, RawDocumentKind, ReviewDecision } from '@/types/intake';
import type { IntakeAgentReviewBundle } from '@/types/intake_agent';
import type { IntakeLearningProfile } from '@/types/intake_learning';
import type { IntakeLearningCycle } from '@/types/intake_learning_cycle';
import { writeJsonAtomically, writeTextAtomically } from '@/services/run_manifest_writer';

export const INTAKE_OUTPUT_DIR = 'outputs/intake';
export const LATEST_INTAKE_SESSION_PATH = `${INTAKE_OUTPUT_DIR}/latest_session.json`;
export const LATEST_REVIEW_DECISIONS_PATH = `${INTAKE_OUTPUT_DIR}/latest_review_decisions.yaml`;
export const REVIEWED_EVIDENCE_DRAFT_PATH = `${INTAKE_OUTPUT_DIR}/reviewed_evidence_draft.yaml`;
export const INTAKE_AUDIT_PATH = `${INTAKE_OUTPUT_DIR}/intake_audit.jsonl`;

export class FileIntakeRepository {
  constructor(private readonly repoRoot: string) {}

  readRawDocument(input: { file?: string; text?: string }): RawDocument {
    const ingestedAt = new Date().toISOString();
    if (input.text) return rawDocument('pasted_text', 'pasted text', input.text, ingestedAt);
    if (!input.file) throw new Error('intake requires --file or --text');
    const absolutePath = resolve(this.repoRoot, input.file);
    const kind = kindFor(input.file);
    const text = parseDocument(absolutePath, kind);
    return rawDocument(kind, input.file, text, ingestedAt);
  }

  existingEvidenceIds(): Set<string> {
    const ids = new Set<string>();
    for (const row of this.readEvidenceNodes()) ids.add(row.evidence_id);
    return ids;
  }

  /** Reads the governed local evidence tables only. It deliberately excludes
   * source leads and agent candidates, which have not passed the Evidence Gate. */
  readEvidenceNodes(): EvidenceNode[] {
    const byId = new Map<string, EvidenceNode>();
    for (const relativeDirectory of ['data/sample_evidence', 'data/live_evidence']) {
      const directory = resolve(this.repoRoot, relativeDirectory);
      if (!existsSync(directory)) continue;
      for (const file of readdirSync(directory).filter((item) => item.endsWith('.yaml') || item.endsWith('.yml')).sort()) {
        try {
          const value = parse(readFileSync(resolve(directory, file), 'utf8')) as EvidenceNode | EvidenceNode[];
          for (const row of Array.isArray(value) ? value : [value]) {
            if (row?.evidence_id) byId.set(row.evidence_id, row);
          }
        } catch {
          // A malformed operational file must not break intake review context.
        }
      }
    }
    return [...byId.values()];
  }

  writeIntakeSession(session: EvidenceIntakeSession, workbenchHtml: string): void {
    writeJsonAtomically(resolve(this.repoRoot, LATEST_INTAKE_SESSION_PATH), session);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_raw_document.json`), session.raw_document);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_chunks.json`), session.chunks);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_candidates.json`), session.candidates);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_provenance.json`), session.provenance_records);
    writeTextAtomically(resolve(this.repoRoot, LATEST_REVIEW_DECISIONS_PATH), stringify(session.review_template));
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_workbench.html`), workbenchHtml);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${session.session_id}.json`), session);
    this.appendAudit({ event: 'intake_prepare', session_id: session.session_id, generated_at: session.generated_at, candidate_count: session.candidates.length });
  }

  writeAiShadowResult(session: EvidenceIntakeSession, audit: unknown): void {
    writeJsonAtomically(resolve(this.repoRoot, LATEST_INTAKE_SESSION_PATH), session);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_ai_shadow_candidates.json`), session.ai_shadow_candidates ?? []);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_candidate_comparisons.json`), session.candidate_comparisons ?? []);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_ai_shadow_audit.json`), audit);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${(audit as AiShadowAuditRecord).audit_id ?? `ai_shadow_${session.session_id}`}.json`), audit);
    this.appendAudit({ event: 'ai_shadow', ...(audit as Record<string, unknown>) });
  }

  writeAiShadowValidationReport(report: AiShadowValidationReport): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_ai_shadow_validation_report.json`), report);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_ai_shadow_validation_report.md`), renderAiShadowValidationMarkdown(report));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${report.report_id}.json`), report);
    this.appendAudit({ event: 'ai_shadow_validation_report', ...report });
  }

  writeAiShadowCorpusReport(report: AiShadowValidationReport): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_real_ai_shadow_evaluation.json`), report);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_real_ai_shadow_evaluation.md`), renderAiShadowValidationMarkdown(report));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${report.report_id}_corpus.json`), report);
    this.appendAudit({ event: 'ai_shadow_corpus_evaluation', ...report });
  }

  writeIntakeAgentBundle(bundle: IntakeAgentReviewBundle): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_candidates.json`), bundle.candidates);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_verification.json`), bundle.verification);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_audit.json`), bundle.audit);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_review.json`), bundle);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_review.md`), renderAgentReviewMarkdown(bundle));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${bundle.audit.audit_id}.json`), bundle);
    this.appendAudit({ event: 'intake_agent', audit_id: bundle.audit.audit_id, session_id: bundle.session_id, status: bundle.audit.status, candidate_count: bundle.candidates.length });
  }

  readLatestSession(): EvidenceIntakeSession {
    return JSON.parse(readFileSync(resolve(this.repoRoot, LATEST_INTAKE_SESSION_PATH), 'utf8')) as EvidenceIntakeSession;
  }

  readLatestAgentBundle(): IntakeAgentReviewBundle | null {
    const path = resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_agent_review.json`);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as IntakeAgentReviewBundle;
    } catch {
      return null;
    }
  }

  writeMergedSession(session: EvidenceIntakeSession): void {
    writeJsonAtomically(resolve(this.repoRoot, LATEST_INTAKE_SESSION_PATH), session);
    // Refresh the auto-accept review decisions alongside the merged session so
    // apply never consumes the stale sync-time template (which only saw raw
    // rule drafts before the agent merged its candidates).
    writeTextAtomically(resolve(this.repoRoot, LATEST_REVIEW_DECISIONS_PATH), stringify(session.review_template));
  }

  readLearningProfile(): IntakeLearningProfile | null {
    const path = resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_profile.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as IntakeLearningProfile;
  }

  writeLearningProfile(profile: IntakeLearningProfile): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_profile.json`), profile);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_profile.md`), renderLearningProfileMarkdown(profile));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${profile.profile_id}.json`), profile);
    this.appendAudit({ event: 'intake_learning_profile', profile_id: profile.profile_id, source_evaluation_ids: profile.source_evaluation_ids });
  }

  readPreviousLearningProfile(currentProfileId: string): IntakeLearningProfile | null {
    const directory = resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history`);
    if (!existsSync(directory)) return null;
    const profiles = readdirSync(directory)
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => {
        try {
          const value = JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as Partial<IntakeLearningProfile>;
          return value.profile_id && value.profile_id !== currentProfileId ? [value as IntakeLearningProfile] : [];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    return profiles[0] ?? null;
  }

  readAiShadowValidationReport(): AiShadowValidationReport | null {
    const path = resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_ai_shadow_validation_report.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as AiShadowValidationReport;
  }

  writeLearningCycle(cycle: IntakeLearningCycle): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_cycle.json`), cycle);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_active_learning_queue.json`), cycle.active_learning_queue);
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_proposals.json`), cycle.proposals);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_learning_cycle.md`), renderLearningCycleMarkdown(cycle));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${cycle.cycle_id}.json`), cycle);
    this.appendAudit({
      event: 'intake_learning_cycle',
      cycle_id: cycle.cycle_id,
      profile_id: cycle.profile_id,
      promotion_status: cycle.promotion_status,
      proposal_count: cycle.proposals.length,
    });
  }

  readReviewDecisions(file = LATEST_REVIEW_DECISIONS_PATH): ReviewDecision[] {
    const value = parse(readFileSync(resolve(this.repoRoot, file), 'utf8')) as ReviewDecision | ReviewDecision[];
    return Array.isArray(value) ? value : [value];
  }

  readApplyResult(): EvidenceIntakeApplyResult | null {
    const path = resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_apply_result.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as EvidenceIntakeApplyResult;
  }

  readLatestEvaluation(): IntakeEvaluationReport {
    return JSON.parse(readFileSync(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_evaluation.json`), 'utf8')) as IntakeEvaluationReport;
  }

  writeEvidenceDraft(drafts: EvidenceImportDraft[]): string {
    writeTextAtomically(resolve(this.repoRoot, REVIEWED_EVIDENCE_DRAFT_PATH), stringify(drafts));
    return REVIEWED_EVIDENCE_DRAFT_PATH;
  }

  writeApplyResult(result: EvidenceIntakeApplyResult): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_apply_result.json`), result);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_apply_result.md`), renderApplyMarkdown(result));
    const version = result.generated_at.replace(/[-:.TZ]/g, '').slice(0, 17);
    const retry = result.pipeline_retry_count ?? 0;
    writeJsonAtomically(
      resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/apply_${result.session_id}_${version}_r${retry}.json`),
      result,
    );
    this.appendAudit({ event: 'intake_apply', ...result });
  }

  writeIntakeEvaluation(report: IntakeEvaluationReport): void {
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_evaluation.json`), report);
    writeTextAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/latest_evaluation.md`), renderEvaluationMarkdown(report));
    writeJsonAtomically(resolve(this.repoRoot, `${INTAKE_OUTPUT_DIR}/history/${report.evaluation_id}.json`), report);
    this.appendAudit({ event: 'intake_evaluate', ...report });
  }

  readStageChangeSummary(): unknown {
    // The controlled autonomous run writes canonical reports under
    // operator_runs. Retain the legacy path only for pre-v0.11 workspaces.
    for (const relativePath of ['outputs/operator_runs/latest_weekly_brief.json', 'outputs/reports/weekly_brief.json']) {
      const path = resolve(this.repoRoot, relativePath);
      if (!existsSync(path)) continue;
      try {
        const weekly = JSON.parse(readFileSync(path, 'utf8')) as { stage_change_summary?: unknown };
        return weekly.stage_change_summary ?? null;
      } catch {
        // A stale or partial report cannot invalidate an already completed run.
      }
    }
    return null;
  }

  private appendAudit(record: unknown): void {
    const path = resolve(this.repoRoot, INTAKE_AUDIT_PATH);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`);
  }
}

function rawDocument(kind: RawDocumentKind, sourceName: string, text: string, ingestedAt: string): RawDocument {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const hash = createHash('sha1').update(`${sourceName}:${normalized}`).digest('hex').slice(0, 10);
  return {
    raw_document_id: `raw_${hash}`,
    source_name: sourceName,
    source_kind: kind,
    ingested_at: ingestedAt,
    text: normalized,
    character_count: normalized.length,
  };
}

function kindFor(file: string): RawDocumentKind {
  const extension = extname(file).toLowerCase();
  if (extension === '.txt') return 'txt';
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.docx') return 'docx';
  if (extension === '.html' || extension === '.htm') return 'html';
  if (extension === '.pdf') return 'pdf';
  throw new Error(`unsupported intake file type: ${basename(file)}`);
}

function parseDocument(path: string, kind: RawDocumentKind): string {
  if (kind === 'txt' || kind === 'markdown') return readFileSync(path, 'utf8');
  if (kind === 'html') return stripHtml(readFileSync(path, 'utf8'));
  if (kind === 'docx') return parseDocx(path);
  if (kind === 'pdf') return parsePdf(path);
  throw new Error(`unsupported intake document kind: ${kind}`);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDocx(path: string): string {
  const script = [
    'import re, sys, zipfile, html',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    '    xml = z.read("word/document.xml").decode("utf-8", "ignore")',
    'text = re.sub(r"<[^>]+>", " ", xml)',
    'print(html.unescape(re.sub(r"\\s+", " ", text)).strip())',
  ].join('\n');
  return execFileSync('python3', ['-c', script, path], { encoding: 'utf8' });
}

function parsePdf(path: string): string {
  try {
    return execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
  } catch {
    return readFileSync(path).toString('latin1').replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

function renderApplyMarkdown(result: EvidenceIntakeApplyResult): string {
  return `# Evidence Intake Apply Result

- session_id: ${result.session_id}
- topic_audit_id: ${result.topic_audit_id}
- import_id: ${result.import_id ?? 'none'}
- imported: ${result.imported}
- import_status: ${result.import_status}
- accepted_count: ${result.accepted_count}
- modified_count: ${result.modified_count}
- split_count: ${result.split_count}
- accepted_evidence_ids: ${result.accepted_evidence_ids.join(', ') || 'none'}
- rejected_count: ${result.rejected_count}
- duplicate_count: ${result.duplicate_count}
- evidence_draft_path: ${result.evidence_draft_path ?? 'none'}
- weekly_run_id: ${result.weekly_run_id ?? 'none'}
- pipeline_retry_count: ${result.pipeline_retry_count ?? 0}
- pipeline_error: ${result.pipeline_error ?? 'none'}
- no_trading_advice: ${result.guardrail_check.no_trading_advice}
- duplicate_detection_applied: ${result.guardrail_check.duplicate_detection_applied}
- parent_branch_guardrail_applied: ${result.guardrail_check.parent_branch_guardrail_applied}
`;
}

function renderEvaluationMarkdown(report: IntakeEvaluationReport): string {
  return `# Intake Evaluation

- evaluation_id: ${report.evaluation_id}
- session_id: ${report.session_id}
- candidate_count: ${report.candidate_count}
- acceptance_rate: ${report.acceptance_rate}
- modification_rate: ${report.modification_rate}
- rejection_rate: ${report.rejection_rate}
- split_rate: ${report.split_rate}
- field_accuracy: ${report.field_accuracy}
- average_review_time_seconds: ${report.average_review_time_seconds}
- duplicate_prevention_count: ${report.duplicate_prevention_count}
- parent_branch_error_rate: ${report.parent_branch_error_rate}
- ai_shadow_difference_count: ${report.ai_shadow_difference_count}
- no_trading_advice: ${report.guardrail_check.no_trading_advice}
- ai_shadow_only: ${report.guardrail_check.ai_shadow_only}
`;
}

function renderLearningProfileMarkdown(profile: IntakeLearningProfile): string {
  return `# Intake Learning Profile

- profile_id: ${profile.profile_id}
- profile_version: ${profile.profile_version}
- observed_session_count: ${profile.observed_session_count}
- observed_candidate_count: ${profile.observed_candidate_count}
- adaptation_mode: ${profile.adaptation_mode}
- auto_rule_mutation: ${profile.auto_rule_mutation}
- auto_stage_change: ${profile.auto_stage_change}
- auto_topic_activation: ${profile.auto_topic_activation}

## Common field corrections

${profile.field_corrections.map((item) => `- ${item.field}: ${item.correction_count}`).join('\n') || '- none'}

## Recurring topic corrections

${profile.topic_corrections.map((item) => `- ${item.from_topic_id}/${item.from_branch_id ?? 'parent'} -> ${item.to_topic_id}/${item.to_branch_id ?? 'parent'}: ${item.count}`).join('\n') || '- none'}

## Rejection patterns

${profile.rejection_patterns.map((item) => `- ${item.reason}: ${item.count}`).join('\n') || '- none'}
`;
}

function renderLearningCycleMarkdown(cycle: IntakeLearningCycle): string {
  const proposals = cycle.proposals.map((item) =>
    `- [${item.status}] ${item.kind} / ${item.target}: ${item.observation_count} observations; advisory only`,
  ).join('\n') || '- none';
  const queue = cycle.active_learning_queue.slice(0, 20).map((item) =>
    `- [${item.priority_band}] ${item.candidate_id}: ${item.priority_score} - ${item.reasons.join(' ')}`,
  ).join('\n') || '- none';
  const gates = cycle.promotion_gates.map((item) =>
    `- ${item.metric}: ${item.actual} (${item.threshold}) - ${item.passed ? 'passed' : 'blocked'}`,
  ).join('\n');
  return `# Intake Active Learning Cycle

- cycle_id: ${cycle.cycle_id}
- cycle_version: ${cycle.cycle_version}
- profile_id: ${cycle.profile_id}
- promotion_status: ${cycle.promotion_status}
- observed_candidate_count: ${cycle.observed_candidate_count}
- rollback_profile_id: ${cycle.rollback_profile_id ?? 'none'}

## Improvement proposals

${proposals}

## Active learning queue

${queue}

## Promotion gates

${gates}

## Safety

- advisory_only: ${cycle.guardrail_check.advisory_only}
- no_auto_rule_mutation: ${cycle.guardrail_check.no_auto_rule_mutation}
- no_auto_stage_change: ${cycle.guardrail_check.no_auto_stage_change}
- no_auto_topic_activation: ${cycle.guardrail_check.no_auto_topic_activation}
- no_auto_import: ${cycle.guardrail_check.no_auto_import}
- no_trading_advice: ${cycle.guardrail_check.no_trading_advice}
`;
}

function renderAiShadowValidationMarkdown(report: AiShadowValidationReport): string {
  return `# AI Shadow Validation Report

- report_id: ${report.report_id}
- baseline_version: ${report.baseline_version}
- document_count: ${report.document_count}
- rule_only_candidate_count: ${report.rule_only_candidate_count}
- ai_candidate_count: ${report.ai_candidate_count}
- fallback_count: ${report.fallback_count}
- invalid_output_count: ${report.invalid_output_count}
- precision: ${report.precision}
- recall: ${report.recall}
- unsupported_claim_rate: ${report.unsupported_claim_rate}
- citation_accuracy: ${report.citation_accuracy}
- topic_branch_accuracy: ${report.topic_branch_accuracy}
- e3_e4_overstatement_count: ${report.e3_e4_overstatement_count}
- average_review_time_seconds: ${report.average_review_time_seconds}
- field_modification_rate: ${report.field_modification_rate}
- no_trading_advice: ${report.guardrail_check.no_trading_advice}
- fallback_to_rule_based: ${report.guardrail_check.fallback_to_rule_based}
- secrets_not_persisted: ${report.guardrail_check.secrets_not_persisted}
`;
}

function renderAgentReviewMarkdown(bundle: IntakeAgentReviewBundle): string {
  const rows = bundle.candidates.map((candidate) => {
    const verification = bundle.verification.candidates.find((item) => item.agent_candidate_id === candidate.agent_candidate_id);
    return `## ${candidate.agent_candidate_id}\n\n- fact: ${candidate.supported_fact}\n- quote: ${candidate.original_quote}\n- interpretation: ${candidate.inferred_interpretation}\n- topic: ${candidate.suggested_evidence.topic_id}\n- branch: ${candidate.suggested_evidence.branch_id ?? 'none'}\n- scope: ${candidate.suggested_evidence.scope}\n- evidence_strength: ${candidate.suggested_evidence.evidence_strength}\n- validation: ${verification?.status ?? candidate.validation_status}\n- errors: ${(verification?.errors ?? candidate.validation_errors).join('; ') || 'none'}\n- human_review_required: false\n`;
  }).join('\n');
  return `# Smart Evidence Intake Agent Review\n\n- agent_version: ${bundle.agent_version}\n- session_id: ${bundle.session_id}\n- provider: ${bundle.audit.provider}\n- model_version: ${bundle.audit.model_version}\n- import_permission: ${bundle.import_permission}\n- no_auto_import: ${bundle.verification.guardrail_check.no_auto_import}\n- stage_not_reclassified: ${bundle.verification.guardrail_check.stage_not_reclassified}\n- scoring_not_run: ${bundle.verification.guardrail_check.scoring_not_run}\n- no_trading_advice: ${bundle.verification.guardrail_check.no_trading_advice}\n\n${rows || 'No candidates generated.'}`;
}
