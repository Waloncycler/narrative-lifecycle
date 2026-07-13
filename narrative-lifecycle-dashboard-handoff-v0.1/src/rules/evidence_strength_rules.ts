import type { EvidenceNode, EvidenceStrength } from '../domain/evidence';
import { evidenceStrengthRank, validateEvidenceNode } from '../domain/evidence';
import type { Stage } from '../domain/stages';

export function minimumEvidenceStrengthForStage(stage: Stage): EvidenceStrength {
  if (stage === 'S0' || stage === 'S1' || stage === 'S2') return 'E1';
  if (stage === 'S3' || stage === 'S4') return 'E2';
  if (stage === 'S5') return 'E2';
  return 'E3';
}

export function isEvidenceStrongEnoughForStage(evidence: EvidenceNode, stage: Stage): boolean {
  const minimum = minimumEvidenceStrengthForStage(stage);
  return evidenceStrengthRank[evidence.evidence_strength] >= evidenceStrengthRank[minimum];
}

export function assertUsableEvidence(evidence: EvidenceNode): void {
  const errors = validateEvidenceNode(evidence);
  if (errors.length > 0) {
    throw new Error(`Invalid evidence ${evidence.evidence_id ?? 'unknown'}: ${errors.join(', ')}`);
  }
}
