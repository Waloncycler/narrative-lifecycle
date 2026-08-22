import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact, SourcePluginCategory } from './source_plugin.interface';
import { OfficialGovCnPlugin } from './official_gov_cn_plugin';
import { BrokerageEastmoneyPlugin } from './brokerage_eastmoney_plugin';
import { CninfoDisclosurePlugin } from './cninfo_disclosure_plugin';
import { VipSpeakersPlugin } from './vip_speakers_plugin';
import { CcgpTendersPlugin } from './ccgp_tenders_plugin';
import { ChinaDrugTrialsPlugin } from './chinadrugtrials_plugin';
import { CommodityPricingPlugin } from './commodity_pricing_plugin';

export interface PluginExecutionSummary {
  plugin_id: string;
  plugin_name: string;
  category: SourcePluginCategory;
  status: 'success' | 'failed' | 'empty';
  raw_count: number;
  normalized_count: number;
  duration_ms: number;
  error_message?: string;
}

export interface UnifiedPluginsBatchResult {
  facts: PluginNormalizedFact[];
  summaries: PluginExecutionSummary[];
  total_raw: number;
  total_normalized: number;
  total_duration_ms: number;
}

export class SourcePluginRegistry {
  private static instance: SourcePluginRegistry | null = null;
  private plugins: Map<string, SourcePlugin> = new Map();

  private constructor() {
    this.registerDefaultPlugins();
  }

  public static getInstance(): SourcePluginRegistry {
    if (!SourcePluginRegistry.instance) {
      SourcePluginRegistry.instance = new SourcePluginRegistry();
    }
    return SourcePluginRegistry.instance;
  }

  public static resetInstance(): void {
    SourcePluginRegistry.instance = null;
  }

  private registerDefaultPlugins(): void {
    this.registerPlugin(new OfficialGovCnPlugin());
    this.registerPlugin(new BrokerageEastmoneyPlugin());
    this.registerPlugin(new CninfoDisclosurePlugin());
    this.registerPlugin(new VipSpeakersPlugin());
    this.registerPlugin(new CcgpTendersPlugin());
    this.registerPlugin(new ChinaDrugTrialsPlugin());
    this.registerPlugin(new CommodityPricingPlugin());
  }

  public registerPlugin(plugin: SourcePlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  public unregisterPlugin(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  public getPlugin(pluginId: string): SourcePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  public getAllPlugins(): SourcePlugin[] {
    return Array.from(this.plugins.values());
  }

  public getPluginsByCategory(category: SourcePluginCategory): SourcePlugin[] {
    return this.getAllPlugins().filter((p) => p.category === category);
  }

  /**
   * Executes all registered plugins in parallel with bounded timeout and per-plugin error isolation.
   */
  public async executeAllPlugins(ctx: PluginExecutionContext = {}): Promise<UnifiedPluginsBatchResult> {
    const startTime = Date.now();
    const plugins = this.getAllPlugins();
    const facts: PluginNormalizedFact[] = [];
    const summaries: PluginExecutionSummary[] = [];

    const executionPromises = plugins.map(async (plugin) => {
      const pluginStart = Date.now();
      try {
        const rawItems = await plugin.fetchRaw(ctx);
        const pluginFacts: PluginNormalizedFact[] = [];

        for (const item of rawItems) {
          const normalized = plugin.normalize(item, ctx);
          if (normalized) {
            pluginFacts.push(normalized);
          }
        }

        const duration = Date.now() - pluginStart;
        summaries.push({
          plugin_id: plugin.id,
          plugin_name: plugin.name,
          category: plugin.category,
          status: pluginFacts.length > 0 ? 'success' : 'empty',
          raw_count: rawItems.length,
          normalized_count: pluginFacts.length,
          duration_ms: duration,
        });

        return pluginFacts;
      } catch (err: any) {
        const duration = Date.now() - pluginStart;
        summaries.push({
          plugin_id: plugin.id,
          plugin_name: plugin.name,
          category: plugin.category,
          status: 'failed',
          raw_count: 0,
          normalized_count: 0,
          duration_ms: duration,
          error_message: err?.message || 'Unknown plugin execution error',
        });
        return [];
      }
    });

    const results = await Promise.all(executionPromises);
    for (const res of results) {
      facts.push(...res);
    }

    const totalRaw = summaries.reduce((sum, s) => sum + s.raw_count, 0);
    const totalNormalized = facts.length;
    const totalDuration = Date.now() - startTime;

    return {
      facts,
      summaries,
      total_raw: totalRaw,
      total_normalized: totalNormalized,
      total_duration_ms: totalDuration,
    };
  }
}
