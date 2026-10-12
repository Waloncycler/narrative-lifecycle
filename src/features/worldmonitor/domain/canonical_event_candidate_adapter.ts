import { createHash } from 'node:crypto';
import type { CanonicalEvent } from '@/features/worldmonitor/types/worldmonitor_normalization';
import type {
  DocumentChunk,
  EvidenceCandidate,
  EvidenceIntakeSession,
  ProvenanceRecord,
  RawDocument,
} from '@/features/intake/types/intake';
import type { EvidenceImportDraft, EvidenceImportSourceType } from '@/features/evidence/types/evidence_import';
import { TOPIC_NAME_LOCALIZATIONS } from '@/config/topic_name_localizations';

export interface CanonicalEventCandidateInput {
  canonicalEvent: CanonicalEvent;
  sourceName?: string;
  sourceType?: EvidenceImportSourceType;
  rawQuote?: string;
}

/**
 * Attribute a canonical event to one of the 42 tracked topics based on
 * title keywords, localized names, and established aliases.
 */
export function attributeTopicForEvent(title: string, rawText?: string): string {
  const content = `${title} ${rawText ?? ''}`.toLowerCase();

  // Priority specific matches
  if ((content.includes('固态') && content.includes('电池')) || content.includes('solid state battery')) return 'provisional_solid_state_battery';
  if ((content.includes('钠') && content.includes('电池')) || content.includes('sodium ion battery')) return 'sodium_ion_battery';
  if (content.includes('人形机器人') || content.includes('humanoid') || content.includes('具身智能')) return 'humanoid_robotics';
  if (content.includes('脑机接口') || content.includes('bci') || content.includes('neuralink') || content.includes('brain-computer interface')) return 'bci';
  if (content.includes('创新药') || content.includes('license-out') || content.includes('对外授权')) return 'innovative_drug_license_out';
  if (content.includes('先进封装') || content.includes('advanced packaging') || content.includes('chiplet')) return 'provisional_advanced_packaging';
  if (content.includes('低空经济') || content.includes('evtol') || content.includes('无人机')) return 'provisional_low_altitude_economy';
  if (content.includes('商业航天') || content.includes('commercial space') || content.includes('运载火箭')) return 'provisional_commercial_space';
  if (content.includes('量子计算') || content.includes('quantum computing') || content.includes('量子芯片')) return 'provisional_quantum_computing';
  if (content.includes('智能体') || content.includes('ai agent')) return 'provisional_ai_agents';
  if (content.includes('核聚变') || content.includes('fusion energy')) return 'provisional_fusion_energy_supply_chain';
  if (content.includes('增材制造') || content.includes('additive manufacturing') || content.includes('3d打印')) return 'provisional_additive_manufacturing';
  if (content.includes('区块链') || content.includes('blockchain') || content.includes('crypto')) return 'provisional_blockchain_crypto_market';
  if (content.includes('半导体') || content.includes('芯片') || content.includes('semiconductor')) return 'provisional_semiconductor_advanced_manufacturing';
  if (content.includes('储能') || content.includes('energy storage')) return 'provisional_new_energy_storage';

  // Fallback: Direct match on Chinese localizations
  const sortedEntries = Object.entries(TOPIC_NAME_LOCALIZATIONS).sort((a, b) => b[1].length - a[1].length);
  for (const [topicId, zhName] of sortedEntries) {
    if (zhName && content.includes(zhName.toLowerCase())) {
      return topicId;
    }
  }

  // Fallback: Direct match on English keywords extracted from topic IDs
  for (const topicId of Object.keys(TOPIC_NAME_LOCALIZATIONS)) {
    const rawKeyword = topicId.replace(/^provisional_/, '').replace(/_/g, ' ').toLowerCase();
    if (rawKeyword.length > 3 && content.includes(rawKeyword)) {
      return topicId;
    }
  }

  return 'unknown_topic';
}

/**
 * Builds a complete EvidenceIntakeSession from an array of Canonical Events.
 * Preserves deterministic quote citation offsets and provenance.
 */
