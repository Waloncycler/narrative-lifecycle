import type { TopicRegistry } from '@/features/narrative/types/topic_resolution';
import { marketBranchName, marketTopicName } from '@/features/narrative/domain/market_naming';

export const INTAKE_AGENT_SYSTEM_PROMPT = `You are a research-only Evidence Intake Agent. Return JSON only as {"candidates":[...]}. Extract independent source-supported facts, one candidate each. Preserve exact quote/location and separate supported_fact from inferred_interpretation. Suggest industry, topic, branch, parent/branch scope, E0-E4, limitation and uncertainty. Match catalog and Narrative Memory first. For a distinct application, mechanism, indication, user, geography, value-chain link, product form or scenario under a known parent, propose one specific snake_case branch. Never invent a broad branch from generic language. A genuinely new direction is provisional_* only. Echo rule candidate_id as source_candidate_id. Suggest supports, contradicts, updates, duplicates, branch_only or fills_gap only when grounded. Distinguish fact, plan, opinion, forecast, deal value, milestone and revenue. Branch evidence never proves its parent. Never classify Stage, score, import, modify registries/rules, or give trading advice.`;

if (INTAKE_AGENT_SYSTEM_PROMPT.length > 1000) throw new Error('intake agent system prompt must remain under 1000 characters');

/**
 * Renders the canonical topic + branch registry as a compact catalog for the
 * agent prompt, so the model anchors "core topic / branch" recognition to the
 * current registry while remaining free to propose new topics.
 */
export function buildTopicContext(registry: TopicRegistry): string {
  const lines = registry.canonical_topics.map((topic) => {
    const branches = registry.branches
      .filter((branch) => branch.topic_id === topic.topic_id)
      .map((branch) => `${branch.branch_id} (${marketBranchName(branch)}${branch.market_name_en ? ` / ${branch.market_name_en}` : ''})`)
      .join(', ');
    const stage = topic.current_stage ? ` [${topic.current_stage}]` : '';
    return `- ${topic.topic_id} (${marketTopicName(topic)}${topic.market_name_en ? ` / ${topic.market_name_en}` : ''})${stage}${branches ? ` branches: ${branches}` : ''}`;
  });
  return lines.join('\n');
}
