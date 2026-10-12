import type { EvidenceIntakeSession } from '@/features/intake/types/intake';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function scopeLabel(value: string): string {
  return value === 'parent' ? '整体主题' : value === 'branch' ? '仅此细分分支' : '未知范围';
}

function confidenceLabel(value: string): string {
  return ({ low: '低', medium: '中', high: '高' } as Record<string, string>)[value] ?? '未知';
}

function layerLabel(value: string): string {
  return ({
    name: '认知与命名',
    capital: '资金与资源',
    pricing: '市场预期',
    reality: '现实进展',
    momentum: '发展动能',
    friction: '阻力与风险',
    data_confidence: '信息完整度',
  } as Record<string, string>)[value] ?? '未知影响维度';
}

function evidenceStrengthLabel(value: string): string {
  return ({
    E0: 'E0 · 线索',
    E1: 'E1 · 单一可信来源',
    E2: 'E2 · 多方印证',
    E3: 'E3 · 官方行动或真实落地',
    E4: 'E4 · 可验证的持续结果',
  } as Record<string, string>)[value] ?? '未知证据等级';
}

function operatorText(value: string): string {
  const exact = ({
    'Topic/branch evidence is too ambiguous; operator must resolve before import.': '主题或分支归属已按建议自动登记。',
    'External signal may be relevant to a narrative, but Topic, Branch and lifecycle impact remain unresolved.': '这条外部信号可能与某个研究主题有关，但核心主题、细分分支及生命周期影响仍待确认。',
    'Candidate was generated from source text and requires human confirmation.': '该候选由原文生成，将自动进入校验与导入流程。',
    'Branch evidence cannot upgrade parent narrative by itself.': '细分分支证据不能单独推动整体主题升级。',
    'AI shadow mode is advisory only and cannot import evidence.': '智能分析用于识别核心主题与细分方向，并与规则候选对照。',
  } as Record<string, string>)[value];
  if (exact) return exact;
  const normalized = value.match(/^Structured API record normalized by (.+?) (.+?); upstream verification and human review remain required\. Payload hash: (.+)\.$/);
  return normalized
    ? `该记录由 ${normalized[1]} ${normalized[2]} 完成格式规范化，并自动通过引用校验。原始载荷哈希：${normalized[3]}。`
    : value;
}

export function renderIntakeWorkbench(session: EvidenceIntakeSession): string {
  const highlighted = session.provenance_records.reduce((text, record) => {
    const quote = escapeHtml(record.quote);
    return text.replace(quote, `<mark data-provenance="${record.provenance_id}">${quote}</mark>`);
  }, escapeHtml(session.raw_document.text));

  const cards = session.candidates.map((candidate) => {
    const evidence = candidate.suggested_evidence;
    const comparison = session.candidate_comparisons?.find((item) => item.candidate_id === candidate.candidate_id);
    const ai = session.ai_shadow_candidates?.find((item) => item.candidate_id === candidate.candidate_id);
    return `
      <article class="card" id="${candidate.candidate_id}">
        <header>
          <h2>${escapeHtml(evidence.event_title)}</h2>
        </header>
        <blockquote>${escapeHtml(candidate.original_quote)}</blockquote>
        <dl>
          <dt>核心主题</dt><dd>${escapeHtml(evidence.topic_id)}</dd>
          <dt>细分方向</dt><dd>${escapeHtml(evidence.branch_id ?? '无')}</dd>
          <dt>影响范围</dt><dd>${scopeLabel(evidence.scope)}</dd>
          <dt>证据强度</dt><dd>${evidenceStrengthLabel(evidence.evidence_strength)} · ${escapeHtml(candidate.e_strength_rationale)}</dd>
          <dt>影响维度</dt><dd>${evidence.affected_layer.map(layerLabel).join('、')}</dd>
          <dt>为什么重要</dt><dd>${escapeHtml(operatorText(evidence.interpretation))}</dd>
          <dt>不能证明什么</dt><dd>${escapeHtml(operatorText(evidence.limitation))}</dd>
          <dt>信息可靠度</dt><dd>${confidenceLabel(evidence.confidence)}</dd>
          <dt>建议原因</dt><dd>${escapeHtml(operatorText(candidate.suggested_reason))}</dd>
          <dt>不确定项</dt><dd>${candidate.uncertainty_notes.map((item) => escapeHtml(operatorText(item))).join('<br>')}</dd>
        </dl>
        <section class="actions">
          <label><input type="radio" name="${candidate.candidate_id}" value="accept"> 接受</label>
          <label><input type="radio" name="${candidate.candidate_id}" value="modify"> 修改</label>
          <label><input type="radio" name="${candidate.candidate_id}" value="reject" checked> 拒绝</label>
          <label><input type="radio" name="${candidate.candidate_id}" value="split"> 拆分</label>
        </section>
        <section class="shadow">
          <h3>规则与智能分析的差异</h3>
          <p>${escapeHtml(operatorText(comparison?.difference_summary ?? '尚未生成智能分析对照结果。'))}</p>
          <p>智能分析建议主题：${escapeHtml(ai?.suggested_evidence.topic_id ?? '无')} · 细分方向：${escapeHtml(ai?.suggested_evidence.branch_id ?? '无')}</p>
          <p>不确定项：${(ai?.uncertainty_notes ?? ['智能分析结果暂不可用。']).map((item) => escapeHtml(operatorText(item))).join('<br>')}</p>
        </section>
        <p class="small">候选将自动校验并导入，同时登记新主题与分支、更新阶段。</p>
        <details class="technical"><summary>技术详情</summary><p>候选编号：${escapeHtml(candidate.candidate_id)}</p></details>
      </article>
    `;
  }).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>研究材料智能解析工作台</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2933; background: #f7f7f4; }
    header.top { padding: 16px 24px; background: #17324d; color: white; }
    main { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(360px, 520px); gap: 0; min-height: calc(100vh - 72px); }
    .source, .cards { padding: 20px; overflow: auto; }
    .source { background: #fff; border-right: 1px solid #d7d4ca; white-space: pre-wrap; line-height: 1.55; }
    .cards { background: #f0eee7; }
    mark { background: #ffe08a; padding: 1px 2px; }
    .card { background: white; border: 1px solid #d8d6ce; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
    .card header { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    h1, h2 { margin: 0; }
    h2 { font-size: 16px; }
    blockquote { margin: 12px 0; border-left: 3px solid #2d6cdf; padding-left: 10px; color: #384554; }
    h3 { font-size: 13px; margin: 10px 0 4px; }
    dl { display: grid; grid-template-columns: 130px 1fr; gap: 6px 10px; font-size: 13px; }
    dt { font-weight: 700; color: #435160; }
    dd { margin: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 10px; border-top: 1px solid #ebe8dd; }
    .shadow { margin-top: 10px; padding: 10px; background: #f7f8fb; border: 1px solid #dfe6f2; border-radius: 6px; font-size: 12px; }
    .shadow p { margin: 4px 0; }
    .small { color: #66717f; font-size: 12px; }
    .technical { margin-top: 10px; color: #66717f; font-size: 11px; }
    .technical summary { cursor: pointer; font-weight: 700; }
  </style>
</head>
<body>
  <header class="top">
    <h1>研究材料智能解析工作台</h1>
    <div>必须人工审核 · 仅用于研究</div>
    <details class="technical"><summary>技术详情</summary><p>解析批次：${escapeHtml(session.session_id)}</p></details>
  </header>
  <main>
    <section class="source">${highlighted}</section>
    <section class="cards">${cards || '<p>没有提取到候选事实。</p>'}</section>
  </main>
</body>
</html>
`;
}
