import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { EvidenceNode } from '@/domain/evidence';
import type { AutonomousResearchPolicy, AutonomousResearchRun } from '@/types/autonomous_research';
import type { NarrativeGraphPromotionReport } from '@/types/narrative_graph_promotion';
import type { StageSnapshotHistory } from '@/types/diff';
import { writeJsonAtomically, writeTextAtomically } from '@/services/run_manifest_writer';
import { renderStageDiffMarkdown } from '@/services/stage_diff_markdown_renderer';
import { renderWeeklyBriefMarkdown } from '@/services/report_markdown_renderer';

const LIVE_EVIDENCE_DIR = 'data/live_evidence';
const AUTOMATED_EVIDENCE_PATH = `${LIVE_EVIDENCE_DIR}/automated_evidence.yaml`;
const MANUAL_EVIDENCE_PATH = 'data/sample_evidence/manual_imported_evidence.yaml';
const MANUAL_EVIDENCE_AUDIT_PATH = 'data/audit/evidence_import_audit.jsonl';
const MANUAL_EVIDENCE_ADMISSION_PATH = 'data/audit/operational_evidence_admission.jsonl';

export class FileAutonomousResearchRepository {
  constructor(private readonly repoRoot: string) {}

  readPolicy(): AutonomousResearchPolicy {
    return JSON.parse(readFileSync(resolve(this.repoRoot, 'configs/autonomous_research_policy.json'), 'utf8')) as AutonomousResearchPolicy;
  }

  readOperationalEvidence(): EvidenceNode[] {
    const rows = [
      ...this.readAuditedManualEvidence(),
      ...this.readYamlRows(AUTOMATED_EVIDENCE_PATH),
      ...this.readJsonEvidenceTable(),
    ];
    const byId = new Map(rows.map((item) => [item.evidence_id, item]));
    return [...byId.values()];
  }

  private readJsonEvidenceTable(): EvidenceNode[] {
    const jsonPath = resolve(this.repoRoot, 'data/evidence_table/evidence_table.json');
    if (!existsSync(jsonPath)) return [];
    try {
      return JSON.parse(readFileSync(jsonPath, 'utf8')) as EvidenceNode[];
    } catch {
      return [];
    }
  }

  writePublishedEvidence(rows: EvidenceNode[]): void {
    const existing = this.readYamlRows(AUTOMATED_EVIDENCE_PATH);
    const merged = new Map(existing.map((item) => [item.evidence_id, item]));
    for (const row of rows) merged.set(row.evidence_id, row);
    writeTextAtomically(resolve(this.repoRoot, AUTOMATED_EVIDENCE_PATH), stringify([...merged.values()]));

    const jsonPath = resolve(this.repoRoot, 'data/evidence_table/evidence_table.json');
    const existingJson = this.readJsonEvidenceTable();
    const jsonMerged = new Map(existingJson.map((item) => [item.evidence_id, item]));
    for (const row of rows) jsonMerged.set(row.evidence_id, row);
    mkdirSync(resolve(this.repoRoot, 'data/evidence_table'), { recursive: true });
    writeTextAtomically(jsonPath, JSON.stringify([...jsonMerged.values()], null, 2));
  }

  readLatestSnapshot(): StageSnapshotHistory | null {
    const path = resolve(this.repoRoot, 'outputs/operator_runs/latest_stage_snapshot.json');
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as StageSnapshotHistory : null;
  }

