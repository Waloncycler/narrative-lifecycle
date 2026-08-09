import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { BaselineEvidenceReconciliationReport } from '@/features/research/types/baseline_evidence_reconciliation';
import { writeJsonAtomically, writeTextAtomically } from '@/platform/io/run_manifest_writer';

const EVIDENCE_TABLE_PATH = 'data/evidence_table/evidence_table.json';
const ADMISSION_PATH = 'data/audit/operational_evidence_admission.jsonl';

export class FileBaselineEvidenceReconciliationRepository {
  constructor(private readonly repoRoot: string) {}

  readEvidence(): EvidenceNode[] {
    const path = resolve(this.repoRoot, EVIDENCE_TABLE_PATH);
    if (!existsSync(path)) return [];
    try {
      const value = JSON.parse(readFileSync(path, 'utf8')) as unknown;
      return Array.isArray(value) ? value as EvidenceNode[] : [];
    } catch {
      return [];
    }
  }

  readAdmittedEvidenceIds(): Set<string> {
    const path = resolve(this.repoRoot, ADMISSION_PATH);
    if (!existsSync(path)) return new Set();
    const ids = new Set<string>();
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      try {
        const record = JSON.parse(line) as { admission_type?: string; evidence_ids?: unknown };
        if (!['manual_import', 'migration_baseline', 'automated_publication'].includes(record.admission_type ?? '') || !Array.isArray(record.evidence_ids)) continue;
        for (const evidenceId of record.evidence_ids) if (typeof evidenceId === 'string') ids.add(evidenceId);
      } catch {
        // Ignore malformed historical audit records.
      }
    }
    return ids;
  }

  write(report: BaselineEvidenceReconciliationReport): void {
    const output = resolve(this.repoRoot, 'outputs/research');
    writeJsonAtomically(resolve(output, 'latest_baseline_evidence_reconciliation.json'), report);
    writeJsonAtomically(resolve(output, 'history', `${report.report_id}.json`), report);
    writeTextAtomically(resolve(output, 'latest_baseline_evidence_reconciliation.md'), renderBaselineReconciliation(report));
  }

  appendAdmission(input: { report: BaselineEvidenceReconciliationReport; topicId: string; reviewer: string; admittedAt: string }): string {
    const item = input.report.items.find((candidate) => candidate.topic_id === input.topicId);
    if (!item || item.status !== 'ready_for_review') throw new Error('baseline_topic_is_not_ready_for_review');
    const reviewer = input.reviewer.trim();
    if (!reviewer) throw new Error('baseline_reviewer_is_required');
    const evidenceIds = item.eligible_parent_evidence.map((candidate) => candidate.evidence_id);
    if (!evidenceIds.length) throw new Error('baseline_has_no_admissible_parent_evidence');
    const admissionId = `migration_baseline_${input.topicId}_${input.admittedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
    const path = resolve(this.repoRoot, ADMISSION_PATH);
    mkdirSync(resolve(this.repoRoot, 'data/audit'), { recursive: true });
    appendFileSync(path, `${JSON.stringify({
      admission_id: admissionId,
      admitted_at: input.admittedAt,
      admission_type: 'migration_baseline',
      source_file: EVIDENCE_TABLE_PATH,
      topic_id: input.topicId,
      evidence_ids: evidenceIds,
      reviewer,
      report_id: input.report.report_id,
      policy_version: 'v0.16-baseline-reconciliation',
    })}\n`);
    return admissionId;
  }
}

function renderBaselineReconciliation(report: BaselineEvidenceReconciliationReport): string {
  const lines = [
    '# 历史基线证据核对',
    '',
    `- 活跃主题: ${report.summary.active_topic_count}`,
    `- 待审核准入: ${report.summary.ready_for_review_count}`,
    `- 已准入: ${report.summary.already_admitted_count}`,
    `- 可用父主题证据: ${report.summary.eligible_parent_evidence_count}`,
    '',
    '## 主题结果',
    '',
    ...report.items.map((item) => `- ${item.topic_name} (${item.topic_id}) · ${item.status} · ${item.eligible_parent_evidence.length} 条候选 / ${item.independent_source_count} 个来源 · ${item.reasons.join('；')}`),
    '',
    '## 边界',
    '',
    '- 本报告不会自动准入、重算阶段或修改 Topic/Branch。',
    '- 分支证据不会作为整体主题的历史基线。',
    '- 只有具名审核人执行准入后，候选才会进入运营 Evidence Table。',
    '',
  ];
  return `${lines.join('\n')}\n`;
}
