import { describe, expect, it } from 'vitest';
import { isUsableBranchName, marketBranchName, marketNameWarning, marketTopicName } from '@/features/narrative/domain/market_naming';
import { buildOperationalResearchState } from '@/features/reporting/domain/operational_research_state';
import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import type { EvidenceNode } from '@/features/evidence/domain/evidence';

describe('source-backed market naming', () => {
  it('shows a verified Chinese market name while retaining stable ids and English retrieval names', () => {
    const topic = {
      topic_id: 'bci', topic_name: 'Brain-computer interface', market_name_zh: '脑机接口', market_name_en: 'Brain-computer interface',
      naming_status: 'verified' as const,
      naming_sources: [{ source_name: 'MIIT', source_url: 'https://example.test/miit', available_at: '2025-07-30', source_quote: '脑机接口' }],
      current_stage: 'S0', status: 'active' as const,
    };
    expect(marketTopicName(topic)).toBe('脑机接口');
    expect(marketNameWarning(topic)).toBeNull();
  });

  it('does not present an internally generated provisional label as verified market consensus', () => {
    expect(marketNameWarning({ naming_status: 'unresolved', naming_sources: [] })).toContain('尚未通过来源核验');
  });

  it('hides prompt debris and opaque trial or generated ids behind a naming-review placeholder', () => {
    expect(marketBranchName({ branch_id: 'bad', topic_id: 'bci', branch_name: '第三个对话窗口里研究发布方案', status: 'watch', naming_status: 'unresolved' })).toBe('待命名细分方向');
    expect(marketBranchName({ branch_id: 'trial', topic_id: 'bci', branch_name: 'NCT07530367', status: 'watch', naming_status: 'unresolved' })).toBe('待命名细分方向');
    expect(isUsableBranchName('待命名细分方向')).toBe(false);
    expect(isUsableBranchName('人形机器人执行器')).toBe(true);
    expect(marketBranchName({ branch_id: 'actuator', topic_id: 'humanoid_robotics', branch_name: '人形机器人执行器', status: 'watch', naming_status: 'provisional' })).toBe('人形机器人执行器（待核验）');
  });

  it('uses Chinese parent/branch labels without allowing medical branch Evidence to lift the BCI parent', () => {
    const registry: TopicRegistry = {
      canonical_topics: [{ topic_id: 'bci', topic_name: 'Brain-computer interface', market_name_zh: '脑机接口', current_stage: 'S0', status: 'active' }],
      aliases: [],
      branches: [{ branch_id: 'bci_medical', topic_id: 'bci', branch_name: 'medical rehabilitation', market_name_zh: '脑机接口医疗康复', status: 'active' }],
      provisional_topics: [],
      memory_topic_ids: [],
    };
    const branchEvidence: EvidenceNode = {
      evidence_id: 'medical_only', topic_id: 'bci', branch_id: 'bci_medical', parent_or_branch: 'branch', event_date: '2026-08-03', available_at: '2026-08-03',
      event_title: 'Medical BCI approval', event_type: 'approval', source_name: 'official', source_url: 'https://example.test', evidence_strength: 'E4', affected_layer: ['reality'], stage_effect: 'upgrade', confidence: 90,
    };
    const state = buildOperationalResearchState({ registry, evidence: [branchEvidence], runId: 'run_market_names', generatedAt: '2026-08-03T00:00:00.000Z' });
    expect(state.snapshot.topics[0]).toMatchObject({ topic_name: '脑机接口', current_stage: 'S0' });
    expect(state.snapshot.topics[0]?.branches[0]).toMatchObject({ branch_name: '脑机接口医疗康复' });
  });
});
