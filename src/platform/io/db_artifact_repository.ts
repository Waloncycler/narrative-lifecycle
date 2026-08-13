import { db } from '@/db/index';
import { genericArtifacts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class DbArtifactRepository {
  /**
   * Write an artifact payload to the SQLite generic_artifacts table.
   */
  writeArtifact(artifactId: string, artifactType: string, jsonContent: unknown, markdownContent?: string): void {
    db.insert(genericArtifacts).values({
      artifact_id: artifactId,
      artifact_type: artifactType,
      updated_at: new Date().toISOString(),
      content_json: JSON.stringify(jsonContent),
      content_md: markdownContent || null,
    }).onConflictDoUpdate({
      target: genericArtifacts.artifact_id,
      set: {
        updated_at: new Date().toISOString(),
        content_json: JSON.stringify(jsonContent),
        content_md: markdownContent || null,
      }
    }).run();
  }

  /**
   * Reads an artifact payload.
   */
  readArtifact<T>(artifactId: string): { json: T; markdown: string | null } | null {
    const record = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, artifactId)).get();
    if (!record) return null;
    return {
      json: JSON.parse(record.content_json) as T,
      markdown: record.content_md,
    };
  }
}
