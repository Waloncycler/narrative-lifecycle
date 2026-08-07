import type {
  WorldMonitorFactChange,
  WorldMonitorFactState,
  WorldMonitorFactStateEntry,
  WorldMonitorMetricDelta,
  WorldMonitorSignal,
} from '../types/worldmonitor_adapter';

export function buildWorldMonitorFactState(input: {
  signals: WorldMonitorSignal[];
  previous: WorldMonitorFactState | null;
  observedOperationIds: Set<string>;
  absenceAssertableOperationIds: Set<string>;
  generatedAt: string;
  syncId: string;
}): { state: WorldMonitorFactState; actionableSignals: WorldMonitorSignal[] } {
  const previousByKey = new Map((input.previous?.facts ?? []).map((fact) => [fact.fact_key, fact]));
  const currentByKey = new Map<string, { signal: WorldMonitorSignal; entry: WorldMonitorFactStateEntry }>();

  for (const signal of input.signals) {
    const factKey = factKeyForSignal(signal);
    if (currentByKey.has(factKey)) continue;
    const previous = previousByKey.get(factKey);
    currentByKey.set(factKey, {
      signal,
      entry: stateEntry(signal, factKey, input.generatedAt, previous),
    });
  }

  const changes: WorldMonitorFactChange[] = [];
  const actionableKeys = new Set<string>();
  const nextFacts = new Map(previousByKey);

  for (const [factKey, current] of currentByKey) {
    const previous = previousByKey.get(factKey);
    const changeType = !previous
      ? 'new'
      : previous.content_fingerprint === current.entry.content_fingerprint
        ? 'unchanged'
        : 'updated';
    const detectedChange = change(current.entry, changeType, previous);
    if (detectedChange.actionable) actionableKeys.add(factKey);
    nextFacts.set(factKey, current.entry);
    changes.push(detectedChange);
  }

  for (const previous of previousByKey.values()) {
    if (
      !input.observedOperationIds.has(previous.operation_id)
      || !input.absenceAssertableOperationIds.has(previous.operation_id)
      || currentByKey.has(previous.fact_key)
    ) continue;
    changes.push(change(previous, 'not_observed', previous));
  }

  changes.sort((left, right) => left.operation_id.localeCompare(right.operation_id) || left.fact_key.localeCompare(right.fact_key));
  const facts = [...nextFacts.values()].sort((left, right) => left.fact_key.localeCompare(right.fact_key));
  const state: WorldMonitorFactState = {
    artifact_type: 'worldmonitor_fact_state',
    schema_version: '1.0.0',
    producer_version: '0.7.9',
    state_id: `worldmonitor_fact_state_${input.generatedAt.replace(/[-:.TZ]/g, '').slice(0, 17)}`,
    sync_id: input.syncId,
    generated_at: input.generatedAt,
    previous_state_id: input.previous?.state_id ?? null,
    observed_operation_ids: [...input.observedOperationIds].sort(),
    fact_count: facts.length,
    new_fact_count: count(changes, 'new'),
    updated_fact_count: count(changes, 'updated'),
    material_update_count: changes.filter((item) => item.change_type === 'updated' && item.actionable).length,
    suppressed_update_count: changes.filter((item) => item.change_type === 'updated' && !item.actionable).length,
    unchanged_fact_count: count(changes, 'unchanged'),
    not_observed_fact_count: count(changes, 'not_observed'),
    facts,
    changes,
    guardrail_check: {
      unchanged_not_queued: true,
      not_observed_not_evidence: true,
      failed_source_not_treated_as_removal: true,
      human_review_required: false,
      no_trading_advice: true,
    },
  };
  return {
    state,
    actionableSignals: input.signals.filter((signal) => actionableKeys.has(factKeyForSignal(signal))),
  };
}

export function factKeyForSignal(signal: WorldMonitorSignal): string {
  const operation = signal.operation_id ?? signal.source_id;
  if (signal.upstream_record_id) return `${operation}:${normalizeKey(signal.upstream_record_id)}`;
  return `${operation}:anon_${fingerprint({
    event_date: signal.event_date,
    title: signal.event_title,
    source_url: signal.source_url ?? '',
  })}`;
}

function stateEntry(
  signal: WorldMonitorSignal,
  factKey: string,
  generatedAt: string,
  previous?: WorldMonitorFactStateEntry,
): WorldMonitorFactStateEntry {
  return {
    fact_key: factKey,
    operation_id: signal.operation_id ?? signal.source_id,
    upstream_record_id: signal.upstream_record_id ?? null,
    title: signal.event_title,
    event_at: signal.timestamp,
    available_at: signal.available_at ?? signal.timestamp,
    source_url: signal.source_url ?? '',
    normalizer_id: signal.normalizer_id ?? 'generic_record',
    normalizer_version: signal.normalizer_version ?? 'unknown',
    content_fingerprint: fingerprint({
      title: signal.event_title,
      summary: signal.event_summary,
      event_date: signal.event_date,
      source_url: signal.source_url ?? '',
      location: signal.location ?? {},
      metrics: signal.metrics ?? {},
    }),
    metrics: signal.metrics ?? {},
    first_seen_at: previous?.first_seen_at ?? generatedAt,
    last_seen_at: generatedAt,
  };
}

