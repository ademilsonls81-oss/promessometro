import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'tests/auto-fixer.test.ts', 'tests/risk-analyzer.test.ts', 'tests/validate-fase10-local.test.ts', 'tests/validate-fase9-local.test.ts'],
    testTimeout: 30000,
  },
});
