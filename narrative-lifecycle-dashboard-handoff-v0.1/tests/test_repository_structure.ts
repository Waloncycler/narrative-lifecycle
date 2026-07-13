import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function expectFiles(paths: string[]) {
  for (const path of paths) {
    expect(existsSync(resolve(repoRoot, path)), `${path} should exist`).toBe(true);
  }
}

describe('repository structure', () => {
  it('contains the handoff entrypoint files', () => {
    expectFiles(['AGENTS.md', 'README.md', 'PLANS.md', 'BATCH_INDEX.md']);
  });

  it('contains the documented core docs from the handoff batch index', () => {
    expectFiles([
      'docs/00_project_overview.md',
      'docs/01_theory_name_capital_reality_momentum.md',
      'docs/02_lifecycle_states_S0_S7.md',
      'docs/03_minimum_evidence_standards.md',
      'docs/04_misclassification_correction_rules.md',
      'docs/05_dashboard_card_spec.md',
      'docs/06_scoring_system_v0_2.md',
      'docs/07_data_sources_and_evidence_table.md',
      'docs/08_failure_case_library.md',
      'docs/09_narrative_tree.md',
      'docs/10_early_opportunity_radar.md',
      'docs/11_narrative_memory_and_reactivation.md',
      'docs/12_mvp_scope_and_product_shape.md',
      'docs/13_decision_records.md',
      'docs/14_glossary.md',
      'docs/15_system_architecture.md',
      'docs/16_performance_and_cost_optimization.md',
      'docs/17_migration_strategy.md',
      'docs/18_evaluation_framework.md',
      'docs/19_operational_workflow.md',
    ]);
  });

  it('contains Phase 0 schema and golden case assets', () => {
    expectFiles([
      'schemas/topic.schema.json',
      'schemas/evidence.schema.json',
      'schemas/dashboard_card.schema.json',
      'schemas/score.schema.json',
      'schemas/narrative_memory.schema.json',
      'data/golden_cases/bci.yaml',
      'data/golden_cases/humanoid_robotics.yaml',
      'data/golden_cases/innovative_drug_license_out.yaml',
      'data/failure_cases/ai_edge_application.yaml',
    ]);
  });

  it('keeps handoff package asset groups populated', () => {
    expect(readdirSync(resolve(repoRoot, 'schemas')).filter((file) => file.endsWith('.json')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'prompts')).filter((file) => file.endsWith('.md')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'examples')).filter((file) => file.endsWith('.md')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'data/golden_cases')).filter((file) => file.endsWith('.yaml')).length).toBe(3);
  });
});
