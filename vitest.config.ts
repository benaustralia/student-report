import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['netlify/functions/**/*.test.ts'], environment: 'node' },
});
