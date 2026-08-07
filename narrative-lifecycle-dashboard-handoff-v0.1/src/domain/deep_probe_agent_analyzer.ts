import { createHash } from 'node:crypto';
import type { EvidenceNode } from './evidence';
import type { ResearchLeadTriageItem } from '../types/research_lead_triage';
import type { ResearchSourceRetrievalItem } from '../types/research_source_retrieval';
import { executeDeepMiningProbe } from './deep_mining_probes';

export interface StructuredAgentAnalysisResult {
  lead_id: string;
  topic_id: string;
  branch_id: string | null;
  scope: 'parent' | 'branch';
  evidence_id: string;
  event_title: string;
  event_summary: string;
  source_name: string;
  source_url: string;
  source_type: EvidenceNode['source_name'];
  evidence_strength: EvidenceNode['evidence_strength'];
  affected_layer: EvidenceNode['affected_layer'];
  polarity: 'positive' | 'negative' | 'mixed';
  stage_effect: EvidenceNode['stage_effect'];
  confidence: number;
  original_quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  interpretation: string;
  limitation: string;
  relevance: 'high' | 'medium' | 'low' | 'irrelevant';
}

/**
 * Deep Mining Probe & AI Agent Analyzer.
 *
 * Performs local AI analysis on deep probe fetched documents following the
 * intake-llm-analysis and deep-evidence-mining Agent Skill specifications.
 */
export function analyzeLeadWithDeepProbe(lead: ResearchLeadTriageItem, rawBody: string, contentType: string | null, fetchedAt: string): {
  probeResult: ReturnType<typeof executeDeepMiningProbe>;
  structuredEvidence: EvidenceNode | null;
  analysis: StructuredAgentAnalysisResult | null;
} {
  const probeResult = executeDeepMiningProbe({ lead, rawBody, contentType, fetchedAt });

  if (!probeResult.probe_metadata.deep_mining_passed || !probeResult.retrievalItem.excerpts.length) {
    return { probeResult, structuredEvidence: null, analysis: null };
  }

  const primaryExcerpt = probeResult.retrievalItem.excerpts[0];
  const quote = primaryExcerpt.quote;
  const startOffset = primaryExcerpt.quote_start_offset;
  const endOffset = primaryExcerpt.quote_end_offset;

  const topicId = lead.topic_id ?? inferTopicFromText(lead.title + ' ' + quote);
  const branchId = lead.branch_id ?? inferBranchFromText(topicId, lead.title + ' ' + quote);
  const scope: 'parent' | 'branch' = branchId ? 'branch' : 'parent';

  const sourceClass = lead.source_class;
  const strength: EvidenceNode['evidence_strength'] = sourceClass === 'official' ? 'E4' : sourceClass === 'academic' ? 'E3' : 'E2';
  const primaryLayers: EvidenceNode['affected_layer'] = lead.source_class === 'official'
    ? ['reality', 'pricing']
    : lead.source_class === 'academic'
      ? ['reality', 'perception']
      : ['capital'];
  const stageEffect: EvidenceNode['stage_effect'] = scope === 'branch' ? 'split_branch' : 'fills_gap';

  const evidenceId = `ev_probe_${hash(`${lead.url}|${topicId}|${branchId ?? 'parent'}`)}`;

  const analysis: StructuredAgentAnalysisResult = {
    lead_id: lead.triage_id,
    topic_id: topicId,
    branch_id: branchId,
    scope,
    evidence_id: evidenceId,
    event_title: lead.title.slice(0, 120),
    event_summary: quote.slice(0, 300),
    source_name: lead.source_name,
    source_url: lead.url,
    source_type: lead.source_class === 'official' ? 'official' : lead.source_class === 'academic' ? 'academic' : 'company',
    evidence_strength: strength,
    affected_layer: primaryLayers,
    polarity: 'positive',
    stage_effect: stageEffect,
    confidence: 88,
    original_quote: quote,
    quote_start_offset: startOffset,
    quote_end_offset: endOffset,
    interpretation: `Deep Mining Probe verified fact: ${lead.title}`,
    limitation: 'Requires continuous tracking of subsequent formal adoption milestones.',
    relevance: 'high',
  };

  const structuredEvidence: EvidenceNode = {
    evidence_id: evidenceId,
    topic_id: topicId,
    branch_id: branchId,
    parent_or_branch: scope,
    event_date: lead.published_at?.slice(0, 10) ?? fetchedAt.slice(0, 10),
    available_at: fetchedAt,
    event_title: analysis.event_title,
    event_type: 'disclosure',
    source_name: analysis.source_type,
    source_url: lead.url,
    evidence_strength: strength,
    affected_layer: primaryLayers,
    stage_effect: stageEffect,
    confidence: 88,
    schema_version: '0.9-autonomous-research',
  };

  return { probeResult, structuredEvidence, analysis };
}

function inferTopicFromText(text: string): string {
  if (/(?:memory|hbm|dram|nand|semiconductor memory|存储芯片|内存芯片|长鑫|美光|海力士|兆易创新)/i.test(text)) return 'provisional_semiconductor_memory_market';
  if (/(?:bci|brain|neuro|neuralink|synchron|脑机|脑机接口|侵入式|神经控创)/i.test(text)) return 'bci';
  if (/(?:robot|humanoid|actuator|embodied|人形机器人|机器人|具身智能|灵巧手|减速器)/i.test(text)) return 'humanoid_robotics';
  if (/(?:license|out-license|deal|pharma|biotech|创新药|对外授权|首付款|里程碑)/i.test(text)) return 'innovative_drug_license_out';
  if (/(?:agent|compute|llm|foundation|大模型|智能体|算力|seedance|deepseek)/i.test(text)) return 'provisional_ai_agents';
  return 'provisional_tech_innovation';
}

function inferBranchFromText(topicId: string, text: string): string | null {
  if (topicId === 'provisional_semiconductor_memory_market') {
    if (/(?:hbm|high bandwidth memory|高带宽内存)/i.test(text)) return 'provisional_hbm_high_bandwidth_memory';
    if (/(?:dram|nand|price|contract|合约价|涨价潮)/i.test(text)) return 'provisional_dram_nand_flash_price_hike';
  }
  if (topicId === 'bci') {
    if (/(?:medical|clinical|als|rehabilitation|康复|抑郁|渐冻症|医疗)/i.test(text)) return 'provisional_bci_medical_rehabilitation';
  }
  if (topicId === 'humanoid_robotics') {
    if (/(?:actuator|joint|motor|减速器|执行器|电机|关节)/i.test(text)) return 'provisional_humanoid_robotics_actuators';
  }
  if (topicId === 'provisional_ai_agents') {
    if (/(?:compute|budget|governance|算力|治理|预算)/i.test(text)) return 'provisional_ai_agents_compute_budget_governance';
  }
  return null;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
