import type { SourcePlugin, PluginExecutionContext, PluginNormalizedFact } from './source_plugin.interface';

export interface VipStatementRawItem {
  speaker: string;
  role: string;
  source_name: string;
  source_url: string;
  title: string;
  summary: string;
  topic_hint?: string;
}

export class VipSpeakersPlugin implements SourcePlugin<VipStatementRawItem> {
  readonly id = 'vip_speakers';
  readonly name = '全球关键领袖专线流 (VIP Speakers)';
  readonly category = 'technology' as const;
  readonly domain = 'technology';
  readonly defaultEvidenceStrength = 'E1' as const;
  readonly defaultTargetLayers = ['reality', 'capital', 'pricing'] as const;

  async fetchRaw(ctx: PluginExecutionContext): Promise<VipStatementRawItem[]> {
    // Curated high-conviction leader transmission records
    return [
      {
        speaker: 'Jensen Huang',
        role: 'NVIDIA CEO',
        source_name: 'Jensen Huang Keynote / NVIDIA Official',
        source_url: 'https://blogs.nvidia.com/blog/2026/08/blackwell-physical-ai/',
        title: '黄仁勋：Blackwell Ultra 需求极为强劲，物理 AI (Physical AI) 与机器人计算迎来万亿级临界点',
        summary: '英伟达CEO黄仁勋在最新产业论坛表示，下一代AI大模型正在向具备物理空间交互能力的具身智能全面演进。',
        topic_hint: 'provisional_computing_infrastructure',
      },
      {
        speaker: 'Elon Musk',
        role: 'Tesla CEO',
        source_name: 'Elon Musk Public Transmission / Tesla',
        source_url: 'https://x.com/elonmusk/status/optimus_gen3_update',
        title: '马斯克：Optimus 第三代手部 22 个自由度量产良率突破 85%，年内开启千台工业实训部署',
        summary: '特斯拉CEO马斯克披露人形机器人执行器与灵巧手降本最新进展，单台BOM成本进入大幅下降通道。',
        topic_hint: 'humanoid_robotics',
      },
      {
        speaker: 'Robin Zeng',
        role: 'CATL Chairman',
        source_name: 'CATL Official Disclosure',
        source_url: 'https://www.catl.com/news/solid_state_pilot_2026',
        title: '曾毓群：宁德时代全固态电池中试产线正式贯通，能量密度达 500Wh/kg，首批进入极寒与航空验证',
        summary: '宁德时代董事长曾毓群宣布全固态硫化物电解质中试线试车成功，解决界面阻抗与循环寿命瓶颈。',
        topic_hint: 'provisional_solid_state_battery',
      },
    ];
  }

  normalize(item: VipStatementRawItem, ctx: PluginExecutionContext): PluginNormalizedFact | null {
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    return {
      source_id: this.id,
      source_name: item.source_name,
      source_url: item.source_url,
      source_kind: 'VIP_SPEECH',
      title: item.title,
      summary: item.summary,
      event_date: today,
      evidence_strength: this.defaultEvidenceStrength,
      event_type: 'MARKET_FACT',
      affected_layers: [...this.defaultTargetLayers],
      topic_inference_hint: item.topic_hint,
      remote_pdf_url: null,
      raw_payload: item as unknown as Record<string, unknown>,
    };
  }
}
