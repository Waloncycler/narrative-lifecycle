import type { EvidenceNode } from './evidence';
import type { EvidenceIntakeSession } from '../types/intake';
import type { EvidenceChainEntry, EvidenceChainRelation } from '../types/evidence_chain';
import type { TopicResolutionAudit } from '../types/topic_resolution';
import type { AgentEvidenceCandidate } from '../types/intake_agent';

export function buildEvidenceChainEntries(input: {
  session: EvidenceIntakeSession;
  audit: TopicResolutionAudit | null;
  existingEvidence: EvidenceNode[];
  generatedAt: string;
  producerVersion?: string;
  runId?: string | null;
  agentCandidates?: AgentEvidenceCandidate[];
  autoConfirm?: boolean;
}): EvidenceChainEntry[] {
  if (!input.audit) return [];
  const autoConfirm = input.autoConfirm ?? false;
  const resolutions = new Map(input.audit.resolutions.map((item) => [item.candidate_id, item]));
  const existingByTopic = new Map<string, string[]>();
  const existingEvidenceIds = new Set(input.existingEvidence.map((evidence) => evidence.evidence_id));
  const agentBySource = new Map((input.agentCandidates ?? []).map((candidate) => [candidate.source_candidate_id, candidate]));
  for (const evidence of input.existingEvidence) {
    const key = `${evidence.topic_id}:${evidence.branch_id ?? 'parent'}`;
    const values = existingByTopic.get(key) ?? [];
    values.push(evidence.evidence_id);
    existingByTopic.set(key, values);
  }
  return input.session.candidates.flatMap((candidate) => {
    const resolution = resolutions.get(candidate.candidate_id);
    const evidence = candidate.suggested_evidence;
    if (!resolution || resolution.status === 'unresolved') return [];
    const topicId = resolution.resolved_topic_id ?? resolution.provisional_topic_id ?? evidence.topic_id;
    if (!topicId || topicId === 'unknown_topic') return [];
    const branchId = resolution.resolved_branch_id ?? evidence.branch_id ?? null;
    const scope = branchId ? 'branch' : evidence.scope;
    const key = `${topicId}:${branchId ?? 'parent'}`;
    const priorEvidenceIds = (existingByTopic.get(key) ?? []).slice(-5);
    const agentCandidate = agentBySource.get(candidate.candidate_id);
    const relation = relationFor(candidate, priorEvidenceIds, agentCandidate?.chain_relation);
    const groundedTargetIds = (agentCandidate?.target_evidence_ids ?? []).filter((evidenceId) => existingEvidenceIds.has(evidenceId));
    const idempotencyKey = `${candidate.raw_document_id}:${candidate.provenance_id}:${evidence.evidence_id}:${topicId}:${branchId ?? 'parent'}`;
    return [{
      artifact_type: 'evidence_chain_entry',
      schema_version: '1.0.0',
      producer_version: input.producerVersion ?? 'v0.8.0',
      chain_entry_id: `chain_${candidate.candidate_id}`,
      generated_at: input.generatedAt,
      topic_id: topicId,
      branch_id: branchId,
      scope,
      evidence_id: evidence.evidence_id,
      source_candidate_id: candidate.candidate_id,
      provenance_id: candidate.provenance_id,
      relation,
      prior_evidence_ids: [...new Set([...groundedTargetIds, ...priorEvidenceIds])].slice(-5),
      affected_stage_gate: agentCandidate?.target_stage_gate ?? stageGateFor(evidence.affected_layer),
      why_not_higher_before: null,
      source_quote: candidate.original_quote,
      status: autoConfirm ? 'confirmed' : 'candidate',
      operator_decision: autoConfirm ? { reviewer: 'autonomous_agent', decided_at: input.generatedAt, note: 'Auto-confirmed by research agent policy' } : undefined,
      idempotency_key: idempotencyKey,
      run_id: input.runId ?? null,
    } satisfies EvidenceChainEntry];
  });
}

function relationFor(candidate: EvidenceIntakeSession['candidates'][number], priorEvidenceIds: string[], agentRelation?: EvidenceChainRelation): EvidenceChainRelation {
  if (agentRelation) return agentRelation;
  if (candidate.duplicate_of_evidence_id) return 'duplicates';
  if (candidate.suggested_evidence.polarity === 'negative' || ['downgrade'].includes(candidate.suggested_evidence.stage_effect)) return 'contradicts';
  if (candidate.suggested_evidence.stage_effect === 'split_branch' || candidate.suggested_evidence.scope === 'branch') return 'branch_only';
  if (priorEvidenceIds.length) return 'updates';
  return candidate.suggested_evidence.affected_layer.includes('reality') ? 'fills_gap' : 'supports';
}

function stageGateFor(layers: string[]): string | null {
  if (layers.includes('reality')) return 'reality_validation';
  if (layers.includes('pricing')) return 'pricing_adoption';
  if (layers.includes('capital')) return 'capital_confirmation';
  if (layers.includes('name')) return 'stable_label';
  return null;
}
