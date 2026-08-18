/**
 * Database seed.
 *
 * Loads the git-tracked corpus into the SQLite store so a freshly migrated
 * database is not empty. Without this step the DB has the schema but zero rows,
 * and every topic collapses to S0 because the stage engine reads
 * `readOperationalEvidence()` from an empty `evidence` table while 200+ rows sit
 * unread in data/evidence_table/evidence_table.json.
 *
 * Idempotent (upserts on primary key). Order matters for the foreign keys:
 * topics -> branches -> evidence.
 *
 *   npm run db:migrate && npm run db:seed
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { db } from '@/db/index';
import { topics, branches, evidence } from '@/db/schema';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(resolve(repoRoot, rel), 'utf8')) as T;
const readYaml = <T>(rel: string): T => parseYaml(readFileSync(resolve(repoRoot, rel), 'utf8')) as T;
const now = new Date().toISOString();

interface CanonicalTopic {
  topic_id: string; topic_name: string; market_name_en?: string;
  current_stage?: string; status?: string; domain?: string;
}
interface BranchRecord {
  branch_id: string; topic_id: string; branch_name?: string;
  market_name_zh?: string; market_name_en?: string; naming_status?: string; status?: string;
}

const canonical = readYaml<CanonicalTopic[]>('data/topic_registry/canonical_topics.yaml') ?? [];
const branchRows = readYaml<BranchRecord[]>('data/topic_registry/branches.yaml') ?? [];
const evidenceRows = readJson<EvidenceNode[]>('data/evidence_table/evidence_table.json') ?? [];

// 1. Topics (FK parent for branches + evidence).
const topicIds = new Set<string>();
db.transaction((tx) => {
  for (const t of canonical) {
    topicIds.add(t.topic_id);
    tx.insert(topics).values({
      topic_id: t.topic_id,
      topic_name: t.topic_name,
      market_name_en: t.market_name_en ?? null,
      status: t.status ?? 'active',
      current_stage: t.current_stage ?? 'S0',
      domain: t.domain ?? 'unknown',
      created_at: now,
      updated_at: now,
    }).onConflictDoUpdate({
      target: topics.topic_id,
      set: { topic_name: t.topic_name, status: t.status ?? 'active', current_stage: t.current_stage ?? 'S0', updated_at: now },
    }).run();
  }
});

// 2. Branches (skip any whose parent topic is absent, to keep the FK valid).
let branchesSeeded = 0;
db.transaction((tx) => {
  for (const b of branchRows) {
    if (!topicIds.has(b.topic_id)) continue;
    branchesSeeded += 1;
    tx.insert(branches).values({
      branch_id: b.branch_id,
      topic_id: b.topic_id,
      market_name_zh: b.market_name_zh ?? b.branch_name ?? b.branch_id,
      market_name_en: b.market_name_en ?? null,
      naming_status: b.naming_status ?? 'unresolved',
      created_at: now,
    }).onConflictDoUpdate({
      target: branches.branch_id,
      set: { market_name_zh: b.market_name_zh ?? b.branch_name ?? b.branch_id, naming_status: b.naming_status ?? 'unresolved' },
    }).run();
  }
});

// 3. Evidence (skip rows whose topic is absent, to keep the FK valid).
let evidenceSeeded = 0;
let evidenceSkipped = 0;
db.transaction((tx) => {
  for (const row of evidenceRows) {
    if (!topicIds.has(row.topic_id)) { evidenceSkipped += 1; continue; }
    evidenceSeeded += 1;
    tx.insert(evidence).values({
      evidence_id: row.evidence_id,
      topic_id: row.topic_id,
      branch_id: row.branch_id ?? null,
      event_date: row.event_date,
      available_at: row.available_at,
      event_title: row.event_title,
      event_summary: row.event_summary ?? null,
      event_type: row.event_type,
      source_name: row.source_name,
      source_url: row.source_url ?? null,
      source_type: row.source_type ?? null,
      evidence_strength: row.evidence_strength,
      stage_effect: row.stage_effect,
      parent_or_branch: row.parent_or_branch ?? null,
      interpretation: row.interpretation ?? null,
      limitation: row.limitation ?? null,
      positive_or_negative: row.positive_or_negative ?? null,
      confidence: row.confidence ?? null,
      affected_layer_json: JSON.stringify(row.affected_layer ?? []),
    }).onConflictDoUpdate({
      target: evidence.evidence_id,
      set: { topic_id: row.topic_id, event_title: row.event_title, affected_layer_json: JSON.stringify(row.affected_layer ?? []) },
    }).run();
  }
});

console.log(JSON.stringify({
  status: 'ok',
  topics_seeded: topicIds.size,
  branches_seeded: branchesSeeded,
  evidence_seeded: evidenceSeeded,
  evidence_skipped_missing_topic: evidenceSkipped,
}, null, 2));
