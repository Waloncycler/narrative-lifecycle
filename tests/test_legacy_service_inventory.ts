import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const allowedCategories = new Set(['domain_rule', 'application_orchestration', 'infrastructure_io', 'renderer', 'deprecated']);
const allowedStatuses = new Set(['legacy_active', 'compat_wrapper']);

interface InventoryEntry {
  file: string;
  category: string;
  status: string;
  target_layer: string;
  reason: string;
}

function inventory(): InventoryEntry[] {
  return JSON.parse(readFileSync(resolve(repoRoot, 'docs/legacy_service_inventory.json'), 'utf8')) as InventoryEntry[];
}

describe('legacy service inventory', () => {
  it('classifies every src/services file with migration status and reason', () => {
    const entries = inventory();
    const serviceFiles = readdirSync(resolve(repoRoot, 'src/services'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => `src/services/${file}`)
      .sort();
    const inventoryFiles = entries.map((entry) => entry.file).sort();

    expect(inventoryFiles).toEqual(serviceFiles);
    for (const entry of entries) {
      expect(allowedCategories.has(entry.category), entry.file).toBe(true);
      expect(allowedStatuses.has(entry.status), entry.file).toBe(true);
      expect(entry.target_layer.length, entry.file).toBeGreaterThan(0);
      expect(entry.reason.length, entry.file).toBeGreaterThan(20);
    }
  });

  it('keeps migrated compatibility wrappers small and free of direct IO', () => {
    for (const entry of inventory().filter((item) => item.status === 'compat_wrapper')) {
      const body = readFileSync(resolve(repoRoot, entry.file), 'utf8');
      expect(body.split('\n').length, entry.file).toBeLessThanOrEqual(15);
      expect(body, entry.file).not.toMatch(/node:fs|node:path|yaml|outputs\//);
    }
  });
});
