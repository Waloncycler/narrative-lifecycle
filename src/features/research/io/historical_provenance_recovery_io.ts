import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { HistoricalProvenanceRecoveryReport } from '@/features/research/types/historical_provenance_recovery';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { db } from '@/db/index';
import { evidence as evidenceTable } from '@/db/schema';
import type { EvidenceLayer, EvidenceScope, EvidenceStrength } from '@/features/evidence/domain/evidence';

const EVIDENCE_TABLE_PATH = 'data/evidence_table/evidence_table.json';
const ADMISSION_PATH = 'data/audit/operational_evidence_admission.jsonl';

export class DbHistoricalProvenanceRecoveryRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readEvidence(): EvidenceNode[] {
    const rows = db.select().from(evidenceTable).all().map((row) => ({
      evidence_id: row.evidence_id,
      topic_id: row.topic_id,
      branch_id: row.branch_id,
      event_date: row.event_date,
      available_at: row.available_at,
      event_title: row.event_title,
      event_summary: row.event_summary ?? undefined,
      event_type: row.event_type,
      source_name: row.source_name,
      source_url: row.source_url ?? undefined,
      source_type: row.source_type ?? undefined,
      evidence_strength: row.evidence_strength as EvidenceStrength,
      affected_layer: parseArray(row.affected_layer_json) as EvidenceLayer[],
      stage_effect: row.stage_effect,
      parent_or_branch: (row.parent_or_branch ?? undefined) as EvidenceScope | undefined,
      interpretation: row.interpretation ?? undefined,
      limitation: row.limitation ?? undefined,
      positive_or_negative: (row.positive_or_negative ?? undefined) as EvidenceNode['positive_or_negative'],
      confidence: row.confidence ?? undefined,
    } satisfies EvidenceNode));
    let legacy: EvidenceNode[] = [];
    try {
      const value = readGenericArtifact(resolve(this.repoRoot, EVIDENCE_TABLE_PATH))! as unknown;
      legacy = Array.isArray(value) ? value as EvidenceNode[] : [];
    } catch { /* database rows remain authoritative */ }
    const combined = new Map(legacy.map((item) => [item.evidence_id, item]));
    for (const row of rows) combined.set(row.evidence_id, row);
    return [...combined.values()];
  }

  readAdmittedEvidenceIds(): Set<string> {
    const path = resolve(this.repoRoot, ADMISSION_PATH);
    if (!existsSync(path)) return new Set();
    const ids = new Set<string>();
    for (const line of (readGenericTextArtifact(path) ?? "").split('\n')) {
      try {
        const record = JSON.parse(line) as { evidence_ids?: unknown };
        if (Array.isArray(record.evidence_ids)) for (const id of record.evidence_ids) if (typeof id === 'string') ids.add(id);
      } catch { /* malformed historic audit line is not admission evidence */ }
    }
    return ids;
  }

  write(report: HistoricalProvenanceRecoveryReport): void {
    const output = 'research';
    writeGenericArtifact(resolve(output, 'latest_historical_provenance_recovery.json'), report);
    writeGenericArtifact(resolve(output, 'history', `${report.recovery_run_id}.json`), report);
    writeGenericTextArtifact(resolve(output, 'latest_historical_provenance_recovery.md'), renderMarkdown(report));
  }
}

function parseArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function renderMarkdown(report: HistoricalProvenanceRecoveryReport): string {
  const lines = [
    '# 历史原始来源重获', '',
    `- 请求历史条目：${report.requested_target_count}`,
    `- 取得原页：${report.recovered_target_count}`,
    `- 双来源验证，可进入 Agent：${report.auto_intake_ready_count}`,
    `- 仅单源引文，继续待核验：${report.citation_ready_unverified_count}`,
    `- 无法取证：${report.insufficient_count}`, '',
    '## 结果', '',
    ...(report.items.length ? report.items.map((item) => `- ${item.target.event_title} · ${item.corroboration_status} · ${item.independent_source_hosts.join('、') || '无独立来源'}\n  - ${item.reason}`) : ['- 当前没有需要重新取证的历史条目。']),
    '', '> 搜索结果只用于发现原页。只有可定位原文、两个独立来源、相同 Topic/Branch 范围的主包才会进入既有 Agent 与准入策略；该步骤不直接修改 Evidence、Stage 或 Score。', '',
  ];
  return `${lines.join('\n')}\n`;
}
