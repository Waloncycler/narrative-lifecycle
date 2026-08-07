import type { EvidenceChainEntry } from '../../types/evidence_chain';
import type { TopicDiscoveryProposal } from '../../types/topic_discovery';

export type IntelligenceReviewDecision = 'accepted' | 'rejected' | 'deferred';

export interface IntelligenceReviewUseCaseDeps {
  readTopicProposals(): TopicDiscoveryProposal[];
  readEvidenceChain(): EvidenceChainEntry[];
  writeTopicProposals(proposals: TopicDiscoveryProposal[]): void;
  writeEvidenceChain(entries: EvidenceChainEntry[]): void;
  now(): string;
}

export class ReviewIntelligenceProposalUseCase {
  constructor(private readonly deps: IntelligenceReviewUseCaseDeps) {}

  execute(input: { proposalId?: string; chainEntryId?: string; decision: IntelligenceReviewDecision; reviewer: string; note?: string }): { topic_proposals: TopicDiscoveryProposal[]; evidence_chain: EvidenceChainEntry[] } {
    if (!input.reviewer.trim() || input.reviewer === 'auto_agent') throw new Error('human reviewer is required');
    if (!input.proposalId && !input.chainEntryId) throw new Error('proposal_id or chain_entry_id is required');
    const decidedAt = this.deps.now();
    const topicProposals = this.deps.readTopicProposals();
    const evidenceChain = this.deps.readEvidenceChain();
    let changed = false;
    const updatedProposals = topicProposals.map((proposal) => {
      if (proposal.proposal_id !== input.proposalId) return proposal;
      changed = true;
      return {
        ...proposal,
        status: input.decision === 'accepted' ? 'accepted' : input.decision === 'rejected' ? 'rejected' : 'deferred',
        operator_decision: { reviewer: input.reviewer, decided_at: decidedAt, note: input.note },
      } satisfies TopicDiscoveryProposal;
    });
    const updatedChain = evidenceChain.map((entry) => {
      if (entry.chain_entry_id !== input.chainEntryId) return entry;
      changed = true;
      return {
        ...entry,
        status: input.decision === 'accepted' ? 'confirmed' : input.decision === 'rejected' ? 'rejected' : 'candidate',
        operator_decision: { reviewer: input.reviewer, decided_at: decidedAt, note: input.note },
      } satisfies EvidenceChainEntry;
    });
    if (!changed) throw new Error('proposal or chain entry not found');
    if (input.proposalId) this.deps.writeTopicProposals(updatedProposals);
    if (input.chainEntryId) this.deps.writeEvidenceChain(updatedChain);
    return { topic_proposals: updatedProposals, evidence_chain: updatedChain };
  }
}
