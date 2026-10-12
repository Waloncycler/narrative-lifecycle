import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runHeadlessDocumentIntake } from '../run_headless_document_intake';
import { createProductCoreUseCases } from '@/platform/io/app_di_container';
import { createInteractiveIntakeServer } from '@/features/intake/ui/interactive_intake_server';
import { parseIntakePrepareArgs } from '@/features/intake/ui/intake_args';

function parseValue(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}

export async function executeIntakeCommand(subAction?: string, args: string[] = []) {
  const root = process.cwd();
  const core = createProductCoreUseCases(root);

  // 1. If target is a file path or directory or 'auto', run headless document intake directly
  const target = subAction || 'data/documents';
  const targetFullPath = resolve(root, target);

  if (target === 'auto' || (existsSync(targetFullPath) && target !== 'workbench' && target !== 'ui')) {
    console.log(`🚀 执行无感材料解析: [${target}]`);
    return await runHeadlessDocumentIntake(target === 'auto' ? 'data/documents' : target);
  }

  switch ((subAction || '').toLowerCase()) {
    case 'workbench':
    case 'ui': {
      const port = Number(parseValue(args, '--port') ?? process.env.PORT ?? 4177);
      const host = parseValue(args, '--host') ?? process.env.HOST ?? '127.0.0.1';
      const server = createInteractiveIntakeServer(root, core);

      core.researchAgentScheduler.start();
      console.log(
        `Research agent scheduler: enabled=${core.researchAgentRepository.readSchedulerConfig().enabled} next_daily=${core.researchAgentScheduler.nextDailyRun() ?? 'disabled'}`
      );

      server.listen(port, host, () => {
        console.log(`\n================================================================`);
        console.log(`🌐 叙事生命周期交互大盘 (Workbench UI) 已启动:`);
        console.log(`   👉 http://${host}:${port}`);
        console.log(`================================================================\n`);
      });
      return 0;
    }

    case 'prepare': {
      const prepareArgs = parseIntakePrepareArgs(args);
      const session = core.prepareEvidenceIntakeUseCase.execute(prepareArgs);
      console.log(
        JSON.stringify(
          {
            session_id: session.session_id,
            raw_document_id: session.raw_document.raw_document_id,
            chunk_count: session.chunks.length,
            candidate_count: session.candidates.length,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'apply': {
      const decisionsFile = parseValue(args, '--decisions') || 'data/intake/interactive_review_decisions.json';
      const result = core.applyEvidenceIntakeReviewUseCase.execute({ decisionsFile });
      console.log(
        JSON.stringify(
          {
            session_id: result.session_id,
            accepted_count: result.accepted_count,
            rejected_count: result.rejected_count,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'learn': {
      const cycle = core.buildIntakeLearningCycleUseCase.execute();
      console.log(
        JSON.stringify(
          {
            cycle_id: cycle.cycle_id,
            observed_candidates: cycle.observed_candidate_count,
            proposals_count: cycle.proposals.length,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'ai-shadow': {
      const report = await core.runAiShadowValidationUseCase.execute();
      console.log(
        JSON.stringify(
          {
            status: 'completed',
            session_id: report.session.session_id,
          },
          null,
          2
        )
      );
      return 0;
    }

    default:
      console.log(`🚀 执行默认无感材料解析: [data/documents]`);
      return await runHeadlessDocumentIntake('data/documents');
  }
}
