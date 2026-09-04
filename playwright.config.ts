import { defineConfig } from '@playwright/test';

/**
 * E2E 冒烟测试配置（技术设计 §7.5 三层测试策略）
 * 对生产构建产物（vite preview）运行，运行前需先 `pnpm build`。
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    // 主链路复制断言需要剪贴板读写权限
    permissions: ['clipboard-read', 'clipboard-write'],
    // 本地优先使用系统 Chrome，避免下载 Playwright 托管浏览器；CI 使用托管 Chromium（见 ci.yml）
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
