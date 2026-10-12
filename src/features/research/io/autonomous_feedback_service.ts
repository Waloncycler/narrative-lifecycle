import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { EvidenceCandidate, EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { AutonomousPromotionReport } from '@/features/research/types/autonomous_research';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { FRONTIER_ECOSYSTEM_REGISTRY } from '@/features/narrative/domain/intelligent_topic_resolver';

export interface AutonomousFeedbackMetrics {
  total_candidates: number;
  published_evidence_count: number;
  held_candidates_count: number;
  unresolved_topic_count: number;
  high_confidence_ratio: number;
  average_evidence_strength: string;
}

export interface TopicEvidenceGap {
  topic_id: string;
  topic_name: string;
  domain: string;
  priority: number;
  current_evidence_count: number;
  gap_severity: 'critical' | 'high' | 'moderate' | 'healthy';
  recommended_queries: string[];
}

export interface EmergingTermDiscovery {
  term: string;
  frequency: number;
  sample_quotes: string[];
  suggested_topic_hint: string | null;
}

export interface AutonomousNextCyclePlan {
  plan_id: string;
  generated_at: string;
  priority_topics: Array<{
    topic_id: string;
    topic_name: string;
    target_queries: string[];
    target_sources: string[];
  }>;
  evolution_recommendations: string[];
}

export interface AutonomousFeedbackReport {
  artifact_type: 'autonomous_feedback_report';
  schema_version: '1.0.0';
  generated_at: string;
  run_id: string;
  metrics: AutonomousFeedbackMetrics;
  topic_gaps: TopicEvidenceGap[];
  emerging_terms: EmergingTermDiscovery[];
  next_cycle_plan: AutonomousNextCyclePlan;
}

export class AutonomousFeedbackService {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  /**
   * Evaluates the latest agent execution, extracts evidence gaps & emerging terms,
   * updates the persistent feedback ledger, and generates the autonomous next-cycle plan.
   */
  evaluateRun(input: {
    runId: string;
    session: EvidenceIntakeSession | null;
    promotionReport: AutonomousPromotionReport | null;
    registry: TopicRegistry;
    operationalEvidence: EvidenceNode[];
  }): AutonomousFeedbackReport {
    const generatedAt = new Date().toISOString();
    const candidates = input.session?.candidates ?? [];
    const published = input.promotionReport?.published_evidence_ids ?? [];
    const held = input.promotionReport?.held_count ?? 0;

    // 1. Compute Metrics
    const unresolvedCount = candidates.filter((c) => !c.suggested_evidence.topic_id || c.suggested_evidence.topic_id === 'unknown_topic').length;
    const highConfCount = candidates.filter((c) => c.suggested_evidence.confidence === 'high').length;
    const highConfRatio = candidates.length ? Math.round((highConfCount / candidates.length) * 100) / 100 : 0;

    const metrics: AutonomousFeedbackMetrics = {
      total_candidates: candidates.length,
      published_evidence_count: published.length,
      held_candidates_count: held,
      unresolved_topic_count: unresolvedCount,
      high_confidence_ratio: highConfRatio,
      average_evidence_strength: published.length ? 'E1-E2' : 'E0',
    };

    // 2. Identify Topic Evidence Gaps
    const evidenceByTopic = new Map<string, number>();
    for (const ev of input.operationalEvidence) {
      evidenceByTopic.set(ev.topic_id, (evidenceByTopic.get(ev.topic_id) ?? 0) + 1);
    }

    const topicGaps: TopicEvidenceGap[] = FRONTIER_ECOSYSTEM_REGISTRY.map((eco) => {
      const count = evidenceByTopic.get(eco.topic_id) ?? 0;
      let gap_severity: TopicEvidenceGap['gap_severity'] = 'healthy';
      if (count === 0) gap_severity = 'critical';
      else if (count < 3) gap_severity = 'high';
      else if (count < 6) gap_severity = 'moderate';

      const sampleEntity = eco.key_entities[0] ?? eco.display_name_zh;
      const sampleTech = eco.core_technologies[0] ?? eco.display_name_en;
      const recommended_queries = [
        `${eco.display_name_zh} ${sampleTech} 最新进展 突破`,
        `${eco.display_name_en} ${sampleTech} breakthrough commercial validation`,
        `${sampleEntity} ${sampleTech} clinical trial patent regulatory`,
      ];

      return {
        topic_id: eco.topic_id,
        topic_name: eco.display_name_zh,
        domain: eco.domain,
        priority: gap_severity === 'critical' ? 5 : gap_severity === 'high' ? 4 : 3,
        current_evidence_count: count,
        gap_severity,
        recommended_queries,
      };
    }).sort((a, b) => b.priority - a.priority);

    // 3. Extract Emerging / Unrecognized Terms from Unresolved Candidates
    const emergingTerms = this.extractEmergingTerms(candidates);

    // 4. Synthesize Autonomous Next-Cycle Plan
    const criticalGaps = topicGaps.filter((g) => g.gap_severity === 'critical' || g.gap_severity === 'high').slice(0, 4);
    const next_cycle_plan: AutonomousNextCyclePlan = {
      plan_id: `plan_${Date.now().toString(36)}`,
      generated_at: generatedAt,
      priority_topics: criticalGaps.map((gap) => ({
        topic_id: gap.topic_id,
        topic_name: gap.topic_name,
        target_queries: gap.recommended_queries,
        target_sources: ['miit', 'sec_edgar', 'clinicaltrials', 'arxiv', 'cnipa'],
      })),
      evolution_recommendations: [
        `Prioritize multi-source deep mining for critical-gap topics: ${criticalGaps.map((g) => g.topic_name).join(', ')}.`,
        `Reinforce bilingual technical keywords for emerging terms: ${emergingTerms.slice(0, 3).map((t) => t.term).join(', ') || 'none'}.`,
        'Maintain automatic pacing and exponential backoff on all API calls.',
      ],
    };

    const report: AutonomousFeedbackReport = {
      artifact_type: 'autonomous_feedback_report',
      schema_version: '1.0.0',
      generated_at: generatedAt,
      run_id: input.runId,
      metrics,
      topic_gaps: topicGaps,
      emerging_terms: emergingTerms,
      next_cycle_plan,
    };

    // 5. Persist to ledger file
    this.persistReport(report);

    return report;
  }

  private extractEmergingTerms(candidates: EvidenceCandidate[]): EmergingTermDiscovery[] {
    const termFrequency = new Map<string, { count: number; samples: string[] }>();
    const unresolved = candidates.filter((c) => c.suggested_evidence.topic_id === 'unknown_topic' || c.suggested_evidence.confidence === 'low');

    for (const c of unresolved) {
      const text = `${c.suggested_evidence.event_title} ${c.original_quote}`;
      // Extract English capital acronyms & technology-like patterns
      const technicalMatches = text.match(/\b[A-Z][a-zA-Z0-9-]{3,15}\b|[\u4e00-\u9fff]{3,6}(?:材料|技术|芯片|系统|电极|聚合物|大模型|核能)/g) ?? [];
      for (const rawTerm of technicalMatches) {
        const term = rawTerm.trim();
        if (term.length < 3 || ['The', 'And', 'For', 'With', 'From', 'About', 'This', 'That'].includes(term)) continue;
        const current = termFrequency.get(term) ?? { count: 0, samples: [] };
        current.count += 1;
        if (current.samples.length < 2) current.samples.push(c.suggested_evidence.event_title);
        termFrequency.set(term, current);
      }
    }

    return Array.from(termFrequency.entries())
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([term, data]) => ({
        term,
        frequency: data.count,
        sample_quotes: data.samples,
        suggested_topic_hint: null,
      }));
  }

  private persistReport(report: AutonomousFeedbackReport): void {
    const dir = resolve(this.repoRoot, 'data/governance');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const reportPath = resolve(dir, 'latest_autonomous_feedback_report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Also update history ledger
    const historyPath = resolve(dir, 'autonomous_evolution_history.json');
    let history: AutonomousFeedbackReport[] = [];
    if (existsSync(historyPath)) {
      try {
        history = JSON.parse(readFileSync(historyPath, 'utf8'));
      } catch {}
    }
    history.unshift(report);
    if (history.length > 30) history = history.slice(0, 30);
    writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  }
}
