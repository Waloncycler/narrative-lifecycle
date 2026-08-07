import { createHash } from 'node:crypto';
import type { EvidenceLayer, EvidenceNode } from '../domain/evidence';
import type { EvidenceImportDraft, NormalizedEvidenceImport } from '../types/evidence_import';

const layerMap: Record<string, EvidenceLayer> = {
  name: 'perception',
  capital: 'capital',
  pricing: 'pricing',
  reality: 'reality',
  momentum: 'feedback',
  friction: 'friction',
  data_confidence: 'feedback',
};

const confidenceMap = {
  low: 45,
  medium: 70,
  high: 85,
} as const;

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function stageEffectForPipeline(draft: EvidenceImportDraft): string {
  const scope = draft.scope === 'branch' ? 'branch' : 'parent';
  return `${draft.stage_effect}_${scope}`;
}

export function normalizeEvidenceImport(input: {
  drafts: EvidenceImportDraft[];
  sourceFile: string;
  importedAt?: string;
}): NormalizedEvidenceImport[] {
  const importedAt = input.importedAt ?? new Date().toISOString();
  const importId = `import_${importedAt.slice(0, 10).replaceAll('-', '')}`;

  return input.drafts.map((draft) => {
    const affectedLayer = Array.from(new Set(draft.affected_layer.map((layer) => layerMap[layer])));
    const evidence: EvidenceNode = {
      evidence_id: draft.evidence_id.trim(),
      topic_id: draft.topic_id.trim(),
      branch_id: draft.scope === 'branch' ? draft.branch_id ?? null : null,
      event_date: draft.event_date,
      event_title: draft.event_title.trim(),
      event_summary: draft.event_summary.trim(),
      event_type: draft.event_type.trim(),
      source_name: draft.source_name.trim(),
      source_url: draft.source_url ?? 'https://example.invalid/imports/manual-evidence',
      source_type: `manual_${draft.source_type}`,
      evidence_strength: draft.evidence_strength.toUpperCase() as EvidenceNode['evidence_strength'],
      affected_layer: affectedLayer,
      stage_effect: stageEffectForPipeline(draft),
      parent_or_branch: draft.scope,
      available_at: draft.available_at,
      branch_coverage_score: draft.scope === 'branch' ? 35 : 0,
      interpretation: draft.interpretation.trim(),
      limitation: draft.limitation.trim(),
      positive_or_negative: draft.polarity === 'mixed' ? 'neutral' : draft.polarity,
      confidence: confidenceMap[draft.confidence],
      schema_version: '0.2-manual-import',
    };

    return {
      import_id: importId,
      imported_at: importedAt,
      source_file: input.sourceFile,
      evidence_hash: hash(evidence),
      draft,
      evidence,
    };
  });
}
