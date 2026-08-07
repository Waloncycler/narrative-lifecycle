import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { ReplayCase, ReplayLedger } from '../types/replay';
import type { RunManifest } from '../types/run_context';
import { writeJsonAtomically, writeTextAtomically } from '../services/run_manifest_writer';

export const REPLAY_CASES_PATH = 'data/replay/replay_cases.yaml';

export class FileReplayRepository {
  constructor(private readonly repoRoot: string) {}

  readReplayCases(): ReplayCase[] {
    return parse(readFileSync(resolve(this.repoRoot, REPLAY_CASES_PATH), 'utf8')) as ReplayCase[];
  }

  readLatestRun(): RunManifest | null {
    const target = resolve(this.repoRoot, 'outputs/runs/latest_run.json');
    if (!existsSync(target)) return null;
    return JSON.parse(readFileSync(target, 'utf8')) as RunManifest;
  }

  writeReplayLedger(ledger: ReplayLedger, markdown: string): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/replay/latest_replay_ledger.json'), ledger);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/replay/latest_replay_ledger.md'), markdown);
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/replay/history', `${ledger.ledger_id}.json`), ledger);
  }

  sourceArtifacts(): string[] {
    return [REPLAY_CASES_PATH, 'outputs/runs/latest_run.json'];
  }
}
