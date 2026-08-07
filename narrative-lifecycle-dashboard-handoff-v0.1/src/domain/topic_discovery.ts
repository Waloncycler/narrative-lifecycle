import type { EvidenceIntakeSession } from '../types/intake';
import type { TopicDiscoveryProposal, TopicDiscoveryKind } from '../types/topic_discovery';
import type { TopicRegistry, TopicResolutionAudit, TopicResolution } from '../types/topic_resolution';

export function buildTopicDiscoveryProposals(input: {
  session: EvidenceIntakeSession;
  audit: TopicResolutionAudit | null;
  registry: TopicRegistry;
  generatedAt: string;
  producerVersion?: string;
}): TopicDiscoveryProposal[] {
  if (!input.audit) return [];
  const candidates = new Map(input.session.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  return input.audit.resolutions
    .filter((resolution) => resolution.status !== 'existing_topic')
    .map((resolution) => {
      const candidate = candidates.get(resolution.candidate_id);
      const evidence = candidate?.suggested_evidence;
      const topic = resolution.resolved_topic_id
        ? input.registry.canonical_topics.find((item) => item.topic_id === resolution.resolved_topic_id)
        : null;
      const kind = discoveryKind(resolution.status);
      const proposedTopicId = resolution.provisional_topic_id ?? resolution.resolved_topic_id ?? evidence?.topic_id ?? null;
      const proposedBranchId = resolution.resolved_branch_id ?? evidence?.branch_id ?? null;
      return {
        artifact_type: 'topic_discovery_proposal',
        schema_version: '1.0.0',
        producer_version: input.producerVersion ?? 'v0.8.0',
        proposal_id: `topic_proposal_${resolution.candidate_id}`,
        generated_at: input.generatedAt,
        session_id: input.session.session_id,
        kind,
        status: 'pending',
        proposed_topic_id: proposedTopicId,
        proposed_topic_name: proposedTopicId ? topic?.topic_name ?? humanize(proposedTopicId.replace(/^provisional_/, '')) : null,
        parent_topic_id: resolution.resolved_topic_id ?? (kind === 'new_branch' ? evidence?.topic_id ?? null : null),
        proposed_branch_id: proposedBranchId,
        proposed_branch_name: proposedBranchId ? humanize(proposedBranchId) : null,
        confidence: resolution.confidence,
        reason: resolution.reason,
        uncertainty_notes: candidate?.uncertainty_notes ?? ['需要研究者确认主题归属。'],
        alternatives: resolution.alternatives.map((alternative) => ({
          topic_id: alternative.topic_id ?? null,
          branch_id: alternative.branch_id ?? null,
          status: alternative.status,
          reason: alternative.reason,
        })),
        narrative_memory_match: kind === 'reactivation',
        evidence_refs: candidate ? [{
          candidate_id: candidate.candidate_id,
          quote: candidate.original_quote,
          provenance_id: candidate.provenance_id,
          evidence_id: candidate.suggested_evidence.evidence_id ?? null,
        }] : [],
        audit_required: true,
      } satisfies TopicDiscoveryProposal;
    });
}

export function topicDiscoveryProposalFor(resolutions: TopicResolution[], candidateId: string): TopicResolution | null {
  return resolutions.find((resolution) => resolution.candidate_id === candidateId) ?? null;
}

function humanize(value: string): string {
  return value.replace(/^provisional_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function discoveryKind(status: string): TopicDiscoveryKind {
  return status === 'new_provisional_topic' ? 'new_topic' : status as TopicDiscoveryKind;
}
