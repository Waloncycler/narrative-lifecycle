import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function executeResearchCommand(subAction: string = 'search', args: string[] = []) {
  const root = process.cwd();

  const actionMap: Record<string, string> = {
    search: 'src/cli/run_web_research.ts',
    agent: 'src/cli/run_research_agent.ts',
    autonomous: 'src/cli/run_autonomous_loop.ts',
    campaign: 'src/cli/run_research_campaign.ts',
    triage: 'src/cli/run_research_triage.ts',
    pack: 'src/cli/run_research_pack.ts',
    baseline: 'src/cli/run_research_baseline.ts',
    retrieve: 'src/cli/run_research_retrieve.ts',
  };

  const script = actionMap[subAction.toLowerCase()] || 'src/cli/run_web_research.ts';
  const fullPath = resolve(root, script);

  console.log(`🔍 执行 Research 深度投研子命令: [${subAction}] (${script})`);
  const result = spawnSync('npx', ['tsx', fullPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  return result.status ?? 0;
}
