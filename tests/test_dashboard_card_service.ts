import { describe, expect, it } from 'vitest';
import { createDashboardCard } from '../src/services/dashboard_card_service';

const baseCardInput = {
  card_id: 'card_test',
  topic_id: 'test_topic',
  topic_name: 'Test Topic',
  as_of_date: '2026-07-05',
  current_stage: 'S4',
  transition_target: 'S5',
  stage_confidence: 70,
  stage_reasoning: 'Structured evidence supports S4.',
  why_not_lower_stage: 'Stable label and capital confirmation exist.',
  why_not_higher_stage: 'Pricing adoption and hard reality evidence are incomplete.',
  stage_snapshot: {
    current_stage: 'S4',
    max_allowed_stage: 'S4',
    why_not_higher_stage: 'Pricing adoption and hard reality evidence are incomplete.',
    evidence_ids: ['ev_1'],
    data_confidence_cap_applied: false,
  },
  parent_narrative: 'Test parent narrative',
  key_branches: [
    {
      branch_id: 'test_branch',
      branch_name: 'test branch',
      current_stage: 'S3',
      evidence_ids: ['ev_1'],
      branch_coverage_score: 20,
      parent_lift_assessment: 'Branch evidence cannot lift parent automatically.',
    },
  ],
  key_events: [
    {
      evidence_id: 'ev_1',
      event_title: 'test evidence',
      reason_used: 'stage gate evidence',
    },
  ],
  evidence_ids: ['ev_1'],
  score_id: 'score_test',
  scores: {
    data_confidence: {
      score: 70,
      evidence_ids: ['ev_1'],
      reasoning: 'Evidence-backed confidence.',
      missing_data: [],
      confidence: 70,
    },
  },
  data_confidence: 70,
  next_triggers: ['pricing adoption evidence'],
  failure_signals: ['branch pollution'],
  action: 'validation tracking' as const,
  review_window: 'weekly',
};

describe('dashboard card service', () => {
  it('requires why_not_higher_stage and research-only actions', () => {
    expect(createDashboardCard(baseCardInput).why_not_higher_stage).toContain('Pricing adoption');

    expect(() =>
      createDashboardCard({
        ...baseCardInput,
        why_not_higher_stage: '',
      }),
    ).toThrow('Dashboard Card requires why_not_higher_stage');

    expect(() =>
      createDashboardCard({
        ...baseCardInput,
        action: 'buy' as never,
      }),
    ).toThrow('Dashboard action must be a research action');

    expect(() =>
      createDashboardCard({
        ...baseCardInput,
        current_stage: 'S6',
        stage_snapshot: {
          ...baseCardInput.stage_snapshot,
          current_stage: 'S6',
          max_allowed_stage: 'S6',
        },
        data_confidence: 40,
      }),
    ).toThrow('Dashboard Card current_stage exceeds Data Confidence cap');
  });
});
