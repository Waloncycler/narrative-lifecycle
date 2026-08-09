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
  it('contains the top-level project entrypoint files', () => {
    expectFiles(['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'PLANS.md']);
  });

  it('contains the published core docs', () => {
    expectFiles([
      'docs/README.md',
      'docs/01_theory_name_capital_reality_momentum.md',
      'docs/02_lifecycle_states_S0_S7.md',
      'docs/03_minimum_evidence_standards.md',
      'docs/04_misclassification_correction_rules.md',
      'docs/05_dashboard_card_spec.md',
      'docs/06_scoring_system_v0_2.md',
      'docs/07_data_sources_and_evidence_table.md',
      'docs/08_failure_case_library.md',
      'docs/15_system_architecture.md',
      'docs/23_ui_design_system.md',
      'docs/26_governed_active_learning.md',
      'docs/27_worldmonitor_data_sources_integration_map.md',
      'docs/28_evidence_publication_governance.md',
      'docs/31_historical_baseline_admission.md',
      'docs/32_automated_evidence_governance.md',
      'docs/OPERATOR_GUIDE.md',
      'docs/EVIDENCE_GUIDE.md',
      'docs/REPLAY_GUIDE.md',
      'docs/TROUBLESHOOTING.md',
    ]);
  });

  it('contains Phase 0 schema and golden case assets', () => {
    expectFiles([
      'schemas/topic.schema.json',
      'schemas/evidence.schema.json',
      'schemas/dashboard_card.schema.json',
      'schemas/score.schema.json',
      'schemas/narrative_memory.schema.json',
      'schemas/evidence_candidate.schema.json',
      'schemas/review_decision.schema.json',
      'schemas/intake_session.schema.json',
      'schemas/intake_evaluation.schema.json',
      'schemas/ai_shadow_audit.schema.json',
      'schemas/ai_shadow_validation_report.schema.json',
      'schemas/intake_learning_profile.schema.json',
      'schemas/intake_learning_cycle.schema.json',
      'schemas/topic_resolution_audit.schema.json',
      'schemas/topic_registry_validation.schema.json',
      'schemas/canonical_topic_registry.schema.json',
      'schemas/alias_registry.schema.json',
      'schemas/branch_registry.schema.json',
      'schemas/provisional_topic_registry.schema.json',
      'schemas/narrative_discovery_report.schema.json',
      'schemas/narrative_graph_promotion_report.schema.json',
      'schemas/autonomous_research_policy_audit.schema.json',
      'schemas/web_research_report.schema.json',
      'schemas/research_source_atlas.schema.json',
      'schemas/research_universe.schema.json',
      'schemas/research_campaign.schema.json',
      'schemas/company_research_registry.schema.json',
      'schemas/direct_source_research_report.schema.json',
      'schemas/baseline_evidence_reconciliation_report.schema.json',
      'schemas/historical_provenance_recovery_report.schema.json',
      'data/golden_cases/bci.yaml',
      'data/golden_cases/humanoid_robotics.yaml',
      'data/golden_cases/innovative_drug_license_out.yaml',
      'data/intake/examples/bci_branch_note.md',
      'data/intake/pilot_documents/manifest.yaml',
      'data/topic_registry/canonical_topics.yaml',
      'data/topic_registry/aliases.yaml',
      'data/topic_registry/branches.yaml',
      'data/topic_registry/provisional_topics.yaml',
      'data/failure_cases/ai_edge_application.yaml',
      'src/cli/run_intake_ai_shadow.ts',
      'src/cli/run_intake_ai_evaluate.ts',
      'src/cli/run_intake_learn.ts',
      'src/cli/run_intake_learning_cycle.ts',
      'src/features/narrative/domain/narrative_discovery.ts',
      'src/features/narrative/domain/narrative_graph_promotion.ts',
      'src/features/research/domain/web_research.ts',
      'src/features/research/domain/research_coverage.ts',
      'src/features/research/domain/direct_source_research.ts',
      'src/features/research/domain/baseline_evidence_reconciliation.ts',
      'src/features/research/domain/historical_provenance_recovery.ts',
      'src/features/evidence/domain/evidence_source_normalization.ts',
      'src/platform/io/runtime_env.ts',
      'src/features/research/domain/research_source_quality.ts',
      'src/features/research/domain/autonomous_research_policy_validation.ts',
      'src/app/use_cases/run_direct_source_research_use_case.ts',
      'src/app/use_cases/prepare_direct_source_intake_use_case.ts',
      'src/app/use_cases/append_retrieved_source_intake_use_case.ts',
      'src/platform/io/runtime_env.ts',
      'src/features/research/io/authoritative_direct_source_provider.ts',
      'src/cli/run_research_campaign.ts',
      'src/cli/run_validate_autonomous_research_policy.ts',
      'src/cli/run_baseline_reconcile.ts',
      'src/cli/run_baseline_admit.ts',
      'src/cli/run_historical_provenance_recovery.ts',
      'data/source_atlas/authoritative_sources.yaml',
      'data/research_universe/core_topics.yaml',
    ]);
  });

  it('keeps handoff package asset groups populated', () => {
    expect(readdirSync(resolve(repoRoot, 'schemas')).filter((file) => file.endsWith('.json')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'prompts')).filter((file) => file.endsWith('.md')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'examples')).filter((file) => file.endsWith('.md')).length).toBeGreaterThan(0);
    expect(readdirSync(resolve(repoRoot, 'data/golden_cases')).filter((file) => file.endsWith('.yaml')).length).toBe(3);
  });
});
