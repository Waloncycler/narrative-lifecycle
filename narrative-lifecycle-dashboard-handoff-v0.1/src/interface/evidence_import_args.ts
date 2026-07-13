import { DEFAULT_EVIDENCE_IMPORT_FILE } from '../infrastructure/evidence_import_io';

export function parseEvidenceImportArgs(argv: string[]): { file: string } {
  const fileIndex = argv.findIndex((item) => item === '--file');
  if (fileIndex >= 0 && argv[fileIndex + 1]) return { file: argv[fileIndex + 1] };
  const inline = argv.find((item) => item.startsWith('--file='));
  if (inline) return { file: inline.slice('--file='.length) };
  return { file: DEFAULT_EVIDENCE_IMPORT_FILE };
}
