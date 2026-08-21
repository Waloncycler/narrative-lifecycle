import { describe, expect, it } from 'vitest';
import { buildGateAcquisitionQueries } from '@/features/research/domain/gate_source_strategy';
import type { AcquisitionTask } from '@/features/research/domain/evidence_gate_coverage';
import type { AuthoritativeResearchSource } from '@/features/research/types/research_coverage';

function source(source_id: string, base_url: string, layers: AuthoritativeResearchSource['coverage_layers'], domains = ['cross_industry']): AuthoritativeResearchSource {
  return {
    source_id, display_name_zh: source_id, display_name_en: source_id, operator: source_id,
    authority_tier: 'filing', domains, coverage_layers: layers, access_mode: 'search_bridge', base_url,
    terms_url: base_url, automated_polling_allowed: false, review_required: true, evidence_ceiling: 'E3',
    topic_discovery_capable: true, branch_discovery_capable: true, languages: ['zh'],
  };
}

function task(overrides: Partial<AcquisitionTask> = {}): AcquisitionTask {
  return {
    topic_id: 'solid_state_battery', topic_name: '固态电池', gate: 'capital', layer: 'capital', verdict: 'single_source',
    net_support: 20, independent_publishers: 1, existing_publishers: ['巨潮资讯'], existing_source_domains: ['cninfo.com.cn'],
    priority: 33, suggested_targets: ['定增/IPO 受理'], ...overrides,
  };
}

describe('gate source strategy', () => {
  it('combines broad discovery with an authority-constrained query', () => {
    const queries = buildGateAcquisitionQueries({
      task: task(), limit: 2,
      atlas: { atlas_version: 'test', sources: [
        source('cninfo', 'https://www.cninfo.com.cn/', ['capital']),
        source('sse_disclosures', 'https://www.sse.com.cn/', ['capital']),
      ] },
    });
    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatchObject({ strategy: 'broad_discovery', source_domains: [] });
    expect(queries[0]?.query).toContain('-site:cninfo.com.cn');
    expect(queries[1]).toMatchObject({ strategy: 'authoritative_domain', source_ids: ['sse_disclosures'], strict_source_domains: ['sse.com.cn'] });
  });

  it('uses governed market taxonomy domains for the stable-label gate', () => {
    const queries = buildGateAcquisitionQueries({
      task: task({ gate: 'stable_label', layer: 'perception', existing_publishers: [], existing_source_domains: [] }),
      atlas: { atlas_version: 'test', sources: [] }, limit: 3,
    });
    expect(queries.map((query) => query.source_domains[0]).filter(Boolean)).toEqual(['data.eastmoney.com', '10jqka.com.cn']);
    expect(queries.every((query) => query.target_layer === 'name')).toBe(true);
  });

  it('adds official company sources for a matching Topic', () => {
    const queries = buildGateAcquisitionQueries({
      task: task(), atlas: { atlas_version: 'test', sources: [source('cninfo', 'https://www.cninfo.com.cn/', ['capital'])] },
      companies: { registry_version: 'test', companies: [{
        company_id: 'catl', display_name_zh: '宁德时代', display_name_en: 'CATL', market: 'china',
        official_source_url: 'https://www.catl.com/en/investors/', disclosure_source_ids: ['cninfo'],
        coverage_node_ids: ['solid_state_battery'], aliases: ['CATL'], status: 'curated',
      }] }, limit: 3,
    });
    expect(queries.map((query) => query.source_ids[0]).filter(Boolean)).toEqual(['company_catl']);
    expect(queries[1]?.strict_source_domains).toEqual(['catl.com']);
  });
});
