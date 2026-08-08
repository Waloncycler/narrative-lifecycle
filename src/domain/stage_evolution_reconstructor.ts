/**
 * Stage Evolution Timeline Reconstructor
 *
 * Reconstructs the complete stage evolution history for each topic by
 * chronologically replaying evidence and evaluating stage gates at each
 * point in time. This reveals WHEN each stage transition occurred and
 * WHICH evidence caused it — even when all evidence was ingested in a
 * single batch.
 *
 * Key design: sort evidence by `event_date` ascending, then accumulate
 * and re-evaluate stage gates after each new evidence node arrives.
 */
import type { EvidenceNode } from './evidence';
import { inferStageGateInput, type StageClassification } from './stage_classifier';
import { maxAllowedStage } from '@/rules/stage_gate_rules';
import { capStageByDataConfidence } from '@/rules/data_confidence_rules';
import { stageRank, type Stage } from './stages';

/** The linear stage ladder used to expand multi-gate jumps into single steps.
 * Index equals stageRank, so STAGE_LADDER[rank] is that rank's stage. */
const STAGE_LADDER: Stage[] = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface StageTransition {
  /** Previous stage before this transition */
  from_stage: Stage | 'S0';
  /** New stage after this transition */
  to_stage: Stage;
  /** Date when the transition-triggering evidence occurred */
  transition_date: string;
  /** The evidence node that caused the gate to be newly satisfied */
  trigger_evidence_id: string;
  /** Title of the triggering evidence */
  trigger_evidence_title: string;
  /** Source URL of the triggering evidence */
  trigger_evidence_url: string;
  /** Which gate was newly satisfied to enable this transition */
  gate_unlocked: string;
  /** True when this is a filled intermediate rung on the ladder rather than a
   * step with its own distinct triggering evidence. The narrative genuinely
   * passed through this stage, but the same evidence that cleared the next real
   * gate is what carried it here — a signal that intermediate evidence is still
   * missing and worth collecting. */
  interpolated?: boolean;
  /** All evidence IDs accumulated up to this transition point */
  cumulative_evidence_ids: string[];
  /** Cumulative gate state after this transition */
  gate_state: {
    hasStableLabel: boolean;
    hasCapitalConfirmation: boolean;
    hasPricingAdoption: boolean;
    hasHardRealityEvidence: boolean;
  };
}

export interface TopicEvolutionTimeline {
  topic_id: string;
  topic_name: string;
  /** The very first evidence date — when this topic narrative first appeared */
  first_emergence_date: string;
  /** Current stage after all evidence is considered */
  current_stage: Stage | 'S0';
  /** Total evidence count for this topic */
  total_evidence_count: number;
  /** Ordered list of stage transitions, earliest first */
  transitions: StageTransition[];
  /** Summary of the evolution path, e.g. "S0 → S2 → S4 → S6" */
  evolution_path: string;
  /** Full chronological evidence timeline with stage at each point */
  evidence_timeline: EvidenceTimelineEntry[];
}

export interface EvidenceTimelineEntry {
  event_date: string;
  evidence_id: string;
  event_title: string;
  source_name: string;
  source_url: string;
  affected_layer: string[];
  evidence_strength: string;
  /** Stage AFTER this evidence is incorporated */
  stage_after: Stage | 'S0';
  /** Max allowed stage AFTER this evidence */
  max_allowed_after: Stage | 'S0';
  /** Whether this evidence caused a stage transition */
  caused_transition: boolean;
}

// ---------------------------------------------------------------------------
// Core Reconstruction Logic
// ---------------------------------------------------------------------------

/**
 * Reconstruct the complete stage evolution timeline for a single topic.
 *
 * Algorithm:
 * 1. Filter evidence to parent-scope only (or fallback to all topic evidence)
 * 2. Sort by event_date ascending (chronological order)
 * 3. Accumulate evidence one-by-one and evaluate stage gates at each step
 * 4. Detect stage transitions and record them with trigger evidence
 */
