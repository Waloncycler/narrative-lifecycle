import type { IndustryPack, IndustrySuggestion } from '@/features/reporting/types/industry';

export const DEFAULT_INDUSTRY_PACKS: IndustryPack[] = [
  { industry_id: 'medicine', display_name: 'Medicine and Biopharma', aliases: ['medicine', 'biopharma', 'pharma', 'drug', 'clinical', 'fda'], topic_hints: ['approval', 'clinical trial', 'revenue', 'license-out'], branch_hints: ['oncology', 'metabolic', 'immunology', 'neuroscience', 'nuclear medicine'], hard_evidence_hints: ['fda approval', 'clinical data', 'revenue', 'customer'], forbidden_inferences: ['headline deal value is realized revenue'] },
  { industry_id: 'semiconductor', display_name: 'Semiconductor', aliases: ['semiconductor', 'chip', 'foundry', 'wafer', 'fab'], topic_hints: ['tape-out', 'yield', 'capacity', 'node'], branch_hints: ['advanced node', 'memory', 'power semiconductor'], hard_evidence_hints: ['mass production', 'yield', 'customer qualification'], forbidden_inferences: ['design win is mass production'] },
  { industry_id: 'robotics', display_name: 'Robotics', aliases: ['robotics', 'robot', 'humanoid', 'automation'], topic_hints: ['delivery', 'deployment', 'utilization'], branch_hints: ['humanoid', 'industrial', 'medical rehabilitation'], hard_evidence_hints: ['customer acceptance', 'repeat deployment', 'multi-customer'], forbidden_inferences: ['prototype is commercial deployment'] },
  { industry_id: 'energy', display_name: 'Energy', aliases: ['energy', 'battery', 'solar', 'wind', 'storage'], topic_hints: ['grid connection', 'capacity', 'utilization', 'project approval'], branch_hints: ['battery', 'solar', 'wind', 'grid storage'], hard_evidence_hints: ['commercial operation', 'grid connection', 'long-term order'], forbidden_inferences: ['planned capacity is operating capacity'] },
  { industry_id: 'ai_software', display_name: 'AI and Software', aliases: ['ai', 'software', 'model', 'saas', 'cloud'], topic_hints: ['release', 'usage', 'retention', 'revenue'], branch_hints: ['foundation model', 'enterprise software', 'developer tools'], hard_evidence_hints: ['paid usage', 'retention', 'revenue', 'contract'], forbidden_inferences: ['announcement is user adoption'] },
  { industry_id: 'consumer', display_name: 'Consumer', aliases: ['consumer', 'retail', 'brand', 'food', 'beverage'], topic_hints: ['sales', 'distribution', 'repeat purchase'], branch_hints: ['food', 'beverage', 'beauty', 'retail'], hard_evidence_hints: ['sell-through', 'repeat purchase', 'same-store sales'], forbidden_inferences: ['launch is repeat demand'] },
];

export function suggestIndustry(text: string, packs: IndustryPack[] = DEFAULT_INDUSTRY_PACKS): IndustrySuggestion {
  const lower = text.toLowerCase();
  const matches = packs.filter((pack) => pack.aliases.some((alias) => lower.includes(alias.toLowerCase())));
  if (!matches.length) return { industry_id: null, status: 'unresolved', reason: 'No industry pack matched; operator must keep the candidate unresolved or provisional.', alternatives: packs.slice(0, 3).map((pack) => pack.industry_id) };
  if (matches.length > 1) return { industry_id: null, status: 'provisional', reason: 'Multiple industry packs matched; operator must confirm the industry.', alternatives: matches.map((pack) => pack.industry_id) };
  return { industry_id: matches[0].industry_id, status: 'matched', reason: `Matched industry pack ${matches[0].industry_id}.`, alternatives: [] };
}

export function compactIndustryContext(packs: IndustryPack[]): string {
  return packs.map((pack) => `${pack.industry_id}: aliases=${pack.aliases.join(',')}; topics=${pack.topic_hints.join(',')}; branches=${pack.branch_hints.join(',')}; hard=${pack.hard_evidence_hints.join(',')}; avoid=${pack.forbidden_inferences.join(',')}`).join('\n');
}