export function buildIntakeSessionFromCanonicalEvents(
  events: CanonicalEventCandidateInput[],
  generatedAt: string = new Date().toISOString(),
): EvidenceIntakeSession {
  const sessionId = `intake_session_wm_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 15)}`;
  const rawDocumentId = `raw_wm_canonical_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 15)}`;

  // Construct structured text sections
  const sections = events.map((item) => {
    const quote = item.rawQuote ?? item.canonicalEvent.title;
    return `Title: ${item.canonicalEvent.title}\nURL: ${item.canonicalEvent.canonical_url ?? 'N/A'}\nQuote: ${quote}`;
  });

  const text = sections.join('\n\n---\n\n');

  const rawDocument: RawDocument = {
    raw_document_id: rawDocumentId,
    source_name: 'WorldMonitor Canonical Facts',
    source_kind: 'pasted_text',
    ingested_at: generatedAt,
    text,
    character_count: text.length,
  };

  const chunks: DocumentChunk[] = [];
  const provenanceRecords: ProvenanceRecord[] = [];
  const candidates: EvidenceCandidate[] = [];

  let currentOffset = 0;

  events.forEach((item, index) => {
    const sectionText = sections[index];
    const chunkId = `chunk_${rawDocumentId}_${index}`;
    const provenanceId = `prov_${rawDocumentId}_${index}`;
    const candidateId = `candidate_wm_${createHash('sha256').update(item.canonicalEvent.event_key).digest('hex').slice(0, 16)}`;

    const quotePrefix = `Title: ${item.canonicalEvent.title}\nURL: ${item.canonicalEvent.canonical_url ?? 'N/A'}\nQuote: `;
    const quote = item.rawQuote ?? item.canonicalEvent.title;
    const quoteStartOffset = currentOffset + quotePrefix.length;
    const quoteEndOffset = quoteStartOffset + quote.length;

    chunks.push({
      chunk_id: chunkId,
      raw_document_id: rawDocumentId,
      index,
      text: sectionText,
      start_offset: currentOffset,
      end_offset: currentOffset + sectionText.length,
    });

    provenanceRecords.push({
      provenance_id: provenanceId,
      raw_document_id: rawDocumentId,
      chunk_id: chunkId,
      quote,
      quote_start_offset: quoteStartOffset,
      quote_end_offset: quoteEndOffset,
      location_label: `Event ${index + 1}: ${item.canonicalEvent.title.slice(0, 30)}`,
      extraction_reason: 'Structured fact extracted from WorldMonitor normalized stream',
    });

    const topicId = attributeTopicForEvent(item.canonicalEvent.title, item.rawQuote);
    const dateStr = (item.canonicalEvent.first_observed_at || generatedAt).slice(0, 10);

    const draft: EvidenceImportDraft = {
      evidence_id: `ev_${createHash('sha256').update(item.canonicalEvent.event_key).digest('hex').slice(0, 16)}`,
      topic_id: topicId,
      branch_id: null,
      scope: 'parent',
      event_date: dateStr,
      available_at: dateStr,
      event_title: item.canonicalEvent.title,
      event_summary: item.canonicalEvent.normalized_title,
      event_type: 'MARKET_FACT',
      source_name: item.sourceName ?? 'WorldMonitor Aggregator',
      source_url: item.canonicalEvent.canonical_url ?? null,
      source_type: item.sourceType ?? 'news',
      evidence_strength: 'E1',
      affected_layer: ['reality', 'capital'],
      stage_effect: 'upgrade',
      polarity: 'positive',
      interpretation: `自动归因至主题 [${TOPIC_NAME_LOCALIZATIONS[topicId] || topicId}]，观测时间: ${dateStr}`,
      limitation: '源自公开监测流，待研究者人工核准或自动化准入。',
      confidence: 'medium',
    };

    candidates.push({
      candidate_id: candidateId,
      raw_document_id: rawDocumentId,
      chunk_id: chunkId,
      provenance_id: provenanceId,
      original_quote: quote,
      suggested_evidence: draft,
      suggested_reason: `自动清洗事件流生成的待审候选（去重指纹: ${item.canonicalEvent.event_key.slice(0, 8)}...）`,
      uncertainty_notes: topicId === 'unknown_topic' ? ['主题待确认'] : [],
      field_explanations: {
        topic_id: `匹配依据: ${TOPIC_NAME_LOCALIZATIONS[topicId] || topicId}`,
        evidence_strength: '单一公开信源初始评估为 E1',
      },
      e_strength_rationale: '基于实时监控事实提取，需结合更多独立信源进一步升级。',
      guardrail_check: {
        no_trading_advice: true,
        provenance_present: true,
        human_review_required: true,
      },
    });

    currentOffset += sectionText.length + '\n\n---\n\n'.length;
  });

  return {
    session_id: sessionId,
    generated_at: generatedAt,
    raw_document: rawDocument,
    chunks,
    provenance_records: provenanceRecords,
    candidates,
    ai_shadow_candidates: [],
    candidate_comparisons: [],
    review_template: candidates.map((c) => ({
      candidate_id: c.candidate_id,
      decision: 'accept' as const,
      reviewer: 'canonical_event_adapter',
      reviewed_at: generatedAt,
    })),
  };
}
