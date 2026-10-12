import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PERMITTED_KEYS = /^(?:NARRATIVE_|MINIMAX_|DEEPSEEK_|WORLDMONITOR_|WORKBENCH_)/;

/** Loads local runtime settings without overriding an explicitly supplied
 * process environment. Values are never logged or persisted in artifacts. */
export function loadRuntimeEnv(repoRoot: string, env: NodeJS.ProcessEnv = process.env): void {
  const path = resolve(repoRoot, '.env');
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match || !PERMITTED_KEYS.test(match[1]!)) continue;
    const key = match[1]!;
    if (env[key] !== undefined) continue;
    const value = match[2]!.trim().replace(/^(['"])(.*)\1$/, '$2');
    env[key] = value;
  }
}
