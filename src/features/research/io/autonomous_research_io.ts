import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { hasOperationalSourceProvenance, normalizeOperationalEvidenceSourceType } from '@/features/evidence/domain/evidence_source_normalization';
import type { AutonomousResearchPolicy, AutonomousResearchRun } from '@/features/research/types/autonomous_research';
import type { AutonomousResearchPolicyAudit } from '@/features/research/types/autonomous_research_policy_audit';
import type { NarrativeGraphPromotionReport } from '@/features/narrative/types/narrative_graph_promotion';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { renderStageDiffMarkdown } from '@/features/stages/pipeline/stage_diff_markdown_renderer';
import { renderWeeklyBriefMarkdown } from '@/features/reporting/pipeline/report_markdown_renderer';

const LIVE_EVIDENCE_DIR = 'data/live_evidence';
const AUTOMATED_EVIDENCE_PATH = `${LIVE_EVIDENCE_DIR}/automated_evidence.yaml`;
const MANUAL_EVIDENCE_PATH = 'data/sample_evidence/manual_imported_evidence.yaml';
const MANUAL_EVIDENCE_AUDIT_PATH = 'data/audit/evidence_import_audit.jsonl';
const MANUAL_EVIDENCE_ADMISSION_PATH = 'data/audit/operational_evidence_admission.jsonl';

export class AutonomousResearchArtifactRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readPolicy(): AutonomousResearchPolicy {
    return readGenericArtifact(resolve(this.repoRoot, 'configs/autonomous_research_policy.json'))! as AutonomousResearchPolicy;
  }

  writePolicyAudit(audit: AutonomousResearchPolicyAudit): void {
    const output = 'governance';
    writeGenericArtifact(resolve(output, 'latest_autonomous_research_policy_audit.json'), audit);
    writeGenericTextArtifact(resolve(output, 'latest_autonomous_research_policy_audit.md'), renderPolicyAuditMarkdown(audit));
    writeGenericArtifact(resolve(output, 'history', `autonomous_research_policy_${audit.generated_at.replace(/[^0-9]/g, '').slice(0, 14)}.json`), audit);
  }

  readOperationalEvidence(): EvidenceNode[] {
    const rows = [
      ...this.readAuditedManualEvidence(),
      ...this.readAuditedAutomatedEvidence(),
      ...this.readAdmittedEvidenceTableRows(),
    ];
    const byId = new Map(rows.map((item) => [item.evidence_id, item]));
    return [...byId.values()];
  }

  private readJsonEvidenceTable(): EvidenceNode[] {
    const jsonPath = resolve(this.repoRoot, 'data/evidence_table/evidence_table.json');
    if (!existsSync(jsonPath)) return [];
    try {
      return readGenericArtifact(jsonPath)! as EvidenceNode[];
    } catch {
      return [];
    }
  }

  /**
   * The JSON table is a research store, not an implicit production queue.
   * Legacy enrichment and backfill jobs wrote directly into it, so a row only
   * becomes operational once its id appears in the controlled admission log.
   */
  private readAdmittedEvidenceTableRows(): EvidenceNode[] {
    const admittedIds = this.readEvidenceAdmissionIds(['manual_import', 'migration_baseline', 'automated_publication']);
    return this.readJsonEvidenceTable()
      .filter((item) => admittedIds.has(item.evidence_id))
      .filter(hasOperationalSourceProvenance)
      .map(normalizeOperationalEvidenceSourceType);
  }

  writePublishedEvidence(rows: EvidenceNode[]): void {
    const existing = this.readYamlRows(AUTOMATED_EVIDENCE_PATH);
    const merged = new Map(existing.map((item) => [item.evidence_id, item]));
    for (const row of rows) merged.set(row.evidence_id, row);
    writeGenericTextArtifact(resolve(this.repoRoot, AUTOMATED_EVIDENCE_PATH), stringify([...merged.values()]));

    const jsonPath = resolve(this.repoRoot, 'data/evidence_table/evidence_table.json');
    const existingJson = this.readJsonEvidenceTable();
    const jsonMerged = new Map(existingJson.map((item) => [item.evidence_id, item]));
    for (const row of rows) jsonMerged.set(row.evidence_id, row);
    mkdirSync(resolve(this.repoRoot, 'data/evidence_table'), { recursive: true });
    writeGenericTextArtifact(jsonPath, JSON.stringify([...jsonMerged.values()], null, 2));
    if (rows.length) {
      mkdirSync(resolve(this.repoRoot, 'data/audit'), { recursive: true });
      appendFileSync(resolve(this.repoRoot, MANUAL_EVIDENCE_ADMISSION_PATH), `${JSON.stringify({
        admission_id: `automated_publication_${new Date().toISOString().replaceAll(/[:.]/g, '')}`,
        admitted_at: new Date().toISOString(),
        admission_type: 'automated_publication',
        evidence_ids: rows.map((row) => row.evidence_id),
        policy: 'explicit_controlled_publication',
      })}\n`, 'utf8');
    }
  }

  readLatestSnapshot(): StageSnapshotHistory | null {
    const path = 'operator_runs/latest_stage_snapshot.json';
    return existsSync(path) ? readGenericArtifact(path)! as StageSnapshotHistory : null;
  }

  readPreviousOperatorRunId(): string | null {
    const path = 'operator_runs/latest_run.json';
    if (!existsSync(path)) return null;
    try {
      return (readGenericArtifact(path)! as { run_id?: string }).run_id ?? null;
    } catch {
      return null;
    }
  }

  operationalArtifactPaths(runId: string): {
    sourceArtifacts: string[];
    artifactIndex: string[];
    runArtifacts: string[];
  } {
    const operatorRoot = 'outputs/operator_runs';
    return {
      sourceArtifacts: [
        MANUAL_EVIDENCE_PATH,
        MANUAL_EVIDENCE_AUDIT_PATH,
        MANUAL_EVIDENCE_ADMISSION_PATH,
        AUTOMATED_EVIDENCE_PATH,
        `${operatorRoot}/latest_stage_snapshot.json`,
        `${operatorRoot}/latest_stage_diff.json`,
      ],
      artifactIndex: [
        `${operatorRoot}/latest_run.json`,
        `${operatorRoot}/latest_stage_snapshot.json`,
        `${operatorRoot}/latest_stage_diff.json`,
        `${operatorRoot}/latest_weekly_brief.json`,
      ],
      runArtifacts: [
        `${operatorRoot}/${runId}/stage_snapshot.json`,
        `${operatorRoot}/${runId}/stage_diff.json`,
        `${operatorRoot}/${runId}/weekly_brief.json`,
      ],
    };
  }

  writeRun(result: AutonomousResearchRun): void {
    const output = 'autonomy';
    mkdirSync(output, { recursive: true });
    writeGenericArtifact(resolve(output, 'latest_promotion_report.json'), result.report);
    writeGenericArtifact(resolve(output, 'latest_stage_snapshot.json'), result.snapshot);
    writeGenericArtifact(resolve(output, 'latest_stage_diff.json'), result.diff);
    writeGenericArtifact(resolve(output, 'latest_run.json'), result);
    writeGenericArtifact(resolve(output, 'history', `autonomous_run_${result.report.run_id}.json`), result);
    writeGenericTextArtifact(resolve(output, 'latest_promotion_report.md'), renderPromotionReport(result));

    // Operator runs are the one canonical live-research chain. Golden-case
    // outputs intentionally remain untouched as regression fixtures.
    const operatorRoot = 'operator_runs';
    const runRoot = resolve(operatorRoot, result.manifest.run_id);
    writeGenericArtifact(resolve(operatorRoot, 'latest_stage_snapshot.json'), result.snapshot);
    writeGenericArtifact(resolve(operatorRoot, 'latest_stage_diff.json'), result.diff);
    writeGenericTextArtifact(resolve(operatorRoot, 'latest_stage_diff.md'), renderStageDiffMarkdown(result.diff));
    writeGenericArtifact(resolve(operatorRoot, 'latest_weekly_brief.json'), result.weekly_brief);
    writeGenericTextArtifact(resolve(operatorRoot, 'latest_weekly_brief.md'), renderWeeklyBriefMarkdown(result.weekly_brief));
    writeGenericArtifact(resolve(runRoot, 'stage_snapshot.json'), result.snapshot);
    writeGenericArtifact(resolve(runRoot, 'stage_diff.json'), result.diff);
    writeGenericTextArtifact(resolve(runRoot, 'stage_diff.md'), renderStageDiffMarkdown(result.diff));
    writeGenericArtifact(resolve(runRoot, 'weekly_brief.json'), result.weekly_brief);
    writeGenericTextArtifact(resolve(runRoot, 'weekly_brief.md'), renderWeeklyBriefMarkdown(result.weekly_brief));
    writeGenericArtifact(resolve(runRoot, 'run_manifest.json'), result.manifest);
    writeGenericArtifact(resolve(this.repoRoot, 'outputs/history/operator_report_runs', `${result.weekly_brief.report_id}.json`), result.weekly_brief);
    writeGenericArtifact(resolve(operatorRoot, 'latest_run.json'), result.manifest);
  }

  writeNarrativeGraphPromotion(report: NarrativeGraphPromotionReport): void {
    const output = 'autonomy';
    mkdirSync(resolve(output, 'history'), { recursive: true });
    writeGenericArtifact(resolve(output, 'latest_narrative_graph_promotion.json'), report);
    writeGenericArtifact(resolve(output, 'history', `narrative_graph_promotion_${report.run_id}.json`), report);
    writeGenericTextArtifact(resolve(output, 'latest_narrative_graph_promotion.md'), renderNarrativeGraphPromotion(report));
  }

  private readYamlRows(relativePath: string): EvidenceNode[] {
    const path = resolve(this.repoRoot, relativePath);
    if (!existsSync(path)) return [];
    try {
      const value = readGenericArtifact(path)! as EvidenceNode[];
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  /**
   * The pre-v0.9 table contains exploratory material created before the
   * controlled admission loop existed. Keep it intact for research recovery,
   * but admit only explicitly admitted rows into live Stage Gates. A legacy
   * import audit alone is not enough: old bulk jobs used that format too.
   */
  private readAuditedManualEvidence(): EvidenceNode[] {
    const admittedIds = this.readEvidenceAdmissionIds(['manual_import', 'migration_baseline']);
    return this.readYamlRows(MANUAL_EVIDENCE_PATH)
      .filter((item) => admittedIds.has(item.evidence_id))
      .filter(hasOperationalSourceProvenance)
      .map(normalizeOperationalEvidenceSourceType);
  }

  private readAuditedAutomatedEvidence(): EvidenceNode[] {
    const admittedIds = this.readEvidenceAdmissionIds(['automated_publication']);
    return this.readYamlRows(AUTOMATED_EVIDENCE_PATH)
      .filter((item) => admittedIds.has(item.evidence_id))
      .filter(hasOperationalSourceProvenance)
      .map(normalizeOperationalEvidenceSourceType);
  }

  private readEvidenceAdmissionIds(allowedTypes: string[]): Set<string> {
    const path = resolve(this.repoRoot, MANUAL_EVIDENCE_ADMISSION_PATH);
    if (!existsSync(path)) return new Set();
    const ids = new Set<string>();
    for (const line of (readGenericTextArtifact(path) ?? "").split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as { admission_type?: string; evidence_ids?: unknown };
        const evidenceIds = record.evidence_ids;
        if (!allowedTypes.includes(record.admission_type ?? '') || !Array.isArray(evidenceIds)) continue;
        for (const evidenceId of evidenceIds) {
          if (typeof evidenceId === 'string' && evidenceId.trim()) ids.add(evidenceId);
        }
      } catch {
        // A malformed legacy audit line must not be treated as approval.
      }
    }
    return ids;
  }
}

