import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runHeadlessDocumentIntake } from '../run_headless_document_intake';

export async function executeIntakeCommand(subAction?: string, args: string[] = []) {
  const root = process.cwd();

  // 1. If target is a file path or directory or 'auto', run headless document intake directly without UI!
  const target = subAction || 'data/documents';
  const targetFullPath = resolve(root, target);

  if (target === 'auto' || existsSync(targetFullPath)) {
    console.log(`🚀 执行无感材料解析: [${target}]`);
    return await runHeadlessDocumentIntake(target === 'auto' ? 'data/documents' : target);
  }

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

  const script = actionMap[(subAction || '').toLowerCase()] || 'src/cli/run_headless_document_intake.ts';
  const fullPath = resolve(root, script);

  console.log(`🚀 执行 Intake 子模块命令: [${subAction || 'auto'}] (${script})`);
  const result = spawnSync('npx', ['tsx', fullPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  return result.status ?? 0;
}
