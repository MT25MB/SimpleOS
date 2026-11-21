import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests run against the same React/TS setup as the app, in jsdom so components
// and hooks can be exercised without a real browser.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
})
