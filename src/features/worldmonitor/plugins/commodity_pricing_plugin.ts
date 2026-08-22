import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';
import { fetchCommodityPricing, type CommodityPriceFact } from '../io/commodity_pricing_provider';

export class CommodityPricingPlugin implements SourcePlugin<CommodityPriceFact> {
  readonly id = 'commodity_pricing_telemetry';
  readonly name = '微观产业链现货价格与开工率遥测 (百川盈孚 / 集邦 TrendForce)';
  readonly category = 'financial' as const;
  readonly domain = 'financial';
  readonly defaultEvidenceStrength = 'E2' as const;
  readonly defaultTargetLayers = ['pricing', 'reality', 'capital'] as const;

  async fetchRaw(_ctx: PluginExecutionContext): Promise<CommodityPriceFact[]> {
    return await fetchCommodityPricing();
  }

  normalize(item: CommodityPriceFact, _ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.item_name || !item.spot_price) return null;
    return {
      source_id: this.id,
      source_name: item.source_name,
      source_url: item.source_url,
      source_kind: 'COMMODITY_PRICING',
      title: `【现货遥测】${item.item_name} ${item.spot_price}${item.unit} (周变动 ${item.wow_change_pct})`,
      summary: `分类：${item.category}，行业开工率：${item.operating_rate_pct}，库存周转：${item.inventory_days}天。${item.summary}`,
      event_date: item.event_date,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'MARKET_FACT',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: null,
      raw_payload: item as unknown as Record<string, unknown>,
    };
  }
}
