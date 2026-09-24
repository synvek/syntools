import type { ToolResult } from '@/core/types';

export interface HeaderEntry {
  name: string;
  value: string;
}

export interface RequestDraft {
  method: string;
  url: string;
  headers: HeaderEntry[];
  body: string;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** 解析多行 `Name: value` 形式的请求头 */
export function parseHeaderLines(text: string): HeaderEntry[] {
  const entries: HeaderEntry[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const name = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!name) continue;
    entries.push({ name, value });
  }
  return entries;
}

/** 从 curl 命令还原请求草稿（支持 -X / -H / -d / --data-raw） */
export function parseCurlCommand(input: string): ToolResult<RequestDraft> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  if (!/^curl\s/.test(trimmed)) return { ok: false, error: 'NOT_CURL' };

  const tokens = trimmed.match(/"[^"]*"|'[^']*'|\S+/g);
  if (!tokens) return { ok: false, error: 'NOT_CURL' };
  const unquote = (t: string) => t.replace(/^["']|["']$/g, '');

  let method = 'GET';
  let url = '';
  const headers: HeaderEntry[] = [];
  const bodyParts: string[] = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '-X' || token === '--request') {
      method = unquote(tokens[i + 1] ?? '').toUpperCase();
      i += 1;
    } else if (token === '-H' || token === '--header') {
      const raw = unquote(tokens[i + 1] ?? '');
      const idx = raw.indexOf(':');
      if (idx > 0) {
        headers.push({ name: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() });
      }
      i += 1;
    } else if (token === '-d' || token === '--data' || token === '--data-raw') {
      bodyParts.push(unquote(tokens[i + 1] ?? ''));
      if (method === 'GET') method = 'POST';
      i += 1;
    } else if (!token.startsWith('-')) {
      url = unquote(token);
    }
  }

  if (!url) return { ok: false, error: 'NO_URL' };
  if (!METHODS.includes(method)) method = 'GET';
  return { ok: true, value: { method, url, headers, body: bodyParts.join('&') } };
}

/** 状态码归类，用于徽章配色 */
export function statusCategory(code: number): string {
  if (code >= 100 && code < 200) return 'info';
  if (code >= 200 && code < 300) return 'success';
  if (code >= 300 && code < 400) return 'redirect';
  if (code >= 400 && code < 500) return 'client';
  if (code >= 500) return 'server';
  return 'unknown';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** 响应体格式化：JSON 会缩进，其他原样返回 */
export function formatBody(text: string): ToolResult<string> {
  if (!text.trim()) return { ok: true, value: '' };
  try {
    return { ok: true, value: JSON.stringify(JSON.parse(text), null, 2) };
  } catch {
    return { ok: true, value: text };
  }
}

/** 生成可复制的 curl 命令 */
export function toCurl(draft: RequestDraft): string {
  const parts = [`curl -X ${draft.method}`];
  for (const { name, value } of draft.headers) {
    parts.push(`-H '${name}: ${value}'`);
  }
  if (draft.body) parts.push(`--data-raw '${draft.body.replace(/'/g, "'\\''")}'`);
  parts.push(`'${draft.url}'`);
  return parts.join(' \\\n  ');
}
