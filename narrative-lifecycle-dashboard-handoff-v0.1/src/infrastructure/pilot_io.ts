import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { PilotEvaluationSummary, PilotObservation, PilotResearchLedger, PilotTopic } from '../types/pilot';
import type { RunManifest } from '../types/run_context';
import type { WeeklyBrief } from '../types/report';
import type { StageDiff } from '../types/diff';
import type { OperatorReview } from '../types/operator_review';
import { writeJsonAtomically, writeTextAtomically } from '../services/run_manifest_writer';

export const PILOT_TOPICS_PATH = 'data/pilot/pilot_topics.yaml';
export const PILOT_OBSERVATIONS_PATH = 'data/pilot/operator_observations.yaml';

export class FilePilotRepository {
  constructor(private readonly repoRoot: string) {}

  pilotFilesExist(): boolean {
    return existsSync(resolve(this.repoRoot, PILOT_TOPICS_PATH)) && existsSync(resolve(this.repoRoot, PILOT_OBSERVATIONS_PATH));
  }

  readLatestRun(): RunManifest {
    return this.readJson('outputs/runs/latest_run.json');
  }

  readWeeklyBrief(): WeeklyBrief {
    return this.readJson('outputs/reports/weekly_brief.json');
  }

  readStageDiff(): StageDiff {
    return this.readJson('outputs/diffs/latest_stage_diff.json');
  }

  readOperatorReview(): OperatorReview {
    return this.readJson('outputs/reviews/latest_operator_review.json');
  }

  sourceArtifacts(): string[] {
    return [
      'outputs/runs/latest_run.json',
      'outputs/reports/weekly_brief.json',
      'outputs/diffs/latest_stage_diff.json',
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
    writeTextAtomically(resolve(this.repoRoot, PILOT_TOPICS_PATH), stringify(topics));
    writeTextAtomically(resolve(this.repoRoot, PILOT_OBSERVATIONS_PATH), stringify(observations));
  }

  writePilotLedger(ledger: PilotResearchLedger, markdown: string): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/pilot/latest_research_ledger.json'), ledger);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/pilot/latest_research_ledger.md'), markdown);
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/pilot/history', `${ledger.ledger_id}.json`), ledger);
  }

  writePilotEvaluationSummary(summary: PilotEvaluationSummary): void {
    writeJsonAtomically(resolve(this.repoRoot, 'outputs/pilot/pilot_evaluation_summary.json'), summary);
  }

  private readJson<T>(relativePath: string): T {
    return JSON.parse(readFileSync(resolve(this.repoRoot, relativePath), 'utf8')) as T;
  }

  private readYaml<T>(relativePath: string): T {
    return parse(readFileSync(resolve(this.repoRoot, relativePath), 'utf8')) as T;
  }
}
