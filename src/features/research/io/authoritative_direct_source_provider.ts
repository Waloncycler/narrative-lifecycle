import type { AuthoritativeResearchSource, ResearchCampaignTask } from '@/features/research/types/research_coverage';
import { directSourceQuery, supportsTermQuery } from '@/features/research/domain/direct_source_research';

export interface DirectSourceSearchRow {
  title: string;
  url: string;
  snippet: string;
  published_at: string | null;
  /** Some official full-text indexes confirm the campaign term server-side
   * even when a filing's short title is only its form and issuer. */
  term_match_verified?: boolean;
}

/**
 * Small set of public, term-addressable APIs. Static feeds are intentionally
 * excluded: a public endpoint must accept the campaign's own query before it
 * may be used as a topic-specific source.
 */
export class AuthoritativeDirectSourceProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  supports(source: AuthoritativeResearchSource): boolean {
    return supportsTermQuery(source);
  }

  async search(input: { source: AuthoritativeResearchSource; task: ResearchCampaignTask; maxResults: number; timeoutMs: number }): Promise<DirectSourceSearchRow[]> {
    const query = directSourceQuery(input.source, input.task);
    switch (input.source.source_id) {
      case 'clinicaltrials': return this.clinicalTrials(query, input.maxResults, input.timeoutMs);
      case 'pubmed': return this.pubMed(query, input.maxResults, input.timeoutMs);
      case 'europe_pmc': return this.europePmc(query, input.maxResults, input.timeoutMs);
      case 'crossref': return this.crossref(query, input.maxResults, input.timeoutMs);
      case 'openalex': return this.openAlex(query, input.maxResults, input.timeoutMs);
      case 'arxiv': return this.arxiv(query, input.maxResults, input.timeoutMs);
      case 'github': return this.github(query, input.maxResults, input.timeoutMs);
      case 'huggingface': return this.huggingFace(query, input.maxResults, input.timeoutMs);
      case 'sec_edgar': return this.secEdgar(query, input.maxResults, input.timeoutMs);
      case 'federal_register': return this.federalRegister(query, input.maxResults, input.timeoutMs);
      default: return [];
    }
  }

  private async clinicalTrials(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://clinicaltrials.gov/api/v2/studies');
    url.searchParams.set('query.term', query);
    url.searchParams.set('pageSize', String(maxResults));
    const body = await this.requestJson<{ studies?: Array<{ protocolSection?: { identificationModule?: { nctId?: string; briefTitle?: string }; statusModule?: { overallStatus?: string; lastUpdatePostDateStruct?: { date?: string } }; conditionsModule?: { conditions?: string[] } } }> }>(url, timeoutMs);
    return (body.studies ?? []).flatMap((study) => {
      const id = study.protocolSection?.identificationModule?.nctId;
      const title = study.protocolSection?.identificationModule?.briefTitle;
      if (!id || !title) return [];
      const status = study.protocolSection?.statusModule?.overallStatus ?? 'status unavailable';
      const conditions = (study.protocolSection?.conditionsModule?.conditions ?? []).slice(0, 3).join(', ');
      return [{
        title: clean(title),
        url: `https://clinicaltrials.gov/study/${encodeURIComponent(id)}`,
        snippet: clean([status, conditions].filter(Boolean).join(' · ')),
        published_at: study.protocolSection?.statusModule?.lastUpdatePostDateStruct?.date ?? null,
      }];
    });
  }

  private async pubMed(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('retmax', String(maxResults));
    searchUrl.searchParams.set('sort', 'date');
    searchUrl.searchParams.set('term', query);
    const search = await this.requestJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl, timeoutMs);
    const ids = (search.esearchresult?.idlist ?? []).filter(Boolean);
    if (!ids.length) return [];
    const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
    summaryUrl.searchParams.set('db', 'pubmed');
    summaryUrl.searchParams.set('retmode', 'json');
    summaryUrl.searchParams.set('id', ids.join(','));
    const summary = await this.requestJson<{ result?: Record<string, { title?: string; pubdate?: string; source?: string; fulljournalname?: string }> }>(summaryUrl, timeoutMs);
    return ids.flatMap((id) => {
      const item = summary.result?.[id];
      if (!item?.title) return [];
      return [{
        title: clean(item.title),
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(id)}/`,
        snippet: clean([item.fulljournalname ?? item.source, item.pubdate].filter(Boolean).join(' · ')),
        published_at: item.pubdate ?? null,
      }];
    });
  }

  private async europePmc(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('pageSize', String(maxResults));
    url.searchParams.set('sort_date', 'y');
    const body = await this.requestJson<{ resultList?: { result?: Array<{ id?: string; source?: string; title?: string; journalTitle?: string; firstPublicationDate?: string; pubYear?: string }> } }>(url, timeoutMs);
    return (body.resultList?.result ?? []).flatMap((item) => {
      if (!item.id || !item.title) return [];
      const source = item.source ?? 'MED';
      return [{
        title: clean(item.title),
        url: `https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(item.id)}`,
        snippet: clean(item.journalTitle ?? ''),
        published_at: item.firstPublicationDate ?? item.pubYear ?? null,
      }];
    });
  }

  private async crossref(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query', query);
    url.searchParams.set('rows', String(maxResults));
    url.searchParams.set('sort', 'published');
    url.searchParams.set('order', 'desc');
    const body = await this.requestJson<{ message?: { items?: Array<{ title?: string[]; URL?: string; DOI?: string; 'container-title'?: string[]; published?: { 'date-parts'?: number[][] } }> } }>(url, timeoutMs);
    return (body.message?.items ?? []).flatMap((item) => {
      const title = item.title?.[0];
      const url = item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : null);
      if (!title || !url) return [];
      return [{
        title: clean(title),
        url,
        snippet: clean(item['container-title']?.[0] ?? ''),
        published_at: datePart(item.published?.['date-parts']?.[0]),
      }];
    });
  }

  private async openAlex(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', query);
    url.searchParams.set('per-page', String(maxResults));
    url.searchParams.set('sort', 'publication_date:desc');
    const body = await this.requestJson<{ results?: Array<{ id?: string; doi?: string | null; title?: string; publication_date?: string | null; primary_location?: { source?: { display_name?: string | null } | null } | null }> }>(url, timeoutMs);
    return (body.results ?? []).flatMap((item) => {
      if (!item.id || !item.title) return [];
      return [{
        title: clean(item.title),
        url: item.doi ?? item.id,
        snippet: clean(item.primary_location?.source?.display_name ?? ''),
        published_at: item.publication_date ?? null,
      }];
    });
  }

  private async arxiv(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://export.arxiv.org/api/query');
    url.searchParams.set('search_query', `all:${query}`);
    url.searchParams.set('start', '0');
    url.searchParams.set('max_results', String(maxResults));
    url.searchParams.set('sortBy', 'submittedDate');
    url.searchParams.set('sortOrder', 'descending');
    const body = await this.requestText(url, timeoutMs);
    return entries(body).flatMap((entry) => {
      const title = tag(entry, 'title');
      const id = tag(entry, 'id');
      if (!title || !id || !/^https?:\/\//.test(id)) return [];
      return [{ title: clean(title), url: id, snippet: clean(tag(entry, 'summary') ?? ''), published_at: tag(entry, 'published') ?? null }];
    });
  }

  private async github(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', query);
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('per_page', String(maxResults));
    const body = await this.requestJson<{ items?: Array<{ full_name?: string; html_url?: string; description?: string | null; updated_at?: string }> }>(url, timeoutMs, { Accept: 'application/vnd.github+json', 'User-Agent': 'NarrativeLifecycleDashboard/0.13' });
    return (body.items ?? []).flatMap((item) => item.full_name && item.html_url ? [{
      title: item.full_name,
      url: item.html_url,
      snippet: clean(item.description ?? ''),
      published_at: item.updated_at ?? null,
    }] : []);
  }

  private async huggingFace(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://huggingface.co/api/models');
    url.searchParams.set('search', query);
    url.searchParams.set('limit', String(maxResults));
    url.searchParams.set('sort', 'lastModified');
    const body = await this.requestJson<Array<{ modelId?: string; lastModified?: string; tags?: string[] }>>(url, timeoutMs);
    return body.flatMap((item) => item.modelId ? [{
      title: item.modelId,
      url: `https://huggingface.co/${encodeURIComponent(item.modelId)}`,
      snippet: clean((item.tags ?? []).slice(0, 5).join(', ')),
      published_at: item.lastModified ?? null,
    }] : []);
  }

  private async secEdgar(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://efts.sec.gov/LATEST/search-index');
    url.searchParams.set('q', query);
    url.searchParams.set('dateRange', 'all');
    url.searchParams.set('start', '0');
    const body = await this.requestJson<{ hits?: { hits?: Array<{ _id?: string; _source?: { adsh?: string; ciks?: string[]; display_names?: string[]; form?: string; file_date?: string; file_description?: string | null } }> } }>(url, timeoutMs, {
      Accept: 'application/json',
      'User-Agent': process.env.NARRATIVE_SEC_USER_AGENT?.trim() || 'NarrativeLifecycleDashboard research@localhost',
    });
    return (body.hits?.hits ?? []).slice(0, maxResults).flatMap((hit) => {
      const source = hit._source;
      const cik = source?.ciks?.[0]?.replace(/\D/g, '');
      const accession = source?.adsh?.replace(/-/g, '');
      const document = hit._id?.split(':')[1];
      if (!source?.adsh || !cik || !accession || !document) return [];
      const issuer = clean(source.display_names?.[0] ?? 'EDGAR issuer');
      const form = clean(source.form ?? 'filing');
      return [{
        title: `${issuer} · ${form}`,
        url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${encodeURIComponent(document)}`,
        snippet: clean(`EDGAR full-text search matched the campaign term. ${source.file_description ?? ''}`),
        published_at: source.file_date ?? null,
        term_match_verified: true,
      }];
    });
  }

  private async federalRegister(query: string, maxResults: number, timeoutMs: number): Promise<DirectSourceSearchRow[]> {
    const url = new URL('https://www.federalregister.gov/api/v1/documents.json');
    url.searchParams.set('conditions[term]', query);
    url.searchParams.set('per_page', String(maxResults));
    url.searchParams.set('order', 'newest');
    const body = await this.requestJson<{ results?: Array<{ title?: string; html_url?: string; abstract?: string | null; publication_date?: string | null; document_number?: string }> }>(url, timeoutMs);
    return (body.results ?? []).flatMap((item) => item.title && item.html_url ? [{
      title: clean(item.title),
      url: item.html_url,
      snippet: clean(item.abstract ?? `Federal Register document ${item.document_number ?? ''} matched the campaign term.`),
      published_at: item.publication_date ?? null,
      term_match_verified: true,
    }] : []);
  }

  private async requestJson<T>(url: URL, timeoutMs: number, headers?: HeadersInit): Promise<T> {
    return JSON.parse(await this.requestText(url, timeoutMs, headers)) as T;
  }

  private async requestText(url: URL, timeoutMs: number, headers?: HeadersInit): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await this.fetchImpl(url.toString(), { headers, signal: controller.signal });
        const body = await response.text();
        if (!response.ok) throw new Error(`direct_source_http_${response.status}`);
        return body;
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isTransient(error)) {
          await pause(200);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}

function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /direct_source_http_(429|500|502|503|504)|abort/i.test(message);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function clean(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function datePart(parts: number[] | undefined): string | null {
  if (!parts?.length) return null;
  const [year, month, day] = parts;
  if (!year) return null;
  return [year, month ? String(month).padStart(2, '0') : null, day ? String(day).padStart(2, '0') : null].filter(Boolean).join('-');
}

function entries(xml: string): string[] { return xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []; }
function tag(xml: string, name: string): string | null {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(xml);
  return match ? match[1]!.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
}
