import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { EvidenceNode } from '../domain/evidence';
import type { GoldenCase } from '../domain/golden_case';
import type { EvaluationResult } from '../domain/audit';
import type { NarrativeMemory } from '../domain/reactivation';
import type { FailureCase } from '../services/failure_case_service';

export interface TopicRecord {
  topic_id: string;
  topic_name: string;
  current_stage?: string;
  transition_target?: string;
  watch_status?: string;
}

export class YamlFileRepository {
  constructor(private readonly repoRoot: string) {}

  readYamlFile<T>(relativePath: string): T {
    return parse(readFileSync(resolve(this.repoRoot, relativePath), 'utf8')) as T;
  }

  readYamlDirectory<T>(relativeDirectory: string): T[] {
    return readdirSync(resolve(this.repoRoot, relativeDirectory))
      .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
      .sort()
      .flatMap((file) => {
        const value = this.readYamlFile<T | T[]>(`${relativeDirectory}/${file}`);
        return Array.isArray(value) ? value : [value];
      });
  }
}

export class FileEvidenceRepository {
  constructor(private readonly files: YamlFileRepository) {}

  listSampleEvidence(): EvidenceNode[] {
    return this.files.readYamlDirectory<EvidenceNode>('data/sample_evidence');
  }
}

export class FileGoldenCaseRepository {
  constructor(private readonly files: YamlFileRepository) {}

  listGoldenCases(): GoldenCase[] {
    return this.files.readYamlDirectory<GoldenCase>('data/golden_cases');
  }

  getGoldenCase(topicId: string): GoldenCase | undefined {
    return this.listGoldenCases().find((item) => item.topic_id === topicId);
  }
}

export class FileFailureCaseRepository {
  constructor(private readonly files: YamlFileRepository) {}

  listFailureCases(): FailureCase[] {
    return this.files.readYamlDirectory<FailureCase>('data/failure_cases');
  }
}

export class FileEvaluationRepository {
  constructor(private readonly files: YamlFileRepository) {}

  listEvaluationResults(): EvaluationResult[] {
    return this.files.readYamlDirectory<EvaluationResult>('data/evaluation_results');
  }
}

export class FileTopicRepository {
  constructor(private readonly files: YamlFileRepository) {}

  listTopics(): TopicRecord[] {
    return this.files.readYamlFile<TopicRecord[]>('data/seed_topics.yaml');
  }
}

export class FileMemoryRepository {
  constructor(private readonly topics: FileTopicRepository) {}

  listSeedMemories(): NarrativeMemory[] {
    return this.topics.listTopics().map((topic) => ({
      topic_id: topic.topic_id,
      historical_stage_path: topic.current_stage ? [topic.current_stage] : [],
      previous_peak_stage: topic.current_stage,
      memory_confidence: 60,
    }));
  }
}
