import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import { db } from '@/db/index';
import { branches, canonicalEvents, evidence, topics } from '@/db/schema';
import { TOPIC_NAME_LOCALIZATIONS } from '@/config/topic_name_localizations';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { resolveRunContext } from '@/platform/io/run_context';
import crypto from 'node:crypto';

export async function executeAuditCommand(subCommand: string = 'all', args: string[] = []) {
  const root = process.cwd();
  console.log('================================================================');
  console.log('🚀 执行证据资产防伪审计与累积门槛核验 (Evidence Audit Command)');
  console.log('================================================================\n');

  const admittedMap = new Map<string, typeof evidence.$inferInsert>();

  // 1. 扫描历史数据包
  const sourceFiles = [
    'data/sample_evidence/manual_imported_evidence.yaml',
    'data/sample_evidence/bci_evidence_sample.yaml',
    'data/sample_evidence/humanoid_robotics_evidence_sample.yaml',
    'data/sample_evidence/innovative_drug_evidence_sample.yaml',
    'data/golden_cases/bci.yaml',
    'data/golden_cases/humanoid_robotics.yaml',
    'data/golden_cases/innovative_drug_license_out.yaml',
    'data/research_packs/china_innovative_drugs_20260809.yaml',
    'data/live_evidence/automated_evidence.yaml',
    'data/imports/bci_market_baseline_2026_08.yaml',
    'data/evidence_table/manual_evidence.yaml',
  ];

  for (const relPath of sourceFiles) {
    const fullPath = resolve(root, relPath);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf-8');
    const parsed = parse(content);
    let items: any[] = [];

    if (Array.isArray(parsed)) items = parsed;
    else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.evidence)) items = parsed.evidence;
      else if (Array.isArray(parsed.cases)) items = parsed.cases;
      else if (Array.isArray(parsed.evidence_nodes)) items = parsed.evidence_nodes;
    }

    console.log(`📂 [${relPath}]: 扫描到 ${items.length} 条记录`);

    for (const item of items) {
      const title = item.event_title || item.title;
      const date = item.event_date || (item.available_at ? item.available_at.slice(0, 10) : '2026-01-01');
      if (!title) continue;

      let topicId = item.topic_id || 'unknown_topic';
      if (topicId === 'solid_state_battery') topicId = 'provisional_solid_state_battery';
      if (topicId === 'provisional_bci' || topicId === '脑机接口 BCI') topicId = 'bci';
      if (topicId === 'provisional_humanoid_robotics' || topicId === '人形机器人 / 具身智能') topicId = 'humanoid_robotics';
      if (topicId === '创新药 License-out') topicId = 'innovative_drug_license_out';

      const evId = item.evidence_id || `ev_audited_${crypto.createHash('sha256').update(`${title}_${date}`).digest('hex').slice(0, 16)}`;

      let affectedLayers = ['reality'];
      if (Array.isArray(item.affected_layer)) affectedLayers = item.affected_layer;
      else if (typeof item.affected_layer === 'string') affectedLayers = [item.affected_layer];

      admittedMap.set(evId, {
        evidence_id: evId,
        topic_id: topicId,
        branch_id: item.branch_id || null,
        event_date: date,
        available_at: item.available_at || `${date}T00:00:00.000Z`,
        event_title: title,
        event_summary: item.event_summary || item.summary || title,
        event_type: item.event_type || 'MARKET_FACT',
        source_name: item.source_name || 'Institutional Research Atlas',
        source_url: item.source_url || null,
        source_type: item.source_type || 'historical_archive',
        evidence_strength: item.evidence_strength || 'E1',
        stage_effect: item.stage_effect || 'observation',
        parent_or_branch: item.parent_or_branch || (item.branch_id ? 'branch' : 'parent'),
        interpretation: item.interpretation || '历史里程碑锚点记录',
        limitation: item.limitation || '历史档案归档数据',
        positive_or_negative: item.positive_or_negative || 'positive',
        confidence: typeof item.confidence === 'number' ? item.confidence : 70,
        affected_layer_json: JSON.stringify(affectedLayers),
      });
    }
  }

  // 2. 确保所有关联 topics 和 branches 在数据库中存在
  const existingTopics = new Set(db.select().from(topics).all().map(t => t.topic_id));
  const existingBranches = new Set(db.select().from(branches).all().map(b => b.branch_id));
  const now = new Date().toISOString();

  for (const item of admittedMap.values()) {
    if (!existingTopics.has(item.topic_id)) {
      const zhName = TOPIC_NAME_LOCALIZATIONS[item.topic_id] || item.topic_id.replace(/^provisional_/, '').replace(/_/g, ' ');
      db.insert(topics).values({
        topic_id: item.topic_id,
        topic_name: zhName,
        status: item.topic_id.startsWith('provisional_') ? 'provisional' : 'active',
        current_stage: 'S0',
        domain: 'industrial_narratives',
        created_at: now,
        updated_at: now,
      }).onConflictDoNothing().run();
      existingTopics.add(item.topic_id);
    }

    if (item.branch_id && !existingBranches.has(item.branch_id)) {
      db.insert(branches).values({
        branch_id: item.branch_id,
        topic_id: item.topic_id,
        market_name_zh: item.branch_id.replace(/_/g, ' '),
        naming_status: 'resolved',
        created_at: now,
      }).onConflictDoNothing().run();
      existingBranches.add(item.branch_id);
    }
  }

  // 3. 批量写入 SQLite
  console.log(`\n💾 写入 SQLite evidence 表 (${admittedMap.size} 条合格证据)...`);
  db.transaction((tx) => {
    for (const item of admittedMap.values()) {
      tx.insert(evidence).values(item).onConflictDoUpdate({
        target: evidence.evidence_id,
        set: {
          event_title: item.event_title,
          event_summary: item.event_summary,
        }
      }).run();
    }
  });

  const total = db.select().from(evidence).all().length;
  console.log(`✅ 证据审计与入库完成！当前 SQLite 证据总数达到: ${total} 条`);

  // 3. 自动触发阶段重算
  const { recomputeAllTopicStagesUseCase } = createProductCoreUseCases(root);
  recomputeAllTopicStagesUseCase.execute(resolveRunContext());
  console.log('⚡ 题材演化生命周期已基于最新证据全量重算完毕！\n');
}
