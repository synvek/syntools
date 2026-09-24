import type { ToolResult } from '@/core/types';

export interface QueryParam {
  key: string;
  value: string;
}

export interface UrlParts {
  href: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  username: string;
  password: string;
  isSecure: boolean;
  isIpHost: boolean;
  params: QueryParam[];
  segments: string[];
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/** 解析 URL 为结构化字段（自动补全缺失协议） */
export function parseUrl(input: string): ToolResult<UrlParts> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'EMPTY' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return { ok: false, error: 'INVALID' };
    }
  }

  const params: QueryParam[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    params.push({ key, value });
  }

  return {
    ok: true,
    value: {
      href: url.href,
      protocol: url.protocol,
      host: url.host,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
      username: url.username,
      password: url.password,
      isSecure: url.protocol === 'https:',
      isIpHost: IPV4.test(url.hostname) || url.hostname.startsWith('['),
      params,
      segments: url.pathname.split('/').filter((s) => s.length > 0),
    },
  };
}
