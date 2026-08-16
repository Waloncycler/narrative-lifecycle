import { reviewTemplate } from '@/features/intake/domain/intake_rules';
import { matchFrontierEcosystem } from '@/features/narrative/domain/intelligent_topic_resolver';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

export interface AppendRetrievedSourceIntakeUseCaseDeps {
  now(): string;
  readLatestSession(): EvidenceIntakeSession | null;
  existingEvidenceIds(): Set<string>;
  writeIntakeSession(session: EvidenceIntakeSession): void;
  resolveTopics(session: EvidenceIntakeSession): void;
  validateSession(session: EvidenceIntakeSession): void;
  validateCandidate(candidate: EvidenceCandidate): void;
}

/**
 * Advances citation-ready original-page packages into the current Intake
 * session. Matched direct-source candidates retain their deterministic date,
 * source identity, and publication eligibility while gaining a fuller quote.
 * Newly retrieved URLs remain review-only until their date/source policy is
 * independently established.
 */
export class AppendRetrievedSourceIntakeUseCase {
  constructor(private readonly deps: AppendRetrievedSourceIntakeUseCaseDeps) {}

  execute(report: ResearchSourceRetrievalReport, options: { resolveTopics?: boolean } = {}): EvidenceIntakeSession | null {
    const ready = report.items.filter((item) => item.status === 'retrieved' && item.citation_status === 'ready' && item.next_action === 'prepare_intake' && item.excerpts.length);
    if (!ready.length) return this.deps.readLatestSession();
    const generatedAt = this.deps.now();
    const base = this.deps.readLatestSession() ?? emptySession(generatedAt);
    const session = structuredClone(base);
    const raw = session.raw_document;
    const candidatesByUrl = new Map(session.candidates.map((candidate) => [candidate.suggested_evidence.source_url ?? '', candidate]));

    for (const [index, item] of ready.entries()) {
      const quote = item.excerpts[0]!.quote;
      const recovery = item.historical_recovery;
      const newsRecovery = item.news_corroboration;
      const sourceDate = dateOnly(item.source_published_at);
      const verifiedCurrentSource = Boolean(sourceDate && ['official', 'company_primary', 'academic'].includes(item.source_class));
      const recoveredVerified = recovery?.corroboration_status === 'verified';
      const newsVerified = newsRecovery?.corroboration_status === 'verified';
      const corroboratingUrls = recovery?.corroborating_source_urls ?? newsRecovery?.corroborating_source_urls ?? [];
      const corroboration = recoveredVerified || newsVerified
        ? report.items
          .filter((candidate) => corroboratingUrls.includes(candidate.url))
          .filter((candidate) => candidate.citation_status === 'ready' && candidate.excerpts.length)
          .map((candidate) => `Cross-source corroboration: ${candidate.url}\nExtracted text: ${candidate.excerpts[0]!.quote}`)
          .join('\n\n')
        : '';
      const section = [
        `Source: ${sourceName(item.url)}`,
        `Title: ${item.page_title ?? item.title}`,
        `Original URL: ${item.url}`,
        `Extracted text: ${quote}`,
        corroboration,
      ].join('\n');
      const start = raw.text.length ? raw.text.length + 2 : 0;
      raw.text = raw.text ? `${raw.text}\n\n${section}` : section;
      raw.character_count = raw.text.length;
      const chunkId = `chunk_${raw.raw_document_id}_retrieved_${index}`;
      const provenanceId = `prov_${raw.raw_document_id}_retrieved_${stableId(item.url)}`;
      const quoteStart = start + section.indexOf(quote);
      session.chunks.push({ chunk_id: chunkId, raw_document_id: raw.raw_document_id, index: session.chunks.length, text: section, start_offset: start, end_offset: start + section.length });
      session.provenance_records.push({
        provenance_id: provenanceId,
        raw_document_id: raw.raw_document_id,
        chunk_id: chunkId,
        quote,
        quote_start_offset: quoteStart,
        quote_end_offset: quoteStart + quote.length,
        location_label: `${sourceName(item.url)} / ${item.url} / ${item.excerpts[0]!.location_label}`,
        extraction_reason: 'Citation-ready bounded original-page excerpt retrieved from the research queue.',
      });
      const matched = newsRecovery
        ? session.candidates.find((candidate) => candidate.candidate_id === newsRecovery.news_candidate_id)
        : candidatesByUrl.get(item.url);
      if (matched) {
        matched.raw_document_id = raw.raw_document_id;
        matched.chunk_id = chunkId;
        matched.provenance_id = provenanceId;
        matched.original_quote = quote;
        matched.suggested_evidence = {
          ...matched.suggested_evidence,
          topic_id: item.topic_id ?? matched.suggested_evidence.topic_id,
          branch_id: item.branch_id,
          scope: item.branch_id ? 'branch' : 'parent',
          event_date: recovery?.event_date ?? sourceDate ?? matched.suggested_evidence.event_date,
          available_at: recovery?.event_date ?? sourceDate ?? matched.suggested_evidence.available_at,
          event_title: item.page_title ?? item.title,
          event_summary: quote,
          event_type: recovery ? 'HISTORICAL_REACQUIRED_SOURCE' : 'RETRIEVED_SOURCE_EXCERPT',
          source_name: sourceName(item.url),
          source_url: item.url,
          source_type: sourceType(item.source_class),
          stage_effect: item.branch_id ? 'split_branch' : 'maintain',
          confidence: recoveredVerified || newsVerified || verifiedCurrentSource ? 'medium' : matched.suggested_evidence.confidence,
          interpretation: newsVerified
            ? 'Two independent citation-ready sources, including a primary-source anchor, support the prioritized news claim. The package may enter normal Evidence review but does not establish a Stage.'
            : recoveredVerified
            ? 'A historical primary source was re-acquired and independently corroborated. It is eligible for the existing governed admission policy, not a direct Stage conclusion.'
            : verifiedCurrentSource
              ? 'A dated, citation-ready original source was retrieved from a governed discovery lead. It is eligible for the existing policy evaluation, not a direct Stage conclusion.'
              : matched.suggested_evidence.interpretation,
          limitation: newsVerified
            ? `Independent primary-source hosts: ${newsRecovery!.independent_source_hosts.join(', ')}. News readership and corroboration prioritize review only; Evidence strength and Stage remain rule-bound.`
            : recoveredVerified
            ? `Independent corroborating URLs: ${recovery!.corroborating_source_urls.join(', ')}. This E1 source record cannot by itself establish a lifecycle stage; Stage Gate and duplicate checks remain authoritative.`
            : verifiedCurrentSource
              ? 'A bounded original-page excerpt and source publication date are available. This E1 record cannot by itself establish pricing, adoption, or a Stage transition.'
              : matched.suggested_evidence.limitation,
        };
        const priorTemporal = matched.temporal_provenance ?? {
          event_date_source: 'ingested_at' as const,
          available_at_source: 'ingested_at' as const,
          requires_operator_confirmation: true,
        };
        matched.temporal_provenance = {
          event_date_source: recovery?.event_date || sourceDate ? 'source_metadata' : priorTemporal.event_date_source,
          available_at_source: recovery?.event_date || sourceDate ? 'source_metadata' : priorTemporal.available_at_source,
          requires_operator_confirmation: !(recoveredVerified || newsVerified || verifiedCurrentSource),
        };
        if (recoveredVerified || newsVerified || verifiedCurrentSource) matched.publication_eligibility = 'rule_verified';
        matched.suggested_reason = newsVerified
          ? 'Prioritized news claim was matched to two independent citation-ready sources including a primary anchor; advance into existing policy gates without raising E-strength.'
          : recoveredVerified
          ? 'Historical source was re-acquired with two independent, citation-ready source hosts; advance into the existing Agent and policy gates.'
          : verifiedCurrentSource
            ? 'Dated citation-ready original source replaced the prior API pointer; advance into the existing Agent and policy gates.'
            : matched.suggested_reason;
        matched.uncertainty_notes = [...new Set([...matched.uncertainty_notes, newsVerified
          ? 'Two-source corroboration permits governed review; it does not convert readership into evidence or promote a branch into its parent.'
          : recoveredVerified
          ? 'A citation-ready original page and two-source corroboration replaced the prior discovery pointer; the record remains E1 and still passes the normal Evidence Gate.'
          : verifiedCurrentSource
            ? 'A citation-ready original page and source date replaced the prior discovery pointer; the record remains E1 and still passes the normal Evidence Gate.'
            : 'A citation-ready original-page excerpt replaced the prior API summary; source date and scope remain independently constrained.'])];
        this.deps.validateCandidate(matched);
        continue;
      }

      const evidenceId = recovery?.legacy_evidence_id ?? `retrieved_${stableId(item.url)}`;
      const intelligentMatch = matchFrontierEcosystem(`${item.page_title ?? item.title} ${quote}`);
      const resolvedTopicId = item.topic_id ?? (item.candidate_node_id ? `provisional_${safeId(item.candidate_node_id)}` : intelligentMatch?.topic_id ?? 'unknown_topic');
      const resolvedBranchId = recovery?.branch_id ?? item.branch_id ?? intelligentMatch?.branch_id ?? null;
      const candidate: EvidenceCandidate = {
        candidate_id: `candidate_${evidenceId}`,
        raw_document_id: raw.raw_document_id,
        chunk_id: chunkId,
        provenance_id: provenanceId,
        original_quote: quote,
        suggested_evidence: {
          evidence_id: evidenceId,
          topic_id: resolvedTopicId,
          branch_id: resolvedBranchId,
          scope: recovery?.scope ?? (resolvedBranchId ? 'branch' : 'parent'),
          event_date: recovery?.event_date ?? sourceDate ?? generatedAt.slice(0, 10),
          available_at: recovery?.event_date ?? sourceDate ?? generatedAt.slice(0, 10),
          event_title: item.page_title ?? item.title,
          event_summary: quote,
          event_type: recovery ? 'HISTORICAL_REACQUIRED_SOURCE' : 'RETRIEVED_SOURCE_EXCERPT',
          source_name: sourceName(item.url),
          source_url: item.url,
          source_type: sourceType(item.source_class),
          evidence_strength: 'E1',
          affected_layer: ['reality'],
          stage_effect: (recovery?.branch_id ?? item.branch_id) ? 'split_branch' : 'maintain',
          polarity: 'neutral',
          interpretation: recoveredVerified
            ? 'A historical primary source was re-acquired and independently corroborated. It is eligible for the existing governed admission policy, not a direct Stage conclusion.'
            : verifiedCurrentSource
              ? 'A dated, citation-ready original source was retrieved from a governed discovery lead. It is eligible for the existing policy evaluation, not a direct Stage conclusion.'
            : 'A citation-ready source excerpt is available for research review; it does not itself establish a lifecycle stage.',
          limitation: recoveredVerified
            ? `Independent corroborating URLs: ${recovery!.corroborating_source_urls.join(', ')}. This E1 source record cannot by itself establish a lifecycle stage; Stage Gate and duplicate checks remain authoritative.`
            : 'The retrieval package does not independently establish the original publication date or cross-source corroboration. It remains review-only until date, Topic/Branch scope, and Evidence Gate checks pass.',
          confidence: recoveredVerified || verifiedCurrentSource ? 'medium' : 'low',
        },
        suggested_reason: recoveredVerified ? 'Historical source was re-acquired with two independent, citation-ready source hosts; advance into the existing Agent and policy gates.' : verifiedCurrentSource ? 'Dated citation-ready primary source from a governed discovery lead; advance into the existing Agent and policy gates.' : 'Automatically advanced from a citation-ready original-page package; retained as a review candidate.',
        uncertainty_notes: [recoveredVerified ? 'The Agent receives bounded excerpts from the corroborating source for fact comparison. Cross-source corroboration is a provenance gate, not an E2/E3/E4 upgrade or a Stage conclusion.' : verifiedCurrentSource ? 'Publication date comes from the governed discovery lead; the Evidence Gate, Topic/Branch resolver and duplicate detection still apply.' : 'Retrieved source packages never bypass date confirmation, duplicate detection, Topic/Branch resolution, or the Evidence Gate.'],
        field_explanations: { event_date: recovery?.event_date ? 'Retains the legacy event date; original source text was re-acquired.' : sourceDate ? 'Retains the publication date supplied by the governed discovery lead.' : 'Uses retrieval date as a placeholder and requires operator confirmation.', evidence_strength: 'E1 because even two-source provenance recovery does not by itself establish a higher Evidence strength.', affected_layer: 'Reality is a review hypothesis, not a Stage conclusion.' },
        e_strength_rationale: 'The re-acquired primary source remains E1; cross-source corroboration authorizes policy evaluation, not evidence-strength inflation.',
        temporal_provenance: { event_date_source: recovery?.event_date || sourceDate ? 'source_metadata' : 'ingested_at', available_at_source: recovery?.event_date || sourceDate ? 'source_metadata' : 'ingested_at', requires_operator_confirmation: !(recoveredVerified || verifiedCurrentSource) },
        publication_eligibility: recoveredVerified || verifiedCurrentSource ? 'rule_verified' : 'manual_review',
        duplicate_of_evidence_id: recovery?.legacy_evidence_id ?? (this.deps.existingEvidenceIds().has(evidenceId) ? evidenceId : null),
        guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
      };
      this.deps.validateCandidate(candidate);
      session.candidates.push(candidate);
      candidatesByUrl.set(item.url, candidate);
    }
    session.review_template = reviewTemplate(session.candidates);
    this.deps.validateSession(session);
    this.deps.writeIntakeSession(session);
    // Curated research packs may intentionally carry a proposed, not yet
    // registrable taxonomy. Preserve those candidates for review without
    // turning the act of retrieval into a Topic Registry mutation.
    if (options.resolveTopics !== false) this.deps.resolveTopics(session);
    return session;
  }
}

function emptySession(generatedAt: string): EvidenceIntakeSession {
  const id = `raw_retrieved_source_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
  return {
    session_id: `intake_retrieved_source_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: generatedAt,
    raw_document: { raw_document_id: id, source_name: 'Citation-ready original-source research queue', source_kind: 'pasted_text', ingested_at: generatedAt, text: '', character_count: 0 },
    chunks: [], provenance_records: [], candidates: [], review_template: [],
  };
}

function sourceName(url: string): string { try { return new URL(url).hostname; } catch { return 'Retrieved original source'; } }
function sourceType(value: string): 'official' | 'academic' | 'company' | 'research' {
  if (value === 'official') return 'official';
  if (value === 'academic') return 'academic';
  if (value === 'company_primary') return 'company';
  return 'research';
}
function stableId(value: string): string { let hash = 5381; for (const char of value) hash = ((hash << 5) + hash) ^ char.codePointAt(0)!; return (hash >>> 0).toString(36); }
function safeId(value: string): string { return value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 72) || 'unresolved'; }
function dateOnly(value: string | null | undefined): string | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString().slice(0, 10);
}
