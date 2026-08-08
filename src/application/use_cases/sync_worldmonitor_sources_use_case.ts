import { noTradingAdvice, reviewTemplate } from '@/domain/intake_rules';
import {
  governanceForWorldMonitorOperation,
  recordsForWorldMonitorPayload,
  signalsFromWorldMonitorPayload,
  sourceConfigForOperation,
} from '@/domain/worldmonitor_rules';
import { buildWorldMonitorFactState } from '@/domain/worldmonitor_change_detection';
import type { DocumentChunk, EvidenceCandidate, EvidenceIntakeSession, ProvenanceRecord, RawDocument } from '@/types/intake';
import type {
  WorldMonitorFetchRecord,
  WorldMonitorFactState,
  WorldMonitorOperationDescriptor,
  WorldMonitorPayload,
  WorldMonitorSourceInventory,
  WorldMonitorSyncMode,
  WorldMonitorSyncReport,
  WorldMonitorSyncResult,
} from '@/types/worldmonitor_adapter';

export interface SyncWorldMonitorSourcesUseCaseDeps {
  buildInventory(input: { generatedAt: string; productionConfigured: boolean }): WorldMonitorSourceInventory;
  fetchOperation(descriptor: WorldMonitorOperationDescriptor, mode: WorldMonitorSyncMode): Promise<{
    descriptor: WorldMonitorOperationDescriptor;
    payload: WorldMonitorPayload | null;
    status: 'ok' | 'skipped' | 'failed';
    httpStatus: number | null;
    message: string;
  }>;
  seenPayloadHashes(): Set<string>;
  existingEvidenceIds(): Set<string>;
  writeInventory(inventory: WorldMonitorSourceInventory): void;
  writeSyncReport(report: WorldMonitorSyncReport): void;
  readFactState(): WorldMonitorFactState | null;
  writeFactState(state: WorldMonitorFactState): void;
  writeIntakeSession(session: EvidenceIntakeSession): void;
  resolveTopics(session: EvidenceIntakeSession): void;
  validateInventory(inventory: WorldMonitorSourceInventory): void;
  validateReport(report: WorldMonitorSyncReport): void;
  validateFactState(state: WorldMonitorFactState): void;
  validateSession(session: EvidenceIntakeSession): void;
  validateCandidate(candidate: EvidenceCandidate): void;
  now(): string;
  productionConfigured(): boolean;
}

export class SyncWorldMonitorSourcesUseCase {
  constructor(private readonly deps: SyncWorldMonitorSourcesUseCaseDeps) {}

  inventory(): WorldMonitorSourceInventory {
    const inventory = this.deps.buildInventory({
      generatedAt: this.deps.now(),
      productionConfigured: this.deps.productionConfigured(),
    });
    this.deps.validateInventory(inventory);
    this.deps.writeInventory(inventory);
    return inventory;
  }

