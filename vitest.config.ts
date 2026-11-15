import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'], testTimeout: 30000, coverage: { provider: 'v8', include: ['packages/*/src/**/*.ts'], exclude: ['**/schemas.ts', '**/*.d.ts'], reporter: ['text', 'json-summary'] } } });
