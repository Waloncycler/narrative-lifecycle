import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createProductCoreUseCases } from '../src/platform/io/app_di_container';

const PORT = 3000;

const { researchLeadTriageRepository } = createProductCoreUseCases(process.cwd());
const htmlContent = readFileSync(join(process.cwd(), 'scripts', 'triage_viewer.html'), 'utf8');

const server = createServer((req, res) => {
  if (req.url === '/api/report') {
    const report = researchLeadTriageRepository.readLatestReport();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(report));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(htmlContent);
});

server.listen(PORT, () => {
  console.log(`Triage Viewer running at http://localhost:${PORT}/`);
});
