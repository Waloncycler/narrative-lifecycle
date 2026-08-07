export function parseIntakePrepareArgs(argv: string[]): { file?: string; text?: string } {
  const file = valueFor(argv, '--file');
  const text = valueFor(argv, '--text');
  return {
    file: file ?? (text ? undefined : 'data/intake/examples/bci_branch_note.md'),
    text,
  };
}

export function parseIntakeApplyArgs(argv: string[]): { decisionsFile?: string } {
  return { decisionsFile: valueFor(argv, '--decisions') };
}

export function parseIntakeEvaluateArgs(argv: string[]): { decisionsFile?: string } {
  return { decisionsFile: valueFor(argv, '--decisions') };
}

function valueFor(argv: string[], key: string): string | undefined {
  const index = argv.findIndex((item) => item === key);
  if (index >= 0 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((item) => item.startsWith(`${key}=`));
  return inline?.slice(key.length + 1);
}
