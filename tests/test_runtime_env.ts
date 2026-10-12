import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { intakeAgentConfigFromEnv } from '@/features/intake/io/intake_agent_provider';
import { loadRuntimeEnv } from '@/platform/io/runtime_env';

describe('runtime environment loading', () => {
  it('loads local provider settings without overriding explicit environment values', () => {
    const root = mkdtempSync(join(tmpdir(), 'narrative-env-'));
    writeFileSync(join(root, '.env'), 'DEEPSEEK_API_KEY=local-secret\nDEEPSEEK_MODEL=deepseek-reasoner\nUNRELATED_KEY=ignore\n');
    const env: NodeJS.ProcessEnv = { NARRATIVE_RUN_MODE: 'test' };
    loadRuntimeEnv(root, env);
    expect(intakeAgentConfigFromEnv(env)).toMatchObject({ provider: 'deepseek', endpoint: 'https://api.deepseek.com/v1/chat/completions', apiKey: 'local-secret', model: 'deepseek-reasoner' });
    env.DEEPSEEK_API_KEY = 'explicit-secret';
    loadRuntimeEnv(root, env);
    expect(env.DEEPSEEK_API_KEY).toBe('explicit-secret');
    expect(env.UNRELATED_KEY).toBeUndefined();
  });
});
