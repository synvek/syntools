import { UAParser } from 'ua-parser-js';
import type { ToolResult } from '@/core/types';

/**
 * User-Agent 解析：浏览器 / 引擎 / 系统 / 设备 / CPU。
 */

export type UaError = 'EMPTY';

export interface UaField {
  name: string;
  version: string;
  /** 浏览器 major / 设备 type 等补充字段 */
  extra?: string;
}

export interface UaInfo {
  ua: string;
  browser: UaField;
  engine: UaField;
  os: UaField;
  device: UaField;
  cpu: UaField;
}

function field(name?: string, version?: string, extra?: string): UaField {
  return {
    name: name?.trim() || '—',
    version: version?.trim() || '—',
    ...(extra?.trim() ? { extra: extra.trim() } : {}),
  };
}

export function parseUserAgent(input: string): ToolResult<UaInfo> {
  const ua = input.trim();
  if (!ua) return { ok: false, error: 'EMPTY' };

  const r = new UAParser(ua).getResult();
  return {
    ok: true,
    value: {
      ua: r.ua || ua,
      browser: field(r.browser.name, r.browser.version, r.browser.major),
      engine: field(r.engine.name, r.engine.version),
      os: field(r.os.name, r.os.version),
      device: field(
        r.device.model || r.device.type,
        r.device.vendor,
        r.device.type,
      ),
      cpu: field(r.cpu.architecture),
    },
  };
}
