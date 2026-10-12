import { describe, expect, it } from 'vitest';
import { analyzeNewsEvidenceSignals, selectNewsEvidenceSignals } from '@/features/research/domain/news_evidence_funnel';
import type { WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

describe('news evidence funnel', () => {
  it('separates evidence potential from popularity and maps cross-industry topics', () => {
    const signals = analyzeNewsEvidenceSignals({
      signals: [
        news('approval', '国家药监局批准38个1类创新药上市，其中11款为新靶点药物', '国家药监局发布批准记录，包含38和11两个数字。', 2),
        news('viral', '明星评论AI未来', '一篇阅读量很高的观点文章，预计人工智能未来可能改变市场。', 100_000),
      ],
      registry: { canonical_topics: [{ topic_id: 'innovative_drugs', topic_name: '创新药', current_stage: 'S0', status: 'active' }], aliases: [{ alias: '1类创新药', topic_id: 'innovative_drugs', reason: 'test' }], branches: [], provisional_topics: [], memory_topic_ids: [] },
      universe: { universe_version: 'test', nodes: [] }, companies: { registry_version: 'test', companies: [] },
    });
    expect(signals[0]?.research_analysis).toMatchObject({ event_class: 'regulatory', topic_id: 'innovative_drugs', evidence_lane: 'direct_fact' });
    expect(signals[0]!.research_analysis!.evidence_potential_score).toBeGreaterThan(signals[1]!.research_analysis!.evidence_potential_score);
  });

  it('deduplicates event clusters and balances topic and event buckets', () => {
    const base = [
      analyzed('a1', 'topic_a', 'regulatory', 'cluster_a', 90), analyzed('a2', 'topic_a', 'regulatory', 'cluster_a', 80),
      analyzed('b1', 'topic_b', 'clinical', 'cluster_b', 70), analyzed('c1', null, 'financing', 'cluster_c', 65),
    ];
    const result = selectNewsEvidenceSignals({ signals: base, limit: 3, generatedAt: '2026-08-14T00:00:00.000Z' });
    expect(result.signals.map((item) => item.signal_id)).toEqual(expect.arrayContaining(['a1', 'b1', 'c1']));
    expect(result.report).toMatchObject({ news_signal_count: 4, cluster_count: 3, suppressed_duplicate_count: 1, selected_count: 3 });
  });

  it('does not map incidental summary mentions or embedded acronyms', () => {
    const signals = analyzeNewsEvidenceSignals({
      signals: [news('incidental', '伦敦股市指数下跌', '成分股中包括一家房地产公司。', 10), news('acronym', 'CADCLOUD平台发布', '普通软件产品。', 10)],
      registry: { canonical_topics: [{ topic_id: 'real_estate', topic_name: '房地产', current_stage: 'S0', status: 'active' }, { topic_id: 'adc', topic_name: '抗体偶联药物', market_name_en: 'ADC', current_stage: 'S0', status: 'active' }], aliases: [], branches: [], provisional_topics: [], memory_topic_ids: [] },
      universe: { universe_version: 'test', nodes: [] }, companies: { registry_version: 'test', companies: [] },
    });
    expect(signals.map((signal) => signal.research_analysis?.topic_id)).toEqual([null, null]);
  });

  it('clusters identical headlines after publisher prefixes are removed', () => {
    const analyzedSignals = analyzeNewsEvidenceSignals({
      signals: [
        news('one', '【财联社】国家药监局批准创新药上市', '第一来源摘要。', 10),
        news('two', '新华社：国家药监局批准创新药上市', '第二来源摘要。', 20),
      ],
      registry: { canonical_topics: [], aliases: [], branches: [], provisional_topics: [], memory_topic_ids: [] },
      universe: { universe_version: 'test', nodes: [] }, companies: { registry_version: 'test', companies: [] },
    });
    const result = selectNewsEvidenceSignals({ signals: analyzedSignals, limit: 10, generatedAt: '2026-08-14T00:00:00.000Z' });
    expect(result.report.suppressed_duplicate_count).toBe(1);
    expect(result.signals).toHaveLength(1);
  });
});

function news(id: string, title: string, summary: string, reads: number): WorldMonitorSignal {
  return { signal_id: id, source_id: 'news', operation_id: 'DirectNews', domain: 'financial', timestamp: '2026-08-14T00:00:00.000Z', event_date: '2026-08-14', event_title: title, event_summary: summary, event_type: 'NEWS_ARTICLE_PUBLISHED', source_name: 'News', source_url: `https://news.example/${id}`, source_quote: summary, confidence_score: 0.5, metrics: { read_count: reads, news_importance_score: reads > 100 ? 100 : 10 } };
}

function analyzed(id: string, topic: string | null, eventClass: 'regulatory' | 'clinical' | 'financing', cluster: string, potential: number): WorldMonitorSignal {
  const signal = news(id, id, id, 1);
  signal.research_analysis = { event_class: eventClass, cluster_id: cluster, evidence_potential_score: potential, topic_id: topic, branch_id: null, mapping_basis: topic ? 'topic_term' : 'unresolved', evidence_lane: 'source_recovery', verification_targets: ['original_source'], reasons: [] };
  return signal;
}
