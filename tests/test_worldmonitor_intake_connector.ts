import { describe, expect, it } from 'vitest';
import { WorldMonitorIntakeConnector } from '@/features/worldmonitor/pipeline/worldmonitor_intake_connector';
import type { WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

describe('WorldMonitorIntakeConnector', () => {
  it('correctly retrieves catalog configurations for known World Monitor data sources', () => {
    const gdeltConfig = WorldMonitorIntakeConnector.getSourceConfig('gdelt_doc_articles');
    expect(gdeltConfig.domain).toBe('osint');
    expect(gdeltConfig.primary_layer).toBe('name');
    expect(gdeltConfig.default_evidence_strength).toBe('E1');

    const comtradeConfig = WorldMonitorIntakeConnector.getSourceConfig('un_comtrade_preview');
    expect(comtradeConfig.domain).toBe('financial');
    expect(comtradeConfig.primary_layer).toBe('reality');
    expect(comtradeConfig.default_evidence_strength).toBe('E3');

    const coinbaseConfig = WorldMonitorIntakeConnector.getSourceConfig('coinbase_spot');
    expect(coinbaseConfig.domain).toBe('financial');
    expect(coinbaseConfig.primary_layer).toBe('capital');
    expect(coinbaseConfig.default_evidence_strength).toBe('E2');
  });

  it('converts an incoming World Monitor signal into a valid EvidenceCandidate', () => {
    const signal: WorldMonitorSignal = {
      signal_id: 'sig-comtrade-001',
      source_id: 'un_comtrade_preview',
      domain: 'financial',
      timestamp: '2026-07-28T10:00:00.000Z',
      event_date: '2026-07-28',
      event_title: 'Rare Earth Concentrate Export Flow Surge',
      event_summary: 'Customs recorded a 23% MoM jump in rare earth concentrate export volume.',
      event_type: 'TRADE_FLOW_RECORDED',
      source_name: 'UN Comtrade Public Preview API',
      source_url: 'https://comtradeapi.un.org',
      metrics: { export_volume_kg: 520000, mom_change_pct: 23 },
      confidence_score: 0.95,
    };

    const converted = WorldMonitorIntakeConnector.convertSignalToCandidate(
      signal,
      'topic_energy_security',
      'branch_suez_corridor'
    );

    expect(converted.signal.signal_id).toBe('sig-comtrade-001');
    expect(converted.candidate.candidate_id).toBe('cand-wm-sig-comtrade-001');
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
        signal_id: 'sig-gdelt-101',
        source_id: 'gdelt_doc_articles',
        domain: 'osint',
        timestamp: '2026-07-28T10:05:00.000Z',
        event_date: '2026-07-28',
        event_title: 'Global Semiconductor Supply Chain Realignment',
        event_summary: 'Major chipmakers announced capacity shifts amid export control changes.',
        event_type: 'GLOBAL_NEWS_EVENT',
        source_name: 'GDELT DOC 2.0 Global News Articles',
        confidence_score: 0.9,
      },
      {
        signal_id: 'sig-coinbase-202',
        source_id: 'coinbase_spot',
        domain: 'financial',
        timestamp: '2026-07-28T10:10:00.000Z',
        event_date: '2026-07-28',
        event_title: 'BTC-USD Spot Price Volatility Spike',
        event_summary: 'BTC-USD traded up 4.1% intraday on heavy institutional volume.',
        event_type: 'CRYPTO_SPOT_PRICE',
        source_name: 'Coinbase Public Spot Price Quotes',
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
