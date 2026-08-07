import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Server } from 'node:http';
import { createInteractiveIntakeServer } from '../src/interface/interactive_intake_server';
import type { EvidenceCandidate, EvidenceIntakeApplyResult, EvidenceIntakeSession, IntakeEvaluationReport } from '../src/types/intake';

const repoRoot = resolve(import.meta.dirname, '..');
const servers: Server[] = [];

function seedWorkspace(): string {
  const root = join(tmpdir(), `interactive-intake-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  cpSync(resolve(repoRoot, 'schemas'), resolve(root, 'schemas'), { recursive: true });
  cpSync(resolve(repoRoot, 'data'), resolve(root, 'data'), { recursive: true });
  cpSync(resolve(repoRoot, 'configs'), resolve(root, 'configs'), { recursive: true });
  return root;
}

async function listen(root: string): Promise<string> {
  const server = createInteractiveIntakeServer(root);
  servers.push(server);
  await new Promise<void>((resolveListen) => server.listen(0, resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolveClose) => server.close(() => resolveClose()))));
}, 20000);

describe('interactive intake workbench', () => {
  it('lets a non-YAML user paste, edit, import, run weekly, and evaluate feedback', { timeout: 30000 }, async () => {
    const root = seedWorkspace();
    const base = await listen(root);
    const page = await fetch(base);
    const html = await page.text();
    expect(html).toContain('今日研究概览');
    expect(html).toContain('当前还没有正式的周度研究结果');
    expect(html).toContain('aria-label="主导航"');
    expect(html).toContain('href="/queue">研究队列');
    expect(html).toContain('href="/system">系统');
    expect(html).toContain('href="/intake">＋ 录入材料');
    const primaryNav = html.match(/<nav aria-label="主导航">([\s\S]*?)<\/nav>/)?.[1] ?? '';
    expect(primaryNav.match(/href=/g)).toHaveLength(6);
    expect(html).toContain('自动采集');
    expect(html).toContain('尚未配置');
    const intakePage = await fetch(`${base}/intake`);
    const intakeHtml = await intakePage.text();
    expect(intakeHtml).toContain('研究材料智能解析');
    expect(intakeHtml).toContain('智能解析建议');
    expect(intakeHtml).toContain('叙事生命周期 · 研究材料智能解析');
    expect(intakeHtml).toContain('重试研究更新');
    expect(intakeHtml).toContain('/api/retry-weekly');
    expect(intakeHtml).toContain('aria-label="主导航"');
    expect(intakeHtml).toContain('href="/queue"');
    expect(intakeHtml).toContain('href="/changes"');
    expect(intakeHtml).toContain('href="/topics"');
    expect(intakeHtml).toContain('href="/system"');
    expect(intakeHtml).toContain('aria-current="page">＋ 录入材料');
    expect(intakeHtml).not.toContain('href="/inbox">证据');
    expect(intakeHtml).not.toContain('href="/sources">数据源');
    expect(intakeHtml).toContain('智能解析材料');
    expect(intakeHtml).toContain('自动化流程待开始');
    expect(intakeHtml).toContain('录入材料');
    expect(intakeHtml).toContain('E3 · 官方行动或真实落地');
    expect(intakeHtml).toContain('影响维度');
    expect(intakeHtml).toContain("['existing_topic','alias_of','new_branch','reactivation','new_provisional_topic','unresolved']");
    expect(intakeHtml).toContain("'<option value=\"' + opt");
    expect(intakeHtml).toContain('已匹配现有主题');
    expect(intakeHtml).toContain('<summary>技术详情</summary>');
    expect(intakeHtml).not.toContain('Page 1 · Paragraph');
    expect(intakeHtml).not.toContain('Affected Layer');
    expect(intakeHtml).toContain('为什么不能更高');
    expect(intakeHtml).toContain('--accent: #176b63');
    expect(intakeHtml).toContain('@media (max-width: 720px)');
    expect(intakeHtml).not.toContain('linear-gradient');

    const prepared = await post(base, '/api/prepare-text', {
      text: 'Medical rehabilitation BCI branch validation was reported with reimbursement follow-up. The parent BCI narrative still lacks broad pricing confirmation.',
    }) as { automation: { status: string; steps: string[] }; state: { session: EvidenceIntakeSession } };
    expect(prepared.automation.status).toBe('completed');
    expect(prepared.automation.steps).toContain('引用与安全校验');
    const candidate = prepared.state.session.candidates[0];
    expect(prepared.state.session.candidate_comparisons?.[0].human_decision_required).toBe(false);

    const agent = await post(base, '/api/intake-agent', {}) as { state: { agent_candidates: Array<{ source_candidate_id: string }>; agent_verification: { guardrail_check: { no_auto_import: boolean } } } };
    expect(agent.state.agent_candidates[0].source_candidate_id).toBe(candidate.candidate_id);
    expect(agent.state.agent_verification.guardrail_check.no_auto_import).toBe(true);

    const modified = {
      ...candidate.suggested_evidence,
      evidence_id: 'interactive_bci_medical_rehab_reviewed_001',
      source_type: 'research',
      evidence_strength: 'E2',
      confidence: 'medium',
    };
    const applied = await post(base, '/api/apply', {
      session_id: prepared.state.session.session_id,
      decisions: [{
        candidate_id: candidate.candidate_id,
        decision: 'modify',
        reviewer: 'interactive_test',
        review_started_at: '2026-07-13T00:00:00.000Z',
        reviewed_at: '2026-07-13T00:01:30.000Z',
        review_duration_seconds: 90,
        topic_resolution_status: 'existing_topic',
        modified_evidence: modified,
      }],
    }) as { apply: EvidenceIntakeApplyResult; evaluation: IntakeEvaluationReport; state: { weekly_brief: { stage_snapshot: Array<{ topic_id: string; current_stage: string }> } } };

    expect(applied.apply.imported).toBe(true);
    expect(applied.apply.weekly_run_id).toEqual(expect.stringMatching(/^run_/));
    expect(applied.evaluation.modification_rate).toBe(1);
    expect(applied.evaluation.average_review_time_seconds).toBe(90);
    // This is branch-only evidence. The reviewed parent baseline is S4 in
    // this workspace; branch material must not lift that parent any further.
    expect(applied.state.weekly_brief.stage_snapshot.find((topic) => topic.topic_id === 'bci')?.current_stage).toBe('S4');
    const operationalSnapshot = JSON.parse(readFileSync(resolve(root, 'outputs/operator_runs/latest_stage_snapshot.json'), 'utf8')) as {
      topics: Array<{ topic_id: string; why_not_higher_stage: string; branches: Array<{ branch_id: string; current_stage: string; evidence_ids: string[] }> }>;
    };
    const bci = operationalSnapshot.topics.find((topic) => topic.topic_id === 'bci');
    expect(bci?.why_not_higher_stage).toContain('Missing pricing adoption');
    expect(bci?.branches.find((branch) => branch.branch_id === 'bci_medical_rehab')).toMatchObject({
      current_stage: 'S2',
    });
    expect(bci?.branches.find((branch) => branch.branch_id === 'bci_medical_rehab')?.evidence_ids)
      .toContain('interactive_bci_medical_rehab_reviewed_001');
    expect(readFileSync(resolve(root, 'outputs/intake/interactive_review_decisions.yaml'), 'utf8')).toContain('interactive_bci_medical_rehab_reviewed_001');

    const learned = await post(base, '/api/learn', {}) as { profile: { adaptation_mode: string; auto_rule_mutation: boolean; auto_stage_change: boolean; auto_topic_activation: boolean } };
    // The current controlled-autonomy profile learns from reviewed outcomes.
    // Evidence and parent/branch stage rules remain independently guarded.
    expect(learned.profile.adaptation_mode).toBe('autonomous');
    expect(learned.profile.auto_rule_mutation).toBe(true);
    expect(learned.profile.auto_stage_change).toBe(true);
    expect(learned.profile.auto_topic_activation).toBe(true);

    const monitor = await fetch(`${base}/api/monitor`).then((response) => response.json()) as { status: string; topics: Array<{ topic_id: string }> };
    expect(monitor.status).toBe('ready');
    expect(monitor.topics.map((topic) => topic.topic_id)).toContain('bci');
    const dashboard = await fetch(base).then((response) => response.text());
    expect(dashboard).toContain('今日研究概览');
    expect(dashboard).toContain('系统健康与数据新鲜度');
    const changesPage = await fetch(`${base}/changes`).then((response) => response.text());
    expect(changesPage).toContain('变化中心');
    expect(changesPage).toContain('为什么不能更高');
    const topicsPage = await fetch(`${base}/topics`).then((response) => response.text());
    expect(topicsPage).toContain('题材与叙事');
    expect(topicsPage).toContain('当前核心主题');
    const inboxPage = await fetch(`${base}/inbox`).then((response) => response.text());
    expect(inboxPage).toContain('候选证据');
    expect(inboxPage).toContain('aria-label="研究队列导航"');
    expect(inboxPage).toContain('href="/queue">待处理');
    expect(inboxPage).toContain('nav-link active" href="/queue" aria-current="page">研究队列');
    const runsPage = await fetch(`${base}/runs`).then((response) => response.text());
    expect(runsPage).toContain('系统运行');
    expect(runsPage).toContain('尚未配置');
    expect(runsPage).toContain('aria-label="系统导航"');
    expect(runsPage).toContain('nav-link active" href="/system" aria-current="page">系统');
    const systemPage = await fetch(`${base}/system`).then((response) => response.text());
    expect(systemPage).toContain('系统管理');
    expect(systemPage).toContain('运行状态');
    expect(systemPage).toContain('学习治理');
    expect(systemPage).toContain('方法论');
    const sourcesPage = await fetch(`${base}/sources`).then((response) => response.text());
    expect(sourcesPage).toContain('目录存在 ≠ 可自动使用');
    expect(sourcesPage).toContain('测试来源只检查连接与格式');
    expect(sourcesPage).toContain('原始数据');
    expect(sourcesPage).toContain('授权待审核');
    expect(sourcesPage).toContain('忽略轻微修订');
    expect(sourcesPage).toContain('不代表它已经成为正式证据');
    const topicPage = await fetch(`${base}/topics/bci`).then((response) => response.text());
    expect(topicPage).toContain('整体主题与细分分支');
    expect(topicPage).toContain('分支不自动升级整体主题');
    expect(topicPage).toContain('nav-link active" href="/topics" aria-current="page">主题');
    const queuePage = await fetch(`${base}/queue`).then((response) => response.text());
    expect(queuePage).toContain('研究待处理队列');
    expect(queuePage).toContain('候选证据');
    expect(queuePage).toContain('早期线索');
    const methodologyPage = await fetch(`${base}/methodology`).then((response) => response.text());
    expect(methodologyPage).toContain('量化方法论');
    expect(methodologyPage).toContain('S_final = min');
    expect(methodologyPage).toContain('尚未完成经验校准的参考指数');
    expect(methodologyPage).toContain('没有证据表，就不允许评分');
    const governancePage = await fetch(`${base}/governance`).then((response) => response.text());
    expect(governancePage).toContain('学习与治理');
    expect(governancePage).toContain('学习闭环');
    expect(governancePage).toContain('系统保护规则');
    expect(governancePage).toContain('研究者多次修改信息可靠度');
    expect(governancePage).not.toContain('LEARNING CYCLE');
    expect(governancePage).not.toContain('SYSTEM GUARDRAILS');

    await post(base, '/api/prepare-text', { text: 'A later unrelated source session that has not been reviewed.' });
    const isolatedState = await fetch(`${base}/api/state`).then((response) => response.json()) as {
      apply_result: EvidenceIntakeApplyResult | null;
      weekly_brief: unknown | null;
      stage_diff: unknown | null;
    };
    expect(isolatedState.apply_result).toBeNull();
    expect(isolatedState.weekly_brief).toBeNull();
    expect(isolatedState.stage_diff).toBeNull();
  });

  it('auto-registers unresolved candidates during interactive import (autonomous mode)', { timeout: 20000 }, async () => {
    const root = seedWorkspace();
    const base = await listen(root);
    const prepared = await post(base, '/api/prepare-text', { text: 'Ambiguous unresolved topic with unclear labels and no canonical branch.' }) as { state: { session: EvidenceIntakeSession } };
    const candidate = prepared.state.session.candidates[0] as EvidenceCandidate;
    const staleResponse = await fetch(`${base}/api/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'stale_session', decisions: [] }),
    });
    expect(staleResponse.status).toBe(500);
    expect((await staleResponse.json() as { error: string }).error).toContain('stale review submission');

    const response = await fetch(`${base}/api/apply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: prepared.state.session.session_id,
        decisions: [{
          candidate_id: candidate.candidate_id,
          decision: 'modify',
          reviewer: 'interactive_test',
          reviewed_at: '2026-07-13T00:00:00.000Z',
          topic_resolution_status: 'unresolved',
          modified_evidence: { ...candidate.suggested_evidence, evidence_id: 'interactive_unresolved_auto_registered' },
        }],
      }),
    });
    // Autonomous mode: unresolved candidates are no longer blocked; the
    // apply pipeline proceeds and reports the import outcome instead.
    const body = await response.json() as { apply?: { imported?: boolean; import_status?: string } };
    expect(response.status).toBe(200);
    expect(body.apply).toBeDefined();
  });
});

async function post(base: string, path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await response.json();
  if (!response.ok || parsed.error) throw new Error(parsed.error ?? 'request failed');
  return parsed;
}
