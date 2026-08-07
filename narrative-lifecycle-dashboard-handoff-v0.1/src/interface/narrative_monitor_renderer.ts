import type { NarrativeMonitorModel, NarrativeMonitorTopic } from '../types/narrative_monitor';
import { QUANTITATIVE_RULE_VERSION } from '../domain/quantitative_framework';
import { isUsableBranchName } from '../domain/market_naming';

export function renderNarrativeMonitor(model: NarrativeMonitorModel): string {
  const body = model.status === 'insufficient_data'
    ? `<section class="hero-row"><div><p class="eyebrow">今日概览</p><h1>研究热度视图 (Terminal View)</h1><p class="lede">当前还没有正式的周度研究结果；系统只展示已经真实产生的状态。</p></div>${oneClickAutoRun(model)}</section>${systemStatusBar(model)}${emptyState('尚无周度研究结果', '完成一次自动调研循环后，系统才会显示经过阶段门槛验证的主题状态。', '/agent', '立即自动调研')}`
    : `
      <section class="hero-row">
        <div><p class="eyebrow">Terminal View</p><h1>研究热度视图 (Macro Heatmap)</h1><p class="lede">全景扫描当前投资线索。颜色代表变化方向，密度点代表证据强度。</p></div>
        ${oneClickAutoRun(model)}<div class="run-meta"><span>最近更新</span><strong>${friendlyDate(model.generated_at)}</strong>${technicalDetails([['运行批次', model.run_id]])}</div>
      </section>
      ${systemStatusBar(model)}
      ${metricGrid(model)}
      <section class="panel wide-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">赛道全景</p><h2>主题热度网格</h2></div>
          <a class="text-link" href="/changes">查看详细变化 →</a>
        </div>
        <div class="heatmap-grid">
          ${model.topics.map(topic => {
            const hasChange = model.changes.some(c => c.topic_id === topic.topic_id && c.change_type !== 'no_change');
            const colorClass = hasChange ? 'timeline-milestone' : ''; // Just to highlight
            const style = hasChange ? 'border-color: var(--accent); background: rgba(136, 192, 208, 0.05);' : '';
            return `<a class="heatmap-card" href="/topics/${encodeURIComponent(topic.topic_id)}" style="${style}">
              <span class="stage ${stageDisplay(topic.current_stage).includes('早期') ? 'early' : 'mid'}">${stageDisplay(topic.current_stage)}</span>
              <h3>${escape(topic.topic_name)}</h3>
              <p>${escape(topic.weakest_layer)}</p>
              <div class="heatmap-density">
                ${[...Array(6)].map((_, i) => `<div class="heatmap-tick ${i < Math.min(6, Math.max(1, topic.evidence_count)) ? 'active' : ''}"></div>`).join('')}
              </div>
            </a>`;
          }).join('')}
        </div>
      </section>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-heading"><div><p class="eyebrow">研究待办</p><h2>研究队列</h2></div><a class="text-link" href="/queue">打开队列</a></div>${queuePreview(model)}</section>
        <section class="panel"><div class="panel-heading"><div><p class="eyebrow">系统状态</p><h2>系统健康与数据新鲜度</h2></div><a class="text-link" href="/runs">查看运行</a></div>${artifactHealth(model)}</section>
      </div>`;
  return pageShell('overview', '研究概览', body);
}

function oneClickAutoRun(model: NarrativeMonitorModel): string {
  const agent = model.research_agent;
  const running = agent?.loop_running ?? false;
  return `<div class="one-click-run">
    <button class="button primary" id="one-click-run" onclick="runAgentNow()" ${running ? 'disabled' : ''}>${running ? '自动调研中…' : '一键自动调研'}</button>
    <p class="small" id="one-click-status">${running ? '正在同步数据源、草拟并导入证据、更新主题与阶段。' : '自动完成：同步数据源 → 拆解候选 → 智能识别主题 → 导入证据 → 更新研究结果。'}</p>
  </div>
  <script>
    async function runAgentNow() {
      const button = document.getElementById('one-click-run');
      const status = document.getElementById('one-click-status');
      button.disabled = true; button.textContent = '自动调研中…';
      status.textContent = '正在同步数据源、草拟并导入证据、更新主题与阶段，请稍候。';
      try {
        const response = await fetch('/api/agent/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loop_kind: 'manual' }) });
        const data = await response.json().catch(() => ({}));
        if (data.status === 'already_running') { status.textContent = '已有一轮自动调研正在运行，页面即将刷新。'; }
        await waitForAgentIdle();
      } catch (error) { status.textContent = '自动调研启动失败：' + error; }
      location.reload();
    }
    async function waitForAgentIdle() {
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        const data = await fetch('/api/agent/state').then((r) => r.json()).catch(() => null);
        if (data?.research_agent?.loop_running === false) return;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  </script>`;
}

export function renderChanges(model: NarrativeMonitorModel): string {
  return pageShell('changes', '变化中心', `
    <section class="hero-row"><div><p class="eyebrow">只看变化</p><h1>变化中心</h1><p class="lede">分别展示阶段、证据、数据可信度、不能升级的原因和分支变化。</p></div><div class="run-meta"><span>比较时间</span><strong>${friendlyDate(model.generated_at)}</strong>${technicalDetails([['运行批次', model.run_id]])}</div></section>
    ${model.changes.length ? `<section class="change-feed">${model.changes.map((change) => `
      <article class="panel change-card">
        <div class="change-card-head"><div><p class="eyebrow">${changeLabel(change.change_type)}</p><h2><a class="topic-link" href="/topics/${encodeURIComponent(change.topic_id)}">${displayName(change.topic_name)}</a></h2></div><span class="chip ${priorityClass(change.priority)}">${priorityLabel(change.priority)}</span></div>
        <div class="before-after"><div><span>之前</span><strong>${change.previous_stage ? stageDisplay(change.previous_stage) : '无历史'}</strong><small>信息可靠度：${confidenceLabel(change.previous_data_confidence ?? 'low')}</small></div><div class="change-arrow">→</div><div><span>现在</span><strong>${stageDisplay(change.current_stage)}</strong><small>信息可靠度：${confidenceLabel(change.current_data_confidence)}</small></div></div>
        <dl class="fact-list"><dt>证据变化</dt><dd>新增 ${change.new_evidence_ids.length} 条 · 移除 ${change.removed_evidence_ids.length} 条</dd><dt>为什么改变</dt><dd>${friendlyReason(change.change_reason)}</dd><dt>为什么不能更高</dt><dd>${friendlyReason(change.current_why_not_higher_stage)}</dd><dt>下一步验证</dt><dd>${friendlyReason(change.research_only_action)}</dd></dl>
        ${technicalDetails([['新增证据编号', change.new_evidence_ids.join(', ')], ['移除证据编号', change.removed_evidence_ids.join(', ')]])}
      </article>`).join('')}</section>` : '<section class="panel"><p class="muted">尚无历史变化记录。</p></section>'}`);
}

export function renderTopics(model: NarrativeMonitorModel): string {
  return pageShell('topics', '题材与叙事', `
    <section class="hero-row"><div><p class="eyebrow">正式主题</p><h1>题材与叙事</h1><p class="lede">父主题和分支分别判断；分支的证据和阶段不会自动抬高父主题。</p></div><a class="button secondary" href="/intake">录入新材料</a></section>
    <section class="panel monitor-table"><div class="panel-heading"><div><p class="eyebrow">主题全景</p><h2>当前核心主题</h2></div><span class="guardrail-note">分支不自动升级父主题</span></div>${topicTable(model.topics)}</section>`);
}

export function renderEvidenceInbox(model: NarrativeMonitorModel): string {
  return pageShell('inbox', '候选证据', `
    ${researchQueueNav('inbox')}
    <section class="hero-row"><div><p class="eyebrow">待确认事实</p><h1>候选证据</h1><p class="lede">这里展示最近解析出的事实候选。候选经自动校验后导入为正式证据。</p></div><a class="button primary" href="/intake">审核候选</a></section>
    ${model.inbox.length ? `<section class="inbox-list">${model.inbox.map((item) => `<article class="panel inbox-card">
      <div class="change-card-head"><div><p class="eyebrow">${reviewStatusLabel(item.review_status)}</p><h2>${friendlyTopic(item.topic_id)}${item.branch_id ? ` / ${escape(item.branch_id)}` : ''}</h2></div><span class="evidence-strength">${evidenceStrengthLabel(item.evidence_strength)}</span></div>
      <blockquote>${escape(item.quote)}</blockquote>
      <dl class="fact-list"><dt>归属范围</dt><dd>${scopeLabel(item.scope)}</dd><dt>主题归属</dt><dd>${resolutionLabel(item.resolution_status)} · ${friendlyReason(item.resolution_reason)}</dd><dt>智能解析</dt><dd>${agentStatusLabel(item.agent_status)}</dd><dt>重复检查</dt><dd>${item.duplicate_of_evidence_id ? '可能与已有证据重复' : '未发现重复'}</dd></dl>
      ${technicalDetails([['候选编号', item.candidate_id], ['解析批次', item.session_id], ['重复证据编号', item.duplicate_of_evidence_id]])}
    </article>`).join('')}</section>` : '<section class="panel"><p class="muted">当前没有候选证据。请通过“录入材料”上传文件或粘贴文本。</p></section>'}`);
}

