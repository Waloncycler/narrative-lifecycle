import type { EvidenceNode } from './evidence';
import { hasEvidenceTable, validateEvidenceNode } from './evidence';

export function createEvidenceNode(input: EvidenceNode): EvidenceNode {
  const errors = validateEvidenceNode(input);
  if (errors.length > 0) {
    throw new Error(`Invalid evidence node: ${errors.join(', ')}`);
  }
  return input;
}

export function validateEvidenceTable(evidence: EvidenceNode[]): string[] {
  const errors = evidence.flatMap((item) => validateEvidenceNode(item).map((error) => `${item.evidence_id}: ${error}`));
  if (!hasEvidenceTable(evidence)) errors.push('Evidence Table is required');
  return errors;
}

export function requireEvidenceTable(evidence: EvidenceNode[]): void {
  if (!hasEvidenceTable(evidence)) {
    throw new Error('No Evidence Table, no scoring or stage classification');
  }
}
