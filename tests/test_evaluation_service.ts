import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileEvaluationRepository, FileFailureCaseRepository, YamlFileRepository } from '../src/repositories/file_repository';
import { calibrateFailureCases } from '../src/services/evaluation_service';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('evaluation service', () => {
  it('links monthly review results back to failure case corrective rules', () => {
    const files = new YamlFileRepository(repoRoot);
    const failureCases = new FileFailureCaseRepository(files).listFailureCases();
    const evaluations = new FileEvaluationRepository(files).listEvaluationResults();
    const calibration = calibrateFailureCases(failureCases, evaluations);

    const metaverse = calibration.find((item) => item.case_id === 'metaverse');
    expect(metaverse?.status).toBe('covered');
    expect(metaverse?.evaluation_ids).toContain('eval_metaverse_failure_2026_07');
    expect(metaverse?.corrective_rules.join(' ')).toContain('Require customer');

    const missing = calibration.filter((item) => item.status === 'missing_evaluation');
    expect(missing.length).toBeGreaterThan(0);
  });
});
