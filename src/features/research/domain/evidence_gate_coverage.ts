/**
 * Evidence gate-coverage / acquisition worklist (pure domain).
 *
 * Turns "why is this stage wrong / what do we lack" into a concrete, ranked
 * list of what to go collect. For each topic it measures, per stage gate, how
 * much graded support exists and — crucially — from how many *independent
 * publishers*. A gate resting on a single source (or none) is the acquisition
 * target: it is exactly where the reported stage is least trustworthy.
 *
 * This is deterministic and reuses `aggregateLayerSupport` from the quantitative
 * engine. It is the worklist the intelligent (LLM-driven) retrieval layer will
 * execute against, and it is useful on its own to see where the corpus is thin.
 */
import type { EvidenceLayer, EvidenceNode } from '@/features/evidence/domain/evidence';
import type { Stage } from '@/features/stages/domain/stages';
import { aggregateLayerSupport } from '@/features/scoring/domain/quantitative_framework';

export type GateName = 'stable_label' | 'capital' | 'pricing' | 'hard_reality';
export type CoverageVerdict = 'missing' | 'single_source' | 'thin' | 'covered';

export interface GateCoverage {
  gate: GateName;
  layer: EvidenceLayer;
  /** The stage this gate unlocks. */
  unlocks_stage: Stage;
  net_support: number;
  independent_publishers: number;
  evidence_count: number;
  verdict: CoverageVerdict;
  /** Classes of data that would substantiate this gate for this topic. */
  suggested_targets: string[];
}

export interface TopicGateCoverage {
  topic_id: string;
  topic_name: string;
  current_stage: string;
  gates: GateCoverage[];
}

export interface AcquisitionTask {
  topic_id: string;
  topic_name: string;
  gate: GateName;
  layer: EvidenceLayer;
  verdict: CoverageVerdict;
  net_support: number;
  independent_publishers: number;
  /** Higher = more worth collecting next. */
  priority: number;
  suggested_targets: string[];
}

export interface GateCoverageReport {
  generated_at: string;
  as_of: string;
  topic_count: number;
  topics: TopicGateCoverage[];
  acquisition_worklist: AcquisitionTask[];
}

const GATES: ReadonlyArray<{ gate: GateName; layer: EvidenceLayer; unlocks: Stage; targets: string[] }> = [
  {
    gate: 'stable_label', layer: 'perception', unlocks: 'S3',
    targets: ['概念/主题板块成分（东财、同花顺）', '申万/中信分类变更', '主题进入 ETF/基金名称', '卖方研报标题采纳该词'],
  },
  {
    gate: 'capital', layer: 'capital', unlocks: 'S4',
    targets: ['北向/沪深港通持股明细', '龙虎榜', 'ETF 净流入', '一级融资金额+领投方', '定增/IPO 受理'],
  },
  {
    gate: 'pricing', layer: 'pricing', unlocks: 'S5',
    targets: ['目标价与估值方法切换（PE→PS/EV-EBITDA）', '一致预期 EPS 修正', '远期倍数重估', 'IPO 定价可比', '指数/ETF 估值分位'],
  },
  {
    gate: 'hard_reality', layer: 'reality', unlocks: 'S6',
    targets: ['中标公告/合同', '监管批文（NMPA/CDE/FDA/CAAC/工信部目录）', '出货量/产能（海关、行业协会）', '定期报告收入确认（巨潮）'],
  },
];

/** Minimum graded net-support (0-100) below which a gate reads as thin. */
const THIN_SUPPORT = 30;

function verdictFor(evidenceCount: number, publishers: number, netSupport: number): CoverageVerdict {
  if (evidenceCount === 0) return 'missing';
  if (publishers <= 1) return 'single_source';
  if (netSupport < THIN_SUPPORT) return 'thin';
  return 'covered';
}

function priorityFor(coverage: GateCoverage): number {
  // Gates that unlock a lower stage are foundational — a missing stable label
  // matters more than a missing hard-reality gate for an early topic. Rank
  // missing/single-source highest, then by how foundational the gate is.
  const verdictWeight: Record<CoverageVerdict, number> = { missing: 40, single_source: 30, thin: 15, covered: 0 };
  const foundational: Record<GateName, number> = { stable_label: 4, capital: 3, pricing: 2, hard_reality: 1 };
  return verdictWeight[coverage.verdict] + foundational[coverage.gate];
}

export function buildEvidenceGateCoverage(input: {
  topics: Array<{ topic_id: string; topic_name: string; current_stage?: string; status?: string }>;
  evidence: EvidenceNode[];
  asOf: string;
  generatedAt?: string;
  /** When true, only topics that already carry evidence are reported. */
  onlyWithEvidence?: boolean;
}): GateCoverageReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const topics: TopicGateCoverage[] = [];
  const worklist: AcquisitionTask[] = [];

  for (const topic of input.topics) {
    const parentEvidence = input.evidence.filter(
      (item) => item.topic_id === topic.topic_id && (item.parent_or_branch === 'parent' || !item.parent_or_branch),
    );
    if (input.onlyWithEvidence && parentEvidence.length === 0) continue;

    const gates: GateCoverage[] = GATES.map(({ gate, layer, unlocks, targets }) => {
      const support = aggregateLayerSupport(parentEvidence, layer, input.asOf);
      const layerEvidence = parentEvidence.filter((item) => item.affected_layer.includes(layer)
        || (layer === 'perception' && (item.affected_layer as readonly string[]).includes('name')));
      const publishers = new Set(layerEvidence.map((item) => (item.source_name ?? item.evidence_id).trim().toLowerCase())).size;
      const coverage: GateCoverage = {
        gate,
        layer,
        unlocks_stage: unlocks,
        net_support: Math.round(support.net_support),
        independent_publishers: publishers,
        evidence_count: layerEvidence.length,
        verdict: verdictFor(layerEvidence.length, publishers, support.net_support),
        suggested_targets: targets,
      };
      return coverage;
    });

    topics.push({
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      current_stage: topic.current_stage ?? 'S0',
      gates,
    });

    for (const coverage of gates) {
      if (coverage.verdict === 'covered') continue;
      worklist.push({
        topic_id: topic.topic_id,
        topic_name: topic.topic_name,
        gate: coverage.gate,
        layer: coverage.layer,
        verdict: coverage.verdict,
        net_support: coverage.net_support,
        independent_publishers: coverage.independent_publishers,
        priority: priorityFor(coverage),
        suggested_targets: coverage.suggested_targets,
      });
    }
  }

  worklist.sort((a, b) => b.priority - a.priority || a.topic_id.localeCompare(b.topic_id));

  return {
    generated_at: generatedAt,
    as_of: input.asOf,
    topic_count: topics.length,
    topics,
    acquisition_worklist: worklist,
  };
}
