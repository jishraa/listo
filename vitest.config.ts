import { defineConfig } from 'vitest/config'

// Isolated from vite.config (no PWA/react plugins needed) — the suite covers
// pure logic (duplicate detection) in a node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
