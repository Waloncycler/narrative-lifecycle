import type { EvidenceNode } from '../domain/evidence';
import type { ScoreDetail } from '../domain/scoring';
import { clampScore } from '../domain/scoring';

export function scoreFromEvidence(
  evidence: EvidenceNode[],
  reasoning: string,
  missingData: string[],
  baseScore: number,
): ScoreDetail {
  if (evidence.length === 0) {
    throw new Error('No Evidence Table, no scoring');
  }

  const averageConfidence =
    evidence.reduce((sum, item) => sum + (item.confidence ?? 60), 0) / evidence.length;

  return {
    score: clampScore(baseScore),
    evidence_ids: evidence.map((item) => item.evidence_id),
    reasoning,
    missing_data: missingData,
    confidence: clampScore(averageConfidence),
  };
}
