import type { Options, Plugin } from 'prettier';
import { format as formatSql } from 'sql-formatter';
import type { ToolResult } from '@/core/types';
import type { LangSpec, PrettierGroup } from './core';
import { formatFallback, type FallbackOptions } from './fallback';

/**
 * 格式化调度：按语言选择引擎，全部按需动态 import。
 *
 * 分组而非一次性加载的原因：prettier standalone + 全部插件 gzip 合计约 1.07MB，
 * 直接打进一个 chunk 会突破 `pnpm size` 的单 chunk 500KB 预算；
 * 按 `js / ts / doc / java` 分组后每组仅加载所需插件，且结果用 Promise 缓存，
 * 重复格式化不再产生额外下载。
 *
 * 语言引擎对照：
 * - `prettier`：JavaScript / TypeScript / JSX / TSX / JSON / HTML / CSS / SCSS / Markdown / YAML / **Java**（prettier-plugin-java）
 * - `sql`：复用仓库已有的 sql-formatter
 * - `fallback`：Rust / Go / C / C++ / C# / Python / Kotlin / Swift … 走内置轻量格式化器
 *   （prettier v3 生态无维护中的对应插件；唯一的 Rust 插件仍停留在 prettier@2）
 */

export type IndentOption = 2 | 4 | 'tab';
export type FormatEngine = 'prettier' | 'sql' | 'fallback';

export interface FormatOutcome {
  code: string;
  engine: FormatEngine;
}

interface PrettierBundle {
  format: (code: string, options: Options) => Promise<string>;
}

interface GroupBundle {
  format: PrettierBundle['format'];
  plugins: Plugin[];
}

async function loadJs(): Promise<GroupBundle> {
  const [standalone, babel, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);
  return {
    format: standalone.format as PrettierBundle['format'],
    plugins: [babel.default as unknown as Plugin, estree.default as unknown as Plugin],
  };
}

async function loadTs(): Promise<GroupBundle> {
  const [standalone, typescript, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/typescript'),
    import('prettier/plugins/estree'),
  ]);
  return {
    format: standalone.format as PrettierBundle['format'],
    plugins: [typescript.default as unknown as Plugin, estree.default as unknown as Plugin],
  };
}

async function loadDoc(): Promise<GroupBundle> {
  const [standalone, html, postcss, markdown, yaml] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/html'),
    import('prettier/plugins/postcss'),
    import('prettier/plugins/markdown'),
    import('prettier/plugins/yaml'),
  ]);
  return {
    format: standalone.format as PrettierBundle['format'],
    plugins: [
      html.default as unknown as Plugin,
      postcss.default as unknown as Plugin,
      markdown.default as unknown as Plugin,
      yaml.default as unknown as Plugin,
    ],
  };
}

/** Java：官方 prettier 插件（内部用 web-tree-sitter 加载 447KB 的 java wasm 语法） */
async function loadJava(): Promise<GroupBundle> {
  const [standalone, java] = await Promise.all([
    import('prettier/standalone'),
    import('prettier-plugin-java'),
  ]);
  return {
    format: standalone.format as PrettierBundle['format'],
    plugins: [java.default as unknown as Plugin],
  };
}

const GROUP_LOADERS: Record<PrettierGroup, () => Promise<GroupBundle>> = {
  js: loadJs,
  ts: loadTs,
  doc: loadDoc,
  java: loadJava,
};

const bundleCache = new Map<PrettierGroup, Promise<GroupBundle>>();

function loadGroup(group: PrettierGroup): Promise<GroupBundle> {
  const cached = bundleCache.get(group);
  if (cached) return cached;
  const pending = GROUP_LOADERS[group]();
  bundleCache.set(group, pending);
  // 加载失败不缓存，便于网络恢复后重试
  pending.catch(() => bundleCache.delete(group));
  return pending;
}

function indentUnitOf(indent: IndentOption): string {
  return indent === 'tab' ? '\t' : ' '.repeat(indent);
}

function fallbackOptionsOf(spec: LangSpec, indent: IndentOption): FallbackOptions {
  return {
    indentUnit: indentUnitOf(indent),
    mode: spec.fallbackMode ?? 'brackets',
    hashComment: spec.hashComment ?? false,
    dashComment: spec.dashComment ?? false,
  };
}

/**
 * 按语言格式化代码。
 * - 纯文本语言返回 UNSUPPORTED（无可格式化规则）
 * - prettier 引擎失败（含 Java wasm 加载失败）自动回退内置格式化器，仍失败才返回 FORMAT_FAILED
 */
export async function formatCode(
  code: string,
  spec: LangSpec,
  indent: IndentOption,
): Promise<ToolResult<FormatOutcome>> {
  if (!code.trim()) return { ok: false, error: 'EMPTY' };
  if (spec.format === 'none') return { ok: false, error: 'UNSUPPORTED' };

  if (spec.format === 'sql') {
    try {
      const value = formatSql(code, {
        language: 'sql',
        tabWidth: indent === 'tab' ? 2 : indent,
        useTabs: indent === 'tab',
        keywordCase: 'upper',
      });
      return { ok: true, value: { code: value, engine: 'sql' } };
    } catch {
      // 语法不合法时回退内置整理
    }
  }

  if (spec.format === 'prettier' && spec.parser && spec.prettierGroup) {
    try {
      const bundle = await loadGroup(spec.prettierGroup);
      const value = await bundle.format(code, {
        parser: spec.parser,
        plugins: bundle.plugins,
        tabWidth: indent === 'tab' ? 2 : indent,
        useTabs: indent === 'tab',
        printWidth: 100,
      });
      return { ok: true, value: { code: value, engine: 'prettier' } };
    } catch {
      // 落到下方内置格式化器
    }
  }

  const fallback = formatFallback(code, fallbackOptionsOf(spec, indent));
  if (!fallback.ok) {
    return { ok: false, error: fallback.error, params: fallback.params };
  }
  return { ok: true, value: { code: fallback.value, engine: 'fallback' } };
}

/** 该语言是否由 prettier 真格式化（UI 用于提示「已回退内置格式化」） */
export function isPrettierLanguage(spec: LangSpec): boolean {
  return spec.format === 'prettier';
}
