import { expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GoldenCase } from '../../src/domain/golden_case';
import { FileGoldenCaseRepository, YamlFileRepository } from '../../src/repositories/file_repository';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const repository = new FileGoldenCaseRepository(new YamlFileRepository(repoRoot));

export function loadGoldenCase(fileName: string): GoldenCase {
  const topicId = fileName.replace(/\.ya?ml$/, '');
  const normalizedTopicId = topicId === 'innovative_drug_license_out' ? topicId : topicId;
  const goldenCase = repository.getGoldenCase(normalizedTopicId);
  if (!goldenCase) throw new Error(`Golden case not found: ${fileName}`);
  return goldenCase;
}

export function expectGoldenCaseShape(goldenCase: GoldenCase) {
  expect(goldenCase.topic_id).toEqual(expect.any(String));
  expect(goldenCase.topic_name).toEqual(expect.any(String));
  expect(goldenCase.baseline_current_stage).toEqual(expect.any(String));
  expect(goldenCase.transition_target).toEqual(expect.any(String));
  expect(goldenCase.key_judgment).toEqual(expect.any(String));
  expect(goldenCase.required_outputs).toEqual(expect.any(Object));
  expect(goldenCase.required_outputs.current_stage).toEqual(expect.any(String));
  expect(goldenCase.required_outputs.must_include).toEqual(expect.any(Array));
  expect(goldenCase.forbidden_outputs).toEqual(expect.any(Array));
  expect(goldenCase.forbidden_outputs).toContain('direct_buy_or_sell_instruction');
}
