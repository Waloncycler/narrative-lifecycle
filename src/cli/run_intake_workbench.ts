import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInteractiveIntakeServer } from '@/features/intake/ui/interactive_intake_server';
import { createProductCoreUseCases } from '@/platform/io/file_system_adapters';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.NARRATIVE_REPO_ROOT ?? resolve(here, '../..');
const port = Number(valueFor(process.argv.slice(2), '--port') ?? process.env.PORT ?? 4177);
const host = valueFor(process.argv.slice(2), '--host') ?? process.env.HOST ?? '127.0.0.1';
const useCases = createProductCoreUseCases(repoRoot);
const server = createInteractiveIntakeServer(repoRoot, useCases);

// Autonomous research agent daemon: embedded scheduler for daily + quick + deep loops.
useCases.researchAgentScheduler.start();
console.log(
  `Research agent scheduler: enabled=${useCases.researchAgentRepository.readSchedulerConfig().enabled} next_daily=${useCases.researchAgentScheduler.nextDailyRun() ?? 'disabled'} next_deep=${useCases.researchAgentScheduler.nextDeepRun() ?? 'disabled'}`,
);

server.listen(port, host, () => {
  console.log(`Interactive Evidence Intake Workbench: http://${host}:${port}`);
});

function valueFor(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((item) => item === key);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((item) => item.startsWith(`${key}=`));
  return inline?.slice(key.length + 1);
}
