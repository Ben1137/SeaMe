import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'dev-dist/',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
      ],
      include: ['src/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
      all: true,
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'dev-dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@seame/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
