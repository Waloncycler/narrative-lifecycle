import { buildAgentVerificationReport, mergeAgentOnlyCandidates } from '@/domain/intake_agent_rules';
import { reviewTemplate } from '@/domain/intake_rules';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/types/intake';
import type { IntakeAgentAudit, IntakeAgentReviewBundle, AgentEvidenceCandidate } from '@/types/intake_agent';
import type { IndustryPack } from '@/types/industry';
import type { IntakeLearningProfile } from '@/types/intake_learning';
import type { TopicRegistry } from '@/types/topic_resolution';
import type { EvidenceNode } from '@/domain/evidence';
import type { TopicDiscoveryProposal } from '@/types/topic_discovery';
import type { EvidenceChainEntry } from '@/types/evidence_chain';
import type { StageDiff } from '@/types/diff';
import { buildTopicDiscoveryProposals } from '@/domain/topic_discovery';
import { buildEvidenceChainEntries } from '@/domain/evidence_chain';
import { applyNarrativeDiscoveryMappings, discoverNarrativeGraph } from '@/domain/narrative_discovery';
import type { NarrativeDiscoveryRecord, NarrativeDiscoveryReport } from '@/types/narrative_discovery';

export interface RunIntakeAgentUseCaseDeps {
  prepare(input: { file?: string; text?: string }): EvidenceIntakeSession;
  readLatest(): EvidenceIntakeSession;
  readIndustryPacks(): IndustryPack[];
  readLearningProfile(): IntakeLearningProfile | null;
  readTopicRegistry(): TopicRegistry;
  readTopicResolutionAudit(): import('../../types/topic_resolution').TopicResolutionAudit | null;
  readEvidenceNodes(): EvidenceNode[];
  readDiff?(): StageDiff | null;
  generate(session: EvidenceIntakeSession, industryPacks?: IndustryPack[], learningProfile?: IntakeLearningProfile | null, topicRegistry?: TopicRegistry | null, evidenceNodes?: EvidenceNode[], diff?: StageDiff | null): Promise<{ candidates: AgentEvidenceCandidate[]; audit: IntakeAgentAudit }>;
  writeTopicDiscoveryProposals(proposals: TopicDiscoveryProposal[]): void;
  writeEvidenceChain(entries: EvidenceChainEntry[]): void;
  readNarrativeDiscoveryRecords(): NarrativeDiscoveryRecord[];
  writeNarrativeDiscovery(report: NarrativeDiscoveryReport): void;
  writeSession(session: EvidenceIntakeSession): void;
  resolveTopics(session: EvidenceIntakeSession, discovery?: NarrativeDiscoveryReport): void;
  write(session: EvidenceIntakeSession, bundle: IntakeAgentReviewBundle): void;
  validateCandidate(candidate: unknown): void;
  validateVerification(report: unknown): void;
  validateNarrativeDiscovery(report: unknown): void;
  now(): string;
}

export class RunIntakeAgentUseCase {
  constructor(private readonly deps: RunIntakeAgentUseCaseDeps) {}

  async execute(input: { file?: string; text?: string }): Promise<IntakeAgentReviewBundle> {
    return this.run(this.deps.prepare(input));
  }

  async executeLatest(): Promise<IntakeAgentReviewBundle> {
    return this.run(this.deps.readLatest());
  }

