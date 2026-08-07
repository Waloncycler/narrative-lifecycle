import { createHash } from 'node:crypto';
import type { EvidenceNode } from './evidence';
import type { ResearchLeadTriageItem } from '../types/research_lead_triage';
import { executeDeepMiningProbe } from './deep_mining_probes';

export interface StructuredAgentAnalysisResult {
  lead_id: string;
  topic_id: string;
  branch_id: string | null;
  scope: 'parent' | 'branch';
  evidence_id: string;
  event_title: string;
  event_summary: string;
  source_name: string;
  source_url: string;
  source_type: EvidenceNode['source_name'];
  evidence_strength: EvidenceNode['evidence_strength'];
  affected_layer: EvidenceNode['affected_layer'];
  polarity: 'positive' | 'negative' | 'mixed';
  stage_effect: EvidenceNode['stage_effect'];
  confidence: number;
  original_quote: string;
  quote_start_offset: number;
  quote_end_offset: number;
  interpretation: string;
  limitation: string;
  relevance: 'high' | 'medium' | 'low' | 'irrelevant';
}

/**
 * Deep Mining Probe & AI Agent Analyzer.
 *
 * Performs local AI analysis on deep probe fetched documents following the
 * intake-llm-analysis and deep-evidence-mining Agent Skill specifications.
 */
export function analyzeLeadWithDeepProbe(lead: ResearchLeadTriageItem, rawBody: string, contentType: string | null, fetchedAt: string): {
  probeResult: ReturnType<typeof executeDeepMiningProbe>;
  structuredEvidence: EvidenceNode | null;
  analysis: StructuredAgentAnalysisResult | null;
} {
  const probeResult = executeDeepMiningProbe({ lead, rawBody, contentType, fetchedAt });

  if (!probeResult.probe_metadata.deep_mining_passed || !probeResult.retrievalItem.excerpts.length) {
    return { probeResult, structuredEvidence: null, analysis: null };
  }

  const primaryExcerpt = probeResult.retrievalItem.excerpts[0];
  const quote = primaryExcerpt.quote;
  const startOffset = primaryExcerpt.quote_start_offset;
  const endOffset = primaryExcerpt.quote_end_offset;

  const combinedText = lead.title + ' ' + quote;
  const topicId = lead.topic_id ?? inferTopicFromText(combinedText);
  const branchId = lead.branch_id ?? inferBranchFromText(topicId, combinedText);
  const scope = inferScope(topicId, branchId, combinedText);

  const sourceClass = lead.source_class;
  const strength = inferEvidenceStrength(sourceClass, combinedText, lead.published_at ?? fetchedAt);
  const primaryLayers = inferAffectedLayers(combinedText, sourceClass);
  const stageEffect: EvidenceNode['stage_effect'] = scope === 'branch' ? 'split_branch' : 'fills_gap';

  const evidenceId = `ev_probe_${hash(`${lead.url}|${topicId}|${branchId ?? 'parent'}`)}`;

  const analysis: StructuredAgentAnalysisResult = {
    lead_id: lead.triage_id,
    topic_id: topicId,
    branch_id: scope === 'branch' ? branchId : null,
    scope,
    evidence_id: evidenceId,
    event_title: lead.title.slice(0, 120),
    event_summary: quote.slice(0, 300),
    source_name: lead.source_name,
    source_url: lead.url,
    source_type: lead.source_class === 'official' ? 'official' : lead.source_class === 'academic' ? 'academic' : 'company',
    evidence_strength: strength,
    affected_layer: primaryLayers,
    polarity: 'positive',
    stage_effect: stageEffect,
    confidence: 88,
    original_quote: quote,
    quote_start_offset: startOffset,
    quote_end_offset: endOffset,
    interpretation: `Deep Mining Probe verified fact: ${lead.title}`,
    limitation: 'Requires continuous tracking of subsequent formal adoption milestones.',
    relevance: 'high',
  };

  const structuredEvidence: EvidenceNode = {
    evidence_id: evidenceId,
    topic_id: topicId,
    branch_id: scope === 'branch' ? branchId : null,
    parent_or_branch: scope,
    event_date: lead.published_at?.slice(0, 10) ?? fetchedAt.slice(0, 10),
    available_at: fetchedAt,
    event_title: analysis.event_title,
    event_type: 'disclosure',
    source_name: analysis.source_type,
    source_url: lead.url,
    evidence_strength: strength,
    affected_layer: primaryLayers,
    stage_effect: stageEffect,
    confidence: 88,
    schema_version: '0.9-autonomous-research',
  };

  return { probeResult, structuredEvidence, analysis };
}

