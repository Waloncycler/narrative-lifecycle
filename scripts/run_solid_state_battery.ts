import { createProductCoreUseCases } from '../src/platform/io/app_di_container';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '..');
const useCases = createProductCoreUseCases(repoRoot);

async function run() {
  console.log("🚀 启动专属探针：目标 [固态电池] & [宁德时代]...");
  
  // Hook the registry to ONLY return solid state battery
  const originalReadUniverse = useCases.runResearchCampaignUseCase['deps'].readUniverse;
  useCases.runResearchCampaignUseCase['deps'].readUniverse = () => {
    const universe = originalReadUniverse();
    return {
      ...universe,
      nodes: universe.nodes.filter(n => n.node_id === 'solid_state_battery')
    };
  };

  const originalReadRegistry = useCases.runResearchCampaignUseCase['deps'].readRegistry;
  useCases.runResearchCampaignUseCase['deps'].readRegistry = () => {
    const reg = originalReadRegistry();
    return {
      ...reg,
      canonical_topics: reg.canonical_topics.filter(t => t.topic_id === 'solid_state_battery' || t.topic_name.includes('固态电池'))
    };
  };

  console.log("执行 Autonomous Research Loop...");
  const result = await useCases.runAutonomousResearchUseCase.execute({ publish: false });
  
  console.log("\n✅ 任务完成！");
  console.log(`- 跑批 ID: ${result.report.run_id}`);
  console.log(`- 获取候选线索数: ${result.report.held_count + result.report.published_count + result.report.rejected_count}`);
  console.log(`- 录入知识图谱: ${result.report.published_count} 条`);
}

run().catch(console.error);
