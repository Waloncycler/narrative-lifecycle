import { describe, expect, it, vi } from 'vitest';
import { NormalizeTopicNamesUseCase } from '@/app/use_cases/normalize_topic_names_use_case';

describe('NormalizeTopicNamesUseCase', () => {
  it('localizes curated English names and merges only exact Chinese-name duplicates', () => {
    const updateName = vi.fn();
    const mergeDuplicate = vi.fn();
    const writeReport = vi.fn();
    const useCase = new NormalizeTopicNamesUseCase({
      now: () => '2026-08-19T00:00:00.000Z',
      readTopics: () => [
        { topic_id: 'solid_state_battery', topic_name: '固态电池', market_name_en: 'Solid-state battery', status: 'active', evidence_count: 1 },
        { topic_id: 'provisional_solid_state_battery', topic_name: '固态电池', market_name_en: 'Solid-state battery', status: 'active', evidence_count: 9 },
        { topic_id: 'provisional_advanced_packaging', topic_name: 'Advanced Packaging', market_name_en: null, status: 'provisional', evidence_count: 2 },
        { topic_id: 'unmapped_english', topic_name: 'Unknown Theme', market_name_en: null, status: 'provisional', evidence_count: 0 },
      ],
      updateName, mergeDuplicate, writeReport,
    });
    const report = useCase.execute();
    expect(updateName).toHaveBeenCalledWith('provisional_advanced_packaging', '先进封装', 'Advanced Packaging', report.generated_at);
    expect(mergeDuplicate).toHaveBeenCalledWith('provisional_solid_state_battery', 'solid_state_battery', '固态电池', report.generated_at);
    expect(report).toMatchObject({ localized_count: 1, merged_count: 1, unresolved_english_count: 1 });
    expect(report.unresolved_english).toEqual([{ topic_id: 'unmapped_english', topic_name: 'Unknown Theme' }]);
    expect(writeReport).toHaveBeenCalledWith(report);
  });
});
