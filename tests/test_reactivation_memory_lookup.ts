import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { MemoryService } from '../src/services/memory_service';
import { createReactivationRecord } from '../src/services/reactivation_service';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('test_reactivation_memory_lookup', () => {
  it('checks narrative memory before treating an old topic as a new opportunity', () => {
    const memoryService = new MemoryService([
      {
        topic_id: 'bci',
        previous_peak_stage: 'S4',
        previous_missing_evidence: ['parent reality evidence'],
        memory_confidence: 85,
      },
    ]);

    const memory = memoryService.lookup('bci');
    expect(memoryService.requiresMemoryLookup('bci')).toBe(true);

    const reactivation = createReactivationRecord({
      record_id: 'reactivation_bci',
      topic_id: 'bci',
      memory,
      repeatedOldLogic: false,
      missingEvidenceFilled: ['parent reality evidence'],
      branchMutationStrength: 0,
      realityCatchUp: true,
      expectationReset: 10,
      newEvidenceQuality: 80,
      stageGateImpact: 80,
      dataConfidence: 75,
    });

    expect(reactivation.reactivation_type).toBe('reality_catch_up');
    expect(reactivation.should_enter_radar).toBe(true);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const schema = JSON.parse(readFileSync(resolve(repoRoot, 'schemas/reactivation_record.schema.json'), 'utf8'));
    expect(ajv.compile(schema)(reactivation)).toBe(true);
  });
});
