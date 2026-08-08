import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceIntakeSession } from '@/features/intake/types/intake';
import type { IntakeLearningCycle } from '@/features/intake/types/intake_learning_cycle';
import type { AgentPurgeDecision, ResearchAgentEvolutionLedger, ResearchAgentRunManifest, ResearchAgentSchedulerConfig } from '@/features/research/types/research_agent';
import { DEFAULT_SCHEDULER_CONFIG } from '@/features/research/types/research_agent';
import { writeJsonAtomically } from '@/platform/io/run_manifest_writer';
import type { StaleCandidateInput, AgedQueueItemInput } from '@/features/research/domain/agent_purge_rules';

/**
 * File-backed repository for autonomous research agent artifacts.
 *
 * Persists: agent candidate ledger (agent-produced, unreviewed candidates),
 * evolution ledger, run manifest history, and scheduler configuration.
 */

interface AgentCandidateLedgerEntry {
  candidate_id: string;
  created_at: string;
  status: 'open' | 'discarded' | 'reviewed' | 'imported';
  session_id: string | null;
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function safeResolve(repoRoot: string, relative: string): string {
  return resolve(repoRoot, relative);
}

export class FileResearchAgentRepository {
  private readonly ledgerPath: string;
  private readonly evolutionPath: string;
  private readonly historyDir: string;
  private readonly latestRunPath: string;
  private readonly schedulerConfigPath: string;

  constructor(private readonly repoRoot: string) {
    this.ledgerPath = safeResolve(repoRoot, 'outputs/research_agent/agent_candidate_ledger.json');
    this.evolutionPath = safeResolve(repoRoot, 'outputs/research_agent/evolution_ledger.json');
    this.historyDir = safeResolve(repoRoot, 'outputs/research_agent/history');
    this.latestRunPath = safeResolve(repoRoot, 'outputs/research_agent/latest_run.json');
    this.schedulerConfigPath = safeResolve(repoRoot, 'configs/research_agent_scheduler.json');
  }

  private readLedger(): AgentCandidateLedgerEntry[] {
    return readJson<AgentCandidateLedgerEntry[]>(this.ledgerPath) ?? [];
  }

  private writeLedger(entries: AgentCandidateLedgerEntry[]): void {
    writeJsonAtomically(this.ledgerPath, entries);
  }

  /**
   * Merges agent-produced candidates from the current intake session into the
   * ledger (first-seen time preserved) and marks reviewed/imported entries from
   * the latest apply result and evidence table.
   */
  private ensureLedger(): AgentCandidateLedgerEntry[] {
    const entries = this.readLedger();
    const session = readJson<EvidenceIntakeSession>(safeResolve(this.repoRoot, 'outputs/intake/latest_session.json'));
    const applyResult = readJson<{ accepted_evidence_ids?: string[] }>(safeResolve(this.repoRoot, 'outputs/intake/latest_apply_result.json'));
    const accepted = new Set(applyResult?.accepted_evidence_ids ?? []);
    const now = new Date().toISOString();
    const byId = new Map(entries.map((entry) => [entry.candidate_id, entry]));

    if (session) {
      for (const candidate of session.candidates) {
        if (!('agent_candidate_id' in candidate)) continue;
        const candidateId = (candidate as { agent_candidate_id: string }).agent_candidate_id;
        if (!byId.has(candidateId)) {
          byId.set(candidateId, {
            candidate_id: candidateId,
            created_at: session.generated_at ?? now,
            status: 'open',
            session_id: session.session_id,
          });
        }
      }
      const sessionIds = new Set(session.candidates.filter((c) => 'agent_candidate_id' in c).map((c) => (c as { agent_candidate_id: string }).agent_candidate_id));
      for (const entry of byId.values()) {
        if (sessionIds.has(entry.candidate_id)) {
          entry.session_id = session.session_id;
          if (entry.status === 'open' && accepted.has(entry.candidate_id)) entry.status = 'reviewed';
        }
      }
    }

    const merged = [...byId.values()];
    this.writeLedger(merged);
    return merged;
  }

  readStaleCandidates(): StaleCandidateInput[] {
    return this.ensureLedger().map((entry) => ({
      candidate_id: entry.candidate_id,
      created_at: entry.created_at,
      reviewed: entry.status === 'reviewed' || entry.status === 'imported',
      imported: entry.status === 'imported',
      status: entry.status,
    }));
  }

