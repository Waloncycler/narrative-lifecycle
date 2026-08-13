import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkRawDocument, extractEvidenceCandidates } from '@/features/intake/domain/intake_rules';
import { buildAgentVerificationReport, verifyAgentCandidate } from '@/features/intake/domain/intake_agent_rules';
import { OpenAiCompatibleIntakeAgentAdapter } from '@/features/intake/io/intake_agent_provider';
import type { EvidenceIntakeSession, RawDocument } from '@/features/intake/types/intake';
import type { AgentEvidenceCandidate } from '@/features/intake/types/intake_agent';
import { INTAKE_AGENT_SYSTEM_PROMPT } from '@/features/intake/domain/intake_agent_prompt';
import { suggestIndustry } from '@/features/reporting/domain/industry_packs';
import { DbIndustryPackRepository } from '@/platform/io/industry_pack_io';
import { constrainSourceAnchoredCandidate } from '@/app/use_cases/run_intake_agent_use_case';
import { resolve } from 'node:path';

function session(text = '国务院正式批复中医药振兴发展规划，推动中医药现代化。各省负责地方落实。'): EvidenceIntakeSession {
  const raw: RawDocument = {
    raw_document_id: 'raw_agent_test',
    source_name: 'agent test document',
    source_kind: 'pasted_text',
    ingested_at: '2026-07-13T00:00:00.000Z',
    text,
    character_count: text.length,
  };
  const chunks = chunkRawDocument(raw);
  const extracted = extractEvidenceCandidates({ rawDocument: raw, chunks, existingEvidenceIds: new Set(), generatedAt: raw.ingested_at });
  return {
    session_id: 'session_agent_test',
    generated_at: raw.ingested_at,
    raw_document: raw,
    chunks,
    provenance_records: extracted.provenance,
    candidates: extracted.candidates,
    review_template: [],
  };
}

