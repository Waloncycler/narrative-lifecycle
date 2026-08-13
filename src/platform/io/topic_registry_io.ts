import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { EvidenceCandidate, EvidenceIntakeSession, AiCandidateSuggestion } from '@/features/intake/types/intake';
import type { AliasRecord, BranchRecord, CanonicalTopicRecord, ProvisionalTopicRecord, TopicRegistry, TopicResolution, TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { NarrativeMemory } from '@/features/narrative/domain/reactivation';
import type { NarrativeGraphPromotionReport } from '@/features/narrative/types/narrative_graph_promotion';
import { DbArtifactRepository } from '@/platform/io/db_artifact_repository';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

export const TOPIC_RESOLUTION_AUDIT_PATH = 'outputs/intake/latest_topic_resolution_audit.json';
export const TOPIC_UNRESOLVED_QUEUE_PATH = 'outputs/intake/latest_unresolved_queue.json';
export const TOPIC_REGISTRY_VALIDATION_PATH = 'outputs/intake/latest_topic_registry_validation.json';

export class TopicRegistryArtifactRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  readTopicRegistry(): TopicRegistry {
    return {
      canonical_topics: this.readYaml<CanonicalTopicRecord[]>('data/topic_registry/canonical_topics.yaml', []),
      aliases: this.readYaml<AliasRecord[]>('data/topic_registry/aliases.yaml', []),
      branches: this.readYaml<BranchRecord[]>('data/topic_registry/branches.yaml', []),
      provisional_topics: this.readYaml<ProvisionalTopicRecord[]>('data/topic_registry/provisional_topics.yaml', []),
      memory_topic_ids: this.readMemoryTopicIds(),
    };
  }

  writeTopicResolutionAudit(audit: TopicResolutionAudit): void {
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact(`audit_${audit.audit_id}`, 'topic_resolution_audit', audit, renderTopicAuditMarkdown(audit));
    dbArtifact.writeArtifact(`unresolved_queue_latest`, 'unresolved_queue', audit.unresolved_queue);
    dbArtifact.writeArtifact(`topic_registry_validation_latest`, 'registry_validation', audit.registry_validation);
  }

  readTopicResolutionAudit(): TopicResolutionAudit | null {
    const path = resolve(this.repoRoot, TOPIC_RESOLUTION_AUDIT_PATH);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as TopicResolutionAudit;
  }

  /**
   * Registers resolutions produced by the research agent: new provisional
   * topics remain provisional at S0 and new branches remain watch-only. A
   * later evidence-only promotion policy decides whether either node activates.
   * Idempotent by id; no-op when nothing changed.
   */
  registerResolutions(resolutions: TopicResolution[], now = new Date().toISOString(), discoveredBranchNames: ReadonlyMap<string, string> = new Map()): void {
    const registry = this.readTopicRegistry();
    const canonicalIds = new Set(registry.canonical_topics.map((topic) => topic.topic_id));
    const branchIds = new Set(registry.branches.map((branch) => branch.branch_id));
    const canonical = [...registry.canonical_topics];
    const branches = [...registry.branches];
    const provisional = [...registry.provisional_topics];
    let changed = false;

    for (const resolution of resolutions) {
      if (resolution.status === 'new_provisional_topic' && resolution.provisional_topic_id && !canonicalIds.has(resolution.provisional_topic_id)) {
        const name = humanizeTopicName(resolution.provisional_topic_id.replace(/^provisional_/, ''));
        canonical.push({
          topic_id: resolution.provisional_topic_id,
          topic_name: name,
          current_stage: 'S0',
          status: 'provisional',
          naming_status: 'unresolved',
          naming_sources: [],
        });
        canonicalIds.add(resolution.provisional_topic_id);
        provisional.push({
          provisional_topic_id: resolution.provisional_topic_id,
          proposed_name: name,
          source_candidate_id: resolution.candidate_id,
          created_at: now,
          status: 'provisional',
          reason: resolution.reason,
        });
        changed = true;
      }
      const branchParentId = resolution.resolved_topic_id
        ?? (resolution.status === 'new_provisional_topic' ? resolution.provisional_topic_id : null);
      if ((resolution.status === 'new_branch' || resolution.status === 'new_provisional_topic') && branchParentId && resolution.resolved_branch_id && !branchIds.has(resolution.resolved_branch_id)) {
        branches.push({
          branch_id: resolution.resolved_branch_id,
          topic_id: branchParentId,
          branch_name: discoveredBranchNames.get(resolution.resolved_branch_id) ?? humanizeBranchName(resolution.resolved_branch_id, branchParentId),
          status: 'watch',
          naming_status: 'unresolved',
          naming_sources: [],
        });
        branchIds.add(resolution.resolved_branch_id);
        changed = true;
      }
    }

    if (!changed) return;
    this.writeYaml('data/topic_registry/canonical_topics.yaml', canonical);
    this.writeYaml('data/topic_registry/branches.yaml', branches);
    this.writeYaml('data/topic_registry/provisional_topics.yaml', provisional);
  }

  /**
   * Applies only an already-evaluated, formal-Evidence-based transition.
   * Neither a model response nor discovery metadata can activate a node here.
   */
  applyNarrativeGraphPromotions(report: NarrativeGraphPromotionReport): void {
    const activated = report.items.filter((item) => item.decision === 'activated');
    if (!activated.length) return;
    const registry = this.readTopicRegistry();
    const topicIds = new Set(activated.filter((item) => item.node_kind === 'topic').map((item) => item.node_id));
    const branchIds = new Set(activated.filter((item) => item.node_kind === 'branch').map((item) => item.node_id));
    let changed = false;
    const canonical = registry.canonical_topics.map((topic) => {
      if (topicIds.has(topic.topic_id) && topic.status === 'provisional') {
        changed = true;
        // Keep S0 in the registry. The operational snapshot computes Stage
        // from the Evidence Table after this transition.
        return { ...topic, status: 'active' as const, current_stage: 'S0' };
      }
      return topic;
    });
    const branches = registry.branches.map((branch) => {
      if (branchIds.has(branch.branch_id) && branch.status === 'watch') {
        changed = true;
        return { ...branch, status: 'active' as const };
      }
      return branch;
    });
    const provisional = registry.provisional_topics.map((topic) => {
      if (topicIds.has(topic.provisional_topic_id) && topic.status === 'provisional') {
        return { ...topic, status: 'promoted' as const };
      }
      return topic;
    });
    if (!changed) return;
    this.writeYaml('data/topic_registry/canonical_topics.yaml', canonical);
    this.writeYaml('data/topic_registry/branches.yaml', branches);
    this.writeYaml('data/topic_registry/provisional_topics.yaml', provisional);
    const auditPath = resolve(this.repoRoot, 'data/audit/narrative_graph_promotion.jsonl');
    mkdirSync(resolve(this.repoRoot, 'data/audit'), { recursive: true });
    appendFileSync(auditPath, `${JSON.stringify(report)}\n`, 'utf8');
  }

  private writeYaml(relativePath: string, value: unknown): void {
    writeFileSync(resolve(this.repoRoot, relativePath), stringify(value));
  }

  private readYaml<T>(relativePath: string, fallback: T): T {
    const path = resolve(this.repoRoot, relativePath);
    if (!existsSync(path)) return fallback;
    return parse(readFileSync(path, 'utf8')) as T;
  }

  private readMemoryTopicIds(): string[] {
    const explicit = this.readYaml<NarrativeMemory[]>('data/topic_registry/narrative_memory.yaml', []);
    if (explicit.length) return explicit.map((item) => item.topic_id);
    const seed = this.readYaml<Array<{ topic_id: string }>>('data/seed_topics.yaml', []);
    return seed.map((topic) => topic.topic_id);
  }
}