function change(
  entry: WorldMonitorFactStateEntry,
  changeType: WorldMonitorFactChange['change_type'],
  previous?: WorldMonitorFactStateEntry,
): WorldMonitorFactChange {
  const metricDeltas = metricDeltasBetween(previous?.metrics ?? {}, entry.metrics);
  const materiality = evaluateMateriality(entry.operation_id, changeType, previous, entry, metricDeltas);
  return {
    fact_key: entry.fact_key,
    operation_id: entry.operation_id,
    change_type: changeType,
    previous_fingerprint: previous?.content_fingerprint ?? null,
    current_fingerprint: changeType === 'not_observed' ? null : entry.content_fingerprint,
    title: entry.title,
    event_at: entry.event_at,
    source_url: entry.source_url,
    actionable: materiality.actionable,
    materiality_policy: materiality.policy,
    materiality_reason: materiality.reason,
    metric_deltas: metricDeltas,
  };
}

function evaluateMateriality(
  operationId: string,
  changeType: WorldMonitorFactChange['change_type'],
  previous: WorldMonitorFactStateEntry | undefined,
  current: WorldMonitorFactStateEntry,
  deltas: WorldMonitorMetricDelta[],
): { actionable: boolean; policy: string; reason: string } {
  if (changeType === 'new') {
    return { actionable: true, policy: 'new_fact_review_v1', reason: 'New source facts always require human review.' };
  }
  if (changeType === 'unchanged') {
    return { actionable: false, policy: 'unchanged_suppression_v1', reason: 'Semantic fingerprint is unchanged.' };
  }
  if (changeType === 'not_observed') {
    return { actionable: false, policy: 'absence_guardrail_v1', reason: 'Not observed is not treated as Evidence.' };
  }

  const thresholds: Record<string, Record<string, { absolute?: number; relative?: number }>> = {
    DirectUSGSEarthquakes: {
      magnitude: { absolute: 0.2 },
      significance: { absolute: 50 },
      tsunami_flag: { absolute: 1 },
    },
    DirectGDACSEvents: {
      alert_level: { absolute: 1 },
      alert_score: { absolute: 0.5 },
      episode_alert_score: { absolute: 0.5 },
      severity: { absolute: 1 },
    },
    DirectUSTreasuryDebt: {
      total_public_debt_usd: { absolute: 10_000_000_000, relative: 0.001 },
    },
    DirectCFTCCotFinancial: {
      noncommercial_net_contracts: { absolute: 10_000, relative: 0.1 },
    },
    DirectWorldBankGDP: {
      gdp_current_usd: { absolute: 1_000_000_000, relative: 0.01 },
    },
    DirectNWSAlerts: {
      severity_level: { absolute: 1 },
      urgency_level: { absolute: 1 },
      certainty_level: { absolute: 1 },
    },
  };
  const sourceThresholds = thresholds[operationId];
  if (sourceThresholds) {
    const material = deltas.find((delta) => {
      const threshold = sourceThresholds[delta.metric];
      if (!threshold || delta.absolute_delta === null) return false;
      return (threshold.absolute !== undefined && Math.abs(delta.absolute_delta) >= threshold.absolute)
        || (threshold.relative !== undefined && delta.relative_delta !== null && Math.abs(delta.relative_delta) >= threshold.relative);
    });
    if (material) {
      return {
        actionable: true,
        policy: `${operationId}_metric_threshold_v1`,
        reason: `${material.metric} crossed the source-specific materiality threshold.`,
      };
    }
    const identityFieldChanged = operationId !== 'DirectNWSAlerts'
      && (previous?.title !== current.title || previous?.event_at !== current.event_at);
    return {
      actionable: identityFieldChanged,
      policy: `${operationId}_metric_threshold_v1`,
      reason: identityFieldChanged
        ? 'A stable identity field changed and requires review.'
        : 'The revision stayed below source-specific metric thresholds.',
    };
  }

  if (operationId === 'DirectWHODiseaseOutbreaks') {
    return {
      actionable: true,
      policy: `${operationId}_any_revision_v1`,
      reason: 'Alert and official notice revisions remain reviewable because textual changes can alter meaning.',
    };
  }

  return {
    actionable: true,
    policy: 'conservative_any_revision_v1',
    reason: 'No calibrated source threshold exists; retain the revision for human review.',
  };
}

function metricDeltasBetween(
  previous: Record<string, number>,
  current: Record<string, number>,
): WorldMonitorMetricDelta[] {
  const metrics = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();
  return metrics
    .filter((metric) => previous[metric] !== current[metric])
    .map((metric) => {
      const before = previous[metric] ?? null;
      const after = current[metric] ?? null;
      const absolute = before === null || after === null ? null : after - before;
      return {
        metric,
        previous: before,
        current: after,
        absolute_delta: absolute,
        relative_delta: absolute === null || before === 0 || before === null ? null : absolute / Math.abs(before),
      };
    });
}

function count(changes: WorldMonitorFactChange[], type: WorldMonitorFactChange['change_type']): number {
  return changes.filter((item) => item.change_type === type).length;
}

function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 160);
}
