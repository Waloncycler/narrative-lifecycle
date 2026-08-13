import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceChainEntry } from '@/features/evidence/types/evidence_chain';
import type { TopicDiscoveryProposal } from '@/features/narrative/types/topic_discovery';
import type { NarrativeDiscoveryRecord, NarrativeDiscoveryReport } from '@/features/narrative/types/narrative_discovery';
import { writeGenericArtifact, writeGenericTextArtifact } from '@/platform/io/run_manifest_writer';

import { DbArtifactRepository } from '@/platform/io/db_artifact_repository';
export const TOPIC_PROPOSALS_PATH = 'outputs/intake/latest_topic_discovery_proposals.json';
export const EVIDENCE_CHAIN_PATH = 'outputs/intake/latest_evidence_chain.json';
export const NARRATIVE_DISCOVERY_PATH = 'outputs/intake/latest_narrative_discovery.json';
const NARRATIVE_DISCOVERY_LEDGER_PATH = 'outputs/intake/narrative_discovery_ledger.json';

export class DbIntelligenceRepository {
  constructor(private readonly repoRoot: string = process.cwd()) {}

  writeTopicDiscoveryProposals(proposals: TopicDiscoveryProposal[]): void {
    const dbArtifact = new DbArtifactRepository();
    const stamp = compactTimestamp(proposals[0]?.generated_at ?? new Date().toISOString());
    dbArtifact.writeArtifact(`topic_proposals_${stamp}`, 'topic_proposals', proposals, renderTopicProposals(proposals));
    dbArtifact.writeArtifact('topic_proposals_latest', 'topic_proposals', proposals, renderTopicProposals(proposals));
  }

  readTopicDiscoveryProposals(): TopicDiscoveryProposal[] {
    return readJson<TopicDiscoveryProposal[]>(resolve(this.repoRoot, TOPIC_PROPOSALS_PATH), []);
  }

  writeEvidenceChain(entries: EvidenceChainEntry[]): void {
    const prior = this.readEvidenceChain();
    const byKey = new Map(prior.map((entry) => [entry.idempotency_key, entry]));
    for (const entry of entries) if (!byKey.has(entry.idempotency_key)) byKey.set(entry.idempotency_key, entry);
    const merged = [...byKey.values()].sort((a, b) => a.generated_at.localeCompare(b.generated_at));
    const dbArtifact = new DbArtifactRepository();
    const stamp = compactTimestamp(entries[0]?.generated_at ?? new Date().toISOString());
    dbArtifact.writeArtifact(`evidence_chain_${stamp}`, 'evidence_chain', entries);
    dbArtifact.writeArtifact('evidence_chain_latest', 'evidence_chain', merged, renderEvidenceChain(merged));
  }

  readEvidenceChain(): EvidenceChainEntry[] {
    return readJson<EvidenceChainEntry[]>(resolve(this.repoRoot, EVIDENCE_CHAIN_PATH), []);
  }

  writeNarrativeDiscovery(report: NarrativeDiscoveryReport): void {
    const known = this.readNarrativeDiscoveryRecords();
    const byKey = new Map<string, NarrativeDiscoveryRecord>();
    for (const record of known) byKey.set(discoveryKey(record), record);
    for (const record of report.records) byKey.set(discoveryKey(record), record);
    
    const dbArtifact = new DbArtifactRepository();
    dbArtifact.writeArtifact(`narrative_discovery_${report.report_id}`, 'narrative_discovery_report', report);
    dbArtifact.writeArtifact('narrative_discovery_latest', 'narrative_discovery_report', report, renderNarrativeDiscovery(report));
    dbArtifact.writeArtifact('narrative_discovery_ledger', 'narrative_discovery_ledger', [...byKey.values()]);
  }

  readNarrativeDiscoveryRecords(): NarrativeDiscoveryRecord[] {
    return readJson<NarrativeDiscoveryRecord[]>(resolve(this.repoRoot, NARRATIVE_DISCOVERY_LEDGER_PATH), []);
  }
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function compactTimestamp(value: string): string { return value.replace(/[-:.TZ]/g, '').slice(0, 17) || 'unknown'; }

function renderTopicProposals(proposals: TopicDiscoveryProposal[]): string {
  return `# Topic Discovery Proposals\n\n${proposals.length ? proposals.map((item) => `- ${item.kind}: ${item.proposed_topic_id ?? 'unresolved'}${item.proposed_branch_id ? ` / ${item.proposed_branch_id}` : ''}; status=${item.status}; confidence=${item.confidence}; reason=${item.reason}`).join('\n') : '- No proposals.'}\n`;
}

function renderEvidenceChain(entries: EvidenceChainEntry[]): string {
  return `# Evidence Chain\n\n${entries.length ? entries.map((item) => `- ${item.topic_id}${item.branch_id ? ` / ${item.branch_id}` : ''}: ${item.relation} ${item.evidence_id}; status=${item.status}; prior=${item.prior_evidence_ids.join(',') || 'none'}`).join('\n') : '- No chain entries.'}\n`;
}

function discoveryKey(record: NarrativeDiscoveryRecord): string {
  return `${record.discovery_id}:${record.evidence_refs.map((ref) => ref.raw_document_id).sort().join(',')}`;
}

function renderNarrativeDiscovery(report: NarrativeDiscoveryReport): string {
  const rows = report.records.map((record) => `- ${record.resolution}: ${record.topic_id ?? 'unresolved'}${record.branch_id ? ` / ${record.branch_id}` : ''}; support=${record.independent_document_count}; action=${record.registration_action}; ${record.reason}`).join('\n');
  return `# Narrative Discovery\n\n- session: ${report.session_id}\n- new branches: ${report.summary.new_branch_count}\n- provisional topics: ${report.summary.provisional_topic_count}\n- unresolved: ${report.summary.unresolved_count}\n\n${rows || '- No discoveries.'}\n`;
}
