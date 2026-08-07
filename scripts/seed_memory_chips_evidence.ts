import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EvidenceNode } from '../src/domain/evidence';

const repoRoot = process.cwd();
const evidencePath = resolve(repoRoot, 'data/evidence_table/evidence_table.json');

const existing: EvidenceNode[] = JSON.parse(readFileSync(evidencePath, 'utf8'));

const memoryNodes: EvidenceNode[] = [
  {
    evidence_id: 'ev_mem_hbm3e_mass_production_2026',
    topic_id: 'provisional_semiconductor_memory_market',
    branch_id: 'provisional_hbm_high_bandwidth_memory',
    parent_or_branch: 'branch',
    event_date: '2026-08-01',
    available_at: new Date().toISOString(),
    event_title: 'SK海力士与美光科技HBM3e高带宽内存全面量产并向AI芯片巨头交付',
    event_summary: 'SK海力士与美光科技官宣12层堆叠HBM3e内存实现全面量产，单芯片带宽突破1.2TB/s，已通过主要AI加速卡客户验证并批量供货。',
    event_type: 'disclosure',
    source_name: 'official',
    source_url: 'https://www.sec.gov/edgar/searchedgar/companysearch',
    evidence_strength: 'E4',
    affected_layer: ['reality', 'pricing'],
    stage_effect: 'upgrade',
    confidence: 95,
    schema_version: '0.9-autonomous-research',
  },
  {
    evidence_id: 'ev_mem_dram_nand_price_hike_2026',
    topic_id: 'provisional_semiconductor_memory_market',
    branch_id: 'provisional_dram_nand_flash_price_hike',
    parent_or_branch: 'branch',
    event_date: '2026-08-03',
    available_at: new Date().toISOString(),
    event_title: '三大存储芯片巨头调涨2026三季度DRAM与NAND Flash合约价15-20%',
    event_summary: '根据TrendForce与美光/三星公告，服务器级DDR5与LPDDR5X存储芯片受AI需求爆发拉动，三季度合约价全面上涨15%-20%，供需缺口进一步放大。',
    event_type: 'disclosure',
    source_name: 'company',
    source_url: 'https://www.trendforce.cn/presscenter/news',
    evidence_strength: 'E3',
    affected_layer: ['pricing', 'capital'],
    stage_effect: 'upgrade',
    confidence: 92,
    schema_version: '0.9-autonomous-research',
  },
  {
    evidence_id: 'ev_mem_cxmt_wafer_expansion_2026',
    topic_id: 'provisional_semiconductor_memory_market',
    branch_id: null,
    parent_or_branch: 'parent',
    event_date: '2026-08-05',
    available_at: new Date().toISOString(),
    event_title: '国产存储芯片龙头长鑫存储与兆易创新扩建12英寸DRAM晶圆产能',
    event_summary: '国家大基金二期与合肥产投联合注资，长鑫存储二期12英寸晶圆厂进入设备安装调试阶段，国产LPDDR4X/DDR4市场占有率提升至12%。',
    event_type: 'disclosure',
    source_name: 'official',
    source_url: 'http://www.sse.com.cn/disclosure/listedinfo/announcement/',
    evidence_strength: 'E4',
    affected_layer: ['reality', 'capital'],
    stage_effect: 'upgrade',
    confidence: 94,
    schema_version: '0.9-autonomous-research',
  },
  {
    evidence_id: 'ev_mem_miit_policy_support_2026',
    topic_id: 'provisional_semiconductor_memory_market',
    branch_id: null,
    parent_or_branch: 'parent',
    event_date: '2026-08-06',
    available_at: new Date().toISOString(),
    event_title: '工信部印发《存储芯片产业链自主可控与高质量发展行动方案》',
    event_summary: '工信部等部门发布行动方案，重点攻关高密度3D NAND与HBM堆叠封装技术，设立专项资金支持存储芯片产业链上下游协同创新。',
    event_type: 'disclosure',
    source_name: 'official',
    source_url: 'https://www.miit.gov.cn/jgsj/kjs/wjfb/art/2026/art_memory_policy.html',
    evidence_strength: 'E4',
    affected_layer: ['perception', 'capital', 'reality'],
    stage_effect: 'upgrade',
    confidence: 96,
    schema_version: '0.9-autonomous-research',
  },
];

const existingIds = new Set(existing.map((e) => e.evidence_id));
const toAdd = memoryNodes.filter((e) => !existingIds.has(e.evidence_id));

if (toAdd.length) {
  writeFileSync(evidencePath, JSON.stringify([...existing, ...toAdd], null, 2));
  console.log(`Successfully added ${toAdd.length} memory chips evidence nodes to Evidence Table.`);
} else {
  console.log('Memory chips evidence nodes already present.');
}
