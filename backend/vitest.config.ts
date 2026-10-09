import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/types.ts', 'src/generated/**'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Aggregate floors. The two entries below keep the existing per-file 100% bar.
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
        'src/features/todos/validators.ts': {
          statements: 100, branches: 100, functions: 100, lines: 100,
        },
        'src/features/todos/mappers.ts': {
          statements: 100, branches: 100, functions: 100, lines: 100,
        },
      },
    },
  },
});
