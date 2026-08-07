import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { FileEvidenceRepository, FileGoldenCaseRepository, YamlFileRepository } from '../src/repositories/file_repository';
import { runGoldenCases } from '../src/services/golden_case_runner';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('golden case runner', () => {
  it('runs evidence-first stage, score, and dashboard generation for every golden case', () => {
    const yamlRepository = new YamlFileRepository(repoRoot);
    const goldenCases = new FileGoldenCaseRepository(yamlRepository).listGoldenCases();
    const evidence = new FileEvidenceRepository(yamlRepository).listSampleEvidence();
    const results = runGoldenCases(goldenCases, evidence);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateScore = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/score.schema.json'), 'utf8')));
    const validateCard = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/dashboard_card.schema.json'), 'utf8')));

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.topic_id).sort()).toEqual([
      'bci',
      'humanoid_robotics',
      'innovative_drug_license_out',
    ]);

    for (const result of results) {
      expect(result.failures).toEqual([]);
      expect(result.passed).toBe(true);
      expect(validateScore(result.score), JSON.stringify(validateScore.errors)).toBe(true);
      expect(validateCard(result.dashboard_card), JSON.stringify(validateCard.errors)).toBe(true);
      expect(result.dashboard_card.stage_snapshot.evidence_ids.length).toBeGreaterThan(0);
      expect(result.dashboard_card.evidence_ids).toEqual(result.score.dimensions.data_confidence?.evidence_ids);
      expect(result.dashboard_card.score_id).toBe(result.score.score_id);
      expect(JSON.stringify(result.dashboard_card)).not.toMatch(/\b(buy|sell|target price|entry|exit|position sizing)\b/i);
    }

    const bci = results.find((result) => result.topic_id === 'bci');
    expect(bci?.stage.current_stage).toBe('S4');
    expect(bci?.score.dimensions.pricing_adoption?.score).toBeLessThan(50);
    expect(bci?.score.dimensions.pricing_adoption?.missing_data).toContain('valuation reframing evidence');
    expect(bci?.dashboard_card.why_not_higher_stage).toContain('medical branch validation cannot represent whole BCI');

    const humanoid = results.find((result) => result.topic_id === 'humanoid_robotics');
    expect(humanoid?.stage.current_stage).toBe('S6');
    expect(humanoid?.score.dimensions.pricing_adoption?.score).toBeGreaterThanOrEqual(60);

    const licenseOut = results.find((result) => result.topic_id === 'innovative_drug_license_out');
    expect(licenseOut?.stage.current_stage).toBe('S6');
    expect(licenseOut?.dashboard_card.why_not_higher_stage).toContain('milestone realization risk');
  });
});
