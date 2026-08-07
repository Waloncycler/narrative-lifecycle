/**
 * Historical Origins Enricher Script
 *
 * Runs the historical evidence enricher across all topics in the registry
 * to find the absolute earliest first appearance (origin) of each narrative.
 * It appends these origin evidence nodes to the evidence_table.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HistoricalEvidenceEnricher } from '../src/domain/historical_evidence_enricher';
import { AuthoritativeDirectSourceProvider } from '../src/infrastructure/authoritative_direct_source_provider';

const repoRoot = process.cwd();

async function runEnrichment() {
  const provider = new AuthoritativeDirectSourceProvider();
  const enricher = new HistoricalEvidenceEnricher(provider);

  // Load registry from snapshot fallback
  const snapshotPath = resolve(repoRoot, 'outputs/operator_runs/latest_stage_snapshot.json');
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const topics = snapshot.topics || [];

  // Load existing evidence
  const evidencePath = resolve(repoRoot, 'data/evidence_table/evidence_table.json');
  const existingEvidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const existingIds = new Set(existingEvidence.map((e: any) => e.evidence_id));

  let added = 0;

  for (const topic of topics) {
    const result = await enricher.enrichTopicOrigins(topic.topic_id, [topic.topic_name]);
    
    if (result.new_evidence_count > 0) {
      console.log(`✅ Found ${result.new_evidence_count} historical origin nodes for ${topic.topic_name} (earliest: ${result.earliest_date})`);
      
      for (const node of result.evidence) {
        if (!existingIds.has(node.evidence_id)) {
          existingEvidence.push(node);
          existingIds.add(node.evidence_id);
          added++;
        }
      }
    }
  }

  if (added > 0) {
    writeFileSync(evidencePath, JSON.stringify(existingEvidence, null, 2) + '\n');
    console.log(`\n🎉 Successfully injected ${added} historical origin evidence nodes!`);
  } else {
    console.log(`\n⚠️ No new historical origins found (already present).`);
  }
}

runEnrichment().catch(console.error);
