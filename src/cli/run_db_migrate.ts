/**
 * Database migration runner.
 *
 * Applies every drizzle migration under `drizzle/` to the local SQLite store at
 * `data/narrative.db`, creating it if it does not exist. This is the bootstrap
 * step a fresh clone needs before any pipeline command can run — the database
 * file itself is intentionally gitignored (it exceeds sane repo size), so the
 * schema is reconstructed from the tracked migrations instead.
 *
 * Idempotent: drizzle records applied migrations in its own `__drizzle_migrations`
 * table, so re-running only applies what is new.
 *
 *   npm run db:migrate
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const dbPath = resolve(repoRoot, 'data/narrative.db');
const migrationsFolder = resolve(repoRoot, 'drizzle');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
const db = drizzle(sqlite);

migrate(db, { migrationsFolder });

const tables = sqlite
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%' ORDER BY name")
  .all()
  .map((row) => (row as { name: string }).name);

sqlite.close();

console.log(JSON.stringify({ status: 'ok', db: 'data/narrative.db', table_count: tables.length, tables }, null, 2));
