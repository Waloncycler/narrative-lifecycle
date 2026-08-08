import { describe, expect, it } from 'vitest';
import { buildSuggestedEvidence, sanitizeModelJson } from '@/infrastructure/intake_agent_provider';

describe('buildSuggestedEvidence agent-only fallbacks', () => {
  it('derives non-empty title/summary from fact/interpretation when the model omits them', () => {
    const draft = buildSuggestedEvidence({
      original_quote: '我们自主研发了一款移动端的AI工具，可自动抓取多渠道数据。',
      supported_fact: 'Kering internally developed a mobile AI tool that aggregates multi-channel data.',
      inferred_interpretation: 'Internal data-aggregation tooling is a productivity play, not a product shift.',
      core_topic: 'provisional_luxury_consumer',
      scope: 'parent',
    }, undefined);
    expect(draft).not.toBeNull();
    expect(draft?.event_title).toBeTruthy();
    expect(draft?.event_title).toContain('移动端');
    expect(draft?.event_summary).toContain('Kering internally developed');
    expect(draft?.event_summary).toContain('Internal data-aggregation');
    expect(draft?.topic_id).toBe('provisional_luxury_consumer');
  });

  it('prefers explicit model title/summary over derived fallbacks', () => {
    const draft = buildSuggestedEvidence({
      original_quote: 'quote text',
      supported_fact: 'fact text',
      event_title: 'Explicit title',
      event_summary: 'Explicit summary',
    }, undefined);
    expect(draft?.event_title).toBe('Explicit title');
    expect(draft?.event_summary).toBe('Explicit summary');
  });

  it('falls back to the rule candidate evidence when model fields are absent', () => {
    const rule = {
      candidate_id: 'candidate_x',
      raw_document_id: 'doc',
      chunk_id: 'chunk_0',
      provenance_id: 'prov_x',
      original_quote: 'rule quote',
      suggested_evidence: {
        evidence_id: 'ev_rule',
        topic_id: 'tcm',
        scope: 'parent',
        event_date: '2026-08-02',
        available_at: '2026-08-02',
        event_title: 'Rule title',
        event_summary: 'Rule summary',
        event_type: 'NEWS_ARTICLE_PUBLISHED',
        source_name: 'source',
        source_url: null,
        source_type: 'news',
        evidence_strength: 'E1',
        affected_layer: ['name'],
        stage_effect: 'maintain',
        polarity: 'neutral',
        interpretation: 'interp',
        limitation: 'limit',
        confidence: 'low',
      },
      suggested_reason: 'reason',
      uncertainty_notes: [],
      field_explanations: {},
      e_strength_rationale: 'rationale',
      duplicate_of_evidence_id: null,
      guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: false },
    } satisfies import('../src/types/intake').EvidenceCandidate;
    const draft = buildSuggestedEvidence({ core_topic: 'tcm' }, rule);
    expect(draft?.event_title).toBe('Rule title');
    expect(draft?.event_summary).toBe('Rule summary');
  });
});

describe('sanitizeModelJson CJK quote escapes', () => {
  it('strips the backslash before curly quotes so the response stays valid JSON', () => {
    const dirty = '{"quote":"（下称\\“B站\\”），担任AI视频生成业务负责人"}';
    const clean = sanitizeModelJson(dirty);
    expect(clean).not.toContain('\\“');
    expect(clean).toContain('“B站”');
    expect(() => JSON.parse(clean)).not.toThrow();
  });

  it('leaves valid JSON escapes untouched', () => {
    const clean = '{"quote":"said \\"hello\\""}';
    expect(sanitizeModelJson(clean)).toBe(clean);
    expect(() => JSON.parse(clean)).not.toThrow();
  });
});
