import { TOPIC_NAME_LOCALIZATIONS } from '@/config/topic_name_localizations';

export interface TopicNamingRecord {
  topic_id: string;
  topic_name: string;
  market_name_en: string | null;
  status: string;
  evidence_count: number;
}

export interface TopicNamingNormalizationReport {
  artifact_type: 'topic_naming_normalization_report';
  schema_version: '1.0.0';
  generated_at: string;
  localized_count: number;
  merged_count: number;
  unresolved_english_count: number;
  localized: Array<{ topic_id: string; previous_name: string; chinese_name: string }>;
  merged: Array<{ source_topic_id: string; target_topic_id: string; canonical_name: string }>;
  unresolved_english: Array<{ topic_id: string; topic_name: string }>;
}

export interface NormalizeTopicNamesUseCaseDeps {
  now(): string;
  readTopics(): TopicNamingRecord[];
  updateName(topicId: string, chineseName: string, englishName: string | null, generatedAt: string): void;
  mergeDuplicate(sourceTopicId: string, targetTopicId: string, canonicalName: string, generatedAt: string): void;
  writeReport(report: TopicNamingNormalizationReport): void;
}

export class NormalizeTopicNamesUseCase {
  constructor(private readonly deps: NormalizeTopicNamesUseCaseDeps) {}

  execute(): TopicNamingNormalizationReport {
    const generatedAt = this.deps.now();
    const topics = this.deps.readTopics();
    const localized = topics.flatMap((topic) => {
      const chineseName = TOPIC_NAME_LOCALIZATIONS[topic.topic_id];
      if (!chineseName || chineseName === topic.topic_name) return [];
      this.deps.updateName(topic.topic_id, chineseName, topic.market_name_en ?? topic.topic_name, generatedAt);
      return [{ topic_id: topic.topic_id, previous_name: topic.topic_name, chinese_name: chineseName }];
    });
    const names = new Map(topics.map((topic) => [topic.topic_id, TOPIC_NAME_LOCALIZATIONS[topic.topic_id] ?? topic.topic_name]));
    const groups = new Map<string, TopicNamingRecord[]>();
    for (const topic of topics.filter((topic) => topic.status !== 'archived')) {
      const key = normalizeName(names.get(topic.topic_id) ?? topic.topic_name);
      const group = groups.get(key) ?? [];
      group.push(topic);
      groups.set(key, group);
    }
    const merged: TopicNamingNormalizationReport['merged'] = [];
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const ordered = [...group].sort(canonicalOrder);
      const target = ordered[0]!;
      const canonicalName = names.get(target.topic_id) ?? target.topic_name;
      for (const source of ordered.slice(1)) {
        this.deps.mergeDuplicate(source.topic_id, target.topic_id, canonicalName, generatedAt);
        merged.push({ source_topic_id: source.topic_id, target_topic_id: target.topic_id, canonical_name: canonicalName });
      }
    }
    const mergedSources = new Set(merged.map((item) => item.source_topic_id));
    const unresolvedEnglish = topics
      .filter((topic) => topic.status !== 'archived' && !mergedSources.has(topic.topic_id))
      .map((topic) => ({ topic_id: topic.topic_id, topic_name: names.get(topic.topic_id) ?? topic.topic_name }))
      .filter((topic) => !containsChinese(topic.topic_name));
    const report: TopicNamingNormalizationReport = {
      artifact_type: 'topic_naming_normalization_report', schema_version: '1.0.0', generated_at: generatedAt,
      localized_count: localized.length, merged_count: merged.length, unresolved_english_count: unresolvedEnglish.length,
      localized, merged, unresolved_english: unresolvedEnglish,
    };
    this.deps.writeReport(report);
    return report;
  }
}

function normalizeName(value: string): string { return value.toLowerCase().replace(/[\s·_\-—（）()]/g, ''); }
function containsChinese(value: string): boolean { return /\p{Script=Han}/u.test(value); }
function canonicalOrder(left: TopicNamingRecord, right: TopicNamingRecord): number {
  const canonicalId = (topic: TopicNamingRecord) => topic.topic_id.startsWith('provisional_') ? 1 : 0;
  const active = (topic: TopicNamingRecord) => topic.status === 'active' ? 0 : 1;
  return canonicalId(left) - canonicalId(right) || active(left) - active(right)
    || right.evidence_count - left.evidence_count || left.topic_id.localeCompare(right.topic_id);
}
