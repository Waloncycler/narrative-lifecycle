import type { BranchRecord, CanonicalTopicRecord, MarketNameSource } from '@/types/topic_resolution';

/**
 * The registry identifier is never a display-name generator. A new node with
 * no validated market name stays visibly unverified until a researcher or a
 * governed naming workflow supplies source-backed terminology.
 */
export function marketTopicName(topic: CanonicalTopicRecord): string {
  return topic.market_name_zh?.trim() || topic.topic_name;
}

export function marketBranchName(branch: BranchRecord): string {
  const name = branch.market_name_zh?.trim() || branch.branch_name.trim();
  if (branch.naming_status === 'unresolved' || !isUsableBranchName(name)) return '待命名细分方向';
  return branch.naming_status === 'provisional' ? `${name}（待核验）` : name;
}

/** Prevent opaque ids, copied prose, and prompt debris from masquerading as a
 * market-recognized branch name. The original registry record remains intact
 * for audit and can later be corrected with a cited market name. */
export function isUsableBranchName(value: string): boolean {
  const name = value.trim();
  if (name.length < 2 || name.length > 48) return false;
  if (/^(?:branch\s+[a-z0-9]+|nct\d+|[a-z]{2,8}\d{2,8}|unknown|unresolved|待命名细分方向)$/iu.test(name)) return false;
  return !/(?:对话窗口|研究发布方案|持续扩张需求|轻量化制造|multi-level tree|fine-grained diagnostic|deploying infrastructure|(?:a股|股价|价格|market)表现)/iu.test(name);
}

export function hasVerifiedMarketName(node: {
  naming_status?: string;
  market_name_zh?: string;
  branch_name?: string;
  topic_name?: string;
  naming_sources?: MarketNameSource[];
}): boolean {
  if (node.naming_status === 'verified') return true;
  const name = node.market_name_zh?.trim() || node.branch_name?.trim() || node.topic_name?.trim() || '';
  if (!name || !isUsableBranchName(name)) return false;
  return node.naming_status !== 'unresolved';
}

export function marketNameWarning(node: {
  naming_status?: string;
  market_name_zh?: string;
  naming_sources?: MarketNameSource[];
}): string | null {
  if (hasVerifiedMarketName(node)) return null;
  return '市场中文名称尚未通过来源核验；不得将内部生成的名称当作市场共识。';
}
