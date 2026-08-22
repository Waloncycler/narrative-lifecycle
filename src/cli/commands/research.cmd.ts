import { createProductCoreUseCases } from '@/platform/io/app_di_container';

function parseValue(args: string[], key: string): string | undefined {
  const index = args.indexOf(key);
  return index >= 0 ? args[index + 1] : args.find((item) => item.startsWith(`${key}=`))?.slice(key.length + 1);
}

function parseValues(args: string[], key: string): string[] {
  return args.flatMap((item, index) =>
    item === key && args[index + 1] ? [args[index + 1]] : item.startsWith(`${key}=`) ? [item.slice(key.length + 1)] : []
  );
}

export async function executeResearchCommand(subAction: string = 'search', args: string[] = []) {
  const root = process.cwd();
  const core = createProductCoreUseCases(root);

  switch (subAction.toLowerCase()) {
    case 'search':
    case 'web': {
      const topicIds = parseValues(args, '--topic');
      const queries = parseValues(args, '--query');
      const limitStr = parseValue(args, '--limit');
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;
      const report = await core.runWebResearchUseCase.execute({
        topicIds: topicIds.length ? topicIds : undefined,
        queries: queries.length ? queries : undefined,
        limit,
      });
      console.log(
        JSON.stringify(
          {
            status: report.status,
            queries: report.queries.length,
            leads: report.lead_count,
            errors: report.errors,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'agent':
    case 'loop': {
      const manifest = await core.researchAgentLoopUseCase.execute({
        loop_kind: 'daily',
        triggered_by: 'cli',
      });
      console.log(
        JSON.stringify(
          {
            run_id: manifest.run_id,
            status: manifest.status,
            metrics: manifest.metrics,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'autonomous': {
      const result = core.runAutonomousResearchUseCase.execute({ publish: false });
      console.log(JSON.stringify({ status: result.manifest.status, run_id: result.manifest.run_id }, null, 2));
      return 0;
    }

    case 'campaign': {
      const maxTasksStr = parseValue(args, '--tasks');
      const maxTasks = maxTasksStr ? parseInt(maxTasksStr, 10) : undefined;
      const result = await core.runResearchCampaignUseCase.execute({ maxTasks });
      console.log(
        JSON.stringify(
          {
            campaign_id: result.campaign.campaign_id,
            leads: result.webResearch.lead_count,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'triage': {
      const triage = core.buildResearchLeadTriageUseCase.execute();
      console.log(
        JSON.stringify(
          {
            triage_id: triage.triage_id,
            triaged_lead_count: triage.triaged_lead_count,
            items_count: triage.items.length,
          },
          null,
          2
        )
      );
      return 0;
    }

    case 'retrieve': {
      const result = await core.retrieveResearchSourcesUseCase.execute();
      console.log(
        JSON.stringify(
          {
            retrieval_run_id: result.retrieval_run_id,
            retrieved_count: result.retrieved_count,
          },
          null,
          2
        )
      );
      return 0;
    }

    default:
      console.log(`🔍 未知 research 子命令: [${subAction}]。可选: search | agent | autonomous | campaign | triage | retrieve`);
      return 1;
  }
}
