import type { ToolResult } from '@/core/types';

export type JsonPathErrorCode = 'EMPTY' | 'INVALID_JSON' | 'NOT_FOUND';

type PathToken = { type: 'key'; name: string } | { type: 'index'; index: number };

/** Parse simple path: a.b[0].c or $.a.b[0] */
export function tokenizePath(path: string): ToolResult<PathToken[]> {
  let p = path.trim();
  if (!p) return { ok: false, error: 'EMPTY' };
  if (p.startsWith('$')) p = p.slice(1);
  if (p.startsWith('.')) p = p.slice(1);
  if (!p) return { ok: true, value: [] };

  const tokens: PathToken[] = [];
  let i = 0;
  while (i < p.length) {
    if (p[i] === '.') {
      i += 1;
      continue;
    }
    if (p[i] === '[') {
      const end = p.indexOf(']', i);
      if (end < 0) return { ok: false, error: 'NOT_FOUND' };
      const inner = p.slice(i + 1, end).trim();
      if (!/^\d+$/.test(inner)) return { ok: false, error: 'NOT_FOUND' };
      tokens.push({ type: 'index', index: Number(inner) });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < p.length && p[j] !== '.' && p[j] !== '[') j += 1;
    const name = p.slice(i, j);
    if (!name) return { ok: false, error: 'NOT_FOUND' };
    tokens.push({ type: 'key', name });
    i = j;
  }
  return { ok: true, value: tokens };
}

function walk(root: unknown, tokens: PathToken[]): unknown {
  let cur: unknown = root;
  for (const token of tokens) {
    if (cur === null || cur === undefined) return undefined;
    if (token.type === 'key') {
      if (typeof cur !== 'object' || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[token.name];
    } else {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[token.index];
    }
  }
  return cur;
}

/** Query JSON with simple path a.b[0].c */
export function queryJsonPath(jsonText: string, path: string): ToolResult<string> {
  if (!jsonText.trim()) return { ok: false, error: 'EMPTY' };
  if (!path.trim()) return { ok: false, error: 'EMPTY' };

  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }

  const tokens = tokenizePath(path);
  if (!tokens.ok) return tokens;

  const value = walk(data, tokens.value);
  if (value === undefined) return { ok: false, error: 'NOT_FOUND' };
  return {
    ok: true,
    value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  };
}
