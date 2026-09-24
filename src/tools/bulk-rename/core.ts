import type { ToolResult } from '@/core/types';

export type CaseTransform = 'none' | 'lower' | 'upper' | 'title';
export type NumberPosition = 'prefix' | 'suffix';

export interface RenameRules {
  prefix: string;
  suffix: string;
  search: string;
  replace: string;
  useRegex: boolean;
  caseTransform: CaseTransform;
  numbering: {
    enabled: boolean;
    start: number;
    padding: number;
    position: NumberPosition;
  };
  /** 留空则保留原扩展名；否则替换为指定扩展名（可带或不带点） */
  newExtension: string;
}

export const DEFAULT_RENAME_RULES: RenameRules = {
  prefix: '',
  suffix: '',
  search: '',
  replace: '',
  useRegex: false,
  caseTransform: 'none',
  numbering: { enabled: false, start: 1, padding: 2, position: 'prefix' },
  newExtension: '',
};

export interface RenameItem {
  from: string;
  to: string;
}

/** 拆分基础名与扩展名（隐藏文件如 .gitignore 视为无扩展名）。 */
export function splitName(name: string): { base: string; ext: string } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, idx), ext: name.slice(idx) };
}

function applyCase(value: string, mode: CaseTransform): string {
  switch (mode) {
    case 'lower':
      return value.toLowerCase();
    case 'upper':
      return value.toUpperCase();
    case 'title':
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return value;
  }
}

/** 对单个文件名应用重命名规则。 */
export function applyRename(name: string, index: number, rules: RenameRules): string {
  const { base, ext } = splitName(name);
  let next = base;

  if (rules.search) {
    next = rules.useRegex
      ? next.replace(new RegExp(rules.search, 'g'), rules.replace)
      : next.split(rules.search).join(rules.replace);
  }

  next = applyCase(next, rules.caseTransform);

  if (rules.numbering.enabled) {
    const num = String(rules.numbering.start + index).padStart(rules.numbering.padding, '0');
    next = rules.numbering.position === 'prefix' ? `${num}${next}` : `${next}${num}`;
  }

  next = `${rules.prefix}${next}${rules.suffix}`;

  let nextExt = ext;
  if (rules.newExtension) {
    nextExt = rules.newExtension.startsWith('.') ? rules.newExtension : `.${rules.newExtension}`;
  }
  return next + nextExt;
}

/** 批量重命名。 */
export function bulkRename(names: string[], rules: RenameRules): ToolResult<RenameItem[]> {
  if (names.length === 0) return { ok: false, error: 'EMPTY' };
  if (rules.useRegex && rules.search) {
    try {
      new RegExp(rules.search);
    } catch {
      return { ok: false, error: 'INVALID_REGEX' };
    }
  }
  return {
    ok: true,
    value: names.map((name, index) => ({ from: name, to: applyRename(name, index, rules) })),
  };
}

/** 检测重命名结果中的重名。 */
export function findDuplicates(items: RenameItem[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const item of items) {
    const key = item.to.toLowerCase();
    if (seen.has(key)) dup.add(item.to);
    seen.add(key);
  }
  return Array.from(dup);
}
