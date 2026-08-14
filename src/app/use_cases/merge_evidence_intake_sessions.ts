import { reviewTemplate } from '@/features/intake/domain/intake_rules';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';

/** Combines independently collected source sessions into one auditable Intake
 * document. Candidates are rebuilt around their exact quote so provenance
 * offsets remain valid after concatenation. */
export function mergeEvidenceIntakeSessions(sessions: EvidenceIntakeSession[], generatedAt: string): EvidenceIntakeSession | null {
  const available = sessions.filter((session) => session.candidates.length);
  if (!available.length) return null;

  const keySeen = new Set<string>();
  const rows: Array<{ sourceSession: EvidenceIntakeSession; candidate: EvidenceCandidate }> = [];
  for (const sourceSession of available) {
    for (const candidate of sourceSession.candidates) {
      const evidence = candidate.suggested_evidence;
      // Evidence ID is the persistence identity. A retrieval-enriched session
      // may contain the same candidate with a different source URL; retaining
      // both would make the whole publication batch fail uniqueness checks.
      const key = evidence.evidence_id;
      if (keySeen.has(key)) continue;
      keySeen.add(key);
      rows.push({ sourceSession, candidate: structuredClone(candidate) });
    }
  }

  const stamp = generatedAt.replace(/[^0-9]/g, '').slice(0, 17);
  const rawDocumentId = `raw_agent_sources_${stamp}`;
  const session: EvidenceIntakeSession = {
    session_id: `intake_agent_sources_${stamp}`,
    generated_at: generatedAt,
    raw_document: {
      raw_document_id: rawDocumentId,
      source_name: 'Merged governed research sources',
      source_kind: 'pasted_text',
      ingested_at: generatedAt,
      text: '',
      character_count: 0,
    },
    chunks: [], provenance_records: [], candidates: [], review_template: [],
  };

  for (const [index, row] of rows.entries()) {
    const candidate = row.candidate;
    const evidence = candidate.suggested_evidence;
    const quote = candidate.original_quote.trim() || evidence.event_summary.trim() || evidence.event_title.trim();
    if (!quote) continue;
    const section = [
      `Source session: ${row.sourceSession.session_id}`,
      `Title: ${evidence.event_title}`,
      `Original URL: ${evidence.source_url ?? 'unavailable'}`,
      `Extracted text: ${quote}`,
    ].join('\n');
    const start = session.raw_document.text.length ? session.raw_document.text.length + 2 : 0;
    session.raw_document.text = session.raw_document.text ? `${session.raw_document.text}\n\n${section}` : section;
    const chunkId = `chunk_${rawDocumentId}_${index}`;
    const provenanceId = `prov_${rawDocumentId}_${index}`;
    const quoteStart = start + section.indexOf(quote);
    session.chunks.push({ chunk_id: chunkId, raw_document_id: rawDocumentId, index, text: section, start_offset: start, end_offset: start + section.length });
    session.provenance_records.push({
      provenance_id: provenanceId, raw_document_id: rawDocumentId, chunk_id: chunkId, quote,
      quote_start_offset: quoteStart, quote_end_offset: quoteStart + quote.length,
      location_label: `${row.sourceSession.raw_document.source_name} / candidate ${candidate.candidate_id}`,
      extraction_reason: 'Merged without changing the source quote or Evidence fields.',
    });
    candidate.raw_document_id = rawDocumentId;
    candidate.chunk_id = chunkId;
    candidate.provenance_id = provenanceId;
    candidate.original_quote = quote;
    session.candidates.push(candidate);
  }
  session.raw_document.character_count = session.raw_document.text.length;
  session.review_template = reviewTemplate(session.candidates);
  return session;
}
