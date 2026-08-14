import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNarrativeMonitor } from '@/features/narrative/domain/narrative_monitor';
import { mergeMonitorSnapshot } from '@/features/narrative/domain/narrative_monitor_snapshot';
import {
  renderAgentDashboard,
  renderChanges,
  renderEvidenceInbox,
  renderGovernance,
  renderMethodology,
  renderNarrativeMonitor,
  renderQueue,
  renderSources,
  renderSystemOverview,
  renderTopicDetail,
  renderTopics,
} from '@/features/narrative/ui/narrative_monitor_renderer';
import type { StageSnapshotHistory } from '@/features/stages/types/diff';
import type { WeeklyBrief } from '@/features/reporting/types/report';

const snapshot: StageSnapshotHistory = {
  artifact_type: 'stage_snapshot_history', schema_version: '1.0.0', producer_version: '0.4.0', rule_version: 'test', run_id: 'run_test', generated_at: '2026-07-27T00:00:00.000Z',
  snapshot_id: 'stage_snapshot_run_test', source_report_id: 'weekly_test',
  topics: [{ topic_id: 'bci', topic_name: 'BCI', parent_narrative: 'BCI', current_stage: 'S4', gate_stage: 'S4', max_allowed_stage: 'S4', strongest_branch: 'medical rehab (S5-S6)', weakest_layer: 'pricing', data_confidence: 'medium', evidence_ids: ['parent_evidence'], gate_evidence_ids: ['parent_evidence'], score_id: 'score', dashboard_card_id: 'card', why_not_higher_stage: 'Parent pricing and reality evidence remain incomplete.', gate_why_not_higher_stage: 'Missing pricing and reality.', branches: [{ branch_id: 'medical_rehab', branch_name: 'Medical rehab', current_stage: 'S5-S6', evidence_ids: ['branch_evidence'], reactivation_record_id: null }] }],
  early_radar_candidates: [], guardrail_check: { no_trading_advice: true, research_only_actions: true, parent_branch_separation_preserved: true, evidence_ids_visible: true, why_not_higher_present: true, data_confidence_present: true },
};

const weekly = {
  ...snapshot,
  artifact_type: 'weekly_brief', report_id: 'weekly_test', source_artifacts: [], executive_summary: { dashboard_card_count: 1, score_count: 1, golden_case_passed: 3, golden_case_total: 3, early_radar_candidate_count: 0, system_status: 'ok' },
  stage_snapshot: [{ topic_id: 'bci', topic_name: 'BCI', current_stage: 'S4', parent_narrative: 'BCI', strongest_branch: 'medical rehab (S5-S6)', weakest_layer: 'pricing', data_confidence: 70 }],
  stage_change_summary: { previous_snapshot_id: null, current_snapshot_id: snapshot.snapshot_id, upgrade_count: 0, downgrade_count: 0, evidence_added_count: 0, branch_mutation_candidate_count: 0, guardrail_regression_count: 0 },
  stage_changes: [], strongest_evidence: [{ evidence_id: 'parent_evidence', evidence_strength: 'E2', affected_layer: ['name'], topic: 'BCI', interpretation: 'Parent evidence.' }], why_not_higher: [], early_radar_candidates: [], next_operator_actions: [], artifact_index: [],
} as unknown as WeeklyBrief;

function candidate(candidateId: string, evidenceId: string) {
  return {
    candidate_id: candidateId,
    original_quote: 'quoted fact',
    duplicate_of_evidence_id: null,
    suggested_evidence: {
      evidence_id: evidenceId,
      topic_id: 'bci',
      branch_id: null,
      scope: 'parent',
      evidence_strength: 'E1',
    },
  };
}

