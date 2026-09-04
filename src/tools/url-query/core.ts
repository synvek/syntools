import type { ToolResult } from '@/core/types';

export type UrlQueryErrorCode = 'EMPTY' | 'INVALID_URL';

export interface QueryPair {
  key: string;
  value: string;
}

export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  password: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  query: QueryPair[];
}

function pairsFromSearchParams(params: URLSearchParams): QueryPair[] {
  const pairs: QueryPair[] = [];
  params.forEach((value, key) => {
    pairs.push({ key, value });
  });
  return pairs;
}

/** Parse URL into parts + query pairs */
export function parseUrl(input: string): ToolResult<ParsedUrl> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  try {
    const url = new URL(trimmed);
    return {
      ok: true,
      value: {
        href: url.href,
        protocol: url.protocol,
        username: url.username,
        password: url.password,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        origin: url.origin,
        query: pairsFromSearchParams(url.searchParams),
      },
    };
  } catch {
    return { ok: false, error: 'INVALID_URL' };
  }
}

/** Rebuild URL from base URL string with edited query pairs */
export function rebuildUrl(baseInput: string, query: QueryPair[]): ToolResult<string> {
  const trimmed = baseInput.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };
  try {
    const url = new URL(trimmed);
    url.search = '';
    for (const pair of query) {
      if (pair.key === '' && pair.value === '') continue;
      url.searchParams.append(pair.key, pair.value);
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, error: 'INVALID_URL' };
  }
}
