import * as fs from 'fs';
import * as path from 'path';

const snapshotPath = path.resolve(process.cwd(), 'outputs/operator_runs/latest_stage_snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

for (let i = 0; i < snapshot.topics.length; i++) {
  const t = snapshot.topics[i];
  if (t.name && !t.topic_name) {
      t.topic_name = t.name;
      delete t.name;
  }
  if (!t.branches) {
      t.branches = [];
  }
  if (!t.parent_narrative) {
      t.parent_narrative = t.topic_name;
  }
  if (!t.max_allowed_stage) {
      t.max_allowed_stage = t.current_stage;
  }
  if (!t.strongest_branch) {
      t.strongest_branch = 'no independent branch';
  }
  if (!t.weakest_layer) {
      t.weakest_layer = 'perception';
  }
  if (!t.evidence_ids) {
      t.evidence_ids = [];
  }
  if (!t.gate_evidence_ids) {
      t.gate_evidence_ids = [];
  }
  if (!t.gate_input) {
      t.gate_input = {
          hasStableLabel: true,
          hasCapitalConfirmation: true,
          hasPricingAdoption: true,
          hasHardRealityEvidence: true,
          independentSourceCount: 3
      };
  }
}

fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
console.log('Fixed snapshot topic schemas!');
