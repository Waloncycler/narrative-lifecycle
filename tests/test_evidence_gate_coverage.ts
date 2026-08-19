import { describe, expect, it } from 'vitest';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { buildEvidenceGateCoverage } from '@/features/research/domain/evidence_gate_coverage';

const asOf = '2026-07-05T00:00:00.000Z';

function ev(partial: Partial<EvidenceNode> & { evidence_id: string; affected_layer: EvidenceNode['affected_layer'] }): EvidenceNode {
  return {
    topic_id: 't1',
    branch_id: null,
    event_date: '2026-06-01',
    available_at: '2026-06-01',
    event_title: partial.evidence_id,
    event_type: 'test',
    source_name: 'source-a',
    source_type: 'official',
    evidence_strength: 'E3',
    stage_effect: 'maintain',
    parent_or_branch: 'parent',
    confidence: 80,
    ...partial,
  } as EvidenceNode;
}

describe('evidence gate coverage', () => {
  it('flags a gate with no evidence as missing and puts it on the worklist', () => {
    const report = buildEvidenceGateCoverage({
      topics: [{ topic_id: 't1', topic_name: 'Topic One', current_stage: 'S2', status: 'active' }],
      evidence: [ev({ evidence_id: 'e1', affected_layer: ['perception'] })],
      asOf,
    });
    const pricing = report.topics[0].gates.find((g) => g.gate === 'pricing');
    expect(pricing?.verdict).toBe('missing');
    expect(pricing?.evidence_count).toBe(0);
    // A missing foundational-ish gate should surface on the worklist.
    expect(report.acquisition_worklist.some((task) => task.gate === 'pricing' && task.verdict === 'missing')).toBe(true);
  });

  it('treats a gate backed by one publisher as single_source, not covered', () => {
    const report = buildEvidenceGateCoverage({
      topics: [{ topic_id: 't1', topic_name: 'Topic One', current_stage: 'S3', status: 'active' }],
      evidence: [
        ev({ evidence_id: 'c1', affected_layer: ['capital'], source_name: 'same-desk' }),
        ev({ evidence_id: 'c2', affected_layer: ['capital'], source_name: 'same-desk' }),
      ],
      asOf,
    });
    const capital = report.topics[0].gates.find((g) => g.gate === 'capital');
    expect(capital?.independent_publishers).toBe(1);
    expect(capital?.verdict).toBe('single_source');
  });

  it('counts capital from two independent publishers as covered', () => {
    const report = buildEvidenceGateCoverage({
      topics: [{ topic_id: 't1', topic_name: 'Topic One', current_stage: 'S3', status: 'active' }],
      evidence: [
        ev({ evidence_id: 'c1', affected_layer: ['capital'], source_name: 'desk-a', evidence_strength: 'E3' }),
        ev({ evidence_id: 'c2', affected_layer: ['capital'], source_name: 'desk-b', evidence_strength: 'E4' }),
      ],
      asOf,
    });
    const capital = report.topics[0].gates.find((g) => g.gate === 'capital');
    expect(capital?.independent_publishers).toBe(2);
    expect(capital?.verdict).toBe('covered');
  });

  it('normalizes the drifted `name` layer into the stable-label gate', () => {
    const report = buildEvidenceGateCoverage({
      topics: [{ topic_id: 't1', topic_name: 'Topic One', status: 'active' }],
      evidence: [
        ev({ evidence_id: 'n1', affected_layer: ['reality', 'name'] as EvidenceNode['affected_layer'], source_name: 'gov' }),
      ],
      asOf,
    });
    const label = report.topics[0].gates.find((g) => g.gate === 'stable_label');
    expect(label?.evidence_count).toBe(1);
    expect(label?.verdict).not.toBe('missing');
  });

  it('ranks missing gates ahead of thin ones on the worklist', () => {
    const report = buildEvidenceGateCoverage({
      topics: [{ topic_id: 't1', topic_name: 'Topic One', status: 'active' }],
      evidence: [ev({ evidence_id: 'e1', affected_layer: ['perception'], evidence_strength: 'E1' })],
      asOf,
    });
    const priorities = report.acquisition_worklist.map((task) => task.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
    expect(report.acquisition_worklist[0].verdict === 'missing' || report.acquisition_worklist[0].verdict === 'single_source').toBe(true);
  });
});
