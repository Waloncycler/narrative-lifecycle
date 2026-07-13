import { describe, expect, it } from 'vitest';
import { expressionIncludesStage, maxStageInExpression, parseStageExpression } from '../src/domain/stages';

describe('stage expressions', () => {
  it('parses single stages, ranges, and alternatives explicitly', () => {
    expect(parseStageExpression('S4')).toEqual({ raw: 'S4', kind: 'single', stages: ['S4'] });
    expect(parseStageExpression('S5-S6')).toEqual({ raw: 'S5-S6', kind: 'range', stages: ['S5', 'S6'] });
    expect(parseStageExpression('S7A/S7C')).toEqual({ raw: 'S7A/S7C', kind: 'alternatives', stages: ['S7A', 'S7C'] });
    expect(maxStageInExpression('S5-S6')).toBe('S6');
    expect(expressionIncludesStage('S7A/S7C', 'S7C')).toBe(true);
  });

  it('rejects invalid stage expressions', () => {
    expect(() => parseStageExpression('S8')).toThrow('Invalid stage expression');
    expect(() => parseStageExpression('S16')).toThrow('Invalid stage expression');
  });
});
