import type { WorldMonitorSignal } from '@/features/worldmonitor/types/worldmonitor_adapter';

const MATERIAL_EVENT = /批准|获批|发布|签署|中标|合同|订单|投产|量产|临床|试验|监管|政策|并购|收购|融资|授权|许可|制裁|调查|approval|approved|launch|contract|order|production|clinical|trial|regulat|policy|acquisition|financ|licens|sanction|investigation/i;
const HIGH_IMPACT = /国务院|央行|证监会|交易所|国家药监局|最高人民法院|美联储|FDA|SEC|European Commission|White House|Federal Reserve/i;

/**
 * Ranks secondary-source leads for research effort. This score is never an
 * Evidence strength, Stage score, or confidence score.
 */
export function newsImportance(signal: WorldMonitorSignal, nowIso: string): {
  score: number;
  probeRecommended: boolean;
  reasons: string[];
} {
  const text = `${signal.event_title} ${signal.event_summary}`;
  const reads = signal.metrics?.read_count ?? 0;
  const comments = signal.metrics?.comment_count ?? 0;
  const popularRank = signal.metrics?.popular_rank ?? 0;
  const editorialPriority = signal.metrics?.editorial_priority ?? 0;
  const ageHours = Math.max(0, (Date.parse(nowIso) - Date.parse(signal.timestamp)) / 3_600_000);
  const reasons: string[] = [];
  let score = 0;

  if (reads > 0) {
    score += Math.min(30, Math.round(6 * Math.log10(reads + 1)));
    reasons.push(`readership:${Math.round(reads)}`);
  }
  if (comments > 0) {
    score += Math.min(8, Math.round(2 * Math.log10(comments + 1)));
    reasons.push(`comments:${Math.round(comments)}`);
  }
  if (popularRank > 0) {
    score += Math.max(3, 14 - popularRank);
    reasons.push(`popular_rank:${popularRank}`);
  }
  if (editorialPriority > 0) {
    score += Math.min(15, editorialPriority);
    reasons.push('editorial_priority');
  }
  if (MATERIAL_EVENT.test(text)) {
    score += 25;
    reasons.push('material_event_language');
  }
  if (HIGH_IMPACT.test(text)) {
    score += 15;
    reasons.push('high_impact_institution');
  }
  const numberCount = (text.match(/\d+(?:\.\d+)?%?|\d+(?:\.\d+)?(?:亿|万|兆|亿美元|亿元)/g) ?? []).length;
  if (numberCount >= 2) {
    score += Math.min(10, numberCount * 2);
    reasons.push(`quantified_facts:${numberCount}`);
  }
  if (ageHours <= 6) {
    score += 15;
    reasons.push('fresh_within_6h');
  } else if (ageHours <= 24) {
    score += 10;
    reasons.push('fresh_within_24h');
  } else if (ageHours <= 72) {
    score += 5;
    reasons.push('fresh_within_72h');
  }

  const bounded = Math.min(100, Math.max(0, score));
  return { score: bounded, probeRecommended: bounded >= 55, reasons };
}

export function rankNewsSignals(signals: WorldMonitorSignal[], nowIso: string): WorldMonitorSignal[] {
  return signals
    .map((signal) => {
      if (signal.event_type !== 'NEWS_ARTICLE_PUBLISHED') return signal;
      const importance = newsImportance(signal, nowIso);
      return {
        ...signal,
        metrics: {
          ...(signal.metrics ?? {}),
          news_importance_score: importance.score,
          deep_probe_recommended: importance.probeRecommended ? 1 : 0,
        },
      };
    })
    .sort((left, right) =>
      (right.metrics?.news_importance_score ?? 0) - (left.metrics?.news_importance_score ?? 0)
      || Date.parse(right.timestamp) - Date.parse(left.timestamp),
    );
}
