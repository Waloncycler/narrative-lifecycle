import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FileEvidenceRepository,
  FileEvaluationRepository,
  FileFailureCaseRepository,
  FileGoldenCaseRepository,
  FileMemoryRepository,
  FileTopicRepository,
  YamlFileRepository,
} from '../src/repositories/file_repository';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const yamlFiles = new YamlFileRepository(repoRoot);

describe('file repositories', () => {
  it('loads seed topics, golden cases, evidence, failure cases, and seed memories', () => {
    const topics = new FileTopicRepository(yamlFiles).listTopics();
    const goldenCases = new FileGoldenCaseRepository(yamlFiles).listGoldenCases();
    const evidence = new FileEvidenceRepository(yamlFiles).listSampleEvidence();
    const failureCases = new FileFailureCaseRepository(yamlFiles).listFailureCases();
    const evaluations = new FileEvaluationRepository(yamlFiles).listEvaluationResults();
    const memories = new FileMemoryRepository(new FileTopicRepository(yamlFiles)).listSeedMemories();

    expect(topics.map((topic) => topic.topic_id)).toContain('bci');
    expect(goldenCases.map((caseItem) => caseItem.topic_id)).toEqual([
      'bci',
      'humanoid_robotics',
      'innovative_drug_license_out',
    ]);
    expect(evidence.length).toBeGreaterThanOrEqual(12);
    expect(new Set(evidence.map((item) => item.topic_id))).toEqual(
      new Set(['bci', 'humanoid_robotics', 'innovative_drug_license_out']),
    );
    expect(evidence.filter((item) => item.parent_or_branch === 'parent').length).toBeGreaterThanOrEqual(10);
    expect(evidence.filter((item) => item.parent_or_branch === 'branch').length).toBeGreaterThanOrEqual(3);
    expect(failureCases.length).toBeGreaterThanOrEqual(5);
    expect(evaluations.map((result) => result.evaluation_id)).toContain('eval_bci_boundary_2026_07');
    expect(memories.find((memory) => memory.topic_id === 'bci')?.previous_peak_stage).toBe('S4');
  });
});
