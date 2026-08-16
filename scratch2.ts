import { readFileSync, writeFileSync } from 'fs';
const path = 'src/app/use_cases/research_agent_loop_use_case.ts';
let code = readFileSync(path, 'utf8');
code = code.replace("const result = await fn();", "console.log('Running phase:', phase); const result = await fn(); console.log('Finished phase:', phase);");
writeFileSync(path, code);
