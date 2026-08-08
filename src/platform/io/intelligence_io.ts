import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceChainEntry } from '@/features/evidence/types/evidence_chain';
import type { TopicDiscoveryProposal } from '@/features/narrative/types/topic_discovery';
import type { NarrativeDiscoveryRecord, NarrativeDiscoveryReport } from '@/features/narrative/types/narrative_discovery';
import { writeJsonAtomically, writeTextAtomically } from '@/platform/io/run_manifest_writer';

export const TOPIC_PROPOSALS_PATH = 'outputs/intake/latest_topic_discovery_proposals.json';
export const EVIDENCE_CHAIN_PATH = 'outputs/intake/latest_evidence_chain.json';
export const NARRATIVE_DISCOVERY_PATH = 'outputs/intake/latest_narrative_discovery.json';
const NARRATIVE_DISCOVERY_LEDGER_PATH = 'outputs/intake/narrative_discovery_ledger.json';

export class FileIntelligenceRepository {
  constructor(private readonly repoRoot: string) {}

  writeTopicDiscoveryProposals(proposals: TopicDiscoveryProposal[]): void {
    writeJsonAtomically(resolve(this.repoRoot, TOPIC_PROPOSALS_PATH), proposals);
    const stamp = compactTimestamp(proposals[0]?.generated_at ?? new Date().toISOString());
    writeJsonAtomically(resolve(this.repoRoot, `outputs/intake/history/topic_proposals_${stamp}.json`), proposals);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/intake/latest_topic_discovery_proposals.md'), renderTopicProposals(proposals));
  }

  readTopicDiscoveryProposals(): TopicDiscoveryProposal[] {
    return readJson<TopicDiscoveryProposal[]>(resolve(this.repoRoot, TOPIC_PROPOSALS_PATH), []);
  }

  writeEvidenceChain(entries: EvidenceChainEntry[]): void {
    const prior = this.readEvidenceChain();
    const byKey = new Map(prior.map((entry) => [entry.idempotency_key, entry]));
    for (const entry of entries) if (!byKey.has(entry.idempotency_key)) byKey.set(entry.idempotency_key, entry);
    const merged = [...byKey.values()].sort((a, b) => a.generated_at.localeCompare(b.generated_at));
    writeJsonAtomically(resolve(this.repoRoot, EVIDENCE_CHAIN_PATH), merged);
    const stamp = compactTimestamp(entries[0]?.generated_at ?? new Date().toISOString());
    writeJsonAtomically(resolve(this.repoRoot, `outputs/intake/history/evidence_chain_${stamp}.json`), entries);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/intake/latest_evidence_chain.md'), renderEvidenceChain(merged));
  }

  readEvidenceChain(): EvidenceChainEntry[] {
    return readJson<EvidenceChainEntry[]>(resolve(this.repoRoot, EVIDENCE_CHAIN_PATH), []);
  }

  writeNarrativeDiscovery(report: NarrativeDiscoveryReport): void {
    writeJsonAtomically(resolve(this.repoRoot, NARRATIVE_DISCOVERY_PATH), report);
    writeJsonAtomically(resolve(this.repoRoot, `outputs/intake/history/${report.report_id}.json`), report);
    const known = this.readNarrativeDiscoveryRecords();
    const byKey = new Map<string, NarrativeDiscoveryRecord>();
    for (const record of known) byKey.set(discoveryKey(record), record);
    for (const record of report.records) byKey.set(discoveryKey(record), record);
    writeJsonAtomically(resolve(this.repoRoot, NARRATIVE_DISCOVERY_LEDGER_PATH), [...byKey.values()]);
    writeTextAtomically(resolve(this.repoRoot, 'outputs/intake/latest_narrative_discovery.md'), renderNarrativeDiscovery(report));
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
