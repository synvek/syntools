import { defineConfig } from '@playwright/test';

/**
 * E2E smoke test config (technical design §7.5, three-layer test strategy)
 * Runs against the production build (vite preview); run `pnpm build` first.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    // The main-flow copy assertion needs clipboard read/write permission
    permissions: ['clipboard-read', 'clipboard-write'],
    // Prefer the system Chrome locally to avoid downloading Playwright's browser; CI uses the bundled Chromium (see ci.yml)
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
