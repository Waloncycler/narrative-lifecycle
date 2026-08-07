import { describe, expect, it } from 'vitest';
import { chunkRawDocument, extractEvidenceCandidates } from '../src/domain/intake_rules';
import type { EvidenceIntakeSession, RawDocument } from '../src/types/intake';
import { ProviderNeutralAiShadowAdapter } from '../src/infrastructure/ai_shadow_provider';

function session(): EvidenceIntakeSession {
  const raw: RawDocument = {
    raw_document_id: 'raw_tcm',
    source_name: 'pasted TCM policy',
    source_kind: 'pasted_text',
    ingested_at: '2026-07-13T00:00:00.000Z',
    text: '国务院发布关于《中医药振兴发展“十五五”规划》的批复。《规划》实施要坚持中西医并重，加快推进中医药现代化，推动中医药走向世界。',
    character_count: 82,
  };
  const chunks = chunkRawDocument(raw);
  const { candidates, provenance } = extractEvidenceCandidates({
    rawDocument: raw,
    chunks,
    existingEvidenceIds: new Set(),
    generatedAt: '2026-07-13T00:00:00.000Z',
  });
  return {
    session_id: 'session_tcm',
    generated_at: '2026-07-13T00:00:00.000Z',
    raw_document: raw,
    chunks,
    provenance_records: provenance,
    candidates,
    review_template: [],
  };
}

describe('provider-neutral AI shadow adapter', () => {
  it('falls back to rule-based candidates without persisting secrets when provider is not configured', async () => {
    const adapter = new ProviderNeutralAiShadowAdapter({
      provider: 'disabled',
      model: 'none',
      timeoutMs: 10,
    });
    const result = await adapter.generate(session());

    expect(result.candidates[0]).toMatchObject({
      fallback_used: true,
      validation_status: 'fallback',
      prompt_version: 'ai-shadow-evidence-extraction-v0.5.7',
      suggested_evidence: expect.objectContaining({ topic_id: 'traditional_chinese_medicine_revival' }),
    });
    expect(result.audit).toMatchObject({
      status: 'fallback',
      fallback_count: 1,
      secret_redaction: 'api_key_not_persisted',
    });
    expect(JSON.stringify(result.audit)).not.toContain('sk-');
  });
});
