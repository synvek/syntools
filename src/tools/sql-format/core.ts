import { format } from 'sql-formatter';
import type { ToolResult } from '@/core/types';

/**
 * SQL 格式化（Tasks T35）：基于 sql-formatter，纯前端无数据外发。
 * 错误码与文案解耦：core 返回语言无关错误码，UI 层经 i18n 翻译（T29 约定）。
 */

export type SqlErrorCode = 'EMPTY' | 'INVALID';

/** 支持的方言子集（完整列表见 sql-formatter 文档） */
export const SQL_LANGUAGES = [
  'sql',
  'mysql',
  'postgresql',
  'sqlite',
  'mariadb',
  'transactsql',
  'plsql',
] as const;
export type SqlLanguage = (typeof SQL_LANGUAGES)[number];

export type KeywordCase = 'upper' | 'lower' | 'preserve';

export interface SqlFormatOptions {
  language: SqlLanguage;
  tabWidth: number;
  keywordCase: KeywordCase;
}

export const DEFAULT_SQL_OPTIONS: SqlFormatOptions = {
  language: 'sql',
  tabWidth: 2,
  keywordCase: 'upper',
};

/** 格式化 SQL；语法无法识别时返回 INVALID */
export function formatSqlText(input: string, options: SqlFormatOptions): ToolResult<string> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  try {
    return {
      ok: true,
      value: format(input, {
        language: options.language,
        tabWidth: options.tabWidth,
        keywordCase: options.keywordCase,
      }),
    };
  } catch {
    return { ok: false, error: 'INVALID' };
  }
}
