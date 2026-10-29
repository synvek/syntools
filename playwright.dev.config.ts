import { defineConfig } from '@playwright/test';

/** Temporary dev-server config (default config needs a fresh `dist`); delete after the run. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['clipboard-read', 'clipboard-write'],
    channel: 'chrome',
  },
  webServer: {
    command: 'pnpm dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
