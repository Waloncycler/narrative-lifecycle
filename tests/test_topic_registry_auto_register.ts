import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { TopicResolution } from '@/features/narrative/types/topic_resolution';
import { FileTopicRegistryRepository } from '@/platform/io/topic_registry_io';

function seedRegistry(root: string): void {
  mkdirSync(join(root, 'data/topic_registry'), { recursive: true });
  writeFileSync(join(root, 'data/topic_registry/canonical_topics.yaml'), `- topic_id: bci\n  topic_name: BCI\n  current_stage: S4\n  status: active\n`);
  writeFileSync(join(root, 'data/topic_registry/branches.yaml'), `- branch_id: bci_medical_rehab\n  topic_id: bci\n  branch_name: medical rehabilitation\n  status: active\n`);
  writeFileSync(join(root, 'data/topic_registry/aliases.yaml'), `- alias: neuro rehab\n  topic_id: bci\n  reason: Alias to BCI branch language.\n`);
  writeFileSync(join(root, 'data/topic_registry/provisional_topics.yaml'), `[]\n`);
}

describe('FileTopicRegistryRepository auto-registration (autonomous mode)', () => {
  it('registers new provisional topics and branches into the registry files', () => {
    const root = mkdtempSync(join(tmpdir(), 'topic-registry-auto-'));
    seedRegistry(root);
    const repo = new FileTopicRegistryRepository(root);

    const resolutions: TopicResolution[] = [
      { candidate_id: 'candidate_fusion', status: 'new_provisional_topic', provisional_topic_id: 'provisional_fusion_energy', resolved_topic_id: null, resolved_branch_id: null, reason: 'Fusion supply chain validation.', confidence: 'medium', alternatives: [], audit_required: false },
      { candidate_id: 'candidate_sports', status: 'new_branch', provisional_topic_id: null, resolved_topic_id: 'bci', resolved_branch_id: 'bci_sports_rehab', reason: 'Sports rehab branch evidence.', confidence: 'medium', alternatives: [], audit_required: false },
    ];
    repo.registerResolutions(resolutions);

    const canonical = parse(readFileSync(join(root, 'data/topic_registry/canonical_topics.yaml'), 'utf8')) as Array<{ topic_id: string; current_stage: string; status: string }>;
    const branches = parse(readFileSync(join(root, 'data/topic_registry/branches.yaml'), 'utf8')) as Array<{ branch_id: string }>;
    const provisional = parse(readFileSync(join(root, 'data/topic_registry/provisional_topics.yaml'), 'utf8')) as Array<{ provisional_topic_id: string; status: string }>;

    expect(canonical.map((item) => item.topic_id)).toEqual(['bci', 'provisional_fusion_energy']);
    expect(canonical[1]).toMatchObject({ current_stage: 'S0', status: 'provisional' });
    expect(branches.map((item) => item.branch_id)).toEqual(['bci_medical_rehab', 'bci_sports_rehab']);
    expect(provisional[0]).toMatchObject({ provisional_topic_id: 'provisional_fusion_energy', status: 'provisional' });
    rmSync(root, { recursive: true, force: true });
  });

  it('is idempotent and never duplicates registrations', () => {
    const root = mkdtempSync(join(tmpdir(), 'topic-registry-idem-'));
    seedRegistry(root);
    const repo = new FileTopicRegistryRepository(root);

    const resolutions: TopicResolution[] = [
      { candidate_id: 'candidate_fusion', status: 'new_provisional_topic', provisional_topic_id: 'provisional_fusion_energy', resolved_topic_id: null, resolved_branch_id: null, reason: 'Fusion supply chain validation.', confidence: 'medium', alternatives: [], audit_required: false },
    ];
    repo.registerResolutions(resolutions);
    repo.registerResolutions(resolutions);

    const canonical = parse(readFileSync(join(root, 'data/topic_registry/canonical_topics.yaml'), 'utf8')) as Array<{ topic_id: string }>;
    expect(canonical.filter((item) => item.topic_id === 'provisional_fusion_energy')).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });
});
