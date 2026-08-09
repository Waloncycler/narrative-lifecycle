import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderMethodology } from '@/features/narrative/ui/narrative_monitor_renderer';

const repoRoot = resolve(import.meta.dirname, '..');

describe('quantitative methodology contract', () => {
  it('renders semantic mathematical notation instead of literal code-style subscripts', () => {
    const page = renderMethodology();
    expect(page).toContain('<var>q</var><sub>e</sub>');
    expect(page).toContain('<var>S</var><sub>current</sub>');
    expect(page).toContain('10<sup>6</sup>');
    expect(page).toContain('硬阻断不从 O 中扣分，而是直接禁止晋级。');
    expect(page).not.toContain('O = .80Quality + .20Efficiency - hard blockers');
  });

  it('keeps the governed scoring document aligned with executable methodology without constraining the theory README', () => {
    const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');
    const scoring = readFileSync(resolve(repoRoot, 'docs/06_scoring_system_v0_2.md'), 'utf8');
    const canonicalSnippets = [
      'Evidence Table first.',
      'Stage First, Score Second.',
      'S_current = min(S_requested, S_gate, S_confidence)',
      'q_e = 100 * w(E) * a(source) * c * 2^(-age/h)',
      'C = .25B + .25A + .20R + .15X + .15L',
      'O = .80Q + .20E',
      'Cost = (T_in P_in + T_out P_out) / 10^6',
    ];
    for (const snippet of canonicalSnippets) {
      expect(scoring).toContain(snippet);
    }
    expect(readme).toContain('Evidence first. Rules second. LLM explanation third.');
    expect(readme).toContain('不是一个买卖信号生成器');
    expect(scoring).toContain('README.md` remains the');
    expect(scoring).toContain('must not be simplified or rewritten');
    expect(scoring).toContain('They never override the Evidence');
  });
});
