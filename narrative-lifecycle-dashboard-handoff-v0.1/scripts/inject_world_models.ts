import * as fs from 'fs';
import * as path from 'path';

const timelinesPath = path.resolve(process.cwd(), 'outputs/evolution_timelines/all_topics_evolution.json');
const snapshotPath = path.resolve(process.cwd(), 'outputs/operator_runs/latest_stage_snapshot.json');

const timelines = JSON.parse(fs.readFileSync(timelinesPath, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

const nt = { id: 'provisional_world_models', name: '世界模型与大模型' };

if (!timelines.find((t: any) => t.topic_id === nt.id)) {
  console.log(`Creating new topic: ${nt.name}`);
  timelines.push({
    topic_id: nt.id,
    topic_name: nt.name,
    first_emergence_date: '2023-01-01',
    current_stage: 'S0',
    total_evidence_count: 0,
    transitions: [],
    evolution_path: 'S0',
    evidence_timeline: []
  });
  
  snapshot.topics.push({
    topic_id: nt.id,
    topic_name: nt.name,
    parent_narrative: nt.name,
    current_stage: 'S0',
    evidence_count: 0,
    gate_stage: 'S0',
    max_allowed_stage: 'S0',
    strongest_branch: 'no independent branch',
    weakest_layer: 'perception',
    score: 10,
    last_updated: new Date().toISOString(),
    evidence_ids: [],
    gate_evidence_ids: [],
    branches: [],
    gate_input: {
        hasStableLabel: true,
        hasCapitalConfirmation: false,
        hasPricingAdoption: false,
        hasHardRealityEvidence: false,
        independentSourceCount: 0
    }
  });
}

fs.writeFileSync(timelinesPath, JSON.stringify(timelines, null, 2), 'utf8');
fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
console.log('World Models injected!');
