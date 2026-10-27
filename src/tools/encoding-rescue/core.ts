import type { ToolResult } from '@/core/types';

export interface RescueCandidate {
  encoding: string;
  text: string;
  score: number;
}

const CANDIDATES = ['gbk', 'big5', 'shift-jis', 'euc-kr', 'windows-1252', 'iso-8859-1', 'utf-8'];

/** Score restored text quality: share of CJK code points plus share of printable characters */
function scoreText(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let printable = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x4e00 && cp <= 0x9fff) cjk += 1;
    if (cp >= 0x20 && cp !== 0x7f) printable += 1;
  }
  return (cjk / text.length) * 100 + (printable / text.length) * 20;
}

/**
 * Mojibake repair: revert the mojibake string a browser produced by re-encoding bytes as UTF-8 back to the original text.
 * For example, "ä¸­æ–‡" is restored to the original Chinese text.
 */
export function rescueGarbled(input: string): ToolResult<RescueCandidate[]> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  // Mojibake usually comes from original bytes being misread as a single-byte encoding (Latin1/Windows-1252).
  // Each character is mapped back to its original byte (low 8 bits of charCodeAt) and re-decoded with every candidate encoding.
  const bytes = new Uint8Array([...input].map((c) => c.charCodeAt(0) & 0xff));
  const results: RescueCandidate[] = [];
  for (const encoding of CANDIDATES) {
    try {
      const text = new TextDecoder(encoding as BufferEncoding).decode(bytes);
      if (text && text !== input) {
        results.push({ encoding, text, score: Number(scoreText(text).toFixed(1)) });
      }
    } catch {
      // Encoding unsupported, skip it
    }
  }
  results.sort((a, b) => b.score - a.score);
  if (results.length === 0) return { ok: false, error: 'NO_CANDIDATE' };
  return { ok: true, value: results };
}
