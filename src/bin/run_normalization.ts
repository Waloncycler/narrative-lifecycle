import { createProductCoreUseCases } from '@/platform/io/app_di_container';

async function run() {
  console.log('Initializing DI Container...');
  const repoRoot = process.cwd();
  const container = createProductCoreUseCases(repoRoot);
  console.log('Starting Data Normalization & Canonical Event Deduplication...');

  const result = await container.normalizeWorldMonitorDataUseCase.execute(50);
  
  console.log('==================================');
  console.log(`Normalization Complete!`);
  console.log(`Processed (Upserted/Linked): ${result.processed}`);
  console.log(`Failed (Or empty): ${result.failed}`);
  console.log('==================================');
}

run().catch((err) => {
  console.error('Fatal error during normalization:', err);
  process.exit(1);
});
