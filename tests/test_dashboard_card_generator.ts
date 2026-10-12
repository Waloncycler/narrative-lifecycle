import { FileSchemaValidator } from '@/platform/io/app_di_container';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbEvidenceRepository, DbGoldenCaseRepository, YamlFileRepository } from '@/platform/file_repository';
import { generateDashboardCardFromGoldenCase } from '@/features/reporting/pipeline/dashboard_card_generator';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('dashboard card generator', () => {
  it('generates complete research-only dashboard cards from golden cases', () => {
    const yamlRepository = new YamlFileRepository();
    const goldenCases = new DbGoldenCaseRepository(yamlRepository).listGoldenCases();
    const evidence = new DbEvidenceRepository(yamlRepository).listSampleEvidence();
    const cards = goldenCases.map((goldenCase) => generateDashboardCardFromGoldenCase(goldenCase, evidence));
    const validator = new FileSchemaValidator();
    const validateCard = (data: any) => { validator.validate('dashboard_card.schema.json', data); return true; };

    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(() => validateCard(card)).not.toThrow();
      expect(card.current_stage).toBeTruthy();
      expect(card.transition_target).toBeTruthy();
      expect(card.why_not_higher_stage).toBeTruthy();
      expect(card.parent_narrative).toBeTruthy();
      expect(card.key_events.length).toBeGreaterThan(0);
      expect(card.action).toBe('validation tracking');
      expect(JSON.stringify(card)).not.toContain('direct_buy_or_sell_instruction');
      expect(card.scores.data_confidence?.evidence_ids.length).toBeGreaterThan(0);
    }

    const bci = cards.find((card) => card.topic_id === 'bci');
    expect(bci?.current_stage).toBe('S4');
    expect(bci?.why_not_higher_stage).toContain('parent reality insufficient');
  });
});
