import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const readY = (p) => { try { return parse(readFileSync(p, 'utf8') || '[]'); } catch { return []; } };
const root = 'data/topic_registry/';
const canon = readY(root + 'canonical_topics.yaml');
const prov = readY(root + 'provisional_topics.yaml');
const branch = readY(root + 'branches.yaml');
console.log(`== canonical topics (${canon.length}) ==`);
for (const t of canon) console.log(' ', t.topic_id, '|', t.topic_name, '| stage:', t.current_stage, '| status:', t.status);
console.log(`== provisional topics (${prov.length}) ==`);
for (const t of prov) console.log(' ', t.provisional_topic_id, '|', t.status, '|', (t.reason ?? '').slice(0, 50));
console.log(`== branches (${branch.length}) ==`);
for (const b of branch) console.log(' ', b.branch_id, '->', b.topic_id, '|', b.branch_name);

// evidence topics
const ev = readY('data/sample_evidence/manual_imported_evidence.yaml');
const by = {};
for (const e of ev) by[e.topic_id] = (by[e.topic_id] || 0) + 1;
console.log(`\n== imported evidence (${ev.length}) by topic ==`);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(' ', k, ':', v);
