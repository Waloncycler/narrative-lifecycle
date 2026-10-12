import { readGenericArtifact, readGenericTextArtifact } from '@/platform/io/run_manifest_writer';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { PilotEvaluationSummary, PilotObservation, PilotResearchLedger, PilotTopic } from '@/features/reporting/types/pilot';
import type { RunManifest } from '@/platform/types/run_context';
import type { WeeklyBrief } from '@/features/reporting/types/report';
import type { StageDiff } from '@/features/stages/types/diff';
import type { OperatorReview } from '@/features/reporting/types/operator_review';
import { DbArtifactRepository } from '@/platform/io/db_artifact_repository';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export const PILOT_TOPICS_PATH = 'data/pilot/pilot_topics.yaml';
export const PILOT_OBSERVATIONS_PATH = 'data/pilot/operator_observations.yaml';

export class DbPilotRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  pilotFilesExist(): boolean {
    return existsSync(resolve(this.repoRoot, PILOT_TOPICS_PATH)) && existsSync(resolve(this.repoRoot, PILOT_OBSERVATIONS_PATH));
  }

  readLatestRun(): RunManifest {
    return this.readOperationalOrLegacy('latest_run.json', 'outputs/runs/latest_run.json');
  }

  readWeeklyBrief(): WeeklyBrief {
    return this.readOperationalOrLegacy('latest_weekly_brief.json', 'outputs/reports/weekly_brief.json');
  }

  readStageDiff(): StageDiff {
    return this.readOperationalOrLegacy('latest_stage_diff.json', 'outputs/diffs/latest_stage_diff.json');
  }

  readOperatorReview(): OperatorReview {
    return this.readJson('outputs/reviews/latest_operator_review.json');
  }

  sourceArtifacts(): string[] {
    return [
      existsSync('operator_runs/latest_run.json') ? 'outputs/operator_runs/latest_run.json' : 'outputs/runs/latest_run.json',
      existsSync('operator_runs/latest_weekly_brief.json') ? 'outputs/operator_runs/latest_weekly_brief.json' : 'outputs/reports/weekly_brief.json',
      existsSync('operator_runs/latest_stage_diff.json') ? 'outputs/operator_runs/latest_stage_diff.json' : 'outputs/diffs/latest_stage_diff.json',
      'outputs/reviews/latest_operator_review.json',
      PILOT_TOPICS_PATH,
      PILOT_OBSERVATIONS_PATH,
    ];
  }

  readPilotTopics(): PilotTopic[] {
    return this.readYaml<PilotTopic[]>(PILOT_TOPICS_PATH);
  }

  readPilotObservations(): PilotObservation[] {
    if (!existsSync(resolve(this.repoRoot, PILOT_OBSERVATIONS_PATH))) return [];
    return this.readYaml<PilotObservation[]>(PILOT_OBSERVATIONS_PATH);
  }

  writePilotSeed(topics: PilotTopic[], observations: PilotObservation[]): void {
    mkdirSync(resolve(this.repoRoot, 'data/pilot'), { recursive: true });
    writeGenericTextArtifact(resolve(this.repoRoot, PILOT_TOPICS_PATH), stringify(topics));
    writeGenericTextArtifact(resolve(this.repoRoot, PILOT_OBSERVATIONS_PATH), stringify(observations));
  }

  writePilotLedger(ledger: PilotResearchLedger, markdown: string): void {
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact('pilot_ledger_latest', 'pilot_ledger', ledger, markdown);
    dbArtifact.writeArtifact(`pilot_ledger_${ledger.ledger_id}`, 'pilot_ledger', ledger);
  }

  writePilotEvaluationSummary(summary: PilotEvaluationSummary): void {
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact('pilot_evaluation_summary', 'pilot_summary', summary);
  }

  private readJson<T>(relativePath: string): T {
    return readGenericArtifact(resolve(this.repoRoot, relativePath))! as T;
  }

  private readOperationalOrLegacy<T>(operationalFile: string, legacyPath: string): T {
    const operationalPath = resolve(this.repoRoot, 'outputs/operator_runs', operationalFile);
    return existsSync(operationalPath)
      ? readGenericArtifact(operationalPath)! as T
      : this.readJson<T>(legacyPath);
  }

  private readYaml<T>(relativePath: string): T {
    return readGenericArtifact(resolve(this.repoRoot, relativePath))! as T;
  }
}
