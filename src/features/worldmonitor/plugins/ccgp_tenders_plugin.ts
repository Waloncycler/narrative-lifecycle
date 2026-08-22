import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';
import { fetchCcgpTenders, type TenderFact } from '../io/ccgp_tenders_provider';

export class CcgpTendersPlugin implements SourcePlugin<TenderFact> {
  readonly id = 'ccgp_central_tenders';
  readonly name = '中国政府采购网 (CCGP) 重大硬科技采购与中标流';
  readonly category = 'official' as const;
  readonly domain = 'official';
  readonly defaultEvidenceStrength = 'E3' as const;
  readonly defaultTargetLayers = ['capital', 'reality'] as const;

  async fetchRaw(_ctx: PluginExecutionContext): Promise<TenderFact[]> {
    return await fetchCcgpTenders();
  }

  normalize(item: TenderFact, _ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.title) return null;
    return {
      source_id: this.id,
      source_name: `中国政府采购网 (${item.purchaser})`,
      source_url: item.source_url,
      source_kind: 'GOVERNMENT_TENDER',
      title: item.title,
      summary: `项目分类：${item.category}，中标人：${item.winning_bidder}，金额：${item.amount_rmb}。${item.summary}`,
      event_date: item.event_date,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'OFFICIAL_CONTRACT',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: item.source_url.toLowerCase().endsWith('.pdf') ? item.source_url : null,
      raw_payload: item as unknown as Record<string, unknown>,
    };
  }
}
