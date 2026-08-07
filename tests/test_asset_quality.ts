import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('asset quality', () => {
  it('dashboard examples include required card fields and research-only actions', () => {
    const cardFiles = [
      'examples/bci_dashboard_card.md',
      'examples/humanoid_robotics_dashboard_card.md',
      'examples/innovative_drug_dashboard_card.md',
    ];

    for (const file of cardFiles) {
      const body = read(file);
      expect(body).toContain('current_stage:');
      expect(body).toContain('transition_target:');
      expect(body).toContain('parent_narrative:');
      expect(body).toContain('why_not_higher_stage:');
      expect(body).toContain('key_branches:');
      expect(body).toContain('key_events:');
      expect(body).toContain('action:');
      expect(body).toContain('review_window:');
      expect(body).toContain('as_of_date: 2026-07-05');
      expect(body).toMatch(/stage_confidence: \d+/);
      expect(body).toMatch(/data_confidence: \d+/);
      expect(body).toContain('## Why Not Higher Stage');
      expect(body).toContain('## Scores');
      expect(body).toContain('## Suggested Research Action');
      expect(body.toLowerCase()).not.toContain('buy');
      expect(body).not.toContain('卖出');
      expect(body).not.toContain('买入');
    }
  });

  it('weekly brief is evidence-first and does not remain a TBD stub', () => {
    const body = read('examples/weekly_narrative_brief.md');

    expect(body).toContain('## Evidence Table Status');
    expect(body).toContain('## Next Research Actions');
    expect(body).not.toContain('TBD');
  });

  it('failure cases are structured and non-empty', () => {
    const failureFiles = readdirSync(resolve(repoRoot, 'data/failure_cases')).filter((file) => file.endsWith('.yaml'));

    expect(failureFiles.length).toBeGreaterThanOrEqual(5);
    for (const file of failureFiles) {
      const body = read(`data/failure_cases/${file}`);

      expect(body).toContain('time_period:');
      expect(body).toContain('peak_stage:');
      expect(body).toContain('failed_transition:');
      expect(body).toContain('failure_type:');
      expect(body).toContain('false_positive_signals:');
      expect(body).toContain('missed_warning_signals:');
      expect(body).toContain('corrective_rules:');
      expect(body).toContain('lessons_for_model:');
      expect(body).not.toContain(': TBD');
      expect(body).not.toContain(': []');
    }
  });

  it('sample evidence avoids unresolved date placeholders', () => {
    const sampleFiles = readdirSync(resolve(repoRoot, 'data/sample_evidence')).filter((file) => file.endsWith('.yaml'));

    for (const file of sampleFiles) {
      const body = read(`data/sample_evidence/${file}`);

      expect(body).toContain('source_url:');
      expect(body).toContain('source_type:');
      expect(body).toContain('event_summary:');
      expect(body).toContain('branch_coverage_score:');
      expect(body).toContain('positive_or_negative:');
      expect(body).toContain('confidence:');
      expect(body).toMatch(/source_type: (fixture_|manual_)/);
      expect(body).toContain('https://example.invalid/');
      expect(body).not.toContain('event_date: TBD');
      expect(body).not.toContain('example://');
    }
  });

  it('all prompts keep LLM work evidence-first and avoid direct numeric scoring', () => {
    const promptFiles = readdirSync(resolve(repoRoot, 'prompts')).filter((file) => file.endsWith('.md'));
    const scoringPrompt = read('prompts/scoring_prompt.md');
    const reactivationPrompt = read('prompts/reactivation_prompt.md');
    const stagePrompt = read('prompts/stage_classifier_prompt.md');

    expect(scoringPrompt).toContain('Do not output numeric scores');
    expect(scoringPrompt).toContain('Stage Gate classification');
    expect(scoringPrompt).not.toContain('Generate scores from structured evidence only');
    expect(reactivationPrompt).toContain('Do not calculate Narrative Delta Score directly');
    expect(read('prompts/dashboard_writer_prompt.md')).toContain('- action');
    expect(read('prompts/dashboard_writer_prompt.md')).not.toContain('research_action');
    expect(read('prompts/early_radar_prompt.md')).toContain('stage_reactivation');
    expect(read('prompts/early_radar_prompt.md')).not.toContain('old_topic_reactivation');
    expect(stagePrompt).toContain('Evidence Table First');

    for (const file of promptFiles) {
      const body = read(`prompts/${file}`).toLowerCase();
      expect(body).not.toContain('buy/sell signal');
      expect(body).not.toContain('target price recommendation');
      if (file !== 'scoring_prompt.md') {
        expect(body).not.toContain('generate scores');
      }
    }
  });

  it('keeps UI and automated ingestion out of Phase 0 scope', () => {
    const forbiddenDirs = ['app', 'pages', 'components', 'ui', 'crawler', 'crawlers', 'ingestion'];
    for (const dir of forbiddenDirs) {
      expect(existsSync(resolve(repoRoot, dir)), `${dir} should stay out of Phase 0`).toBe(false);
    }

    const packageJson = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    for (const dependency of ['react', 'next', 'vite', 'axios', 'playwright', 'puppeteer', 'cheerio']) {
      expect(installed).not.toHaveProperty(dependency);
    }
  });
});
