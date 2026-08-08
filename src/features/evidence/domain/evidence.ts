export type EvidenceStrength = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';

export type EvidenceLayer =
  | 'perception'
  | 'capital'
  | 'pricing'
  | 'reality'
  | 'feedback'
  | 'friction';

export type EvidenceScope = 'parent' | 'branch' | 'asset' | 'unknown';

export interface EvidenceNode {
  evidence_id: string;
  topic_id: string;
  branch_id?: string | null;
  event_date: string;
  available_at: string;
  event_title: string;
  event_summary?: string;
  event_type: string;
  source_name: string;
  source_url?: string;
  source_type?: string;
  evidence_strength: EvidenceStrength;
  affected_layer: EvidenceLayer[];
  stage_effect: string;
  parent_or_branch?: EvidenceScope;
  branch_coverage_score?: number;
  interpretation?: string;
  limitation?: string;
  positive_or_negative?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  schema_version?: string;
}

export const evidenceStrengthRank: Record<EvidenceStrength, number> = {
  E0: 0,
  E1: 1,
  E2: 2,
  E3: 3,
  E4: 4,
};

export const requiredEvidenceFields: Array<keyof EvidenceNode> = [
  'evidence_id',
  'topic_id',
  'event_date',
  'available_at',
  'event_title',
  'event_type',
  'source_name',
  'evidence_strength',
  'affected_layer',
  'stage_effect',
];

export function hasEvidenceTable(evidence: EvidenceNode[]): boolean {
  return evidence.length > 0;
}

export function validateEvidenceNode(evidence: EvidenceNode): string[] {
  const errors: string[] = [];

  for (const field of requiredEvidenceFields) {
    const value = evidence[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`missing ${field}`);
    }
  }

  if (!Array.isArray(evidence.affected_layer) || evidence.affected_layer.length === 0) {
    errors.push('affected_layer must contain at least one layer');
  }

  if (evidence.evidence_strength === 'E0') {
    errors.push('E0 evidence is invalid for scoring and stage classification');
  }

  return errors;
}

export function isHardRealityEvidence(evidence: EvidenceNode): boolean {
  return (
    evidence.affected_layer.includes('reality') &&
    evidenceStrengthRank[evidence.evidence_strength] >= evidenceStrengthRank.E2
  );
}

export function evidenceForScope(evidence: EvidenceNode[], scope: 'parent' | 'branch', branchId?: string): EvidenceNode[] {
  if (scope === 'branch') {
    return evidence.filter((item) => item.parent_or_branch === 'branch' && (!branchId || item.branch_id === branchId));
  }

  return evidence.filter((item) => item.parent_or_branch === 'parent');
}
