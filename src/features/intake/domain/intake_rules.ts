import type { EvidenceImportDraft } from '@/features/evidence/types/evidence_import';
import type { DocumentChunk, EvidenceCandidate, ProvenanceRecord, RawDocument, ReviewDecision } from '@/features/intake/types/intake';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

const forbiddenAdvicePattern = /\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b|买入|卖出|加仓|减仓|持仓|目标价|止损|做多|做空/i;

export function noTradingAdvice(value: unknown): boolean {
  const text = JSON.stringify(value)
    // A research-only disclaimer is not an instruction. Keep this exception
    // narrow so phrases such as "do not buy" still remain visible to review.
    .replace(/\b(?:this|it|content|research|analysis)\s+(?:is\s+)?not\s+(?:a\s+)?(?:buy\s+or\s+sell|trading|investment)\s+advice\b/gi, '')
    .replace(/不构成(?:买卖|投资|交易)建议/g, '');
  return !forbiddenAdvicePattern.test(text);
}

export function convertRetrievalToRawDocuments(report: ResearchSourceRetrievalReport): RawDocument[] {
  return report.items
    .filter((item) => item.status === 'retrieved' && item.citation_status === 'ready')
    .map((item) => {
      const text = item.excerpts.map((e) => e.quote).join('\n\n');
      return {
        raw_document_id: item.retrieval_id,
        source_name: item.url,
        source_kind: 'html',
        ingested_at: item.fetched_at,
        text,
        character_count: text.length,
      };
    });
}

