import { describe, expect, it } from 'vitest';
import { newsImportance, rankNewsSignals } from '@/features/research/domain/news_importance';
import type { WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

function signal(overrides: Partial<WorldMonitorSignal> = {}): WorldMonitorSignal {
  return {
    signal_id: 'news-1',
    source_id: 'sina_finance',
    operation_id: 'DirectSinaFinance',
    domain: 'financial',
    timestamp: '2026-08-13T08:00:00.000Z',
    event_date: '2026-08-13',
    event_title: '普通行业动态',
    event_summary: '新闻摘要',
    event_type: 'NEWS_ARTICLE_PUBLISHED',
    source_name: 'Sina Finance',
    confidence_score: 0.4,
    ...overrides,
  };
}

describe('news importance triage', () => {
  it('prioritizes widely read quantified material events for deep probing', () => {
    const important = signal({
      event_title: '国家药监局批准38个创新药上市',
      event_summary: '其中11个为新靶点新机制国产创新药，涉及6个治疗领域。',
      metrics: { read_count: 2_938_500 },
    });
    const result = newsImportance(important, '2026-08-13T10:00:00.000Z');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.probeRecommended).toBe(true);
  });

  it('keeps importance separate from lifecycle and Evidence fields', () => {
    const input = signal({ metrics: { read_count: 100_000 } });
    const [ranked] = rankNewsSignals([input], '2026-08-13T10:00:00.000Z');
    expect(ranked.metrics?.news_importance_score).toBeTypeOf('number');
    expect(ranked).not.toHaveProperty('evidence_strength');
    expect(ranked).not.toHaveProperty('stage_effect');
  });
});
