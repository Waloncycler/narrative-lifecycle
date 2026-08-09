import type { ResearchLeadSourceClass, ResearchLeadTriageReport } from '@/features/research/types/research_lead_triage';
import type { ResearchSourceRetrievalReport } from '@/features/research/types/research_source_retrieval';

/** A curated, source-backed research brief. It is an input to retrieval, not
 * a Topic, Evidence import, or lifecycle conclusion. */
export interface ResearchPack {
  pack_id: string;
  title: string;
  description: string;
  research_questions: string[];
  /** Taxonomy is proposal-only until Topic Resolver and Evidence policy accept it. */
  proposed_taxonomy: {
    parent_name: string;
    parent_topic_id: string | null;
    proposed_branches: Array<{ branch_name: string; branch_id: string | null; rationale: string }>;
  };
  sources: ResearchPackSource[];
  guardrail_check: {
    source_urls_are_retrieval_targets_not_evidence: true;
    proposed_taxonomy_is_not_auto_registered: true;
    parent_branch_separation: true;
    no_auto_evidence_import: true;
    no_trading_advice: true;
  };
}

export interface ResearchPackSource {
  source_id: string;
  title: string;
  url: string;
  published_at: string | null;
  topic_id: string | null;
  branch_id: string | null;
  /** Candidate node is allowed for a genuinely new scope, but cannot inherit stage. */
  candidate_node_id: string | null;
  source_class: ResearchLeadSourceClass;
  rationale: string;
}

export interface ResearchPackRetrievalReport {
  artifact_type: 'research_pack_retrieval_report';
  schema_version: '1.0.0';
  producer_version: string;
  pack_id: string;
  title: string;
  generated_at: string;
  research_questions: string[];
  proposed_taxonomy: ResearchPack['proposed_taxonomy'];
  triage: ResearchLeadTriageReport;
  retrieval: ResearchSourceRetrievalReport;
  guardrail_check: ResearchPack['guardrail_check'];
}
