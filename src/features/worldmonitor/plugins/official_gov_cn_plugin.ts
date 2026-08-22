import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';

export interface GovCnRawDoc {
  title?: string;
  url?: string;
  puborg?: string;
  docno?: string;
  pubtime?: number | string;
  summary?: string;
}

export class OfficialGovCnPlugin implements SourcePlugin<GovCnRawDoc> {
  readonly id = 'official_gov_cn';
  readonly name = '中国政府网 (Gov.cn) 国务院与部委红头政策库';
  readonly category = 'official' as const;
  readonly domain = 'official';
  readonly defaultEvidenceStrength = 'E3' as const;
  readonly defaultTargetLayers = ['reality', 'capital', 'friction'] as const;

  async fetchRaw(ctx: PluginExecutionContext): Promise<GovCnRawDoc[]> {
    const timeoutMs = ctx.timeoutMs ?? 5000;
    const maxItems = ctx.maxItems ?? 20;
    const govUrl = `https://sousuo.www.gov.cn/search-gov/data?t=zhengce_gw&q=&timetype=timeqb&mintime=&maxtime=&sort=pubtime&sortType=1&nocorrect=1&num=${maxItems}&page=1`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(govUrl, {
        headers: {
          'User-Agent': ctx.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.gov.cn/zhengce/zuixin.htm',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return [];
      const json = await res.json();
      return json.searchVO?.catMap?.gxml || json.searchVO?.listVO || [];
    } catch {
      return [];
    }
  }

  normalize(item: GovCnRawDoc, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.title) return null;
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    let eventDate = today;

    if (typeof item.pubtime === 'number') {
      eventDate = new Date(item.pubtime).toISOString().slice(0, 10);
    } else if (typeof item.pubtime === 'string' && item.pubtime.length >= 10) {
      eventDate = item.pubtime.slice(0, 10);
    }

    const cleanTitle = item.title.replace(/<[^>]+>/g, '').trim();
    const cleanUrl = item.url || 'https://www.gov.cn/zhengce/';

    return {
      source_id: this.id,
      source_name: `中国政府网 (${item.puborg || '国务院'})`,
      source_url: cleanUrl,
      source_kind: 'MINISTRY_POLICY',
      title: cleanTitle,
      summary: `国务院/部委红头文件，文号：${item.docno || '公开印发'}，发布时间：${eventDate}`,
      event_date: eventDate,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'OFFICIAL_POLICY',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: cleanUrl.toLowerCase().endsWith('.pdf') ? cleanUrl : null,
      raw_payload: item as Record<string, unknown>,
    };
  }
}