function renderNarrativeGraphPromotion(report: NarrativeGraphPromotionReport): string {
  const lines = [
    '# Autonomous Narrative Graph Promotion',
    '',
    `- run_id: ${report.run_id}`,
    `- activated provisional topics: ${report.summary.provisional_topics_activated}`,
    `- activated watch branches: ${report.summary.watch_branches_activated}`,
    `- held nodes: ${report.summary.held_count}`,
    '',
    '## Decisions',
    '',
    ...(report.items.length
      ? report.items.map((item) => `- ${item.node_kind}:${item.node_id} -> ${item.decision}; sources=${item.independent_source_count}; ${item.reasons.join('; ')}`)
      : ['- No provisional Topic or watch Branch requires a transition.']),
    '',
    '## Guardrails',
    '',
    '- Formal Evidence Table required: true',
    '- Parent and Branch are evaluated separately: true',
    '- Stage and Score remain deterministic: true',
    '- Trading advice: prohibited',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderPolicyAuditMarkdown(audit: AutonomousResearchPolicyAudit): string {
  const lines = [
    '# 自动发布策略校验',
    '',
    `- 策略: ${audit.policy_id}`,
    `- 状态: ${audit.status}`,
    `- 自动发布: ${audit.automatic_publication_enabled ? '已启用' : '未启用'}`,
    '',
    '## 错误',
    '',
    ...(audit.errors.length ? audit.errors.map((item) => `- ${item}`) : ['- 无']),
    '',
    '## 提示',
    '',
    ...(audit.warnings.length ? audit.warnings.map((item) => `- ${item}`) : ['- 无']),
    '',
    '- 此校验不发布 Evidence、不创建 Topic/Branch，也不改变 Stage 或 Score。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderPromotionReport(result: AutonomousResearchRun): string {
  const report = result.report;
  const lines = [
    '# Autonomous Research Promotion',
    '',
    `- run_id: ${report.run_id}`,
    `- policy: ${report.policy_id}`,
    `- model_status: ${report.model_status}`,
    `- publication_mode: ${report.publication_mode}`,
    `- publication_requested: ${report.publication_requested}`,
    `- published: ${report.published_count}`,
    `- held: ${report.held_count}`,
    `- rejected: ${report.rejected_count}`,
    '',
    '## Decisions',
    '',
    ...(report.items.length ? report.items.map((item) => `- ${item.evidence_id}: ${item.decision}${item.reasons.length ? ` (${item.reasons.join('; ')})` : ''}`) : ['- No new candidates.']),
    '',
    '## Guardrails',
    '',
    '- Stage First, Score Second: true',
    '- Parent/Branch separation: true',
    `- Human review required: ${report.guardrail_check.human_review_required}`,
    '- Trading advice: prohibited',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
