import { db } from '@/db/index';
import { topics, branches, genericArtifacts, narrativeMemories } from '@/db/schema';
import { desc, eq, like } from 'drizzle-orm';
import type { TopicRegistry, TopicResolution, TopicResolutionAudit } from '@/features/narrative/types/topic_resolution';
import type { NarrativeGraphPromotionReport } from '@/features/narrative/types/narrative_graph_promotion';
import { TopicRegistryArtifactRepository } from '@/platform/io/topic_registry_io';

export class DbTopicRegistryRepository {
  // We keep a reference to the fallback file repo for audit writing to maintain compatibility
  private fallbackRepo: TopicRegistryArtifactRepository;

  constructor(repoRoot: string = process.cwd()) {
    this.fallbackRepo = new TopicRegistryArtifactRepository();
  }

  readTopicRegistry(): TopicRegistry {
    // Read from DB
    const dbTopics = db.select().from(topics).all();
    const dbBranches = db.select().from(branches).all();
    const dbMemories = db.select().from(narrativeMemories).all();

    return {
      canonical_topics: dbTopics
        .filter((t: any) => t.status === 'active' || t.status === 'provisional')
        .map((t: any) => ({
          topic_id: t.topic_id,
          topic_name: t.topic_name,
          current_stage: t.current_stage as any,
          status: t.status as any,
          naming_status: undefined,
          naming_sources: [],
          market_name_en: t.market_name_en || undefined,
        })),
      aliases: [], // Not implemented yet
      branches: dbBranches.map((b: any) => ({
        branch_id: b.branch_id,
        topic_id: b.topic_id,
        branch_name: b.market_name_zh,
        market_name_en: b.market_name_en || undefined,
        status: b.naming_status as any,
        naming_status: b.naming_status as any,
        naming_sources: [],
      })),
      provisional_topics: dbTopics
        .filter((t: any) => t.status === 'provisional')
        .map((t: any) => ({
          provisional_topic_id: t.topic_id,
          proposed_name: t.topic_name,
          created_at: t.created_at,
          status: 'provisional' as const,
          source_candidate_id: '',
          reason: 'Loaded from database',
        })),
      memory_topic_ids: dbMemories.map((m: any) => m.topic_id),
    };
  }

  writeTopicResolutionAudit(audit: TopicResolutionAudit): void {
    // Audit logs remain in file system for now for operator review
    this.fallbackRepo.writeTopicResolutionAudit(audit);
  }

  readTopicResolutionAudit(): TopicResolutionAudit | null {
    const record = db.select({ content_json: genericArtifacts.content_json })
      .from(genericArtifacts)
      .where(like(genericArtifacts.artifact_id, 'audit_topic_resolution_%'))
      .orderBy(desc(genericArtifacts.updated_at))
      .limit(1)
      .get();
    if (record?.content_json) {
      try { return JSON.parse(record.content_json) as TopicResolutionAudit; } catch { /* fall through to legacy artifact */ }
    }
    return this.fallbackRepo.readTopicResolutionAudit();
  }

  registerResolutions(resolutions: TopicResolution[], now = new Date().toISOString(), discoveredBranchNames: ReadonlyMap<string, string> = new Map()): void {
    const registry = this.readTopicRegistry();
    const canonicalIds = new Set(registry.canonical_topics.map((t) => t.topic_id));
    const branchIds = new Set(registry.branches.map((b) => b.branch_id));

    db.transaction((tx: any) => {
      for (const res of resolutions) {
        if (res.status === 'new_provisional_topic' && res.provisional_topic_id && !canonicalIds.has(res.provisional_topic_id)) {
          const name = res.provisional_topic_id.replace(/^provisional_/, '').replace(/[_\-]+/g, ' ');
          tx.insert(topics).values({
            topic_id: res.provisional_topic_id,
            topic_name: name,
            status: 'provisional',
            current_stage: 'S0',
            domain: 'unknown',
            created_at: now,
            updated_at: now,
          }).run();
          canonicalIds.add(res.provisional_topic_id);
        }

        const branchParentId = res.resolved_topic_id ?? (res.status === 'new_provisional_topic' ? res.provisional_topic_id : null);
        if ((res.status === 'new_branch' || res.status === 'new_provisional_topic') && branchParentId && res.resolved_branch_id && !branchIds.has(res.resolved_branch_id)) {
          const bName = discoveredBranchNames.get(res.resolved_branch_id) ?? res.resolved_branch_id;
          tx.insert(branches).values({
            branch_id: res.resolved_branch_id,
            topic_id: branchParentId,
            market_name_zh: bName,
            naming_status: 'unresolved',
            created_at: now,
          }).run();
          branchIds.add(res.resolved_branch_id);
        }
      }
    });
  }

  applyNarrativeGraphPromotions(report: NarrativeGraphPromotionReport): void {
    const activated = report.items.filter((item) => item.decision === 'activated');
    if (!activated.length) return;

    db.transaction((tx: any) => {
      for (const item of activated) {
        if (item.node_kind === 'topic') {
          tx.update(topics).set({ status: 'active', current_stage: 'S0', updated_at: new Date().toISOString() })
            .where(eq(topics.topic_id, item.node_id)).run();
        } else if (item.node_kind === 'branch') {
          tx.update(branches).set({ naming_status: 'active' })
            .where(eq(branches.branch_id, item.node_id)).run();
        }
      }
    });
    this.fallbackRepo.applyNarrativeGraphPromotions(report); // Keep file trace
  }
}
