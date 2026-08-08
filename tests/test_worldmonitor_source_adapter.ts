import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncWorldMonitorSourcesUseCase } from '../src/application/use_cases/sync_worldmonitor_sources_use_case';
import { signalsFromWorldMonitorPayload } from '../src/domain/worldmonitor_rules';
import { FileWorldMonitorSourceRepository, WorldMonitorHttpClient } from '../src/infrastructure/worldmonitor_source_adapter';
import type {
  WorldMonitorOperationDescriptor,
  WorldMonitorPayload,
  WorldMonitorSourceInventory,
} from '../src/types/worldmonitor_adapter';
import type { EvidenceIntakeSession } from '../src/types/intake';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('World Monitor source adapter', () => {
  it('inventories OpenAPI operations without claiming that catalogued means connected', async () => {
    const root = await fixtureRoot();
    const repository = new FileWorldMonitorSourceRepository(root.dashboard, root.reference);
    const inventory = repository.buildInventory({
      generatedAt: '2026-07-28T12:00:00.000Z',
      productionConfigured: false,
    });

    // Counts reflect the built-in catalog (expanded in the v0.13.5 open-source
    // release) plus the two synthetic fixture services below.
    expect(inventory.service_count).toBe(64);
    expect(inventory.operation_count).toBe(66);
    expect(inventory.pollable_operation_count).toBe(63);
    expect(inventory.sandbox_operation_count).toBe(1);
    expect(inventory.operations.find((item) => item.operation_id === 'ListEarthquakes')?.access_state).toBe('sandbox_available');
    expect(inventory.operations.find((item) => item.operation_id === 'GetCountryRisk')?.evidence_eligibility).toBe('context_only');
    expect(inventory.operations.find((item) => item.operation_id === 'GetRequired')?.access_state).toBe('requires_parameters');
    expect(inventory.operations.find((item) => item.operation_id === 'ListEarthquakes')?.governance.governance_state).toBe('review_required');
    const directUsgs = inventory.operations.find((item) => item.operation_id === 'DirectUSGSEarthquakes');
    expect(directUsgs?.governance).toMatchObject({
      governance_state: 'research_ready',
      raw_payload_policy: 'transient_hash_only',
      retention_days: 0,
      redistribution_allowed: false,
    });
    expect(inventory.guardrail_check.catalog_is_not_connectivity_claim).toBe(true);
  });

  it('treats sandbox payloads as contract fixtures and never as Evidence candidates', () => {
    const descriptor = operation({ operation_id: 'ListEarthquakes', sandbox_fixture: 'https://example.test/list-earthquakes.json' });
    const payload = livePayload(descriptor, { events: [{ id: 'eq-1', title: 'Magnitude 5.0 earthquake' }] }, 'sandbox');
    expect(signalsFromWorldMonitorPayload(payload)).toEqual([]);
  });

  it('creates traceable low-strength unresolved candidates from live records', async () => {
    const descriptor = operation({ operation_id: 'ListEarthquakes' });
    const payload = livePayload(descriptor, {
      events: [{ id: 'eq-1', title: 'Magnitude 5.0 earthquake', magnitude: 5, timestamp: '2026-07-28T11:00:00.000Z' }],
    });
    const inventory = inventoryFor(descriptor);
    const useCase = new SyncWorldMonitorSourcesUseCase({
      buildInventory: () => inventory,
      fetchOperation: async () => ({
        descriptor,
        payload,
        status: 'ok',
        httpStatus: 200,
        message: 'ok',
      }),
      seenPayloadHashes: () => new Set(),
      existingEvidenceIds: () => new Set(),
      writeInventory: () => undefined,
      writeSyncReport: () => undefined,
      readFactState: () => null,
      writeFactState: () => undefined,
      writeIntakeSession: () => undefined,
      resolveTopics: () => undefined,
      validateInventory: () => undefined,
      validateReport: () => undefined,
      validateFactState: () => undefined,
      validateSession: () => undefined,
      validateCandidate: () => undefined,
      now: () => '2026-07-28T12:00:00.000Z',
      productionConfigured: () => true,
    });

    const result = await useCase.execute({ mode: 'live' });
    const report = result.report;
    const session = result.session as EvidenceIntakeSession;

    expect(report.candidate_count).toBe(1);
    expect(report.records[0]).toMatchObject({
      governance_state: 'research_ready',
      raw_payload_retained: false,
      candidate_count: 1,
      selected_candidate_count: 1,
    });
    expect(session.candidates).toHaveLength(1);
    const candidate = session.candidates[0];
    expect(candidate.suggested_evidence.topic_id).toBe('unknown_topic');
    expect(candidate.suggested_evidence.branch_id).toBeNull();
    expect(candidate.suggested_evidence.scope).toBe('parent');
    expect(candidate.suggested_evidence.evidence_strength).toBe('E1');
    expect(candidate.suggested_evidence.stage_effect).toBe('maintain');
    expect(candidate.suggested_evidence.confidence).toBe('low');
    const provenance = session.provenance_records[0];
    expect(session.raw_document.text.slice(provenance.quote_start_offset, provenance.quote_end_offset)).toBe(provenance.quote);
    expect(session.review_template[0].decision).toBe('accept');
  });

  it('suppresses repeated payload hashes and context-only output', async () => {
    const descriptor = operation({ operation_id: 'GetCountryRisk', evidence_eligibility: 'context_only' });
    const payload = livePayload(descriptor, { countryCode: 'US', combinedScore: 42 });
    const useCase = new SyncWorldMonitorSourcesUseCase({
      buildInventory: () => inventoryFor(descriptor),
      fetchOperation: async () => ({ descriptor, payload, status: 'ok', httpStatus: 200, message: 'ok' }),
      seenPayloadHashes: () => new Set([payload.payload_hash]),
      existingEvidenceIds: () => new Set(),
      writeInventory: () => undefined,
      writeSyncReport: () => undefined,
      readFactState: () => null,
      writeFactState: () => undefined,
      writeIntakeSession: () => { throw new Error('no session expected'); },
      resolveTopics: () => { throw new Error('no topic audit expected'); },
      validateInventory: () => undefined,
      validateReport: () => undefined,
      validateFactState: () => undefined,
      validateSession: () => undefined,
      validateCandidate: () => undefined,
      now: () => '2026-07-28T12:00:00.000Z',
      productionConfigured: () => true,
    });
    const result = await useCase.execute({ mode: 'live', includeContext: true });
    expect(result.report.candidate_count).toBe(0);
    expect(result.report.records[0].status).toBe('skipped');
    expect(result.report.guardrail_check.context_only_not_scored).toBe(true);
  });

  it('fails closed when the production key is missing', async () => {
    let called = false;
    const client = new WorldMonitorHttpClient(null, async () => {
      called = true;
      throw new Error('network should not be called');
    });
    const result = await client.fetchOperation(operation({ operation_id: 'ListEarthquakes' }), 'live');
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('WORLDMONITOR_API_KEY');
    expect(called).toBe(false);
  });

  it('retries one transient GET failure without bypassing governance', async () => {
    let attempts = 0;
    const client = new WorldMonitorHttpClient(null, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary timeout');
      return new Response(JSON.stringify({ events: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const result = await client.fetchOperation(operation({ auth_requirement: 'public_no_key' }), 'live');
    expect(result.status).toBe('ok');
    expect(attempts).toBe(2);
    expect(result.descriptor.governance.governance_state).toBe('research_ready');
  });
});

async function fixtureRoot() {
  const base = await mkdtemp(resolve(tmpdir(), 'narrative-worldmonitor-'));
  temporaryPaths.push(base);
  const dashboard = resolve(base, 'dashboard');
  const reference = resolve(base, 'worldmonitor');
  mkdirSync(resolve(reference, 'docs/api'), { recursive: true });
  mkdirSync(resolve(reference, 'public/sandbox'), { recursive: true });
  mkdirSync(dashboard, { recursive: true });
  writeFileSync(resolve(reference, 'docs/api/TestService.openapi.json'), JSON.stringify({
    paths: {
      '/api/seismology/v1/list-earthquakes': { get: { operationId: 'ListEarthquakes', parameters: [] } },
      '/api/intelligence/v1/get-country-risk': { get: { operationId: 'GetCountryRisk', parameters: [] } },
      '/api/test/v1/required': { get: { operationId: 'GetRequired', parameters: [{ name: 'country', required: true }] } },
    },
  }));
  writeFileSync(resolve(reference, 'public/sandbox/index.json'), JSON.stringify({
    operations: [{
      operationId: 'ListEarthquakes',
      fixture: 'https://example.test/list-earthquakes.json',
      productionUrl: 'https://api.example.test/api/seismology/v1/list-earthquakes',
    }],
  }));
  writeFileSync(resolve(reference, 'public/sandbox/list-earthquakes.json'), JSON.stringify({
    response: { body: { events: [{ id: 'eq-1' }] } },
  }));
  return { dashboard, reference };
}

function operation(overrides: Partial<WorldMonitorOperationDescriptor>): WorldMonitorOperationDescriptor {
  return {
    operation_id: 'ListEarthquakes',
    service: 'SeismologyService',
    method: 'GET',
    path: '/api/seismology/v1/list-earthquakes',
    summary: 'List earthquakes',
    description: '',
    required_parameters: [],
    optional_parameters: [],
    domain: 'climate',
    evidence_eligibility: 'candidate',
    auth_requirement: 'worldmonitor_key',
    access_state: 'production_ready',
    sandbox_fixture: null,
    production_url: 'https://api.example.test/api/seismology/v1/list-earthquakes',
    normalizer_id: 'generic_record',
    normalizer_version: '1.0.0',
    governance: {
      source_class: 'direct_public',
      governance_state: 'research_ready',
      terms_status: 'public_documented',
      license_id: 'test-public-data',
      terms_url: 'https://example.test/terms',
      attribution_required: true,
      redistribution_allowed: false,
      sensitivity: 'public',
      raw_payload_policy: 'transient_hash_only',
      retention_days: 0,
      freshness_window_hours: 24,
      automated_polling_allowed: true,
      observation_window: 'sliding_time',
      absence_assertion_allowed: false,
    },
    ...overrides,
  };
}

function livePayload(
  descriptor: WorldMonitorOperationDescriptor,
  body: unknown,
  mode: 'live' | 'sandbox' = 'live',
): WorldMonitorPayload {
  return {
    descriptor,
    fetched_at: '2026-07-28T12:00:00.000Z',
    source_url: descriptor.production_url,
    mode,
    body,
    payload_hash: 'abcdef0123456789',
    degraded: false,
    stale: false,
  };
}

function inventoryFor(descriptor: WorldMonitorOperationDescriptor): WorldMonitorSourceInventory {
  return {
    artifact_type: 'worldmonitor_source_inventory',
    schema_version: '1.0.0',
    producer_version: '0.7.5',
    generated_at: '2026-07-28T12:00:00.000Z',
    reference_root: '/tmp/worldmonitor',
    production_configured: true,
    service_count: 1,
    operation_count: 1,
    pollable_operation_count: 1,
    candidate_operation_count: descriptor.evidence_eligibility === 'candidate' ? 1 : 0,
    context_only_operation_count: descriptor.evidence_eligibility === 'context_only' ? 1 : 0,
    unsupported_operation_count: descriptor.evidence_eligibility === 'unsupported' ? 1 : 0,
    sandbox_operation_count: descriptor.sandbox_fixture ? 1 : 0,
    operations: [descriptor],
    guardrail_check: {
      catalog_is_not_connectivity_claim: true,
      sandbox_is_not_live_evidence: true,
      human_review_required: true,
      no_trading_advice: true,
    },
  };
}
