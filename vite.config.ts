import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { prerenderPlugin } from './scripts/prerender';

/** 应用版本号（来自 package.json，供 /download 等页面展示，避免手工同步） */
function resolveAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * 部署子路径（GitHub Pages 项目站为 /<repo>/）。
 * 默认 `/`（Vercel / Cloudflare / 本地 / Tauri）；Pages 构建时设置 BASE_PATH=/syntools/
 */
function resolveBase(): string {
  const raw = process.env.BASE_PATH?.trim() || '/';
  if (raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: resolveBase(),
  // Tauri 期望固定端口，且避免清屏打乱 Rust 编译日志
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
  plugins: [react(), prerenderPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // 9999：避开 5173（Vite 默认，易与其它本地项目冲突）
    port: 9999,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    // 多线程 ffmpeg.wasm（core-mt）需要 SharedArrayBuffer → cross-origin isolated。
    // 生产环境对应配置见 vercel.json / public/_headers。
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    rollupOptions: {
      // 限制 transform 并行度，降低大数据量依赖（univer/mermaid）时的内存峰值
      maxParallelFileOps: 2,
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
          // 代码编辑器：prettier 核心与 Java 插件（tree-sitter wasm）单独成 chunk，
          // 各语言插件随分组动态 import 自动成 chunk，避免任一 chunk 超过 500KB 预算
          if (/[/\\]node_modules[/\\]prettier[/\\](?!plugins[/\\])/.test(id))
            return 'vendor-prettier';
          if (/[/\\]node_modules[/\\]prettier-plugin-java[/\\]/.test(id)) {
            return 'vendor-prettier-java';
          }
          if (/[/\\]node_modules[/\\]web-tree-sitter[/\\]/.test(id)) return 'vendor-tree-sitter';
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
          // 富文本编辑器：tiptap + prosemirror 传递依赖必须独立于 mermaid / jspdf
          if (/[/\\]node_modules[/\\](@tiptap|prosemirror-[^/\\]+)[/\\]/.test(id)) {
            return 'vendor-tiptap';
          }
          if (/[/\\]node_modules[/\\]docx[/\\]/.test(id)) return 'vendor-docx';
          if (/[/\\]node_modules[/\\]mammoth[/\\]/.test(id)) return 'vendor-mammoth';
          // 电子表格（Univer）**不要**指定 manualChunks：@univerjs/* 之间存在循环依赖，
          // 任何人为切分都会破坏初始化顺序，生产构建下表现为工具整体无法加载：
          //   - 拆成多个 @univerjs-* chunk → “Cannot access 'k0' before initialization”（TDZ）；
          //   - 合并成一个 vendor-univer → 插件注册时读取 undefined 的类型（registerSubtype）。
          // 交给 Rollup 按动态入口自然分块（随 SpreadsheetTool 一起）才能保证 live binding 顺序；
          // dev 态走浏览器原生 ESM，不受影响。体积预算见 scripts/check-bundle-size.mjs。
          if (/[/\\]node_modules[/\\]konva[/\\]/.test(id)) return 'vendor-konva';
          if (/[/\\]node_modules[/\\]exceljs[/\\]/.test(id)) return 'vendor-exceljs';
          // 图表：ECharts 按需引入，独立 chunk（只在打开图表面板时加载）
          if (/[/\\]node_modules[/\\](echarts|zrender)[/\\]/.test(id)) return 'vendor-echarts';
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
