import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // .mts files use Node.js native test runner (node --test), not Vitest
      '**/*.test.mts',
      // e2e tests run via Playwright (npm run test:e2e), not Vitest
      'e2e/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
