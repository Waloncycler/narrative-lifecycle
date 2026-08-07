import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const repoRoot = resolve(import.meta.dirname, '..');

interface PilotDocumentManifestRow {
  document_id: string;
  path: string;
  expected_resolution: string;
  expected_topic_id: string;
}

describe('intake pilot document dataset', () => {
  it('contains at least 50 real-document fixtures covering resolver outcomes and duplicate/multi-evidence cases', () => {
    const rows = parse(readFileSync(resolve(repoRoot, 'data/intake/pilot_documents/manifest.yaml'), 'utf8')) as PilotDocumentManifestRow[];
    expect(rows.length).toBeGreaterThanOrEqual(50);
    for (const row of rows) {
      expect(row.document_id).toEqual(expect.any(String));
      expect(existsSync(resolve(repoRoot, row.path)), row.path).toBe(true);
      expect(readFileSync(resolve(repoRoot, row.path), 'utf8').length, row.path).toBeGreaterThanOrEqual(40);
    }
    expect(new Set(rows.map((row) => row.expected_resolution))).toEqual(new Set([
      'existing_topic',
      'alias_of',
      'new_branch',
      'reactivation',
      'new_provisional_topic',
      'unresolved',
    ]));
    expect(rows.some((row) => row.document_id.includes('duplicate'))).toBe(true);
    expect(rows.some((row) => row.document_id.includes('multi'))).toBe(true);
    expect(rows.some((row) => row.expected_topic_id === 'traditional_chinese_medicine_revival')).toBe(true);
  });
});
