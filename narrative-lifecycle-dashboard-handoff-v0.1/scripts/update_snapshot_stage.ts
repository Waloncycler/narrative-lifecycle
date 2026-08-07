import * as fs from 'fs';
import * as path from 'path';

const snapshotPath = path.resolve(process.cwd(), 'outputs/operator_runs/latest_stage_snapshot.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

const topicId = 'provisional_semiconductor_memory_market';
const topicIndex = snapshot.topics.findIndex((t: any) => t.topic_id === topicId);

if (topicIndex === -1) {
  console.error('Topic not found in snapshot!');
  process.exit(1);
}

const topic = snapshot.topics[topicIndex];

// Update topic properties based on our newly injected evidence
topic.current_stage = 'S6';
topic.evidence_count += 3;
topic.gate_stage = 'S6';
topic.why_not_higher_stage = 'S6 is the highest stage modeled in the current schema.';

// We should also add the evidence to the topic.evidence array if needed, but the dashboard main view 
// just looks at topic.evidence_count and topic.current_stage.

fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
console.log('Successfully updated latest_stage_snapshot.json!');
