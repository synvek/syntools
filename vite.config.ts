import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { prerenderPlugin } from './scripts/prerender';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), prerenderPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // 拆分首屏与重依赖；单 chunk 预算见 scripts/check-bundle-size.mjs
        // onlyExplicitManualChunks：避免把 mermaid 的传递依赖（cytoscape 等）并进同一 chunk，
        // 并配合下面把 vite preload-helper 钉在 vendor-react，防止首屏静态依赖 mermaid。
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (
            id.includes('vite/preload-helper') ||
            id.includes('vite/modulepreload-polyfill') ||
            id.includes('commonjsHelpers')
          ) {
            return 'vendor-react';
          }
          if (!id.includes('node_modules')) return;
          if (
            /[/\\]node_modules[/\\](react|react-dom|scheduler|react-router|react-router-dom)[/\\]/.test(
              id,
            )
          ) {
            return 'vendor-react';
          }
          if (/[/\\]node_modules[/\\](i18next|react-i18next)[/\\]/.test(id)) return 'vendor-i18n';
          if (/[/\\]node_modules[/\\]js-beautify[/\\]/.test(id)) return 'vendor-beautify';
          if (/[/\\]node_modules[/\\]csso[/\\]/.test(id)) return 'vendor-csso';
          if (/[/\\]node_modules[/\\]fast-xml-parser[/\\]/.test(id)) return 'vendor-fxp';
          if (/[/\\]node_modules[/\\]prismjs[/\\]/.test(id)) return 'vendor-prism';
          if (/[/\\]node_modules[/\\]chinese-conv[/\\]/.test(id)) return 'vendor-chinese-conv';
          if (/[/\\]node_modules[/\\]katex[/\\]/.test(id)) return 'vendor-katex';
          if (/[/\\]node_modules[/\\]ua-parser-js[/\\]/.test(id)) return 'vendor-ua-parser';
          if (/[/\\]node_modules[/\\]gifuct-js[/\\]/.test(id)) return 'vendor-gifuct';
          if (/[/\\]node_modules[/\\]pinyin-pro[/\\]/.test(id)) return 'vendor-pinyin';
          if (/[/\\]node_modules[/\\]mermaid[/\\]/.test(id)) return 'vendor-mermaid';
          if (/[/\\]node_modules[/\\]jspdf[/\\]/.test(id)) return 'vendor-jspdf';
          if (/[/\\]node_modules[/\\]lunar-javascript[/\\]/.test(id)) return 'vendor-lunar';
          if (/[/\\]node_modules[/\\]@cantoo[/\\]pdf-lib[/\\]/.test(id)) return 'vendor-pdf-lib';
          if (/[/\\]node_modules[/\\]pdfjs-dist[/\\]/.test(id)) return 'vendor-pdfjs';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // 启用 globals 以便 Testing Library 自动清理（afterEach cleanup）
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // e2e/ 下为 Playwright 冒烟用例，不属于单测
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
