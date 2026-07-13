import { randomBytes } from 'node:crypto';
import type { RunContext } from '../types/run_context';
import { PRODUCER_VERSION } from '../types/artifact_contract';
import { RULE_VERSION } from '../domain/versioning_service';

export interface Clock {
  now(): Date;
}

const systemClock: Clock = { now: () => new Date() };

function compactIso(iso: string): string {
  return iso.replace(/[-:]/g, '').replace('.', '').replace('Z', '').replace('T', 'T');
}

export function createRunContext(clock: Clock = systemClock, suffix = randomBytes(3).toString('hex')): RunContext {
  const started_at = clock.now().toISOString();
  return {
    run_id: `run_${compactIso(started_at)}_${suffix}`,
    started_at,
    rule_version: RULE_VERSION,
    artifact_version: PRODUCER_VERSION,
  };
}

export function resolveRunContext(env = process.env): RunContext {
  if (env.NARRATIVE_RUN_ID && env.NARRATIVE_RUN_STARTED_AT) {
    return {
      run_id: env.NARRATIVE_RUN_ID,
      started_at: env.NARRATIVE_RUN_STARTED_AT,
      rule_version: env.NARRATIVE_RULE_VERSION ?? RULE_VERSION,
      artifact_version: env.NARRATIVE_ARTIFACT_VERSION ?? PRODUCER_VERSION,
    };
  }
  return createRunContext();
}

export function runContextEnvironment(context: RunContext): Record<string, string> {
  return {
    NARRATIVE_RUN_ID: context.run_id,
    NARRATIVE_RUN_STARTED_AT: context.started_at,
    NARRATIVE_RULE_VERSION: context.rule_version,
    NARRATIVE_ARTIFACT_VERSION: context.artifact_version,
  };
}
