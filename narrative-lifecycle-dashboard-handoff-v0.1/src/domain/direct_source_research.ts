import type { AuthoritativeResearchSource, ResearchCampaignTask } from '../types/research_coverage';

/** Public APIs that accept a bounded campaign term without a private key. */
export const TERM_QUERY_SOURCE_IDS = new Set([
  'clinicaltrials',
  'pubmed',
  'europe_pmc',
  'crossref',
  'openalex',
  'arxiv',
  'github',
  'huggingface',
  'sec_edgar',
  'federal_register',
]);

export function supportsTermQuery(source: AuthoritativeResearchSource): boolean {
  return source.access_mode === 'direct_api'
    && source.automated_polling_allowed
    && TERM_QUERY_SOURCE_IDS.has(source.source_id);
}

/** Selects a source-language-compatible retrieval expression, not a Stage label. */
export function directSourceQuery(source: AuthoritativeResearchSource, task: ResearchCampaignTask): string {
  const supportsEnglish = source.languages.includes('en');
  const supportsChinese = source.languages.includes('zh');
  if (source.source_id === 'sec_edgar') {
    const company = task.company_targets?.find((target) => target.market === 'us');
    const concept = task.display_name_en ?? task.display_name_zh;
    // SEC filing search is most useful when it has both the tracked concept
    // and a relevant US issuer. It is not a general-purpose topic search.
    return company ? `${company.display_name_en} ${concept}`.slice(0, 180) : concept.slice(0, 180);
  }
  if (supportsEnglish && !supportsChinese && task.display_name_en) return task.display_name_en.slice(0, 180);
  if (supportsChinese && !supportsEnglish) return task.display_name_zh.slice(0, 180);
  return [task.display_name_zh, task.display_name_en].filter(Boolean).join(' ').slice(0, 180);
}

/**
 * Public APIs can apply broad token matching. Admit only records that repeat
 * the campaign's actual concept phrase (or its unambiguous initialism) in the
 * visible title or excerpt before spending model or operator review capacity
 * on them. A provider-side full-text hit alone is not enough context.
 */
export function matchesCampaignTerms(task: ResearchCampaignTask, value: string): boolean {
  const text = normalized(value);
  return [task.display_name_en, task.display_name_zh]
    .filter((label): label is string => Boolean(label?.trim()))
    .some((label) => {
      const compact = normalized(label);
      if (compact.length >= 3 && text.includes(compact)) return true;
      const rawTokens = label.toLowerCase().match(/[a-z0-9]+/g) ?? [];
      const requiredTokens = rawTokens.filter((token) => token.length > 1);
      if (requiredTokens.length < 2) return false;
      // Preserve one-letter name components when forming an initialism. For
      // example, Cross-border e-commerce is CBEC, never the ambiguous CBC.
      const acronym = rawTokens.map((token) => token[0]).join('');
      return requiredTokens.every((token) => text.includes(token)) || (acronym.length >= 3 && text.includes(acronym));
    });
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}
