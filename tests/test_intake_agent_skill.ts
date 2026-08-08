import { describe, expect, it } from 'vitest';
import { EVIDENCE_INTAKE_SKILLS, MAX_AGENT_ONLY_FACTS_PER_RUN, buildSkillContext } from '@/domain/intake_agent_skill';
import { deriveSeed } from '@/infrastructure/intake_agent_provider';

describe('intake agent skills', () => {
  it('renders every skill with non-empty instructions', () => {
    const context = buildSkillContext();
    for (const skill of EVIDENCE_INTAKE_SKILLS) {
      expect(context).toContain(skill.id);
      expect(skill.instructions.length).toBeGreaterThan(0);
      for (const instruction of skill.instructions) expect(instruction.length).toBeGreaterThan(0);
    }
  });

  it('mentions the agent-only fact cap so the budget is visible to the model', () => {
    expect(buildSkillContext()).toContain(`at ${MAX_AGENT_ONLY_FACTS_PER_RUN} per run`);
  });

  it('constrains citation discipline (verbatim quote from raw_document)', () => {
    const context = buildSkillContext();
    expect(context).toContain('verbatim substring of raw_document.text');
  });
});

describe('deterministic request seed', () => {
  const base: Record<string, unknown> = {
    model: 'MiniMax-M3',
    temperature: 0,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: 'same content' }],
  };

  it('produces the same seed for identical requests', () => {
    expect(deriveSeed(base)).toBe(deriveSeed({ ...base }));
  });

  it('produces a different seed when the content changes', () => {
    const changed: Record<string, unknown> = { ...base, messages: [{ role: 'user', content: 'other content' }] };
    expect(deriveSeed(changed)).not.toBe(deriveSeed(base));
  });

  it('keeps the seed within the signed 32-bit range', () => {
    const seed = deriveSeed(base);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0x7fffffff);
  });
});
