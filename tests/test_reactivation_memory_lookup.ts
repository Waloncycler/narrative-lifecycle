import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryService } from '@/features/narrative/domain/memory_service';
import { createReactivationRecord } from '@/features/narrative/domain/reactivation_service';

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

        
    expect(true).toBe(true);
  });
});
