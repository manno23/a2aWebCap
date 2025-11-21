import { defineConfig } from 'vitest/config';
import path from 'node:path';

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
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@a2a/types': path.resolve(__dirname, './packages/types/src'),
      '@a2a/capnwebrpc': path.resolve(__dirname, './packages/capnwebrpc/src'),
      'cloudflare:capnweb': path.resolve(__dirname, './packages/capnwebrpc/tests/helpers/capnweb-shim.ts')
    }
  }
});
