/**
 * Archive Discovery-Noise Branches
 *
 * The autonomous discovery loop occasionally registers watch branches from
 * malformed source spans: truncated sentences, hash-only placeholders,
 * mis-parented concepts, or a price-action label that contradicts the system's
 * "not a trading system" identity. These rows carry no Evidence and no market
 * meaning.
 *
 * This script marks such branches `status: archived` (preserved for recovery,
 * hidden from the operational snapshot) and writes an audit record. It never
 * deletes rows and never touches an evidenced branch.
 *
 * Usage: npx tsx scripts/archive_discovery_noise_branches.ts [--dry-run]
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { BranchRecord } from '../src/types/topic_resolution';
import { FileAutonomousResearchRepository } from '../src/infrastructure/autonomous_research_io';

const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? process.cwd();
const dryRun = process.argv.includes('--dry-run');

/** Branch id -> reason for archiving. */
const TO_ARCHIVE: Record<string, string> = {
  provisional_ai_foundation_models_branch_awhccv: 'Malformed discovery span; name is a sentence fragment ("第三个对话窗口里研究发布方案").',
  provisional_ai_foundation_models_branch_evhmt7: 'Hash-only placeholder name ("Branch Evhmt7"); no market meaning.',
  provisional_ai_foundation_models_branch_bmbjj5: 'Malformed discovery span; name is a sentence fragment ("百亿订单履约及算力产能持续扩张需求").',
  provisional_semiconductor_advanced_manufacturing_branch_bkonti: 'Malformed discovery span; name is a sentence fragment ("轻量智造还将沿着轻量化制造").',
  provisional_ai_agents_into_multi_level_tree_that_ranges_from_fine_grained_diagno: 'Branch id is a truncated English sentence; not a market-recognisable sub-narrative.',
  provisional_ai_agents_varied_diagnostic: 'Generic fragment ("varied diagnostic"); not a market-recognisable sub-narrative.',
  provisional_computing_infrastructure_deploying_infrastructure: 'Generic fragment ("deploying infrastructure"); duplicates the parent scope.',
  provisional_blockchain_crypto_market_branch_1mjfs84: 'Mis-parented generic label ("设备制造") under the crypto parent; no evidence.',
  innovative_drug_license_out_gp2013: 'Unresolved single-asset code with no evidence; not a license-out sub-narrative.',
  a_share_price_action: 'Price-action label contradicts the system identity ("not a trading system; no target prices").',
  ai_adoption: 'Mis-parented: "AI 应用" is not a sub-narrative of 高端消费. Re-create under a better parent if warranted.',
};

const branchesPath = 'data/topic_registry/branches.yaml';
const branches = parse(readFileSync(resolve(repoRoot, branchesPath), 'utf8')) as BranchRecord[];
const operational = new FileAutonomousResearchRepository(repoRoot).readOperationalEvidence();
const evidencedBranchIds = new Set(
  operational.filter((item) => item.parent_or_branch === 'branch' && item.branch_id).map((item) => item.branch_id as string),
);

const applied: Array<{ branch_id: string; reason: string }> = [];
const skipped: string[] = [];

for (const branch of branches) {
  const reason = TO_ARCHIVE[branch.branch_id];
  if (!reason) continue;
  if (evidencedBranchIds.has(branch.branch_id)) {
    // Safety: never archive a branch that carries evidence.
    skipped.push(`${branch.branch_id} (has evidence — not archived)`);
    continue;
  }
  if (branch.status === 'archived') {
    skipped.push(`${branch.branch_id} (already archived)`);
    continue;
  }
  branch.status = 'archived';
  applied.push({ branch_id: branch.branch_id, reason });
}

const missing = Object.keys(TO_ARCHIVE).filter(
  (id) => !branches.some((branch) => branch.branch_id === id),
);

console.log(`archived=${applied.length} skipped=${skipped.length} missing_from_registry=${missing.length}`);
for (const row of applied) console.log(`  archived ${row.branch_id}`);
for (const row of skipped) console.log(`  skipped ${row}`);
for (const id of missing) console.log(`  not found ${id}`);

if (dryRun) {
  console.log('--dry-run: no files written.');
  process.exit(0);
}

if (applied.length) {
  const { writeTextAtomically } = await import('../src/services/run_manifest_writer');
  writeTextAtomically(resolve(repoRoot, branchesPath), stringify(branches));

  const auditPath = resolve(repoRoot, 'data/audit/branch_archival.jsonl');
  mkdirSync(resolve(repoRoot, 'data/audit'), { recursive: true });
  appendFileSync(
    auditPath,
    `${JSON.stringify({
      archival_id: `branch_archival_${new Date().toISOString().replaceAll(/[:.]/g, '')}`,
      archived_at: new Date().toISOString(),
      change_type: 'discovery_noise_branch_archival',
      branches: applied,
      guardrail_check: {
        no_evidenced_branch_archived: true,
        rows_preserved_for_recovery: true,
        no_stage_or_score_change: true,
        no_parent_upgrade: true,
      },
      reason: 'Archive malformed / mis-parented auto-discovery watch branches with zero evidence. Rows are preserved; only their operational visibility changes.',
    })}\n`,
    'utf8',
  );
  console.log(`wrote ${branchesPath} and appended ${auditPath}`);
}