describe('narrative monitor', () => {
  it('merges registered database topics into the workbench snapshot without inventing a higher stage', () => {
    const merged = mergeMonitorSnapshot(snapshot, [{
      topic_id: 'registered_only',
      topic_name: '已登记但未重跑的主题',
      current_stage: 'S5-S6',
      updated_at: '2026-08-10T00:00:00.000Z',
      parent_evidence_ids: [],
      branches: [{ branch_id: 'registered_branch', branch_name: '已登记分支', evidence_ids: ['branch_evidence'] }],
    }]);
    const model = buildNarrativeMonitor({ snapshot: merged, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    const registered = model.topics.find((topic) => topic.topic_id === 'registered_only');

    expect(registered).toMatchObject({
      current_stage: 'S5-S6',
      baseline_status: 'evidence_based',
      evidence_count: 0,
      branch_count: 1,
    });
    expect(registered?.branches[0]).toMatchObject({ current_stage: 'S0', evidence_ids: ['branch_evidence'] });
    expect(registered?.why_not_higher_stage).toContain('尚无正式父主题证据表');
  });

  it('creates a conservative monitor snapshot when SQLite has topics but no stage snapshot yet', () => {
    const databaseOnly = mergeMonitorSnapshot(null, [{
      topic_id: 'database_only',
      topic_name: '数据库主题',
      current_stage: 'S4',
      updated_at: '2026-08-10T00:00:00.000Z',
      parent_evidence_ids: ['parent_evidence'],
      branches: [],
    }]);
    const model = buildNarrativeMonitor({ snapshot: databaseOnly, weekly: null, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });

    expect(model.status).toBe('ready');
    expect(model.topics[0]).toMatchObject({ current_stage: 'S4', evidence_count: 1, data_confidence: 'low' });
    expect(model.topics[0]?.why_not_higher_stage).toContain('尚未生成正式阶段快照');
  });

  it('keeps the full research workbench as the default local entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['intake:workbench']).toBe('tsx src/cli/run_intake_workbench.ts');
  });

  it('keeps every operator area reachable from the shared workbench navigation', () => {
    const model = buildNarrativeMonitor({ snapshot: null, weekly: null, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    const pages = [
      renderNarrativeMonitor(model),
      renderTopics(model),
      renderChanges(model),
      renderEvidenceInbox(model),
      renderQueue(model),
      renderAgentDashboard(model),
      renderSystemOverview(model),
      renderSources(model),
      renderMethodology(),
      renderGovernance(model),
    ].join('\n');

    for (const href of ['/', '/topics', '/queue', '/agent', '/system', '/intake']) {
      expect(pages).toContain(`href=\"${href}\"`);
    }
    expect(pages).toContain('研究者确认模式');
  });

  it('keeps parent and branch stages separate in the monitor view', () => {
    const model = buildNarrativeMonitor({ snapshot, weekly, diff: null, review: null, unresolvedCount: 2, learningProfileVersion: 'v0.6.2' });
    expect(model.status).toBe('ready');
    expect(model.metrics.topic_count).toBe(1);
    expect(model.metrics.unresolved_candidate_count).toBe(2);
    expect(model.topics[0]).toMatchObject({ current_stage: 'S4', branch_count: 1, strongest_branch: 'medical rehab (S5-S6)' });
    expect(model.topics[0].branches[0].current_stage).toBe('S5-S6');
    expect(model.topics[0].why_not_higher_stage).toContain('Parent pricing');
  });

  it('marks an empty-evidence S0 as a baseline gap instead of an early-market conclusion', () => {
    const emptyParent = { ...snapshot, topics: [{ ...snapshot.topics[0]!, current_stage: 'S0', gate_stage: 'S0', evidence_ids: [], gate_evidence_ids: [], branches: [] }] };
    const model = buildNarrativeMonitor({ snapshot: emptyParent, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    expect(model.topics[0]).toMatchObject({ current_stage: 'S0', baseline_status: 'baseline_required' });
    expect(renderTopicDetail(model, 'bci')).toContain('尚未完成阶段基准核验');
  });

  it('uses Chinese research-facing labels while preserving rule strings in artifacts', () => {
    const model = buildNarrativeMonitor({ snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    const page = renderTopicDetail(model, 'bci');
    expect(page).toContain('整体主题的市场预期与现实进展证据仍不完整。');
    expect(page).toContain('市场预期');
    expect(page).not.toContain('Parent pricing and reality evidence remain incomplete.');
  });

  it('links source, review, import, and Weekly only when session IDs match', () => {
    const runtime = {
      sourceSync: { sync_id: 'sync_1', candidate_count: 2, intake_session_id: 'session_1' },
      intakeSession: {
        session_id: 'session_1',
        candidates: ['candidate_1', 'candidate_2'].map((candidate_id) => ({
          candidate_id,
          original_quote: 'Source fact',
          duplicate_of_evidence_id: null,
          suggested_evidence: {
            topic_id: 'unknown_topic',
            branch_id: null,
            scope: 'parent',
            evidence_strength: 'E1',
          },
        })),
      },
      applyResult: { session_id: 'other_session', imported: true, accepted_count: 2, weekly_run_id: 'run_wrong' },
    } as never;
    const pending = buildNarrativeMonitor({ snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null, runtime });
    expect(pending.source_loop).toMatchObject({
      sync_id: 'sync_1',
      pending_review_count: 2,
      imported_count: 0,
      weekly_run_id: null,
      status: 'pending_review',
    });
  });

  it('shows an explainable Chinese lead-triage status without presenting it as evidence', () => {
    const model = buildNarrativeMonitor({
      snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null,
      runtime: {
        researchLeadTriage: {
          summary: { priority_review_count: 1, review_count: 2, reference_only_count: 3, hold_count: 4 },
          items: [{ title: '可核验原始记录', url: 'https://example.test/record', source_name: '权威来源', topic_id: 'bci', branch_id: null, disposition: 'priority_review', reasons: ['权威来源或受治理披露渠道'] }],
        } as never,
      },
    });
    const page = renderAgentDashboard(model);
    expect(page).toContain('线索分诊');
    expect(page).toContain('优先复核');
    expect(page).toContain('分诊仅安排人工核验顺序');
    expect(page).toContain('可核验原始记录');
  });

  it('shows bounded original-source excerpts as review material, never as an automatic stage input', () => {
    const model = buildNarrativeMonitor({
      snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null,
      runtime: { researchSourceRetrieval: { items: [{ status: 'retrieved', page_title: '官方试验记录', title: '官方试验记录', url: 'https://example.test/study', topic_id: 'bci', branch_id: 'medical_rehab', source_class: 'official', excerpts: [{ location_label: '研究概述', quote: '该官方记录包含可复核的研究概述、状态与主要终点，研究者必须在正式证据导入前核对其引用位置和范围。' }] }] } as never },
    });
    const page = renderAgentDashboard(model);
    expect(page).toContain('可复核的原文摘录');
    expect(page).toContain('不会自动成为正式证据或改变阶段');
    expect(page).toContain('官方试验记录');
  });

  it('shows the baseline-completion queue as research work, not a stage override', () => {
    const model = buildNarrativeMonitor({
      snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null,
      runtime: { researchBaselineCompletion: { summary: { high_priority_count: 1 }, items: [{ kind: 'parent_evidence_baseline', priority: 'high', display_name_zh: '人形机器人', rationale: '整体主题缺少正式父主题证据表。' }] } as never },
    });
    const page = renderAgentDashboard(model);
    expect(page).toContain('阶段基准与命名补全');
    expect(page).toContain('不改变已有阶段、证据或登记册');
    expect(page).toContain('人形机器人');
  });

  it('surfaces policy-held publication candidates in the research queue', () => {
    const model = buildNarrativeMonitor({
      snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null,
      runtime: {
        autonomousPromotion: {
          items: [{ candidate_id: 'candidate_policy', evidence_id: 'evidence_policy', topic_id: 'bci', branch_id: null, scope: 'parent', decision: 'held', reasons: ['Automatic publication was not explicitly requested; candidate remains in the operator review queue.'] }],
        } as never,
      },
    });
    expect(model.review_queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'evidence_publication_review', candidate_id: 'candidate_policy', href: '/intake?candidate=candidate_policy' }),
    ]));
    expect(renderQueue(model)).toContain('待发布证据复核');
  });

  it('keeps historical guardrail alerts in system governance, not the material review queue', () => {
    const model = buildNarrativeMonitor({
      snapshot,
      weekly,
      diff: null,
      review: { high_priority_operator_alerts: [{ category: 'stage_downgrade', message: 'A historical replay requires review.' }] } as never,
      unresolvedCount: 0,
      learningProfileVersion: null,
    });
    expect(model.review_queue).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'guardrail_alert' }),
    ]));
    expect(renderSystemOverview(model)).toContain('系统提醒');
    expect(renderSystemOverview(model)).toContain('A historical replay requires review.');
  });

  it('removes policy-published candidates from the human review queue without hiding held candidates', () => {
    const sessionId = 'session_auto_publish';
    const session = {
      session_id: sessionId, generated_at: '2026-08-09T00:00:00.000Z', raw_document: { raw_document_id: 'raw', source_name: 'test', source_kind: 'pasted_text', ingested_at: '2026-08-09T00:00:00.000Z', text: 'quoted fact held fact', character_count: 22 }, chunks: [], provenance_records: [], review_template: [],
      candidates: [
        candidate('candidate_published', 'auto_evidence'),
        candidate('candidate_held', 'held_evidence'),
      ],
    } as never;
    const model = buildNarrativeMonitor({
      snapshot: null, weekly: null, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null,
      runtime: {
        intakeSession: session,
        autonomousPromotion: {
          session_id: sessionId,
          items: [
            { candidate_id: 'candidate_published', evidence_id: 'auto_evidence', topic_id: 'bci', branch_id: null, scope: 'parent', decision: 'published', reasons: [] },
            { candidate_id: 'candidate_held', evidence_id: 'held_evidence', topic_id: 'bci', branch_id: null, scope: 'parent', decision: 'held', reasons: ['needs corroboration'] },
          ],
        } as never,
      },
    });
    expect(model.inbox.find((item) => item.candidate_id === 'candidate_published')?.review_status).toBe('auto_published');
    expect(model.review_queue.map((item) => item.candidate_id)).toEqual(['candidate_held']);
  });

  it('keeps opaque branch records auditable but out of market-facing branch summaries', () => {
    const badBranchSnapshot = { ...snapshot, topics: [{ ...snapshot.topics[0]!, strongest_branch: 'NCT07530367 (S2)', branches: [
      { branch_id: 'trial', branch_name: 'NCT07530367', current_stage: 'S2', evidence_ids: ['e'], reactivation_record_id: null },
      { branch_id: 'rehab', branch_name: '医疗康复', current_stage: 'S2', evidence_ids: ['e'], reactivation_record_id: null },
    ] }] };
    const model = buildNarrativeMonitor({ snapshot: badBranchSnapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    expect(renderTopics(model)).not.toContain('NCT07530367');
    const page = renderTopicDetail(model, 'bci');
    expect(page).toContain('待命名记录保留在审计中');
    expect(page).not.toContain('NCT07530367');
  });

  it('shows only registered source states and never presents external archive audits as a product capability', () => {
    const model = buildNarrativeMonitor({ snapshot, weekly, diff: null, review: null, unresolvedCount: 0, learningProfileVersion: null });
    const page = renderSources(model);
    expect(page).toContain('系统来源目录');
    expect(page).not.toContain('Tianji');
    expect(page).not.toContain('待准入来源');
    expect(page).not.toContain('外部来源导入');
  });
});