  readQueueItems(): AgedQueueItemInput[] {
    const cycle = readJson<IntakeLearningCycle>(safeResolve(this.repoRoot, 'outputs/intake/latest_learning_cycle.json'));
    const ledger = new Map(this.ensureLedger().map((entry) => [entry.candidate_id, entry]));
    if (!cycle) return [];
    return cycle.active_learning_queue.map((item) => ({
      item_id: item.candidate_id,
      created_at: ledger.get(item.candidate_id)?.created_at ?? cycle.generated_at,
      priority: item.priority_band,
      status: 'open',
    }));
  }

  discardPurged(decisions: AgentPurgeDecision[]): void {
    const discardIds = new Set(decisions.filter((decision) => decision.discard).map((decision) => decision.target_id));
    const ledger = this.ensureLedger();
    for (const entry of ledger) {
      if (discardIds.has(entry.candidate_id) && entry.status === 'open') entry.status = 'discarded';
    }
    this.writeLedger(ledger);
  }

  readEvolutionLedger(): ResearchAgentEvolutionLedger | null {
    return readJson<ResearchAgentEvolutionLedger>(this.evolutionPath);
  }

  writeEvolutionLedger(ledger: ResearchAgentEvolutionLedger): void {
    writeJsonAtomically(this.evolutionPath, ledger);
  }

  readLearningMetrics(): { acceptance_rate: number | null; shadow_agreement_rate: number | null; golden_gate_pass_rate: number | null } {
    const applyResult = readJson<{ accepted_count?: number; rejected_count?: number; duplicate_count?: number; modified_count?: number; split_count?: number }>(
      safeResolve(this.repoRoot, 'outputs/intake/latest_apply_result.json'),
    );
    let acceptanceRate: number | null = null;
    if (applyResult) {
      const reviewedTotal =
        (applyResult.accepted_count ?? 0) +
        (applyResult.rejected_count ?? 0) +
        (applyResult.duplicate_count ?? 0) +
        (applyResult.modified_count ?? 0) +
        (applyResult.split_count ?? 0);
      if (reviewedTotal > 0) acceptanceRate = (applyResult.accepted_count ?? 0) / reviewedTotal;
    }

    const shadowReport = readJson<{ citation_accuracy?: number; unsupported_claim_rate?: number }>(
      safeResolve(this.repoRoot, 'outputs/intake/latest_ai_shadow_validation_report.json'),
    );
    let shadowAgreement: number | null = null;
    if (shadowReport) {
      if (typeof shadowReport.citation_accuracy === 'number') {
        shadowAgreement = shadowReport.citation_accuracy;
      } else if (typeof shadowReport.unsupported_claim_rate === 'number') {
        shadowAgreement = 1 - shadowReport.unsupported_claim_rate;
      }
    }

    const cycle = readJson<{ promotion_gates?: Array<{ passed: boolean }> }>(
      safeResolve(this.repoRoot, 'outputs/intake/latest_learning_cycle.json'),
    );
    let gatePassRate: number | null = null;
    if (cycle?.promotion_gates?.length) {
      gatePassRate = cycle.promotion_gates.filter((gate) => gate.passed).length / cycle.promotion_gates.length;
    }

    return { acceptance_rate: acceptanceRate, shadow_agreement_rate: shadowAgreement, golden_gate_pass_rate: gatePassRate };
  }

  writeRunManifest(manifest: ResearchAgentRunManifest): void {
    mkdirSync(this.historyDir, { recursive: true });
    writeJsonAtomically(resolve(this.historyDir, `${manifest.run_id}.json`), manifest);
    writeJsonAtomically(this.latestRunPath, manifest);
  }

  listRunManifests(): ResearchAgentRunManifest[] {
    if (!existsSync(this.historyDir)) return [];
    const files = readdirJson(this.historyDir);
    return files.map((file) => readJson<ResearchAgentRunManifest>(file)).filter((m): m is ResearchAgentRunManifest => m !== null).sort((a, b) => b.started_at.localeCompare(a.started_at));
  }

  readSchedulerConfig(): ResearchAgentSchedulerConfig {
    const existing = readJson<ResearchAgentSchedulerConfig>(this.schedulerConfigPath);
    if (!existing) {
      this.writeSchedulerConfig(DEFAULT_SCHEDULER_CONFIG);
      return DEFAULT_SCHEDULER_CONFIG;
    }
    return { ...DEFAULT_SCHEDULER_CONFIG, ...existing };
  }

  writeSchedulerConfig(config: ResearchAgentSchedulerConfig): void {
    writeJsonAtomically(this.schedulerConfigPath, config);
  }
}

function readdirJson(dir: string): string[] {
  return readdirSync(dir).map((file) => resolve(dir, file)).filter((path) => path.endsWith('.json'));
}
