import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { buildWeeklyBrief } from '../src/services/report_builder';
import { loadCanonicalStageDiff, loadReportArtifacts } from '../src/services/report_artifact_loader';
import { renderWeeklyBriefMarkdown } from '../src/services/report_markdown_renderer';
import type { StageDiff } from '../src/types/diff';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

describe('report builder', () => {
  it('aggregates pipeline artifacts without reclassifying or scoring', () => {
    const artifacts = loadReportArtifacts(repoRoot);
    const report = buildWeeklyBrief(artifacts, loadCanonicalStageDiff(repoRoot), { run_id: 'run_20260705T000000000_abcdef', started_at: '2026-07-05T00:00:00.000Z', rule_version: 'narrative-lifecycle-rules-v0.1', artifact_version: 'v0.3.1' });
    const markdown = renderWeeklyBriefMarkdown(report);

    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validateReport = ajv.compile(JSON.parse(readFileSync(resolve(repoRoot, 'schemas/weekly_brief.schema.json'), 'utf8')));

    expect(validateReport(report), JSON.stringify(validateReport.errors)).toBe(true);
    expect(report.executive_summary.dashboard_card_count).toBe(3);
    expect(report.executive_summary.score_count).toBe(3);
    expect(report.executive_summary.golden_case_passed).toBe(3);
    expect(report.executive_summary.early_radar_candidate_count).toBe(1);
    expect(report.stage_changes).toHaveLength(3);
    expect(report.why_not_higher).toHaveLength(3);
    expect(report.why_not_higher.every((item) => item.why_not_higher_stage.length > 0)).toBe(true);
    expect(report.why_not_higher.every((item) => item.evidence_ids.length > 0)).toBe(true);
    expect(report.early_radar_candidates[0].reactivation_record_id).toEqual(expect.any(String));
    expect(Object.values(report.guardrail_check).every(Boolean)).toBe(true);
    expect(report.next_operator_actions.map((item) => item.action)).toEqual([
      'request_more_evidence',
      'monitor',
      'monitor',
      'track',
    ]);
    expect(markdown).toContain('# Weekly Narrative Lifecycle Brief');
    expect(markdown).toContain('## 5. Why Not Higher');
    expect(markdown).toContain('reactivation_record_id:');
    expect(JSON.stringify(report)).not.toMatch(/\b(buy|sell|long|short|entry|exit|position|target price|stop loss)\b/i);
  });

  it('renders canonical diff changes without comparing stages itself', () => {
    const artifacts = loadReportArtifacts(repoRoot);
    const diff = loadCanonicalStageDiff(repoRoot);
    const canonical: StageDiff = {
      ...diff,
      summary: { ...diff.summary, stage_upgrade_count: 1, guardrail_regression_count: 1 },
      topic_changes: [{
        ...diff.topic_changes[0], change_type: 'stage_upgrade' as const,
        detected_changes: ['stage_upgrade', 'why_not_higher_changed'],
        previous_stage: 'S4', current_stage: 'S5',
        priority: 'medium' as const, research_only_action: 'review' as const,
      }],
      guardrail_changes: [{ guardrail: 'no_trading_advice' as const, change_type: 'guardrail_regression' as const, previous_value: true as const, current_value: false as const, priority: 'high' as const, research_only_action: 'flag_risk' as const }],
    };
    const report = buildWeeklyBrief(artifacts, canonical, { run_id: 'run_20260711T193045123_abc123', started_at: '2026-07-11T19:30:45.123Z', rule_version: 'rules', artifact_version: 'v0.3.1' });
    const markdown = renderWeeklyBriefMarkdown(report);
    expect(report.stage_changes[0]).toMatchObject({ change_type: 'stage_upgrade', previous_stage: 'S4', current_stage: 'S5' });
    expect(report.stage_change_summary.guardrail_regression_count).toBe(1);
    expect(markdown).toContain('### Upgrades');
    expect(markdown).toContain('### Why Not Higher Changes');
    expect(markdown).toContain('### Guardrail Regressions');
  });
});
