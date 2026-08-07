import type { EvidenceNode } from '../../src/domain/evidence';

export const parentS4Evidence: EvidenceNode[] = [
  {
    evidence_id: 'ev_label',
    topic_id: 'sample_topic',
    event_date: '2026-01-01',
  available_at: '2026-01-01',
    event_title: 'Stable label and mapped stock pool',
    event_type: 'label_formation',
    source_name: 'research desk',
    evidence_strength: 'E2',
    affected_layer: ['perception'],
    stage_effect: 'supports_S3',
    parent_or_branch: 'parent',
    confidence: 70,
  },
  {
    evidence_id: 'ev_capital',
    topic_id: 'sample_topic',
    event_date: '2026-01-02',
  available_at: '2026-01-02',
    event_title: 'Capital starts testing leaders and breadth',
    event_type: 'capital_confirmation',
    source_name: 'market data',
    evidence_strength: 'E2',
    affected_layer: ['capital'],
    stage_effect: 'supports_S4',
    parent_or_branch: 'parent',
    confidence: 65,
  },
];

export const parentS5Evidence: EvidenceNode[] = [
  ...parentS4Evidence,
  {
    evidence_id: 'ev_pricing',
    topic_id: 'sample_topic',
    event_date: '2026-01-03',
  available_at: '2026-01-03',
    event_title: 'Valuation model adopts the narrative',
    event_type: 'pricing_adoption',
    source_name: 'institutional model',
    evidence_strength: 'E2',
    affected_layer: ['pricing'],
    stage_effect: 'supports_S5',
    parent_or_branch: 'parent',
    confidence: 68,
  },
];

export const parentS6Evidence: EvidenceNode[] = [
  ...parentS5Evidence,
  {
    evidence_id: 'ev_reality',
    topic_id: 'sample_topic',
    event_date: '2026-01-04',
  available_at: '2026-01-04',
    event_title: 'Revenue evidence validates parent narrative',
    event_type: 'revenue',
    source_name: 'company filing',
    evidence_strength: 'E3',
    affected_layer: ['reality'],
    stage_effect: 'supports_S6',
    parent_or_branch: 'parent',
    confidence: 80,
  },
];

export const branchRealityEvidence: EvidenceNode[] = [
  ...parentS5Evidence.map((item) => ({ ...item, topic_id: 'bci' })),
  {
    evidence_id: 'ev_branch_reality',
    topic_id: 'bci',
    branch_id: 'bci_medical_rehab',
    event_date: '2026-01-05',
  available_at: '2026-01-05',
    event_title: 'Medical rehab BCI regulatory validation',
    event_type: 'regulatory_approval',
    source_name: 'regulator',
    evidence_strength: 'E3',
    affected_layer: ['reality'],
    stage_effect: 'supports_branch_S5_to_S6',
    parent_or_branch: 'branch',
    branch_coverage_score: 45,
    confidence: 82,
  },
];
