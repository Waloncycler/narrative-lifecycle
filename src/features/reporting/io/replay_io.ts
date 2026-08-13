import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { ReplayCase, ReplayLedger } from '@/features/reporting/types/replay';
import type { RunManifest } from '@/platform/types/run_context';
import { DbArtifactRepository } from '@/platform/io/db_artifact_repository';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export const REPLAY_CASES_PATH = 'data/replay/replay_cases.yaml';

export class DbReplayRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readReplayCases(): ReplayCase[] {
    return readGenericArtifact(resolve(this.repoRoot, REPLAY_CASES_PATH))! as ReplayCase[];
  }

  readLatestRun(): RunManifest | null {
    const target = 'runs/latest_run.json';
    if (!existsSync(target)) return null;
    return readGenericArtifact(target)! as RunManifest;
  }

  writeReplayLedger(ledger: ReplayLedger, markdown: string): void {
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact('replay_ledger_latest', 'replay_ledger', ledger, markdown);
    dbArtifact.writeArtifact(`replay_ledger_${ledger.ledger_id}`, 'replay_ledger', ledger);
  }

  sourceArtifacts(): string[] {
    return [REPLAY_CASES_PATH, 'outputs/runs/latest_run.json'];
  }
}