// ---------------------------------------------------------------------------
// Topic Inference — covers all 20+ registered topics
// ---------------------------------------------------------------------------

const TOPIC_PATTERNS: Array<{ pattern: RegExp; topicId: string }> = [
  // Memory Chips / 存储芯片
  { pattern: /(?:memory\s*chip|hbm|dram|nand|semiconductor\s*memory|存储芯片|内存芯片|长鑫|美光|海力士|兆易创新|闪存|存储器)/i, topicId: 'provisional_semiconductor_memory_market' },
  // BCI / 脑机接口
  { pattern: /(?:bci|brain[\s-]*computer|neuro(?:link|modulation|science)|synchron|脑机|脑机接口|侵入式|神经调控|eeg|brain[\s-]*machine)/i, topicId: 'bci' },
  // Autonomous Driving & Robotaxi / 自动驾驶与 Robotaxi
  // Must precede humanoid robotics: "robotaxi" and 机器人出租车 would otherwise
  // be captured by the broader robotics pattern below.
  { pattern: /(?:robotaxi|robo[\s-]*taxi|autonomous\s*(?:driv|vehicle)|self[\s-]*driving|waymo|cruise|zoox|fsd|apollo\s*go|自动驾驶|无人驾驶|萝卜快跑|智能驾驶|辅助驾驶|小马智行|文远知行|领航辅助|l[234]\s*级自动驾驶)/i, topicId: 'provisional_autonomous_driving_robotaxi' },
  // Humanoid Robotics / 人形机器人
  { pattern: /(?:humanoid|optimus|figure[\s-]*0[12]|atlas|robot(?:ics)?\b|actuator|embodied\s*(?:ai|intelligence)|人形机器人|具身智能|灵巧手|减速器|机器人|执行器|伺服|harmonic|谐波)/i, topicId: 'humanoid_robotics' },
  // Innovative Drug License-out / 创新药对外授权
  { pattern: /(?:license[\s-]*out|out[\s-]*licens|pharma\s*deal|license\s*agreement|milestone\s*payment|创新药.*授权|对外授权|首付款|里程碑付款|adc|抗体偶联|pd[\s-]*[l1]|car[\s-]*t|bispecific)/i, topicId: 'innovative_drug_license_out' },
  // AI Agents / AI 智能体
  { pattern: /(?:ai[\s-]*agent|autonomous\s*agent|multi[\s-]*agent|agent\s*framework|mcp|function\s*calling|tool\s*use|智能体|ai\s*agent|自主决策|agentic)/i, topicId: 'provisional_ai_agents' },
  // AI Foundation Models / 基础大模型
  { pattern: /(?:foundation\s*model|llm|large\s*language|gpt[\s-]*[45o]|claude|gemini|deepseek|qwen|通义千问|文心一言|大模型|基座模型|预训练|sora|video\s*generation|视频生成|seedance|豆包)/i, topicId: 'provisional_ai_foundation_models' },
  // Low Altitude Economy / 低空经济
  { pattern: /(?:low[\s-]*altitude|evtol|uam|urban\s*air|flying\s*car|drone|airworthiness|低空经济|低空|eVTOL|城市空中交通|无人机|适航|飞行汽车|亿航|小鹏汇天|峰飞)/i, topicId: 'provisional_low_altitude_economy' },
  // Solid-State Battery / 固态电池
  // Must precede the new-energy industry pattern: cell makers such as 宁德时代
  // appear in both, and the more specific chemistry should win.
  { pattern: /(?:solid[\s-]*state\s*batter|semi[\s-]*solid[\s-]*state|sulfide\s*electrolyte|(?:solid|sulfide|oxide|polymer)\s*electrolyte|固态电池|全固态|半固态|固态电解质|硫化物电解质|锂金属负极|清陶|卫蓝新能源)/i, topicId: 'provisional_solid_state_battery' },
  // New Energy Industry / 新能源产业
  { pattern: /(?:new\s*energy|solar|photovoltaic|wind\s*(?:power|turbine|energy)|energy\s*storage|battery\s*(?:storage|pack)|新能源|光伏|风电|储能|锂电|钠电|氢能|宁德时代|比亚迪|catl|隆基|晶澳)/i, topicId: 'provisional_new_energy_industry' },
  // Commercial Space / 商业航天
  { pattern: /(?:commercial\s*space|spacex|starlink|satellite\s*(?:internet|constellation)|rocket|launch\s*vehicle|商业航天|卫星互联网|火箭|发射|蓝箭|星际荣耀|天兵科技|长征|星链|oneWeb)/i, topicId: 'provisional_commercial_space' },
  // Quantum Computing / 量子计算
  { pattern: /(?:quantum\s*(?:comput|supremacy|advantage|bit|processor|network|communicat)|qubit|量子计算|量子通信|量子纠缠|量子比特|量子优越性|ibm\s*quantum|google\s*sycamore|本源量子|国盾量子)/i, topicId: 'provisional_quantum_computing' },
  // Semiconductor Advanced Manufacturing / 半导体先进制造
  { pattern: /(?:semiconductor\s*(?:manufactur|fabricat|foundry)|advanced\s*(?:node|process)|euv|lithograph|tsmc|smic|asml|光刻|半导体.*制造|晶圆代工|先进制程|中芯国际|台积电|3nm|2nm|chiplet)/i, topicId: 'provisional_semiconductor_advanced_manufacturing' },
  // Advanced Packaging / 先进封装
  { pattern: /(?:advanced\s*packag|interposer|chiplet|2\.5d|3d[\s-]*packag|fan[\s-]*out|cowos|先进封装|封装技术|硅中介层|tsv|混合键合|长电科技|通富微电)/i, topicId: 'provisional_advanced_packaging' },
  // Computing Infrastructure / 算力基础设施
  { pattern: /(?:computing\s*infrastr|data[\s-]*center|liquid\s*cool|gpu\s*cluster|算力|数据中心|液冷|智算中心|超算|ai\s*infra|nvidia\s*(?:h100|b200|gb200)|英伟达)/i, topicId: 'provisional_computing_infrastructure' },
  // Smart Manufacturing / 智能制造
  { pattern: /(?:smart\s*manufactur|industrial\s*(?:internet|iot)|machine\s*vision|cnc|plc|智能制造|工业互联网|机器视觉|数控|工业4\.0|工业机器人|产线自动化)/i, topicId: 'provisional_smart_manufacturing' },
  // Luxury Consumer / 高端消费
  { pattern: /(?:luxury|premium\s*consumer|duty[\s-]*free|高端消费|免税|奢侈品|白酒|茅台|五粮液|泸州老窖|消费升级|海南自贸)/i, topicId: 'provisional_luxury_consumer' },
  // Blockchain & Crypto / 区块链与加密资产
  { pattern: /(?:blockchain|crypto|bitcoin|ethereum|btc|eth|web3|defi|nft|区块链|加密|比特币|以太坊|数字货币|稳定币|etf\s*(?:spot|现货))/i, topicId: 'provisional_blockchain_crypto_market' },
  // Innovative Drug Clinical Development / 创新药临床研发
  { pattern: /(?:clinical\s*(?:trial|development|phase)|fda\s*approv|nda|bla|ema|nmpa|临床试验|临床研发|新药|iii期|ii期|获批|上市申请)/i, topicId: 'provisional_innovative_drug_clinical_development' },
  // Additive Manufacturing / 增材制造
  { pattern: /(?:additive\s*manufactur|3d\s*print|metal\s*powder|增材制造|3d打印|激光烧结|金属粉末|铂力特)/i, topicId: 'provisional_additive_manufacturing' },
  // China IP Policy / 中国知识产权政策
  { pattern: /(?:intellectual\s*property|patent\s*(?:law|policy|reform)|知识产权|专利法|商标法|版权)/i, topicId: 'provisional_china_ip_policy' },
  // China Social Security Policy / 社会保障政策
  { pattern: /(?:social\s*security|pension|retirement|养老|社保|退休|社会保障|医保|公积金)/i, topicId: 'provisional_china_social_security_policy' },
  // Nuclear Fusion & Advanced Nuclear / 可控核聚变与先进核能
  { pattern: /(?:nuclear\s*fusion|tokamak|stellarator|smr|核聚变|可控核聚变|托卡马克|小型模块化反应堆|先进核能)/i, topicId: 'provisional_nuclear_fusion' },
  // Spatial Computing & XR / 空间计算与 XR
  { pattern: /(?:spatial\s*computing|vr|ar|xr|vision\s*pro|meta\s*orion|空间计算|增强现实|虚拟现实|混合现实)/i, topicId: 'provisional_spatial_computing_xr' },
  // Synthetic Biology / 合成生物学
  { pattern: /(?:synthetic\s*biology|alphafold|protein\s*folding|bio[\s-]*manufacturing|合成生物|蛋白质折叠|生物制造|凯赛生物)/i, topicId: 'provisional_synthetic_biology' },
  // World Models & Foundation Models / 世界模型与大模型
  { pattern: /(?:world\s*model|foundation\s*model|agi|sora|gpt|世界模型|通用人工智能|大语言模型|基础模型)/i, topicId: 'provisional_world_models' },
];