export function renderAgentRuns(model: NarrativeMonitorModel): string {
  const system = model.system;
  return pageShell('runs', '系统运行', `
    ${systemNav('runs')}
    <section class="hero-row"><div><p class="eyebrow">运行与模型状态</p><h1>系统运行</h1><p class="lede">分别展示智能解析服务和正式研究处理流程。备用规则可继续生成候选，但不代表真实模型已运行。</p></div><span class="state-pill ${stateClass(system.provider_state)}">${stateLabel(system.provider_state)}</span></section>
    <div class="status-grid">
      ${statusCard('模型服务', system.provider_state === 'not_configured' ? '尚未配置' : '已连接', system.provider_state, '用于生成候选建议，不直接形成正式证据')}
      ${statusCard('备用规则', system.fallback_state === 'active' ? '已启用' : system.fallback_state === 'inactive' ? '未启用' : '状态未知', system.fallback_state === 'active' ? 'fallback' : 'operational', '模型不可用时保留基础解析能力')}
      ${statusCard('自动采集', '尚未配置', 'not_configured', '当前仅支持手动上传和粘贴')}
      ${statusCard('运行性质', runModeLabel(system.run_mode), system.run_mode === 'unlabeled' ? 'unlabeled' : 'operational', '未标记的运行不能视为正式研究结果')}
    </div>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">运行历史</p><h2>最近运行记录</h2></div><span class="small">最多显示 30 条</span></div>
      ${model.recent_runs.length ? `<div class="table-scroll"><table><thead><tr><th>完成时间</th><th>运行性质</th><th>结果</th><th>规则检查</th><th>详情</th></tr></thead><tbody>${model.recent_runs.map((run) => `<tr><td><strong>${friendlyDate(run.completed_at)}</strong><small>${friendlyDate(run.started_at)} 开始</small></td><td>${escape(runModeLabel(run.run_mode))}</td><td><span class="state-pill ${run.status === 'ok' ? 'ok' : 'bad'}">${run.status === 'ok' ? '已完成' : '未完成'}</span></td><td>${run.guardrail_status === 'ok' ? '通过' : '需要复核'}</td><td>${technicalDetails([['运行批次', run.run_id], ['处理步骤', run.commands.join(' → ')]])}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">尚无运行记录。</p>'}
    </section>`);
}

export function renderAgentDashboard(model: NarrativeMonitorModel): string {
  const agent = model.research_agent;
  const lastRun = agent.last_run;
  const evolution = agent.evolution;
  const scheduler = agent.scheduler;
  const driftFlags = evolution?.drift_flags ?? [];
  const driftCount = driftFlags.filter((flag) => flag.detected).length;
  const lastMetrics = lastRun?.metrics;
  const graphPromotion = agent.graph_promotion;
  const webResearch = agent.web_research;
  const researchCampaign = agent.research_campaign;
  const directSourceResearch = agent.direct_source_research;
  const leadTriage = agent.research_lead_triage;
  const sourceRetrieval = agent.research_source_retrieval;
  const baselineCompletion = agent.research_baseline_completion;
  const retrievedSources = sourceRetrieval?.items.filter((item) => item.status === 'retrieved') ?? [];
  const companyTargetCount = new Set(researchCampaign?.tasks.flatMap((task) => task.company_targets?.map((company) => company.company_id) ?? []) ?? []).size;
  const companyTargetNames = [...new Map((researchCampaign?.tasks.flatMap((task) => task.company_targets ?? []) ?? [])
    .map((company) => [company.company_id, company.display_name_zh])).values()];
  const graphItems = [...(graphPromotion?.items ?? [])]
    .sort((left, right) => Number(right.decision === 'activated') - Number(left.decision === 'activated') || right.independent_source_count - left.independent_source_count)
    .slice(0, 12);
  const kpi = (label: string, value: string, note: string) => `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;
  const loopState = lastRun?.status === 'failed' ? 'failed' : lastRun?.status === 'partial' ? 'warn' : agent.enabled ? 'operational' : 'not_configured';
  const timeline = agent.run_history.slice(0, 12);
  return pageShell('agent', 'Agent 状态', `
    <script>
      async function runAgentNow() {
        const button = document.getElementById('run-agent');
        button.disabled = true; button.textContent = '运行中…';
        try {
          const response = await fetch('/api/agent/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loop_kind: 'manual' }) });
          const data = await response.json().catch(() => ({}));
          if (data.status === 'already_running') { alert('已有一轮循环正在运行，请等待完成。'); location.reload(); return; }
          await waitForAgentIdle();
        } finally { location.reload(); }
      }
      async function runCoverageCampaign() {
        const button = document.getElementById('run-coverage-campaign');
        button.disabled = true; button.textContent = '规划中…';
        try {
          const response = await fetch('/api/research/campaign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ max_tasks: 60, max_queries: 12 }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || '研究覆盖计划失败');
        } catch (error) { window.alert('研究覆盖计划失败：' + error.message); }
        finally { location.reload(); }
      }
      async function waitForAgentIdle() {
        const deadline = Date.now() + 10 * 60 * 1000; // 最长等待 10 分钟
        while (Date.now() < deadline) {
          const data = await fetch('/api/agent/state').then((r) => r.json()).catch(() => null);
          if (data?.research_agent?.loop_running === false) return;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      async function saveScheduler() {
        const form = document.getElementById('scheduler-form');
        const data = Object.fromEntries(new FormData(form).entries());
        data.enabled = form.elements['enabled'].checked;
        data.quick_enabled = form.elements['quick_enabled'].checked;
        data.daily_max_operations = Number(data.daily_max_operations);
        data.quick_max_operations = Number(data.quick_max_operations);
        data.quick_interval_hours = Number(data.quick_interval_hours);
        for (const key of ['stale_candidate_max_age_days','queue_high_priority_max_age_days','queue_medium_priority_max_age_days','queue_low_priority_max_age_days','evolution_history_max_entries']) data[key] = Number(data[key]);
        await fetch('/api/agent/scheduler-config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        location.reload();
      }
      async function confirmAllChainEntries() {
        const btn = document.getElementById('auto-confirm-chain-btn');
        if (btn) btn.innerText = '确认中…';
        await fetch('/api/agent/confirm-all-chain-entries', { method: 'POST' });
        location.reload();
      }
      setTimeout(() => { if (!document.hidden) location.reload(); }, 30000);
    </script>
    <section class="hero-row">
      <div><p class="eyebrow">自驱动研究 Agent</p><h1>自动调研与迭代循环</h1><p class="lede">按已配置来源同步信息、拆解候选、识别主题和细分方向，并持续积累正式证据。满足独立来源门槛的暂定主题与观察分支可按策略激活；冲突、未解析和高阶段跳跃会自动暂停并进入复核。阶段与评分始终只由正式证据和确定性规则计算。</p></div>
      <div class="action-row"><button id="auto-confirm-chain-btn" class="button secondary" onclick="confirmAllChainEntries()">全自动确认提案与证据链</button><button id="run-coverage-campaign" class="button secondary" onclick="runCoverageCampaign()">启动主题覆盖研究</button><button id="run-agent" class="button primary" onclick="runAgentNow()" ${agent.loop_running ? 'disabled' : ''}>${agent.loop_running ? '运行中…' : '立即运行一轮'}</button></div>
    </section>
    <section class="system-strip">
      ${compactStatus('调度器', scheduler.enabled ? '已启用' : '已停用', scheduler.enabled ? 'operational' : 'not_configured')}
      ${compactStatus('下一轮调研', friendlyDate(agent.next_daily_run), agent.next_daily_run ? 'operational' : 'not_configured')}
      ${compactStatus('最近一轮', friendlyDate(lastRun?.completed_at), loopState)}
      ${compactStatus('进化漂移', driftCount ? `检测到 ${driftCount} 项` : '无漂移', driftCount ? 'warn' : 'operational')}
      ${compactStatus('运行中', agent.loop_running ? '是' : '否', agent.loop_running ? 'warn' : 'operational')}
      ${compactStatus('覆盖计划', researchCampaign ? `${researchCampaign.summary.task_count} 项任务` : '尚未生成', researchCampaign ? 'operational' : 'not_configured')}
      ${compactStatus('权威 API', directSourceResearch?.status === 'completed' ? '已完成' : directSourceResearch?.status === 'degraded' ? '部分可用' : directSourceResearch?.status === 'insufficient_coverage' ? '待接通' : '尚未运行', directSourceResearch?.status === 'completed' ? 'operational' : directSourceResearch?.status === 'degraded' ? 'warn' : 'not_configured')}
      ${compactStatus('外部检索', webResearch?.status === 'completed' ? '已完成' : webResearch?.status === 'degraded' ? '部分可用' : webResearch?.status === 'unconfigured' ? '未配置' : '尚未运行', webResearch?.status === 'completed' ? 'operational' : webResearch?.status === 'degraded' ? 'warn' : 'not_configured')}
      ${compactStatus('线索分诊', leadTriage ? `优先 ${leadTriage.summary.priority_review_count} · 待核 ${leadTriage.summary.review_count}` : '尚未生成', leadTriage?.summary.priority_review_count ? 'warn' : leadTriage ? 'operational' : 'not_configured')}
      ${compactStatus('基准补全', baselineCompletion ? `${baselineCompletion.summary.high_priority_count} 项优先` : '尚未生成', baselineCompletion?.summary.high_priority_count ? 'warn' : baselineCompletion ? 'operational' : 'not_configured')}
    </section>
    <section class="metric-grid">
      ${kpi('候选草拟', String(lastMetrics?.candidate_count ?? 0), '本轮草拟候选数')}
      ${kpi('受控源同步', lastMetrics ? `${lastMetrics.sources_completed}/${lastMetrics.sources_requested}` : '—', lastMetrics ? `WorldMonitor 连接；失败 ${lastMetrics.sources_failed}` : '尚无运行')}
      ${kpi('权威 API 查询', String(lastMetrics?.direct_source_queries ?? 0), `定向线索 ${lastMetrics?.direct_source_leads ?? 0}；不会直接成为正式证据`)}
      ${kpi('接受率', pct(evolution?.rolling_acceptance_rate), '滚动接受率')}
      ${kpi('影子一致率', pct(evolution?.rolling_shadow_agreement_rate), '滚动影子一致率')}
      ${kpi('金标通过率', pct(evolution?.rolling_golden_gate_pass_rate), '滚动晋级门槛通过率')}
      ${kpi('已净化', String((lastMetrics?.purged_stale_candidates ?? 0) + (lastMetrics?.purged_aged_queue_items ?? 0)), `过期候选 ${lastMetrics?.purged_stale_candidates ?? 0} · 老化队列 ${lastMetrics?.purged_aged_queue_items ?? 0}`)}
      ${kpi('改进提案', String(evolution?.proposals.filter((p) => p.status === 'proposed').length ?? 0), '等待审核的改进建议')}
      ${kpi('周度报告', lastMetrics?.weekly_run_id ? '已生成' : '跳过', lastMetrics?.weekly_run_id ? '本轮研究结果已保存' : '本轮未执行')}
      ${kpi('正式证据', String(lastMetrics?.imported_evidence_count ?? 0), '本轮写入正式证据表的证据数')}
      ${kpi('激活主题', String(lastMetrics?.provisional_topics_activated ?? 0), '已达到独立来源门槛的新主题')}
      ${kpi('激活分支/资产', String(lastMetrics?.watch_branches_activated ?? 0), '独立积累，不升级父主题')}
      ${kpi('自动暂停', String(lastMetrics?.graph_nodes_held ?? 0), '证据不足或存在冲突的节点')}
      ${kpi('研究覆盖', String(researchCampaign?.summary.task_count ?? lastMetrics?.research_campaign_tasks ?? 0), researchCampaign ? `来源目标 ${researchCampaign.summary.source_target_count} · 研究种子 ${researchCampaign.summary.universe_seed_count}` : `来源目标 ${lastMetrics?.research_campaign_source_targets ?? 0} · 研究种子 ${lastMetrics?.research_campaign_seed_topics ?? 0}`)}
      ${kpi('公司核验', String(companyTargetCount), researchCampaign ? '官网/IR 仅作定向核验，不直接形成证据' : '生成覆盖计划后显示')}
      ${kpi('权威 API 线索', String(directSourceResearch?.lead_count ?? lastMetrics?.direct_source_leads ?? 0), directSourceResearch ? `${directSourceResearch.queries.filter((query) => query.status === 'completed').length} 个定向查询；只作待核验线索` : '尚未执行定向原始来源查询')}
      ${kpi('外部线索', String(webResearch?.lead_count ?? 0), webResearch ? `${webResearch.queries.length} 个检索词；只作待核验线索` : '尚未执行外部检索')}
      ${kpi('优先复核', String(leadTriage?.summary.priority_review_count ?? 0), leadTriage ? `普通复核 ${leadTriage.summary.review_count} · 背景参考 ${leadTriage.summary.reference_only_count} · 暂缓 ${leadTriage.summary.hold_count}` : '运行覆盖计划后自动分诊')}
    </section>
    <div class="dashboard-grid">
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">循环时间线</p><h2>最近运行</h2></div><a class="text-link" href="/runs">查看正式运行</a></div>
        ${timeline.length ? timeline.map((run) => `
          <article class="agent-run">
            <div class="agent-run-head"><span class="state-pill ${run.status === 'completed' ? 'ok' : run.status === 'partial' ? 'warn' : 'bad'}">${agentRunStatusLabel(run.status)}</span><strong>${friendlyDate(run.started_at)}</strong><span class="chip">${loopKindLabel(run.loop_kind)} · ${triggerLabel(run.triggered_by)}</span></div>
            <div class="agent-phase-row">${run.phases.map((phase) => `<span class="phase-pill ${phase.status === 'ok' ? 'ok' : phase.status === 'failed' ? 'bad' : 'muted'}">${phaseLabel(phase.phase)}</span>`).join('')}</div>
            <p class="muted">覆盖任务 ${run.metrics.research_campaign_tasks ?? 0} · 权威 API ${run.metrics.direct_source_queries ?? 0} 次 / 线索 ${run.metrics.direct_source_leads ?? 0} 条 · 受控源同步 ${run.metrics.sources_completed}/${run.metrics.sources_requested} · 候选 ${run.metrics.candidate_count} · 激活主题 ${run.metrics.provisional_topics_activated ?? 0} · 激活分支 ${run.metrics.watch_branches_activated ?? 0} · 暂停 ${run.metrics.graph_nodes_held ?? 0} · 漂移 ${run.metrics.drift_detected ? '有' : '无'}</p>
            ${technicalDetails([['运行批次', run.run_id], ['起止', `${run.started_at} → ${run.completed_at}`]])}
          </article>`).join('') : '<p class="muted">尚无 Agent 运行记录。点击“立即运行一轮”开始第一次自动调研循环。</p>'}
      </section>
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">来源核验队列</p><h2>权威原始记录与外部检索</h2><p class="small">所有结果都不是正式证据。必须打开原始来源并通过引用、主题/分支与 Evidence Gate，才可进入正式证据表。</p></div><span class="state-pill ${directSourceResearch?.status === 'completed' ? 'ok' : directSourceResearch?.status === 'degraded' || webResearch?.status === 'degraded' ? 'warn' : 'muted-state'}">${directSourceResearch?.status === 'completed' ? '原始来源已完成' : webResearch?.status === 'completed' ? '外部检索已完成' : '等待连接'}</span></div>
        ${baselineCompletion ? `<h3 class="section-subtitle">阶段基准与命名补全</h3><p class="small">每次覆盖研究都会先生成此清单。它只调整研究顺序和待核验事项，不改变已有阶段、证据或登记册。</p>${baselineCompletion.items.slice(0, 8).map((item) => `<div class="list-row"><span><strong>${item.kind === 'parent_evidence_baseline' ? '父主题证据基准' : item.kind === 'topic_name_verification' ? '主题命名核验' : '细分方向命名核验'}：${escape(item.display_name_zh)}</strong><p>${escape(item.rationale)}</p></span><span class="chip ${item.priority === 'high' ? 'high' : 'medium'}">${item.priority === 'high' ? '优先补全' : '待核验'}</span></div>`).join('')}${baselineCompletion.items.length > 8 ? `<p class="small">另有 ${baselineCompletion.items.length - 8} 项保留在基准补全计划中。</p>` : ''}` : ''}
        ${researchCampaign ? `<p class="small">当前计划：${researchCampaign.summary.formal_topic_count} 个正式主题、${researchCampaign.summary.branch_count} 个独立分支、${researchCampaign.summary.universe_seed_count} 个研究种子，定向覆盖 ${researchCampaign.summary.source_target_count} 个权威来源及 ${companyTargetCount} 家公司官网/IR。研究种子不会自动成为正式主题；公司材料也必须通过原始引用与 Evidence Gate。</p>` : ''}
        ${companyTargetNames.length ? `<p class="small">本轮公司核验对象：${companyTargetNames.slice(0, 16).map(escape).join('、')}${companyTargetNames.length > 16 ? `等 ${companyTargetNames.length} 家` : ''}。</p>` : ''}
        ${leadTriage?.items.length ? `<h3 class="section-subtitle">按规则分诊的优先线索</h3>${leadTriage.items.filter((item) => item.disposition === 'priority_review' || item.disposition === 'review').slice(0, 6).map((item) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(item.title)}</a></strong><p>${escape(item.source_name)} · ${item.branch_id ? `独立分支：${friendlyTopic(item.branch_id)}` : item.topic_id ? friendlyTopic(item.topic_id) : '待解析主题'} · ${escape(item.reasons[0] ?? '待人工核验')}</p></span><span class="chip">${item.disposition === 'priority_review' ? '优先复核' : '普通复核'}</span></div>`).join('')}<p class="small">分诊仅安排人工核验顺序；打开原文、确认引用位置与主题范围后，才可进入 Evidence Intake。</p>` : ''}
        ${retrievedSources.length ? `<h3 class="section-subtitle">可复核的原文摘录</h3><p class="small">已从权威原始记录提取有限正文。它们仍是待审核材料，不会自动成为正式证据或改变阶段。</p>${retrievedSources.slice(0, 6).map((item) => `<article class="source-excerpt"><div class="list-row"><span><strong><a class="topic-link" href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(item.page_title ?? item.title)}</a></strong><p>${item.branch_id ? `独立分支：${friendlyTopic(item.branch_id)}` : item.topic_id ? friendlyTopic(item.topic_id) : '待解析主题'} · ${item.source_class === 'official' ? '官方原始记录' : item.source_class === 'academic' ? '学术原文' : '原始来源'}</p></span><span class="chip">待进入材料审核</span></div>${item.excerpts.slice(0, 2).map((excerpt) => `<blockquote><small>${escape(excerpt.location_label)}</small>${escape(excerpt.quote)}</blockquote>`).join('')}</article>`).join('')}` : sourceRetrieval ? '<p class="muted">已请求原始页面，但当前没有可用的正文摘录。该状态不会影响已有正式证据或阶段。</p>' : ''}
        ${directSourceResearch?.leads.length ? `<h3 class="section-subtitle">权威原始来源</h3>${directSourceResearch.leads.slice(0, 8).map((lead) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(lead.url)}" target="_blank" rel="noreferrer">${escape(lead.title)}</a></strong><p>${escape(lead.source_name)} · ${lead.topic_id ? friendlyTopic(lead.topic_id) : '待解析主题'}${lead.branch_id ? ` · ${friendlyTopic(lead.branch_id)}` : ''}${lead.snippet ? ` · ${escape(lead.snippet)}` : ''}</p></span><span class="chip">待核验</span></div>`).join('')}` : directSourceResearch ? `<p class="muted">权威 API 已运行，但没有可显示的定向记录。${directSourceResearch.queries.some((query) => query.status === 'failed') ? '部分来源请求失败，已保留状态。' : ''}</p>` : ''}
        ${webResearch?.leads.length ? '<h3 class="section-subtitle">外部检索线索</h3>' : ''}
        ${webResearch?.leads.length ? webResearch.leads.slice(0, 12).map((lead) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(lead.url)}" target="_blank" rel="noreferrer">${escape(lead.title)}</a></strong><p>${escape(lead.source_name)} · ${lead.topic_id ? friendlyTopic(lead.topic_id) : '命名核验'}${lead.snippet ? ` · ${escape(lead.snippet)}` : ''}</p></span><span class="chip">待核验</span></div>`).join('') : `<p class="muted">${webResearch?.status === 'unconfigured' ? researchCampaign ? '覆盖计划已生成，但外部检索服务尚未配置。可配置 Brave、Tavily 或 MCP Bridge；检索服务不会使用模型密钥。' : '外部检索服务尚未配置，且尚未生成覆盖计划。' : '尚未生成外部线索。'}</p>`}
        ${webResearch?.errors.length ? `<p class="small">${webResearch.errors.map(friendlyWebResearchError).join('；')}</p>` : ''}
      </section>
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">进化台账</p><h2>漂移监测</h2></div></div>
        ${driftFlags.length ? driftFlags.map((flag) => `<div class="guardrail-row"><span>${metricLabel(flag.metric)}<small>当前 ${pct(flag.current)} · 基线 ${pct(flag.baseline)}</small></span><strong class="${flag.detected ? 'fail' : 'pass'}">${flag.detected ? '漂移' : '正常'}</strong>${technicalDetails([['偏差', flag.deviation === null ? '—' : `${(flag.deviation * 100).toFixed(1)}%`], ['阈值', `${flag.threshold * 100}%`]])}</div>`).join('') : '<p class="muted">完成一次循环后生成漂移监测。</p>'}
      </section>
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">改进提案</p><h2>待审核的改进建议</h2></div><span class="small">仅供审核</span></div>
        ${evolution?.proposals.length ? evolution.proposals.filter((p) => p.status === 'proposed').slice(0, 6).map((proposal) => `<div class="list-row"><strong>${proposalKindLabel2(proposal.kind)}</strong><p>${friendlyReason(proposal.rationale)}</p><span class="chip medium">等待批准</span></div>`).join('') : '<p class="muted">尚无待审核的改进提案。</p>'}
      </section>
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">自动主题图谱</p><h2>主题、分支与命名资产的积累结果</h2></div>${graphPromotion ? `<span class="small">本轮激活 ${graphPromotion.summary.provisional_topics_activated + graphPromotion.summary.watch_branches_activated} 个 · 暂停 ${graphPromotion.summary.held_count} 个 · 显示 ${graphItems.length}/${graphPromotion.items.length} 个</span>` : ''}</div>
        ${graphItems.length ? graphItems.map((item) => `<div class="guardrail-row"><span><strong>${item.node_kind === 'topic' ? '主题' : '分支/资产'} · ${friendlyTopic(item.node_id)}</strong><small>${graphPromotionReason(item)}</small></span><strong class="${item.decision === 'activated' ? 'pass' : 'fail'}">${item.decision === 'activated' ? '已自动激活' : '自动暂停'}</strong>${technicalDetails([['支持证据', item.supporting_evidence_ids.join(', ') || '无'], ['独立来源记录', String(item.independent_source_count)], ['父主题', item.parent_topic_id], ['规则原因', item.reasons.join('；')]])}</div>`).join('') : '<p class="muted">尚无待积累的暂定主题或观察分支。</p>'}
      </section>
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">调度设置</p><h2>自动调研计划</h2></div><span class="guardrail-note">正式证据可按策略入表；多来源主题/分支自动激活，冲突与阶段跳跃自动暂停</span></div>
        <form id="scheduler-form" class="agent-form" onsubmit="event.preventDefault(); saveScheduler();">
          <label class="agent-field"><span>启用调度器</span><input type="checkbox" name="enabled" ${scheduler.enabled ? 'checked' : ''}></label>
          <label class="agent-field"><span>每日调研 cron</span><input name="daily_cron" value="${escape(scheduler.daily_cron)}" title="标准 5 段 cron（分 时 日 月 周）"></label>
          <label class="agent-field"><span>每日最大操作数</span><input type="number" name="daily_max_operations" value="${scheduler.daily_max_operations}" min="1"></label>
          <label class="agent-field"><span>快速循环（每 N 小时）</span><input type="number" name="quick_interval_hours" value="${scheduler.quick_interval_hours}" min="1"></label>
          <label class="agent-field"><span>启用快速循环</span><input type="checkbox" name="quick_enabled" ${scheduler.quick_enabled ? 'checked' : ''}></label>
          <label class="agent-field"><span>快速循环最大操作数</span><input type="number" name="quick_max_operations" value="${scheduler.quick_max_operations}" min="1"></label>
          <label class="agent-field"><span>过期候选阈值（天）</span><input type="number" name="stale_candidate_max_age_days" value="${scheduler.purge.stale_candidate_max_age_days}" min="1"></label>
          <label class="agent-field"><span>高优先级队列阈值（天）</span><input type="number" name="queue_high_priority_max_age_days" value="${scheduler.purge.queue_high_priority_max_age_days}" min="1"></label>
          <label class="agent-field"><span>中优先级队列阈值（天）</span><input type="number" name="queue_medium_priority_max_age_days" value="${scheduler.purge.queue_medium_priority_max_age_days}" min="1"></label>
          <label class="agent-field"><span>低优先级队列阈值（天）</span><input type="number" name="queue_low_priority_max_age_days" value="${scheduler.purge.queue_low_priority_max_age_days}" min="1"></label>
          <label class="agent-field"><span>进化历史保留条数</span><input type="number" name="evolution_history_max_entries" value="${scheduler.purge.evolution_history_max_entries}" min="3"></label>
          <button class="button secondary" type="submit">保存调度设置</button>
        </form>
        ${technicalDetails([['时区', scheduler.timezone], ['净化范围', '仅废弃 Agent 自产且未经正式使用的候选与队列项']])}
      </section>
    </div>`);
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;
}
function agentRunStatusLabel(status: string): string {
  return ({ completed: '已完成', partial: '部分完成', running: '运行中', failed: '失败' } as Record<string, string>)[status] ?? status;
}
function loopKindLabel(kind: string): string {
  return ({ daily: '每日循环', quick: '快速循环', manual: '手动运行' } as Record<string, string>)[kind] ?? kind;
}
function triggerLabel(trigger: string): string {
  return ({ scheduler: '调度触发', manual: '手动触发', cli: '命令行触发', webhook: '接口触发' } as Record<string, string>)[trigger] ?? trigger;
}
function phaseLabel(phase: string): string {
  return ({ research: '调研', analyze: '分析', import: '导入', produce: '产出', iterate: '迭代', evolve: '进化净化' } as Record<string, string>)[phase] ?? phase;
}
function proposalKindLabel2(kind: string): string {
  return ({
    scheduler_adjustment: '调度调整建议',
    prompt_adjustment: '提示词调整建议',
    review_priority_adjustment: '审核优先级调整建议',
    source_configuration: '数据源配置建议',
  } as Record<string, string>)[kind] ?? kind;
}
function graphPromotionReason(item: { decision: string; independent_source_count: number; reasons: string[]; node_kind: string }): string {
  if (item.decision === 'activated') return `已由 ${item.independent_source_count} 条独立来源记录支持；阶段仍由正式证据表计算。`;
  if (item.reasons.some((reason) => /conflicting|negative/i.test(reason))) return '存在冲突或负向正式证据，暂停自动激活。';
  if (item.reasons.some((reason) => /parent-scope/i.test(reason))) return '缺少父主题正式证据；分支材料不会升级父主题。';
  if (item.reasons.some((reason) => /requires .* independent/i.test(reason))) return `当前只有 ${item.independent_source_count} 条独立来源记录，尚未达到自动门槛。`;
  return '尚未满足自动激活的证据要求。';
}

export function renderSystemOverview(model: NarrativeMonitorModel): string {
  const system = model.system;
  return pageShell('system', '系统', `
    ${systemNav('system')}
    <section class="hero-row"><div><p class="eyebrow">系统管理</p><h1>系统</h1><p class="lede">集中查看运行、来源、学习治理和方法说明。这里不会直接改变主题阶段。</p></div><span class="state-pill ${stateClass(system.pipeline_state)}">${stateLabel(system.pipeline_state)}</span></section>
    <section class="system-hub">
      ${systemHubCard('/runs', '运行状态', '研究处理流程、模型服务、备用规则与运行历史', friendlyDate(system.last_successful_run))}
      ${systemHubCard('/sources', '数据源', '来源目录、同步、变化状态与研究闭环', model.source_sync ? `${model.source_sync.completed_operation_count}/${model.source_sync.requested_operation_count} 最近同步` : '尚未同步')}
      ${systemHubCard('/governance', '学习治理', '规则保护、主动学习、晋级门槛与改进提案', model.learning_profile_version ? '已有学习记录' : '尚未生成学习记录')}
      ${systemHubCard('/methodology', '方法论', '阶段门槛、数据可信度与对照量化规则', '可查看研究方法')}
    </section>`);
}

export function renderSources(model: NarrativeMonitorModel): string {
  const inventory = model.source_inventory;
  const sync = model.source_sync;
  const loop = model.source_loop;
  const operations = inventory?.operations ?? [];
  const liveReadyCount = operations.filter((item) =>
    item.access_state === 'production_ready'
    && item.governance.governance_state === 'research_ready'
    && item.governance.automated_polling_allowed
  ).length;
  const governanceReviewCount = operations.filter((item) => item.governance.governance_state === 'review_required').length;
  const contextOnlyCount = operations.filter((item) => item.evidence_eligibility === 'context_only').length;
  const dedicatedNormalizerCount = operations.filter((item) => item.normalizer_id !== 'generic_record').length;
  const grouped = [...new Set(operations.map((item) => item.service))].map((service) => {
    const rows = operations.filter((item) => item.service === service);
    return {
      service,
      total: rows.length,
      candidates: rows.filter((item) => item.evidence_eligibility === 'candidate').length,
      ready: rows.filter((item) => item.governance.governance_state === 'research_ready' && item.governance.automated_polling_allowed).length,
      review: rows.filter((item) => item.governance.governance_state === 'review_required').length,
      context: rows.filter((item) => item.evidence_eligibility === 'context_only').length,
      sandbox: rows.filter((item) => item.sandbox_fixture).length,
    };
  });
  return pageShell('sources', '数据源', `
    ${systemNav('sources')}
    <section class="hero-row"><div><p class="eyebrow">来源管理</p><h1>数据源</h1><p class="lede">查看哪些来源已经可用、哪些仍需审核，以及最近一次同步是否产生了新的研究材料。</p></div><span class="state-pill ${liveReadyCount ? 'ok' : 'muted-state'}">${inventory?.production_configured ? '外部数据服务已配置' : `${liveReadyCount} 个公开来源可用`}</span></section>
    <section class="system-strip">
      ${compactStatus('来源服务', String(inventory?.service_count ?? 0), inventory ? 'operational' : 'not_configured')}
      ${compactStatus('可用接口', String(inventory?.operation_count ?? 0), inventory ? 'operational' : 'not_configured')}
      ${compactStatus('可定期检查', String(inventory?.pollable_operation_count ?? 0), inventory ? 'operational' : 'not_configured')}
      ${compactStatus('可生成候选', String(inventory?.candidate_operation_count ?? 0), inventory ? 'review_required' : 'not_configured')}
      ${compactStatus('研究可用', String(liveReadyCount), liveReadyCount ? 'operational' : 'not_configured')}
      ${compactStatus('授权待审核', String(governanceReviewCount), governanceReviewCount ? 'review_required' : 'operational')}
      ${compactStatus('仅上下文', String(contextOnlyCount), contextOnlyCount ? 'fallback' : 'operational')}
      ${compactStatus('专用格式转换', String(dedicatedNormalizerCount), dedicatedNormalizerCount ? 'operational' : 'not_configured')}
      ${compactStatus('测试来源', String(inventory?.sandbox_operation_count ?? 0), inventory ? 'fallback' : 'not_configured')}
      ${compactStatus('最近同步', sync ? `${sync.mode === 'live' ? '真实来源' : '测试模式'} · ${sync.completed_operation_count}/${sync.requested_operation_count}` : '尚未运行', sync?.failed_operation_count ? 'failed' : sync ? 'operational' : 'not_configured')}
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">来源控制</p><h2>盘点与同步</h2></div></div>
        <p class="muted">测试来源只检查连接与格式，不会生成正式证据。真实来源先进入校验：只有来源、引用、主题边界和发布策略都通过的记录，才可写入正式证据表。</p>
        <div class="action-row"><button class="button secondary" type="button" onclick="sourceAction('inventory')">刷新来源目录</button><button class="button secondary" type="button" onclick="sourceAction('sandbox')">验证测试来源</button><button class="button primary" type="button" ${liveReadyCount ? '' : 'disabled'} onclick="sourceAction('live')">同步真实来源</button></div>
        <p id="source-action-status" class="small" role="status"></p>
      </section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">最近同步</p><h2>最近同步结果</h2></div><span class="state-pill ${sync?.failed_operation_count ? 'bad' : sync ? 'ok' : 'muted-state'}">${sync ? (sync.mode === 'live' ? '真实来源' : '测试模式') : '尚未运行'}</span></div>
        <dl class="fact-list"><dt>读取记录</dt><dd>${sync?.payload_record_count ?? 0}</dd><dt>新增事实</dt><dd>${sync?.new_fact_count ?? 0}</dd><dt>重要修订</dt><dd>${sync?.material_update_count ?? 0}</dd><dt>忽略轻微修订</dt><dd>${sync?.suppressed_update_count ?? 0}</dd><dt>无变化</dt><dd>${sync?.unchanged_fact_count ?? 0}</dd><dt>进入审核</dt><dd>${sync?.candidate_count ?? 0}</dd><dt>读取失败</dt><dd>${sync?.failed_operation_count ?? 0}</dd></dl>
        ${technicalDetails([['解析批次', sync?.intake_session_id]])}
        <p class="muted">进入审核只表示发现了值得核对的事实，不代表它已经成为正式证据或应改变主题阶段。</p>
        ${sync?.failed_operation_count ? `<p class="muted">${sync.failed_operation_count} 个来源同步失败。读取失败不会被视为事实消失，也不会触发证据删除或阶段降级。</p>` : ''}
        <p class="small">${sync?.candidate_count ? `下一步：审核 ${sync.candidate_count} 条变化候选。` : sync ? '本轮没有新的或修订的事实，不生成重复审核任务。' : '尚未建立来源变化状态。'}</p>
      </section>
    </div>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">研究闭环</p><h2>来源到研究结论</h2></div><span class="state-pill ${loop.status === 'weekly_complete' || loop.status === 'no_changes' ? 'ok' : loop.status === 'pipeline_failed' ? 'bad' : 'warn'}">${escape(sourceLoopLabel(loop.status))}</span></div>
      <dl class="fact-list"><dt>1. 发现变化</dt><dd>${loop.discovered_count} 条</dd><dt>2. 等待审核</dt><dd>${loop.pending_review_count} 条</dd><dt>3. 已导入证据</dt><dd>${loop.imported_count} 条</dd><dt>4. 本轮研究更新</dt><dd>${loop.weekly_run_id ? '已完成' : '尚未进入'}</dd><dt>5. 结果</dt><dd>${escape(sourceLoopLabel(loop.status))}</dd></dl>
      ${technicalDetails([['本轮研究更新编号', loop.weekly_run_id]])}
    </section>
    <section class="panel monitor-table"><div class="panel-heading"><div><p class="eyebrow">使用范围</p><h2>服务覆盖与使用状态</h2></div><span class="guardrail-note">目录存在 ≠ 可自动使用</span></div>
      ${grouped.length ? `<div class="table-scroll"><table><thead><tr><th>来源服务</th><th>接口数</th><th>可生成候选</th><th>研究可用</th><th>待审核</th><th>仅作背景</th><th>测试来源</th></tr></thead><tbody>${grouped.map((item) => `<tr><td><strong>${sourceServiceLabel(item.service)}</strong>${technicalDetails([['服务标识', item.service]])}</td><td>${item.total}</td><td>${item.candidates}</td><td>${item.ready}</td><td>${item.review}</td><td>${item.context}</td><td>${item.sandbox}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">尚未盘点来源目录。</p>'}
    </section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">使用边界</p><h2>数据使用边界</h2></div></div><dl class="fact-list"><dt>原始数据</dt><dd>同步期间临时处理，只保存校验摘要、必要引用和计数</dd><dt>授权与归属</dt><dd>公开访问不等于可再分发；候选保留来源链接</dd><dt>测试来源</dt><dd>只做格式与连通性验证，禁止导入</dd><dt>预测与回测</dt><dd>只作上下文，不作为独立证据或阶段依据</dd><dt>外部候选</dt><dd>普通外部线索从 E1 起；可追溯的官方、研究或申报来源只保留目录规定的证据上限，仍须经过所有校验</dd><dt>正式证据</dt><dd>必须经过引用校验、主题归属、去重、父子主题边界与导入校验</dd></dl><a class="button secondary" href="/intake">打开材料审核</a></section>
    <script>
      async function sourceAction(action) {
        const status = document.getElementById('source-action-status');
        status.textContent = '正在执行…';
        const endpoint = action === 'inventory' ? '/api/sources/inventory' : '/api/sources/sync';
        const body = action === 'inventory' ? {} : { mode: action, max_operations: 20, max_candidates: 30 };
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'request failed');
          status.textContent = action === 'live' && result.result?.session ? '已生成待审核候选，正在刷新。' : '执行完成，正在刷新。';
          location.reload();
        } catch (error) {
          status.textContent = '执行失败：' + error.message;
        }
      }
    </script>`);
}

export function renderTopicDetail(model: NarrativeMonitorModel, topicId: string): string {
  const topic = model.topics.find((item) => item.topic_id === topicId);
  if (!topic) return pageShell('topics', '主题未找到', emptyState('找不到该主题', '该主题可能尚未进入当前正式研究结果。', '/', '返回监控首页'));
  const change = topic.change;
  
  // Basic facts
  const basicFacts = `
    <div class="topic-summary">
      <div><span>数据可信度</span><strong class="confidence ${topic.data_confidence}">${confidenceLabel(topic.data_confidence)}</strong></div>
      <div><span>正式证据</span><strong>${topic.evidence_count}</strong></div>
      <div><span>细分分支</span><strong>${topic.branch_count}</strong></div>
      <div><span>本周变化</span><strong>${changeLabel(change?.change_type ?? 'no_change')}</strong></div>
    </div>
  `;

  // The 3-column UI
  const threeColumn = `
    <div class="three-column-grid">
      <!-- Column 1: Timeline -->
      <section class="panel" style="grid-column: 1;">
        <div class="panel-heading">
          <div><p class="eyebrow">演化时间线</p><h2>Evolution Timeline</h2></div>
        </div>
        <div class="timeline-container" id="evolution-timeline-root">
          <p class="muted">加载中...</p>
        </div>
      </section>

      <!-- Column 2: Radar & Gates -->
      <section class="panel" style="grid-column: 2;">
        <div class="panel-heading">
          <div><p class="eyebrow">量化引擎</p><h2>Quantitative Gates</h2></div>
        </div>
        <div class="radar-container" id="radar-chart-root">
           <!-- SVG drawn by JS -->
           <svg class="radar-svg" viewBox="0 0 100 100" style="background: var(--nav); border: 1px solid var(--line); border-radius: 3px;"></svg>
        </div>
        <div style="margin-top: 16px;">
          <p class="why">${friendlyReason(topic.why_not_higher_stage)}</p>
          <dl class="fact-list">
            <dt>门槛允许阶段</dt><dd>${stageDisplay(topic.gate_stage)}</dd>
            <dt>最弱维度</dt><dd>${layerLabel(topic.weakest_layer)}</dd>
            <dt>最强可展示分支</dt><dd>${topicStrongestBranch(topic)}</dd>
          </dl>
        </div>
      </section>

      <!-- Column 3: Evidence Feed & Branches -->
      <div style="grid-column: 3; display: grid; gap: 20px; align-content: start;">
        <section class="panel">
          <div class="panel-heading"><div><p class="eyebrow">分支地图</p><h2>Branch Mutation</h2></div><span class="guardrail-note">隔离验证</span></div>
          ${branchMap(topic)}
        </section>
        
        <section class="panel">
          <div class="panel-heading">
            <div><p class="eyebrow">证据流</p><h2>Evidence Feed</h2></div>
            <a class="text-link" href="/intake">录入新材料</a>
          </div>
          <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
            ${evidenceList(topic)}
          </div>
        </section>
      </div>
    </div>
    <script>
      // Timeline & Radar Fetching Logic
      async function initTopicDeepDive() {
        const topicId = "${escape(topic.topic_id)}";
        
        // 1. Fetch Timeline
        try {
          const res = await fetch('/api/evolution-timeline');
          if (res.ok) {
            const data = await res.json();
            const topicHistory = data.find(t => t.topic_id === topicId);
            const root = document.getElementById('evolution-timeline-root');
            if (topicHistory && topicHistory.transitions && topicHistory.transitions.length > 0) {
              root.innerHTML = topicHistory.transitions.map(evt => {
                const isJump = true; // Every transition is a stage jump in this dataset
                const gate = evt.gate_unlocked || '';
                const gatesHtml = gate ? '<div class="timeline-gates"><span class="timeline-gate unlocked">' + gate + '</span></div>' : '';
                return '<div class="timeline-event ' + (isJump ? 'milestone' : '') + '">' +
                  '<span class="timeline-date">' + evt.transition_date.split('T')[0] + '</span>' +
                  '<div class="timeline-content">' +
                    '<span class="timeline-stage">' + evt.from_stage + ' → ' + evt.to_stage + '</span>' +
                    '<h3 class="timeline-title">' + (evt.trigger_evidence_title || 'Unknown Event') + '</h3>' +
                    '<p class="small" style="margin:0;color:var(--muted)">' + (evt.trigger_evidence_url || 'Unknown Source') + '</p>' +
                    gatesHtml +
                  '</div>' +
                '</div>';
              }).join('');
            } else {
              root.innerHTML = '<p class="muted">尚无演化历史数据。</p>';
            }
          }
        } catch (e) {
          console.error('Failed to load timeline', e);
        }

        // 2. Fetch Radar (gate_input)
        try {
          const res = await fetch('/api/monitor');
          if (res.ok) {
            const data = await res.json();
            const topics = data.snapshot?.topics || [];
            const t = topics.find(t => t.topic_id === topicId);
            const gate = t?.gate_input;
            
            const svg = document.querySelector('.radar-svg');
            if (gate && svg) {
              // Draw simple square radar for the 4 quantitative gates
              // stable_label, capital, pricing, reality
              const center = 50;
              const radius = 40;
              
              // Draw axes
              let axes = '';
              const labels = ['Stable Label', 'Capital', 'Pricing', 'Hard Reality'];
              const angles = [0, 90, 180, 270].map(a => (a - 90) * Math.PI / 180);
              
              angles.forEach((ang, i) => {
                const x = center + radius * Math.cos(ang);
                const y = center + radius * Math.sin(ang);
                axes += '<line x1="50" y1="50" x2="' + x + '" y2="' + y + '" class="radar-axis" />';
                
                // label
                const lx = center + (radius + 8) * Math.cos(ang);
                const ly = center + (radius + 8) * Math.sin(ang);
                axes += '<text x="' + lx + '" y="' + (ly + 3) + '" class="radar-label">' + labels[i] + '</text>';
              });
              
              // Calculate points based on gate_input booleans
              const vals = [
                gate.hasStableLabel ? 1 : 0.1,
                gate.hasCapitalConfirmation ? 1 : 0.1,
                gate.hasPricingAdoption ? 1 : 0.1,
                gate.hasHardRealityEvidence ? 1 : 0.1
              ];
              
              let pts = '';
              let dots = '';
              vals.forEach((v, i) => {
                const x = center + radius * v * Math.cos(angles[i]);
                const y = center + radius * v * Math.sin(angles[i]);
                pts += x + ',' + y + ' ';
                dots += '<circle cx="' + x + '" cy="' + y + '" r="3" class="radar-point" />';
              });
              
              svg.innerHTML = axes + '<polygon points="' + pts.trim() + '" class="radar-polygon" />' + dots;
            }
          }
        } catch (e) {
          console.error('Failed to load radar', e);
        }
      }
      initTopicDeepDive();
    </script>
  `;

  return pageShell('topics', displayNameText(topic.topic_name), `
    <a class="back-link" href="/topics">← 返回主题列表</a>
    <section class="topic-head"><div><p class="eyebrow">整体主题</p><h1>${displayName(topic.topic_name)}</h1><p class="lede">${displayName(topic.parent_narrative)}</p>${topic.baseline_status === 'baseline_required' ? '<p class="guardrail-note">尚未完成阶段基准核验：当前 S0 仅表示父主题缺少正式证据表，不代表该主题处于市场早期。</p>' : ''}</div><div class="stage-block"><span class="stage ${stageClass(topic.current_stage)}">${stageDisplay(topic.current_stage, topic.baseline_status === 'baseline_required')}</span><small>整体主题当前阶段</small></div></section>
    ${basicFacts}
    ${threeColumn}
  `);
}

export function renderQueue(model: NarrativeMonitorModel): string {
  return pageShell('queue', '研究待处理队列', `
    ${researchQueueNav('queue')}
    <section class="hero-row"><div><p class="eyebrow">研究者待办</p><h1>研究待处理队列</h1><p class="lede">展示系统提出的待确认事项与早期线索。正式主题、证据链和阶段变化仍需研究者确认。</p></div><a class="button primary" href="/intake">录入新材料</a></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">优先处理</p><h2>按风险排序</h2></div><span class="count">${model.review_queue.length}</span></div>
      ${model.review_queue.length ? model.review_queue.map((item) => `<a class="review-row" href="${item.href}"><span class="state-pill ${item.priority === 'high' ? 'bad' : item.priority === 'medium' ? 'warn' : 'muted-state'}">${priorityLabel(item.priority)}</span><div><strong>${escape(queueCategoryLabel(item.category))} · ${displayName(item.title)}</strong><p>${friendlyReason(item.reason)}</p></div><span>→</span></a>`).join('') : '<p class="muted">当前没有待审核事项。</p>'}
    </section>
    <section class="panel" style="margin-top:18px"><div class="panel-heading"><div><p class="eyebrow">Agent 提案</p><h2>主题与证据链建议</h2><p class="small">确认这里只确认研究关系，不会自动激活主题、导入证据或改变阶段。</p></div><span class="count">${model.topic_discovery_proposals.filter((item) => item.status === 'pending').length + model.evidence_chain.filter((item) => item.status === 'candidate').length}</span></div>
      ${model.topic_discovery_proposals.filter((item) => item.status === 'pending').map((item) => `<div class="list-row"><strong>主题发现：${displayName(item.proposed_topic_name ?? item.proposed_topic_id ?? '未解析主题')}</strong><p>${friendlyReason(item.reason)} ${item.narrative_memory_match ? '已命中叙事记忆。' : ''}</p><span class="chip">${item.kind} · ${item.confidence}</span><div class="action-row"><button class="button secondary" type="button" onclick="reviewIntelligence('proposal','${escape(item.proposal_id)}','accepted')">确认提案</button><button class="button" type="button" onclick="reviewIntelligence('proposal','${escape(item.proposal_id)}','deferred')">暂缓</button><button class="button" type="button" onclick="reviewIntelligence('proposal','${escape(item.proposal_id)}','rejected')">拒绝</button></div></div>`).join('') || '<p class="muted">当前没有待确认的主题发现提案。</p>'}
      ${model.evidence_chain.filter((item) => item.status === 'candidate').map((item) => `<div class="list-row"><strong>证据链：${displayName(item.topic_id)}${item.branch_id ? ` / ${displayName(item.branch_id)}` : ''}</strong><p>建议关系：${chainRelationLabelForView(item.relation)}；引用：${escape(item.source_quote)}</p><span class="chip">${item.scope === 'branch' ? '仅分支' : '整体主题'} · 待确认</span><div class="action-row"><button class="button secondary" type="button" onclick="reviewIntelligence('chain','${escape(item.chain_entry_id)}','accepted')">确认关系</button><button class="button" type="button" onclick="reviewIntelligence('chain','${escape(item.chain_entry_id)}','deferred')">暂缓</button><button class="button" type="button" onclick="reviewIntelligence('chain','${escape(item.chain_entry_id)}','rejected')">拒绝</button></div></div>`).join('') || '<p class="muted">当前没有待确认的证据链更新。</p>'}
    </section>
    <section id="early-radar" class="panel" style="margin-top:18px"><div class="panel-heading"><div><p class="eyebrow">早期线索</p><h2>需要进一步验证</h2></div><span class="count">${model.early_radar.length}</span></div>${model.early_radar.length ? model.early_radar.map((item) => `<div class="list-row"><strong>${displayName(item.candidate_topic)}</strong><p>${friendlyReason(item.reason)}</p><span class="chip">${friendlyReason(item.research_only_action)}</span></div>`).join('') : '<p class="muted">当前没有新的早期线索。</p>'}</section>
    <script>
      async function reviewIntelligence(kind, id, decision) {
        const body = kind === 'proposal' ? { proposal_id: id } : { chain_entry_id: id };
        body.decision = decision; body.reviewer = window.prompt('审核人姓名') || '';
        if (!body.reviewer) return;
        const response = await fetch('/api/intelligence-review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!response.ok) { const error = await response.json().catch(() => ({})); window.alert(error.error || '审核失败'); return; }
        location.reload();
      }
    </script>`);
}

export function renderMethodology(): string {
  return pageShell('methodology', '量化方法论', `
    ${systemNav('methodology')}
    <section class="hero-row"><div><p class="eyebrow">量化核心</p><h1>量化方法论</h1><p class="lede">每个结论都必须从可引用证据出发，先经过阶段硬门槛，再进入辅助评分与历史比较。</p></div><div class="run-meta"><span>当前状态</span><strong>对照校准中</strong>${technicalDetails([['量化规则版本', QUANTITATIVE_RULE_VERSION]])}</div></section>
    <section class="method-flow" aria-label="计算顺序">
      <div class="method-step"><span>01</span><strong>证据质量</strong><small>判断单条证据是否可靠</small></div>
      <div class="method-step"><span>02</span><strong>维度支持</strong><small>聚合不同独立来源</small></div>
      <div class="method-step"><span>03</span><strong>阶段门槛</strong><small>硬门槛与可信度上限</small></div>
      <div class="method-step"><span>04</span><strong>成熟度与变化</strong><small>辅助判断与历史比较</small></div>
    </section>
    <div class="warning-band"><strong>先判断阶段，再计算分数。</strong><span>没有证据表，就不允许评分。当前公式只用于对照校准，不改变正式研究结果；总分不能覆盖硬门槛。</span></div>
    <div class="method-grid">
      ${formulaPanel('1. 单条证据质量', 'q_e = 100 · w(E) · a(source) · c · 2^(-age / h)', 'E0-E4 强度、来源权威、字段置信度和时间半衰期共同决定证据质量。默认 h=180 天。E0 的贡献恒为 0。')}
      ${formulaPanel('2. 维度支持度', 'Q_l = 100 · [1 - Π_s(1 - max(q_e,s)/100)]', '同一来源只保留该维度的最强证据，防止转载和重复记录刷分；不同独立来源使用合并概率方式聚合。正负证据分别计算。')}
      ${formulaPanel('3. 数据可信度', 'C = .25B + .25A + .20R + .15X + .15L', 'B=来源广度，A=来源权威，R=时效性，X=正反证据覆盖，L=六层覆盖。缺失不是负面证据，只降低 C 并触发阶段上限。')}
      ${formulaPanel('4. 最终阶段', 'S_final = min(S_requested, S_gate, S_confidence)', '阶段门槛依次要求稳定标签、资本确认、预期采纳和硬现实证据。整体主题与细分分支分别计算，分支的高阶段不能进入整体主题公式。')}
      ${formulaPanel('5. 阶段转换成熟度', 'R_t = 100 · G · (C/100) · (1 - F/100)', 'G=门槛完成度，F=摩擦支持度。当前是尚未完成经验校准的参考指数，不能解释为概率；需要历史回放结果才能校准。')}
      ${formulaPanel('6. 叙事变化幅度', 'ΔN = .20Q + .25GΔ + .20M + .15Bμ + .10E + .10C', 'Q=新证据质量，GΔ=门槛影响，M=旧缺口填补，Bμ=分支演变，E=预期重置。必须先查询叙事记忆；记忆不足时不输出数值。')}
      ${formulaPanel('7. 智能解析优化分', 'O = .80Quality + .20Efficiency - hard blockers', '质量由引用准确率、字段准确率、主题归属准确率、事实召回率和无依据判断率构成。样本少于 50、整体主题与分支错误超过 1%，或 E3/E4 夸大超过 2%时禁止晋级。')}
      ${formulaPanel('8. 成本与熔断', 'Cost = Tin·Pin/10⁶ + Tout·Pout/10⁶', '单次成本超预算、连续失败≥3、滚动错误率>20%、流量达到基线5倍或重试耗尽时立即熔断并回退规则候选。价格通过配置输入，不在代码中猜测。')}
    </div>
    <section class="panel method-notes"><div class="panel-heading"><div><p class="eyebrow">科学性状态</p><h2>哪些是正式测量，哪些仍需校准</h2></div></div>
      <dl class="fact-list"><dt>正式规则</dt><dd>证据表、阶段门槛、数据可信度上限、整体主题与分支隔离</dd><dt>对照指标</dt><dd>证据质量、维度支持度、阶段转换成熟度、叙事变化幅度、智能解析优化分</dd><dt>晋级条件</dt><dd>历史回放校准、留出集验证、规则版本评审、黄金案例全部通过</dd><dt>禁止推断</dt><dd>不得从价格上涨反推叙事正确，也不得用模型分数覆盖证据表与阶段门槛</dd></dl>
    </section>`);
}

export function renderGovernance(model: NarrativeMonitorModel): string {
  const guardrails = model.guardrails;
  const cycle = model.learning_cycle;
  return pageShell('governance', '学习与治理', `
    ${systemNav('governance')}
    <section class="hero-row"><div><p class="eyebrow">学习与治理</p><h1>学习与治理</h1><p class="lede">系统持续采样反馈，优先处理高信息量案例，并生成可追溯的改进建议；规则、主题与分支登记表不会未经批准自动更新。</p></div><a class="button secondary" href="/intake">打开材料审核</a></section>
    <section class="method-flow" aria-label="主动学习闭环">
      <div class="method-step"><span>01</span><strong>记录反馈</strong><small>记录决策结果</small></div>
      <div class="method-step"><span>02</span><strong>确定优先级</strong><small>选择高信息量案例</small></div>
      <div class="method-step"><span>03</span><strong>对照验证</strong><small>与冻结基线对照</small></div>
      <div class="method-step"><span>04</span><strong>人工批准</strong><small>审核后版本化与回滚</small></div>
    </section>
    <div class="governance-grid">
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">学习周期</p><h2>持续学习状态</h2></div><span class="chip ${cycle?.promotion_status === 'blocked' ? 'high' : 'medium'}">${promotionStatusLabel(cycle?.promotion_status)}</span></div><dl class="fact-list"><dt>当前学习配置</dt><dd>${model.learning_profile_version ? '已生成' : '尚未生成'}</dd><dt>已审核候选</dt><dd>${cycle?.observed_candidate_count ?? 0}</dd><dt>改进提案</dt><dd>${cycle?.proposals.length ?? 0}</dd><dt>高优先级案例</dt><dd>${cycle?.active_learning_queue.filter((item) => item.priority_band === 'high').length ?? 0}</dd><dt>回滚版本</dt><dd>${cycle?.rollback_profile_id ? '已有可回滚版本' : '尚无历史版本'}</dd></dl>${technicalDetails([['学习配置版本', model.learning_profile_version], ['回滚版本', cycle?.rollback_profile_id]])}</section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">系统保护规则</p><h2>正式生效的保护规则</h2></div></div>${guardrailList(guardrails)}</section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">升级门槛</p><h2>智能解析升级门槛</h2></div></div>${cycle ? cycle.promotion_gates.map((gate) => `<div class="guardrail-row"><span>${metricLabel(gate.metric)}<small>${gateValueLabel(gate.actual)} · ${gateValueLabel(gate.threshold)}</small></span><strong class="${gate.passed ? 'pass' : 'fail'}">${gate.passed ? '通过' : '阻断'}</strong>${technicalDetails([['原始指标', gate.metric], ['实际值', String(gate.actual)], ['门槛值', String(gate.threshold)]])}</div>`).join('') : '<p class="muted">完成一次学习周期后生成升级门槛。</p>'}</section>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">改进建议</p><h2>候选改进提案</h2></div></div>${cycle?.proposals.length ? cycle.proposals.slice(0, 8).map((proposal) => `<div class="list-row"><strong>${proposalKindLabel(proposal.kind)} · ${displayName(proposal.target)}</strong><p>${friendlyReason(proposal.rationale)}</p><span class="chip ${proposal.status === 'blocked' ? 'high' : proposal.status === 'shadow_ready' ? 'medium' : ''}">${proposalStatusLabel(proposal.status)} · ${proposal.observation_count} 个样本</span>${technicalDetails([['提案类型', proposal.kind], ['原始状态', proposal.status]])}</div>`).join('') : '<p class="muted">尚无重复修正模式。系统不会从单个案例贸然修改行为。</p>'}</section>
      <section class="panel wide-panel"><div class="panel-heading"><div><p class="eyebrow">长期无变化监测</p><h2>持续无变化主题</h2></div></div>${model.no_change_topics.length ? model.no_change_topics.map((item) => `<div class="list-row"><strong>${displayName(item.topic_name)} · ${stageDisplay(item.current_stage)}</strong><p>连续 ${item.consecutive_run_count} 次研究更新无变化。长期无变化是合法状态，系统不强迫生成行动。</p></div>`).join('') : '<p class="muted">暂无长期无变化主题。</p>'}</section>
    </div>`);
}

type PageKey = 'overview' | 'changes' | 'topics' | 'inbox' | 'queue' | 'agent' | 'system' | 'runs' | 'sources' | 'methodology' | 'governance';

function pageShell(active: PageKey, title: string, body: string): string {
  const activeGroup = active === 'inbox' ? 'queue'
    : active === 'agent' ? 'agent'
    : ['system', 'runs', 'sources', 'methodology', 'governance'].includes(active) ? 'system'
      : active;
  const nav = (key: string, label: string, href: string) => {
    const current = activeGroup === key;
    return `<a class="nav-link ${current ? 'active' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  };
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · 叙事生命周期研究系统</title><style>${styles()}</style></head><body>
  <header class="topbar"><a class="brand" href="/"><span class="brand-mark">N</span><span>叙事生命周期</span></a><nav aria-label="主导航">${nav('overview','总览','/')}${nav('changes','变化','/changes')}${nav('topics','主题','/topics')}${nav('queue','研究队列','/queue')}${nav('agent','Agent 状态','/agent')}${nav('system','系统','/system')}</nav><a class="nav-action" href="/intake">＋ 录入材料</a><span class="trust">研究者确认模式</span></header>
  <main class="app">${body}</main></body></html>`;
}

function researchQueueNav(active: 'queue' | 'inbox'): string {
  return `<nav class="section-nav" aria-label="研究队列导航">
    <a class="${active === 'queue' ? 'active' : ''}" href="/queue">待处理</a>
    <a class="${active === 'inbox' ? 'active' : ''}" href="/inbox">候选证据</a>
    <a href="/queue#early-radar">早期线索</a>
  </nav>`;
}

function systemNav(active: 'system' | 'runs' | 'sources' | 'governance' | 'methodology'): string {
  const item = (key: typeof active, label: string, href: string) =>
    `<a class="${active === key ? 'active' : ''}" href="${href}">${label}</a>`;
  return `<nav class="section-nav" aria-label="系统导航">
    ${item('system', '系统概览', '/system')}
    ${item('runs', '运行状态', '/runs')}
    ${item('sources', '数据源', '/sources')}
    ${item('governance', '学习治理', '/governance')}
    ${item('methodology', '方法论', '/methodology')}
  </nav>`;
}

function systemHubCard(href: string, title: string, description: string, status: string): string {
  return `<a class="system-hub-card" href="${href}"><span>打开</span><h2>${escape(title)}</h2><p>${escape(description)}</p><strong>${escape(status)}</strong></a>`;
}

function formulaPanel(title: string, formula: string, explanation: string): string {
  return `<section class="panel formula-panel"><h2>${escape(title)}</h2><code class="formula">${escape(formula)}</code><p>${escape(explanation)}</p></section>`;
}

function metricGrid(model: NarrativeMonitorModel): string {
  const changed = model.changes.filter((item) => item.change_type !== 'no_change').length;
  const imported = model.research_agent?.last_run?.metrics?.imported_evidence_count ?? model.metrics.evidence_added_count;
  const values = [['新增原始资料', model.inbox.length ? 1 : 0], ['新增候选', model.inbox.length], ['研究队列', model.review_queue.length], ['已导入证据', imported], ['主题变化', changed], ['系统提醒', model.alerts.length]];
  return `<section class="metric-grid">${values.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('')}</section>`;
}

function systemStatusBar(model: NarrativeMonitorModel): string {
  const system = model.system;
  return `<section class="system-strip">
    ${compactStatus('最近成功更新', friendlyDate(system.last_successful_run), system.pipeline_state)}
    ${compactStatus('下次计划更新', friendlyDate(system.next_scheduled_run), 'not_configured')}
    ${compactStatus('智能解析服务', system.provider_state === 'not_configured' ? '尚未配置' : stateLabel(system.provider_state), system.provider_state)}
    ${compactStatus('备用解析规则', system.fallback_state === 'active' ? '已启用' : system.fallback_state === 'inactive' ? '未启用' : '未知', system.fallback_state === 'active' ? 'fallback' : 'operational')}
    ${compactStatus('数据新鲜度', freshnessLabel(system.data_freshness), system.data_freshness === 'fresh' ? 'operational' : system.data_freshness)}
    ${compactStatus('自动采集', system.automatic_ingestion === 'configured' ? '已启用' : '尚未配置', system.automatic_ingestion === 'configured' ? 'operational' : 'not_configured')}
  </section>`;
}

function compactStatus(label: string, value: string, state: string): string {
  return `<div class="compact-status"><span>${escape(label)}</span><strong>${escape(value)}</strong><i class="${stateClass(state)}"></i></div>`;
}

function artifactHealth(model: NarrativeMonitorModel): string {
  if (!model.artifacts.length) return '<p class="muted">尚无研究结果状态。</p>';
  return model.artifacts.map((artifact) => `<div class="artifact-row"><span>${artifactLabel(artifact.artifact_type)}</span><strong>${friendlyDate(artifact.generated_at)}</strong><span class="state-pill ${artifact.freshness === 'fresh' ? 'ok' : artifact.freshness === 'stale' ? 'warn' : 'muted-state'}">${freshnessLabel(artifact.freshness)}</span>${technicalDetails([['结果类型', artifact.artifact_type], ['运行批次', artifact.run_id]])}</div>`).join('');
}

function statusCard(title: string, value: string, state: string, detail: string): string {
  return `<section class="panel status-card"><div><p class="eyebrow">${escape(title)}</p><h2>${escape(value)}</h2></div><span class="state-pill ${stateClass(state)}">${stateLabel(state)}</span><p>${escape(detail)}</p></section>`;
}

function topicTable(topics: NarrativeMonitorTopic[]): string {
  return `<div class="table-scroll"><table><thead><tr><th>主题</th><th>阶段</th><th>变化</th><th>数据可信度</th><th>细分方向</th><th>为什么还不能更高</th></tr></thead><tbody>${topics.map((topic) => `<tr><td><a class="topic-link" href="/topics/${encodeURIComponent(topic.topic_id)}">${displayName(topic.topic_name)}</a><small>${topic.evidence_count} 条证据${topic.baseline_status === 'baseline_required' ? ' · 待基准核验' : ''}</small></td><td><span class="stage ${stageClass(topic.current_stage)}">${stageDisplay(topic.current_stage, topic.baseline_status === 'baseline_required')}</span></td><td><span class="change ${changeClass(topic.change?.change_type)}">${changeLabel(topic.change?.change_type ?? 'no_change')}</span><small>${friendlyReason(topic.change?.change_reason ?? '尚无比较变化')}</small></td><td><span class="confidence ${topic.data_confidence}">${confidenceLabel(topic.data_confidence)}</span></td><td>${topicBranchSummary(topic)}</td><td class="why-cell">${friendlyReason(topic.why_not_higher_stage)}</td></tr>`).join('')}</tbody></table></div>`;
}

function strategicChanges(model: NarrativeMonitorModel, limit = Number.POSITIVE_INFINITY): string {
  const changed = model.topics.filter((topic) => topic.change && topic.change.change_type !== 'no_change');
  if (!changed.length) return `<p class="muted">本次更新没有新的阶段或证据变化。“无变化”是合法研究结果，系统不会强行制造信号。</p>`;
  return changed.slice(0, limit).map((topic) => `<div class="list-row"><a class="topic-link" href="/topics/${encodeURIComponent(topic.topic_id)}">${displayName(topic.topic_name)}</a><p>${friendlyReason(topic.change?.change_reason ?? '')}</p><span class="chip ${priorityClass(topic.change?.priority)}">${changeLabel(topic.change?.change_type ?? 'no_change')}</span></div>`).join('');
}

function queuePreview(model: NarrativeMonitorModel): string {
  const rows = [
    [`研究队列`, String(model.review_queue.length), '/queue'],
    [`主题或分支待确认`, String(model.unresolved_count), '/intake'],
    [`早期线索`, String(model.early_radar.length), '/queue'],
  ];
  return rows.map(([label, value, href]) => `<a class="queue-row" href="${href}"><span>${label}</span><strong>${value}</strong><span>→</span></a>`).join('');
}
function branchMap(topic: NarrativeMonitorTopic): string {
  if (!topic.branches.length) return '<p class="muted">当前没有独立分支。</p>';
  const visible = topic.branches.filter((branch) => isUsableBranchName(branch.branch_name));
  const pendingNameCount = topic.branches.length - visible.length;
  return `<div class="branch-tree"><div class="parent-node"><span class="node-label">整体主题</span><strong>${displayName(topic.parent_narrative)}</strong><span class="stage ${stageClass(topic.current_stage)}">${stageDisplay(topic.current_stage)}</span></div>${visible.map((branch) => `<div class="branch-node"><span class="node-label">细分分支</span><strong>${displayName(branch.branch_name)}</strong><span class="stage ${stageClass(branch.current_stage)}">${stageDisplay(branch.current_stage)}</span><small>${branch.evidence_ids.length} 条证据${branch.reactivation_record_id ? ' · 已记录旧主题重新活跃' : ''}</small>${technicalDetails([['重新活跃记录', branch.reactivation_record_id]])}</div>`).join('')}${pendingNameCount ? `<p class="guardrail-note">另有 ${pendingNameCount} 条待命名记录保留在审计中；在取得来源支持的市场名称前，不作为细分分支展示。</p>` : ''}${!visible.length ? '<p class="muted">尚无来源支持的可展示细分分支。</p>' : ''}</div>`;
}

function topicBranchSummary(topic: NarrativeMonitorTopic): string {
  const visible = topic.branches.filter((branch) => isUsableBranchName(branch.branch_name));
  const hiddenCount = topic.branches.length - visible.length;
  const strongest = isUsableBranchSummary(topic.strongest_branch)
    ? branchSummaryDisplay(topic.strongest_branch)
    : visible[0] ? displayName(visible[0].branch_name) : '尚无可展示分支';
  return `<strong>${visible.length}</strong> 个可展示分支<small>${strongest}</small>${hiddenCount ? `<small>${hiddenCount} 条待命名记录</small>` : ''}`;
}

function topicStrongestBranch(topic: NarrativeMonitorTopic): string {
  if (isUsableBranchSummary(topic.strongest_branch)) return branchSummaryDisplay(topic.strongest_branch);
  const visible = topic.branches.find((branch) => isUsableBranchName(branch.branch_name));
  return visible ? displayName(visible.branch_name) : '尚无来源支持的可展示分支';
}

function isUsableBranchSummary(value: string): boolean {
  return isUsableBranchName(value.replace(/\s*\(S[0-7][A-C]?(?:-S[0-7][A-C]?)?\)\s*$/i, ''));
}

function branchSummaryDisplay(value: string): string {
  const match = /^(.*?)(\s*\(S[0-7][A-C]?(?:-S[0-7][A-C]?)?\))$/i.exec(value.trim());
  return match ? `${displayName(match[1].trim())}${escape(match[2])}` : displayName(value);
}

function evidenceList(topic: NarrativeMonitorTopic): string {
  if (!topic.evidence.length) return `<p class="muted">当前研究结果中没有可展示的关键证据摘要。</p>`;
  return `<div class="evidence-list">${topic.evidence.map((item) => `<div class="evidence-row"><span class="evidence-strength">${evidenceStrengthLabel(item.evidence_strength)}</span><div><p>${escape(item.interpretation)}</p><small>${item.affected_layer.map(layerLabel).join(' · ')}</small>${technicalDetails([['证据编号', item.evidence_id]])}</div></div>`).join('')}</div>`;
}

function alertList(model: NarrativeMonitorModel): string {
  if (!model.alerts.length) return '<p class="muted">当前没有新的高优先级规则保护提醒。</p>';
  return model.alerts.map((alert) => `<div class="list-row alert"><strong>${queueCategoryLabel(alert.category)}</strong><p>${friendlyReason(alert.message)}</p><span class="chip high">${friendlyReason(alert.research_only_action)}</span></div>`).join('');
}

function guardrailList(guardrails: NarrativeMonitorModel['guardrails']): string {
  if (!guardrails) return '<p class="muted">尚未生成本轮规则保护结果。</p>';
  return Object.entries(guardrails).map(([label, value]) => `<div class="guardrail-row"><span>${guardrailLabel(label)}</span><strong class="${value ? 'pass' : 'fail'}">${value ? '通过' : '需要复核'}</strong>${technicalDetails([['规则标识', label]])}</div>`).join('');
}

function emptyState(title: string, copy: string, href: string, action: string): string { return `<section class="empty"><p class="eyebrow">系统状态</p><h1>${escape(title)}</h1><p>${escape(copy)}</p><a class="button primary" href="${href}">${escape(action)}</a></section>`; }
function stageClass(stage: string): string { return stage.includes('S7') ? 'late' : stage.includes('S5') || stage.includes('S6') ? 'mid' : 'early'; }
function stageDisplay(stage: string, baselineRequired = false): string {
  if (stage === 'S0' && baselineRequired) return 'S0 · 待完成阶段基准核验';
  const label = ({
    S0: '尚未形成',
    S1: '零散线索',
    S2: '稳定命名',
    S3: '资源关注',
    S4: '形成预期',
    S5: '现实验证',
    S6: '规模兑现',
    S7A: '成熟延续',
    S7B: '走向衰退',
    S7C: '分支演变',
  } as Record<string, string>)[stage];
  return label ? `${escape(stage)} · ${label}` : escape(stage);
}
function evidenceStrengthLabel(value: string): string {
  const label = ({ E0: '线索', E1: '单一可信来源', E2: '多方印证', E3: '官方行动或真实落地', E4: '可验证的持续结果' } as Record<string, string>)[value];
  return label ? `${escape(value)} · ${label}` : escape(value);
}
function displayNameText(value: string): string {
  return ({
    'BCI': '脑机接口',
    bci: '脑机接口',
    '脑机接口 BCI': '脑机接口',
    'bci medical rehab (S5-S6)': '脑机接口医疗康复分支',
    'medical rehab (S5-S6)': '医疗康复分支',
    'robot actuator (S5-S6)': '机器人执行器分支',
    '创新药 License-out': '创新药对外授权',
    'adc license out (S5-S6)': 'ADC 对外授权分支',
    'unknown_topic': '主题待确认',
    'early research': '早期研究线索',
    'guardrail_regression': '规则保护回归',
    'failed_run': '运行失败',
    humanoid_actuator: '人形机器人执行器',
    quantum_materials: '量子材料',
    a_share_price_action: 'A 股价格表现',
    smb_desktop_3d_printing: '桌面级 3D 打印',
    innovative_drug_license_out_gp2013: '创新药对外授权 · GP2013',
    'no independent branch': '暂无独立分支',
  } as Record<string, string>)[value] ?? value;
}
function displayName(value: string): string { return escape(displayNameText(value)); }
function layerLabel(value: string): string {
  return escape(({
    name: '认知与命名',
    capital: '资金与资源',
    pricing: '市场预期',
    pricing_adoption: '市场预期采纳',
    reality: '现实进展',
    reality_validation: '现实验证',
    policy_perception: '政策与认知',
    momentum: '发展动能',
    friction: '阻力与风险',
    data_confidence: '信息完整度',
  } as Record<string, string>)[value] ?? value);
}
function priorityLabel(value: string): string { return ({ high: '高', medium: '中', low: '低' } as Record<string, string>)[value] ?? '未标注'; }
function reviewStatusLabel(value: string): string { return ({ pending_review: '等待校验', reviewed: '已完成校验' } as Record<string, string>)[value] ?? '校验状态待确认'; }
function friendlyTopic(value: string): string {
  const provisionalNames: Record<string, string> = {
    provisional_ai_agents: 'AI 智能体（待核验）',
    provisional_advanced_packaging: '先进封装（待核验）',
    provisional_computing_infrastructure: '算力基础设施（待核验）',
    provisional_innovative_drug_clinical_development: '创新药临床开发（待核验）',
    provisional_bci_psychiatric_depression: '脑机接口精神医学分支（待核验）',
  };
  if (value === 'unknown_topic') return '主题待确认';
  if (provisionalNames[value]) return provisionalNames[value]!;
  if (value.startsWith('provisional_')) return '待核验主题或分支';
  return displayName(value);
}
function friendlyWebResearchError(value: string): string {
  if (value === 'web_search_provider_not_configured') return '外部检索服务尚未配置。';
  if (/timeout/i.test(value)) return '外部检索服务超时，未产生线索。';
  if (/http_[45]\d\d/i.test(value)) return '外部检索服务暂不可用，未产生线索。';
  return '外部检索服务未返回可用结果。';
}
function scopeLabel(value: string): string { return value === 'parent' ? '整体主题' : value === 'branch' ? '仅此细分分支' : '影响范围待确认'; }
function resolutionLabel(value: string): string {
  return escape(({
    existing_topic: '已匹配现有主题',
    alias_of: '已识别主题别名',
    new_branch: '建议建立新分支',
    reactivation: '旧主题重新活跃',
    new_provisional_topic: '待确认的新主题',
    unresolved: '暂时无法判断',
    not_checked: '尚未检查',
  } as Record<string, string>)[value] ?? '主题归属待确认');
}
function agentStatusLabel(value: string): string {
  return escape(({ passed: '已通过检查', failed: '检查未通过', fallback: '使用备用解析规则', not_run: '尚未运行' } as Record<string, string>)[value] ?? '解析状态待确认');
}
function friendlyReason(value: string): string {
  const exact = ({
    'Topic/branch evidence is too ambiguous; operator must resolve before import.': '主题或分支归属仍不明确，已按建议归属处理。',
    'Topic Resolver has not produced a matching audit for this session.': '尚未完成本批材料的主题归属检查。',
    'no_trading_advice requires operator review.': '研究边界检查需要复核。',
    'run manifest reported guardrail review required': '最近一次更新的规则保护需要复核。',
    'guardrail regression: no_trading_advice': '研究边界规则出现回归，需要优先检查。',
    'Detected: no change. Comparison uses persisted artifacts only.': '本次未发现变化。比较仅使用已经保存的正式研究结果。',
    'Detected: branch change. Comparison uses persisted artifacts only.': '检测到细分分支变化；比较仅使用已经保存的正式研究结果。',
    'Upgrade is capped by required checks: old theme reactivation; branch reality upgrade; pricing adoption insufficient; parent reality insufficient; medical branch validation cannot represent whole BCI; revenue/payment/listed-asset mapping still missing.': '旧主题虽出现重新活跃和医疗康复分支的现实进展，但整体主题仍缺少充分的市场预期与现实验证；分支证据不能代表整个脑机接口主题，收入、支付和相关资产映射也仍不完整。',
    'Upgrade is capped by required checks: pricing adoption; reality validation; valuation friction; S7A/S7C potential; S7B risk for crowded edge assets.': '仍需验证市场预期采纳和现实进展，并关注估值阻力、成熟延续或分支演变的可能，以及拥挤边缘资产走弱的风险。',
    'Upgrade is capped by required checks: reality-first path; pricing adoption through upfront/milestone/global rights; clinical and regulatory risk; milestone realization risk.': '仍需优先验证现实进展，以及首付款、里程碑和全球权益能否形成持续的市场预期；临床、监管和里程碑兑现风险仍然存在。',
    'Old theme reactivation has new branch reality evidence, but parent gates remain incomplete.': '旧主题出现新的分支现实证据，但整体主题的阶段门槛仍未满足。',
    'Missing pricing adoption; Missing hard reality evidence.': '尚缺市场预期采纳证据和可验证的现实进展证据。',
    'Missing pricing adoption.': '尚缺市场预期采纳证据。',
    'Missing hard reality evidence.': '尚缺可验证的现实进展证据。',
    'Missing stable label; Missing capital confirmation; Missing pricing adoption.': '尚缺稳定的市场命名、资源确认和市场预期采纳证据。',
    'Missing stable label; Missing capital confirmation; Missing pricing adoption; Missing hard reality evidence.': '尚缺稳定的市场命名、资源确认、市场预期采纳和可验证的现实进展证据。',
    'Parent pricing and reality evidence remain incomplete.': '整体主题的市场预期与现实进展证据仍不完整。',
    'No parent Evidence Table is available. Branch evidence is shown separately and cannot upgrade the parent narrative.': '整体主题尚无正式证据表。分支证据会单独展示，不能升级整体主题。',
    'observe': '持续观察',
    'wait': '等待更多证据',
    'validate': '进一步验证',
    'review': '复核',
    'monitor': '持续监测',
    'flag_risk': '标记风险',
    'early research': '早期研究线索',
    'Operators repeatedly corrected confidence; expose this as a review warning and prompt example.': '研究者多次修改信息可靠度；应在审核时增加提醒，并提供填写示例。',
    'Acceptance rate dropped below the rolling baseline. Candidates may be drifting from operator expectations; re-order the active learning queue toward higher-uncertainty items and verify prompt framing.': '候选接受率低于滚动基线，可能偏离研究者预期；应优先复核高不确定性候选并检查提示词。',
  } as Record<string, string>)[value];
  if (exact) return exact;
  return escape(value
    .replaceAll('Topic', '主题')
    .replaceAll('Branch', '分支')
    .replaceAll('Evidence', '证据')
    .replaceAll('Stage', '阶段')
    .replaceAll('Weekly', '本轮研究更新')
    .replaceAll('unresolved', '暂无法判断')
    .replaceAll('no_change', '无变化'));
}
function promotionStatusLabel(value: string | null | undefined): string {
  return escape(({
    blocked: '暂不允许升级',
    pending: '等待审核',
    shadow_ready: '可进入对照验证',
  auto_eligible: '达到审核门槛',
    approved: '已应用',
    rejected: '已跳过',
  } as Record<string, string>)[value ?? ''] ?? (value ? '状态待确认' : '尚未运行'));
}
function metricLabel(value: string): string {
  return escape(({
    minimum_sample_size: '最低审核样本数',
    reviewed_sample_size: '已审核样本数',
    citation_accuracy: '引用准确率',
    unsupported_claim_rate: '无依据判断率',
    parent_branch_error_rate: '整体主题与分支错误率',
    e3_e4_overstatement_rate: 'E3/E4 夸大率',
    acceptance_rate: '候选接受率',
    shadow_agreement_rate: '影子对照一致率',
    golden_gate_pass_rate: '金标验证通过率',
    no_trading_advice: '禁止交易建议',
  } as Record<string, string>)[value] ?? '其他安全指标');
}
function gateValueLabel(value: unknown): string {
  const raw = String(value ?? '');
  return escape(({ passed: '已满足', failed: '未满足', true: '是', false: '否' } as Record<string, string>)[raw] ?? raw);
}
function proposalKindLabel(value: string): string {
  return escape(({
    prompt_adjustment: '提示词调整',
    mapping_adjustment: '主题归属调整',
    field_guidance: '字段填写指引',
    review_priority: '审核优先级调整',
    duplicate_rule: '重复检查调整',
  } as Record<string, string>)[value] ?? '其他改进建议');
}
function proposalStatusLabel(value: string): string {
  return escape(({ blocked: '暂不采用', shadow_ready: '可进入对照验证', observing: '继续观察', collecting: '继续收集样本', pending: '等待审核', approved: '已批准', rejected: '已拒绝' } as Record<string, string>)[value] ?? '状态待确认');
}
function guardrailLabel(value: string): string {
  return escape(({
    no_trading_advice: '禁止交易建议',
    research_only_actions: '仅允许研究行动',
    parent_branch_separation_preserved: '整体主题与分支保持隔离',
    evidence_ids_visible: '证据可追溯',
    why_not_higher_present: '说明为什么不能更高',
    data_confidence_present: '展示数据可信度',
    evidence_table_required: '必须先有证据表',
    stage_first_score_second: '先判断阶段，再计算分数',
  } as Record<string, string>)[value] ?? '其他规则保护');
}
function sourceServiceLabel(value: string): string {
  return escape(({
    AviationService: '航空信息',
    BatchService: '批量数据处理',
    CFTCPublicReporting: '美国商品期货公开报告',
    ClimateService: '气候信息',
    ConflictService: '冲突事件',
    ConsumerPricesService: '消费价格',
    CyberService: '网络安全',
    DisplacementService: '人口迁移',
    EconomicService: '宏观经济',
    ForecastService: '预测数据',
    GDACS: '全球灾害预警',
    GivingService: '公益与捐赠',
    HealthService: '公共健康',
    ImageryService: '卫星与影像',
    InfrastructureService: '基础设施',
    IntelligenceService: '综合情报',
    LeadsService: '事件线索',
    MaritimeService: '海事信息',
    MarketService: '市场数据',
    MilitaryService: '军事动态',
    NASAEonet: 'NASA 自然事件',
    NaturalService: '自然事件',
    NewsService: '新闻信息',
    NWSAlerts: '美国国家气象预警',
    PositiveEventsService: '积极事件',
    PredictionService: '预测市场',
    RadiationService: '辐射监测',
    ResearchService: '研究资料',
    ResilienceService: '韧性与恢复',
    SanctionsService: '制裁信息',
    ScenarioService: '情景分析',
    SeismologyService: '地震监测',
    ShippingV2Service: '航运信息',
    SupplyChainService: '供应链',
    ThermalService: '热异常监测',
    TradeService: '国际贸易',
    UnrestService: '社会事件',
    USGSSeismology: '美国地质调查局地震信息',
    USTreasuryFiscalData: '美国财政数据',
    WebcamService: '公开影像观察',
    WHODiseaseOutbreakNews: '世界卫生组织疫情通报',
    WildfireService: '野火监测',
    WorldBankIndicators: '世界银行指标',
  } as Record<string, string>)[value] ?? '其他数据来源');
}
function artifactLabel(value: string): string {
  return escape(({ weekly: '本轮研究结果', diff: '变化比较', review: '历史复盘', pilot: '研究试验', replay: '历史回放' } as Record<string, string>)[value] ?? '其他研究结果');
}
function friendlyDate(value: string | null | undefined): string {
  if (!value) return '尚未生成';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escape(value);
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(parsed);
}
function technicalDetails(rows: Array<[string, string | null | undefined]>): string {
  const visible = rows.filter(([, value]) => value);
  if (!visible.length) return '';
  return `<details class="technical-details"><summary>技术详情</summary><dl>${visible.map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl></details>`;
}
function confidenceLabel(value: string): string { return value === 'high' ? '高' : value === 'medium' ? '中' : '低'; }
function changeLabel(value: string): string { return ({ no_change: '无变化', stage_upgrade: '阶段升级', stage_downgrade: '阶段降级', evidence_added: '证据新增', evidence_removed: '证据移除', branch_change: '分支变化', branch_mutation_candidate: '分支演变候选', initial_snapshot: '初始快照' } as Record<string, string>)[value] ?? '未识别的变化类型'; }
function changeClass(value?: string): string { return value === 'stage_downgrade' || value === 'evidence_removed' ? 'negative' : value === 'no_change' ? 'neutral' : 'positive'; }
function priorityClass(value?: string): string { return value === 'high' ? 'high' : value === 'medium' ? 'medium' : ''; }
function freshnessLabel(value: string): string { return value === 'fresh' ? '新鲜' : value === 'stale' ? '已过期' : '缺失'; }
function runModeLabel(value: string): string { return value === 'research' ? '正式研究运行' : value === 'test' ? '测试运行' : '未标记运行'; }
function sourceLoopLabel(value: NarrativeMonitorModel['source_loop']['status']): string { return ({ not_run: '尚未运行', no_changes: '本轮无变化', pending_review: '等待校验', reviewed_no_import: '校验完成，未导入', pipeline_failed: '已导入，研究更新失败', weekly_complete: '闭环完成' } as const)[value]; }
function stateClass(value: string): string { return value === 'operational' || value === 'fresh' ? 'ok' : value === 'failed' ? 'bad' : value === 'review_required' || value === 'fallback' || value === 'stale' ? 'warn' : 'muted-state'; }
function stateLabel(value: string): string { return ({ operational: '正常', review_required: '需要复核', fallback: '备用规则', failed: '失败', stale: '已过期', not_configured: '尚未配置', unlabeled: '未标记' } as Record<string, string>)[value] ?? '未知状态'; }
function queueCategoryLabel(value: string): string { return ({ parent_branch_conflict: '整体主题与分支冲突', high_strength: 'E3 / E4 高强度判断', new_topic: '待确认的新主题', topic_discovery: '主题发现提案', evidence_chain_update: '证据链更新提案', new_branch: '新分支', reactivation: '旧主题重新活跃', agent_rule_disagreement: '智能解析与规则存在差异', low_citation_confidence: '引用可靠度偏低', possible_duplicate: '可能重复', unsupported_claim: '原文不支持的判断', ordinary_candidate: '普通候选', guardrail_alert: '规则保护提醒' } as Record<string, string>)[value] ?? '其他待审核事项'; }
function chainRelationLabelForView(value: string): string { return ({ supports: '支持', contradicts: '反向', updates: '更新', duplicates: '重复', branch_only: '仅分支', fills_gap: '补充缺口' } as Record<string, string>)[value] ?? value; }
function escape(value: unknown): string { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }

function styles(): string { return `
:root{--ink:#d8dee9;--muted:#a3be8c;--line:#2e3440;--canvas:#1c1c1c;--surface:#242424;--panel:#2a2a2a;--nav:#121212;--accent:#88c0d0;--accent-soft:#2e3440;--amber:#ebcb8b;--amber-soft:#3b4252;--red:#bf616a;--red-soft:#3b4252;--blue:#81a1c1;--radius:4px;--shadow:0 1px 2px rgba(0,0,0,0.5),0 7px 18px rgba(0,0,0,0.25)}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:13px/1.55 "Inter", "Roboto Mono", "Menlo", monospace; -webkit-font-smoothing: antialiased; letter-spacing: 0.02em;}.topbar{min-height:50px;background:var(--nav);display:flex;align-items:center;gap:20px;padding:0 24px;color:#fff;border-bottom: 1px solid var(--line);}.brand{display:flex;align-items:center;gap:9px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;white-space:nowrap; text-transform: uppercase; letter-spacing: 0.1em;}.brand-mark{display:grid;place-items:center;width:24px;height:24px;border:1px solid rgba(255,255,255,.2);border-radius:3px;color:var(--accent); font-weight: 800;}.topbar nav{display:flex;align-items:stretch;gap:2px;flex:1;min-width:0;height:50px;overflow-x:auto;scrollbar-width:none}.topbar nav::-webkit-scrollbar{display:none}.nav-link{display:flex;flex:0 0 auto;align-items:center;padding:0 12px;color:#8fbcbb;text-decoration:none;font-size:11px;font-weight:600;white-space:nowrap;border-bottom:2px solid transparent; text-transform: uppercase;}.nav-link:hover,.nav-link.active{color:var(--accent);border-bottom-color:var(--accent); background: rgba(136, 192, 208, 0.05);}.trust{font-size:10px;color:#8fbcbb;border:1px solid rgba(143,188,187,.25);border-radius:3px;padding:3px 7px;white-space:nowrap; text-transform: uppercase;}.app{max-width:1600px;margin:0 auto;padding:20px 24px 48px}.hero-row,.topic-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:20px; border-bottom: 1px solid var(--line); padding-bottom: 20px;}.eyebrow{margin:0 0 5px;color:var(--muted);font-size:10px;font-weight:600;letter-spacing:0.1em; text-transform: uppercase;}.hero-row h1,.topic-head h1,.empty h1{margin:0;font-size:24px;line-height:1.2;letter-spacing:0.02em; font-weight: 400; color: #eceff4;}.lede{margin:7px 0 0;color:#d8dee9;max-width:700px; font-size: 13px;}.run-meta{display:grid;gap:2px;min-width:220px;padding:11px 13px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);font-size:11px;color:var(--muted)}.run-meta strong{color:var(--accent);font-size:12px; font-weight: 600;}.run-meta small{font-family:ui-monospace,monospace;color:#4c566a}.one-click-run{display:grid;gap:8px;min-width:260px}.one-click-run .small{margin:0; font-size: 11px; color: var(--muted)}.one-click-run .button{padding:9px 14px;font-size:12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;}.system-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;margin-bottom:14px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--line)}.compact-status{position:relative;display:grid;gap:4px;padding:9px 12px;background:var(--surface);min-width:0}.compact-status span{font-size:10px;color:var(--muted);text-transform:uppercase}.compact-status strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; color: #eceff4}.compact-status i{position:absolute;right:10px;top:11px;width:6px;height:6px;border-radius:50%;background:#4c566a}.compact-status i.ok{background:#a3be8c}.compact-status i.warn{background:var(--amber)}.compact-status i.bad{background:var(--red)}.metric-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:24px}.metric{min-height:70px;padding:12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);}.metric span{display:block;color:var(--muted);font-size:10px; text-transform: uppercase; letter-spacing: 0.05em;}.metric strong{display:block;margin-top:7px;font-size:22px;line-height:1; font-weight: 400; color: #eceff4;}.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:18px;}.panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px; border-bottom: 1px solid var(--line); padding-bottom: 12px;}.panel-heading h2{margin:0;font-size:15px;letter-spacing:0; font-weight: 500; color: #eceff4; text-transform: uppercase;}.text-link,.topic-link,.back-link{color:var(--accent);font-weight:600;text-decoration:none}.text-link:hover,.topic-link:hover,.back-link:hover{text-decoration:underline; color: #8fbcbb;}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;min-width:960px}th{text-align:left;color:var(--muted);font-size:10px;letter-spacing:.05em;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--line); background: var(--panel)}td{padding:10px 10px;vertical-align:top;border-bottom:1px solid var(--line); font-size: 12px;}td small{display:block;margin-top:4px;color:var(--muted);font-size:10px}.why-cell{max-width:360px;color:#d8dee9;font-size:12px}.stage,.confidence,.chip,.change,.state-pill{display:inline-flex;align-items:center;border-radius:3px;padding:2px 6px;font-size:10px;font-weight:600;white-space:nowrap; text-transform: uppercase; border: 1px solid transparent;}.state-pill.ok{border-color: #a3be8c; color:#a3be8c}.state-pill.warn{border-color: var(--amber); color:var(--amber)}.state-pill.bad{border-color: var(--red); color:var(--red)}.state-pill.muted-state{border-color: #4c566a; color:#d8dee9}.stage.early{border-color: #4c566a; color:#d8dee9}.stage.mid{border-color: var(--accent); color:var(--accent)}.stage.late{border-color: var(--amber); color:var(--amber)}.confidence.high{border-color: #a3be8c; color:#a3be8c}.confidence.medium{border-color: var(--amber); color:var(--amber)}.confidence.low{border-color: var(--red); color:var(--red)}.change.positive{color:#a3be8c}.change.negative{color:var(--red)}.change.neutral{color:var(--muted)}.dashboard-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.queue-row{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}.queue-row strong{font-size:15px; font-weight: 500;}.list-row{padding:10px 0;border-bottom:1px solid var(--line)}.list-row p{margin:4px 0 7px;color:var(--muted);font-size:11px}.chip{border-color: #4c566a; color:#d8dee9}.chip.high{border-color: var(--red); color:var(--red)}.chip.medium{border-color: var(--amber); color:var(--amber)}.queue-grid,.governance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.wide-panel{grid-column:1/-1}.count{display:grid;place-items:center;min-width:24px;height:24px;border: 1px solid var(--accent); color:var(--accent);border-radius:3px;font-weight:600; font-size: 10px;}.button{display:inline-flex;align-items:center;justify-content:center;border-radius:3px;padding:7px 12px;text-decoration:none;font-weight:600; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;}.button.primary{background:var(--accent);color:var(--nav); border: 1px solid var(--accent);}.button.primary:hover{background: #8fbcbb; border-color: #8fbcbb;}.button.secondary{background:transparent;border:1px solid var(--accent);color:var(--accent)}.button.secondary:hover{background: rgba(136,192,208,0.1);}.back-link{display:inline-block;margin-bottom:15px; text-transform: uppercase; font-size: 11px;}.topic-head{margin-bottom:16px}.stage-block{display:grid;justify-items:end;gap:4px}.stage-block .stage{font-size:16px;padding:6px 10px; font-weight: 500;}.stage-block small{color:var(--muted); font-size: 10px; text-transform: uppercase;}.topic-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:18px}.topic-summary>div{padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}.topic-summary span{display:block;color:var(--muted);font-size:10px; text-transform: uppercase;}.topic-summary strong{display:block;margin-top:5px;font-size:14px; font-weight: 500; color: #eceff4;}.detail-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-bottom:18px}.why{margin:0 0 14px;line-height:1.6;color:#d8dee9; font-size: 13px;}.fact-list{display:grid;grid-template-columns:120px 1fr;gap:6px 12px;margin:0;font-size:12px}.fact-list dt{color:var(--muted); text-transform: uppercase; font-size: 10px;}.fact-list dd{margin:0;font-weight:500;overflow-wrap:anywhere; color: #eceff4;}.guardrail-note{color:var(--amber); border: 1px solid var(--amber); padding:3px 6px;border-radius:3px;font-size:10px;font-weight:600; text-transform: uppercase;}.branch-tree{display:grid;gap:0}.parent-node,.branch-node{display:grid;grid-template-columns:90px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line)}.parent-node{background:var(--panel);border-radius:3px 3px 0 0}.branch-node{margin-left:20px;border-top:0;background:var(--surface)}.branch-node:last-child{border-radius:0 0 3px 3px}.branch-node small{grid-column:2/-1;color:var(--muted); font-size: 11px;}.node-label{font-size:10px;font-weight:600;color:var(--muted);letter-spacing:.08em; text-transform: uppercase;}.evidence-list{display:grid;gap:0}.evidence-row{display:grid;grid-template-columns:45px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.evidence-strength{display:grid;place-items:center;align-self:start;padding:3px;border: 1px solid var(--amber);color:var(--amber);font-size:10px;font-weight:600;border-radius:3px}.evidence-row p{margin:4px 0;color:#eceff4;font-size:12px}.evidence-row small{color:#4c566a; font-size: 11px;}.guardrail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)}.pass{color:#a3be8c}.fail{color:var(--red)}.muted{color:var(--muted)}.small{color:var(--muted);font-size:11px}.empty{max-width:620px;margin:60px auto;padding:24px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);}.empty p:not(.eyebrow){color:var(--muted);margin-bottom:20px}.method-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-bottom:16px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--line)}.method-step{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:12px;background:var(--surface)}.method-step span{grid-row:1/3;color:var(--accent);font:500 16px/1 ui-monospace,monospace}.method-step strong{font-size:12px; color: #eceff4;}.method-step small{color:var(--muted)}.warning-band{display:flex;gap:14px;align-items:center;margin-bottom:18px;padding:10px 12px;background:rgba(235, 203, 139, 0.1);border-left:3px solid var(--amber);color:var(--amber)}.warning-band span{font-size:11px}.method-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.formula-panel h2{margin:0 0 10px;font-size:14px}.formula{display:block;overflow:auto;padding:10px 12px;background:var(--nav);border:1px solid var(--line);border-radius:3px;color:var(--accent);font-size:12px;white-space:nowrap}.formula-panel p{margin:10px 0 0;color:var(--muted);font-size:11px}.method-notes{margin-top:18px}.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}.status-card{display:grid;grid-template-columns:1fr auto;gap:6px}.status-card h2{margin:0;font-size:15px; color: #eceff4;}.status-card p{grid-column:1/-1;margin:4px 0 0;color:var(--muted);font-size:11px}.artifact-row{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:11px}.artifact-row span small{display:block;color:var(--muted)}.artifact-row>strong{font-weight:500; color: #eceff4;}.change-feed,.inbox-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.change-card-head{display:flex;justify-content:space-between;align-items:start;gap:12px}.change-card-head h2{margin:0;font-size:15px; font-weight: 500; text-transform: uppercase;}.before-after{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;margin:12px 0;padding:10px;background:var(--nav);border:1px solid var(--line);border-radius:3px}.before-after div:not(.change-arrow){display:grid;gap:2px}.before-after span,.before-after small{color:var(--muted);font-size:10px; text-transform: uppercase;}.before-after strong{font-size:16px; font-weight: 400; color: #eceff4;}.change-arrow{color:var(--muted)}.inbox-card blockquote{margin:12px 0;padding:8px 10px;border-left:2px solid var(--amber);background:rgba(235,203,139,0.05);color:#d8dee9}.review-row{display:grid;grid-template-columns:70px 1fr auto;gap:12px;align-items:start;padding:10px 0;border-bottom:1px solid var(--line);color:var(--ink);text-decoration:none}.review-row p{margin:3px 0 0;color:var(--muted);font-size:11px}@media(max-width:1100px){.system-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.change-feed,.inbox-list{grid-template-columns:1fr}}@media(max-width:1000px){.metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.dashboard-grid,.detail-grid{grid-template-columns:1fr}.topbar{gap:14px;padding:0 16px}.trust{display:none}.app{padding:24px 16px}.queue-grid{grid-template-columns:1fr}.method-flow{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.topbar{min-height:56px;flex-wrap:wrap;height:auto;padding:10px 14px}.topbar nav{order:3;width:100%;height:34px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}.topbar nav::-webkit-scrollbar{display:none}.nav-link{padding:0 8px;font-size:11px}.brand{font-size:12px}.brand span:last-child{display:none}.hero-row,.topic-head{display:block}.hero-row .button,.hero-row .state-pill{margin-top:15px}.run-meta{margin-top:15px}.system-strip{grid-template-columns:1fr 1fr}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.status-grid{grid-template-columns:1fr}.topic-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.stage-block{justify-items:start;margin-top:14px}.parent-node,.branch-node{grid-template-columns:1fr auto}.node-label{grid-column:1/-1}.branch-node{margin-left:14px}.fact-list{grid-template-columns:110px 1fr}.app{padding:20px 12px}.panel{padding:14px}.method-flow,.method-grid{grid-template-columns:1fr}.warning-band{display:block}.warning-band span{display:block;margin-top:5px}.artifact-row{grid-template-columns:1fr auto}.artifact-row>strong{grid-column:1/-1;grid-row:2}.review-row{grid-template-columns:64px 1fr}.review-row>span:last-child{display:none}}
.topbar>nav{display:flex;align-items:stretch;gap:4px;flex:1;min-width:0;height:50px;overflow:visible}.nav-link{padding:0 10px}.nav-action{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 10px;border:1px solid var(--accent);border-radius:3px;background:transparent;color:var(--accent);text-decoration:none;font-size:11px;font-weight:600;white-space:nowrap; text-transform: uppercase;}.nav-action:hover{background:rgba(136,192,208,0.1);}.section-nav{display:flex;gap:4px;margin:-10px 0 24px;padding-bottom:9px;border-bottom:1px solid var(--line);overflow-x:auto}.section-nav a{padding:6px 10px;border-radius:3px;color:var(--muted);text-decoration:none;font-size:11px;font-weight:600;white-space:nowrap; text-transform: uppercase;}.section-nav a:hover,.section-nav a.active{background:var(--accent-soft);color:var(--accent)}.system-hub{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.system-hub-card{position:relative;display:grid;gap:8px;min-height:150px;padding:18px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--ink);text-decoration:none; transition: border-color 0.15s;}.system-hub-card:hover { border-color: var(--accent); }.system-hub-card>span{position:absolute;right:16px;top:16px;color:var(--accent);font-size:10px;font-weight:600; text-transform: uppercase;}.system-hub-card h2{margin:0;font-size:15px; color: #eceff4; font-weight: 500;}.system-hub-card p{margin:0;max-width:440px;color:var(--muted); font-size: 12px;}.system-hub-card strong{align-self:end;color:var(--accent);font-size:11px; text-transform: uppercase;}
.technical-details{margin-top:9px;color:var(--muted);font-size:10px}.technical-details summary{cursor:pointer;color:var(--accent);font-weight:600; text-transform: uppercase; letter-spacing: 0.05em;}.technical-details dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:4px 10px;margin:6px 0 0;padding:8px;background:var(--nav);border:1px solid var(--line);border-radius:3px}.technical-details dt{color:var(--muted); text-transform: uppercase;}.technical-details dd{margin:0;font-family:ui-monospace,monospace;overflow-wrap:anywhere; color: #d8dee9;}.artifact-row>.technical-details{grid-column:1/-1}
@media(max-width:1000px){.governance-grid{grid-template-columns:1fr}.guardrail-row{gap:12px}.guardrail-row span{min-width:0;overflow-wrap:anywhere}.guardrail-row span small{display:block;color:var(--muted)}.guardrail-row strong{flex:0 0 auto}.topbar{gap:12px}.trust{display:none}}
@media(max-width:640px){.panel-heading{flex-wrap:wrap}.topbar>nav{order:3;width:100%;height:36px;justify-content:space-between}.nav-link{padding:0 5px;font-size:10px}.nav-action{margin-left:auto}.brand-mark{display:grid}.system-hub{grid-template-columns:1fr}.section-nav{margin-top:-4px}}
.agent-run{padding:10px 0;border-bottom:1px solid var(--line)}.agent-run-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.agent-run-head strong{font-size:12px; color: #eceff4; font-weight: 500;}.agent-phase-row{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.phase-pill{padding:2px 6px;border:1px solid transparent; border-radius:3px;font-size:9px;font-weight:600; text-transform: uppercase;}.phase-pill.ok{border-color: #a3be8c; color:#a3be8c}.phase-pill.bad{border-color: var(--red); color:var(--red)}.phase-pill.muted{border-color: #4c566a; color:#d8dee9}.agent-run>p{margin:7px 0 0;font-size:11px; color: #d8dee9;}.metric small{display:block;margin-top:4px;color:var(--muted);font-size:10px;font-weight:400}.section-subtitle{margin:16px 0 2px;font-size:12px;color:var(--muted); text-transform: uppercase;}.agent-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px}.agent-field{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:8px 10px;background:var(--nav);border:1px solid var(--line);border-radius:3px}.agent-field span{font-size:11px;font-weight:600;color:var(--muted); text-transform: uppercase;}.agent-field input[type=number],.agent-field input:not([type=checkbox]){width:130px;padding:5px 7px;background: var(--surface); color: var(--ink); border:1px solid var(--line);border-radius:3px;font:12px ui-monospace,monospace}.agent-form .button{margin-top:4px}.guardrail-row span small{display:block;color:var(--muted);margin-top:2px; font-size: 10px;}.guardrail-row>span{min-width:0;overflow-wrap:anywhere}@media(max-width:640px){.agent-form{grid-template-columns:1fr}}

/* Timeline & Radar CSS */
.timeline-container { position: relative; padding-left: 20px; border-left: 2px solid var(--line); margin-top: 20px; }
.timeline-event { position: relative; margin-bottom: 24px; }
.timeline-event::before { content: ''; position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); }
.timeline-event.milestone::before { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 8px rgba(136,192,208,0.6); }
.timeline-date { font-size: 11px; color: var(--accent); font-weight: 600; margin-bottom: 4px; display: block; }
.timeline-content { background: var(--nav); padding: 12px; border-radius: 3px; border: 1px solid var(--line); }
.timeline-stage { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; background: var(--accent-soft); color: var(--accent); margin-bottom: 6px; }
.timeline-title { font-size: 13px; color: #eceff4; font-weight: 500; margin: 0 0 6px 0; }
.timeline-gates { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.timeline-gate { font-size: 9px; text-transform: uppercase; padding: 2px 4px; border-radius: 2px; border: 1px solid #4c566a; color: var(--muted); }
.timeline-gate.unlocked { border-color: #a3be8c; color: #a3be8c; }

.radar-container { position: relative; width: 100%; padding-bottom: 100%; }
.radar-svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; }
.radar-axis { stroke: var(--line); stroke-width: 1; stroke-dasharray: 4 4; }
.radar-polygon { fill: rgba(136, 192, 208, 0.2); stroke: var(--accent); stroke-width: 2; transition: all 0.3s ease; }
.radar-point { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.radar-label { font-size: 10px; fill: var(--muted); font-weight: 600; text-transform: uppercase; text-anchor: middle; }

.three-column-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 20px; align-items: start; }
@media(max-width:1200px) { .three-column-grid { grid-template-columns: 1fr 1fr; } .three-column-grid > div:last-child { grid-column: 1 / -1; } }
@media(max-width:800px) { .three-column-grid { grid-template-columns: 1fr; } }

.heatmap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
.heatmap-card { padding: 16px; border-radius: 3px; background: var(--surface); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; cursor: pointer; text-decoration: none; transition: all 0.2s; }
.heatmap-card:hover { border-color: var(--accent); background: var(--panel); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.heatmap-card .stage { align-self: flex-start; }
.heatmap-card h3 { margin: 0; font-size: 14px; font-weight: 500; color: #eceff4; }
.heatmap-card p { margin: 0; font-size: 11px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.heatmap-density { display: flex; gap: 2px; margin-top: auto; }
.heatmap-tick { flex: 1; height: 4px; background: var(--line); border-radius: 2px; }
.heatmap-tick.active { background: var(--accent); }
`; }
