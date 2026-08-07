import { describe, expect, it } from 'vitest';
import { pilotActionFor, validatePilotTopic } from '../src/domain/pilot_rules';
import type { PilotTopic } from '../src/types/pilot';

const baseTopic: PilotTopic = {
  topic_id: 'bci',
  current_hypothesis: 'BCI remains a parent S4 topic.',
  competing_hypothesis: 'BCI evidence may remain limited to one branch.',
  current_stage: 'S4',
  prior_band: 'medium',
  posterior_direction: 'unchanged',
  event_intensity: 'low',
  tail_structure: 'normal',
  strongest_evidence_ids: ['ev1'],
  why_not_higher_stage: 'Parent evidence remains incomplete.',
  falsification_trigger: 'Parent evidence fails to appear in the validation window.',
  next_validation_window: '4-6 weeks',
  operator_agreement: 'uncertain',
  operator_comment: 'No manual conclusion yet.',
  outcome_status: 'pending',
};

describe('pilot rules', () => {
  it('requires competing hypothesis and falsification trigger', () => {
    expect(validatePilotTopic({ ...baseTopic, competing_hypothesis: '' })).toContain('bci: competing_hypothesis is required');
    expect(validatePilotTopic({ ...baseTopic, falsification_trigger: '' })).toContain('bci: falsification_trigger is required');
  });

  it('allows no-change as a valid wait state', () => {
    expect(pilotActionFor({
      posterior_direction: 'unchanged',
      event_intensity: 'low',
      operator_agreement: 'agree',
      outcome_status: 'pending',
      branch_mutation_detected: false,
      diff_detected_changes: ['no_change'],
    })).toBe('wait');
  });

  it('maps burst, disagreement, and falsification to research-only actions', () => {
    expect(pilotActionFor({
      posterior_direction: 'unchanged',
      event_intensity: 'burst',
      operator_agreement: 'agree',
      outcome_status: 'pending',
      branch_mutation_detected: false,
      diff_detected_changes: [],
    })).toBe('review');
    expect(pilotActionFor({
      posterior_direction: 'down',
      event_intensity: 'medium',
      operator_agreement: 'disagree',
      outcome_status: 'weakened',
      branch_mutation_detected: false,
      diff_detected_changes: [],
    })).toBe('review');
    expect(pilotActionFor({
      posterior_direction: 'up',
      event_intensity: 'high',
      operator_agreement: 'disagree',
      outcome_status: 'falsified',
      branch_mutation_detected: false,
      diff_detected_changes: [],
    })).toBe('flag_risk');
  });

  it('rejects trading advice terms in pilot topics', () => {
    expect(validatePilotTopic({ ...baseTopic, operator_comment: 'No target price is allowed.' }).join(' ')).toContain('trading advice');
  });
});