  private async run(session: EvidenceIntakeSession): Promise<IntakeAgentReviewBundle> {
    const generated = await this.deps.generate(session, this.deps.readIndustryPacks(), this.deps.readLearningProfile(), this.deps.readTopicRegistry(), this.deps.readEvidenceNodes(), this.deps.readDiff?.() ?? null);
    const rulesByCandidateId = new Map(session.candidates.map((candidate) => [candidate.candidate_id, candidate]));
    // A provider may offer a useful fact split or limitation, but it must not
    // overwrite source-derived identity, provenance or evidence strength for
    // a rule-verified primary/official source. This prevents incidental words
    // in a trial title from relabelling the formal Evidence Table.
    const candidates = generated.candidates.flatMap((candidate) => {
      const rule = rulesByCandidateId.get(candidate.source_candidate_id);
      const normalized = rule ? constrainSourceAnchoredCandidate(candidate, rule) : candidate;
      if (rule && requiresRuleFallback(normalized, rule, session)) {
        return [fallbackToRuleCandidate(normalized, rule, session, 'malformed_model_candidate')];
      }
      // A model-only fact has no deterministic source candidate to restore.
      // Do not let malformed output reach the Evidence Candidate schema or
      // the review queue without a verifiable citation.
      return isCitationComplete(normalized, session) ? [normalized] : [];
    });
    const result = {
      ...generated,
      candidates,
    };
    session.candidates = mergeAgentOnlyCandidates(session.candidates, result.candidates);
    // Apply the agent's topic/branch analysis onto matched rule candidates so
    // topic resolution uses the model's mapping instead of the rule draft's
    // unknown_topic placeholder.
    const passedModelBySourceId = new Map(
      result.candidates
        .filter((candidate) => !candidate.fallback_used && candidate.validation_status === 'passed' && candidate.source_candidate_id)
        .map((candidate) => [candidate.source_candidate_id, candidate]),
    );
    session.candidates = session.candidates.map((candidate) => {
      const model = passedModelBySourceId.get(candidate.candidate_id);
      if (!model) return candidate;
      return { ...candidate, suggested_evidence: model.suggested_evidence, suggested_reason: model.suggested_reason };
    });
    // Refresh the auto-accept review template so the merged agent-only
    // candidates are covered by apply instead of the stale sync-time template
    // (which only saw the raw rule drafts).
    const discovery = discoverNarrativeGraph({
      session,
      registry: this.deps.readTopicRegistry(),
      priorRecords: this.deps.readNarrativeDiscoveryRecords(),
      generatedAt: this.deps.now(),
    });
    this.deps.validateNarrativeDiscovery(discovery);
    session = applyNarrativeDiscoveryMappings(session, discovery);
    this.deps.writeNarrativeDiscovery(discovery);
    session.review_template = reviewTemplate(session.candidates);
    this.deps.writeSession(session);
    // Re-resolve topics after the agent enriched the candidates: the sync-time
    // audit only saw raw rule drafts (unknown_topic), so the model's proposed
    // topics/branches must be re-registered and the audit rebuilt before import.
    this.deps.resolveTopics(session, discovery);
    const topicAudit = this.deps.readTopicResolutionAudit();
    this.deps.writeTopicDiscoveryProposals(buildTopicDiscoveryProposals({
      session,
      audit: topicAudit,
      registry: this.deps.readTopicRegistry(),
      generatedAt: this.deps.now(),
    }));
    this.deps.writeEvidenceChain(buildEvidenceChainEntries({
      session,
      audit: topicAudit,
      existingEvidence: this.deps.readEvidenceNodes(),
      generatedAt: this.deps.now(),
      agentCandidates: result.candidates,
      autoConfirm: true,
    }));
    for (const candidate of result.candidates) this.deps.validateCandidate(candidate);
    const verification = buildAgentVerificationReport({ generatedAt: this.deps.now(), session, candidates: result.candidates });
    this.deps.validateVerification(verification);
    const bundle: IntakeAgentReviewBundle = {
      agent_version: 'v0.7.0',
      generated_at: this.deps.now(),
      session_id: session.session_id,
      candidates: result.candidates,
      verification,
      audit: result.audit,
      import_permission: 'human_review_then_existing_import_only',
    };
    this.deps.write(session, bundle);
    return bundle;
  }
}

