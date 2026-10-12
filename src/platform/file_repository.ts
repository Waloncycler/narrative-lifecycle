import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import type { GoldenCase } from '@/features/reporting/domain/golden_case';
import type { EvaluationResult } from '@/platform/core/audit';
import type { NarrativeMemory } from '@/features/narrative/domain/reactivation';
import type { FailureCase } from '@/features/reporting/domain/failure_case_service';

export interface TopicRecord {
  topic_id: string;
  topic_name: string;
  current_stage?: string;
  transition_target?: string;
  watch_status?: string;
}

export class YamlFileRepository {
  constructor() {}

  readYamlFile<T>(relativePath: string): T {
    return parse(readFileSync(resolve(process.cwd(), relativePath), 'utf8')) as T;
  }

  readYamlDirectory<T>(relativeDirectory: string, fileFilter: (file: string) => boolean = () => true): T[] {
    return readdirSync(resolve(process.cwd(), relativeDirectory))
      .filter((file) => (file.endsWith('.yaml') || file.endsWith('.yml')) && fileFilter(file))
      .sort()
      .flatMap((file) => {
        const value = this.readYamlFile<T | T[]>(`${relativeDirectory}/${file}`);
        return Array.isArray(value) ? value : [value];
      });
  }
}

export class DbEvidenceRepository {
  constructor(private readonly files: YamlFileRepository, private readonly repoRoot: string = process.cwd()) {}

  listSampleEvidence(): EvidenceNode[] {
    // Golden cases use frozen fixture files only. Imported/manual evidence is
    // intentionally kept out of the baseline so live research cannot rewrite
    // the regression target.
    return this.files.readYamlDirectory<EvidenceNode>('data/sample_evidence', (file) => file.endsWith('_evidence_sample.yaml'));
  }
}

export class DbGoldenCaseRepository {
  constructor(private readonly files: YamlFileRepository, private readonly repoRoot: string = process.cwd()) {}

  listGoldenCases(): GoldenCase[] {
    return this.files.readYamlDirectory<GoldenCase>('data/golden_cases');
  }

  getGoldenCase(topicId: string): GoldenCase | undefined {
    return this.listGoldenCases().find((item) => item.topic_id === topicId);
  }
}

export class DbFailureCaseRepository {
  constructor(private readonly files: YamlFileRepository, private readonly repoRoot: string = process.cwd()) {}

  listFailureCases(): FailureCase[] {
    return this.files.readYamlDirectory<FailureCase>('data/failure_cases');
  }
}

export class DbEvaluationRepository {
  constructor(private readonly files: YamlFileRepository, private readonly repoRoot: string = process.cwd()) {}

  listEvaluationResults(): EvaluationResult[] {
    return this.files.readYamlDirectory<EvaluationResult>('data/evaluation_results');
  }
}

export class DbTopicRepository {
  constructor(private readonly files: YamlFileRepository, private readonly repoRoot: string = process.cwd()) {}

  listTopics(): TopicRecord[] {
    return this.files.readYamlFile<TopicRecord[]>('data/seed_topics.yaml');
  }
}

export class DbMemoryRepository {
  constructor(private readonly topics: DbTopicRepository, private readonly repoRoot: string = process.cwd()) {}

  listSeedMemories(): NarrativeMemory[] {
    return this.topics.listTopics().map((topic) => ({
      topic_id: topic.topic_id,
      historical_stage_path: topic.current_stage ? [topic.current_stage] : [],
      previous_peak_stage: topic.current_stage,
      memory_confidence: 60,
    }));
  }
}
