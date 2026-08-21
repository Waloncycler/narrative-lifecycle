import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function executeSyncCommand(args: string[] = []) {
  console.log('================================================================');
  console.log('📡 启动全网立体数据采集 (Unified Ingestion Sync)');
  console.log('   [包含: 56个全球源 + 中国政府网 + 东方财富研报 + 巨潮A股 + VIP领袖]');
  console.log('================================================================\n');

  // 调用完整闭环采集引擎
  const script = resolve(process.cwd(), 'src/cli/run_full_unified_intelligence_cycle.ts');
  const result = spawnSync('npx', ['tsx', script, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  return result.status ?? 0;
}
