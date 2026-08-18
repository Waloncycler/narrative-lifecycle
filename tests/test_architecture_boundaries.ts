import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function filesUnder(relativeDir: string): string[] {
  const root = resolve(repoRoot, relativeDir);
  if (!statSync(root, { throwIfNoEntry: false })) return [];
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    const relative = `${relativeDir}/${name}`;
    return statSync(path).isDirectory() ? filesUnder(relative) : [relative];
  }).filter((file) => file.endsWith('.ts'));
}

// Post feature-slice restructure: the old flat src/domain and src/rules layers
// now live as a domain/ and rules/ sublayer inside each src/features/<name>/
// slice. The purity boundary they enforced is unchanged — only the paths moved.
const FEATURE_NAMES = readdirSync(resolve(repoRoot, 'src/features'));
const domainAndRuleFiles = FEATURE_NAMES.flatMap((name) => [
  ...filesUnder(`src/features/${name}/domain`),
  ...filesUnder(`src/features/${name}/rules`),
]);

// src/application became src/app (composition root: use_cases, ports, errors).
// pipeline_runner.ts moved here too from the old src/services/, but it is the
// orchestration entrypoint, not a use case — it legitimately touches fs/paths
// the same way the old services/ layer did, so it is excluded from the purity
// check just as run_evolution_timeline.ts is excluded from the CLI check below.
const appFiles = filesUnder('src/app').filter((file) => !file.endsWith('pipeline_runner.ts'));

describe('layered architecture boundaries', () => {
  it('keeps Domain free of filesystem, YAML, CLI, and output paths', () => {
    for (const file of domainAndRuleFiles) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/node:fs|node:path|yaml|process\.argv|outputs\//);
    }
  });

  it('keeps Application use cases free of direct filesystem and path dependencies', () => {
    for (const file of appFiles) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/node:fs|node:path|yaml|outputs\//);
    }
  });

  it('keeps Domain and Application independent from legacy services', () => {
    for (const file of [...domainAndRuleFiles, ...appFiles]) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/from ['"].*services\//);
    }
  });

  it('keeps CLI as a thin interface over product core use cases', () => {
    // run_evolution_timeline builds a read-only projection; run_db_migrate is the
    // schema bootstrap that must run *before* the DI container (which opens the
    // DB) can be constructed at all — neither can go through createProductCoreUseCases.
    const cliExemptions = ['run_evolution_timeline.ts', 'run_db_migrate.ts', 'run_db_migrate_phase2.ts', 'run_db_seed.ts', 'run_gate_coverage.ts'];
    for (const file of filesUnder('src/cli')) {
      if (cliExemptions.some((name) => file.endsWith(name))) continue;
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).toContain('createProductCoreUseCases');
      expect(body, file).not.toMatch(/services\//);
      expect(body, file).not.toMatch(/buildStageDiff|classifyStage|scoreNarrative|writePipelineOutputs|writeJsonAtomically/);
    }
  });

  it('blocks legacy scripts from writing live stages or evolution timelines', () => {
    const blockedScripts = [
      'scripts/run_universal_intelligence.ts',
      'scripts/batch_historical_backfill_v2.ts',
      'scripts/real_historical_backfill.ts',
      'scripts/inject_memory_history.ts',
      'scripts/inject_world_models.ts',
      'scripts/update_snapshot_stage.ts',
      'scripts/fix_snapshot_schema.ts',
      'scripts/enrich_historical_origins.ts',
    ];
    for (const file of blockedScripts) {
      if (!existsSync(resolve(repoRoot, file))) continue;
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).toContain('retired');
      expect(body, file).not.toMatch(/writeFileSync|writeJsonAtomically|writeTextAtomically/);
      expect(body, file).not.toMatch(/evolution_timelines|latest_stage_snapshot/);
    }
  });
});
