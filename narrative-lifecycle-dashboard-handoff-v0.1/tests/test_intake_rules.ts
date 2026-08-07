import { describe, expect, it } from 'vitest';
import type { RawDocument, ReviewDecision } from '../src/types/intake';
import { chunkRawDocument, evidenceDraftsFromDecisions, extractEvidenceCandidates } from '../src/domain/intake_rules';

const raw: RawDocument = {
  raw_document_id: 'raw_test',
  source_name: 'test note',
  source_kind: 'markdown',
  ingested_at: '2026-07-13T00:00:00.000Z',
  text: [
    'Medical rehabilitation BCI follow-up validation was reported with reimbursement discussion.',
    '',
    'The branch evidence remains separate from parent-level BCI pricing and revenue confirmation.',
  ].join('\n'),
  character_count: 165,
};

describe('intake rules', () => {
  it('chunks documents and preserves original quote provenance', () => {
    const chunks = chunkRawDocument(raw, 80);
    const { candidates, provenance } = extractEvidenceCandidates({
      rawDocument: raw,
      chunks,
      existingEvidenceIds: new Set(),
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(chunks.length).toBe(2);
    expect(provenance[0]).toMatchObject({ raw_document_id: 'raw_test', chunk_id: chunks[0].chunk_id });
    expect(raw.text.slice(provenance[0].quote_start_offset, provenance[0].quote_end_offset)).toBe(provenance[0].quote);
    expect(candidates[0]).toMatchObject({
      suggested_evidence: expect.objectContaining({
        topic_id: 'bci',
        branch_id: 'bci_medical_rehab',
        scope: 'branch',
      }),
    });
    expect(candidates[0].uncertainty_notes.join(' ')).toContain('Branch evidence cannot upgrade parent');
  });

  it('maps human review decisions to accepted, modified, split, rejected, and duplicate drafts', () => {
    const chunks = chunkRawDocument(raw, 80);
    const { candidates } = extractEvidenceCandidates({
      rawDocument: raw,
      chunks,
      existingEvidenceIds: new Set(),
      generatedAt: '2026-07-13T00:00:00.000Z',
    });
    const base = candidates[0].suggested_evidence;
    const decisions: ReviewDecision[] = [
      { candidate_id: candidates[0].candidate_id, decision: 'modify', reviewer: 'tester', reviewed_at: '2026-07-13T00:00:00.000Z', modified_evidence: { ...base, evidence_id: 'modified_ev' } },
      { candidate_id: candidates[1].candidate_id, decision: 'split', reviewer: 'tester', reviewed_at: '2026-07-13T00:00:00.000Z', split_evidence: [{ ...candidates[1].suggested_evidence, evidence_id: 'split_a' }, { ...candidates[1].suggested_evidence, evidence_id: 'duplicate_ev' }] },
      { candidate_id: 'missing_candidate', decision: 'reject', reviewer: 'tester', reviewed_at: '2026-07-13T00:00:00.000Z', rejection_reason: 'not relevant' },
    ];

    const result = evidenceDraftsFromDecisions({
      candidates,
      decisions,
      existingEvidenceIds: new Set(['duplicate_ev']),
    });

    expect(result.drafts.map((draft) => draft.evidence_id).sort()).toEqual(['modified_ev', 'split_a']);
    expect(result.duplicates.map((draft) => draft.evidence_id)).toEqual(['duplicate_ev']);
    expect(result.modified_count).toBe(1);
    expect(result.split_count).toBe(2);
  });

  it('maps Chinese TCM policy text to a provisional policy topic instead of unknown', () => {
    const document: RawDocument = {
      raw_document_id: 'raw_tcm',
      source_name: 'pasted TCM policy',
      source_kind: 'pasted_text',
      ingested_at: '2026-07-13T00:00:00.000Z',
      text: '国务院发布关于《中医药振兴发展“十五五”规划》的批复。《规划》实施要坚持中西医并重，完善中医药传承创新发展机制，加快推进中医药现代化，推动中医药走向世界。',
      character_count: 87,
    };
    const { candidates } = extractEvidenceCandidates({
      rawDocument: document,
      chunks: chunkRawDocument(document),
      existingEvidenceIds: new Set(),
      generatedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(candidates[0].suggested_evidence).toMatchObject({
      topic_id: 'traditional_chinese_medicine_revival',
      scope: 'parent',
      evidence_strength: 'E3',
    });
    expect(candidates[0].suggested_evidence.affected_layer).toEqual(expect.arrayContaining(['name', 'reality']));
    expect(candidates[0].uncertainty_notes.join(' ')).toContain('human confirmation');
  });

  it('does not force innovative-drug approvals into the distinct license-out narrative', () => {
    const document: RawDocument = {
      raw_document_id: 'raw_drug_approval',
      source_name: 'drug approval news',
      source_kind: 'pasted_text',
      ingested_at: '2026-07-13T00:00:00.000Z',
      text: '国家药监局统计显示，今年上半年我国批准38个1类创新药上市，其中11个为国产新靶点、新机制药物。',
      character_count: 48,
    };
    const { candidates } = extractEvidenceCandidates({
      rawDocument: document,
      chunks: chunkRawDocument(document),
      existingEvidenceIds: new Set(),
      generatedAt: document.ingested_at,
    });

    expect(candidates[0].suggested_evidence.topic_id).toBe('innovative_drug_approval');
    expect(candidates[0].suggested_evidence.topic_id).not.toBe('innovative_drug_license_out');
  });

  it('splits long Chinese news and maps innovative-drug parent and branches', () => {
    const document: RawDocument = {
      raw_document_id: 'raw_drug_news',
      source_name: 'drug news sample',
      source_kind: 'pasted_text',
      ingested_at: '2026-07-13T00:00:00.000Z',
      text: '我国上半年创新药对外授权约1100亿美元创历史新高。国家药监局披露今年上半年批准38个1类创新药上市。我国在研新药数量约占全球30%，2025年临床试验总量首次突破5000项。',
      character_count: 100,
    };
    const chunks = chunkRawDocument(document, 55);
    const { candidates, provenance } = extractEvidenceCandidates({ rawDocument: document, chunks, existingEvidenceIds: new Set(), generatedAt: document.ingested_at });
    expect(chunks.length).toBeGreaterThan(1);
    expect(candidates.some((candidate) => candidate.suggested_evidence.topic_id === 'innovative_drug_license_out')).toBe(true);
    expect(candidates.some((candidate) => candidate.original_quote.includes('临床试验') && candidate.suggested_evidence.topic_id === 'innovative_drug_clinical_development')).toBe(true);
    expect(candidates.filter((candidate) => !candidate.original_quote.includes('对外授权')).every((candidate) => candidate.suggested_evidence.topic_id !== 'innovative_drug_license_out')).toBe(true);
    expect(provenance.every((record) => document.text.slice(record.quote_start_offset, record.quote_end_offset) === record.quote)).toBe(true);
  });

  it('does not split English abbreviations or decimal values into false facts', () => {
    const document: RawDocument = {
      raw_document_id: 'raw_english_abbreviation',
      source_name: 'english news sample',
      source_kind: 'pasted_text',
      ingested_at: '2026-07-13T00:00:00.000Z',
      text: 'Roughly half of those deals involve firms of U.S. origin, mostly involving M&A. In 2026, a licensing agreement was worth up to $5.6 billion. The result was reported by a public source.',
      character_count: 181,
    };
    const chunks = chunkRawDocument(document, 80);
    expect(chunks.map((item) => item.text)).not.toEqual(expect.arrayContaining(['U.', 'S.', '6 billion.']));
    const { provenance } = extractEvidenceCandidates({ rawDocument: document, chunks, existingEvidenceIds: new Set(), generatedAt: document.ingested_at });
    expect(provenance.every((record) => document.text.slice(record.quote_start_offset, record.quote_end_offset) === record.quote)).toBe(true);
  });

  it('splits multi-topic document paragraphs into topic-isolated atomic candidate cards', () => {
    const document: RawDocument = {
      raw_document_id: 'raw_multi_topic',
      source_name: 'mixed industry report',
      source_kind: 'pasted_text',
      ingested_at: '2026-08-07T00:00:00.000Z',
      text: [
        '医疗康复脑机接口项目通过监管部门临床试验审批，在三家三甲医院开展试点。',
        '',
        '人形机器人核心零部件与灵巧手组件在三季度完成量产产线建设并批量出货。',
      ].join('\n'),
      character_count: 75,
    };
    const chunks = chunkRawDocument(document);
    const { candidates } = extractEvidenceCandidates({ rawDocument: document, chunks, existingEvidenceIds: new Set(), generatedAt: document.ingested_at });
    expect(chunks.length).toBe(2);
    expect(candidates[0].suggested_evidence.topic_id).toBe('bci');
    expect(candidates[1].suggested_evidence.topic_id).toBe('humanoid_robotics');
  });
});
