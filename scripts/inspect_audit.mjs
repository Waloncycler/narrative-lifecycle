import { readFileSync, existsSync } from 'node:fs';

const read = (p) => {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch (e) { return { error: String(e) }; }
};

const ver = read('outputs/intake/latest_agent_verification.json');
if (ver && !ver.error) {
  console.log('verification:', JSON.stringify({
    candidate_count: ver.candidate_count, passed: ver.passed_count,
    failed: ver.failed_count, fallback: ver.fallback_count,
    guardrail: ver.guardrail_check,
  }));
}

const apply = read('outputs/intake/latest_apply_result.json');
if (apply && !apply.error) {
  console.log('apply_result keys:', Object.keys(apply).join(','));
  const imported = Array.isArray(apply.imported) ? apply.imported : [];
  const by = {};
  for (const e of imported) by[e.topic_id] = (by[e.topic_id] || 0) + 1;
  console.log('apply imported:', imported.length, '| accepted_count:', apply.accepted_count, '| by topic:', JSON.stringify(by));
}

const session = read('outputs/intake/latest_session.json');
if (session && !session.error) {
  const by = {};
  for (const c of (session.candidates ?? [])) {
    const t = c.suggested_evidence?.topic_id ?? 'none';
    by[t] = (by[t] || 0) + 1;
  }
  console.log('session candidates:', session.candidates.length, '| topic distribution:', JSON.stringify(by));
  const s = session.candidates[0]?.suggested_evidence;
  console.log('sample suggested_evidence:', JSON.stringify(s, null, 1).slice(0, 800));
}

// evidence registry - find where evidence yaml is
const evFiles = ['data/evidence/manual_imported_evidence.yaml', 'data/sample_evidence/manual_imported_evidence.yaml'];
for (const f of evFiles) {
  if (existsSync(f)) {
    const txt = readFileSync(f, 'utf8');
    const topics = [...txt.matchAll(/topic_id:\s*(\S+)/g)].map((m) => m[1]);
    const count = {};
    for (const t of topics) count[t] = (count[t] || 0) + 1;
    console.log(`${f}: entries=${topics.length} topics=`, JSON.stringify(count));
  }
}
