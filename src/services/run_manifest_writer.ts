import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RunManifest } from '../types/run_context';

export function writeTextAtomically(path: string, contents: string): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, contents);
  renameSync(temporary, path);
}

export function writeJsonAtomically(path: string, value: unknown): void {
  writeTextAtomically(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeRunManifest(repoRoot: string, manifest: RunManifest, updateLatest = true): void {
  const runsRoot = resolve(repoRoot, 'outputs/runs');
  writeJsonAtomically(resolve(runsRoot, manifest.run_id, 'run_manifest.json'), manifest);
  if (updateLatest && manifest.status === 'ok') {
    writeJsonAtomically(resolve(runsRoot, 'latest_run.json'), manifest);
  }
}
