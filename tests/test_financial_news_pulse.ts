import { describe, expect, it } from 'vitest';
import { buildFinancialNewsPulseQueries } from '@/app/use_cases/run_research_campaign_use_case';
import { isFinancialNewsProbe, selectSourceRetrievalTargets } from '@/features/research/domain/research_source_retrieval';
import type { ResearchCampaign } from '@/features/research/types/research_coverage';
import type { ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';

const campaign = {
  tasks: [
    { task_id: 'topic_bci', node_kind: 'formal_topic', topic_id: 'bci', branch_id: null, candidate_node_id: null, display_name_zh: '脑机接口', display_name_en: 'Brain computer interface', priority: 95 },
    { task_id: 'branch_bci_rehab', node_kind: 'branch', topic_id: 'bci', branch_id: 'bci_medical_rehab', candidate_node_id: null, display_name_zh: '脑机接口医疗康复', display_name_en: 'BCI rehabilitation', priority: 80 },
  ],
} as unknown as ResearchCampaign;

function report(items: ResearchLeadTriageReport['items']): ResearchLeadTriageReport {
  return { artifact_type: 'research_lead_triage_report', schema_version: '1.0.0', producer_version: 'test', triage_id: 'triage', generated_at: '2026-08-13T00:00:00.000Z', web_research_id: null, direct_research_id: null, input_lead_count: items.length, triaged_lead_count: items.length, summary: { priority_review_count: 0, review_count: items.length, reference_only_count: 0, hold_count: 0, duplicate_count: 0, official_or_academic_count: 0 }, items, guardrail_check: { input_results_remain_context_only: true, no_auto_evidence_import: true, evidence_table_required_for_stage: true, parent_branch_separation: true, no_trading_advice: true } };
}

describe('financial news pulse', () => {
  it('creates bounded, site-restricted news discovery without changing scope', () => {
    const queries = buildFinancialNewsPulseQueries(campaign, 4);
    expect(queries).toHaveLength(4);
    expect(queries.every((item) => item.query.endsWith('财经新闻'))).toBe(true);
    expect(queries.map((item) => item.strict_source_domains?.[0])).toEqual(['wallstreetcn.com', 'cls.cn', 'finance.sina.com.cn', 'cn.wsj.com']);
    expect(queries[1]).toMatchObject({ topic_id: 'bci', branch_id: 'bci_medical_rehab' });
  });

  it('allows media pages only as bounded deep-probe inputs', () => {
    const media = { source_class: 'secondary' as const, source_domain: 'www.cls.cn' };
    const ordinary = { source_class: 'secondary' as const, source_domain: 'example.com' };
    expect(isFinancialNewsProbe(media)).toBe(true);
    expect(isFinancialNewsProbe({ source_class: 'secondary', source_domain: 'finance.sina.com.cn' })).toBe(true);
    expect(isFinancialNewsProbe({ source_class: 'secondary', source_domain: 'cn.wsj.com' })).toBe(true);
    expect(isFinancialNewsProbe(ordinary)).toBe(false);
    const items = [
      { triage_id: 'media', origin: 'web' as const, origin_lead_id: 'media', duplicate_origin_lead_ids: [], topic_id: 'bci', branch_id: null, candidate_node_id: null, title: '新闻', url: 'https://www.cls.cn/detail/1', source_name: '财联社', source_domain: 'www.cls.cn', snippet: '脑机接口', published_at: '2026-08-13T00:00:00.000Z', retrieved_at: '2026-08-13T00:00:00.000Z', source_class: 'secondary' as const, relevance: 'explicit' as const, freshness: 'fresh' as const, priority_score: 62, priority: 'medium' as const, disposition: 'review' as const, reasons: [], next_action: 'retrieve_primary_source' as const, evidence_eligibility: 'context_only' as const },
      { triage_id: 'other', origin: 'web' as const, origin_lead_id: 'other', duplicate_origin_lead_ids: [], topic_id: 'bci', branch_id: null, candidate_node_id: null, title: '其他', url: 'https://example.com/1', source_name: '其他', source_domain: 'example.com', snippet: '脑机接口', published_at: '2026-08-13T00:00:00.000Z', retrieved_at: '2026-08-13T00:00:00.000Z', source_class: 'secondary' as const, relevance: 'explicit' as const, freshness: 'fresh' as const, priority_score: 62, priority: 'medium' as const, disposition: 'review' as const, reasons: [], next_action: 'retrieve_primary_source' as const, evidence_eligibility: 'context_only' as const },
    ];
    expect(selectSourceRetrievalTargets(report(items), 4).map((item) => item.triage_id)).toEqual(['media']);
  });
});
