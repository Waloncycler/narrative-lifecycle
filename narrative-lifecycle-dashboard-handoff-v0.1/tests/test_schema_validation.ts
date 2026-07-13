import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const schemaDir = resolve(repoRoot, 'schemas');

interface JsonSchema {
  $schema?: string;
  type?: string;
  title?: string;
  required?: string[];
  properties?: Record<string, unknown>;
  items?: unknown;
}

describe('schema validation', () => {
  const schemaFiles = readdirSync(schemaDir).filter((fileName) => fileName.endsWith('.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  it('has JSON schemas to validate', () => {
    expect(schemaFiles.length).toBeGreaterThan(0);
  });

  it.each(schemaFiles)('%s is valid JSON with declared required fields', (schemaFile) => {
    const schema = JSON.parse(readFileSync(resolve(schemaDir, schemaFile), 'utf8')) as JsonSchema;

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(['object', 'array']).toContain(schema.type);
    if (schema.type === 'object') {
      expect(schema.title).toEqual(expect.any(String));
      expect(schema.properties).toEqual(expect.any(Object));

      for (const requiredField of schema.required ?? []) {
        expect(schema.properties).toHaveProperty(requiredField);
      }
    } else {
      expect(schema.items).toBeTruthy();
    }

    expect(() => ajv.compile(schema)).not.toThrow();
  });

  it('validates YAML data fixtures against their schemas', () => {
    const schemas = {
      evidence: JSON.parse(readFileSync(resolve(schemaDir, 'evidence.schema.json'), 'utf8')),
      topic: JSON.parse(readFileSync(resolve(schemaDir, 'topic.schema.json'), 'utf8')),
      failureCase: JSON.parse(readFileSync(resolve(schemaDir, 'failure_case.schema.json'), 'utf8')),
      goldenCase: JSON.parse(readFileSync(resolve(schemaDir, 'golden_case.schema.json'), 'utf8')),
      evidenceTable: JSON.parse(readFileSync(resolve(schemaDir, 'evidence_table.schema.json'), 'utf8')),
      replayCase: JSON.parse(readFileSync(resolve(schemaDir, 'replay_case.schema.json'), 'utf8')),
      topicList: JSON.parse(readFileSync(resolve(schemaDir, 'topic_list.schema.json'), 'utf8')),
      evaluationResult: JSON.parse(readFileSync(resolve(schemaDir, 'evaluation_result.schema.json'), 'utf8')),
    };

    const validators = {
      evidence: ajv.compile(schemas.evidence),
      topic: ajv.compile(schemas.topic),
      failureCase: ajv.compile(schemas.failureCase),
      goldenCase: ajv.compile(schemas.goldenCase),
      evidenceTable: ajv.compile(schemas.evidenceTable),
      replayCase: ajv.compile(schemas.replayCase),
      topicList: ajv.compile(schemas.topicList),
      evaluationResult: ajv.compile(schemas.evaluationResult),
    };

    const validate = (validator: ReturnType<typeof ajv.compile>, value: unknown, label: string) => {
      const valid = validator(value);
      expect(validator.errors, label).toEqual(valid ? null : validator.errors);
      expect(valid, label).toBe(true);
    };

    for (const fileName of readdirSync(resolve(repoRoot, 'data/sample_evidence')).filter((file) => file.endsWith('.yaml'))) {
      const rows = parse(readFileSync(resolve(repoRoot, 'data/sample_evidence', fileName), 'utf8')) as unknown[];
      validate(validators.evidenceTable, rows, fileName);
      for (const row of rows) validate(validators.evidence, row, fileName);
    }

    const topics = parse(readFileSync(resolve(repoRoot, 'data/seed_topics.yaml'), 'utf8')) as unknown[];
    validate(validators.topicList, topics, 'data/seed_topics.yaml');
    for (const topic of topics) validate(validators.topic, topic, 'data/seed_topics.yaml');

    for (const fileName of readdirSync(resolve(repoRoot, 'data/failure_cases')).filter((file) => file.endsWith('.yaml'))) {
      const failureCase = parse(readFileSync(resolve(repoRoot, 'data/failure_cases', fileName), 'utf8'));
      validate(validators.failureCase, failureCase, fileName);
    }

    for (const fileName of readdirSync(resolve(repoRoot, 'data/golden_cases')).filter((file) => file.endsWith('.yaml'))) {
      const goldenCase = parse(readFileSync(resolve(repoRoot, 'data/golden_cases', fileName), 'utf8'));
      validate(validators.goldenCase, goldenCase, fileName);
    }

    for (const fileName of readdirSync(resolve(repoRoot, 'data/evaluation_results')).filter((file) => file.endsWith('.yaml'))) {
      const rows = parse(readFileSync(resolve(repoRoot, 'data/evaluation_results', fileName), 'utf8')) as unknown[];
      for (const row of rows) validate(validators.evaluationResult, row, fileName);
    }

    const replayCases = parse(readFileSync(resolve(repoRoot, 'data/replay/replay_cases.yaml'), 'utf8')) as unknown[];
    for (const replayCase of replayCases) validate(validators.replayCase, replayCase, 'data/replay/replay_cases.yaml');
  });

  it('rejects malformed evidence table rows instead of accepting loose wrappers', () => {
    const schema = JSON.parse(readFileSync(resolve(schemaDir, 'evidence_table.schema.json'), 'utf8'));
    const validate = ajv.compile(schema);

    const valid = validate([
      {
        evidence_id: 'bad_ev',
        topic_id: 'bci',
        event_date: '2026-99-99',
  available_at: '2026-99-99',
        event_title: 'Malformed row',
        event_summary: 'This row should fail validation.',
        event_type: 'regulation',
        source_name: 'bad source',
        source_url: 'not a uri',
        source_type: 'fixture',
        evidence_strength: 'E9',
        affected_layer: [],
        stage_effect: 'supports_S6',
        parent_or_branch: 'branch',
        branch_coverage_score: 101,
        interpretation: 'bad',
        limitation: 'bad',
        positive_or_negative: 'mixed',
        confidence: 120,
      },
    ]);

    expect(valid).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });

  it('rejects malformed topic lists and enforces unique seed topic ids', () => {
    const schema = JSON.parse(readFileSync(resolve(schemaDir, 'topic_list.schema.json'), 'utf8'));
    const validate = ajv.compile(schema);

    const valid = validate([
      {
        topic_id: 'bad_topic',
        topic_name: 'Bad Topic',
        current_stage: 'S99',
        transition_target: 'S5',
        watch_status: 'unknown_status',
      },
    ]);

    expect(valid).toBe(false);

    const topics = parse(readFileSync(resolve(repoRoot, 'data/seed_topics.yaml'), 'utf8')) as Array<{ topic_id: string }>;
    const ids = topics.map((topic) => topic.topic_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
