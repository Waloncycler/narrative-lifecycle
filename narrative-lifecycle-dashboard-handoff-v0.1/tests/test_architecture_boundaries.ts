import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');

function filesUnder(relativeDir: string): string[] {
  const root = resolve(repoRoot, relativeDir);
  return readdirSync(root).flatMap((name) => {
    const path = resolve(root, name);
    const relative = `${relativeDir}/${name}`;
    return statSync(path).isDirectory() ? filesUnder(relative) : [relative];
  }).filter((file) => file.endsWith('.ts'));
}

describe('layered architecture boundaries', () => {
  it('keeps Domain free of filesystem, YAML, CLI, and output paths', () => {
    for (const file of filesUnder('src/domain')) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/node:fs|node:path|yaml|process\.argv|outputs\//);
    }
  });

  it('keeps Application use cases free of direct filesystem and path dependencies', () => {
    for (const file of filesUnder('src/application')) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/node:fs|node:path|yaml|outputs\//);
    }
  });

  it('keeps Domain and Application independent from legacy services', () => {
    for (const file of [...filesUnder('src/domain'), ...filesUnder('src/application')]) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).not.toMatch(/from ['"].*services\//);
    }
  });

  it('keeps CLI as a thin interface over product core use cases', () => {
    for (const file of filesUnder('src/cli')) {
      const body = readFileSync(resolve(repoRoot, file), 'utf8');
      expect(body, file).toContain('createProductCoreUseCases');
      expect(body, file).not.toMatch(/services\//);
      expect(body, file).not.toMatch(/buildStageDiff|classifyStage|scoreNarrative|writePipelineOutputs|writeJsonAtomically/);
    }
  });
});
