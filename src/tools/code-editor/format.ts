import type { Options, Plugin } from 'prettier';
import { format as formatSql } from 'sql-formatter';
import type { ToolResult } from '@/core/types';
import type { LangSpec, PrettierGroup } from './core';
import { formatFallback, type FallbackOptions } from './fallback';

/**
 * Format dispatch: pick an engine per language, everything imported lazily on demand.
 *
 * Why grouping instead of one bundle: prettier standalone plus every plugin is ~1.07MB gzipped,
 * which would blow the 500KB per-chunk budget enforced by `pnpm size`. Splitting into
 * `js / ts / doc / java` groups loads only the needed plugins, and results are cached as
 * Promises so repeated formatting triggers no extra download.
 *
 * Language → engine:
 * - `prettier`: JavaScript / TypeScript / JSX / TSX / JSON / HTML / CSS / SCSS / Markdown / YAML / **Java** (prettier-plugin-java)
 * - `sql`: reuses the repo's existing sql-formatter
 * - `fallback`: Rust / Go / C / C++ / C# / Python / Kotlin / Swift … use the built-in formatter
 *   (prettier v3 has no maintained plugins for them; the only Rust plugin is still on prettier@2)
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

/** Java: the official prettier plugin (loads a 447KB Java wasm grammar via web-tree-sitter) */
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
  // Do not cache failures so a retry can succeed once the network recovers
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
    // Derived from the shared line comment marker (see COMMENT_SPECS in core.ts) to keep one source
    hashComment: spec.lineComment === '#',
    dashComment: spec.lineComment === '--',
  };
}

/**
 * Format code for a language.
 * - Plain-text languages return UNSUPPORTED (there are no formatting rules)
 * - A prettier failure (including the Java wasm load) falls back to the built-in formatter;
 *   only if that also fails is FORMAT_FAILED returned
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
      // Fall back to the built-in tidy-up when the syntax is invalid
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
      // Fall through to the built-in formatter below
    }
  }

  const fallback = formatFallback(code, fallbackOptionsOf(spec, indent));
  if (!fallback.ok) {
    return { ok: false, error: fallback.error, params: fallback.params };
  }
  return { ok: true, value: { code: fallback.value, engine: 'fallback' } };
}

/** Whether the language is truly formatted by prettier (the UI uses this to say it fell back) */
export function isPrettierLanguage(spec: LangSpec): boolean {
  return spec.format === 'prettier';
}
