import { defineConfig } from 'vitest/config';
import path from 'node:path';
const __dirname = import.meta.dirname;

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'test/server-only-stub.ts') } },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://mescid:mescid@localhost:5432/mescid_test' },
  },
});
