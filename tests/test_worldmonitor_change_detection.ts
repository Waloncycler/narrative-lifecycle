import { describe, expect, it } from 'vitest';
import { buildWorldMonitorFactState } from '@/features/worldmonitor/domain/worldmonitor_change_detection';
import type { WorldMonitorFactState, WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

describe('World Monitor fact change detection', () => {
  it('queues new and updated facts but suppresses unchanged facts', () => {
    const first = build(null, [signal({ event_summary: 'Magnitude 5.0.' })], new Set(['DirectUSGSEarthquakes']), '2026-07-28T10:00:00.000Z');
    expect(first.state.new_fact_count).toBe(1);
    expect(first.actionableSignals).toHaveLength(1);

    const unchanged = build(first.state, [signal({ event_summary: 'Magnitude 5.0.' })], new Set(['DirectUSGSEarthquakes']), '2026-07-28T11:00:00.000Z');
    expect(unchanged.state.unchanged_fact_count).toBe(1);
    expect(unchanged.actionableSignals).toEqual([]);
    expect(unchanged.state.facts[0].first_seen_at).toBe('2026-07-28T10:00:00.000Z');
    expect(unchanged.state.facts[0].last_seen_at).toBe('2026-07-28T11:00:00.000Z');

    const updated = build(unchanged.state, [signal({ event_summary: 'Magnitude revised to 5.2.', metrics: { magnitude: 5.2 } })], new Set(['DirectUSGSEarthquakes']), '2026-07-28T12:00:00.000Z');
    expect(updated.state.updated_fact_count).toBe(1);
    expect(updated.state.material_update_count).toBe(1);
    expect(updated.state.suppressed_update_count).toBe(0);
    expect(updated.actionableSignals).toHaveLength(1);
    expect(updated.state.changes[0]).toMatchObject({
      actionable: true,
      materiality_policy: 'DirectUSGSEarthquakes_metric_threshold_v1',
    });
    expect(updated.state.changes[0].metric_deltas[0]).toMatchObject({
      metric: 'magnitude',
      previous: 5,
      current: 5.2,
    });
  });

  it('suppresses below-threshold metric revisions while retaining them in the audit ledger', () => {
    const first = build(null, [signal({})], new Set(['DirectUSGSEarthquakes']), '2026-07-28T10:00:00.000Z');
    const revised = build(first.state, [signal({
      event_summary: 'Magnitude revised to 5.05.',
      metrics: { magnitude: 5.05 },
    })], new Set(['DirectUSGSEarthquakes']), '2026-07-28T11:00:00.000Z');

    expect(revised.state.updated_fact_count).toBe(1);
    expect(revised.state.material_update_count).toBe(0);
    expect(revised.state.suppressed_update_count).toBe(1);
    expect(revised.actionableSignals).toEqual([]);
    expect(revised.state.changes[0]).toMatchObject({
      actionable: false,
      materiality_reason: 'The revision stayed below source-specific metric thresholds.',
    });
  });

  it('keeps official alert text revisions actionable when numeric metrics are absent', () => {
    const nws = signal({
      operation_id: 'DirectNWSAlerts',
      normalizer_id: 'nws_alert',
      event_summary: 'Moderate alert.',
      metrics: { severity_level: 2, urgency_level: 3, certainty_level: 3 },
    });
    const first = build(null, [nws], new Set(['DirectNWSAlerts']), '2026-07-28T10:00:00.000Z');
    const revised = build(first.state, [{
      ...nws,
      event_summary: 'Severe alert.',
      metrics: { severity_level: 3, urgency_level: 3, certainty_level: 3 },
    }], new Set(['DirectNWSAlerts']), '2026-07-28T11:00:00.000Z');

    expect(revised.actionableSignals).toHaveLength(1);
    expect(revised.state.changes[0]).toMatchObject({
      actionable: true,
      materiality_policy: 'DirectNWSAlerts_metric_threshold_v1',
    });
  });

  it('records disappearance from a successful bounded feed as not_observed, never Evidence', () => {
    const first = build(null, [signal({})], new Set(['DirectUSGSEarthquakes']), '2026-07-28T10:00:00.000Z');
    const next = build(first.state, [], new Set(['DirectUSGSEarthquakes']), '2026-07-28T11:00:00.000Z');
    expect(next.state.not_observed_fact_count).toBe(1);
    expect(next.state.facts).toHaveLength(1);
    expect(next.actionableSignals).toEqual([]);
    expect(next.state.guardrail_check.not_observed_not_evidence).toBe(true);
  });

  it('does not treat failed or unpolled sources as removals', () => {
    const first = build(null, [signal({})], new Set(['DirectUSGSEarthquakes']), '2026-07-28T10:00:00.000Z');
    const failed = build(first.state, [], new Set(), '2026-07-28T11:00:00.000Z');
    expect(failed.state.not_observed_fact_count).toBe(0);
    expect(failed.state.facts).toHaveLength(1);
    expect(failed.state.guardrail_check.failed_source_not_treated_as_removal).toBe(true);
  });
});

function build(
  previous: WorldMonitorFactState | null,
  signals: WorldMonitorSignal[],
  observedOperationIds: Set<string>,
  generatedAt: string,
) {
  return buildWorldMonitorFactState({
    signals,
    previous,
    observedOperationIds,
    absenceAssertableOperationIds: observedOperationIds,
    generatedAt,
    syncId: `sync_${generatedAt}`,
  });
}

function signal(overrides: Partial<WorldMonitorSignal>): WorldMonitorSignal {
  return {
    signal_id: 'signal_eq_1',
    upstream_record_id: 'eq-1',
    source_id: 'usgs',
    operation_id: 'DirectUSGSEarthquakes',
    domain: 'climate',
    timestamp: '2026-07-28T09:00:00.000Z',
    available_at: '2026-07-28T09:00:00.000Z',
    event_date: '2026-07-28',
    event_title: 'Test earthquake',
    event_summary: 'Magnitude 5.0.',
    event_type: 'EARTHQUAKE_RECORDED',
    source_name: 'Direct public / USGS',
    source_url: 'https://example.test/eq-1',
    metrics: { magnitude: 5 },
    confidence_score: 0.6,
    normalizer_id: 'usgs_earthquake',
    normalizer_version: '1.0.0',
    ...overrides,
  };
}