export function inferTopicFromText(text: string): string {
  for (const { pattern, topicId } of TOPIC_PATTERNS) {
    if (pattern.test(text)) return topicId;
  }
  return 'provisional_tech_innovation';
}

// ---------------------------------------------------------------------------
// Branch Inference — per-topic specialization
// ---------------------------------------------------------------------------

const BRANCH_PATTERNS: Array<{ topicId: string; pattern: RegExp; branchId: string }> = [
  // Memory Chips
  { topicId: 'provisional_semiconductor_memory_market', pattern: /(?:hbm|high[\s-]*bandwidth[\s-]*memory|高带宽内存)/i, branchId: 'provisional_hbm_high_bandwidth_memory' },
  { topicId: 'provisional_semiconductor_memory_market', pattern: /(?:dram|nand|price|contract|合约价|涨价)/i, branchId: 'provisional_dram_nand_flash_price_hike' },
  // BCI
  { topicId: 'bci', pattern: /(?:medical|clinical|als|rehabilitation|康复|抑郁|渐冻症|医疗)/i, branchId: 'bci_medical_rehab' },
  { topicId: 'bci', pattern: /(?:psychiatric|depression|精神|抑郁)/i, branchId: 'provisional_bci_psychiatric_depression' },
  // Humanoid Robotics
  { topicId: 'humanoid_robotics', pattern: /(?:actuator|joint|motor|减速器|执行器|电机|关节|谐波|伺服)/i, branchId: 'humanoid_actuator' },
  { topicId: 'humanoid_robotics', pattern: /(?:dexterous|hand|gripper|灵巧手|抓取)/i, branchId: 'provisional_humanoid_dexterous_hand' },
  // AI Agents
  { topicId: 'provisional_ai_agents', pattern: /(?:compute|budget|governance|算力|治理|预算)/i, branchId: 'provisional_ai_agents_compute_budget_governance' },
  // AI Foundation Models
  { topicId: 'provisional_ai_foundation_models', pattern: /(?:video|sora|seedance|视频生成|文生视频)/i, branchId: 'video_generation' },
  // Low Altitude Economy
  { topicId: 'provisional_low_altitude_economy', pattern: /(?:evtol|airworthiness|适航|eVTOL|飞行汽车)/i, branchId: 'provisional_low_altitude_economy_evtol_airworthiness' },
  { topicId: 'provisional_low_altitude_economy', pattern: /(?:uav|drone|无人机|物流无人机)/i, branchId: 'urban_uav_infrastructure' },
  // Innovative Drug License-out
  { topicId: 'innovative_drug_license_out', pattern: /(?:adc|抗体偶联|antibody[\s-]*drug[\s-]*conjugate)/i, branchId: 'adc_license_out' },
  // Quantum Computing
  { topicId: 'provisional_quantum_computing', pattern: /(?:quantum\s*material|拓扑|topolog|量子材料)/i, branchId: 'quantum_materials' },
  // Computing Infrastructure
  { topicId: 'provisional_computing_infrastructure', pattern: /(?:ai\s*infra|gpu|npu|算力芯片|ai\s*加速)/i, branchId: 'provisional_computing_infrastructure_ai_infrastructure' },
  // Solid-State Battery
  { topicId: 'provisional_solid_state_battery', pattern: /(?:sulfide|硫化物|全固态|all[\s-]*solid[\s-]*state)/i, branchId: 'provisional_ssb_sulfide_electrolyte' },
  { topicId: 'provisional_solid_state_battery', pattern: /(?:semi[\s-]*solid|半固态|中试线|装车|量产|pilot\s*line)/i, branchId: 'provisional_ssb_semi_solid_mass_production' },
  // Autonomous Driving & Robotaxi
  { topicId: 'provisional_autonomous_driving_robotaxi', pattern: /(?:robotaxi|robo[\s-]*taxi|waymo|apollo\s*go|萝卜快跑|付费订单|运营车队|fleet)/i, branchId: 'provisional_robotaxi_commercial_operation' },
  { topicId: 'provisional_autonomous_driving_robotaxi', pattern: /(?:regulation|准入|法规|标准|条例|试点|l3)/i, branchId: 'provisional_autonomous_driving_l3_regulation' },
  // Nuclear Fusion & Advanced Nuclear
  { topicId: 'provisional_nuclear_fusion_advanced_nuclear', pattern: /(?:tokamak|stellarator|magnetic\s*confinement|托卡马克|磁约束|人造太阳|east|iter)/i, branchId: 'provisional_fusion_magnetic_confinement' },
  { topicId: 'provisional_nuclear_fusion_advanced_nuclear', pattern: /(?:small\s*modular|\bsmr\b|模块化反应堆|第四代核电|高温气冷堆)/i, branchId: 'provisional_small_modular_reactor' },
  // Spatial Computing & XR
  { topicId: 'provisional_spatial_computing_xr', pattern: /(?:smart\s*glasses|ray[\s-]*ban|智能眼镜|ar眼镜|眼镜)/i, branchId: 'provisional_xr_ai_smart_glasses' },
  { topicId: 'provisional_spatial_computing_xr', pattern: /(?:content|ecosystem|app\s*store|内容生态|应用生态|开发者)/i, branchId: 'provisional_xr_spatial_content_ecosystem' },
  // Synthetic Biology
  { topicId: 'provisional_synthetic_biology', pattern: /(?:protein\s*(?:design|folding|structure)|alphafold|rfdiffusion|蛋白质设计|蛋白质折叠|从头设计)/i, branchId: 'provisional_synbio_ai_protein_design' },
  { topicId: 'provisional_synthetic_biology', pattern: /(?:biomanufactur|fermentation|bio[\s-]*based|生物制造|发酵|生物基|细胞工厂)/i, branchId: 'provisional_synbio_biomanufacturing' },
];