export function reconstructTopicEvolution(
  topicId: string,
  topicName: string,
  allEvidence: EvidenceNode[],
): TopicEvolutionTimeline {
  const topicEvidence = allEvidence.filter((e) => e.topic_id === topicId);
  const parentEvidence = topicEvidence.filter(
    (e) => e.parent_or_branch === 'parent' || !e.branch_id,
  );

  // Use parent evidence for stage evaluation; if none, the topic stays at S0
  const evaluationEvidence = parentEvidence.length > 0 ? parentEvidence : [];

  if (evaluationEvidence.length === 0) {
    return {
      topic_id: topicId,
      topic_name: topicName,
      first_emergence_date: 'N/A',
      current_stage: 'S0',
      total_evidence_count: topicEvidence.length,
      transitions: [],
      evolution_path: 'S0',
      evidence_timeline: [],
    };
  }

  // Sort chronologically by event_date
  const sorted = [...evaluationEvidence].sort((a, b) =>
    a.event_date.localeCompare(b.event_date),
  );

  const transitions: StageTransition[] = [];
  const evidenceTimeline: EvidenceTimelineEntry[] = [];
  const accumulated: EvidenceNode[] = [];
  let currentStage: Stage | 'S0' = 'S0';
  const stageSequence: string[] = ['S0'];

  for (const evidence of sorted) {
    accumulated.push(evidence);

    // Evaluate gate state with accumulated evidence. The Data Confidence cap is
    // applied here for the same reason classifyStage applies it: a thin or
    // conflicting evidence base must not read as a fully validated narrative.
    // Without it the timeline and the stage snapshot report different stages
    // for the same topic.
    const gateInput = inferStageGateInput(accumulated);
    const newMaxStage = capStageByDataConfidence(maxAllowedStage(gateInput), averageConfidence(accumulated));
    const newStage = newMaxStage;

    const causedTransition = newStage !== currentStage;

    evidenceTimeline.push({
      event_date: evidence.event_date,
      evidence_id: evidence.evidence_id,
      event_title: evidence.event_title,
      source_name: evidence.source_name,
      source_url: evidence.source_url ?? '',
      affected_layer: evidence.affected_layer,
      evidence_strength: evidence.evidence_strength,
      stage_after: newStage,
      max_allowed_after: newMaxStage,
      caused_transition: causedTransition,
    });

    if (causedTransition && stageRank[newStage] > stageRank[currentStage]) {
      // Enforce a strictly continuous ladder: a single evidence event may clear
      // several gates at once (e.g. stable label + hard reality), but the
      // timeline must never draw an edge that skips a stage. Expand the jump
      // into consecutive single-rung transitions S(n) -> S(n+1). The final rung
      // is the genuine gate unlock; any rung below it is a filled intermediate
      // step, flagged `interpolated` because it still lacks its own evidence.
      const gateUnlocked = identifyUnlockedGate(currentStage, newStage, gateInput);
      const fromRank = stageRank[currentStage];
      const toRank = stageRank[newStage];
      for (let rank = fromRank + 1; rank <= toRank; rank += 1) {
        const stepFrom = STAGE_LADDER[rank - 1];
        const stepTo = STAGE_LADDER[rank];
        const isFinalRung = rank === toRank;
        transitions.push({
          from_stage: stepFrom,
          to_stage: stepTo,
          transition_date: evidence.event_date,
          trigger_evidence_id: evidence.evidence_id,
          trigger_evidence_title: evidence.event_title,
          trigger_evidence_url: evidence.source_url ?? '',
          gate_unlocked: isFinalRung
            ? gateUnlocked
            : `sequential fill ${stepFrom} → ${stepTo} (no distinct evidence yet)`,
          interpolated: !isFinalRung,
          cumulative_evidence_ids: accumulated.map((e) => e.evidence_id),
          gate_state: { ...gateInput },
        });
        if (!stageSequence.includes(stepTo)) stageSequence.push(stepTo);
      }
      currentStage = newStage;
    } else if (causedTransition) {
      // Stage regression (e.g. later evidence lowers confidence). Record the
      // single step without laddering; regressions are already single-stage in
      // practice and must remain visible.
      transitions.push({
        from_stage: currentStage,
        to_stage: newStage,
        transition_date: evidence.event_date,
        trigger_evidence_id: evidence.evidence_id,
        trigger_evidence_title: evidence.event_title,
        trigger_evidence_url: evidence.source_url ?? '',
        gate_unlocked: identifyUnlockedGate(currentStage, newStage, gateInput),
        cumulative_evidence_ids: accumulated.map((e) => e.evidence_id),
        gate_state: { ...gateInput },
      });
      currentStage = newStage;
      if (!stageSequence.includes(newStage)) stageSequence.push(newStage);
    }
  }

  // Build intermediate stages that were skipped
  const fullPath = buildFullEvolutionPath(stageSequence);

  return {
    topic_id: topicId,
    topic_name: topicName,
    first_emergence_date: sorted[0].event_date,
    current_stage: currentStage,
    total_evidence_count: topicEvidence.length,
    transitions,
    evolution_path: fullPath,
    evidence_timeline: evidenceTimeline,
  };
}

/**
 * Reconstruct evolution timelines for ALL topics in the system.
 */
export function reconstructAllTopicEvolutions(
  allEvidence: EvidenceNode[],
  topicRegistry: Array<{ topic_id: string; topic_name: string }>,
): TopicEvolutionTimeline[] {
  return topicRegistry.map((topic) =>
    reconstructTopicEvolution(topic.topic_id, topic.topic_name, allEvidence),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Identify which gate was newly unlocked to cause the stage jump */
function identifyUnlockedGate(
  fromStage: Stage | 'S0',
  toStage: Stage,
  gateInput: { hasStableLabel: boolean; hasCapitalConfirmation: boolean; hasPricingAdoption: boolean; hasHardRealityEvidence: boolean },
): string {
  // The gates unlock in order: stableLabel (S2→S3), capital (S3→S4), pricing (S4→S5), reality (S5→S6)
  const gates: Array<{ gate: string; satisfied: boolean; unlockStage: string }> = [
    { gate: 'stable_label (perception)', satisfied: gateInput.hasStableLabel, unlockStage: 'S3' },
    { gate: 'capital_confirmation', satisfied: gateInput.hasCapitalConfirmation, unlockStage: 'S4' },
    { gate: 'pricing_adoption', satisfied: gateInput.hasPricingAdoption, unlockStage: 'S5' },
    { gate: 'hard_reality_evidence', satisfied: gateInput.hasHardRealityEvidence, unlockStage: 'S6' },
  ];

  // Find which gates are newly relevant for the jump
  const unlockedGates = gates
    .filter((g) => g.satisfied)
    .map((g) => g.gate);

  if (fromStage === 'S0' || fromStage === 'S1') {
    // First evidence arrived — basic reality gate
    return `first_evidence → ${unlockedGates.join(' + ') || 'basic_evidence'}`;
  }

  return unlockedGates.join(' + ') || 'cumulative_evidence';
}

/** Build the full evolution path string, including intermediate jumps */
function buildFullEvolutionPath(stages: string[]): string {
  return stages.join(' → ');
}

/** Mirrors the operational snapshot's fallback when confidence is unrecorded. */
function averageConfidence(evidence: EvidenceNode[]): number {
  const values = evidence.map((item) => item.confidence).filter((item): item is number => typeof item === 'number');
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 45;
}
