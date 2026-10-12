import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DbEvidenceRepository,
  DbEvaluationRepository,
  DbFailureCaseRepository,
  DbGoldenCaseRepository,
  DbMemoryRepository,
  DbTopicRepository,
  YamlFileRepository,
} from '@/platform/file_repository';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const yamlFiles = new YamlFileRepository();

describe('file repositories', () => {
  it('loads seed topics, golden cases, evidence, failure cases, and seed memories', () => {
    const topics = new DbTopicRepository(yamlFiles).listTopics();
    const goldenCases = new DbGoldenCaseRepository(yamlFiles).listGoldenCases();
    const evidence = new DbEvidenceRepository(yamlFiles).listSampleEvidence();
    const failureCases = new DbFailureCaseRepository(yamlFiles).listFailureCases();
    const evaluations = new DbEvaluationRepository(yamlFiles).listEvaluationResults();
    const memories = new DbMemoryRepository(new DbTopicRepository(yamlFiles)).listSeedMemories();

    expect(topics.map((topic) => topic.topic_id)).toContain('bci');
    expect(goldenCases.map((caseItem) => caseItem.topic_id)).toEqual([
      'bci',
      'humanoid_robotics',
      'innovative_drug_license_out',
    ]);
    expect(evidence.length).toBeGreaterThanOrEqual(12);
    const evidenceTopics = new Set(evidence.map((item) => item.topic_id));
    expect(evidenceTopics.has('bci')).toBe(true);
    expect(evidenceTopics.has('humanoid_robotics')).toBe(true);
    expect(evidenceTopics.has('innovative_drug_license_out')).toBe(true);
    expect(evidenceTopics.size).toBeGreaterThanOrEqual(3);
    expect(evidence.filter((item) => item.parent_or_branch === 'parent').length).toBeGreaterThanOrEqual(10);
    expect(evidence.filter((item) => item.parent_or_branch === 'branch').length).toBeGreaterThanOrEqual(3);
    expect(failureCases.length).toBeGreaterThanOrEqual(5);
    expect(evaluations.map((result) => result.evaluation_id)).toContain('eval_bci_boundary_2026_07');
    expect(memories.find((memory) => memory.topic_id === 'bci')?.previous_peak_stage).toBe('S4');
  });
});
