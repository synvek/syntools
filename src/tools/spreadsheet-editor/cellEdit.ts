import { columnIndexToName } from './core';

/**
 * 手机端"轻改"的输入规则（P2-8）。
 *
 * 单独成模块的理由很实际：`univer.ts` 一加载就摸 canvas / Path2D，jsdom 里连 import 都进不来，
 * 于是"用户敲的这串字符到底该变成什么单元格值"这条规则只能靠 e2e 兜着。抽成纯函数之后，
 * 它能被单测逐个锁住——这类规则一旦猜错（把 `007` 变成 `7`、把 `1,234` 变成 `1234`），
 * 用户看到的是"我的数据被改了"，比功能缺失严重。
 */

/** 0-based 行列 → A1 记法（只用于提示"改的是哪一格"） */
export function cellAddress(row: number, column: number): string {
  return `${columnIndexToName(column)}${row + 1}`;
}

export type CellInput =
  | { kind: 'clear' }
  | { kind: 'formula'; formula: string }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string };

/**
 * 严格到"只认没有装饰的十进制数"：`007` / `1,234` / `1e3` / ` 42 ` / `50%` 一律按文本写入。
 * Excel 会按区域设置猜这些写法，猜对了省事、猜错了改数据——这里选择"不猜"，
 * 用户真想要数字就打 `42`，想要千分位展示请用数字格式而不是文本。
 */
const PLAIN_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;

export function parseCellInput(text: string): CellInput {
  if (text === '') return { kind: 'clear' };
  // `=` 单独一个字符不是公式（Univer 会把它当非法公式报错），按文本写入
  if (text.startsWith('=') && text.length > 1) return { kind: 'formula', formula: text };
  if (PLAIN_NUMBER.test(text)) return { kind: 'number', value: Number(text) };
  return { kind: 'text', value: text };
}
