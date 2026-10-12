import type { EvidenceNode } from '@/features/evidence/domain/evidence';

const SOURCE_TYPES = new Set(['official', 'filing', 'news', 'research', 'academic', 'company', 'other']);

/**
 * Projects legacy evidence into the current source-type contract without
 * changing stored evidence. Only an exact, known legacy source_name is used;
 * hostnames, titles, and model guesses are deliberately ignored.
 */
export function normalizeOperationalEvidenceSourceType(evidence: EvidenceNode): EvidenceNode {
  if (evidence.source_type && SOURCE_TYPES.has(evidence.source_type)) return evidence;
  const legacyType = evidence.source_name?.trim().toLowerCase();
  return legacyType && SOURCE_TYPES.has(legacyType)
    ? { ...evidence, source_type: legacyType }
    : evidence;
}

/** Placeholder URLs may support draft editing, but never operational Stage
 * Gate evidence. A real imported row must retain a traceable HTTP(S) source. */
export function hasOperationalSourceProvenance(evidence: EvidenceNode): boolean {
  try {
    const url = new URL(evidence.source_url ?? '');
    return (url.protocol === 'http:' || url.protocol === 'https:') && !/example\.invalid$/i.test(url.hostname);
  } catch {
    return false;
  }
}
