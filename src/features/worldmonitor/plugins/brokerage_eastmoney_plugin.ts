import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';

export interface EastmoneyReportRawItem {
  infoCode?: string;
  title?: string;
  orgSName?: string;
  orgName?: string;
  industryName?: string;
  researcher?: string;
  emRatingName?: string;
  publishDate?: string;
  attachUrl?: string;
}

export class BrokerageEastmoneyPlugin implements SourcePlugin<EastmoneyReportRawItem> {
  readonly id = 'brokerage_eastmoney';
  readonly name = '东方财富券商行业深度研报中心';
  readonly category = 'financial' as const;
  readonly domain = 'financial';
  readonly defaultEvidenceStrength = 'E1' as const;
  readonly defaultTargetLayers = ['pricing', 'capital', 'reality'] as const;

  async fetchRaw(ctx: PluginExecutionContext): Promise<EastmoneyReportRawItem[]> {
    const timeoutMs = ctx.timeoutMs ?? 5000;
    const maxItems = ctx.maxItems ?? 10;
    const rptUrl = `https://reportapi.eastmoney.com/report/list?industryCode=*&pageSize=${maxItems}&industry=*&rating=&ratingChange=&beginTime=&endTime=&pageNo=1&fields=&qType=1&_=${Date.now()}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(rptUrl, {
        headers: {
          'User-Agent': ctx.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://data.eastmoney.com/report/',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  }

  normalize(item: EastmoneyReportRawItem, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.title || !item.infoCode) return null;
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    const eventDate = (item.publishDate || today).slice(0, 10);
    const orgName = item.orgSName || item.orgName || '头部券商';
    const reportUrl = `https://data.eastmoney.com/report/info/${item.infoCode}.html`;
    const pdfUrl = item.attachUrl || `https://pdf.dfcfw.com/pdf/H3_${item.infoCode}_1.pdf`;

    return {
      source_id: this.id,
      source_name: `券商研报 (${orgName})`,
      source_url: reportUrl,
      source_kind: 'BROKERAGE_REPORT',
      title: `【${orgName}】${item.title}`,
      summary: `行业分类：${item.industryName || '综合'}，作者：${item.researcher || '分析师'}，评级：${item.emRatingName || '无评级'}`,
      event_date: eventDate,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'RESEARCH_REPORT',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: pdfUrl,
      raw_payload: item as Record<string, unknown>,
    };
  }
}