describe('smart evidence intake agent', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses a compact cross-industry prompt and does not force unknown industries', () => {
    expect(INTAKE_AGENT_SYSTEM_PROMPT.length).toBeLessThanOrEqual(1000);
    expect(suggestIndustry('semiconductor wafer yield and tape-out')).toMatchObject({ industry_id: 'semiconductor', status: 'matched' });
    expect(suggestIndustry('an unfamiliar industrial materials process')).toMatchObject({ industry_id: null, status: 'unresolved' });
  });

  it('loads the repository industry pack catalog for runtime context', () => {
    const repository = new DbIndustryPackRepository(resolve(import.meta.dirname, '..'));
    const packs = repository.readIndustryPacks();
    expect(packs.map((pack) => pack.industry_id)).toEqual(expect.arrayContaining(['medicine', 'semiconductor', 'ai_software']));
  });

  it('uses document context when the selected quote omits the industry keyword', async () => {
    const result = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(
      session('A semiconductor company completed wafer qualification. U.S. customers completed qualification.'),
    );
    expect(result.candidates[0]).toMatchObject({ industry_id: 'semiconductor', industry_status: 'matched' });
  });

  it('calls an OpenAI-compatible endpoint and accepts only verified structured candidates', async () => {
    const source = session();
    const rule = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'openai-compatible', model: 'test-model', timeoutMs: 1000 }).generate(source);
    const candidate = { ...rule.candidates[0], fallback_used: false, validation_status: 'passed' as const, validation_errors: [], provider: 'openai-compatible', model_version: 'test-model' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [candidate] }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new OpenAiCompatibleIntakeAgentAdapter({
      provider: 'openai-compatible', endpoint: 'https://provider.invalid/v1/chat/completions', apiKey: 'sk-test-secret', model: 'test-model', timeoutMs: 1000,
    }).generate(source);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.candidates[0].fallback_used).toBe(false);
    expect(result.audit.status).toBe('passed');
    expect(JSON.stringify(result.audit)).not.toContain('sk-test-secret');
  });

  it('keeps agent-only independent facts instead of truncating to rule candidate count', async () => {
    const source = session('国务院正式批复中医药振兴发展规划，推动中医药现代化。各省负责地方落实。');
    const fallback = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    const base = { ...fallback.candidates[0], fallback_used: false, validation_status: 'passed' as const, validation_errors: [], provider: 'test', model_version: 'test' };
    const extra = {
      ...base,
      agent_candidate_id: 'agent_only_fact_1',
      source_candidate_id: 'agent_only_fact_1',
      original_quote: '各省负责地方落实。',
      supported_fact: '各省负责地方落实。',
      inferred_interpretation: '地方执行是独立于中央批复的后续事实，需单独审核。',
      quote_start_offset: source.raw_document.text.indexOf('各省负责地方落实。'),
      quote_end_offset: source.raw_document.text.indexOf('各省负责地方落实。') + '各省负责地方落实。'.length,
      suggested_evidence: { ...base.suggested_evidence, evidence_id: 'agent_only_fact_evidence_1', event_summary: '各省负责地方落实。' },
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [base, extra] }) } }] }), { status: 200 })));
    const result = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'test', endpoint: 'https://provider.invalid', apiKey: 'secret', model: 'test', timeoutMs: 1000 }).generate(source);
    expect(result.candidates.some((candidate) => candidate.source_candidate_id === 'agent_only_fact_1')).toBe(true);
  });

  it('falls back to rule candidates and never grants import permission', async () => {
    const result = await new OpenAiCompatibleIntakeAgentAdapter({
      provider: 'disabled', model: 'none', timeoutMs: 10,
    }).generate(session());
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].fallback_used).toBe(true);
    expect(result.audit.status).toBe('fallback');
    expect(JSON.stringify(result.audit)).not.toContain('sk-');
  });

  it('requires source citation and separates fact from interpretation', async () => {
    const base = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(session());
    const candidate: AgentEvidenceCandidate = {
      ...base.candidates[0],
      original_quote: 'not in source',
      supported_fact: 'same',
      inferred_interpretation: 'same',
    };
    const verification = verifyAgentCandidate({ candidate, session: session() });
    expect(verification.status).toBe('fallback');
    expect(verification.errors).toEqual(expect.arrayContaining([
      'original_quote_not_found_at_declared_location',
      'fact_and_interpretation_must_be_separated',
    ]));
  });

  it('permits E3 only when a paired deterministic primary-source parser verified it', async () => {
    const source = session('ClinicalTrials.gov updated the official study record.');
    const generated = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    const candidate: AgentEvidenceCandidate = {
      ...generated.candidates[0],
      fallback_used: false,
      validation_status: 'passed',
      validation_errors: [],
      suggested_evidence: { ...generated.candidates[0].suggested_evidence, evidence_strength: 'E3' },
    };

    expect(verifyAgentCandidate({ candidate, session: source }).errors).toContain('possible_e3_e4_overstatement');
    expect(verifyAgentCandidate({
      candidate,
      session: source,
      ruleCandidate: { ...source.candidates[0], publication_eligibility: 'rule_verified' },
    }).errors).not.toContain('possible_e3_e4_overstatement');
  });

  it('keeps branch evidence separate from parent evidence', async () => {
    const source = session('Medical rehabilitation BCI branch validation was reported.');
    const result = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    const candidate = { ...result.candidates[0], suggested_evidence: { ...result.candidates[0].suggested_evidence, scope: 'branch' as const, branch_id: 'bci_medical_rehab' } };
    const report = buildAgentVerificationReport({ generatedAt: '2026-07-13T00:00:00.000Z', session: source, candidates: [candidate] });
    expect(report.guardrail_check.parent_branch_checked).toBe(true);
    expect(report.guardrail_check.stage_not_reclassified).toBe(true);
    expect(report.guardrail_check.scoring_not_run).toBe(true);
    expect(report.candidates[0]?.checks.human_review_required).toBe(true);
  });

  it('keeps a direct-source research seed anchored when the model proposes another parent', async () => {
    const source = session('Smart manufacturing source title.');
    const generated = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    const rule = {
      ...source.candidates[0],
      publication_eligibility: 'manual_review' as const,
      suggested_evidence: {
        ...source.candidates[0]!.suggested_evidence,
        topic_id: 'provisional_smart_manufacturing',
        event_type: 'DIRECT_SOURCE_RECORD',
      },
    };
    const remapped = {
      ...generated.candidates[0]!,
      suggested_evidence: {
        ...generated.candidates[0]!.suggested_evidence,
        topic_id: 'provisional_computing_infrastructure',
        branch_id: 'provisional_computing_infrastructure_ai_infrastructure',
        scope: 'branch' as const,
      },
    };
    const constrained = constrainSourceAnchoredCandidate(remapped, rule);
    expect(constrained.suggested_evidence).toMatchObject({
      topic_id: 'provisional_smart_manufacturing',
      branch_id: null,
      scope: 'parent',
    });
  });

  it('rejects trading language in candidate output', async () => {
    const source = session();
    const result = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    const candidate = { ...result.candidates[0], supported_fact: '买入并加仓' };
    const verification = verifyAgentCandidate({ candidate, session: source });
    expect(verification.checks.no_trading_advice).toBe(false);
    expect(verification.errors).toContain('trading_advice_detected');
  });

  it('allows an explicit non-advice disclaimer without allowing trading instructions', async () => {
    const source = session();
    const result = await new OpenAiCompatibleIntakeAgentAdapter({ provider: 'disabled', model: 'none', timeoutMs: 10 }).generate(source);
    expect(verifyAgentCandidate({
      candidate: { ...result.candidates[0], supported_fact: 'This is not buy or sell advice.' },
      session: source,
    }).checks.no_trading_advice).toBe(true);
    expect(verifyAgentCandidate({
      candidate: { ...result.candidates[0], supported_fact: 'Buy immediately.' },
      session: source,
    }).checks.no_trading_advice).toBe(false);
  });
});
