import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { prerenderPlugin } from './scripts/prerender';

/** App version (from package.json, shown on /download and friends, so it is never synced by hand) */
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
 * Deployment sub-path (GitHub Pages project sites use /<repo>/).
 * Defaults to `/` (Vercel / Cloudflare / local / Tauri); the Pages build sets BASE_PATH=/syntools/
 */
function resolveBase(): string {
  const raw = process.env.BASE_PATH?.trim() || '/';
  if (raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`;
}

// https://vitejs.dev/config/
export default defineConfig({
  base: resolveBase(),
  // Tauri expects a fixed port; clearing the screen would also scramble Rust build logs
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
    // 9999: avoids 5173 (the Vite default, which often collides with other local projects)
    port: 9999,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  optimizeDeps: {
    // `prettier-plugin-java` locates its grammar with `new URL('./tree-sitter-java_orchard.wasm', import.meta.url)`.
    // Pre-bundling rewrites that `import.meta.url` to `node_modules/.vite/deps/`, so dev served the SPA
    // fallback (index.html) for the wasm request, the plugin threw "Incorrect response MIME type" and
    // `formatCode` silently fell back to the built-in formatter (Java formatting looked broken in dev only).
    // Serving the package as native ESM keeps the real file URL, so the asset resolves with application/wasm.
    exclude: ['prettier-plugin-java'],
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    rollupOptions: {
      // Limit transform parallelism to lower peak memory with large deps (univer/mermaid)
      maxParallelFileOps: 2,
      output: {
        // Split the entry screen from heavy deps; chunk budgets live in scripts/check-bundle-size.mjs
        // onlyExplicitManualChunks: keeps mermaid's transitive deps (cytoscape etc.) out of the same chunk,
        // and together with pinning vite's preload-helper to vendor-react keeps mermaid out of the entry graph.
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
          // Code editor: prettier core and the Java plugin (tree-sitter wasm) get their own chunks,
          // while language plugins form chunks via grouped dynamic imports, keeping each under 500KB
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
          // Rich text editor: tiptap + prosemirror transitive deps must stay separate from mermaid / jspdf
          if (/[/\\]node_modules[/\\](@tiptap|prosemirror-[^/\\]+)[/\\]/.test(id)) {
            return 'vendor-tiptap';
          }
          if (/[/\\]node_modules[/\\]docx[/\\]/.test(id)) return 'vendor-docx';
          if (/[/\\]node_modules[/\\]mammoth[/\\]/.test(id)) return 'vendor-mammoth';
          // Spreadsheet (Univer): do **not** assign manualChunks — @univerjs/* have circular deps,
          // and any manual split breaks initialization order; in production the tool then fails to load:
          //   - several @univerjs-* chunks → "Cannot access 'k0' before initialization" (TDZ);
          //   - one merged vendor-univer → plugin registration reads an undefined type (registerSubtype).
          // Let Rollup chunk it naturally around the dynamic entry (with SpreadsheetTool) to keep live bindings ordered;
          // dev uses native browser ESM and is unaffected. Size budgets: scripts/check-bundle-size.mjs.
          if (/[/\\]node_modules[/\\]konva[/\\]/.test(id)) return 'vendor-konva';
          if (/[/\\]node_modules[/\\]exceljs[/\\]/.test(id)) return 'vendor-exceljs';
          // Charts: ECharts is imported on demand into its own chunk (loaded only when the chart panel opens)
          if (/[/\\]node_modules[/\\](echarts|zrender)[/\\]/.test(id)) return 'vendor-echarts';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Enable globals so Testing Library auto-cleans (afterEach cleanup)
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // e2e/ holds Playwright smoke cases, not unit tests
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      include: ['src/**'],
    },
  },
});
