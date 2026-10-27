import { format } from 'sql-formatter';
import type { ToolResult } from '@/core/types';

/**
 * SQL formatting (Tasks T35): built on sql-formatter, fully client-side with no data sent out.
 * Error codes are decoupled from copy: core returns language-agnostic error codes and the UI translates them via i18n (T29 convention).
 */

export type SqlErrorCode = 'EMPTY' | 'INVALID';

/** Supported dialect subset (see the sql-formatter docs for the full list) */
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

/** Format SQL; returns INVALID when the syntax cannot be recognized */
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
