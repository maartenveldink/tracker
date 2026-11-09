import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts (no PWA/React plugins): unit tests
// cover pure logic only and run in plain Node. E2E lives in e2e/ (Playwright).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