export class ShadowAiCandidateGenerator {
  generate(input: { session: EvidenceIntakeSession }): AiCandidateSuggestion[] {
    return input.session.candidates.map((candidate) => shadowSuggestion(candidate));
  }
}

function shadowSuggestion(candidate: EvidenceCandidate): AiCandidateSuggestion {
  const evidence = candidate.suggested_evidence;
  const quote = candidate.original_quote.toLowerCase();
  const alternative = quote.includes('neuro rehab')
    ? { topic_id: 'bci', branch_id: 'bci_medical_rehab', reason: 'Alternative alias interpretation for neuro rehab language.' }
    : quote.includes('robot arm')
      ? { topic_id: 'humanoid_robotics', branch_id: null, reason: 'Alternative robotics interpretation from device language.' }
      : { topic_id: evidence.topic_id, branch_id: evidence.branch_id ?? null, reason: 'Shadow adapter found no safer alternative mapping.' };
  return {
    ai_candidate_id: `ai_shadow_${candidate.candidate_id}`,
    candidate_id: candidate.candidate_id,
    original_quote: candidate.original_quote,
    suggested_evidence: {
      ...evidence,
      topic_id: alternative.topic_id,
      branch_id: alternative.branch_id,
      scope: alternative.branch_id ? 'branch' : evidence.scope,
      limitation: `${evidence.limitation} AI shadow suggestion only; cannot be imported without human review.`,
    },
    suggested_reason: `Shadow-mode candidate: ${alternative.reason}`,
    uncertainty_notes: [
      'AI shadow mode is advisory only and cannot import evidence.',
      'Operator must compare this mapping against the rule-based candidate and registry audit.',
    ],
    alternative_mappings: [
      { topic_id: evidence.topic_id, branch_id: evidence.branch_id ?? null, reason: 'Rule-based mapping retained as primary evidence draft.' },
      alternative,
    ],
    shadow_mode: true,
  };
}

function renderTopicAuditMarkdown(audit: TopicResolutionAudit): string {
  const rows = audit.resolutions.map((item) => `- ${item.candidate_id}: ${item.status}; topic=${item.resolved_topic_id ?? item.provisional_topic_id ?? 'none'}; branch=${item.resolved_branch_id ?? 'none'}; reason=${item.reason}`).join('\n');
  return `# Topic Resolution Audit

- audit_id: ${audit.audit_id}
- status: ${audit.registry_validation.status}
- unresolved_count: ${audit.unresolved_queue.length}
- no_forced_mapping: ${audit.guardrail_check.no_forced_mapping}
- provisional_topics_do_not_inherit_stage: ${audit.guardrail_check.provisional_topics_do_not_inherit_stage}

${rows || '- No candidates available.'}
`;
}

function humanizeTopicName(id: string): string {
  return id.replace(/[_\-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeBranchName(branchId: string, parentTopicId: string): string {
  const withoutParent = branchId.startsWith(`${parentTopicId}_`) ? branchId.slice(parentTopicId.length + 1) : branchId;
  return humanizeTopicName(withoutParent);
}
