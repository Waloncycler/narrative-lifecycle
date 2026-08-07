/**
 * Batch Historical Backfill Engine
 *
 * Populates the Evidence Table with an operator-curated historical baseline so
 * every monitored Topic and registered Branch has a usable timeline instead of
 * a single origin node.
 *
 * DESIGN CONSTRAINT — read before extending this file.
 *
 * This script writes EVIDENCE, never STAGES. It appends rows to
 * `data/evidence_table/evidence_table.json` and then leaves stage
 * classification to the deterministic pipeline (`autonomy:run` and
 * `run_evolution_timeline`). It must never write into
 * `outputs/evolution_timelines/*` or `outputs/operator_runs/*` directly, the
 * way `scripts/inject_memory_history.ts` does — that path bypasses the Stage
 * Gate and violates "Evidence Table First / No Direct LLM Scoring".
 *
 * PROVENANCE CAVEAT.
 *
 * Rows produced here are operator recall of publicly reported events, not
 * source-retrieved records. They are tagged `event_type: historical_backfill`,
 * carry an `ev_bf_` id prefix, and declare their unverified status in
 * `limitation`, so a later verification pass can find and replace them. Events
 * are capped at KNOWLEDGE_CUTOFF; anything later must come from the real
 * research loop.
 *
 * Usage:
 *   npx tsx scripts/batch_historical_backfill.ts --dry-run
 *   npx tsx scripts/batch_historical_backfill.ts
 *   npx tsx scripts/batch_historical_backfill.ts --topic bci
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validateEvidenceNode, type EvidenceLayer, type EvidenceNode, type EvidenceStrength } from '../src/domain/evidence';
import { classifyStage } from '../src/domain/stage_classifier';
import { stageRank, type Stage } from '../src/domain/stages';
import { FileAutonomousResearchRepository } from '../src/infrastructure/autonomous_research_io';

const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? process.cwd();

/** Events after this date must come from the research loop, not operator recall. */
const KNOWLEDGE_CUTOFF = '2026-05-31';
const BACKFILL_SCHEMA_VERSION = '0.14-historical-backfill';
const BACKFILL_LIMITATION =
  'Operator-curated historical backfill. Publicly reported event recorded from operator recall; original source page has not been retrieved or quote-verified.';

interface BackfillEvent {
  date: string;
  title: string;
  org: string;
  url: string;
  source: 'official' | 'academic' | 'company';
  layers: EvidenceLayer[];
  strength: EvidenceStrength;
  confidence: number;
  polarity?: 'positive' | 'negative' | 'neutral';
}

interface TopicBackfill {
  topic_id: string;
  /** Stage the deterministic gate must produce for parent scope after backfill. */
  expected_stage: Stage;
  parent: BackfillEvent[];
  branches?: Record<string, BackfillEvent[]>;
}

// ---------------------------------------------------------------------------
// Curated dataset — 25 topics
// ---------------------------------------------------------------------------

