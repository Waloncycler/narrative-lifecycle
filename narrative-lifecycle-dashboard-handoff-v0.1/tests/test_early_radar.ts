import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createEarlyRadarCandidate, type EarlyRadarCandidateInput, qualifiesForEarlyRadar } from '../src/services/early_radar_service';
import { MemoryService } from '../src/services/memory_service';
import { createReactivationRecord } from '../src/services/reactivation_service';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('test_early_radar', () => {
  it('uses narrative memory and reactivation output before admitting old topics', () => {
    const memoryService = new MemoryService([
      {
        topic_id: 'old_topic',
        previous_peak_stage: 'S4',
        previous_missing_evidence: ['pricing adoption'],
        memory_confidence: 85,
      },
    ]);
    const memory = memoryService.lookup('old_topic');

    expect(memoryService.requiresMemoryLookup('old_topic')).toBe(true);
    expect(memory?.previous_missing_evidence).toContain('pricing adoption');

    const repeatedOldStory = createReactivationRecord({
      record_id: 'rr_repeat',
      topic_id: 'old_topic',
      memory,
      repeatedOldLogic: true,
      missingEvidenceFilled: [],
      branchMutationStrength: 0,
      realityCatchUp: false,
      expectationReset: 0,
      newEvidenceQuality: 80,
      stageGateImpact: 80,
      dataConfidence: 80,
    });

    expect(qualifiesForEarlyRadar({
      current_stage: 'S4',
      reactivation_type: repeatedOldStory.reactivation_type,
      narrative_delta_score: repeatedOldStory.narrative_delta_score,
    })).toBe(false);

    const filledMissingEvidence = createReactivationRecord({
      record_id: 'rr_delta',
      topic_id: 'old_topic',
      memory,
      repeatedOldLogic: false,
      missingEvidenceFilled: ['pricing adoption'],
      branchMutationStrength: 0,
      realityCatchUp: false,
      expectationReset: 20,
      newEvidenceQuality: 70,
      stageGateImpact: 80,
      dataConfidence: 70,
    });

    expect(qualifiesForEarlyRadar({
      current_stage: 'S4',
      reactivation_type: filledMissingEvidence.reactivation_type,
      narrative_delta_score: filledMissingEvidence.narrative_delta_score,
    })).toBe(true);
  });

  it('creates research-only candidates for S1-S4 and S7C, while rejecting S5/S6', () => {
    const candidateInput: EarlyRadarCandidateInput = {
      candidate_id: 'radar_s4',
      candidate_name: 'Old topic with filled pricing evidence',
      parent_narrative: 'old_topic',
      current_stage: 'S4',
      transition_target: 'S5',
      reactivation_type: 'stage_reactivation',
      signal_origin: 'stage_reactivation',
      reactivation_record_id: 'rr_delta',
      narrative_delta_score: 65,
      data_confidence: 70,
      why_early: 'Missing pricing evidence was filled before full validation.',
      why_not_confirmed: 'Hard reality evidence remains incomplete.',
      next_triggers: ['parent reality evidence'],
      failure_signals: ['repeated old logic'],
      suggested_action: 'early research',
    };
    const candidate = createEarlyRadarCandidate(candidateInput);

    expect(candidate.radar_pool).toBe('S4 Early Trading Pool');
    expect(candidate.early_opportunity_score).toBe(67);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateCandidate = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/early_radar_candidate.schema.json'), 'utf8')));
    expect(validateCandidate(candidate), JSON.stringify(validateCandidate.errors)).toBe(true);

    expect(() =>
      createEarlyRadarCandidate({
        ...candidateInput,
        candidate_id: 'radar_bad_action',
        suggested_action: 'buy' as never,
      }),
    ).toThrow('Dashboard action must be a research action');

    expect(() =>
      createEarlyRadarCandidate({
        ...candidateInput,
        candidate_id: 'radar_no_reactivation',
        reactivation_record_id: undefined,
      }),
    ).toThrow('Early Radar requires reactivation_record_id');

    expect(() =>
      createEarlyRadarCandidate({
        ...candidateInput,
        candidate_id: 'radar_s6',
        current_stage: 'S6',
      }),
    ).toThrow('Candidate does not qualify for Early Radar');

    const branchMutation = createEarlyRadarCandidate({
      ...candidateInput,
      candidate_id: 'radar_s7c',
      current_stage: 'S7C',
      transition_target: 'S7C',
      isS7CBranchMutation: true,
      reactivation_type: 'branch_mutation',
      signal_origin: 'branch_mutation',
      reactivation_record_id: 'rr_branch_mutation',
      branch_name: 'new branch',
    });
    expect(branchMutation.radar_pool).toBe('S7C Branch Mutation Pool');
  });
});
