import { createProductCoreUseCases } from './src/platform/io/app_di_container';
const useCases = createProductCoreUseCases(process.cwd());
console.log("Starting execute...");
useCases.researchAgentLoopUseCase.execute({ loop_kind: 'deep', deep_max_rounds: 1, deep_queries_per_round: 1 }).then((res) => {
  console.log("Execute finished.");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
