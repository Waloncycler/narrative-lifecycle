import { describe, it, expect, beforeEach } from 'vitest';
import { SourcePluginRegistry } from '@/features/worldmonitor/plugins/plugin_registry';
import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from '@/features/worldmonitor/plugins/source_plugin.interface';

class MockTestPlugin implements SourcePlugin<{ id: string; name: string }> {
  readonly id = 'mock_test_plugin';
  readonly name = 'Mock Test Source';
  readonly category = 'research' as const;
  readonly domain = 'research';
  readonly defaultEvidenceStrength = 'E2' as const;
  readonly defaultTargetLayers = ['reality'] as const;

  async fetchRaw(_ctx: PluginExecutionContext): Promise<{ id: string; name: string }[]> {
    return [{ id: 'item_1', name: 'Quantum Core Milestone' }];
  }

  normalize(item: { id: string; name: string }, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    return {
      source_id: this.id,
      source_name: this.name,
      source_url: 'https://example.com/item/1',
      source_kind: 'ACADEMIC_PAPER',
      title: item.name,
      summary: 'Quantum breakthrough test summary',
      event_date: ctx.today ?? '2026-08-22',
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'RESEARCH_REPORT',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: 'https://example.com/paper.pdf',
    };
  }
}

class FaultyThrowingPlugin implements SourcePlugin<any> {
  readonly id = 'faulty_plugin';
  readonly name = 'Faulty Error Source';
  readonly category = 'geopolitics' as const;
  readonly domain = 'geopolitics';
  readonly defaultEvidenceStrength = 'E1' as const;
  readonly defaultTargetLayers = ['capital'] as const;

  async fetchRaw(): Promise<any[]> {
    throw new Error('Upstream timeout connection failed');
  }

  normalize(): PluginNormalizedFact | null {
    return null;
  }
}

describe('SourcePluginRegistry Architecture & Execution', () => {
  beforeEach(() => {
    SourcePluginRegistry.resetInstance();
  });

  it('initializes with all 7 default institutional plugins', () => {
    const registry = SourcePluginRegistry.getInstance();
    const plugins = registry.getAllPlugins();
    expect(plugins.length).toBe(7);

    const ids = plugins.map((p) => p.id);
    expect(ids).toContain('official_gov_cn');
    expect(ids).toContain('brokerage_eastmoney');
    expect(ids).toContain('cninfo_disclosure');
    expect(ids).toContain('vip_speakers');
    expect(ids).toContain('ccgp_central_tenders');
    expect(ids).toContain('chinadrugtrials_ctr');
    expect(ids).toContain('commodity_pricing_telemetry');
  });

  it('supports dynamic registration and unregistration of plugins', () => {
    const registry = SourcePluginRegistry.getInstance();
    const mock = new MockTestPlugin();
    registry.registerPlugin(mock);

    expect(registry.getPlugin('mock_test_plugin')).toBeDefined();
    expect(registry.getAllPlugins().length).toBe(8);

    const unregistered = registry.unregisterPlugin('mock_test_plugin');
    expect(unregistered).toBe(true);
    expect(registry.getPlugin('mock_test_plugin')).toBeUndefined();
    expect(registry.getAllPlugins().length).toBe(7);
  });

  it('filters plugins by category', () => {
    const registry = SourcePluginRegistry.getInstance();
    const officialPlugins = registry.getPluginsByCategory('official');
    expect(officialPlugins.length).toBeGreaterThanOrEqual(4);
    officialPlugins.forEach((p) => {
      expect(p.category).toBe('official');
    });
  });

  it('executes all plugins in parallel with bounded fault tolerance', async () => {
    const registry = SourcePluginRegistry.getInstance();
    registry.registerPlugin(new MockTestPlugin());
    registry.registerPlugin(new FaultyThrowingPlugin());

    const result = await registry.executeAllPlugins({
      today: '2026-08-22',
      timeoutMs: 3000,
      maxItems: 5,
    });

    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.total_raw).toBeGreaterThan(0);
    expect(result.total_duration_ms).toBeGreaterThan(0);

    // The faulty plugin should not crash the batch execution
    const faultySummary = result.summaries.find((s) => s.plugin_id === 'faulty_plugin');
    expect(faultySummary).toBeDefined();
    expect(faultySummary?.status).toBe('failed');
    expect(faultySummary?.error_message).toContain('Upstream timeout');

    // The mock plugin should succeed
    const mockSummary = result.summaries.find((s) => s.plugin_id === 'mock_test_plugin');
    expect(mockSummary).toBeDefined();
    expect(mockSummary?.status).toBe('success');
    expect(mockSummary?.normalized_count).toBe(1);

    const mockFact = result.facts.find((f) => f.source_id === 'mock_test_plugin');
    expect(mockFact).toBeDefined();
    expect(mockFact?.title).toBe('Quantum Core Milestone');
    expect(mockFact?.remote_pdf_url).toBe('https://example.com/paper.pdf');
  }, 15000);
});
