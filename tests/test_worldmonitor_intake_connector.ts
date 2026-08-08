import { describe, expect, it } from 'vitest';
import { WorldMonitorIntakeConnector } from '@/services/worldmonitor_intake_connector';
import type { WorldMonitorSignal } from '@/types/worldmonitor_adapter';

describe('WorldMonitorIntakeConnector', () => {
  it('correctly retrieves catalog configurations for known World Monitor data sources', () => {
    const acledConfig = WorldMonitorIntakeConnector.getSourceConfig('acled');
    expect(acledConfig.domain).toBe('geopolitics');
    expect(acledConfig.primary_layer).toBe('friction');
    expect(acledConfig.default_evidence_strength).toBe('E2');

    const portwatchConfig = WorldMonitorIntakeConnector.getSourceConfig('portwatch');
    expect(portwatchConfig.domain).toBe('energy');
    expect(portwatchConfig.primary_layer).toBe('reality');
    expect(portwatchConfig.default_evidence_strength).toBe('E3');

    const quotesConfig = WorldMonitorIntakeConnector.getSourceConfig('market_quotes');
    expect(quotesConfig.domain).toBe('financial');
    expect(quotesConfig.primary_layer).toBe('capital');
    expect(quotesConfig.default_evidence_strength).toBe('E2');
  });

  it('converts an incoming World Monitor signal into a valid EvidenceCandidate', () => {
    const signal: WorldMonitorSignal = {
      signal_id: 'sig-portwatch-001',
      source_id: 'portwatch',
      domain: 'energy',
      timestamp: '2026-07-28T10:00:00.000Z',
      event_date: '2026-07-28',
      event_title: 'Suez Canal Daily Transit Volume Drop',
      event_summary: 'Suez Canal vessel transit volume declined 18% YoY due to maritime tension.',
      event_type: 'PORT_DISRUPTION_ALERT',
      source_name: 'IMF PortWatch Chokepoint Tracker',
      source_url: 'https://portwatch.imf.org',
      metrics: { transit_count: 32, yoy_change_pct: -18 },
      confidence_score: 0.95,
    };

    const converted = WorldMonitorIntakeConnector.convertSignalToCandidate(
      signal,
      'topic_energy_security',
      'branch_suez_corridor'
    );

    expect(converted.signal.signal_id).toBe('sig-portwatch-001');
    expect(converted.candidate.candidate_id).toBe('cand-wm-sig-portwatch-001');
    expect(converted.candidate.suggested_evidence.topic_id).toBe('topic_energy_security');
    expect(converted.candidate.suggested_evidence.branch_id).toBe('branch_suez_corridor');
    expect(converted.candidate.suggested_evidence.scope).toBe('branch');
    expect(converted.candidate.suggested_evidence.affected_layer).toContain('reality');
    expect(converted.candidate.suggested_evidence.evidence_strength).toBe('E3');
    expect(converted.candidate.guardrail_check.human_review_required).toBe(false);
    expect(converted.candidate.guardrail_check.no_trading_advice).toBe(true);
  });

  it('processes a batch of World Monitor signals and generates batch results', () => {
    const signals: WorldMonitorSignal[] = [
      {
        signal_id: 'sig-eia-101',
        source_id: 'eia_petroleum',
        domain: 'energy',
        timestamp: '2026-07-28T10:05:00.000Z',
        event_date: '2026-07-28',
        event_title: 'US Crude Inventory Drawdown 4.2M Barrels',
        event_summary: 'Commercial crude stocks fell by 4.2 million barrels last week.',
        event_type: 'EIA_INVENTORY_DRAWDOWN',
        source_name: 'US EIA Weekly Petroleum Data',
        confidence_score: 0.9,
      },
      {
        signal_id: 'sig-cot-202',
        source_id: 'cftc_cot',
        domain: 'financial',
        timestamp: '2026-07-28T10:10:00.000Z',
        event_date: '2026-07-28',
        event_title: 'CFTC Crude Futures Net Long Positioning Jump',
        event_summary: 'Money manager net long positions increased by 12,500 contracts.',
        event_type: 'COT_POSITIONING_SHIFT',
        source_name: 'CFTC COT Reports',
        confidence_score: 0.85,
      },
    ];

    const result = WorldMonitorIntakeConnector.processSignalBatch(signals, 'topic_oil_market');

    expect(result.total_signals).toBe(2);
    expect(result.accepted_candidates.length).toBe(2);
    expect(result.errors.length).toBe(0);
    expect(result.skipped_signals_count).toBe(0);
    expect(result.accepted_candidates[0].candidate.suggested_evidence.topic_id).toBe('topic_oil_market');
    expect(result.accepted_candidates[0].candidate.suggested_evidence.scope).toBe('parent');
  });
});
