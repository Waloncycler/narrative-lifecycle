import {
  WORLDMONITOR_SOURCE_CATALOG,
  operationSourceConfig,
  sourceConfigForSourceId,
} from '../domain/worldmonitor_source_catalog';
import type { EvidenceImportDraft } from '../types/evidence_import';
import type { EvidenceCandidate, ProvenanceRecord, RawDocument } from '../types/intake';
import type {
  ConvertedWorldMonitorCandidate,
  WorldMonitorIntakeBatchResult,
  WorldMonitorSignal,
  WorldMonitorSourceConfig,
} from '../types/worldmonitor_adapter';

/**
 * Compatibility re-export: the canonical per-source catalog now lives in the
 * Domain layer (src/domain/worldmonitor_source_catalog.ts) and is shared with
 * the live sync path. This legacy connector keeps the same public surface.
 */
export {
  WORLDMONITOR_SOURCE_CATALOG,
  operationSourceConfig,
  sourceConfigForSourceId,
};

export class WorldMonitorIntakeConnector {
  public static getSourceConfig(sourceId: string): WorldMonitorSourceConfig {
    const config = WORLDMONITOR_SOURCE_CATALOG[sourceId];
    if (config) {
      return config;
    }
    // Fallback default configuration for unlisted sources
    return {
      source_id: sourceId,
      source_name: `WorldMonitor Source (${sourceId})`,
      domain: 'osint',
      source_type: 'other',
      primary_layer: 'name',
      secondary_layers: ['data_confidence'],
      default_evidence_strength: 'E1',
      default_event_type: 'WORLDMONITOR_SIGNAL',
      default_stage_effect: 'maintain',
      default_polarity: 'neutral',
      default_confidence: 'medium',
    };
  }

  public static convertSignalToCandidate(
    signal: WorldMonitorSignal,
    targetTopicId = 'unknown_topic',
    targetBranchId?: string | null,
  ): ConvertedWorldMonitorCandidate {
    const config = this.getSourceConfig(signal.source_id);

    const docId = `raw-doc-wm-${signal.signal_id}`;
    const chunkId = `chunk-wm-${signal.signal_id}-0`;
    const provId = `prov-wm-${signal.signal_id}-0`;
    const candId = `cand-wm-${signal.signal_id}`;
    const evidId = `evid-wm-${signal.signal_id}`;

    const textPayload = `[${signal.source_name}] ${signal.event_title}\n\n${signal.event_summary}\nDate: ${signal.event_date}`;
    const quoteStart = textPayload.indexOf(signal.event_title);

    const rawDocument: RawDocument = {
      raw_document_id: docId,
      source_name: signal.source_name,
      source_kind: 'html',
      ingested_at: signal.timestamp,
      text: textPayload,
      character_count: textPayload.length,
    };

    const provenanceRecord: ProvenanceRecord = {
      provenance_id: provId,
      raw_document_id: docId,
      chunk_id: chunkId,
      quote: signal.event_title,
      quote_start_offset: quoteStart,
      quote_end_offset: quoteStart + signal.event_title.length,
      location_label: `${signal.source_name} - ${signal.event_date}`,
      extraction_reason: `Automatic intake of World Monitor signal (${signal.source_id})`,
    };

    const suggestedDraft: EvidenceImportDraft = {
      evidence_id: evidId,
      topic_id: targetTopicId,
      branch_id: targetBranchId ?? null,
      scope: targetBranchId ? 'branch' : 'parent',
      event_date: signal.event_date,
      available_at: signal.timestamp.slice(0, 10),
      event_title: signal.event_title,
      event_summary: signal.event_summary,
      event_type: signal.event_type || config.default_event_type,
      source_name: signal.source_name,
      source_url: signal.source_url ?? null,
      source_type: config.source_type,
      evidence_strength: config.default_evidence_strength,
      affected_layer: [config.primary_layer, ...config.secondary_layers],
      stage_effect: config.default_stage_effect,
      polarity: config.default_polarity,
      interpretation: `Candidate signal may affect ${config.primary_layer}; lifecycle impact remains subject to Evidence review and Stage Gate rules.`,
      limitation: `Automated candidate only. Verify the upstream source, Topic, Branch and evidence strength. Signal confidence: ${signal.confidence_score}.`,
      confidence: config.default_confidence,
    };

    const candidate: EvidenceCandidate = {
      candidate_id: candId,
      raw_document_id: docId,
      chunk_id: chunkId,
      provenance_id: provId,
      original_quote: signal.event_title,
      suggested_evidence: suggestedDraft,
      suggested_reason: `Rule-based mapping from World Monitor source ${signal.source_id} to layer ${config.primary_layer}.`,
      uncertainty_notes: signal.confidence_score < 0.7 ? ['Signal confidence is below threshold; review metrics.'] : [],
      field_explanations: {
        affected_layer: `Mapped to ${config.primary_layer} based on domain ${config.domain}.`,
        evidence_strength: `Assigned strength ${config.default_evidence_strength} per source tier.`,
      },
      e_strength_rationale: `Source tier default strength for ${signal.source_id}`,
      guardrail_check: {
        no_trading_advice: true,
        provenance_present: true,
        human_review_required: false,
      },
    };

    return {
      signal,
      raw_document: rawDocument,
      provenance_record: provenanceRecord,
      candidate,
    };
  }

  public static processSignalBatch(
    signals: WorldMonitorSignal[],
    targetTopicId: string,
    targetBranchId?: string | null,
  ): WorldMonitorIntakeBatchResult {
    const accepted: ConvertedWorldMonitorCandidate[] = [];
    const errors: Array<{ signal_id: string; message: string }> = [];
    let skipped = 0;

    for (const sig of signals) {
      try {
        if (!sig.signal_id || !sig.event_title) {
          skipped++;
          continue;
        }
        const converted = this.convertSignalToCandidate(sig, targetTopicId, targetBranchId);
        accepted.push(converted);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ signal_id: sig.signal_id || 'unknown', message: msg });
      }
    }

    return {
      batch_id: `wm-batch-${Date.now()}`,
      processed_at: new Date().toISOString(),
      total_signals: signals.length,
      accepted_candidates: accepted,
      skipped_signals_count: skipped,
      errors,
    };
  }
}
