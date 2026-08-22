import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';

export interface CninfoAnnouncementRawItem {
  announcementId?: string;
  secCode?: string;
  secName?: string;
  announcementTitle?: string;
  announcementTime?: number;
  adjunctUrl?: string;
  adjunctSize?: number;
}

export class CninfoDisclosurePlugin implements SourcePlugin<CninfoAnnouncementRawItem> {
  readonly id = 'cninfo_disclosure';
  readonly name = '巨潮资讯网 (Cninfo) A股上市公司重大法定披露';
  readonly category = 'official' as const;
  readonly domain = 'official';
  readonly defaultEvidenceStrength = 'E2' as const;
  readonly defaultTargetLayers = ['capital', 'reality', 'pricing'] as const;

  async fetchRaw(ctx: PluginExecutionContext): Promise<CninfoAnnouncementRawItem[]> {
    const timeoutMs = ctx.timeoutMs ?? 5000;
    const maxItems = ctx.maxItems ?? 10;
    const cninfoUrl = 'http://www.cninfo.com.cn/new/hisAnnouncement/query';
    const body = new URLSearchParams({
      pageNum: '1',
      pageSize: String(maxItems),
      column: 'szse',
      tabName: 'fulltext',
      plate: '',
      stock: '',
      searchkey: '',
      secid: '',
      category: '',
      trade: '',
      seDate: '',
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(cninfoUrl, {
        method: 'POST',
        headers: {
          'User-Agent': ctx.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'http://www.cninfo.com.cn/',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return [];
      const json = await res.json();
      return json.announcements || [];
    } catch {
      return [];
    }
  }

  normalize(item: CninfoAnnouncementRawItem, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.announcementTitle || !item.secName) return null;
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    const eventDate = item.announcementTime ? new Date(item.announcementTime).toISOString().slice(0, 10) : today;
    const cleanTitle = item.announcementTitle.replace(/<[^>]+>/g, '').trim();
    const pdfUrl = item.adjunctUrl ? `http://static.cninfo.com.cn/${item.adjunctUrl}` : null;
    const pageUrl = item.adjunctUrl ? `http://www.cninfo.com.cn/${item.adjunctUrl}` : 'http://www.cninfo.com.cn/';

    return {
      source_id: this.id,
      source_name: `巨潮法定披露 (${item.secName} ${item.secCode})`,
      source_url: pageUrl,
      source_kind: 'CNINFO_DISCLOSURE',
      title: `【${item.secName} (${item.secCode})】${cleanTitle}`,
      summary: `上市公司法定披露，公告ID：${item.announcementId}，文件大小：${item.adjunctSize || 0}KB`,
      event_date: eventDate,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'MARKET_FACT',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: pdfUrl,
      raw_payload: item as Record<string, unknown>,
    };
  }
}
