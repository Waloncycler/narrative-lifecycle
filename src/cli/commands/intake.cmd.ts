import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function executeIntakeCommand(subAction: string = 'workbench', args: string[] = []) {
  const root = process.cwd();

  const actionMap: Record<string, string> = {
    prepare: 'src/cli/run_intake_prepare.ts',
    apply: 'src/cli/run_intake_apply.ts',
    learn: 'src/cli/run_intake_learn.ts',
    evaluate: 'src/cli/run_intake_evaluate.ts',
    'ai-shadow': 'src/cli/run_intake_ai_shadow.ts',
    'ai-evaluate': 'src/cli/run_intake_ai_evaluate.ts',
    workbench: 'src/cli/run_intake_workbench.ts',
    ui: 'src/cli/run_intake_workbench.ts',
  };

  const script = actionMap[subAction.toLowerCase()] || 'src/cli/run_intake_workbench.ts';
  const fullPath = resolve(root, script);

  console.log(`🚀 执行 Intake 子模块命令: [${subAction}] (${script})`);
  const result = spawnSync('npx', ['tsx', fullPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  return result.status ?? 0;
}
