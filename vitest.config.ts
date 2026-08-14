import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/test_*.ts'],
    // CLI/integration tests intentionally exercise the shared SQLite artifact
    // store. Running those files concurrently can interleave pipeline run ids
    // and manufacture a diff failure that cannot occur in one operator run.
    fileParallelism: false,
  },
});