export function constrainSourceAnchoredCandidate(
  candidate: AgentEvidenceCandidate,
  rule: EvidenceIntakeSession['candidates'][number],
): AgentEvidenceCandidate {
  const source = rule.suggested_evidence;
  const mustRetainSourceIdentity = rule.publication_eligibility === 'rule_verified'
    || source.event_type === 'DIRECT_SOURCE_RECORD';
  if (!mustRetainSourceIdentity) return candidate;
  // Source facts and E-strength remain parser-owned. A source-grounded branch
  // hypothesis may survive only under the source-planned parent. It is never
  // treated as parent evidence or as a Stage decision here. In particular, a
  // research seed must not be remapped by incidental words in an API summary.
  const topicId = source.topic_id === 'unknown_topic' ? candidate.suggested_evidence.topic_id : source.topic_id;
  const branchId = candidate.suggested_evidence.topic_id === topicId
    ? candidate.suggested_evidence.branch_id
    : source.branch_id;
  return {
    ...candidate,
    suggested_evidence: {
      ...candidate.suggested_evidence,
      evidence_id: source.evidence_id,
      topic_id: topicId,
      branch_id: branchId,
      scope: branchId ? 'branch' : source.scope,
      event_date: source.event_date,
      available_at: source.available_at,
      event_title: source.event_title,
      event_summary: source.event_summary,
      event_type: source.event_type,
      source_name: source.source_name,
      source_url: source.source_url,
      source_type: source.source_type,
      evidence_strength: source.evidence_strength,
      affected_layer: source.affected_layer,
      stage_effect: branchId ? 'split_branch' : source.stage_effect,
      polarity: source.polarity,
      interpretation: source.interpretation,
      limitation: branchId ? `${source.limitation} Branch mapping remains a separate reviewable graph proposal and cannot upgrade the parent narrative.` : source.limitation,
      confidence: source.confidence,
    },
    suggested_reason: `${candidate.suggested_reason} Deterministic source mapping retained.`,
  };
}

function requiresRuleFallback(
  candidate: AgentEvidenceCandidate,
  rule: EvidenceCandidate,
  session: EvidenceIntakeSession,
): boolean {
  if (!isCitationComplete(candidate, session)
    || !candidate.supported_fact.trim()
    || !candidate.inferred_interpretation.trim()
    || candidate.supported_fact === candidate.inferred_interpretation
    || !candidate.limitation.trim()
    || !candidate.suggested_reason.trim()) return true;
  const sourceAnchored = rule.publication_eligibility === 'rule_verified'
    || rule.suggested_evidence.event_type === 'DIRECT_SOURCE_RECORD';
  return sourceAnchored && candidate.original_quote !== rule.original_quote;
}

function isCitationComplete(candidate: AgentEvidenceCandidate, session: EvidenceIntakeSession): boolean {
  return Boolean(candidate.original_quote.trim())
    && candidate.quote_start_offset >= 0
    && candidate.quote_end_offset > candidate.quote_start_offset
    && session.raw_document.text.slice(candidate.quote_start_offset, candidate.quote_end_offset) === candidate.original_quote;
}

function fallbackToRuleCandidate(
  candidate: AgentEvidenceCandidate,
  rule: EvidenceCandidate,
  session: EvidenceIntakeSession,
  reason: string,
): AgentEvidenceCandidate {
  const provenance = session.provenance_records.find((item) => item.provenance_id === rule.provenance_id);
  const quoteStart = provenance?.quote_start_offset ?? Math.max(0, session.raw_document.text.indexOf(rule.original_quote));
  const quoteEnd = provenance?.quote_end_offset ?? quoteStart + rule.original_quote.length;
  return {
    ...candidate,
    agent_candidate_id: candidate.agent_candidate_id || `agent_${rule.candidate_id}`,
    source_candidate_id: rule.candidate_id,
    raw_document_id: rule.raw_document_id,
    chunk_id: rule.chunk_id,
    provenance_id: rule.provenance_id,
    original_quote: rule.original_quote,
    quote_start_offset: quoteStart,
    quote_end_offset: quoteEnd,
    supported_fact: rule.original_quote,
    inferred_interpretation: rule.suggested_evidence.interpretation,
    limitation: rule.suggested_evidence.limitation,
    suggested_evidence: rule.suggested_evidence,
    suggested_reason: `Rule-based fallback: ${reason}`,
    uncertainty_notes: [...new Set([...rule.uncertainty_notes, 'Model output was incomplete; the deterministic candidate is retained for human review.'])],
    alternative_mappings: [{
      topic_id: rule.suggested_evidence.topic_id,
      branch_id: rule.suggested_evidence.branch_id ?? null,
      scope: rule.suggested_evidence.scope,
      reason: 'Rule-based fallback mapping.',
    }],
    validation_status: 'fallback',
    validation_errors: [...new Set([...candidate.validation_errors, reason])],
    fallback_used: true,
    human_review_required: true,
  };
}
