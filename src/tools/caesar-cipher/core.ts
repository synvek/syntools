import type { ToolResult } from '@/core/types';

const A = 65;
const Z = 90;
const A_LOWER = 97;
const Z_LOWER = 122;

function shiftChar(code: number, shift: number): number {
  if (code >= A && code <= Z) return ((code - A + shift + 26) % 26) + A;
  if (code >= A_LOWER && code <= Z_LOWER) return ((code - A_LOWER + shift + 26) % 26) + A_LOWER;
  return code;
}

export function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (ch) => String.fromCharCode(shiftChar(ch.charCodeAt(0), s)));
}

export function rot13(text: string): string {
  return caesar(text, 13);
}

export function atbash(text: string): string {
  return text.replace(/[a-z]/gi, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= A && code <= Z) return String.fromCharCode(A + (Z - A) - (code - A));
    if (code >= A_LOWER && code <= Z_LOWER)
      return String.fromCharCode(A_LOWER + (Z_LOWER - A_LOWER) - (code - A_LOWER));
    return ch;
  });
}

/** 栅栏密码（rail fence）：rails ≥ 2 */
export function railFence(text: string, rails: number): ToolResult<string> {
  if (rails < 2) return { ok: false, error: 'RAILS_TOO_SMALL' };
  const n = text.length;
  const fence: string[][] = Array.from({ length: rails }, () => []);
  let row = 0;
  let dir = 1;
  for (let i = 0; i < n; i += 1) {
    fence[row].push(text[i]);
    if (row === 0) dir = 1;
    else if (row === rails - 1) dir = -1;
    row += dir;
  }
  return { ok: true, value: fence.map((r) => r.join('')).join('') };
}

export function railFenceDecode(cipher: string, rails: number): ToolResult<string> {
  if (rails < 2) return { ok: false, error: 'RAILS_TOO_SMALL' };
  const n = cipher.length;
  const railOf = new Array<number>(n);
  let row = 0;
  let dir = 1;
  for (let i = 0; i < n; i += 1) {
    railOf[i] = row;
    if (row === 0) dir = 1;
    else if (row === rails - 1) dir = -1;
    row += dir;
  }
  const counts = new Array<number>(rails).fill(0);
  for (let i = 0; i < n; i += 1) counts[railOf[i]] += 1;
  const railsArr: string[][] = Array.from({ length: rails }, () => []);
  let k = 0;
  for (let r = 0; r < rails; r += 1) {
    for (let c = 0; c < counts[r]; c += 1) railsArr[r].push(cipher[k++]);
  }
  let out = '';
  row = 0;
  dir = 1;
  const ptr = new Array<number>(rails).fill(0);
  for (let i = 0; i < n; i += 1) {
    out += railsArr[row][ptr[row]++];
    if (row === 0) dir = 1;
    else if (row === rails - 1) dir = -1;
    row += dir;
  }
  return { ok: true, value: out };
}
