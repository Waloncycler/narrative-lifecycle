import { describe, expect, it } from 'vitest';
import { evaluateAutonomousPromotion } from '@/features/narrative/domain/autonomous_promotion';
import { buildOperationalResearchState } from '@/features/reporting/domain/operational_research_state';
import { RunAutonomousResearchUseCase } from '@/app/use_cases/run_autonomous_research_use_case';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { AutonomousResearchPolicy } from '@/features/research/types/autonomous_research';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeAgentReviewBundle } from '@/features/intake/types/intake_agent';
import type { TopicRegistry, TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';

const policy: AutonomousResearchPolicy = {
  policy_id: 'test-policy', enabled: true, auto_register_provisional_topics: true, auto_register_watch_branches: true,
  auto_promote_provisional_topics: true, auto_activate_watch_branches: true,
  minimum_independent_sources_for_topic_activation: 2, minimum_independent_sources_for_branch_activation: 2,
  require_parent_evidence_for_topic_activation: true,
  auto_publish_evidence: true, auto_recompute_stage: true, require_model_validation: true, allow_rule_verified_publication: true,
  minimum_evidence_strength: 'E2', minimum_confidence: 'high', permitted_source_types: ['official', 'filing', 'research', 'academic', 'company'],
  allow_news_auto_publish: false, require_source_url: true, require_provenance: true,
  hold_parent_branch_risk: true, hold_conflicting_evidence: true, hold_stage_jump_above: 'S4',
};

const registry: TopicRegistry = {
  canonical_topics: [{ topic_id: 'bci', topic_name: 'BCI', current_stage: 'S0', status: 'active' }],
  aliases: [],
  branches: [{ branch_id: 'medical_rehab', branch_name: 'Medical rehab', topic_id: 'bci', status: 'watch' }],
  provisional_topics: [],
  memory_topic_ids: ['bci'],
};

const session: EvidenceIntakeSession = {
  session_id: 'intake_autonomy', generated_at: '2026-08-03T00:00:00.000Z',
  raw_document: { raw_document_id: 'raw_autonomy', source_name: 'Regulator', source_kind: 'pasted_text', ingested_at: '2026-08-03T00:00:00.000Z', text: 'Regulator published a verified clinical validation.', character_count: 49 },
  chunks: [],
  provenance_records: [{ provenance_id: 'prov_1', raw_document_id: 'raw_autonomy', chunk_id: 'chunk_1', quote: 'Regulator published a verified clinical validation.', quote_start_offset: 0, quote_end_offset: 49, location_label: 'paragraph 1', extraction_reason: 'direct quote' }],
  candidates: [{
    candidate_id: 'candidate_1', raw_document_id: 'raw_autonomy', chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: 'Regulator published a verified clinical validation.',
    suggested_evidence: {
      evidence_id: 'auto_evidence_1', topic_id: 'unknown_topic', branch_id: null, scope: 'parent', event_date: '2026-08-03', available_at: '2026-08-03',
      event_title: 'Verified clinical validation', event_summary: 'A regulator published a verified clinical validation.', event_type: 'regulatory_validation', source_name: 'Regulator', source_url: 'https://regulator.example/notice', source_type: 'official', evidence_strength: 'E2', affected_layer: ['reality'], stage_effect: 'upgrade', polarity: 'positive', interpretation: 'This is parent-level validation.', limitation: 'One source does not establish pricing adoption.', confidence: 'high',
    },
    suggested_reason: 'official validation', uncertainty_notes: [], field_explanations: {}, e_strength_rationale: 'official source', guardrail_check: { no_trading_advice: true, provenance_present: true, human_review_required: true },
  }],
  review_template: [],
};

const audit: TopicResolutionAudit = {
  audit_id: 'audit_autonomy', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id,
  resolutions: [{ candidate_id: 'candidate_1', status: 'existing_topic', resolved_topic_id: 'bci', resolved_branch_id: null, provisional_topic_id: null, reason: 'Canonical match', confidence: 'high', audit_required: false, alternatives: [] }],
  unresolved_queue: [],
  registry_validation: { validation_id: 'registry', generated_at: '2026-08-03T00:00:00.000Z', status: 'passed', topic_count: 1, alias_count: 0, branch_count: 1, provisional_topic_count: 0, unresolved_count: 0, errors: [], warnings: [] },
  guardrail_check: { no_forced_mapping: true, provisional_topics_do_not_inherit_stage: true, topic_changes_require_audit: true, branch_changes_do_not_upgrade_parent: true },
};

const bundle: IntakeAgentReviewBundle = {
  agent_version: 'v0.7.0', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id,
  candidates: [{
    agent_candidate_id: 'agent_candidate_1', source_candidate_id: 'candidate_1', raw_document_id: 'raw_autonomy', chunk_id: 'chunk_1', provenance_id: 'prov_1', original_quote: session.candidates[0].original_quote, quote_start_offset: 0, quote_end_offset: 49,
    supported_fact: 'Regulator published validation.', inferred_interpretation: 'Parent reality evidence.', limitation: 'Single source.', suggested_evidence: session.candidates[0].suggested_evidence, suggested_reason: 'official source', uncertainty_notes: [], alternative_mappings: [], provider: 'test', model_version: 'test-model', prompt_version: 'test', validation_status: 'passed', validation_errors: [], fallback_used: false, human_review_required: true,
  }],
  verification: { report_id: 'verify', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id, candidate_count: 1, passed_count: 1, failed_count: 0, fallback_count: 0, candidates: [], guardrail_check: { schema_validated: true, citation_checked: true, parent_branch_checked: true, stage_not_reclassified: true, scoring_not_run: true, no_auto_import: true, no_trading_advice: true, secrets_not_persisted: true } },
  audit: { audit_id: 'agent_audit', generated_at: '2026-08-03T00:00:00.000Z', session_id: session.session_id, provider: 'test', model_version: 'test-model', prompt_version: 'test', status: 'passed', request_fingerprint: 'request', response_fingerprint: 'response', error: null, secret_redaction: 'api_key_not_persisted' },
  import_permission: 'auto_import',
};

function evidence(overrides: Partial<EvidenceNode>): EvidenceNode {
  return {
    evidence_id: 'evidence', topic_id: 'bci', branch_id: null, event_date: '2026-08-03', available_at: '2026-08-03', event_title: 'Evidence', event_summary: 'Evidence summary', event_type: 'validation', source_name: 'official', source_url: 'https://example.test', source_type: 'official', evidence_strength: 'E2', affected_layer: ['perception'], stage_effect: 'upgrade_parent', parent_or_branch: 'parent', branch_coverage_score: 0, interpretation: 'Evidence interpretation', limitation: 'Evidence limitation', positive_or_negative: 'positive', confidence: 85,
    ...overrides,
  };
}

describe('autonomous research publication', () => {
  it('uses the audited Topic mapping rather than an unknown raw candidate mapping', () => {
    const result = evaluateAutonomousPromotion({ session, topicAudit: audit, agentCandidates: bundle.candidates, agentAudit: bundle.audit, existingEvidence: [], policy });
    expect(result.items[0]).toMatchObject({ decision: 'published', topic_id: 'bci' });
    expect(result.drafts[0]?.topic_id).toBe('bci');
  });

  it('holds fallback and low-quality candidates instead of publishing them', () => {
    const fallback = { ...bundle, audit: { ...bundle.audit, status: 'fallback' as const }, candidates: [{ ...bundle.candidates[0], fallback_used: true, validation_status: 'fallback' as const }] };
    const result = evaluateAutonomousPromotion({ session, topicAudit: audit, agentCandidates: fallback.candidates, agentAudit: fallback.audit, existingEvidence: [], policy });
    expect(result.items[0]?.decision).toBe('held');
    expect(result.items[0]?.reasons.join(' ')).toContain('fallback');
  });

  it('allows a provenance-complete rule-verified official source to create a provisional topic when the model falls back', () => {
    const provisionalId = 'provisional_traditional_chinese_medicine_revival';
    const verifiedSession: EvidenceIntakeSession = {
      ...session,
      candidates: [{
        ...session.candidates[0],
        candidate_id: 'candidate_tcm',
        publication_eligibility: 'rule_verified',
        suggested_evidence: {
          ...session.candidates[0].suggested_evidence,
          evidence_id: 'auto_tcm_policy_001',
          event_title: '国务院批复中医药振兴发展规划',
          event_summary: '国务院批复规划，要求各省将中医药振兴发展作为重要任务落实。',
          source_url: 'https://www.gov.cn/example/tcm-policy',
          evidence_strength: 'E3',
          affected_layer: ['name', 'reality'],
          confidence: 'high',
        },
      }],
    };
    const provisionalAudit: TopicResolutionAudit = {
      ...audit,
      resolutions: [{
        candidate_id: 'candidate_tcm', status: 'new_provisional_topic', resolved_topic_id: null, resolved_branch_id: null,
        provisional_topic_id: provisionalId, reason: 'Official policy describes a distinct direction.', confidence: 'medium', audit_required: true, alternatives: [],
      }],
    };
    const fallback = { ...bundle, audit: { ...bundle.audit, status: 'fallback' as const }, candidates: [{ ...bundle.candidates[0], source_candidate_id: 'candidate_tcm', fallback_used: true, validation_status: 'fallback' as const }] };
    const provisionalRegistry: TopicRegistry = {
      ...registry,
      canonical_topics: [...registry.canonical_topics, { topic_id: provisionalId, topic_name: 'Traditional Chinese Medicine Revival', current_stage: 'S0', status: 'provisional' }],
      provisional_topics: [{ provisional_topic_id: provisionalId, proposed_name: 'Traditional Chinese Medicine Revival', source_candidate_id: 'candidate_tcm', created_at: '2026-08-03T00:00:00.000Z', status: 'provisional', reason: 'New direction.' }],
    };
    const result = evaluateAutonomousPromotion({
      session: verifiedSession,
      topicAudit: provisionalAudit,
      agentCandidates: fallback.candidates,
      agentAudit: fallback.audit,
      existingEvidence: [],
      policy,
    });
    expect(result.items[0]).toMatchObject({ decision: 'published', topic_id: provisionalId });
    expect(result.drafts[0]?.topic_id).toBe(provisionalId);
  });

  it('keeps a branch S6 separate from an under-evidenced parent', () => {
    const state = buildOperationalResearchState({
      registry,
      runId: 'run_20260803T000000000_abcdef', generatedAt: '2026-08-03T00:00:00.000Z',
      evidence: [
        evidence({ evidence_id: 'parent_label', affected_layer: ['perception'] }),
        evidence({ evidence_id: 'parent_capital', affected_layer: ['capital'] }),
        evidence({ evidence_id: 'branch_all_gates', parent_or_branch: 'branch', branch_id: 'medical_rehab', affected_layer: ['perception', 'capital', 'pricing', 'reality'], evidence_strength: 'E4', branch_coverage_score: 80, source_url: 'u1' }),
        evidence({ evidence_id: 'branch_capital2', parent_or_branch: 'branch', branch_id: 'medical_rehab', affected_layer: ['capital'], evidence_strength: 'E4', branch_coverage_score: 80, source_url: 'u2' }),
        evidence({ evidence_id: 'branch_reality3', parent_or_branch: 'branch', branch_id: 'medical_rehab', affected_layer: ['reality'], evidence_strength: 'E4', branch_coverage_score: 80, source_url: 'u3' }),
      ],
    });
    const topic = state.snapshot.topics[0];
    expect(topic.current_stage).toBe('S4');
    expect(topic.branches[0]?.current_stage).toBe('S6');
  });

  it('keeps an active topic visible at S0 when its formal Evidence Table is empty', () => {
    const state = buildOperationalResearchState({
      registry,
      evidence: [],
      runId: 'run_20260803T000000000_empty',
      generatedAt: '2026-08-03T00:00:00.000Z',
    });

    expect(state.snapshot.topics[0]).toMatchObject({
      topic_id: 'bci',
      current_stage: 'S0',
      evidence_ids: [],
    });
    expect(state.snapshot.topics[0]?.why_not_higher_stage).toContain('No parent Evidence Table');
  });

  it('writes published Evidence and recalculates a schema-ready operational snapshot', () => {
    let published: EvidenceNode[] = [];
    const useCase = new RunAutonomousResearchUseCase({
      createRunContext: () => ({ run_id: 'run_20260803T000000000_abcdef', started_at: '2026-08-03T00:00:00.000Z', rule_version: 'rules', artifact_version: '0.9.0' }), now: () => '2026-08-03T00:00:00.000Z',
      readPolicy: () => policy, readLatestSession: () => session, readLatestAgentBundle: () => bundle, readTopicAudit: () => audit, readRegistry: () => registry,
      readOperationalEvidence: () => published, validateDrafts: () => ({ validation_id: 'validation', generated_at: '2026-08-03T00:00:00.000Z', source_file: 'auto', status: 'passed', accepted_count: 1, rejected_count: 0, errors: [], warnings: [], accepted_evidence_ids: ['auto_evidence_1'], rejected_evidence_ids: [], guardrail_check: { no_trading_advice: true, parent_branch_scope_valid: true, evidence_strength_valid: true, affected_layer_valid: true, source_metadata_present: true } }),
      normalizeDrafts: ({ drafts }) => drafts.map((draft) => ({
        import_id: 'auto', imported_at: '2026-08-03T00:00:00.000Z', source_file: 'auto', evidence_hash: 'hash', draft,
        evidence: evidence({
          evidence_id: draft.evidence_id, topic_id: draft.topic_id, branch_id: draft.branch_id ?? null, event_date: draft.event_date, available_at: draft.available_at,
          event_title: draft.event_title, event_summary: draft.event_summary, event_type: draft.event_type, source_name: draft.source_name, source_url: draft.source_url ?? 'https://example.test', source_type: draft.source_type,
          evidence_strength: draft.evidence_strength, affected_layer: ['reality'], stage_effect: draft.stage_effect, parent_or_branch: draft.scope, interpretation: draft.interpretation, limitation: draft.limitation,
        }),
      })),
      writePublishedEvidence: (rows) => { published = rows; }, readLatestSnapshot: () => null, readPreviousOperatorRunId: () => null,
      applyNarrativeGraphPromotions: () => undefined, writeNarrativeGraphPromotion: () => undefined,
      operationalArtifactPaths: (runId) => ({ sourceArtifacts: ['manual', 'automated'], artifactIndex: ['latest'], runArtifacts: [`run/${runId}/snapshot`, `run/${runId}/diff`, `run/${runId}/weekly`] }),
      writeRun: () => undefined,
      validatePromotionReport: () => undefined, validateNarrativeGraphPromotion: () => undefined, validateSnapshot: () => undefined, validateDiff: () => undefined, validateWeeklyBrief: () => undefined,
    });
    const result = useCase.execute();
    expect(result.report.published_count).toBe(1);
    expect(published[0]?.topic_id).toBe('bci');
    expect(result.snapshot.topics[0]?.evidence_ids).toContain('auto_evidence_1');
    expect(result.snapshot.topics[0]?.current_stage).toBe('S2');
    expect(result.weekly_brief.stage_snapshot[0]?.topic_id).toBe('bci');
    expect(result.manifest.current_snapshot_id).toBe(result.diff.current_snapshot_id);

    const noPublish = useCase.execute({ publish: false });
    expect(noPublish.report.candidate_count).toBe(0);
    expect(noPublish.report.published_count).toBe(0);
    expect(published).toHaveLength(1);
  });
});
