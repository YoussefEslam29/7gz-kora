import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Each test file starts its own in-memory Postgres, which takes a moment.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
