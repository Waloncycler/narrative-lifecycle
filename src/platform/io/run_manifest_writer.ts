import { db } from '@/db/index';
import { genericArtifacts, systemRuns } from '@/db/schema';
import type { RunManifest } from '@/platform/types/run_context';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function writeGenericTextArtifact(artifactId: string, contents: string): void {
  db.insert(genericArtifacts).values({
    artifact_id: artifactId,
    artifact_type: 'legacy_file',
    content_json: '{}',
    content_md: contents,
    updated_at: new Date().toISOString()
  }).onConflictDoUpdate({
    target: genericArtifacts.artifact_id,
    set: { content_md: contents, updated_at: new Date().toISOString() }
  }).run();
}

export function writeGenericArtifact(artifactId: string, value: unknown): void {
  db.insert(genericArtifacts).values({
    artifact_id: artifactId,
    artifact_type: 'legacy_file',
    content_json: JSON.stringify(value),
    updated_at: new Date().toISOString()
  }).onConflictDoUpdate({
    target: genericArtifacts.artifact_id,
    set: { content_json: JSON.stringify(value), updated_at: new Date().toISOString() }
  }).run();
}

export function readGenericArtifact<T = unknown>(artifactId: string): T | null {
  const record = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, artifactId)).get();
  if (record && record.content_json) {
    try { return JSON.parse(record.content_json) as T; } catch { return null; }
  }
  return null;
}

export function readGenericTextArtifact(artifactId: string): string | null {
  const record = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, artifactId)).get();
  if (record && record.content_md) return record.content_md;
  return null;
}

export function writeRunManifest(repoRoot: string, manifest: RunManifest, updateLatest = true): void {
  db.insert(systemRuns).values({
    run_id: manifest.run_id,
    started_at: manifest.started_at,
    completed_at: manifest.completed_at,
    rule_version: manifest.rule_version,
    artifact_version: manifest.artifact_version,
    status: manifest.status,
    guardrail_status: manifest.guardrail_status,
    manifest_json: JSON.stringify(manifest),
  }).onConflictDoUpdate({
    target: systemRuns.run_id,
    set: { 
      completed_at: manifest.completed_at,
      status: manifest.status,
      guardrail_status: manifest.guardrail_status,
      manifest_json: JSON.stringify(manifest)
    }
  }).run();
}
