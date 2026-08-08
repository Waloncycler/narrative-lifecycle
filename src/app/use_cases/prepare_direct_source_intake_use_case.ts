import { reviewTemplate } from '@/features/intake/domain/intake_rules';
import type { DirectSourceResearchReport } from '@/features/research/types/direct_source_research';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';

export interface PrepareDirectSourceIntakeUseCaseDeps {
  now(): string;
  existingEvidenceIds(): Set<string>;
  writeIntakeSession(session: EvidenceIntakeSession): void;
  resolveTopics(session: EvidenceIntakeSession): void;
  validateSession(session: EvidenceIntakeSession): void;
  validateCandidate(candidate: EvidenceCandidate): void;
}

/**
 * Converts queryable original-source leads into review-only E1 candidates.
 * The report may be useful discovery context, but the candidate still needs
 * Topic resolution, human review, and the normal Evidence admission gate.
 */
export class PrepareDirectSourceIntakeUseCase {
  constructor(private readonly deps: PrepareDirectSourceIntakeUseCaseDeps) {}

  execute(report: DirectSourceResearchReport): EvidenceIntakeSession | null {
    if (!report.leads.length) return null;
    const generatedAt = this.deps.now();
    const rawDocumentId = `raw_direct_source_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
    const sections = report.leads.map((lead) => [
      `Source: ${lead.source_name}`,
      `Title: ${lead.title}`,
      `Record: ${lead.snippet || 'No additional summary supplied by the source API.'}`,
      `URL: ${lead.url}`,
    ].join('\n'));
    const text = sections.join('\n\n');
    const session: EvidenceIntakeSession = {
      session_id: `intake_direct_source_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
      generated_at: generatedAt,
      raw_document: {
        raw_document_id: rawDocumentId,
        source_name: 'Authoritative direct-source research campaign',
        source_kind: 'pasted_text',
        ingested_at: generatedAt,
        text,
        character_count: text.length,
      },
      chunks: [],
      provenance_records: [],
      candidates: [],
      review_template: [],
    };
    let offset = 0;
    for (const [index, lead] of report.leads.entries()) {
      const branchId = inferredBranchId(lead);
      const topicId = candidateTopicId(lead);
      const section = sections[index]!;
      const chunkId = `chunk_${rawDocumentId}_${index}`;
      const provenanceId = `prov_${rawDocumentId}_${index}`;
      // The title occurs verbatim in the stored raw section. The API summary
      // remains structured context, not an invented extension of the quote.
      const quote = lead.title;
      const quoteStart = section.indexOf(lead.title);
      const evidenceId = `direct_${lead.source_id}_${stableId(lead.url)}`;
      session.chunks.push({ chunk_id: chunkId, raw_document_id: rawDocumentId, index, text: section, start_offset: offset, end_offset: offset + section.length });
      session.provenance_records.push({
        provenance_id: provenanceId,
        raw_document_id: rawDocumentId,
        chunk_id: chunkId,
        quote,
        quote_start_offset: offset + quoteStart,
        quote_end_offset: offset + quoteStart + quote.length,
        location_label: `${lead.source_name} / ${lead.url}`,
        extraction_reason: 'Term-addressable primary-source record retrieved by the coverage campaign; title and API summary retained verbatim for review.',
      });
      const candidate: EvidenceCandidate = {
        candidate_id: `candidate_${evidenceId}`,
        raw_document_id: rawDocumentId,
        chunk_id: chunkId,
        provenance_id: provenanceId,
        original_quote: quote,
        suggested_evidence: {
          evidence_id: evidenceId,
          topic_id: topicId,
          branch_id: branchId,
          scope: branchId ? 'branch' : 'parent',
          event_date: sourceDate(lead.published_at, generatedAt),
          available_at: sourceDate(lead.published_at, generatedAt),
          event_title: lead.title,
          event_summary: lead.snippet || 'Source API returned a title without an additional bounded summary.',
          event_type: 'DIRECT_SOURCE_RECORD',
          source_name: lead.source_name,
          source_url: lead.url,
          source_type: sourceType(lead.source_id),
          evidence_strength: 'E1',
          affected_layer: ['reality'],
          stage_effect: branchId ? 'split_branch' : 'maintain',
          polarity: 'neutral',
          interpretation: 'A term-addressable original-source record may be relevant to this Topic or Branch, but it is a review candidate rather than proof of any lifecycle stage.',
          limitation: 'API metadata and title are insufficient to establish pricing, adoption, revenue, scale, or a Stage transition. Verify the original record and retain Parent/Branch separation.',
          confidence: 'low',
        },
        suggested_reason: `Retrieved from ${lead.source_name} using the coverage task's own term; retained as E1 review context only.`,
        uncertainty_notes: [
          'This API result is not formal Evidence and cannot change Stage or Score directly.',
          ...(lead.candidate_node_id ? ['This record came from a research seed and can only accumulate under a provisional S0 topic.'] : []),
          'A parent-scoped record still needs the full Evidence Table and Stage Gate sequence.',
          branchId ? 'This record remains branch-scoped and cannot upgrade its parent narrative.' : 'The original source page must be checked before any formal admission.',
        ],
        field_explanations: {
          topic_id: 'Inherited from the bounded campaign task; Topic Resolver will verify it.',
          evidence_strength: 'E1 because this is a discovery-level API record rather than a reviewed primary-document extraction.',
          affected_layer: 'Reality is only a hypothesis from the record type; no Stage conclusion is implied.',
        },
        e_strength_rationale: 'The result is an authentic source pointer but not a complete, independently reviewed source document.',
        publication_eligibility: 'manual_review',
        duplicate_of_evidence_id: this.deps.existingEvidenceIds().has(evidenceId) ? evidenceId : null,
        guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
      };
      this.deps.validateCandidate(candidate);
      session.candidates.push(candidate);
      offset += section.length + 2;
    }
    session.review_template = reviewTemplate(session.candidates);
    this.deps.validateSession(session);
    this.deps.writeIntakeSession(session);
    this.deps.resolveTopics(session);
    return session;
  }
}

function stableId(value: string): string {
  let hash = 5381;
  for (const char of value) hash = ((hash << 5) + hash) ^ char.codePointAt(0)!;
  return (hash >>> 0).toString(36);
}

function sourceDate(value: string | null, fallback: string): string {
  const match = value?.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : fallback.slice(0, 10);
}

function sourceType(sourceId: string): 'official' | 'academic' | 'research' {
  if (['clinicaltrials', 'pubmed'].includes(sourceId)) return 'official';
  if (['crossref', 'arxiv'].includes(sourceId)) return 'academic';
  return 'research';
}

function inferredBranchId(lead: DirectSourceResearchReport['leads'][number]): string | null {
  if (lead.branch_id) return lead.branch_id;
  if (lead.topic_id !== 'bci') return null;

  const record = `${lead.title}\n${lead.snippet}`.toLowerCase();
  // These are record-level clinical indications, not evidence that the BCI
  // parent narrative itself has crossed a lifecycle gate.
  if (/(rehabilitation|recovery after stroke|stroke|hemiparesis|hemiplegia|motor disability|spinal cord injury)/.test(record)) {
    return 'bci_medical_rehab';
  }
  if (/(depression|psychiatric|mental health)/.test(record)) return 'provisional_bci_psychiatric_depression';
  return null;
}

function candidateTopicId(lead: DirectSourceResearchReport['leads'][number]): string {
  if (lead.topic_id) return lead.topic_id;
  if (lead.candidate_node_id) return `provisional_${stableIdSlug(lead.candidate_node_id)}`;
  return 'unknown_topic';
}

function stableIdSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72) || 'unknown';
}
