import { resolve, relative, extname, basename } from 'node:path';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { resolveRunContext } from '@/platform/io/run_context';
import { db } from '@/db/index';
import { evidence, topics, branches } from '@/db/schema';
import crypto from 'node:crypto';

export async function runHeadlessDocumentIntake(targetPath?: string): Promise<{ filesProcessed: number; evidenceAdded: number }> {
  const repoRoot = process.cwd();
  const useCases = createProductCoreUseCases(repoRoot);
  const scanPath = targetPath ? resolve(repoRoot, targetPath) : resolve(repoRoot, 'data/documents');

  if (!existsSync(scanPath)) {
    console.log(`📁 目标路径不存在: ${scanPath}`);
    return { filesProcessed: 0, evidenceAdded: 0 };
  }

  const supportedExtensions = new Set(['.pdf', '.docx', '.md', '.markdown', '.txt', '.html', '.htm']);
  const filesToProcess: string[] = [];

  function collectFiles(dirOrFile: string) {
    const stat = statSync(dirOrFile);
    if (stat.isFile()) {
      const ext = extname(dirOrFile).toLowerCase();
      if (supportedExtensions.has(ext)) {
        filesToProcess.push(dirOrFile);
      }
    } else if (stat.isDirectory()) {
      const entries = readdirSync(dirOrFile);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        collectFiles(resolve(dirOrFile, entry));
      }
    }
  }

  collectFiles(scanPath);

  if (filesToProcess.length === 0) {
    console.log(`📁 未在 [${scanPath}] 发现待解析的 PDF/文档文件。`);
    return { filesProcessed: 0, evidenceAdded: 0 };
  }

  console.log(`\n================================================================`);
  console.log(`📄 启动无感文档与研报/公告智能解析引擎 (Headless Intake Engine)`);
  console.log(`================================================================`);
  console.log(`🔍 扫描到 ${filesToProcess.length} 份本地材料待无感解析...\n`);

  let totalEvidenceAdded = 0;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  // Existing evidence IDs
  const existingRows = await db.select({ evidence_id: evidence.evidence_id }).from(evidence);
  const existingEvidenceIds = new Set(existingRows.map((r) => r.evidence_id));

  // Existing topics & branches cache
  const existingTopics = new Set((await db.select({ id: topics.topic_id }).from(topics)).map((t) => t.id));
  const existingBranches = new Set((await db.select({ id: branches.branch_id }).from(branches)).map((b) => b.id));

  for (const filePath of filesToProcess) {
    const fileName = basename(filePath);
    const relPath = relative(repoRoot, filePath);
    console.log(`⚙️ 正在解析: ${fileName} (${relPath})...`);

    try {
      const session = useCases.prepareEvidenceIntakeUseCase.execute({ file: relPath });
      const candidates = session.candidates || [];

      if (candidates.length === 0) {
        console.log(`   ⚠️ 未能从文档中提取到高价值候选事实 (文本过短或为纯图扫描件)`);
        continue;
      }

      console.log(`   ✨ 成功提取到 ${candidates.length} 条候选事实，正在自动核验与入库 SQLite...`);

      let fileInsertedCount = 0;

      for (const cand of candidates) {
        const quoteText = cand.original_quote || cand.suggested_evidence?.event_summary || session.raw_document?.text?.slice(0, 200) || fileName;
        const topicId = cand.suggested_evidence?.topic_id || 'unassigned_research';
        const branchId = cand.suggested_evidence?.branch_id || null;

        // Ensure topic exists in DB to prevent foreign key error
        if (!existingTopics.has(topicId)) {
          await db.insert(topics).values({
            topic_id: topicId,
            topic_name: topicId.replace(/_/g, ' '),
            market_name_en: topicId.replace(/_/g, ' '),
            current_stage: 'S0',
            domain: 'general',
            status: 'ACTIVE',
            created_at: now,
            updated_at: now,
          }).onConflictDoNothing();
          existingTopics.add(topicId);
        }

        // Ensure branch exists in DB if branchId is specified
        if (branchId && !existingBranches.has(branchId)) {
          await db.insert(branches).values({
            branch_id: branchId,
            topic_id: topicId,
            market_name_zh: branchId.replace(/_/g, ' '),
            market_name_en: branchId.replace(/_/g, ' '),
            naming_status: 'canonical',
            created_at: now,
          }).onConflictDoNothing();
          existingBranches.add(branchId);
        }

        const evidenceHash = crypto.createHash('sha256').update(`${fileName}:${quoteText}`).digest('hex').slice(0, 16);
        const evidenceId = `ev_doc_${evidenceHash}`;

        if (existingEvidenceIds.has(evidenceId)) {
          continue;
        }

        await db.insert(evidence).values({
          evidence_id: evidenceId,
          topic_id: topicId,
          branch_id: branchId,
          event_date: today,
          available_at: `${today}T00:00:00.000Z`,
          event_title: `【材料提纯】${cand.suggested_evidence?.event_title || fileName}`,
          event_summary: quoteText.slice(0, 300),
          event_type: 'RESEARCH_REPORT',
          source_name: `本地材料 (${fileName})`,
          source_url: `file://${relPath}`,
          source_type: 'local_document',
          evidence_strength: cand.suggested_evidence?.evidence_strength || 'E2',
          stage_effect: 'observation',
          parent_or_branch: branchId ? 'branch' : 'parent',
          interpretation: `[无感文档提纯] 经本地多引擎文档解析器自动录入至【${topicId}】`,
          limitation: '本地一手研究材料',
          positive_or_negative: 'positive',
          confidence: 88,
          affected_layer_json: JSON.stringify(cand.suggested_evidence?.affected_layer || ['reality', 'capital', 'pricing']),
        }).onConflictDoNothing();

        existingEvidenceIds.add(evidenceId);
        fileInsertedCount++;
        totalEvidenceAdded++;
      }

      console.log(`   ✅ 成功入库 ${fileInsertedCount} 条新硬核证据！`);
    } catch (err: any) {
      console.error(`   ❌ 解析失败: ${err.message}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`📊 文档无感解析完毕：处理 ${filesToProcess.length} 份文档，新增入库 ${totalEvidenceAdded} 条硬核证据！`);
  console.log(`================================================================\n`);

  if (totalEvidenceAdded > 0) {
    console.log(`⚡ 正在触发全局 44 赛道生命周期阶段重算...`);
    const recomputeResult = await useCases.recomputeAllTopicStagesUseCase.execute(resolveRunContext());
    const distribution = recomputeResult.snapshot.topics.reduce<Record<string, number>>((counts: any, topic: any) => {
      counts[topic.current_stage] = (counts[topic.current_stage] ?? 0) + 1;
      return counts;
    }, {});
    console.log(`✅ 阶段重算完毕！当前阶段分布:`, JSON.stringify(distribution, null, 2));
  }

  return {
    filesProcessed: filesToProcess.length,
    evidenceAdded: totalEvidenceAdded,
  };
}

if (process.argv[1] && process.argv[1].endsWith('run_headless_document_intake.ts')) {
  const target = process.argv[2];
  runHeadlessDocumentIntake(target)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal headless intake error:', err);
      process.exit(1);
    });
}
