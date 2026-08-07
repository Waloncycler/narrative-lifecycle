import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceNode } from '../src/domain/evidence';

const repoRoot = process.cwd();
const evidencePath = resolve(repoRoot, 'data/evidence_table/evidence_table.json');
const existing: EvidenceNode[] = JSON.parse(readFileSync(evidencePath, 'utf8'));

// Filter out extra BCI probe nodes that lift BCI parent beyond S4 baseline
const cleaned = existing.filter((item) => {
  if (item.topic_id === 'bci' && item.evidence_id.startsWith('ev_probe_')) return false;
  return true;
});

writeFileSync(evidencePath, JSON.stringify(cleaned, null, 2));
console.log(`Cleaned BCI probe nodes. Remaining evidence table size: ${cleaned.length}`);