export function inferBranchFromText(topicId: string, text: string): string | null {
  for (const { topicId: tid, pattern, branchId } of BRANCH_PATTERNS) {
    if (tid === topicId && pattern.test(text)) return branchId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scope Inference — parent when evidence is broad enough
// ---------------------------------------------------------------------------

/** When the text is sufficiently broad (covers multiple sub-domains or references
 *  industry-level metrics), scope as parent rather than branch. */
export function inferScope(topicId: string, branchId: string | null, text: string): 'parent' | 'branch' {
  if (!branchId) return 'parent';

  // Broad-scope indicators: industry-level terms, policy terms, market statistics
  const broadIndicators = /(?:industry|market|sector|policy|regulation|产业|行业|市场|政策|监管|总产值|出货量|年增长|产能|GDP|产值|规模|全球|国内外)/i;
  const multiLayerCount = countLayers(text);

  // If text has broad indicators AND touches 3+ layers, classify as parent
  if (broadIndicators.test(text) && multiLayerCount >= 3) return 'parent';

  return 'branch';
}

// ---------------------------------------------------------------------------
// Affected Layer Inference — dynamic multi-layer detection
// ---------------------------------------------------------------------------

export function inferAffectedLayers(text: string, sourceClass: string): EvidenceNode['affected_layer'] {
  const layers: EvidenceNode['affected_layer'] = [];

  // Reality layer: production, delivery, deployment, manufacturing, patents
  if (/(?:mass\s*produc|deliver|deploy|manufactur|produc(?:tion|ing)|shipment|量产|交付|部署|制造|出货|产能|投产|落地|实验|测试|验证|试点|示范|专利|patent)/i.test(text)) {
    layers.push('reality');
  }

  // Capital layer: investment, funding, IPO, M&A, revenue
  if (/(?:invest|fund(?:ing|raise)|ipo|m&a|revenue|financing|billion|million|亿|万|投资|融资|上市|并购|收入|营收|利润|估值|市值|资金|订单)/i.test(text)) {
    layers.push('capital');
  }

  // Pricing layer: price, cost, contract, adoption, market share
  if (/(?:price|pricing|cost|contract|adopt|market[\s-]*share|tariff|价格|成本|合约|采纳|市场份额|渗透率|涨价|降价|毛利|ASP|价量)/i.test(text)) {
    layers.push('pricing');
  }

  // Perception layer: policy, regulation, label, narrative, public perception
  if (/(?:policy|regulation|regulatory|standard|label|narrative|public[\s-]*perception|sentiment|政策|法规|监管|标准|标签|叙事|舆论|共识|报告|白皮书|指导意见|行动方案)/i.test(text)) {
    layers.push('perception');
  }

  // Fallback based on source class
  if (layers.length === 0) {
    if (sourceClass === 'official') return ['reality', 'perception'];
    if (sourceClass === 'academic') return ['reality'];
    return ['capital'];
  }

  return layers;
}

// ---------------------------------------------------------------------------
// Evidence Strength Inference — dynamic multi-factor evaluation
// ---------------------------------------------------------------------------

export function inferEvidenceStrength(
  sourceClass: string,
  text: string,
  publishedAt: string,
): EvidenceNode['evidence_strength'] {
  let score = 0;

  // Source authority: official > academic > company
  if (sourceClass === 'official') score += 3;
  else if (sourceClass === 'academic') score += 2;
  else score += 1;

  // Data specificity: concrete numbers, dates, named entities
  if (/(?:\d+(?:\.\d+)?[%％]|\d+(?:亿|万|billion|million)|(?:20[12]\d)[-年])/i.test(text)) score += 2;
  if (/(?:approved|launched|signed|granted|批准|获批|签约|授权|发布|印发|颁布)/i.test(text)) score += 1;

  // Recency: recent events score higher
  const pubDate = new Date(publishedAt);
  const now = new Date();
  const monthsAgo = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsAgo <= 3) score += 2;
  else if (monthsAgo <= 6) score += 1;

  if (score >= 6) return 'E4';
  if (score >= 4) return 'E3';
  if (score >= 2) return 'E2';
  return 'E1';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countLayers(text: string): number {
  let count = 0;
  if (/(?:produc|manufactur|deliver|deploy|量产|交付|部署|制造|出货|实验|测试)/i.test(text)) count++;
  if (/(?:invest|fund|revenue|billion|亿|投资|融资|收入|营收|订单)/i.test(text)) count++;
  if (/(?:price|cost|contract|adopt|价格|成本|合约|采纳|渗透率)/i.test(text)) count++;
  if (/(?:policy|regulation|standard|label|政策|法规|监管|标准)/i.test(text)) count++;
  return count;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}
