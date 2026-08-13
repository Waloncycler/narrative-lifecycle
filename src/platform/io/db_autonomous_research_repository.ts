import { db } from '@/db/index';
import { evidence } from '@/db/schema';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';
import { AutonomousResearchArtifactRepository } from '@/features/research/io/autonomous_research_io';
import type { AutonomousResearchRun } from '@/features/research/types/autonomous_research';

export class DbAutonomousResearchRepository {
  private fallbackRepo: AutonomousResearchArtifactRepository;

  constructor(repoRoot: string = process.cwd()) {
    this.fallbackRepo = new AutonomousResearchArtifactRepository();
  }

  readOperationalEvidence(): EvidenceNode[] {
    const dbEvidence = db.select().from(evidence).all();
    return dbEvidence.map((e: any) => ({
      evidence_id: e.evidence_id,
      topic_id: e.topic_id,
      branch_id: e.branch_id,
      event_date: e.event_date,
      available_at: e.available_at,
      event_title: e.event_title,
      event_summary: e.event_summary || undefined,
      event_type: e.event_type,
      source_name: e.source_name,
      source_url: e.source_url || undefined,
      source_type: e.source_type || undefined,
      evidence_strength: e.evidence_strength as any,
      stage_effect: e.stage_effect,
      parent_or_branch: (e.parent_or_branch as any) || undefined,
      interpretation: e.interpretation || undefined,
      limitation: e.limitation || undefined,
      positive_or_negative: (e.positive_or_negative as any) || undefined,
      confidence: e.confidence || undefined,
      affected_layer: e.affected_layer_json ? JSON.parse(e.affected_layer_json) : [],
    }));
  }

  writeRun(run: AutonomousResearchRun): void {
    this.fallbackRepo.writeRun(run);
  }

  writePublishedEvidence(rows: EvidenceNode[]): void {
    // Keep file writes for fallback
    this.fallbackRepo.writePublishedEvidence(rows);

    // Also persist evidence to DB
    if (rows.length > 0) {
      db.transaction((tx: any) => {
        for (const e of rows) {
          tx.insert(evidence).values({
            evidence_id: e.evidence_id,
            topic_id: e.topic_id,
            branch_id: e.branch_id || null,
            event_date: e.event_date,
            available_at: e.available_at,
            event_title: e.event_title,
            event_summary: e.event_summary || null,
            event_type: e.event_type,
            source_name: e.source_name,
            source_url: e.source_url || null,
            source_type: e.source_type || null,
            evidence_strength: e.evidence_strength,
            stage_effect: e.stage_effect,
            parent_or_branch: e.parent_or_branch || null,
            interpretation: e.interpretation || null,
            limitation: e.limitation || null,
            positive_or_negative: e.positive_or_negative || null,
            confidence: e.confidence || null,
            affected_layer_json: JSON.stringify(e.affected_layer || []),
          }).onConflictDoNothing().run();
        }
      });
    }
  }

  readLatestSnapshot() { return this.fallbackRepo.readLatestSnapshot(); }
  readPolicy() { return this.fallbackRepo.readPolicy(); }
  readPreviousOperatorRunId() { return this.fallbackRepo.readPreviousOperatorRunId(); }
  operationalArtifactPaths(runId: string) { return this.fallbackRepo.operationalArtifactPaths(runId); }
  writeNarrativeGraphPromotion(report: any) { return this.fallbackRepo.writeNarrativeGraphPromotion(report); }
  writePolicyAudit(audit: any) { return this.fallbackRepo.writePolicyAudit(audit); }
}
