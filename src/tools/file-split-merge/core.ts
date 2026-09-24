import type { ToolResult } from '@/core/types';

export type SplitMode = 'size' | 'count';

export interface SplitOptions {
  mode: SplitMode;
  /** 每个分片的字节数（mode = 'size'） */
  size?: number;
  /** 分片数量（mode = 'count'） */
  count?: number;
}

export const MIN_PART_SIZE = 1024;

/** 按字节大小或分片数量切分数据。 */
export function splitBytes(data: Uint8Array, options: SplitOptions): ToolResult<Uint8Array[]> {
  if (data.length === 0) return { ok: false, error: 'EMPTY' };

  if (options.mode === 'size') {
    const size = Math.floor(options.size ?? 0);
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: 'INVALID_SIZE' };
    const parts: Uint8Array[] = [];
    for (let i = 0; i < data.length; i += size) parts.push(data.slice(i, i + size));
    return { ok: true, value: parts };
  }

  const count = Math.floor(options.count ?? 0);
  if (!Number.isFinite(count) || count < 2) return { ok: false, error: 'INVALID_COUNT' };
  const effective = Math.min(count, data.length);
  const base = Math.floor(data.length / effective);
  let remainder = data.length % effective;
  const parts: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < effective; i += 1) {
    const len = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    parts.push(data.slice(offset, offset + len));
    offset += len;
  }
  return { ok: true, value: parts };
}

/** 按顺序合并分片。 */
export function mergeBytes(parts: Uint8Array[]): ToolResult<Uint8Array> {
  const nonEmpty = parts.filter((p) => p.length > 0 || parts.length === 1);
  if (parts.length === 0) return { ok: false, error: 'EMPTY' };
  const total = nonEmpty.reduce((n, p) => n + p.length, 0);
  if (total === 0) return { ok: false, error: 'EMPTY' };
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of nonEmpty) {
    out.set(part, offset);
    offset += part.length;
  }
  return { ok: true, value: out };
}
