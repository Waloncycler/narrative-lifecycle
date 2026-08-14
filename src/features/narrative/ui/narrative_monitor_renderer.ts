import type { NarrativeMonitorModel, NarrativeMonitorTopic } from '@/features/narrative/types/narrative_monitor';
import { QUANTITATIVE_RULE_VERSION } from '@/features/scoring/domain/quantitative_framework';
import { isUsableBranchName } from '@/features/narrative/domain/market_naming';
import { WORLDMONITOR_SOURCE_CATALOG } from '@/features/worldmonitor/domain/worldmonitor_source_catalog';

export function renderNarrativeMonitor(model: NarrativeMonitorModel): string {
  const body = model.status === 'insufficient_data'
    ? `<section class="hero-row"><div><p class="eyebrow">研究总览</p><h1>主题态势总览</h1><p class="lede">当前还没有正式的周度研究结果；系统只展示已经真实产生的状态。</p></div>${oneClickAutoRun(model)}</section>${systemStatusBar(model)}${emptyState('尚无周度研究结果', '完成一次自动调研循环后，系统才会显示经过阶段门槛验证的主题状态。', '/agent', '立即自动调研')}`
    : `
      <section class="hero-row">
        <div><p class="eyebrow">研究总览</p><h1>主题态势总览</h1><p class="lede">查看正式主题的当前阶段、证据覆盖与需要核验的变化。候选材料不会直接改变主题阶段。</p></div>
        ${oneClickAutoRun(model)}<div class="run-meta"><span>最近更新</span><strong>${friendlyDate(model.generated_at)}</strong>${technicalDetails([['运行批次', model.run_id]])}</div>
      </section>
      ${systemStatusBar(model)}
      ${metricGrid(model)}
      <section class="panel wide-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">主题分布</p><h2>当前主题</h2></div>
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
              <p>${escape(topic.baseline_status === 'baseline_required' ? '需补充父主题基准证据' : friendlyReason(topic.why_not_higher_stage))}</p>
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
    <button class="button primary" id="one-click-run" onclick="runAgentNow()" ${running ? 'disabled' : ''}>${running ? '自动调研中…' : '自动运行并准入'}</button>
    <p class="small" id="one-click-status">${running ? '正在同步数据源、草拟并导入证据、更新主题与阶段。' : '自动完成检索、取证、解析与政策准入；不合格材料会保留原因。'}</p>
  </div>
  <script>
    async function runAgentNow() {
      const button = document.getElementById('one-click-run');
      const status = document.getElementById('one-click-status');
      button.disabled = true; button.textContent = '自动调研中…';
      status.textContent = '正在同步数据源、草拟并导入证据、更新主题与阶段，请稍候。';
      try {
        const response = await fetch('/api/operate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        const data = await response.json().catch(() => ({}));
        if (data.status === 'already_running') { status.textContent = '已有一轮自动调研正在运行，页面即将刷新。'; }
        await waitForAgentIdle();
      } catch (error) { status.textContent = '自动调研启动失败：' + error; }
      location.reload();
    }
    async function waitForAgentIdle() {
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        const data = await fetch('/api/operate/status').then((r) => r.json()).catch(() => null);
        if (data?.status === 'completed' || data?.status === 'failed') return;
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
  const deepSweep = agent.deep_research_sweep;
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
          const response = await fetch('/api/operate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
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
      async function runDeepNow() {
        const button = document.getElementById('run-deep');
        button.disabled = true; button.textContent = '深扫中…';
        try {
          const response = await fetch('/api/agent/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ loop_kind: 'deep' }) });
          const data = await response.json().catch(() => ({}));
          if (data.status === 'already_running') { alert('已有一轮循环正在运行，请等待完成。'); location.reload(); return; }
        } finally { location.reload(); }
      }
      async function waitForAgentIdle() {
        const deadline = Date.now() + 10 * 60 * 1000; // 最长等待 10 分钟
        while (Date.now() < deadline) {
          const data = await fetch('/api/operate/status').then((r) => r.json()).catch(() => null);
          if (data?.status === 'completed') { alert('自动循环完成：本轮已写入正式证据 ' + (data.published_evidence ?? 0) + ' 条。'); return; }
          if (data?.status === 'failed') throw new Error(data.message || '自动循环失败');
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
      async function saveScheduler() {
        const form = document.getElementById('scheduler-form');
        const data = Object.fromEntries(new FormData(form).entries());
        data.enabled = form.elements['enabled'].checked;
        data.quick_enabled = form.elements['quick_enabled'].checked;
        data.deep_enabled = form.elements['deep_enabled'].checked;
        data.daily_max_operations = Number(data.daily_max_operations);
        data.quick_max_operations = Number(data.quick_max_operations);
        data.quick_interval_hours = Number(data.quick_interval_hours);
        data.deep_max_rounds = Number(data.deep_max_rounds);
        data.deep_queries_per_round = Number(data.deep_queries_per_round);
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
      <div><p class="eyebrow">自驱动研究 Agent</p><h1>自动调研与迭代循环</h1><p class="lede">自动检索、取证、解析和政策准入。只有满足原始来源、引用、日期、主题归属与阶段保护规则的候选才会进入正式证据；其他项目保留明确原因。</p></div>
      <div class="action-row"><button id="run-coverage-campaign" class="button secondary" onclick="runCoverageCampaign()">仅更新研究覆盖</button><button id="run-deep" class="button secondary" onclick="runDeepNow()" ${agent.loop_running ? 'disabled' : ''}>深度搜索</button><button id="run-agent" class="button primary" onclick="runAgentNow()" ${agent.loop_running ? 'disabled' : ''}>${agent.loop_running ? '自动运行中…' : '自动运行并准入'}</button></div>
    </section>
    <section class="system-strip">
      ${compactStatus('调度器', scheduler.enabled ? '已启用' : '已停用', scheduler.enabled ? 'operational' : 'not_configured')}
      ${compactStatus('下一轮调研', friendlyDate(agent.next_daily_run), agent.next_daily_run ? 'operational' : 'not_configured')}
      ${compactStatus('下一轮深扫', friendlyDate(agent.next_deep_run), scheduler.deep_enabled && agent.next_deep_run ? 'operational' : 'not_configured')}
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
      ${kpi('外部线索', String(webResearch?.lead_count ?? 0), webResearch ? `${webResearch.queries.length} 个检索词 × ${(webResearch.providers ?? [webResearch.provider]).join('+')} 并行引擎；只作待核验线索` : '尚未执行外部检索')}
      ${kpi('深度扫描', String(lastMetrics?.deep_sweep_rounds ?? deepSweep?.totals.rounds ?? 0), deepSweep ? `累计 ${deepSweep.totals.queries} 次检索 · ${deepSweep.totals.leads} 条线索 · 追问 ${Math.max(0, deepSweep.totals.queries - (deepSweep.rounds[0]?.queries ?? 0))} 次` : `最近一轮追问 ${lastMetrics?.deep_followup_queries ?? 0} 次`)}
      ${kpi('优先复核', String(leadTriage?.summary.priority_review_count ?? 0), leadTriage ? `普通复核 ${leadTriage.summary.review_count} · 背景参考 ${leadTriage.summary.reference_only_count} · 暂缓 ${leadTriage.summary.hold_count}` : '运行覆盖计划后自动分诊')}
    </section>
    <div class="dashboard-grid">
      ${renderActiveProbes(researchCampaign, directSourceResearch)}
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">循环时间线</p><h2>最近运行</h2></div><a class="text-link" href="/runs">查看正式运行</a></div>
        ${timeline.length ? timeline.map((run) => `
          <article class="agent-run">
            <div class="agent-run-head"><span class="state-pill ${run.status === 'completed' ? 'ok' : run.status === 'partial' ? 'warn' : 'bad'}">${agentRunStatusLabel(run.status)}</span><strong>${friendlyDate(run.started_at)}</strong><span class="chip">${loopKindLabel(run.loop_kind)} · ${triggerLabel(run.triggered_by)}</span></div>
            <div class="agent-phase-row">${run.phases.map((phase) => `<span class="phase-pill ${phase.status === 'ok' ? 'ok' : phase.status === 'failed' ? 'bad' : 'muted'}">${phaseLabel(phase.phase)}</span>`).join('')}</div>
            <p class="muted">覆盖任务 ${run.metrics.research_campaign_tasks ?? 0} · 权威 API ${run.metrics.direct_source_queries ?? 0} 次 / 线索 ${run.metrics.direct_source_leads ?? 0} 条${run.loop_kind === 'deep' ? ` · 深扫 ${run.metrics.deep_sweep_rounds ?? 0} 轮 / 追问 ${run.metrics.deep_followup_queries ?? 0} 词` : ''} · 受控源同步 ${run.metrics.sources_completed}/${run.metrics.sources_requested} · 候选 ${run.metrics.candidate_count} · 激活主题 ${run.metrics.provisional_topics_activated ?? 0} · 激活分支 ${run.metrics.watch_branches_activated ?? 0} · 暂停 ${run.metrics.graph_nodes_held ?? 0} · 漂移 ${run.metrics.drift_detected ? '有' : '无'}</p>
            ${technicalDetails([['运行批次', run.run_id], ['起止', `${run.started_at} → ${run.completed_at}`]])}
          </article>`).join('') : '<p class="muted">尚无 Agent 运行记录。点击“立即运行一轮”开始第一次自动调研循环。</p>'}
      </section>
      <section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">来源核验队列</p><h2>权威原始记录与外部检索</h2><p class="small">所有结果都不是正式证据。必须打开原始来源并通过引用、主题/分支与 Evidence Gate，才可进入正式证据表。</p></div><span class="state-pill ${directSourceResearch?.status === 'completed' ? 'ok' : directSourceResearch?.status === 'degraded' || webResearch?.status === 'degraded' ? 'warn' : 'muted-state'}">${directSourceResearch?.status === 'completed' ? '原始来源已完成' : webResearch?.status === 'completed' ? '外部检索已完成' : '等待连接'}</span></div>
        ${baselineCompletion ? `<h3 class="section-subtitle">阶段基准与命名补全</h3><p class="small">每次覆盖研究都会先生成此清单。它只调整研究顺序和待核验事项，不改变已有阶段、证据或登记册。</p>${baselineCompletion.items.slice(0, 8).map((item) => `<div class="list-row"><span><strong>${item.kind === 'parent_evidence_baseline' ? '父主题证据基准' : item.kind === 'topic_name_verification' ? '主题命名核验' : '细分方向命名核验'}：${escape(item.display_name_zh)}</strong><p>${escape(item.rationale)}</p></span><span class="chip ${item.priority === 'high' ? 'high' : 'medium'}">${item.priority === 'high' ? '优先补全' : '待核验'}</span></div>`).join('')}${baselineCompletion.items.length > 8 ? `<p class="small">另有 ${baselineCompletion.items.length - 8} 项保留在基准补全计划中。</p>` : ''}` : ''}
        ${researchCampaign ? `<p class="small">当前计划：${researchCampaign.summary.formal_topic_count} 个正式主题、${researchCampaign.summary.branch_count} 个独立分支、${researchCampaign.summary.universe_seed_count} 个研究种子，定向覆盖 ${researchCampaign.summary.source_target_count} 个权威来源及 ${companyTargetCount} 家公司官网/IR。研究种子不会自动成为正式主题；公司材料也必须通过原始引用与 Evidence Gate。</p>` : ''}
        ${companyTargetNames.length ? `<p class="small">本轮公司核验对象：${companyTargetNames.slice(0, 16).map(escape).join('、')}${companyTargetNames.length > 16 ? `等 ${companyTargetNames.length} 家` : ''}。</p>` : ''}
        ${leadTriage?.items.length ? `<h3 class="section-subtitle">按规则分诊的优先线索</h3>${leadTriage.items.filter((item) => item.disposition === 'priority_review' || item.disposition === 'review').slice(0, 6).map((item) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(item.title)}</a></strong><p>${escape(item.source_name)} · ${item.branch_id ? `独立分支：${friendlyTopic(item.branch_id)}` : item.topic_id ? friendlyTopic(item.topic_id) : '待解析主题'} · ${escape(item.reasons[0] ?? '待人工核验')}</p></span><span class="chip">${item.disposition === 'priority_review' ? '优先复核' : '普通复核'}</span></div>`).join('')}<p class="small">分诊仅安排人工核验顺序；打开原文、确认引用位置与主题范围后，才可进入 Evidence Intake。</p>` : ''}
        ${retrievedSources.length ? `<h3 class="section-subtitle">可复核的原文摘录</h3><p class="small">已从权威原始记录提取有限正文。只有“引用可进入审核”的材料才能进入 Intake；它们仍不会自动成为正式证据或改变阶段。</p>${retrievedSources.slice(0, 6).map((item) => `<article class="source-excerpt"><div class="list-row"><span><strong><a class="topic-link" href="${escape(item.url)}" target="_blank" rel="noreferrer">${escape(item.page_title ?? item.title)}</a></strong><p>${item.branch_id ? `独立分支：${friendlyTopic(item.branch_id)}` : item.topic_id ? friendlyTopic(item.topic_id) : '待解析主题'} · ${item.source_class === 'official' ? '官方原始记录' : item.source_class === 'academic' ? '学术原文' : '原始来源'}</p></span><span class="chip ${item.citation_status === 'insufficient' ? 'high' : ''}">${item.citation_status === 'insufficient' ? '引用待补全' : '引用可进入审核'}</span></div>${item.excerpts.slice(0, 2).map((excerpt) => `<blockquote><small>${escape(excerpt.location_label)}</small>${escape(excerpt.quote)}</blockquote>`).join('')}${item.citation_notes?.length ? `<p class="small">${item.citation_notes.map(escape).join('；')}</p>` : ''}</article>`).join('')}` : sourceRetrieval ? '<p class="muted">已请求原始页面，但当前没有可用的正文摘录。该状态不会影响已有正式证据或阶段。</p>' : ''}
        ${directSourceResearch?.leads.length ? `<h3 class="section-subtitle">权威原始来源</h3>${directSourceResearch.leads.slice(0, 8).map((lead) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(lead.url)}" target="_blank" rel="noreferrer">${escape(lead.title)}</a></strong><p>${escape(lead.source_name)} · ${lead.topic_id ? friendlyTopic(lead.topic_id) : '待解析主题'}${lead.branch_id ? ` · ${friendlyTopic(lead.branch_id)}` : ''}${lead.snippet ? ` · ${escape(lead.snippet)}` : ''}</p></span><span class="chip">待核验</span></div>`).join('')}` : directSourceResearch ? `<p class="muted">权威 API 已运行，但没有可显示的定向记录。${directSourceResearch.queries.some((query) => query.status === 'failed') ? '部分来源请求失败，已保留状态。' : ''}</p>` : ''}
        ${webResearch?.leads.length ? '<h3 class="section-subtitle">外部检索线索</h3>' : ''}
        ${webResearch?.leads.length ? webResearch.leads.slice(0, 12).map((lead) => `<div class="list-row"><span><strong><a class="topic-link" href="${escape(lead.url)}" target="_blank" rel="noreferrer">${escape(lead.title)}</a></strong><p>${escape(lead.source_name)} · ${lead.topic_id ? friendlyTopic(lead.topic_id) : '命名核验'}${lead.snippet ? ` · ${escape(lead.snippet)}` : ''}</p></span><span class="chip">待核验</span></div>`).join('') : `<p class="muted">${webResearch?.status === 'unconfigured' ? researchCampaign ? '覆盖计划已生成，但外部检索服务尚未配置。可配置 Brave、Tavily 或 MCP Bridge；检索服务不会使用模型密钥。' : '外部检索服务尚未配置，且尚未生成覆盖计划。' : '尚未生成外部线索。'}</p>`}
        ${webResearch?.errors.length ? `<p class="small">${webResearch.errors.map(friendlyWebResearchError).join('；')}</p>` : ''}
      </section>
      ${deepSweep ? `<section class="panel wide-panel">
        <div class="panel-heading"><div><p class="eyebrow">多轮迭代深搜</p><h2>最近深度扫描</h2><p class="small">第 0 轮是源感知覆盖计划；后续轮次从上一轮线索确定性推导追问检索词，并重新进入同一套分诊 → 原文提取 → Intake 通道。所有结果始终只作待核验线索。</p></div><span class="state-pill ok">${deepSweep.totals.rounds} 轮 · ${deepSweep.totals.queries} 次检索 · ${deepSweep.totals.leads} 条线索</span></div>
        ${deepSweep.rounds.map((round) => `<div class="list-row"><span><strong>第 ${round.round} 轮</strong><p>${round.queries} 次检索 · ${round.leads} 条线索</p>${round.follow_up_queries.length ? `<p class="small">追问检索词：${round.follow_up_queries.slice(0, 8).map(escape).join('；')}</p>` : ''}</span></div>`).join('')}
        ${technicalDetails([['批次', deepSweep.sweep_id], ['覆盖任务数', String(deepSweep.campaign_task_count)], ['守卫检查', '线索仅作背景 · 轮数与检索词均有上限 · 不自动导入']])}
      </section>` : ''}
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
          <label class="agent-field"><span>启用深度搜索</span><input type="checkbox" name="deep_enabled" ${scheduler.deep_enabled ? 'checked' : ''}></label>
          <label class="agent-field"><span>深度搜索 cron</span><input name="deep_cron" value="${escape(scheduler.deep_cron)}" title="标准 5 段 cron（分 时 日 月 周）"></label>
          <label class="agent-field"><span>深扫追查轮数</span><input type="number" name="deep_max_rounds" value="${scheduler.deep_max_rounds}" min="1" max="20"></label>
          <label class="agent-field"><span>每轮追问检索词</span><input type="number" name="deep_queries_per_round" value="${scheduler.deep_queries_per_round}" min="1" max="50"></label>
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
  return ({ daily: '每日循环', quick: '快速循环', manual: '手动运行', deep: '深度搜索' } as Record<string, string>)[kind] ?? kind;
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
  const alerts = [...new Map(model.alerts.map((item) => [`${item.category}:${item.message}`, item])).values()].slice(0, 5);
  return pageShell('system', '系统', `
    ${systemNav('system')}
    <section class="hero-row"><div><p class="eyebrow">系统管理</p><h1>系统</h1><p class="lede">集中查看运行、来源、学习治理和方法说明。这里不会直接改变主题阶段。</p></div><span class="state-pill ${stateClass(system.pipeline_state)}">${stateLabel(system.pipeline_state)}</span></section>
    <section class="system-hub">
      ${systemHubCard('/runs', '运行状态', '研究处理流程、模型服务、备用规则与运行历史', friendlyDate(system.last_successful_run))}
      ${systemHubCard('/sources', '数据源', '来源目录、同步、变化状态与研究闭环', model.source_sync ? `${model.source_sync.completed_operation_count}/${model.source_sync.requested_operation_count} 最近同步` : '尚未同步')}
      ${systemHubCard('/governance', '学习治理', '规则保护、主动学习、晋级门槛与改进提案', model.learning_profile_version ? '已有学习记录' : '尚未生成学习记录')}
      ${systemHubCard('/methodology', '方法论', '阶段门槛、数据可信度与对照量化规则', '可查看研究方法')}
    </section>
    ${alerts.length ? `<section class="panel" style="margin-top:18px"><div class="panel-heading"><div><p class="eyebrow">需要关注</p><h2>系统提醒</h2><p class="small">运行、规则与历史一致性问题集中在这里，不占用研究材料审核队列。</p></div><a class="text-link" href="/governance">查看治理详情</a></div>${alerts.map((alert) => `<div class="list-row"><strong>${escape(queueCategoryLabel('guardrail_alert'))} · ${escape(alert.category)}</strong><p>${friendlyReason(alert.message)}</p></div>`).join('')}</section>` : ''}`);
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

  // A catalog entry is a declared capability, not evidence of a configured
  // connector. Keep actual status visible instead of assuming it is live.
  const catalogEntries = Object.values(WORLDMONITOR_SOURCE_CATALOG);
  const totalCount = Math.max(catalogEntries.length, operations.length);

  const roster = catalogEntries.map((cat) => {
    const matchedOp = operations.find((o) =>
      o.operation_id.toLowerCase().includes(cat.source_id.toLowerCase().replace(/_/g, ''))
      || o.service.toLowerCase().includes(cat.source_id.toLowerCase().replace(/_/g, ''))
      || o.summary.toLowerCase().includes(cat.source_name.toLowerCase().substring(0, 8))
    );
    return {
      id: cat.source_id,
      name: cat.source_name,
      domain: cat.domain,
      source_type: cat.source_type,
      primary_layer: cat.primary_layer,
      secondary_layers: cat.secondary_layers,
      strength: cat.default_evidence_strength,
      event_type: cat.default_event_type,
      stage_effect: cat.default_stage_effect,
      url: matchedOp?.production_url ?? matchedOp?.governance?.terms_url ?? 'worldmonitor://direct-api',
      normalizer: matchedOp?.normalizer_id ?? 'direct_stream',
      status: matchedOp?.access_state ?? 'cataloged_not_connected',
    };
  });

  // NOTE: the UI groups sources into five display buckets. `official` is a
  // display bucket, not a WorldMonitorDomain value (the catalog classifies
  // regulators under financial/geopolitics), so it currently counts 0 until the
  // taxonomy is reconciled. Comparisons are widened to string to stay type-safe
  // without inventing a domain value.
  const domainOf = (r: { domain: string }) => r.domain;
  const domainCounts = {
    all: roster.length,
    financial: roster.filter((r) => domainOf(r) === 'financial').length,
    technology: roster.filter((r) => domainOf(r) === 'technology').length,
    research: roster.filter((r) => domainOf(r) === 'research').length,
    official: roster.filter((r) => domainOf(r) === 'official').length,
    geopolitics: roster.filter((r) => domainOf(r) === 'geopolitics').length,
  };

  const domainLabelMap: Record<string, string> = {
    financial: '💰 财经金融',
    technology: '⚡ 前沿科技',
    research: '🔬 学术科研',
    official: '🏛️ 官方监管',
    geopolitics: '🌐 宏观地缘',
  };

  const layerTagMap: Record<string, string> = {
    pricing: '<span class="chip" style="border-color:#a3be8c;color:#a3be8c;">✨ 定价层</span>',
    capital: '<span class="chip" style="border-color:#ebcb8b;color:#ebcb8b;">💎 资本层</span>',
    reality: '<span class="chip" style="border-color:#88c0d0;color:#88c0d0;">⚙️ 现实层</span>',
    name: '<span class="chip" style="border-color:#81a1c1;color:#81a1c1;">🏷️ 命名层</span>',
    friction: '<span class="chip" style="border-color:#bf616a;color:#bf616a;">🛡️ 摩擦层</span>',
    perception: '<span class="chip" style="border-color:#b48ead;color:#b48ead;">🔭 认知层</span>',
  };

  const strengthBadgeMap: Record<string, string> = {
    E4: '<span class="state-pill ok" style="font-size:10px;">E4 · 权威事实</span>',
    E3: '<span class="state-pill ok" style="font-size:10px;border-color:#88c0d0;color:#88c0d0;">E3 · 机构共识</span>',
    E2: '<span class="state-pill warn" style="font-size:10px;">E2 · 市场确证</span>',
    E1: '<span class="state-pill muted-state" style="font-size:10px;">E1 · 线索信号</span>',
  };

  return pageShell('sources', '数据源与全球情报', `
    ${systemNav('sources')}
    <section class="hero-row">
      <div>
        <p class="eyebrow">情报与数据资产</p>
        <h1>情报源与接入状态</h1>
        <p class="lede">这里只展示本系统已注册的来源及其真实连接状态。来源目录不等于已接入，更不等于已成为正式证据。</p>
      </div>
      <span class="state-pill ${liveReadyCount ? 'ok' : 'muted-state'}" style="font-size:12px;padding:6px 12px;">${liveReadyCount ? `${liveReadyCount} 个已配置连接器` : '尚无已配置连接器'}</span>
    </section>

    <section class="system-strip">
      ${compactStatus('系统来源目录', String(totalCount) + ' 项', 'operational')}
      ${compactStatus('已配置连接器', String(liveReadyCount) + ' 项', liveReadyCount ? 'operational' : 'review_required')}
      ${compactStatus('待治理审核', String(governanceReviewCount) + ' 项', governanceReviewCount ? 'review_required' : 'operational')}
    </section>

    <!-- Interactive 63 Source Roster -->
    <section class="panel wide-panel" style="margin-bottom: 24px;">
      <div class="panel-heading" style="flex-wrap: wrap;">
        <div>
          <p class="eyebrow">数据大动脉</p>
          <h2>系统来源目录</h2>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <input id="source-search-input" type="text" placeholder="🔍 实时搜索源名称 / 机构 / 领域 / URL..." oninput="filterSources()" style="width:320px;padding:8px 12px;background:var(--nav);border:1px solid var(--line);border-radius:3px;color:var(--ink);font-size:12px;outline:none;" />
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="section-nav" style="margin: 0 0 16px 0; border-bottom: 1px solid var(--line); gap: 8px;">
        <a href="javascript:void(0)" class="active source-tab-btn" onclick="setSourceCategory('all', this)">全部 (${domainCounts.all})</a>
        <a href="javascript:void(0)" class="source-tab-btn" onclick="setSourceCategory('financial', this)">顶级财经与投研 (${domainCounts.financial})</a>
        <a href="javascript:void(0)" class="source-tab-btn" onclick="setSourceCategory('technology', this)">前沿科技与创投 (${domainCounts.technology})</a>
        <a href="javascript:void(0)" class="source-tab-btn" onclick="setSourceCategory('research', this)">权威学术与文献 (${domainCounts.research})</a>
        <a href="javascript:void(0)" class="source-tab-btn" onclick="setSourceCategory('official', this)">官方监管与申报 (${domainCounts.official})</a>
        <a href="javascript:void(0)" class="source-tab-btn" onclick="setSourceCategory('geopolitics', this)">宏观与地缘情绪 (${domainCounts.geopolitics})</a>
      </div>

      <div class="table-scroll" style="max-height: 750px; overflow-y: auto;">
        <table id="source-roster-table">
          <thead>
            <tr>
              <th style="width:240px;">情报源名称 / 机构</th>
              <th style="width:120px;">战略领域</th>
              <th style="width:140px;">叙事核心层级</th>
              <th style="width:120px;">证据等级</th>
              <th style="width:160px;">事件类型 / 解析流</th>
              <th>目录端点 / 条款页</th>
              <th style="width:90px;">运行状态</th>
            </tr>
          </thead>
          <tbody>
            ${roster.map((item) => `
              <tr class="source-item-row" data-domain="${item.domain}" data-text="${escape((item.name + ' ' + item.url + ' ' + item.domain + ' ' + item.event_type).toLowerCase())}">
                <td>
                  <strong style="color:#eceff4;font-size:12px;">${escape(item.name)}</strong>
                  <small style="color:var(--muted);display:block;margin-top:2px;">来源编号：${escape(item.id)}</small>
                </td>
                <td><span style="font-size:11px;font-weight:600;">${domainLabelMap[item.domain] ?? item.domain}</span></td>
                <td>
                  ${layerTagMap[item.primary_layer] ?? item.primary_layer}
                  ${item.secondary_layers.slice(0, 1).map((l) => `<span style="font-size:9px;color:var(--muted);margin-left:4px;">+${l}</span>`).join('')}
                </td>
                <td>${strengthBadgeMap[item.strength] ?? item.strength}</td>
                <td><code style="font-size:10px;background:var(--nav);padding:2px 5px;border-radius:2px;color:var(--accent);">${escape(item.event_type)}</code></td>
                <td>
                  <a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:none;font-size:11px;word-break:break-all;font-family:ui-monospace,monospace;">
                    ${escape(item.url.length > 55 ? item.url.substring(0, 55) + '...' : item.url)}
                  </a>
                </td>
                <td><span class="state-pill ${item.status === 'production_ready' ? 'ok' : 'muted-state'}" style="font-size:9px;">${item.status === 'production_ready' ? '已配置' : '仅目录'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Action & Status Panels -->
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">来源控制</p><h2>盘点与同步调度</h2></div></div>
        <p class="muted">仅“已配置”且通过治理检查的连接器可以同步。来源目录、外部审计记录和搜索结果都不会自动写入正式证据；每条材料仍须经过引用、主题/分支、去重与 Evidence Gate。</p>
        <div class="action-row" style="margin-top: 16px;">
          <button class="button secondary" type="button" onclick="sourceAction('inventory')">刷新已注册来源目录</button>
          <button class="button primary" type="button" onclick="sourceAction('live')">同步已配置来源</button>
        </div>
        <p id="source-action-status" class="small" role="status" style="margin-top: 8px;"></p>
      </section>

      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">数据治理</p><h2>证据等级与门槛映射</h2></div></div>
        <dl class="fact-list">
          <dt>E4 权威事实</dt><dd>万得 (Wind)、中金研报、SEC EDGAR、工信部、PubMed</dd>
          <dt>E3 机构共识</dt><dd>华尔街日报、路透社、财联社、新时空研究院、Investing 分析</dd>
          <dt>E2 市场确证</dt><dd>TechCrunch、36Kr、新时空科技/ETF、Investing 股市</dd>
          <dt>E1 信号线索</dt><dd>Hacker News、GitHub Trending、CoinGecko、大众舆情</dd>
        </dl>
      </section>
    </div>

    <script>
      let currentCategory = 'all';

      function setSourceCategory(cat, el) {
        currentCategory = cat;
        document.querySelectorAll('.source-tab-btn').forEach(btn => btn.classList.remove('active'));
        if (el) el.classList.add('active');
        filterSources();
      }

      function filterSources() {
        const query = (document.getElementById('source-search-input')?.value || '').toLowerCase().trim();
        const rows = document.querySelectorAll('.source-item-row');
        rows.forEach(row => {
          const domain = row.getAttribute('data-domain');
          const text = row.getAttribute('data-text') || '';
          const matchCat = currentCategory === 'all' || domain === currentCategory;
          const matchQuery = !query || text.includes(query);
          if (matchCat && matchQuery) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      }

      async function sourceAction(action) {
        const status = document.getElementById('source-action-status');
        status.textContent = '正在全网采集与同步中…';
        const endpoint = action === 'inventory' ? '/api/sources/inventory' : '/api/sources/sync';
        const body = action === 'inventory' ? {} : { mode: action, max_operations: 50, max_candidates: 100 };
        try {
          const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'request failed');
          status.textContent = '采集完成，正在刷新大盘…';
          location.reload();
        } catch (error) {
          status.textContent = '执行失败：' + error.message;
        }
      }
    </script>
  `);
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
          <div><p class="eyebrow">已核验的阶段变化</p><h2>阶段演化与证据链</h2></div>
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
        <p class="gate-lede">四道硬门槛决定阶段上限：每达成一道，主题才能进入下一阶段。实心=已达成，空心=尚缺证据。</p>
        <div class="radar-wrap">
          <svg class="radar-svg" viewBox="0 0 260 260" role="img" aria-label="四道量化门槛雷达图"></svg>
        </div>
        <div class="gate-checklist" id="gate-checklist-root"></div>
        <p id="radar-empty-note" class="muted" style="display:none; margin-top: 10px;">尚无母主题证据表，四道量化门槛暂无法绘制。分支证据单独展示，且不会抬高父主题。</p>
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
            const escapeTimeline = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
            const historyStatus = (status) => ({
              verified: '历史链路已核验',
              partial: '历史证据不完整',
              insufficient: '历史材料待核验',
              no_parent_evidence: '尚无母主题证据'
            })[status] || '历史状态待确认';
            const historySummary = (history) => '<div class="timeline-integrity ' + escapeTimeline(history.history_status) + '">' +
              '<strong>' + historyStatus(history.history_status) + '</strong><span>' + escapeTimeline(history.history_status_reason || '') + '</span>' +
              '<small>可用于重建的母主题证据 ' + escapeTimeline(history.eligible_parent_evidence_count ?? 0) + ' 条；排除 ' + escapeTimeline((history.excluded_evidence || []).length) + ' 条。</small>' +
            '</div>';
            if (topicHistory && topicHistory.transitions && topicHistory.transitions.length > 0) {
              root.innerHTML = historySummary(topicHistory) + topicHistory.transitions.map(evt => {
                const gap = evt.transition_kind === 'historical_evidence_gap';
                const regression = evt.transition_kind === 'confidence_regression';
                const gate = evt.gate_unlocked || '';
                const missing = (evt.missing_intermediate_stages || []).join('、');
                const gatesHtml = gap
                  ? '<div class="timeline-gates"><span class="timeline-gate pending">历史证据缺口：' + escapeTimeline(missing || '前序阶段') + '</span></div>'
                  : (gate ? '<div class="timeline-gates"><span class="timeline-gate ' + (regression ? 'warning' : 'unlocked') + '">' + escapeTimeline(gate) + '</span></div>' : '');
                const title = evt.trigger_evidence_title || '未命名证据';
                const stageNote = gap ? '（观测到跨阶段，未补造中间阶段）' : regression ? '（信息完整度变化）' : '';
                const src = '<p class="small" style="margin:0;color:var(--muted)">' + escapeTimeline(evt.trigger_evidence_url || '来源链接缺失') + '</p>';
                return '<div class="timeline-event ' + (gap ? 'historical-gap' : regression ? 'regression' : 'milestone') + '">' +
                  '<span class="timeline-date">事件发生：' + escapeTimeline(String(evt.transition_date).split('T')[0]) + '</span>' +
                  '<div class="timeline-content">' +
                    '<span class="timeline-stage">' + escapeTimeline(evt.from_stage) + ' → ' + escapeTimeline(evt.to_stage) + stageNote + '</span>' +
                    '<h3 class="timeline-title">' + escapeTimeline(title) + '</h3>' +
                    src +
                    gatesHtml +
                  '</div>' +
                '</div>';
              }).join('');
            } else if (topicHistory) {
              root.innerHTML = historySummary(topicHistory) + '<p class="muted">尚无可核验的阶段变化。请补充带来源、摘要、解释和限制说明的母主题证据。</p>';
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
            // /api/monitor returns the NarrativeMonitorModel with topics at the
            // top level, not under a snapshot envelope.
            const topics = data.topics || [];
            const t = topics.find(t => t.topic_id === topicId);
            const gate = t?.gate_input;

            const svg = document.querySelector('.radar-svg');
            const emptyNote = document.getElementById('radar-empty-note');
            const checklist = document.getElementById('gate-checklist-root');
            if (!gate && svg) {
              // No parent Evidence Table: show why the radar is empty instead of
              // a blank box.
              if (emptyNote) emptyNote.style.display = 'block';
              svg.style.display = 'none';
              if (checklist) checklist.style.display = 'none';
            }
            if (gate && svg) {
              if (emptyNote) emptyNote.style.display = 'none';

              // Four quantitative gates, ordered by the stage each unlocks.
              const GATES = [
                { key: 'hasStableLabel', pillar: '名', name: '稳定标签', unlocks: 'S3', desc: '标签清晰、语言共享' },
                { key: 'hasCapitalConfirmation', pillar: '资', name: '资本确认', unlocks: 'S4', desc: '龙头、量能、资金持续' },
                { key: 'hasPricingAdoption', pillar: '价', name: '预期采纳', unlocks: 'S5', desc: '估值重构、机构建模' },
                { key: 'hasHardRealityEvidence', pillar: '实', name: '硬现实', unlocks: 'S6', desc: '订单、收入、审批、交付' },
              ];

              // Radar geometry in a 260x260 viewBox with a generous margin so
              // labels never overflow the panel.
              const cx = 130, cy = 132, rMax = 74, rMin = 20;
              const angles = [ -Math.PI/2, 0, Math.PI/2, Math.PI ]; // top,right,bottom,left
              const passed = GATES.map(g => Boolean(gate[g.key]));

              // Concentric guide rings.
              let rings = '';
              [0.34, 0.67, 1].forEach(f => {
                const pts = angles.map(a => (cx + rMax*f*Math.cos(a)).toFixed(1) + ',' + (cy + rMax*f*Math.sin(a)).toFixed(1)).join(' ');
                rings += '<polygon points="' + pts + '" class="radar-ring" />';
              });
              // Axes + labels (label boxes kept inside the viewBox).
              let axes = '';
              const anchors = ['middle','start','middle','end'];
              const dy = [ -12, 4, 20, 4 ];
              angles.forEach((a, i) => {
                const ax = cx + rMax*Math.cos(a), ay = cy + rMax*Math.sin(a);
                axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + ax.toFixed(1) + '" y2="' + ay.toFixed(1) + '" class="radar-axis" />';
                const lx = cx + (rMax+14)*Math.cos(a), ly = cy + (rMax+14)*Math.sin(a);
                axes += '<text x="' + lx.toFixed(1) + '" y="' + (ly+dy[i]/3).toFixed(1) + '" text-anchor="' + anchors[i] + '" class="radar-label ' + (passed[i]?'on':'off') + '">' + GATES[i].pillar + ' ' + GATES[i].name + '</text>';
                axes += '<text x="' + lx.toFixed(1) + '" y="' + (ly+dy[i]/3+11).toFixed(1) + '" text-anchor="' + anchors[i] + '" class="radar-sub">→ ' + GATES[i].unlocks + '</text>';
              });
              // Data polygon + points.
              let dots = '';
              const poly = angles.map((a, i) => {
                const r = passed[i] ? rMax : rMin;
                const x = cx + r*Math.cos(a), y = cy + r*Math.sin(a);
                dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" class="radar-point ' + (passed[i]?'on':'off') + '" />';
                return x.toFixed(1) + ',' + y.toFixed(1);
              }).join(' ');
              svg.innerHTML = rings + axes + '<polygon points="' + poly + '" class="radar-polygon" />' + dots;

              // Plain-language gate checklist beneath the radar.
              if (checklist) {
                checklist.style.display = 'grid';
                checklist.innerHTML = GATES.map((g, i) => {
                  const ok = passed[i];
                  return '<div class="gate-row ' + (ok?'on':'off') + '">' +
                    '<span class="gate-mark">' + (ok?'●':'○') + '</span>' +
                    '<span class="gate-name"><strong>' + g.pillar + ' · ' + g.name + '</strong><small>' + g.desc + '</small></span>' +
                    '<span class="gate-unlock">' + g.unlocks + '</span>' +
                    '<span class="gate-state ' + (ok?'ok':'todo') + '">' + (ok?'已达成':'待证据') + '</span>' +
                  '</div>';
                }).join('') +
                '<p class="gate-foot">独立来源 ' + (gate.independentSourceCount ?? 0) + ' 个 · 阶段上限取决于最后一道未达成的门槛。</p>';
              }
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
    <section class="hero-row"><div><p class="eyebrow">研究工作台</p><h1>待确认研究事项</h1><p class="lede">这里只放现在能处理的材料、主题关系与早期线索。系统告警和历史运行问题请在“系统”查看。</p></div><a class="button primary" href="/intake">录入新材料</a></section>
    <section class="panel"><div class="panel-heading"><div><p class="eyebrow">证据审核</p><h2>需要处理的候选材料</h2><p class="small">同一材料的重复检测、引用不足和发布限制会合并显示为一项。</p></div><span class="count">${model.review_queue.length}</span></div>
      ${model.review_queue.length ? model.review_queue.map((item) => `<a class="review-row" href="${item.href}"><span class="state-pill ${item.priority === 'high' ? 'bad' : item.priority === 'medium' ? 'warn' : 'muted-state'}">${priorityLabel(item.priority)}</span><div><strong>${escape(queueCategoryLabel(item.category))} · ${queueItemTitle(item.title)}</strong><p>${friendlyReason(item.reason)}</p></div><span>→</span></a>`).join('') : '<p class="muted">当前没有需要人工处理的候选材料。</p>'}
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
      ${formulaPanel('1. 单条证据质量', mathFormula('q_e = 100 × w(E) × a(source) × c × 2^(-age/h)', '<var>q</var><sub>e</sub> = 100 × <var>w</var>(<var>E</var>) × <var>a</var>(source) × <var>c</var> × 2<sup>−age / h</sup>'), 'E0-E4 强度、来源权威、字段置信度和时间半衰期共同决定证据质量。默认 h = 180 天；E0 的贡献恒为 0。')}
      ${formulaPanel('2. 维度支持度', mathFormula('Q_l = 100 × [1 − product_s(1 − max(q_e,s)/100)]', '<var>Q</var><sub>l</sub> = 100 × [1 − ∏<sub>s</sub>(1 − max(<var>q</var><sub>e,s</sub>) / 100)]'), '同一来源只保留该维度的最强证据，防止转载和重复记录刷分；不同独立来源使用合并概率方式聚合。正负证据分别计算。')}
      ${formulaPanel('3. 数据可信度', mathFormula('C = 0.25B + 0.25A + 0.20R + 0.15X + 0.15L', '<var>C</var> = 0.25<var>B</var> + 0.25<var>A</var> + 0.20<var>R</var> + 0.15<var>X</var> + 0.15<var>L</var>'), 'B=来源广度，A=来源权威，R=时效性，X=正反证据覆盖，L=六层覆盖。缺失不是负面证据，只降低 C 并触发阶段上限。')}
      ${formulaPanel('4. 当前阶段', mathFormula('S_current = min(S_requested, S_gate, S_confidence)', '<var>S</var><sub>current</sub> = min(<var>S</var><sub>requested</sub>, <var>S</var><sub>gate</sub>, <var>S</var><sub>confidence</sub>)'), '阶段门槛依次要求稳定标签、资本确认、预期采纳和硬现实证据；数据可信度可施加上限。整体主题与细分分支分别计算，分支的高阶段不能进入整体主题公式。')}
      ${formulaPanel('5. 阶段转换成熟度', mathFormula('R_t = 100 × G × (C/100) × (1 − F/100)', '<var>R</var><sub>t</sub> = 100 × <var>G</var> × (<var>C</var> / 100) × (1 − <var>F</var> / 100)'), 'G=按阶段门槛权重计算的完成度，F=摩擦支持度。它是尚未完成经验校准的参考指数，不是跃迁概率；需要历史回放结果才能校准。')}
      ${formulaPanel('6. 叙事变化幅度', mathFormula('Delta N = 0.20Q + 0.25G_delta + 0.20M + 0.15B_mu + 0.10E + 0.10C', 'Δ<var>N</var> = 0.20<var>Q</var> + 0.25<var>G</var><sub>Δ</sub> + 0.20<var>M</var> + 0.15<var>B</var><sub>μ</sub> + 0.10<var>E</var> + 0.10<var>C</var>'), 'Q=新证据质量，GΔ=门槛影响，M=旧缺口填补，Bμ=分支演变，E=预期重置。必须先查询叙事记忆；记忆不足时不输出数值。')}
      ${formulaPanel('7. 智能解析优化分', mathFormula('O = 0.80Q + 0.20E', '<var>O</var> = 0.80<var>Q</var> + 0.20<var>E</var>'), 'Q=质量分，已包含无依据判断、整体主题/分支误判和 E3/E4 夸大的惩罚；E=成本与时延效率。硬阻断不从 O 中扣分，而是直接禁止晋级。')}
      ${formulaPanel('8. 成本与熔断', mathFormula('Cost = (T_in P_in + T_out P_out) / 10^6', '<var>Cost</var> = (<var>T</var><sub>in</sub><var>P</var><sub>in</sub> + <var>T</var><sub>out</sub><var>P</var><sub>out</sub>) / 10<sup>6</sup>'), '单次成本超预算、连续失败≥3、滚动错误率>20%、流量达到基线5倍或重试耗尽时立即熔断并回退规则候选。价格通过配置输入，不在代码中猜测。')}
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
    : active === 'changes' ? 'overview'
    : active === 'agent' ? 'agent'
    : ['system', 'runs', 'sources', 'methodology', 'governance'].includes(active) ? 'system'
      : active;
  const nav = (key: string, label: string, href: string) => {
    const current = activeGroup === key;
    return `<a class="nav-link ${current ? 'active' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a>`;
  };
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · 叙事生命周期研究系统</title><style>${styles()}</style></head><body>
  <header class="topbar"><a class="brand" href="/"><span class="brand-mark">N</span><span>叙事生命周期</span></a><nav aria-label="主导航">${nav('overview','总览','/')}${nav('topics','主题','/topics')}${nav('queue','研究工作台','/queue')}${nav('agent','自动化','/agent')}${nav('system','系统','/system')}</nav><a class="nav-action" href="/intake">＋ 录入材料</a><span class="trust">研究者确认模式</span></header>
  <main class="app">${body}</main></body></html>`;
}

function researchQueueNav(active: 'queue' | 'inbox'): string {
  return `<nav class="section-nav" aria-label="研究队列导航">
    <a class="${active === 'queue' ? 'active' : ''}" href="/queue">待审核材料</a>
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
  return `<section class="panel formula-panel"><h2>${escape(title)}</h2><div class="formula" role="math">${formula}</div><p>${escape(explanation)}</p></section>`;
}

function mathFormula(ariaLabel: string, html: string): string {
  return `<span class="math-expression" aria-label="${escape(ariaLabel)}">${html}</span>`;
}

function metricGrid(model: NarrativeMonitorModel): string {
  const changed = model.changes.filter((item) => item.change_type !== 'no_change').length;
  const imported = model.research_agent?.last_run?.metrics?.imported_evidence_count ?? model.metrics.evidence_added_count;
  const pendingProposals = model.topic_discovery_proposals.filter((item) => item.status === 'pending').length + model.evidence_chain.filter((item) => item.status === 'candidate').length;
  const distinctAlerts = new Set(model.alerts.map((item) => `${item.category}:${item.message}`)).size;
  const values = [['待审核材料', model.review_queue.length], ['主题关系建议', pendingProposals], ['早期线索', model.early_radar.length], ['本轮已入库', imported], ['主题变化', changed], ['系统提醒', distinctAlerts]];
  return `<section class="metric-grid">${values.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('')}</section>`;
}

function systemStatusBar(model: NarrativeMonitorModel): string {
  const system = model.system;
  return `<section class="system-strip">
    ${compactStatus('最近成功更新', friendlyDate(system.last_successful_run), system.pipeline_state)}
    ${compactStatus('智能解析服务', system.provider_state === 'not_configured' ? '尚未配置' : stateLabel(system.provider_state), system.provider_state)}
    ${compactStatus('数据新鲜度', freshnessLabel(system.data_freshness), system.data_freshness === 'fresh' ? 'operational' : system.data_freshness)}
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
function queueItemTitle(value: string): string {
  return escape(value.split(' · ').map(displayNameText).join(' · '));
}
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
function reviewStatusLabel(value: string): string { return ({ pending_review: '等待校验', reviewed: '已完成校验', auto_published: '已自动入库' } as Record<string, string>)[value] ?? '校验状态待确认'; }
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
    .replace(/Possible duplicate of [^.]+\./g, '与已有正式证据可能重复。')
    .replaceAll('duplicate Evidence ID is already present', '证据编号已存在，系统未重复导入。')
    .replace(/Matched canonical topic [^.]+\./g, '已匹配现有主题。')
    .replaceAll('E1 automatic publication is limited to rule-verified original-source candidates', '自动入库仅适用于已核验的原始来源 E1 证据。')
    .replaceAll('evidence strength E0 is below policy minimum E1', '证据强度尚未达到自动入库门槛。')
    .replaceAll('confidence low is below policy minimum medium', '信息可靠度低于自动入库所需门槛。')
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
function queueCategoryLabel(value: string): string { return ({ parent_branch_conflict: '整体主题与分支冲突', high_strength: 'E3 / E4 高强度判断', new_topic: '待确认的新主题', topic_discovery: '主题发现提案', evidence_chain_update: '证据链更新提案', evidence_publication_review: '待发布证据复核', new_branch: '新分支', reactivation: '旧主题重新活跃', agent_rule_disagreement: '智能解析与规则存在差异', low_citation_confidence: '引用可靠度偏低', possible_duplicate: '可能重复', unsupported_claim: '原文不支持的判断', ordinary_candidate: '普通候选', guardrail_alert: '规则保护提醒' } as Record<string, string>)[value] ?? '其他待审核事项'; }
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
.timeline-integrity { display: grid; gap: 5px; margin: 0 0 18px -20px; padding: 10px 12px; border-left: 3px solid var(--accent); background: var(--nav); color: var(--muted); font-size: 12px; }
.timeline-integrity strong { color: #eceff4; font-size: 13px; }
.timeline-integrity.partial, .timeline-integrity.insufficient { border-left-color: var(--amber); }
.timeline-integrity.no_parent_evidence { border-left-color: #bf616a; }
.timeline-integrity small { color: var(--muted); }
.timeline-event { position: relative; margin-bottom: 24px; }
.timeline-event::before { content: ''; position: absolute; left: -26px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); }
.timeline-event.milestone::before { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 8px rgba(136,192,208,0.6); }
.timeline-event.historical-gap::before { background: var(--nav); border-color: var(--amber); border-style: dashed; }
.timeline-event.historical-gap .timeline-content { border-style: dashed; border-color: var(--amber); }
.timeline-event.historical-gap .timeline-stage { background: transparent; border: 1px dashed var(--amber); color: var(--amber); }
.timeline-event.regression::before { background: #bf616a; border-color: #bf616a; }
.timeline-gate.pending { border-style: dashed; border-color: var(--amber); color: var(--amber); }
.timeline-date { font-size: 11px; color: var(--accent); font-weight: 600; margin-bottom: 4px; display: block; }
.timeline-content { background: var(--nav); padding: 12px; border-radius: 3px; border: 1px solid var(--line); }
.timeline-stage { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; background: var(--accent-soft); color: var(--accent); margin-bottom: 6px; }
.timeline-title { font-size: 13px; color: #eceff4; font-weight: 500; margin: 0 0 6px 0; }
.timeline-gates { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.timeline-gate { font-size: 9px; text-transform: uppercase; padding: 2px 4px; border-radius: 2px; border: 1px solid #4c566a; color: var(--muted); }
.timeline-gate.unlocked { border-color: #a3be8c; color: #a3be8c; }
.timeline-gate.warning { border-color: #bf616a; color: #bf616a; }

.gate-lede { margin: 0 0 12px; color: var(--muted); font-size: 11px; line-height: 1.6; }
.radar-wrap { width: 100%; max-width: 300px; margin: 0 auto; }
.radar-svg { display: block; width: 100%; height: auto; overflow: hidden; }
.radar-ring { fill: none; stroke: var(--line); stroke-width: 1; opacity: 0.5; }
.radar-axis { stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; }
.radar-polygon { fill: rgba(136, 192, 208, 0.18); stroke: var(--accent); stroke-width: 2; transition: all 0.3s ease; }
.radar-point.on { fill: var(--accent); stroke: var(--nav); stroke-width: 2; }
.radar-point.off { fill: var(--nav); stroke: #4c566a; stroke-width: 2; }
.radar-label { font-size: 11px; font-weight: 600; }
.radar-label.on { fill: var(--accent); }
.radar-label.off { fill: #6b7280; }
.radar-sub { font-size: 9px; fill: var(--muted); text-anchor: inherit; }
.gate-checklist { display: grid; gap: 6px; margin-top: 16px; }
.gate-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 4px; background: var(--nav); }
.gate-row.on { border-color: rgba(163, 190, 140, 0.4); }
.gate-mark { flex: 0 0 auto; font-size: 13px; line-height: 1; }
.gate-row.on .gate-mark { color: #a3be8c; }
.gate-row.off .gate-mark { color: #4c566a; }
.gate-name { flex: 1 1 auto; min-width: 0; display: grid; gap: 1px; }
.gate-name strong { font-size: 12px; color: #eceff4; font-weight: 500; white-space: nowrap; }
.gate-name small { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gate-unlock { flex: 0 0 auto; font-size: 11px; font-weight: 600; color: var(--accent); font-family: ui-monospace, monospace; }
.gate-state { flex: 0 0 auto; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; }
.gate-state.ok { color: #a3be8c; border-color: #a3be8c; }
.gate-state.todo { color: var(--muted); border-color: #4c566a; }
.gate-foot { margin: 8px 0 0; font-size: 10px; color: var(--muted); line-height: 1.5; }

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
.system-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.formula-panel .formula { display: flex; align-items: center; min-height: 58px; overflow-x: auto; padding: 12px 16px; border: 1px solid var(--line); border-radius: 3px; background: var(--nav); color: #b7e3ee; font: 500 18px/1.45 "Cambria Math", "STIX Two Math", Cambria, serif; letter-spacing: 0; white-space: nowrap; }
.math-expression { display: inline-block; }
.math-expression var { font-style: italic; }
.math-expression sub, .math-expression sup { position: relative; font-size: .68em; line-height: 0; vertical-align: baseline; }
.math-expression sub { bottom: -.28em; }
.math-expression sup { top: -.5em; }
`; }

function renderActiveProbes(campaign: import('@/features/research/types/research_coverage').ResearchCampaign | null, directResearch: import('@/features/research/types/direct_source_research').DirectSourceResearchReport | null): string {
  const probes = campaign?.tasks.filter((t) => t.deep_probe_target) ?? [];
  if (probes.length === 0) return '';
  return `
    <section class="panel wide-panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">主动探针 (Active Probes)</p>
          <h2>定点挖掘执行结果</h2>
          <p class="small">系统为了突破阶段瓶颈，自动调用的定点高优探针。这些探针专门针对官方公告或公司一次信息源进行深挖。</p>
        </div>
      </div>
      ${probes.map(probe => {
        const leads = directResearch?.leads.filter(l => l.task_id === probe.task_id) ?? [];
        return `<div class="list-row alert" style="margin-bottom: 8px;">
          <div>
            <strong>针对 ${escape(probe.display_name_zh)} 的深度探针</strong>
            <p>${escape(probe.deep_probe_target!.rationale)}</p>
            <p class="small muted">发现 ${leads.length} 条相关深度线索 (目标源: ${probe.deep_probe_target!.suggested_source_ids.join(', ')})</p>
          </div>
          <span class="chip warn">Deep Mining Active</span>
        </div>`;
      }).join('')}
    </section>
  `;
}
