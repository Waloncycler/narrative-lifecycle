import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { INTAKE_AGENT_SYSTEM_PROMPT, buildTopicContext } from '../src/domain/intake_agent_prompt.ts';
import { buildSkillContext } from '../src/domain/intake_agent_skill.ts';
import { deriveSeed, sanitizeModelJson } from '../src/infrastructure/intake_agent_provider.ts';
import { parse } from 'yaml';

const read = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; } catch { return null; } };
const session = read('outputs/intake/latest_session.json');
const registryYaml = (p) => { try { return parse(readFileSync(p, 'utf8') || '[]'); } catch { return []; } };
const registry = {
  canonical_topics: registryYaml('data/topic_registry/canonical_topics.yaml'),
  aliases: registryYaml('data/topic_registry/aliases.yaml'),
  branches: registryYaml('data/topic_registry/branches.yaml'),
  provisional_topics: registryYaml('data/topic_registry/provisional_topics.yaml'),
  memory_topic_ids: ['bci', 'humanoid_robotics', 'innovative_drug_license_out'],
};

const ruleCandidatesForModel = session.candidates.map((c) => ({
  candidate_id: c.candidate_id,
  original_quote: c.original_quote,
  suggested_topic_id: c.suggested_evidence.topic_id ?? null,
  suggested_branch_id: c.suggested_evidence.branch_id ?? null,
  suggested_scope: c.suggested_evidence.scope ?? null,
}));
const rawText = session.raw_document.text.length > 16000 ? session.raw_document.text.slice(0, 16000) : session.raw_document.text;

const request: Record<string, unknown> = {
  model: 'MiniMax-M3',
  temperature: 0,
  max_tokens: 16000,
  thinking: { type: 'disabled' },
  response_format: { type: 'json_object' },
  messages: [
    { role: 'system', content: INTAKE_AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        output_schema: {
          type: 'object',
          required: ['candidates'],
          candidate_fields: [
            { name: 'source_candidate_id', description: 'Echo rule_candidates[].candidate_id when extending a rule candidate; otherwise omit and use candidate_id. Each rule candidate id must appear at most once.' },
            { name: 'candidate_id', description: 'Only for new agent-only facts; snake_case, unique.' },
            { name: 'quote', description: 'Exact verbatim quote from raw_document; at most 200 characters.' },
            { name: 'supported_fact', description: 'One short factual sentence; at most 40 tokens.' },
            { name: 'inferred_interpretation', description: 'One short interpretation sentence; at most 40 tokens; must differ from supported_fact.' },
            { name: 'core_topic', description: 'snake_case topic_id from the topic_catalog, or a new provisional_* id.' },
            { name: 'branch_id', description: 'snake_case branch_id or null.' },
            { name: 'scope', description: 'parent when no branch, branch when branch_id set.' },
            { name: 'evidence_strength', description: 'E0 | E1 | E2 | E3 | E4.' },
            { name: 'suggested_reason', description: 'One short sentence; at most 25 tokens.' },
          ],
        },
        raw_document: { ...session.raw_document, text: rawText },
        rule_candidates: ruleCandidatesForModel,
        industry_packs: null,
        topic_catalog: buildTopicContext(registry),
        operator_learning_profile: null,
        operator_skills: buildSkillContext(),
      }),
    },
  ],
};

const seedSource = {
  model: 'MiniMax-M3',
  temperature: 0,
  max_tokens: 16000,
  response_format: { type: 'json_object' },
  messages: request.messages,
};
request.seed = deriveSeed(seedSource as Record<string, unknown>);

console.log('request size bytes:', JSON.stringify(request).length);
console.log('deterministic seed:', request.seed);
const start = Date.now();
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 300000);
try {
  const response = await fetch('https://api.minimaxi.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.MINIMAX_API_KEY}` },
    body: JSON.stringify(request),
    signal: controller.signal,
  });
  const elapsed = Date.now() - start;
  const text = await response.text();
  console.log(`status: ${response.status} | elapsed: ${elapsed}ms`);
  // Parse returned candidates ids vs rule candidate ids
  try {
    const body = JSON.parse(text);
    const content = body.choices?.[0]?.message?.content ?? '';
    const obj = JSON.parse(sanitizeModelJson(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)));
    const candidates = obj.candidates ?? [];
    const ruleIds = session.candidates.map((c) => c.candidate_id);
    const ruleEcho = candidates.filter((c) => c.source_candidate_id && ruleIds.includes(c.source_candidate_id));
    const agentOnly = candidates.filter((c) => !c.source_candidate_id || !ruleIds.includes(c.source_candidate_id));
    console.log('model candidate count:', candidates.length);
    console.log('rule echo count:', ruleEcho.length, '/', ruleIds.length);
    console.log('agent-only count:', agentOnly.length);
    console.log('model candidate ids:', JSON.stringify(candidates.map((c) => c.source_candidate_id ?? c.candidate_id)));
    console.log('sample model candidate:', JSON.stringify(obj.candidates?.[0], null, 1).slice(0, 600));
  } catch (parseError) {
    console.log('parse failed:', parseError.message);
    console.log(text.slice(0, 800));
  }
} catch (e) {
  console.log('ERR after', Date.now() - start, 'ms:', e.message);
} finally {
  clearTimeout(timer);
}
