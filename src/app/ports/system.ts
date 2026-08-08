export interface Clock {
  now(): Date;
}

export interface CommandRunner {
  run(command: string, args: string[], env: Record<string, string>): { status: number | null; stdout: string; stderr: string };
}

export interface SchemaValidator {
  validate(schemaFile: string, value: unknown): void;
}
