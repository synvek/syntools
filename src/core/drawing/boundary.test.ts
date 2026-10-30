import { describe, expect, it } from 'vitest';

/**
 * Kernel boundary gate (P2-6.4).
 *
 * The whole point of `core/drawing` is being reusable by editors that are not the slide editor
 * (rich-text shapes, spreadsheet shapes) and, one day, outside the browser. That only holds while
 * the kernel imports nothing from `tools/**` and nothing from Konva/DOM. A comment cannot enforce
 * that; this test reads the kernel sources and fails on the first violation.
 */

const sources = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Runtime imports only — `import type` is erased, so a type-only reference is harmless */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bfrom\s+'[^']*\btools\//, why: 'kernel must not import from src/tools/**' },
  { pattern: /\bfrom\s+'konva'/, why: 'kernel must stay free of Konva' },
  { pattern: /\bfrom\s+'react'/, why: 'kernel is UI-framework agnostic' },
  { pattern: /\bdocument\./, why: 'kernel must not touch the DOM' },
  { pattern: /\bwindow\./, why: 'kernel must not touch the DOM' },
  { pattern: /getContext\(/, why: 'kernel must not touch Canvas' },
];

const isTypeOnly = (line: string): boolean => /^\s*import\s+type\b/.test(line);

describe('core/drawing 边界', () => {
  it('至少有源码被扫到（防止 glob 规则失效让门禁形同虚设）', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(5);
  });

  it('不依赖 tools/、Konva、React、DOM 或 Canvas', () => {
    const violations: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith('.test.ts')) continue;
      for (const [index, line] of text.split('\n').entries()) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        if (isTypeOnly(line)) continue;
        for (const rule of FORBIDDEN) {
          if (rule.pattern.test(line)) {
            violations.push(`${file}:${index + 1} ${rule.why} → ${line.trim()}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('唯一的外部运行时依赖是 polygon-clipping（且为动态 import）', () => {
    const external: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      if (file.endsWith('.test.ts')) continue;
      for (const match of text.matchAll(/\bfrom\s+'([^'.][^']*)'/g)) {
        const line = text.split('\n').find((item) => item.includes(match[0])) ?? '';
        if (!isTypeOnly(line)) external.push(`${file} → ${match[1]}`);
      }
    }
    // 目前内核没有任何静态外部依赖；polygon-clipping 走 `await import()`
    expect(external).toEqual([]);
  });
});
