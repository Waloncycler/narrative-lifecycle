/**
 * Operator skills injected into the intake agent request as a dedicated
 * context block. They constrain model behaviour — full rule-candidate
 * coverage, citation discipline, a new-fact budget, and evidence grading — so
 * output stays stable across runs and guardrail checks pass on the first
 * attempt. Kept separate from INTAKE_AGENT_SYSTEM_PROMPT because the system
 * prompt is capped at 1000 characters.
 */

export interface IntakeAgentSkill {
  id: string;
  name: string;
  instructions: string[];
}

/** Cap on agent-only (new) facts emitted per run. Keeps a single run from
 *  flooding intake with low-value extras while still letting real new
 *  directions surface. */
export const MAX_AGENT_ONLY_FACTS_PER_RUN = 5;

export const EVIDENCE_INTAKE_SKILLS: readonly IntakeAgentSkill[] = [
  {
    id: 'full_rule_coverage',
    name: 'Full rule-candidate coverage',
    instructions: [
      'Emit exactly one candidate per rule_candidate entry; echo its candidate_id as source_candidate_id.',
      'Never skip, merge, or drop a rule candidate, regardless of length or difficulty.',
    ],
  },
  {
    id: 'citation_discipline',
    name: 'Citation discipline',
    instructions: [
      'original_quote must be a verbatim substring of raw_document.text.',
      'Never fabricate, paraphrase, or reword a quote; if a rule quote cannot be located, echo the rule_candidate original_quote unchanged.',
    ],
  },
  {
    id: 'temporal_discipline',
    name: 'Historical date discipline',
    instructions: [
      'Use event_date only when it is explicit in source metadata or the quoted document; never infer it from current time.',
      'When a date is absent, say so in limitation and uncertainty_notes; the operator must confirm it before historical replay or formal import.',
    ],
  },
  {
    id: 'new_fact_budget',
    name: 'New-fact budget',
    instructions: [
      'Emit agent-only candidates (no source_candidate_id) only for facts not already covered by rule_candidates.',
      `Cap agent-only candidates at ${MAX_AGENT_ONLY_FACTS_PER_RUN} per run; prefer the most material, best-evidenced facts.`,
    ],
  },
  {
    id: 'evidence_grading',
    name: 'Evidence grading',
    instructions: [
      'E1 = a single source states the fact; E2 = corroborated by a second source; E3 = hard or official evidence (revenue, filing, regulatory approval); E4 = fully verified.',
      'When extending a rule_candidate, keep its suggested evidence strength unless the quote clearly warrants a change.',
    ],
  },
  {
    id: 'schema_discipline',
    name: 'Schema discipline',
    instructions: [
      'Follow output_schema exactly and return flat fields (core_topic, branch_id, scope, evidence_strength).',
      'Keep every value concise; supported_fact and inferred_interpretation must never be identical.',
      'Per-candidate budget: quote <= 200 characters, supported_fact <= 40 tokens, inferred_interpretation <= 40 tokens, suggested_reason <= 25 tokens.',
      'Every rule_candidate id must appear at most once; cover every rule_candidate before adding new facts.',
    ],
  },
];

/** Renders the skill set as a compact, newline-separated instruction block. */
export function buildSkillContext(): string {
  return EVIDENCE_INTAKE_SKILLS.map((skill) => `${skill.id}: ${skill.instructions.join(' ')}`).join('\n');
}
