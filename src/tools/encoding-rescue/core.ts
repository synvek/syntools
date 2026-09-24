import type { ToolResult } from '@/core/types';

export interface RescueCandidate {
  encoding: string;
  text: string;
  score: number;
}

const CANDIDATES = ['gbk', 'big5', 'shift-jis', 'euc-kr', 'windows-1252', 'iso-8859-1', 'utf-8'];

/** 评估恢复文本质量：CJK 占比 + 可打印字符占比 */
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
 * 乱码修复：把浏览器用 UTF-8 重新编码后的「乱码字符串」还原为原始编码文本。
 * 例如「ä¸­æ–‡」可还原为「中文」。
 */
export function rescueGarbled(input: string): ToolResult<RescueCandidate[]> {
  if (!input.trim()) return { ok: false, error: 'EMPTY' };
  // 乱码字符串通常由「原始字节被错误地以单字节编码（Latin1/Windows-1252）解读」产生。
  // 这里把每个字符还原为其原始字节（charCodeAt 取低 8 位），再用候选编码重新解读。
  const bytes = new Uint8Array([...input].map((c) => c.charCodeAt(0) & 0xff));
  const results: RescueCandidate[] = [];
  for (const encoding of CANDIDATES) {
    try {
      const text = new TextDecoder(encoding as BufferEncoding).decode(bytes);
      if (text && text !== input) {
        results.push({ encoding, text, score: Number(scoreText(text).toFixed(1)) });
      }
    } catch {
      // 该编码不支持，跳过
    }
  }
  results.sort((a, b) => b.score - a.score);
  if (results.length === 0) return { ok: false, error: 'NO_CANDIDATE' };
  return { ok: true, value: results };
}
