#!/usr/bin/env node

/**
 * Narrative Lifecycle Unified Command Center (统一命令行调度中心)
 * Consolidates all lifecycle research, sync, audit, stage-computation, and reporting tasks.
 */

import { executeStageCommand } from './commands/stage.cmd';
import { executeAuditCommand } from './commands/audit.cmd';
import { executeSyncCommand } from './commands/sync.cmd';
import { executeIntakeCommand } from './commands/intake.cmd';
import { executeResearchCommand } from './commands/research.cmd';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const command = process.argv[2] || 'help';
const subArgs = process.argv.slice(3);

function printHelp() {
  console.log(`
🌐 叙事生命周期智能系统 (Narrative Lifecycle Command Center) v0.13.5
========================================================================

使用方法 (Usage):
  npx narrative <command> [sub-command] [options]

核心命令 (Core Command Groups):
  sync                   全网立体情报采集 (中国政府网 + 东方财富研报 + 巨潮A股 + VIP领袖 + 全球快讯)
  audit                  全量历史与增量证据审计 (Skills 防伪核验 + 累积质变判定)
  stage [diff]           全局 44 题材生命周期阶段重算 (S0~S7 演化状态更新 / 差异比对)
  report [daily]         生成机构级双轨每日情报战报 (宏观作战室 ➕ 产业深度解构)
  run                    一键全闭环执行 (采集 ➔ 审计 ➔ 重算 ➔ 生成战报)
  workbench              启动叙事生命周期大盘交互界面 (Next.js Workbench UI)

专业子命令组 (Domain Sub-Command Suites):
  intake <action>        候选事实处理与学习 (prepare, apply, evaluate, learn, ai-shadow)
  research <action>      深度研究引擎 (search, agent, autonomous, campaign, pack)

系统工具 (System Utilities):
  db:migrate             执行 SQLite 数据库迁移
  db:seed                重置并重新注入基础种子数据
  test                   运行全量自动化测试套件 (Vitest 444 测试)
  help                   显示本帮助信息

示例 (Examples):
  npx narrative run                      # 每日一键运行全量闭环情报与重算
  npx narrative sync                     # 仅执行全网多模态增量数据抓取
  npx narrative stage diff               # 比较上一轮与本轮阶段差异
  npx narrative report                   # 生成最新双轨情报内参
  npx narrative workbench                # 启动可视化交互大盘 (127.0.0.1:4177)
========================================================================
`);
}

async function main() {
  switch (command.toLowerCase()) {
    case 'sync':
      await executeSyncCommand(subArgs);
      break;

    case 'audit':
      await executeAuditCommand(subArgs[0], subArgs.slice(1));
      break;

    case 'stage':
    case 'recompute':
      await executeStageCommand(subArgs[0], subArgs.slice(1));
      break;

    case 'intake':
      await executeIntakeCommand(subArgs[0] || 'auto', subArgs.slice(1));
      break;

    case 'research':
      await executeResearchCommand(subArgs[0] || 'search', subArgs.slice(1));
      break;

    case 'report': {
      const script = resolve(process.cwd(), 'src/cli/run_report.ts');
      spawnSync('npx', ['tsx', script, ...subArgs], { stdio: 'inherit', env: process.env });
      break;
    }

    case 'run':
    case 'pipeline':
    case 'all': {
      const script = resolve(process.cwd(), 'src/cli/run_full_unified_intelligence_cycle.ts');
      spawnSync('npx', ['tsx', script, ...subArgs], { stdio: 'inherit', env: process.env });
      break;
    }

    case 'workbench':
    case 'ui':
      await executeIntakeCommand('workbench', subArgs);
      break;

    case 'db:migrate': {
      const script = resolve(process.cwd(), 'src/cli/run_db_migrate.ts');
      spawnSync('npx', ['tsx', script, ...subArgs], { stdio: 'inherit', env: process.env });
      break;
    }

    case 'db:seed': {
      const script = resolve(process.cwd(), 'src/cli/run_db_seed.ts');
      spawnSync('npx', ['tsx', script, ...subArgs], { stdio: 'inherit', env: process.env });
      break;
    }

    case 'test':
      spawnSync('npx', ['vitest', 'run', ...subArgs], { stdio: 'inherit', env: process.env });
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error('Command Execution Failed:', err);
  process.exit(1);
});
