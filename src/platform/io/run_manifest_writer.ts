import { db } from '@/db/index';
import { genericArtifacts, systemRuns } from '@/db/schema';
import type { RunManifest } from '@/platform/types/run_context';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';

/**
 * The SQLite migration preserved a few historical artifact ids as absolute
 * paths or as `outputs/...` paths. Readers must accept those legacy forms
 * while all new code can use the concise logical id.
 */
function artifactIdVariants(artifactId: string): string[] {
  const normalized = artifactId.replace(/\\/g, '/');
  const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? process.cwd();
  const relativeId = normalized.startsWith('/')
    ? relative(repoRoot, normalized).replace(/\\/g, '/')
    : normalized;
  const variants = new Set([normalized, relativeId]);
  if (relativeId.startsWith('outputs/')) variants.add(relativeId.slice('outputs/'.length));
  if (/^(intake|research|sources|autonomy|operator_runs|governance|reviews|research_agent)\//.test(relativeId)) {
    variants.add(`outputs/${relativeId}`);
  }
  // The first database migration used a flattened id for this static atlas.
  if (relativeId === 'data/source_atlas/authoritative_sources.yaml') {
    variants.add('source_atlas_authoritative_sources.yaml');
  }
  return [...variants].filter((item) => item && !item.startsWith('../'));
}

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
  for (const candidate of artifactIdVariants(artifactId)) {
    const record = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, candidate)).get();
    if (record && record.content_json) {
      try { return JSON.parse(record.content_json) as T; } catch { return null; }
    }
  }
  return null;
}

export function readGenericTextArtifact(artifactId: string): string | null {
  for (const candidate of artifactIdVariants(artifactId)) {
    const record = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, candidate)).get();
    if (record && record.content_md) return record.content_md;
  }
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
