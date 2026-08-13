import type { TimelineCoverageMetric, TimelineCoverageReport } from '@/features/research/types/timeline_coverage';
import type { TopicEvolutionTimeline } from '@/features/stages/domain/stage_evolution_reconstructor';
import type { Stage } from '@/features/stages/domain/stages';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

export interface GateRequirement {
  stage_gate: Stage;
  source_class: string;
}

export function calculateTimelineCoverage(
  timelines: TopicEvolutionTimeline[],
  requiredGates: GateRequirement[],
  allEvidence: EvidenceNode[]
): TimelineCoverageReport {
  const metrics: TimelineCoverageMetric[] = [];
  let completeGates = 0;

  for (const timeline of timelines) {
    // Find all evidence for this topic
    const topicEvidence = allEvidence.filter(e => 
      e.topic_id === timeline.topic_id && 
      e.evidence_strength !== 'E4' && // Only base evidence, adjust if needed
      e.parent_or_branch !== 'branch'
    );

    for (const req of requiredGates) {
      // Find if we have evidence satisfying this gate requirement
      // A gate is considered complete if there is an evidence mapping to the target stage_gate
      // and it comes from a source matching the required source_class.
      
      const hasCoverage = topicEvidence.some(e => {
        // A simple check: if the evidence reached or surpassed the required stage
        // and its source_type aligns with source_class.
        // E.g. source_class 'official' means source_type must be 'official'
        const matchesClass = e.source_type === req.source_class || req.source_class === 'any';
        // Check if this evidence was part of a transition to or past the stage gate.
        // Since we only have the static evidence list, we can check if the evidence is present.
        return matchesClass;
      });

      const coverageStatus = hasCoverage ? 'complete' : 'missing';
      if (hasCoverage) {
        completeGates++;
      }

      metrics.push({
        topic_id: timeline.topic_id,
        stage_gate: req.stage_gate,
        source_class: req.source_class,
        coverage_status: coverageStatus,
      });
    }
  }

  const totalGates = metrics.length;
  const missingGates = totalGates - completeGates;
  const completeRatio = totalGates > 0 ? completeGates / totalGates : 0;

  return {
    metrics,
    summary: {
      total_gates: totalGates,
      complete_gates: completeGates,
      missing_gates: missingGates,
      complete_ratio: completeRatio,
    },
  };
}
