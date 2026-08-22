import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';
import { fetchChinaDrugTrials, type ClinicalTrialFact } from '../io/chinadrugtrials_provider';

export class ChinaDrugTrialsPlugin implements SourcePlugin<ClinicalTrialFact> {
  readonly id = 'chinadrugtrials_ctr';
  readonly name = '中国药物临床试验登记与信息公示平台 (Chinadrugtrials CTR / CDE)';
  readonly category = 'official' as const;
  readonly domain = 'official';
  readonly defaultEvidenceStrength = 'E3' as const;
  readonly defaultTargetLayers = ['reality', 'friction'] as const;

  async fetchRaw(_ctx: PluginExecutionContext): Promise<ClinicalTrialFact[]> {
    return await fetchChinaDrugTrials();
  }

  normalize(item: ClinicalTrialFact, _ctx: PluginExecutionContext): PluginNormalizedFact | null {
    if (!item.drug_name || !item.ctr_id) return null;
    return {
      source_id: this.id,
      source_name: `中国药物临床试验平台 (${item.ctr_id})`,
      source_url: item.source_url,
      source_kind: 'CLINICAL_TRIAL',
      title: `【临床进展 ${item.trial_phase}】${item.drug_name} (${item.sponsor})`,
      summary: `适应症：${item.indication}，状态：${item.status}，主要终点：${item.primary_endpoints}。${item.summary}`,
      event_date: item.event_date,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'CLINICAL_TRIAL_UPDATE',
      affected_layers: [...this.defaultTargetLayers],
      remote_pdf_url: null,
      raw_payload: item as unknown as Record<string, unknown>,
    };
  }
}