  async execute(input: {
    mode: WorldMonitorSyncMode;
    operationIds?: string[];
    includeContext?: boolean;
    maxOperations?: number;
    maxCandidates?: number;
    forceRefresh?: boolean;
  }): Promise<WorldMonitorSyncResult> {
    const generatedAt = this.deps.now();
    const syncId = `worldmonitor_sync_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
    const inventory = this.deps.buildInventory({
      generatedAt,
      productionConfigured: this.deps.productionConfigured(),
    });
    const selected = selectOperations(inventory.operations, input);
    const seenHashes = this.deps.seenPayloadHashes();
    const payloads: WorldMonitorPayload[] = [];
    const records: WorldMonitorFetchRecord[] = [];

    for (const descriptor of selected) {
      const result = await this.deps.fetchOperation(descriptor, input.mode);
      const duplicate = input.mode === 'live' && !input.forceRefresh && result.payload ? seenHashes.has(result.payload.payload_hash) : false;
      const recordCount = result.payload ? recordsForWorldMonitorPayload(result.payload).length : 0;
      const candidateCount = result.payload && !duplicate
        ? uniqueSignals(signalsFromWorldMonitorPayload(result.payload).filter(signalHasNoTradingAdvice)).slice(0, 25).length
        : 0;
      if (result.payload) payloads.push(result.payload);
      records.push({
        operation_id: descriptor.operation_id,
        fetched_at: result.payload?.fetched_at ?? generatedAt,
        mode: input.mode,
        status: duplicate ? 'skipped' : result.status,
        http_status: result.httpStatus,
        access_state: descriptor.access_state,
        evidence_eligibility: descriptor.evidence_eligibility,
        source_url: result.payload?.source_url ?? descriptor.production_url,
        payload_hash: result.payload?.payload_hash ?? null,
        record_count: recordCount,
        candidate_count: candidateCount,
        selected_candidate_count: 0,
        degraded: result.payload?.degraded ?? false,
        stale: result.payload?.stale ?? false,
        message: duplicate ? 'Payload hash already exists in source history; duplicate candidates suppressed.' : result.message,
        governance_state: descriptor.governance.governance_state,
        raw_payload_retained: false,
      });
    }

    const allSignals = payloads.flatMap((payload) =>
      signalsFromWorldMonitorPayload(payload).filter(signalHasNoTradingAdvice),
    );
    const observedOperationIds = new Set(records
      .filter((record) => record.mode === 'live' && record.http_status !== null && record.status !== 'failed')
      .map((record) => record.operation_id));
    const absenceAssertableOperationIds = new Set(payloads
      .filter((payload) =>
        payload.descriptor.governance.absence_assertion_allowed
        && !payload.degraded
        && !payload.stale
      )
      .map((payload) => payload.descriptor.operation_id));
    const changeResult = input.mode === 'live'
      ? buildWorldMonitorFactState({
        signals: allSignals,
        previous: this.deps.readFactState(),
        observedOperationIds,
        absenceAssertableOperationIds,
        generatedAt,
        syncId,
      })
      : null;
    const actionableKeys = new Set((changeResult?.actionableSignals ?? []).map((signal) => signal.signal_id));
    const signalGroups = payloads.map((payload) =>
      uniqueSignals(signalsFromWorldMonitorPayload(payload).filter(signalHasNoTradingAdvice))
        .filter((signal) => actionableKeys.has(signal.signal_id))
        .slice(0, 25),
    );
    const signals = roundRobin(signalGroups, input.maxCandidates ?? 50);
    for (const record of records) {
      record.selected_candidate_count = signals.filter((signal) => signal.operation_id === record.operation_id).length;
    }
    const session = input.mode === 'live' && signals.length
      ? sessionFromSignals(signals, generatedAt, this.deps.existingEvidenceIds())
      : null;
    const report: WorldMonitorSyncReport = {
      artifact_type: 'worldmonitor_sync_report',
      schema_version: '1.0.0',
      producer_version: '0.7.9',
      sync_id: syncId,
      generated_at: generatedAt,
      mode: input.mode,
      requested_operation_count: selected.length,
      completed_operation_count: records.filter((item) => item.status === 'ok').length,
      failed_operation_count: records.filter((item) => item.status === 'failed').length,
      skipped_operation_count: records.filter((item) => item.status === 'skipped').length,
      payload_record_count: records.reduce((sum, item) => sum + item.record_count, 0),
      candidate_count: session?.candidates.length ?? 0,
      new_fact_count: changeResult?.state.new_fact_count ?? 0,
      updated_fact_count: changeResult?.state.updated_fact_count ?? 0,
      material_update_count: changeResult?.state.material_update_count ?? 0,
      suppressed_update_count: changeResult?.state.suppressed_update_count ?? 0,
      unchanged_fact_count: changeResult?.state.unchanged_fact_count ?? 0,
      not_observed_fact_count: changeResult?.state.not_observed_fact_count ?? 0,
      fact_state_id: changeResult?.state.state_id ?? null,
      intake_session_id: session?.session_id ?? null,
      records,
      guardrail_check: {
        sandbox_not_importable: input.mode !== 'sandbox' || session === null,
        context_only_not_scored: records.every((item) => item.evidence_eligibility !== 'context_only' || item.candidate_count === 0),
        human_review_required: false,
        topic_resolver_required: true,
        duplicate_detection_required: true,
        parent_branch_separation: true,
        no_trading_advice: true,
      },
    };

    this.deps.validateInventory(inventory);
    this.deps.validateReport(report);
    if (changeResult) this.deps.validateFactState(changeResult.state);
    this.deps.writeInventory(inventory);
    this.deps.writeSyncReport(report);
    if (changeResult) this.deps.writeFactState(changeResult.state);
    if (session) {
      for (const candidate of session.candidates) this.deps.validateCandidate(candidate);
      for (const provenance of session.provenance_records) {
        const quoted = session.raw_document.text.slice(provenance.quote_start_offset, provenance.quote_end_offset);
        if (quoted !== provenance.quote) throw new Error(`${provenance.provenance_id}: citation offsets do not match source text`);
      }
      this.deps.validateSession(session);
      this.deps.writeIntakeSession(session);
      this.deps.resolveTopics(session);
    }
    return { inventory, report, factState: changeResult?.state ?? null, session };
  }
}

function signalHasNoTradingAdvice(signal: ReturnType<typeof signalsFromWorldMonitorPayload>[number]): boolean {
  return noTradingAdvice({ title: signal.event_title, summary: signal.event_summary });
}

function uniqueSignals(signals: ReturnType<typeof signalsFromWorldMonitorPayload>) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.operation_id ?? signal.source_id}|${signal.event_date}|${signal.event_title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function roundRobin<T>(groups: T[][], limit: number): T[] {
  const result: T[] = [];
  const maxLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxLength && result.length < limit; index += 1) {
    for (const group of groups) {
      if (group[index] !== undefined) result.push(group[index]);
      if (result.length >= limit) break;
    }
  }
  return result;
}

function selectOperations(
  operations: WorldMonitorOperationDescriptor[],
  input: { mode: WorldMonitorSyncMode; operationIds?: string[]; includeContext?: boolean; maxOperations?: number },
): WorldMonitorOperationDescriptor[] {
  const requested = new Set(input.operationIds ?? []);
  const selected = operations.filter((item) => {
    if (requested.size && !requested.has(item.operation_id)) return false;
    if (input.mode === 'sandbox') return Boolean(item.sandbox_fixture);
    if (item.evidence_eligibility === 'unsupported') return false;
    if (item.governance.governance_state !== 'research_ready') return false;
    // The auto-polling surface stays GET-only and polling-allowed; explicitly
    // requested operations (e.g. the SZSE POST data API) may still be pulled
    // on demand so the pollable_operation_count remains the sync contract.
    if (!requested.has(item.operation_id)) {
      if (!item.governance.automated_polling_allowed) return false;
      if (item.method !== 'GET' || item.required_parameters.length) return false;
      if (item.access_state === 'requires_key') return false;
      if (item.auth_requirement === 'worldmonitor_key' && item.access_state !== 'production_ready') return false;
    }
    return item.evidence_eligibility === 'candidate' || Boolean(input.includeContext);
  });
  return selected.slice(0, input.maxOperations ?? Number.POSITIVE_INFINITY);
}

function sessionFromSignals(
  signals: ReturnType<typeof signalsFromWorldMonitorPayload>,
  generatedAt: string,
  existingEvidenceIds: Set<string>,
): EvidenceIntakeSession {
  const sections = signals.map((signal) =>
    `${signal.event_title}\n${signal.event_summary}\nSource record: ${signal.source_quote ?? signal.event_title}`,
  );
  const text = sections.join('\n\n');
  const rawDocumentId = `raw_worldmonitor_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`;
  const rawDocument: RawDocument = {
    raw_document_id: rawDocumentId,
    source_name: 'World Monitor live source sync',
    source_kind: 'pasted_text',
    ingested_at: generatedAt,
    text,
    character_count: text.length,
  };
  const chunks: DocumentChunk[] = [];
  const provenance: ProvenanceRecord[] = [];
  const candidates: EvidenceCandidate[] = [];
  let offset = 0;
  signals.forEach((signal, index) => {
    const section = sections[index];
    const chunkId = `chunk_${rawDocumentId}_${index}`;
    const provenanceId = `prov_${rawDocumentId}_${index}`;
    const sourceQuote = signal.source_quote ?? signal.event_title;
    const quoteStart = offset + signal.event_title.length + 1 + signal.event_summary.length + 1 + 'Source record: '.length;
    const descriptor = {
      operation_id: signal.operation_id ?? signal.event_type,
      service: signal.source_name.split('/').at(-1)?.trim() ?? signal.source_id,
      method: 'GET',
      path: '',
      summary: signal.event_title,
      description: '',
      required_parameters: [],
      optional_parameters: [],
      domain: signal.domain,
      evidence_eligibility: 'candidate' as const,
      auth_requirement: 'public_no_key' as const,
      access_state: 'production_ready' as const,
      sandbox_fixture: null,
      production_url: signal.source_url ?? '',
      normalizer_id: signal.normalizer_id ?? 'generic_record',
      normalizer_version: '1.0.0' as const,
      governance: governanceForWorldMonitorOperation({
        service: signal.source_name.split('/').at(-1)?.trim() ?? signal.source_id,
        method: 'GET',
        sourceClass: signal.source_name.startsWith('Direct public /') ? 'direct_public' : 'worldmonitor_hosted',
        eligibility: 'candidate',
        productionConfigured: true,
      }),
    };
    const config = sourceConfigForOperation(descriptor);
    const evidenceId = `wm_${signal.signal_id}`.slice(0, 180);
    chunks.push({
      chunk_id: chunkId,
      raw_document_id: rawDocumentId,
      index,
      text: section,
      start_offset: offset,
      end_offset: offset + section.length,
    });
    provenance.push({
      provenance_id: provenanceId,
      raw_document_id: rawDocumentId,
      chunk_id: chunkId,
      quote: sourceQuote,
      quote_start_offset: quoteStart,
      quote_end_offset: quoteStart + sourceQuote.length,
      location_label: `${signal.operation_id ?? signal.source_id} / record ${index + 1}`,
      extraction_reason: `Live API record normalized from ${signal.operation_id ?? signal.source_id}; human verification required.`,
    });
    candidates.push({
      candidate_id: `candidate_${signal.signal_id}`,
      raw_document_id: rawDocumentId,
      chunk_id: chunkId,
      provenance_id: provenanceId,
      original_quote: sourceQuote,
      suggested_evidence: {
        evidence_id: evidenceId,
        topic_id: 'unknown_topic',
        branch_id: null,
        scope: 'parent',
        event_date: signal.event_date,
        available_at: (signal.available_at ?? signal.timestamp).slice(0, 10),
        event_title: signal.event_title,
        event_summary: signal.event_summary,
        event_type: signal.event_type,
        source_name: signal.source_name,
        source_url: signal.source_url ?? null,
        source_type: config.source_type,
        evidence_strength: 'E1',
        affected_layer: [config.primary_layer, ...config.secondary_layers],
        stage_effect: 'maintain',
        polarity: 'neutral',
        interpretation: 'External signal may be relevant to a narrative, but Topic, Branch and lifecycle impact remain unresolved.',
        limitation: `Structured API record normalized by ${signal.normalizer_id ?? 'generic_record'} ${signal.normalizer_version ?? 'unknown'}; upstream verification and human review remain required. Payload hash: ${signal.raw_payload_hash ?? 'unavailable'}.`,
        confidence: 'low',
      },
      suggested_reason: `Conservative live-source candidate from ${signal.operation_id ?? signal.source_id}; no automatic Topic or Stage assignment.`,
      uncertainty_notes: [
        'Topic and Branch are unresolved.',
        'E1 is a provisional ceiling until the upstream source and fact are verified.',
        'Stage effect remains maintain; Stage Gate runs only after formal import.',
      ],
      field_explanations: {
        evidence_strength: 'External aggregator records start at E1 and cannot inherit strength from the source catalog.',
        affected_layer: `The ${config.primary_layer} layer is suggested from the operation domain and must be reviewed.`,
        topic_id: 'No forced mapping is allowed; Topic Resolver and the operator must decide.',
        source_normalizer: `${signal.normalizer_id ?? 'generic_record'} ${signal.normalizer_version ?? 'unknown'}`,
      },
      e_strength_rationale: 'Conservative E1 baseline for a live secondary-source signal.',
      duplicate_of_evidence_id: existingEvidenceIds.has(evidenceId) ? evidenceId : null,
      guardrail_check: {
        no_trading_advice: true,
        provenance_present: true,
        human_review_required: false,
      },
    });
    offset += section.length + 2;
  });
  return {
    session_id: `intake_worldmonitor_${generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    generated_at: generatedAt,
    raw_document: rawDocument,
    chunks,
    provenance_records: provenance,
    candidates,
    review_template: reviewTemplate(candidates),
  };
}
