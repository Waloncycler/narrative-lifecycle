import { describe, expect, it } from 'vitest';
import { ReviewIntelligenceProposalUseCase } from '../src/application/use_cases/intelligence_review_use_case';
import type { EvidenceChainEntry } from '../src/types/evidence_chain';
import type { TopicDiscoveryProposal } from '../src/types/topic_discovery';

const proposal: TopicDiscoveryProposal = {
  artifact_type: 'topic_discovery_proposal', schema_version: '1.0.0', producer_version: 'v0.8.0', proposal_id: 'proposal_1', generated_at: '2026-08-03T00:00:00.000Z', session_id: 'session_1', kind: 'new_topic', status: 'pending', proposed_topic_id: 'provisional_quantum', proposed_topic_name: 'Quantum', parent_topic_id: null, proposed_branch_id: null, proposed_branch_name: null, confidence: 'medium', reason: 'new direction', uncertainty_notes: ['review'], alternatives: [], narrative_memory_match: false, evidence_refs: [], audit_required: true,
};

const chain: EvidenceChainEntry = {
  artifact_type: 'evidence_chain_entry', schema_version: '1.0.0', producer_version: 'v0.8.0', chain_entry_id: 'chain_1', generated_at: '2026-08-03T00:00:00.000Z', topic_id: 'bci', branch_id: 'rehab', scope: 'branch', evidence_id: 'ev_1', source_candidate_id: 'candidate_1', provenance_id: 'prov_1', relation: 'branch_only', prior_evidence_ids: [], affected_stage_gate: 'reality_validation', why_not_higher_before: null, source_quote: 'quoted fact', status: 'candidate', idempotency_key: 'key_1', run_id: null,
};

describe('intelligence proposal review', () => {
  it('records human decisions without activating topics or changing stages', () => {
    let topics = [proposal];
    let entries = [chain];
    const useCase = new ReviewIntelligenceProposalUseCase({
      readTopicProposals: () => topics,
      readEvidenceChain: () => entries,
      writeTopicProposals: (value) => { topics = value; },
      writeEvidenceChain: (value) => { entries = value; },
      now: () => '2026-08-03T00:01:00.000Z',
    });
    const result = useCase.execute({ proposalId: 'proposal_1', chainEntryId: 'chain_1', decision: 'accepted', reviewer: 'researcher' });
    expect(result.topic_proposals[0]).toMatchObject({ status: 'accepted', proposed_topic_id: 'provisional_quantum' });
    expect(result.evidence_chain[0]).toMatchObject({ status: 'confirmed', scope: 'branch', branch_id: 'rehab' });
  });

  it('rejects automated reviewers', () => {
    const useCase = new ReviewIntelligenceProposalUseCase({ readTopicProposals: () => [proposal], readEvidenceChain: () => [], writeTopicProposals: () => undefined, writeEvidenceChain: () => undefined, now: () => '2026-08-03T00:01:00.000Z' });
    expect(() => useCase.execute({ proposalId: 'proposal_1', decision: 'accepted', reviewer: 'auto_agent' })).toThrow(/human reviewer/);
  });
});