const DATASET: TopicBackfill[] = [
  {
    topic_id: 'bci',
    // Golden case: the parent narrative must not be lifted above S4. No parent
    // pricing-layer evidence exists, and none may be added here.
    expected_stage: 'S4',
    parent: [
      { date: '2023-05-25', title: 'FDA 批准 Neuralink 开展首次人体临床试验 (IDE)', org: 'FDA', url: 'https://www.fda.gov/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 88 },
      { date: '2023-08-23', title: 'Nature 双论文报道皮层语音解码速度提升至每分钟 60 词以上', org: 'Nature', url: 'https://www.nature.com/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 86 },
      { date: '2024-01-29', title: 'Neuralink 完成首例人类受试者植入手术', org: 'Neuralink', url: 'https://neuralink.com/', source: 'company', layers: ['reality', 'perception'], strength: 'E3', confidence: 85 },
      { date: '2024-05-17', title: 'Synchron 完成 COMMAND 早期可行性试验受试者随访', org: 'Synchron', url: 'https://synchron.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 80 },
    ],
    branches: {
      bci_medical_rehab: [
        { date: '2023-08-23', title: '瘫痪患者语音神经假体在临床试验中恢复交流能力', org: 'Nature', url: 'https://www.nature.com/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 84 },
        { date: '2025-03-15', title: '国家药监局将脑机接口医疗器械纳入创新审评通道', org: 'NMPA', url: 'https://www.nmpa.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E3', confidence: 82 },
      ],
    },
  },
  {
    topic_id: 'humanoid_robotics',
    expected_stage: 'S6',
    parent: [
      { date: '2023-03-16', title: 'Figure AI 走出隐身状态并公布通用人形机器人技术路线', org: 'Figure AI', url: 'https://www.figure.ai/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 72 },
      { date: '2023-05-16', title: '英伟达在 ITF World 提出具身智能是 AI 的下一波浪潮', org: 'NVIDIA', url: 'https://www.nvidia.com/', source: 'company', layers: ['perception'], strength: 'E2', confidence: 75 },
      { date: '2023-11-02', title: '工信部印发《人形机器人创新发展指导意见》', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E4', confidence: 92 },
      { date: '2024-02-29', title: 'Figure AI 完成 6.75 亿美元 B 轮融资，OpenAI 与英伟达参投', org: 'Figure AI', url: 'https://www.figure.ai/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 88 },
      { date: '2024-05-13', title: '宇树科技发布 Unitree G1 人形机器人，起售价 9.9 万元', org: '宇树科技', url: 'https://www.unitree.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2024-11-06', title: 'Figure 02 在宝马斯帕坦堡工厂进入实际产线工位作业', org: 'BMW Group', url: 'https://www.bmwgroup.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      humanoid_actuator: [
        { date: '2024-03-20', title: '谐波减速器与空心杯电机成为人形机器人关节主要成本项', org: 'Harmonic Drive', url: 'https://www.harmonicdrive.net/', source: 'company', layers: ['pricing', 'reality'], strength: 'E2', confidence: 76 },
        { date: '2025-02-18', title: '国产旋转执行器与行星滚柱丝杠进入批量供货验证', org: '绿的谐波', url: 'https://www.leaderdrive.cn/', source: 'company', layers: ['reality', 'capital'], strength: 'E2', confidence: 78 },
      ],
    },
  },
  {
    topic_id: 'innovative_drug_license_out',
    expected_stage: 'S6',
    parent: [
      { date: '2022-12-22', title: '科伦博泰与默沙东就多个 ADC 项目达成系列对外授权', org: '科伦博泰', url: 'https://www.kelun-biotech.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 76 },
      { date: '2023-08-01', title: '中国创新药 License-out 交易数量首次超过 License-in', org: '中国医药创新促进会', url: 'http://www.phirda.com/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 80 },
      { date: '2023-12-11', title: '百利天恒 BL-B01D1 授权百时美施贵宝，总额 84 亿美元、首付款 8 亿美元', org: '百利天恒', url: 'https://www.baili-pharm.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E4', confidence: 90 },
      { date: '2024-05-16', title: '恒瑞医药将 GLP-1 产品组合授权海外新设公司，获首付款与股权对价', org: '恒瑞医药', url: 'https://www.hengrui.com/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 86 },
      { date: '2025-05-20', title: '三生制药 PD-1/VEGF 双抗授权辉瑞，首付款规模创国产创新药纪录', org: '三生制药', url: 'https://www.3sbio.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E4', confidence: 90 },
    ],
    branches: {
      adc_license_out: [
        { date: '2023-12-11', title: 'EGFR/HER3 双抗 ADC 成为跨国药企竞标焦点', org: '百利天恒', url: 'https://www.baili-pharm.com/', source: 'company', layers: ['reality', 'capital'], strength: 'E3', confidence: 84 },
        { date: '2025-01-15', title: 'ADC 平台型交易占中国对外授权总金额比重继续上升', org: '中国医药创新促进会', url: 'http://www.phirda.com/', source: 'academic', layers: ['pricing', 'perception'], strength: 'E2', confidence: 78 },
      ],
    },
  },
  {
    topic_id: 'provisional_blockchain_crypto_market',
    expected_stage: 'S6',
    parent: [
      { date: '2022-11-11', title: 'FTX 申请破产保护，行业进入去杠杆与监管收紧周期', org: 'SEC', url: 'https://www.sec.gov/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 85, polarity: 'negative' },
      { date: '2023-06-15', title: '贝莱德提交现货比特币 ETF 申请，机构配置叙事重启', org: 'BlackRock', url: 'https://www.blackrock.com/', source: 'company', layers: ['perception'], strength: 'E3', confidence: 84 },
      { date: '2024-01-10', title: 'SEC 批准 11 只现货比特币 ETF 上市交易', org: 'SEC', url: 'https://www.sec.gov/', source: 'official', layers: ['capital', 'perception'], strength: 'E4', confidence: 93 },
      { date: '2024-03-14', title: '现货 ETF 累计净流入推动比特币创历史新高，估值框架被重新讨论', org: 'CoinShares', url: 'https://coinshares.com/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 85 },
      { date: '2025-07-18', title: '美国稳定币法案完成立法程序，支付类资产获得联邦框架', org: 'U.S. Congress', url: 'https://www.congress.gov/', source: 'official', layers: ['perception', 'reality'], strength: 'E4', confidence: 92 },
    ],
  },
  {
    topic_id: 'provisional_luxury_consumer',
    expected_stage: 'S6',
    parent: [
      { date: '2023-01-08', title: '中国恢复出入境客运与签证签发，免税及高端消费客流回补', org: '国家移民管理局', url: 'https://www.nia.gov.cn/', source: 'official', layers: ['reality'], strength: 'E2', confidence: 78 },
      { date: '2023-04-10', title: '海南离岛免税销售数据成为"消费回流"叙事的稳定指标', org: '海口海关', url: 'http://haikou.customs.gov.cn/', source: 'official', layers: ['perception'], strength: 'E3', confidence: 80 },
      { date: '2024-01-25', title: 'LVMH 年报显示亚洲(除日本)收入增速明显放缓', org: 'LVMH', url: 'https://www.lvmh.com/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 84, polarity: 'negative' },
      { date: '2024-08-15', title: '高端白酒批价与渠道库存压力显现，消费品定价体系被重估', org: '中国酒业协会', url: 'http://www.cada.cc/', source: 'company', layers: ['pricing'], strength: 'E3', confidence: 82, polarity: 'negative' },
      { date: '2025-01-17', title: '国家统计局发布社会消费品零售总额年度数据，服务消费占比提升', org: '国家统计局', url: 'https://www.stats.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 86 },
    ],
  },
  {
    topic_id: 'provisional_low_altitude_economy',
    expected_stage: 'S6',
    parent: [
      { date: '2023-10-13', title: '亿航 EH216-S 获民航局颁发全球首张无人驾驶载人航空器型号合格证', org: '中国民用航空局', url: 'https://www.caac.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 92 },
      { date: '2023-12-11', title: '中央经济工作会议将低空经济列为战略性新兴产业', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 92 },
      { date: '2024-03-27', title: '工信部等四部门印发《通用航空装备创新应用实施方案》', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception', 'capital'], strength: 'E4', confidence: 90 },
      { date: '2024-12-27', title: '亿航智能披露 EH216-S 交付量与单机售价区间', org: '亿航智能', url: 'https://www.ehang.com/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 84 },
      { date: '2025-03-20', title: '小鹏汇天分体式飞行汽车进入量产准备并公布预售价格', org: '小鹏汇天', url: 'https://www.xpeng.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      urban_uav_infrastructure: [
        { date: '2024-06-18', title: '深圳、合肥等城市启动低空飞行服务保障体系与起降点建设', org: '深圳市交通运输局', url: 'http://jtys.sz.gov.cn/', source: 'official', layers: ['reality', 'capital'], strength: 'E3', confidence: 82 },
        { date: '2025-04-10', title: '城市低空航路与空域管理试点扩大至更多枢纽城市', org: '中国民用航空局', url: 'https://www.caac.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E3', confidence: 82 },
      ],
      provisional_low_altitude_economy_evtol_airworthiness: [
        { date: '2024-04-07', title: 'eVTOL 生产许可证审定成为适航体系的独立环节', org: '中国民用航空局', url: 'https://www.caac.gov.cn/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
        { date: '2025-03-29', title: '首批载人无人驾驶航空器运营合格证 (OC) 完成审定', org: '中国民用航空局', url: 'https://www.caac.gov.cn/', source: 'official', layers: ['reality', 'perception'], strength: 'E4', confidence: 88 },
      ],
    },
  },
  {
    topic_id: 'provisional_new_energy_industry',
    expected_stage: 'S6',
    parent: [
      { date: '2023-01-18', title: '国家能源局公布年度光伏新增装机创历史新高', org: '国家能源局', url: 'http://www.nea.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 90 },
      { date: '2023-09-26', title: 'IEA 世界能源展望提出清洁能源装机拐点叙事', org: 'IEA', url: 'https://www.iea.org/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 86 },
      { date: '2023-12-05', title: '宁德时代神行超充电池进入量产装车，产业资本持续加码', org: '宁德时代', url: 'https://www.catl.com/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 85 },
      { date: '2024-05-20', title: '中国光伏行业协会披露组件价格跌破成本线，行业进入产能出清', org: '中国光伏行业协会', url: 'http://www.chinapv.org.cn/', source: 'company', layers: ['pricing'], strength: 'E3', confidence: 84, polarity: 'negative' },
      { date: '2025-01-17', title: '国家统计局公布新能源汽车年产量突破新台阶', org: '国家统计局', url: 'https://www.stats.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 90 },
    ],
  },
  {
    topic_id: 'provisional_commercial_space',
    expected_stage: 'S6',
    parent: [
      { date: '2023-04-20', title: 'SpaceX Starship 完成首次轨道级综合飞行测试', org: 'SpaceX', url: 'https://www.spacex.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 86 },
      { date: '2023-12-14', title: 'FAA 商业航天发射许可数量创历史新高，商业航天成为独立产业口径', org: 'FAA', url: 'https://www.faa.gov/', source: 'official', layers: ['perception'], strength: 'E3', confidence: 84 },
      { date: '2024-03-05', title: '商业航天首次被写入政府工作报告新增长引擎表述', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['perception', 'capital'], strength: 'E4', confidence: 90 },
      { date: '2024-11-12', title: 'Starlink 用户规模与资费结构披露，卫星互联网进入可比定价阶段', org: 'Starlink', url: 'https://www.starlink.com/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 85 },
      { date: '2025-01-20', title: '国家航天局披露年度发射次数创新高，商业火箭占比提升', org: '国家航天局', url: 'https://www.cnsa.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 88 },
    ],
  },
  {
    topic_id: 'provisional_quantum_computing',
    // Capital and reality exist; no parent-scope pricing adoption. Must stay S4.
    expected_stage: 'S4',
    parent: [
      { date: '2023-06-14', title: 'Nature 刊发 127 比特处理器在纠错前展示实用性尺度的实验', org: 'Nature', url: 'https://www.nature.com/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 85 },
      { date: '2023-12-04', title: 'IBM 发布 Condor 与 Heron 处理器及量子路线图', org: 'IBM', url: 'https://www.ibm.com/quantum', source: 'company', layers: ['perception', 'reality'], strength: 'E3', confidence: 84 },
      { date: '2024-12-09', title: 'Google 发布 Willow 芯片，展示低于阈值的量子纠错', org: 'Google', url: 'https://blog.google/', source: 'company', layers: ['reality', 'perception'], strength: 'E4', confidence: 90 },
      { date: '2025-02-19', title: '微软发布 Majorana 1 拓扑量子芯片并公布产业化路径', org: 'Microsoft', url: 'https://www.microsoft.com/', source: 'company', layers: ['capital', 'perception'], strength: 'E3', confidence: 82 },
      { date: '2025-03-12', title: '中国科大发布新一代超导量子计算原型机', org: '中国科学技术大学', url: 'https://www.ustc.edu.cn/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      quantum_materials: [
        { date: '2025-02-19', title: '拓扑超导材料成为容错量子比特的独立技术路线', org: 'Microsoft', url: 'https://www.microsoft.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 76 },
        { date: '2025-05-08', title: '量子材料制备与表征标准化进展被纳入行业路线图', org: 'Nature', url: 'https://www.nature.com/', source: 'academic', layers: ['perception'], strength: 'E2', confidence: 74 },
      ],
    },
  },
  {
    topic_id: 'provisional_innovative_drug_clinical_development',
    // No parent-scope capital confirmation. Must stay S3.
    expected_stage: 'S3',
    parent: [
      { date: '2023-02-20', title: '国家药监局药品审评报告显示创新药获批数量创新高', org: 'NMPA', url: 'https://www.nmpa.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 88 },
      { date: '2023-07-14', title: '以临床价值为导向的抗肿瘤药物研发指导原则改变临床方案设计口径', org: 'CDE', url: 'https://www.cde.org.cn/', source: 'official', layers: ['perception'], strength: 'E3', confidence: 84 },
      { date: '2024-09-10', title: 'FDA 批准的中国申办方新药与快速通道认定数量继续上升', org: 'FDA', url: 'https://www.fda.gov/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2025-06-02', title: '中国临床研究数据在国际肿瘤学年会口头报告中的占比提升', org: 'ASCO', url: 'https://www.asco.org/', source: 'academic', layers: ['reality'], strength: 'E2', confidence: 78 },
    ],
  },
  {
    topic_id: 'provisional_ai_foundation_models',
    expected_stage: 'S6',
    parent: [
      { date: '2023-03-14', title: 'OpenAI 发布 GPT-4，多模态与专业考试表现成为能力基准', org: 'OpenAI', url: 'https://openai.com/', source: 'company', layers: ['reality'], strength: 'E4', confidence: 92 },
      { date: '2023-11-15', title: '斯坦福 AI Index 将"基础模型"确立为稳定的行业统计口径', org: 'Stanford HAI', url: 'https://hai.stanford.edu/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 85 },
      { date: '2024-03-04', title: 'Anthropic 发布 Claude 3 系列，前沿模型资本竞赛加剧', org: 'Anthropic', url: 'https://www.anthropic.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 87 },
      { date: '2024-05-21', title: '模型 API 进入价格战，主流厂商推理单价大幅下调', org: '阿里云', url: 'https://www.aliyun.com/', source: 'company', layers: ['pricing'], strength: 'E3', confidence: 86 },
      { date: '2025-01-20', title: 'DeepSeek-R1 开源发布，训练与推理成本结构被重新定价', org: 'DeepSeek', url: 'https://www.deepseek.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E4', confidence: 92 },
    ],
    branches: {
      video_generation: [
        { date: '2024-02-15', title: 'Sora 发布长时序视频生成样例，视频生成成为独立能力分支', org: 'OpenAI', url: 'https://openai.com/', source: 'company', layers: ['reality', 'perception'], strength: 'E3', confidence: 84 },
        { date: '2025-02-10', title: '国内视频生成模型进入商用定价与 API 供给阶段', org: '字节跳动', url: 'https://www.volcengine.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E3', confidence: 82 },
      ],
    },
  },
  {
    topic_id: 'provisional_semiconductor_advanced_manufacturing',
    expected_stage: 'S6',
    parent: [
      { date: '2022-12-29', title: '台积电 N3 制程进入量产阶段', org: 'TSMC', url: 'https://www.tsmc.com/', source: 'company', layers: ['reality'], strength: 'E4', confidence: 90 },
      { date: '2023-10-17', title: '美国商务部更新先进计算芯片与半导体设备出口管制规则', org: 'BIS', url: 'https://www.bis.doc.gov/', source: 'official', layers: ['perception', 'reality'], strength: 'E4', confidence: 92 },
      { date: '2024-01-24', title: 'ASML 财报显示 EUV 订单积压创纪录，先进制程资本开支上行', org: 'ASML', url: 'https://www.asml.com/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 88 },
      { date: '2024-07-16', title: 'SEMI 数据显示晶圆厂设备支出与先进制程代工报价同步上行', org: 'SEMI', url: 'https://www.semi.org/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 85 },
      { date: '2025-04-15', title: '2nm 级制程进入量产准备，海外新厂进入爬坡阶段', org: 'TSMC', url: 'https://www.tsmc.com/', source: 'company', layers: ['reality'], strength: 'E4', confidence: 90 },
    ],
  },
  {
    topic_id: 'provisional_semiconductor_memory_market',
    expected_stage: 'S6',
    parent: [
      { date: '2023-06-20', title: 'TrendForce 观察到 DRAM 与 NAND 价格触底，供应商大幅减产', org: 'TrendForce', url: 'https://www.trendforce.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 78 },
      { date: '2024-03-19', title: 'SK 海力士宣布当年 HBM 产能全部售罄，存储成为 AI 关键瓶颈', org: 'SK hynix', url: 'https://www.skhynix.com/', source: 'company', layers: ['perception', 'reality'], strength: 'E3', confidence: 88 },
      { date: '2024-06-26', title: '美光宣布 HBM3E 进入量产并公布扩产计划', org: 'Micron', url: 'https://www.micron.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2024-10-22', title: 'DRAM 合约价连续多季上涨，存储进入上行周期定价', org: 'TrendForce', url: 'https://www.trendforce.com/', source: 'company', layers: ['pricing'], strength: 'E3', confidence: 85 },
      { date: '2025-05-14', title: '下一代 HBM 供货协议与 AI 服务器出货验证存储需求结构性变化', org: 'Samsung', url: 'https://www.samsung.com/semiconductor/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 86 },
    ],
    branches: {
      provisional_hbm_high_bandwidth_memory: [
        { date: '2024-03-19', title: 'HBM 供给成为 AI 加速卡出货的独立约束条件', org: 'SK hynix', url: 'https://www.skhynix.com/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 86 },
        { date: '2025-05-14', title: 'HBM4 规格与供货节奏进入客户端验证', org: 'Samsung', url: 'https://www.samsung.com/semiconductor/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 84 },
      ],
      provisional_dram_nand_flash_price_hike: [
        { date: '2024-10-22', title: '通用型 DRAM 与 NAND 合约价格进入连续上涨区间', org: 'TrendForce', url: 'https://www.trendforce.com/', source: 'company', layers: ['pricing'], strength: 'E3', confidence: 84 },
        { date: '2025-04-08', title: '终端厂商开始将存储成本上涨传导至整机定价', org: 'Counterpoint', url: 'https://www.counterpointresearch.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E2', confidence: 78 },
      ],
    },
  },
  {
    topic_id: 'provisional_china_ip_policy',
    expected_stage: 'S3',
    parent: [
      { date: '2023-01-16', title: '国家知识产权局公布发明专利有效量与每万人口高价值专利数', org: '国家知识产权局', url: 'https://www.cnipa.gov.cn/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2023-10-25', title: '国务院办公厅印发《专利转化运用专项行动方案》', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 90 },
      { date: '2024-01-20', title: '修改后的《专利法实施细则》施行，衔接国际条约要求', org: '国家知识产权局', url: 'https://www.cnipa.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E3', confidence: 84 },
      { date: '2025-03-06', title: 'WIPO 统计显示中国 PCT 国际专利申请量继续位居首位', org: 'WIPO', url: 'https://www.wipo.int/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 84 },
    ],
  },
  {
    topic_id: 'provisional_additive_manufacturing',
    expected_stage: 'S3',
    parent: [
      { date: '2023-05-10', title: '航空发动机增材制造燃油喷嘴累计交付量突破新量级', org: 'GE Aerospace', url: 'https://www.geaerospace.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2023-09-12', title: 'ISO/ASTM 增材制造标准体系完善，工艺分类与术语趋于稳定', org: 'ASTM International', url: 'https://www.astm.org/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 82 },
      { date: '2024-04-18', title: 'NASA 铝合金增材制造喷管完成热试车验证', org: 'NASA', url: 'https://www.nasa.gov/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2025-02-25', title: '金属增材制造在航空航天与医疗植入体进入批量生产验证', org: '铂力特', url: 'https://www.xa-blt.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 78 },
    ],
    branches: {
      smb_desktop_3d_printing: [
        { date: '2023-09-19', title: '拓竹科技 (Bambu Lab) 消费级 3D 打印机以多色打印与高速度重塑桌面市场', org: 'Bambu Lab', url: 'https://bambulab.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 76 },
        { date: '2024-11-08', title: '创想三维等厂商推动桌面 3D 打印机出货量与均价下探，消费渗透加速', org: 'Creality', url: 'https://www.creality.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E2', confidence: 75 },
      ],
    },
  },
  {
    topic_id: 'provisional_china_social_security_policy',
    expected_stage: 'S3',
    parent: [
      { date: '2023-02-24', title: '人社部披露基本养老保险全国统筹推进情况与参保规模', org: '人力资源和社会保障部', url: 'http://www.mohrss.gov.cn/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2024-09-13', title: '全国人大常委会通过渐进式延迟法定退休年龄的决定', org: '全国人大常委会', url: 'http://www.npc.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E4', confidence: 94 },
      { date: '2024-12-15', title: '个人养老金制度从试点城市推开至全国实施', org: '财政部', url: 'https://www.mof.gov.cn/', source: 'official', layers: ['perception', 'reality'], strength: 'E4', confidence: 90 },
      { date: '2025-03-18', title: '国家医保局公布基金收支运行与待遇保障调整情况', org: '国家医保局', url: 'http://www.nhsa.gov.cn/', source: 'official', layers: ['reality'], strength: 'E3', confidence: 84 },
    ],
  },
  {
    topic_id: 'provisional_advanced_packaging',
    expected_stage: 'S3',
    parent: [
      { date: '2023-07-05', title: '先进封装产能成为 AI 加速卡出货的关键约束', org: 'TSMC', url: 'https://www.tsmc.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 86 },
      { date: '2023-11-20', title: '异质集成路线图将 chiplet 与混合键合确立为标准术语', org: 'SEMI', url: 'https://www.semi.org/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 82 },
      { date: '2024-08-14', title: '国产高密度扇出型封装方案进入量产供货', org: '长电科技', url: 'https://www.jcetglobal.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 82 },
      { date: '2025-05-06', title: '混合键合工艺进入下一代高带宽存储的量产验证阶段', org: 'IEEE ECTC', url: 'https://www.ieee.org/', source: 'academic', layers: ['reality'], strength: 'E2', confidence: 78 },
    ],
  },
  {
    topic_id: 'provisional_ai_agents',
    expected_stage: 'S6',
    parent: [
      { date: '2023-03-30', title: 'AutoGPT 开源发布，自主智能体概念快速扩散', org: 'GitHub', url: 'https://github.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 75 },
      { date: '2023-11-06', title: 'OpenAI DevDay 发布 Assistants API，智能体成为产品化能力', org: 'OpenAI', url: 'https://openai.com/', source: 'company', layers: ['perception', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2024-10-29', title: 'Salesforce 推出 Agentforce 并公布按对话计费的定价模式', org: 'Salesforce', url: 'https://www.salesforce.com/', source: 'company', layers: ['pricing', 'capital'], strength: 'E3', confidence: 86 },
      { date: '2024-11-25', title: 'Anthropic 开源 Model Context Protocol，工具接入方式趋于统一', org: 'Anthropic', url: 'https://www.anthropic.com/', source: 'company', layers: ['reality', 'capital'], strength: 'E3', confidence: 88 },
      { date: '2025-05-19', title: '主流云厂商发布企业级智能体互操作与部署方案', org: 'Microsoft', url: 'https://www.microsoft.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      provisional_ai_agents_compute_budget_governance: [
        { date: '2025-01-28', title: '智能体长链路调用带来的算力预算与成本失控成为部署阻力', org: 'Microsoft', url: 'https://www.microsoft.com/', source: 'company', layers: ['friction', 'pricing'], strength: 'E2', confidence: 72, polarity: 'negative' },
        { date: '2025-05-19', title: '企业开始为智能体设置调用上限、审计与权限边界', org: 'Salesforce', url: 'https://www.salesforce.com/', source: 'company', layers: ['perception', 'reality'], strength: 'E2', confidence: 76 },
      ],
    },
  },
  {
    topic_id: 'provisional_smart_manufacturing',
    expected_stage: 'S6',
    parent: [
      { date: '2023-09-26', title: 'IFR 统计显示全球工业机器人装机量创新高，中国占比过半', org: 'IFR', url: 'https://ifr.org/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 85 },
      { date: '2023-12-28', title: '工信部等部门印发加快传统制造业转型升级的指导意见', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 90 },
      { date: '2024-03-13', title: '国务院印发推动大规模设备更新行动方案，形成设备投资定价预期', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['pricing', 'capital'], strength: 'E4', confidence: 90 },
      { date: '2024-08-22', title: '自动化厂商披露中国区订单结构与本地产能投资', org: 'Siemens', url: 'https://www.siemens.com/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 82 },
      { date: '2025-01-17', title: '国家统计局数据显示装备制造业增加值占比与智能工厂产出提升', org: '国家统计局', url: 'https://www.stats.gov.cn/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 88 },
    ],
  },
  {
    topic_id: 'provisional_computing_infrastructure',
    expected_stage: 'S6',
    parent: [
      { date: '2023-03-21', title: '英伟达 GTC 发布面向大模型的加速卡与云上算力交付形态', org: 'NVIDIA', url: 'https://www.nvidia.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 86 },
      { date: '2023-10-08', title: '六部门印发《算力基础设施高质量发展行动计划》', org: '国家发展改革委', url: 'https://www.ndrc.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 92 },
      { date: '2024-02-21', title: '数据中心业务收入同比大幅增长，AI 资本开支周期获得确认', org: 'NVIDIA', url: 'https://www.nvidia.com/', source: 'company', layers: ['capital'], strength: 'E4', confidence: 92 },
      { date: '2024-01-24', title: 'IEA 预测数据中心电力需求翻倍，电力成为算力成本的核心变量', org: 'IEA', url: 'https://www.iea.org/', source: 'academic', layers: ['pricing', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2025-01-23', title: '中国信通院发布智算中心建设规模与利用率统计', org: '中国信通院', url: 'http://www.caict.ac.cn/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      provisional_computing_infrastructure_ai_infrastructure: [
        { date: '2024-05-30', title: '液冷与高功率机柜成为智算中心的独立改造工程', org: '中国信通院', url: 'http://www.caict.ac.cn/', source: 'academic', layers: ['reality', 'capital'], strength: 'E2', confidence: 78 },
        { date: '2025-03-11', title: '算力租赁与调度平台开始形成可比的单卡时价格', org: '国家发展改革委', url: 'https://www.ndrc.gov.cn/', source: 'official', layers: ['pricing'], strength: 'E2', confidence: 76 },
      ],
    },
  },

  // -------------------------------------------------------------------------
  // New topics from the 2026-08-07 coverage review
  // -------------------------------------------------------------------------
  {
    topic_id: 'provisional_solid_state_battery',
    // Pilot lines and vehicle validation only; no parent-scope pricing adoption.
    expected_stage: 'S4',
    parent: [
      { date: '2023-06-13', title: '丰田公布全固态电池技术路线与装车时间表', org: 'Toyota', url: 'https://global.toyota/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2024-01-21', title: '中国全固态电池产学研协同创新平台成立，统一技术路线口径', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception'], strength: 'E3', confidence: 86 },
      { date: '2024-04-08', title: '半固态电池车型进入交付，能量密度与安全指标获得实车验证', org: '上汽集团', url: 'https://www.saicmotor.com/', source: 'company', layers: ['reality', 'capital'], strength: 'E3', confidence: 84 },
      { date: '2025-01-15', title: '头部电池厂披露全固态中试线进度与小批量交付目标', org: '宁德时代', url: 'https://www.catl.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2025-04-22', title: '海外电池厂公布全固态试产线建设与客户验证安排', org: 'Samsung SDI', url: 'https://www.samsungsdi.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 78 },
    ],
    branches: {
      provisional_ssb_semi_solid_mass_production: [
        { date: '2023-12-17', title: '半固态电池包完成整车装车与长续航实测', org: 'NIO', url: 'https://www.nio.com/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 82 },
        { date: '2024-04-08', title: '半固态电池版本车型进入常规交付并公布选装价格', org: '上汽集团', url: 'https://www.saicmotor.com/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 82 },
      ],
      provisional_ssb_sulfide_electrolyte: [
        { date: '2024-06-11', title: '硫化物电解质合成与界面稳定性取得中试级进展', org: 'Nature Energy', url: 'https://www.nature.com/nenergy/', source: 'academic', layers: ['reality'], strength: 'E2', confidence: 76 },
        { date: '2025-03-05', title: '硫化物路线成为全固态主流技术共识，氧化物路线转向半固态', org: '中国汽车动力电池产业创新联盟', url: 'http://www.evpower.org.cn/', source: 'academic', layers: ['perception'], strength: 'E2', confidence: 75 },
      ],
    },
  },
  {
    topic_id: 'provisional_autonomous_driving_robotaxi',
    expected_stage: 'S6',
    parent: [
      { date: '2023-08-10', title: '加州公用事业委员会批准旧金山全天候无人驾驶商业化载客', org: 'CPUC', url: 'https://www.cpuc.ca.gov/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 90 },
      { date: '2023-11-17', title: '四部门开展智能网联汽车准入和上路通行试点', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 92 },
      { date: '2024-05-15', title: '第六代无人车发布并公布整车成本与车队扩张计划', org: '百度', url: 'https://www.baidu.com/', source: 'company', layers: ['capital'], strength: 'E3', confidence: 86 },
      { date: '2025-01-14', title: '头部 Robotaxi 运营方披露每周付费出行规模与资费结构', org: 'Waymo', url: 'https://waymo.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E4', confidence: 90 },
      { date: '2025-06-24', title: '整车厂在单一城市启动限定区域 Robotaxi 试点运营', org: 'Tesla', url: 'https://www.tesla.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 78 },
    ],
    branches: {
      provisional_robotaxi_commercial_operation: [
        { date: '2024-07-10', title: '单城全无人运营车队规模与订单量引发运力与就业讨论', org: '百度', url: 'https://www.baidu.com/', source: 'company', layers: ['reality', 'perception'], strength: 'E3', confidence: 84 },
        { date: '2025-01-14', title: '付费无人出行服务扩展至更多城市并公布单均价格区间', org: 'Waymo', url: 'https://waymo.com/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 86 },
      ],
      provisional_autonomous_driving_l3_regulation: [
        { date: '2023-11-17', title: '智能网联汽车准入试点明确 L3 责任划分与安全要求', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 90 },
        { date: '2025-04-16', title: '组合驾驶辅助与自动驾驶宣传口径监管收紧', org: '工业和信息化部', url: 'https://www.miit.gov.cn/', source: 'official', layers: ['perception', 'friction'], strength: 'E3', confidence: 84 },
      ],
    },
  },
  {
    topic_id: 'provisional_nuclear_fusion_advanced_nuclear',
    // Capital and engineering milestones only; no parent-scope pricing adoption.
    expected_stage: 'S4',
    parent: [
      { date: '2022-12-13', title: '国家点火装置首次实现聚变净能量增益', org: 'LLNL', url: 'https://www.llnl.gov/', source: 'official', layers: ['reality'], strength: 'E4', confidence: 94 },
      { date: '2023-11-30', title: 'AI 数据中心电力需求把先进核能推上主流能源议程', org: 'IEA', url: 'https://www.iea.org/', source: 'academic', layers: ['perception'], strength: 'E3', confidence: 84 },
      { date: '2024-12-02', title: '聚变初创企业累计融资规模突破新量级，工程样机建设推进', org: 'Commonwealth Fusion Systems', url: 'https://cfs.energy/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2024-10-16', title: '云厂商与小型模块化反应堆开发方签署长期供电协议', org: 'Kairos Power', url: 'https://kairospower.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 86 },
      { date: '2025-05-08', title: '紧凑型聚变实验装置开工建设，工程验证进入下一阶段', org: '中核集团', url: 'https://www.cnnc.com.cn/', source: 'official', layers: ['reality', 'capital'], strength: 'E3', confidence: 85 },
    ],
    branches: {
      provisional_fusion_magnetic_confinement: [
        { date: '2025-01-20', title: '全超导托卡马克实现千秒量级高约束模式等离子体运行', org: '中科院等离子体物理研究所', url: 'http://www.ipp.cas.cn/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 86 },
        { date: '2024-07-03', title: '国际热核聚变实验堆更新基线进度与分阶段目标', org: 'ITER', url: 'https://www.iter.org/', source: 'official', layers: ['reality', 'friction'], strength: 'E2', confidence: 78 },
      ],
      provisional_small_modular_reactor: [
        { date: '2023-12-06', title: '高温气冷堆示范工程投入商业运行', org: '华能集团', url: 'https://www.chng.com.cn/', source: 'company', layers: ['reality'], strength: 'E3', confidence: 84 },
        { date: '2024-10-16', title: '科技公司购电协议为小型模块化反应堆提供首批长期需求', org: 'Kairos Power', url: 'https://kairospower.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 84 },
      ],
    },
  },
  {
    topic_id: 'provisional_spatial_computing_xr',
    // Mixed evidence: launches and pricing exist, but shipment data is negative
    // and layer coverage is thin. Data confidence caps the parent at S5.
    expected_stage: 'S5',
    parent: [
      { date: '2023-06-05', title: 'Apple 发布 Vision Pro 并将"空间计算"确立为品类命名', org: 'Apple', url: 'https://www.apple.com/', source: 'company', layers: ['perception', 'reality'], strength: 'E4', confidence: 70 },
      { date: '2024-02-02', title: 'Vision Pro 在美国上市，公布 3499 美元定价与配件体系', org: 'Apple', url: 'https://www.apple.com/', source: 'company', layers: ['pricing', 'reality'], strength: 'E4', confidence: 65 },
      { date: '2024-09-25', title: 'Meta 发布 Orion AR 原型机，行业资本重新投向光学与显示', org: 'Meta', url: 'https://about.meta.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E3', confidence: 60 },
      { date: '2024-11-27', title: '第三方数据显示高端头显出货低于预期，XR 整体出货量下滑', org: 'IDC', url: 'https://www.idc.com/', source: 'company', layers: ['friction', 'reality'], strength: 'E2', confidence: 50, polarity: 'negative' },
      { date: '2025-02-14', title: '智能眼镜销量翻倍成为 XR 品类中唯一确定的增量', org: 'EssilorLuxottica', url: 'https://www.essilorluxottica.com/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 58 },
    ],
    branches: {
      provisional_xr_ai_smart_glasses: [
        { date: '2023-09-27', title: '第二代智能眼镜以 299 美元价位进入主流零售渠道', org: 'Meta', url: 'https://about.meta.com/', source: 'company', layers: ['reality', 'pricing'], strength: 'E3', confidence: 80 },
        { date: '2025-03-20', title: '国内厂商密集发布 AI 眼镜，形成独立于头显的产品线', org: '小米', url: 'https://www.mi.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 75 },
      ],
      provisional_xr_spatial_content_ecosystem: [
        { date: '2024-02-02', title: '空间计算平台上线原生应用商店与开发者工具链', org: 'Apple', url: 'https://www.apple.com/', source: 'company', layers: ['reality'], strength: 'E2', confidence: 72 },
        { date: '2024-11-27', title: '原生内容供给不足成为头显留存率的主要摩擦点', org: 'IDC', url: 'https://www.idc.com/', source: 'company', layers: ['friction'], strength: 'E2', confidence: 60, polarity: 'negative' },
      ],
    },
  },
  {
    topic_id: 'provisional_synthetic_biology',
    // Scientific and policy validation with capital; no parent-scope pricing.
    expected_stage: 'S4',
    parent: [
      { date: '2023-07-11', title: '扩散模型驱动的从头蛋白设计进入可实验验证阶段', org: 'Nature', url: 'https://www.nature.com/', source: 'academic', layers: ['reality'], strength: 'E3', confidence: 84 },
      { date: '2024-05-08', title: 'AlphaFold 3 发布，预测范围扩展至蛋白-配体-核酸复合物', org: 'Google DeepMind', url: 'https://deepmind.google/', source: 'company', layers: ['reality', 'perception'], strength: 'E4', confidence: 90 },
      { date: '2024-10-09', title: '诺贝尔化学奖授予蛋白质结构预测与从头设计工作', org: 'Nobel Prize', url: 'https://www.nobelprize.org/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 94 },
      { date: '2025-03-05', title: '生物制造被列入新兴产业培育方向，形成产业政策抓手', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['perception', 'capital'], strength: 'E4', confidence: 90 },
      { date: '2025-05-21', title: '合成生物学企业披露产能利用率与订单结构，商业化仍待验证', org: 'Ginkgo Bioworks', url: 'https://www.ginkgobioworks.com/', source: 'company', layers: ['capital', 'reality'], strength: 'E2', confidence: 76 },
    ],
    branches: {
      provisional_synbio_ai_protein_design: [
        { date: '2024-05-08', title: '结构预测模型成为蛋白工程的默认起点', org: 'Google DeepMind', url: 'https://deepmind.google/', source: 'company', layers: ['reality'], strength: 'E4', confidence: 88 },
        { date: '2024-10-09', title: '从头蛋白设计获得最高学术认可，方向命名趋于稳定', org: 'Nobel Prize', url: 'https://www.nobelprize.org/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 90 },
      ],
      provisional_synbio_biomanufacturing: [
        { date: '2025-03-05', title: '生物制造进入国家级产业培育目录', org: '国务院', url: 'https://www.gov.cn/', source: 'official', layers: ['perception'], strength: 'E4', confidence: 88 },
        { date: '2025-05-21', title: '生物基材料产能落地，但单位成本仍高于石化路线', org: '凯赛生物', url: 'https://www.cathaybiotech.com/', source: 'company', layers: ['reality', 'capital'], strength: 'E2', confidence: 76, polarity: 'negative' },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Node construction
// ---------------------------------------------------------------------------

function buildNode(topicId: string, branchId: string | null, event: BackfillEvent): EvidenceNode {
  const fingerprint = createHash('sha256')
    .update(`${topicId}|${branchId ?? 'parent'}|${event.date}|${event.title}`)
    .digest('hex')
    .slice(0, 8);
  return {
    evidence_id: `ev_bf_${topicId}_${event.date.replaceAll('-', '')}_${fingerprint}`,
    topic_id: topicId,
    branch_id: branchId,
    parent_or_branch: branchId ? 'branch' : 'parent',
    event_date: event.date,
    available_at: `${event.date}T00:00:00.000Z`,
    event_title: event.title,
    event_type: 'historical_backfill',
    source_name: event.source,
    source_url: event.url,
    evidence_strength: event.strength,
    affected_layer: event.layers,
    stage_effect: branchId ? 'split_branch' : 'fills_gap',
    confidence: event.confidence,
    positive_or_negative: event.polarity ?? 'positive',
    interpretation: `${event.org}：${event.title}`,
    limitation: BACKFILL_LIMITATION,
    schema_version: BACKFILL_SCHEMA_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const topicFilterIndex = args.indexOf('--topic');
const topicFilter = topicFilterIndex >= 0 ? args[topicFilterIndex + 1] : null;

const evidencePath = resolve(repoRoot, 'data/evidence_table/evidence_table.json');
const evidenceTable: EvidenceNode[] = JSON.parse(readFileSync(evidencePath, 'utf8'));
const byId = new Map(evidenceTable.map((item) => [item.evidence_id, item]));

// Stage assertions must see what the operational pipeline sees: the JSON table
// plus audited manual and published automated evidence. Writes still target the
// JSON table only.
const existing = new FileAutonomousResearchRepository(repoRoot).readOperationalEvidence();

const selected = topicFilter ? DATASET.filter((entry) => entry.topic_id === topicFilter) : DATASET;
if (!selected.length) {
  console.error(topicFilter ? `No dataset entry for topic ${topicFilter}` : 'Dataset is empty');
  process.exit(1);
}

const generated: EvidenceNode[] = [];
const problems: string[] = [];

for (const entry of selected) {
  const events: Array<{ branchId: string | null; event: BackfillEvent }> = [
    ...entry.parent.map((event) => ({ branchId: null, event })),
    ...Object.entries(entry.branches ?? {}).flatMap(([branchId, list]) =>
      list.map((event) => ({ branchId, event })),
    ),
  ];

  for (const { branchId, event } of events) {
    if (event.date > KNOWLEDGE_CUTOFF) {
      problems.push(`${entry.topic_id}: event dated ${event.date} exceeds knowledge cutoff ${KNOWLEDGE_CUTOFF} — "${event.title}"`);
      continue;
    }
    const node = buildNode(entry.topic_id, branchId, event);
    const errors = validateEvidenceNode(node);
    if (errors.length) {
      problems.push(`${node.evidence_id}: ${errors.join(', ')}`);
      continue;
    }
    generated.push(node);
  }
}

if (problems.length) {
  console.error('Backfill rejected:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

// Stage assertion: classify each touched topic on the union of existing and
// generated parent evidence, and require the deterministic gate to land on the
// declared stage. This is what stops a backfill from silently lifting a
// narrative past its evidence.
const mergedTable = new Map(byId);
for (const node of generated) mergedTable.set(node.evidence_id, node);
const mergedTableRows = [...mergedTable.values()];

const mergedOperational = new Map(existing.map((item) => [item.evidence_id, item]));
for (const node of generated) mergedOperational.set(node.evidence_id, node);
const mergedRows = [...mergedOperational.values()];

const stageReport: Array<{ topic: string; before: string; after: string; expected: Stage; ok: boolean }> = [];
for (const entry of selected) {
  const scopeOf = (rows: EvidenceNode[]) =>
    rows.filter((item) => item.topic_id === entry.topic_id && (item.parent_or_branch === 'parent' || !item.branch_id));
  const beforeRows = scopeOf(existing);
  const afterRows = scopeOf(mergedRows);
  const before = beforeRows.length
    ? classifyStage({ evidence: beforeRows, scope: 'parent', dataConfidence: averageConfidence(beforeRows) }).current_stage
    : 'S0';
  const after = classifyStage({ evidence: afterRows, scope: 'parent', dataConfidence: averageConfidence(afterRows) }).current_stage;
  stageReport.push({ topic: entry.topic_id, before, after, expected: entry.expected_stage, ok: after === entry.expected_stage });
}

console.log('topic'.padEnd(52), 'before', 'after', 'expected');
for (const row of stageReport) {
  const marker = row.ok ? ' ' : '✗';
  const drift = row.before !== row.after && stageRank[row.after as Stage] > stageRank[row.before as Stage] ? ' ↑' : '';
  console.log(`${marker} ${row.topic.padEnd(50)} ${row.before.padEnd(6)} ${row.after.padEnd(5)} ${row.expected}${drift}`);
}

const mismatches = stageReport.filter((row) => !row.ok);
if (mismatches.length) {
  console.error(`\n${mismatches.length} topic(s) did not land on the declared stage. Adjust the dataset layers/confidence or the declared expectation, then rerun.`);
  process.exit(1);
}

const added = generated.filter((node) => !byId.has(node.evidence_id));
console.log(`\ngenerated=${generated.length} new=${added.length} existing_unchanged=${generated.length - added.length}`);

if (dryRun) {
  console.log('--dry-run: no files written.');
  process.exit(0);
}

writeFileSync(evidencePath, `${JSON.stringify(mergedTableRows, null, 2)}\n`);

const auditPath = resolve(repoRoot, 'data/audit/historical_backfill_admission.jsonl');
mkdirSync(resolve(repoRoot, 'data/audit'), { recursive: true });
if (added.length) {
  appendFileSync(
    auditPath,
    `${JSON.stringify({
      admission_id: `historical_backfill_${new Date().toISOString().replaceAll(/[:.]/g, '')}`,
      admitted_at: new Date().toISOString(),
      admission_type: 'historical_backfill',
      source_file: 'scripts/batch_historical_backfill.ts',
      evidence_ids: added.map((node) => node.evidence_id),
      knowledge_cutoff: KNOWLEDGE_CUTOFF,
      verification_status: 'unverified_operator_recall',
      stage_assertions: stageReport,
      reason: 'Operator-curated historical baseline so monitored topics have a usable timeline. Stage classification remains with the deterministic pipeline; rows are marked for later source verification.',
    })}\n`,
    'utf8',
  );
}

console.log(`wrote ${evidencePath}`);
console.log(existsSync(auditPath) ? `appended ${auditPath}` : 'no audit rows appended');
console.log('\nNext: npm run autonomy:run -- --no-publish && npx tsx src/cli/run_evolution_timeline.ts');

function averageConfidence(rows: EvidenceNode[]): number {
  const values = rows.map((item) => item.confidence).filter((item): item is number => typeof item === 'number');
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 45;
}