  readPreviousOperatorRunId(): string | null {
    const path = resolve(this.repoRoot, 'outputs/operator_runs/latest_run.json');
    if (!existsSync(path)) return null;
    try {
      return (JSON.parse(readFileSync(path, 'utf8')) as { run_id?: string }).run_id ?? null;
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
    const output = resolve(this.repoRoot, 'outputs/autonomy');
    mkdirSync(output, { recursive: true });
    writeJsonAtomically(resolve(output, 'latest_promotion_report.json'), result.report);
    writeJsonAtomically(resolve(output, 'latest_stage_snapshot.json'), result.snapshot);
    writeJsonAtomically(resolve(output, 'latest_stage_diff.json'), result.diff);
    writeJsonAtomically(resolve(output, 'latest_run.json'), result);
    writeJsonAtomically(resolve(output, 'history', `autonomous_run_${result.report.run_id}.json`), result);
    writeTextAtomically(resolve(output, 'latest_promotion_report.md'), renderPromotionReport(result));

    // Operator runs are the one canonical live-research chain. Golden-case
    // outputs intentionally remain untouched as regression fixtures.
    const operatorRoot = resolve(this.repoRoot, 'outputs/operator_runs');
    const runRoot = resolve(operatorRoot, result.manifest.run_id);
    writeJsonAtomically(resolve(operatorRoot, 'latest_stage_snapshot.json'), result.snapshot);
    writeJsonAtomically(resolve(operatorRoot, 'latest_stage_diff.json'), result.diff);
    writeTextAtomically(resolve(operatorRoot, 'latest_stage_diff.md'), renderStageDiffMarkdown(result.diff));
    writeJsonAtomically(resolve(operatorRoot, 'latest_weekly_brief.json'), result.weekly_brief);
    writeTextAtomically(resolve(operatorRoot, 'latest_weekly_brief.md'), renderWeeklyBriefMarkdown(result.weekly_brief));
    writeJsonAtomically(resolve(runRoot, 'stage_snapshot.json'), result.snapshot);
    writeJsonAtomically(resolve(runRoot, 'stage_diff.json'), result.diff);
    writeTextAtomically(resolve(runRoot, 'stage_diff.md'), renderStageDiffMarkdown(result.diff));
    writeJsonAtomically(resolve(runRoot, 'weekly_brief.json'), result.weekly_brief);
    writeTextAtomically(resolve(runRoot, 'weekly_brief.md'), renderWeeklyBriefMarkdown(result.weekly_brief));
    writeJsonAtomically(resolve(runRoot, 'run_manifest.json'), result.manifest);
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/history/operator_report_runs', `${result.weekly_brief.report_id}.json`), result.weekly_brief);
    writeJsonAtomically(resolve(operatorRoot, 'latest_run.json'), result.manifest);
  }

  writeNarrativeGraphPromotion(report: NarrativeGraphPromotionReport): void {
    const output = resolve(this.repoRoot, 'outputs/autonomy');
    mkdirSync(resolve(output, 'history'), { recursive: true });
    writeJsonAtomically(resolve(output, 'latest_narrative_graph_promotion.json'), report);
    writeJsonAtomically(resolve(output, 'history', `narrative_graph_promotion_${report.run_id}.json`), report);
    writeTextAtomically(resolve(output, 'latest_narrative_graph_promotion.md'), renderNarrativeGraphPromotion(report));
  }

  private readYamlRows(relativePath: string): EvidenceNode[] {
    const path = resolve(this.repoRoot, relativePath);
    if (!existsSync(path)) return [];
    try {
      const value = parse(readFileSync(path, 'utf8')) as EvidenceNode[];
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
    const admittedIds = this.readAdmittedManualEvidenceIds();
    return this.readYamlRows(MANUAL_EVIDENCE_PATH)
      .filter((item) => admittedIds.has(item.evidence_id));
  }

  private readAdmittedManualEvidenceIds(): Set<string> {
    const path = resolve(this.repoRoot, MANUAL_EVIDENCE_ADMISSION_PATH);
    if (!existsSync(path)) return new Set();
    const ids = new Set<string>();
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as { admission_type?: string; evidence_ids?: unknown };
        const evidenceIds = record.evidence_ids;
        if ((record.admission_type !== 'manual_import' && record.admission_type !== 'migration_baseline') || !Array.isArray(evidenceIds)) continue;
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

function renderPromotionReport(result: AutonomousResearchRun): string {
  const report = result.report;
  const lines = [
    '# Autonomous Research Promotion',
    '',
    `- run_id: ${report.run_id}`,
    `- policy: ${report.policy_id}`,
    `- model_status: ${report.model_status}`,
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
    '- Trading advice: prohibited',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
