import type { ToolResult } from '@/core/types';

const MORSE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  ' ': '/',
};

export function encodeMorse(text: string): string {
  return text
    .toUpperCase()
    .split('')
    .map((ch) => (ch === ' ' ? '/' : (MORSE[ch] ?? '')))
    .filter((token) => token !== '')
    .join(' ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
}

export function decodeMorse(code: string): ToolResult<string> {
  const reversed = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
  const words = code.trim().split('/');
  const out: string[] = [];
  for (const word of words) {
    const letters = word.trim().split(/\s+/).filter(Boolean);
    let decoded = '';
    for (const letter of letters) {
      const ch = reversed[letter];
      if (!ch) return { ok: false, error: 'INVALID' };
      decoded += ch;
    }
    out.push(decoded);
  }
  return { ok: true, value: out.join(' ') };
}
