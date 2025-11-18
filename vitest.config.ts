import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'packages/**/tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'examples'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.spec.ts',
        'packages/*/dist/**',
        'examples/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    // Standard Node.js environment for tests
    // Workers-specific functionality is mocked in tests
  },
  resolve: {
    alias: {
      '@a2a-webcap/shared': path.resolve(__dirname, './packages/shared/src'),
      '@a2a-webcap/server': path.resolve(__dirname, './packages/server/src'),
      '@a2a-webcap/client': path.resolve(__dirname, './packages/client/src')
    },
    conditions: ['worker', 'import']
  },
  esbuild: {
    target: 'es2022',
    format: 'esm'
  }
});