export function chunkRawDocument(document: RawDocument, maxChunkLength = 900): DocumentChunk[] {
  const paragraphs = document.text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: DocumentChunk[] = [];
  let searchOffset = 0;
  let current = '';
  let currentStart = 0;

  for (const paragraph of paragraphs) {
    const paragraphStart = document.text.indexOf(paragraph, searchOffset);
    searchOffset = paragraphStart + paragraph.length;

    const currentTopic = current ? inferTopic(current).topic_id : null;
    const paragraphTopic = inferTopic(paragraph).topic_id;
    const isTopicBoundary = Boolean(
      current &&
      currentTopic &&
      paragraphTopic &&
      currentTopic !== 'unknown_topic' &&
      paragraphTopic !== 'unknown_topic' &&
      currentTopic !== paragraphTopic
    );

    if (isTopicBoundary || (current && `${current}\n\n${paragraph}`.length > maxChunkLength)) {
      chunks.push(chunk(document.raw_document_id, chunks.length, current, currentStart));
      current = '';
    }

    if (paragraph.length > maxChunkLength * 1.5) {
      const sentences = splitSentences(paragraph);
      let sentenceOffset = 0;
      for (const sentence of sentences) {
        const sentenceStart = paragraph.indexOf(sentence, sentenceOffset);
        sentenceOffset = sentenceStart + sentence.length;
        if (sentence.length <= maxChunkLength) {
          chunks.push(chunk(document.raw_document_id, chunks.length, sentence, paragraphStart + Math.max(0, sentenceStart)));
        } else {
          for (let offset = 0; offset < sentence.length; offset += maxChunkLength) {
            const piece = sentence.slice(offset, offset + maxChunkLength);
            chunks.push(chunk(document.raw_document_id, chunks.length, piece, paragraphStart + Math.max(0, sentenceStart) + offset));
          }
        }
      }
      continue;
    }
    if (!current) currentStart = paragraphStart;
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (current) chunks.push(chunk(document.raw_document_id, chunks.length, current, currentStart));
  return chunks;
}

export function extractEvidenceCandidates(input: {
  rawDocument: RawDocument;
  chunks: DocumentChunk[];
  existingEvidenceIds?: Set<string>;
  generatedAt: string;
}): { candidates: EvidenceCandidate[]; provenance: ProvenanceRecord[] } {
  const provenance: ProvenanceRecord[] = [];
  const candidates = input.chunks.flatMap((chunkItem, index) => {
    const quote = selectQuote(chunkItem.text);
    if (!quote) return [];
    const quoteStart = chunkItem.text.indexOf(quote);
    const record: ProvenanceRecord = {
      provenance_id: `prov_${input.rawDocument.raw_document_id}_${index}`,
      raw_document_id: input.rawDocument.raw_document_id,
      chunk_id: chunkItem.chunk_id,
      quote,
      quote_start_offset: chunkItem.start_offset + Math.max(0, quoteStart),
      quote_end_offset: chunkItem.start_offset + Math.max(0, quoteStart) + quote.length,
      location_label: `chunk ${index + 1}`,
      extraction_reason: 'Selected the most evidence-like sentence in this chunk; human review required.',
    };
    provenance.push(record);
    return [candidateFromQuote({
      rawDocument: input.rawDocument,
      chunk: chunkItem,
      provenance: record,
      existingEvidenceIds: input.existingEvidenceIds ?? new Set(),
      generatedAt: input.generatedAt,
      index,
    })];
  });
  return { candidates, provenance };
}

export function reviewTemplate(_candidates: EvidenceCandidate[]): ReviewDecision[] {
  // A template represents unfinished work, never an implied approval. The UI
  // owns the operator's explicit accept/modify/reject/split decision.
  return [];
}

export function evidenceDraftsFromDecisions(input: {
  candidates: EvidenceCandidate[];
  decisions: ReviewDecision[];
  existingEvidenceIds: Set<string>;
}): {
  drafts: EvidenceImportDraft[];
  rejected: ReviewDecision[];
  duplicates: EvidenceImportDraft[];
  modified_count: number;
  split_count: number;
} {
  const candidates = new Map(input.candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const drafts: EvidenceImportDraft[] = [];
  const rejected: ReviewDecision[] = [];
  const duplicates: EvidenceImportDraft[] = [];
  let modified_count = 0;
  let split_count = 0;

  for (const decision of input.decisions) {
    const candidate = candidates.get(decision.candidate_id);
    if (!candidate) continue;
    if (decision.decision === 'reject') {
      rejected.push(decision);
      continue;
    }

    const proposed = decision.decision === 'modify'
      ? [decision.modified_evidence ?? candidate.suggested_evidence]
      : decision.decision === 'split'
        ? decision.split_evidence ?? []
        : [candidate.suggested_evidence];

    if (decision.decision === 'modify') modified_count += 1;
    if (decision.decision === 'split') split_count += proposed.length;

    for (const draft of proposed) {
      if (input.existingEvidenceIds.has(draft.evidence_id)) duplicates.push(draft);
      else drafts.push(draft);
    }
  }

  return { drafts, rejected, duplicates, modified_count, split_count };
}

/**
 * Rewrites accepted drafts with the topic resolution audit outcome so imported
 * evidence is attributed to a real topic/branch instead of "unknown_topic".
 * For new provisional topics the provisional_topic_id is used (the registry
 * stores it as the canonical id after registration); unresolved drafts are left
 * untouched so they remain visible in the queue.
 */
export function applyResolvedTopics(
  drafts: EvidenceImportDraft[],
  candidates: EvidenceCandidate[],
  audit: { resolutions: Array<{ candidate_id: string; status: string; resolved_topic_id: string | null; resolved_branch_id: string | null; provisional_topic_id: string | null }> },
): void {
  const resolutionByCandidate = new Map(audit.resolutions.map((item) => [item.candidate_id, item]));
  const candidateByEvidenceId = new Map(
    candidates.flatMap((candidate) => {
      const draftId = candidate.suggested_evidence.evidence_id;
      return draftId ? [[draftId, candidate] as const] : [];
    }),
  );
  for (const draft of drafts) {
    const candidate = candidateByEvidenceId.get(draft.evidence_id);
    if (!candidate) continue;
    const resolution = resolutionByCandidate.get(candidate.candidate_id);
    if (!resolution) continue;
    if (resolution.status === 'new_provisional_topic' && resolution.provisional_topic_id) {
      draft.topic_id = resolution.provisional_topic_id;
      draft.branch_id = null;
      continue;
    }
    if (resolution.resolved_topic_id && resolution.resolved_topic_id !== draft.topic_id) {
      draft.topic_id = resolution.resolved_topic_id;
      draft.branch_id = resolution.resolved_branch_id ?? draft.branch_id;
    }
  }
}

function chunk(rawDocumentId: string, index: number, text: string, start: number): DocumentChunk {
  return {
    chunk_id: `chunk_${rawDocumentId}_${index}`,
    raw_document_id: rawDocumentId,
    index,
    text,
    start_offset: start,
    end_offset: start + text.length,
  };
}

function selectQuote(text: string): string {
  const sentences = splitSentences(text);
  const ranked = sentences.sort((a, b) => evidenceScore(b) - evidenceScore(a));
  return ranked[0] ?? text.slice(0, 300).trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；;])\s*|(?<=[.!?])\s+(?=[A-Z0-9\u4e00-\u9fff])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function evidenceScore(text: string): number {
  const lower = text.toLowerCase();
  return [
    'confirmed', 'validation', 'approval', 'revenue', 'customer', 'pricing', 'reimbursement',
    'capital', 'funding', 'budget', 'branch', 'parent', 'multi-customer', 'standard adoption',
    '国务院', '批复', '规划', '政策', '各省', '重要任务', '中医药', '振兴发展', '现代化', '走向世界',
  ].reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function candidateFromQuote(input: {
  rawDocument: RawDocument;
  chunk: DocumentChunk;
  provenance: ProvenanceRecord;
  existingEvidenceIds: Set<string>;
  generatedAt: string;
  index: number;
}): EvidenceCandidate {
  const quote = input.provenance.quote;
  const lower = quote.toLowerCase();
  const topic = inferTopic(lower);
  const scope = inferScope(lower);
  const evidenceId = `intake_${topic.topic_id}_${input.generatedAt.slice(0, 10).replaceAll('-', '')}_${input.index + 1}`;
  const affectedLayer = inferLayers(lower);
  const strength = inferStrength(lower);
  const sourceUrl = sourceUrlFor(input.rawDocument.source_name);
  const draft: EvidenceImportDraft = {
    evidence_id: evidenceId,
    topic_id: topic.topic_id,
    branch_id: scope === 'branch' ? topic.branch_id ?? defaultBranchId(topic.topic_id) : null,
    scope,
    event_date: input.generatedAt.slice(0, 10),
    available_at: input.generatedAt.slice(0, 10),
    event_title: titleFromQuote(quote),
    event_summary: quote,
    event_type: eventTypeFor(affectedLayer),
    source_name: input.rawDocument.source_name,
    source_url: sourceUrl,
    source_type: sourceUrl.includes('example.invalid/intake/pasted-text') ? 'research' : 'other',
    evidence_strength: strength,
    affected_layer: affectedLayer,
    stage_effect: stageEffectFor(scope, strength),
    polarity: lower.includes('weaken') || lower.includes('risk') || lower.includes('failed') ? 'negative' : 'positive',
    interpretation: interpretationFor(scope, affectedLayer, strength),
    limitation: scope === 'branch'
      ? 'Branch evidence requires separate parent-level evidence before upgrading the parent narrative.'
      : 'Candidate evidence requires human review and may not cover every required Stage Gate layer.',
    confidence: strength === 'E4' || strength === 'E3' ? 'medium' : 'low',
  };
  return {
    candidate_id: `candidate_${input.rawDocument.raw_document_id}_${input.index}`,
    raw_document_id: input.rawDocument.raw_document_id,
    chunk_id: input.chunk.chunk_id,
    provenance_id: input.provenance.provenance_id,
    original_quote: quote,
    suggested_evidence: draft,
    suggested_reason: `Mapped quote to ${scope} ${topic.topic_id} evidence with ${affectedLayer.join(', ')} layer signals.`,
    uncertainty_notes: uncertaintyNotes(topic.topic_id, scope, affectedLayer),
    field_explanations: fieldExplanations(),
    e_strength_rationale: strengthRationale(strength),
    duplicate_of_evidence_id: input.existingEvidenceIds.has(evidenceId) ? evidenceId : null,
    guardrail_check: {
      no_trading_advice: noTradingAdvice(draft),
      provenance_present: Boolean(input.provenance.quote),
      human_review_required: true,
    },
  };
}

export function inferTopic(text: string): { topic_id: string; branch_id: string | null } {
  if (text.includes('中医药') || text.includes('中西医') || text.includes('traditional chinese medicine') || text.includes('tcm')) {
    return { topic_id: 'traditional_chinese_medicine_revival', branch_id: null };
  }
  if (text.includes('bci') || text.includes('brain-computer') || text.includes('脑机') || text.includes('medical rehabilitation')) {
    return { topic_id: 'bci', branch_id: text.includes('rehab') || text.includes('medical') ? 'bci_medical_rehab' : null };
  }
  if (text.includes('humanoid') || text.includes('robot') || text.includes('机器人') || text.includes('具身')) return { topic_id: 'humanoid_robotics', branch_id: null };
  if (text.includes('license-out') || text.includes('license out') || text.includes('licensing deal') || text.includes('out-licensing') || text.includes('对外授权') || text.includes('授权交易')) {
    if (text.includes('adc')) return { topic_id: 'innovative_drug_license_out', branch_id: 'adc_license_out' };
    return { topic_id: 'innovative_drug_license_out', branch_id: null };
  }
  if (text.includes('drug approval') || text.includes('approved') || text.includes('创新药') || text.includes('新药') || text.includes('新靶点') || text.includes('新机制') || text.includes('放射性') || text.includes('核药') || text.includes('核医学') || text.includes('临床试验')) {
    if (text.includes('放射性') || text.includes('核药') || text.includes('核医学')) return { topic_id: 'innovative_drug_nuclear_medicine', branch_id: null };
    if (text.includes('临床试验')) return { topic_id: 'innovative_drug_clinical_development', branch_id: null };
    return { topic_id: 'innovative_drug_approval', branch_id: null };
  }
  if (text.includes('ai video') || text.includes('video generation') || text.includes('视频生成') || text.includes('视频大模型') || text.includes('文生视频')) {
    return { topic_id: 'ai_video_generation', branch_id: null };
  }
  if (text.includes('llm') || text.includes('large language model') || text.includes('foundation model') || text.includes('大模型') || text.includes('多模态') || text.includes('生成式 ai') || text.includes('generative ai')) {
    return { topic_id: 'ai_foundation_models', branch_id: null };
  }
  if (text.includes('bitcoin') || text.includes('btc') || text.includes('ethereum') || text.includes('crypto') || text.includes('web3') || text.includes('区块链') || text.includes('加密货币') || text.includes('加密资产')) {
    return { topic_id: 'blockchain_crypto_market', branch_id: null };
  }
  if (text.includes('semiconductor') || text.includes('chip') || text.includes('gpu') || text.includes('foundry') || text.includes('晶圆') || text.includes('芯片') || text.includes('半导体') || text.includes('先进制程')) {
    return { topic_id: 'semiconductor_advanced_manufacturing', branch_id: null };
  }
  if (text.includes('satellite') || text.includes('rocket') || text.includes('spacecraft') || text.includes('launch') || text.includes('卫星') || text.includes('火箭') || text.includes('航天') || text.includes('低轨')) {
    return { topic_id: 'commercial_space', branch_id: null };
  }
  if (text.includes('solid state') || text.includes('solid-state') || text.includes('固态电池') || text.includes('全固态') || text.includes('半固态')) {
    return { topic_id: 'solid_state_battery', branch_id: text.includes('硫化物') ? 'solid_state_sulfide' : text.includes('氧化物') ? 'solid_state_oxide' : null };
  }
  if (text.includes('ai agent') || text.includes('智能体') || text.includes('agentic') || text.includes('ai agents')) {
    return { topic_id: 'provisional_ai_agents', branch_id: null };
  }
  if (text.includes('nuclear fusion') || text.includes('核聚变') || text.includes('先进核能') || text.includes('托卡马克') || text.includes('tokamak')) {
    return { topic_id: 'provisional_nuclear_fusion_advanced_nuclear', branch_id: null };
  }
  if (text.includes('low-altitude') || text.includes('low altitude') || text.includes('低空经济') || text.includes('evtol') || text.includes('飞行汽车')) {
    return { topic_id: 'provisional_low_altitude_economy', branch_id: null };
  }
  if (text.includes('synthetic biology') || text.includes('合成生物')) {
    return { topic_id: 'provisional_synthetic_biology', branch_id: null };
  }
  if (text.includes('算力') || text.includes('computing infrastructure') || text.includes('智算中心') || text.includes('datacenter')) {
    return { topic_id: 'provisional_computing_infrastructure', branch_id: null };
  }
  if (text.includes('智能制造') || text.includes('smart manufacturing') || text.includes('工业母机')) {
    return { topic_id: 'provisional_smart_manufacturing', branch_id: null };
  }
  if (text.includes('battery') || text.includes('solar') || text.includes('energy storage') || text.includes('储能') || text.includes('新能源') || text.includes('光伏') || text.includes('氢能')) {
    return { topic_id: 'new_energy_industry', branch_id: null };
  }
  if (text.includes('autonomous driving') || text.includes('self-driving') || text.includes('智能驾驶') || text.includes('自动驾驶') || text.includes('robotaxi')) {
    return { topic_id: 'provisional_autonomous_driving_robotaxi', branch_id: null };
  }
  if (text.includes('quantum') || text.includes('量子')) return { topic_id: 'provisional_quantum_computing', branch_id: null };
  return { topic_id: 'unknown_topic', branch_id: null };
}

function defaultBranchId(topicId: string): string | null {
  if (topicId === 'bci') return 'bci_medical_rehab';
  return null;
}

function inferScope(text: string): 'parent' | 'branch' {
  return text.includes('branch') || text.includes('rehab') || text.includes('medical rehabilitation') || text.includes('放射性') || text.includes('核药') || text.includes('核医学') || text.includes('临床试验') ? 'branch' : 'parent';
}

function inferLayers(text: string): EvidenceImportDraft['affected_layer'] {
  const layers = new Set<EvidenceImportDraft['affected_layer'][number]>();
  if (text.includes('label') || text.includes('named') || text.includes('narrative') || text.includes('规划') || text.includes('振兴发展')) layers.add('name');
  if (text.includes('capital') || text.includes('funding') || text.includes('budget') || text.includes('重大工程') || text.includes('重点项目')) layers.add('capital');
  if (text.includes('pricing') || text.includes('price') || text.includes('reimbursement') || text.includes('order') || text.includes('报批')) layers.add('pricing');
  if (text.includes('validation') || text.includes('approval') || text.includes('customer') || text.includes('revenue') || text.includes('replication') || text.includes('国务院') || text.includes('批复') || text.includes('落实') || text.includes('动态监测')) layers.add('reality');
  if (text.includes('follow-up') || text.includes('momentum') || text.includes('政策合力') || text.includes('重要任务') || text.includes('现代化') || text.includes('走向世界')) layers.add('momentum');
  if (text.includes('risk') || text.includes('failed') || text.includes('friction') || text.includes('问题')) layers.add('friction');
  return Array.from(layers.size ? layers : new Set(['name']));
}

function inferStrength(text: string): EvidenceImportDraft['evidence_strength'] {
  if (text.includes('国务院') && (text.includes('批复') || text.includes('发布'))) return 'E3';
  if (text.includes('multi-customer replication') || text.includes('revenue confirmation') || text.includes('standard adoption') || text.includes('repeat purchase')) return 'E4';
  if (text.includes('confirmed') || text.includes('approval') || text.includes('customer') || text.includes('official')) return 'E3';
  if (text.includes('reported') || text.includes('suggests') || text.includes('follow-up') || text.includes('规划') || text.includes('政策')) return 'E2';
  if (text.includes('rumor') || text.includes('unverified')) return 'E1';
  return 'E2';
}

function sourceUrlFor(sourceName: string): string {
  if (/^https?:\/\//.test(sourceName)) return sourceName;
  return 'https://example.invalid/intake/pasted-text';
}

function titleFromQuote(quote: string): string {
  return quote.replace(/\s+/g, ' ').slice(0, 96);
}

function eventTypeFor(layers: EvidenceImportDraft['affected_layer']): string {
  if (layers.includes('reality')) return 'candidate_reality_evidence';
  if (layers.includes('pricing')) return 'candidate_pricing_evidence';
  if (layers.includes('capital')) return 'candidate_capital_evidence';
  return 'candidate_label_evidence';
}

function stageEffectFor(scope: 'parent' | 'branch', strength: EvidenceImportDraft['evidence_strength']): EvidenceImportDraft['stage_effect'] {
  if (scope === 'branch') return 'split_branch';
  return strength === 'E1' ? 'watch_upgrade' : 'maintain';
}

function interpretationFor(scope: 'parent' | 'branch', layers: EvidenceImportDraft['affected_layer'], strength: string): string {
  return `Candidate ${strength} ${scope} evidence touching ${layers.join(', ')}. Human reviewer must confirm mapping before import.`;
}

function uncertaintyNotes(topicId: string, scope: 'parent' | 'branch', layers: EvidenceImportDraft['affected_layer']): string[] {
  const notes = ['Candidate was generated from source text and requires human confirmation.'];
  if (topicId === 'unknown_topic') notes.push('Topic could not be confidently mapped to a known seed topic.');
  if (scope === 'branch') notes.push('Branch evidence cannot upgrade parent narrative by itself.');
  if (!layers.includes('reality')) notes.push('Reality layer was not detected from the quote.');
  return notes;
}

function fieldExplanations(): Record<string, string> {
  return {
    topic_id: '主题 ID。请确认候选证据属于哪个叙事主题。',
    branch_id: '分支 ID。只有 branch evidence 才填写。',
    scope: 'parent 表示整个主题；branch 表示某个分支。',
    evidence_strength: 'E0-E4 证据强度。E4 需要硬现实依据。',
    affected_layer: '受影响层：name、capital、pricing、reality、momentum、friction、data_confidence。',
    interpretation: '这条证据支持什么。',
    limitation: '这条证据不能证明什么。',
    confidence: 'low、medium、high。不是概率，只是数据置信度标签。',
  };
}

function strengthRationale(strength: string): string {
  const rationales: Record<string, string> = {
    E0: '无法用于阶段判断，仅可保留审计。',
    E1: '弱信号或未验证线索。',
    E2: '可用但有限的证据。',
    E3: '较强、可追踪的来源或确认信号。',
    E4: '硬现实证据，如收入确认、多客户复现、标准采纳或重复购买。',
  };
  return rationales[strength] ?? rationales.E2;
}
