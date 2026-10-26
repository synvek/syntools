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

/**
 * 操作系统名的显示别名。
 *
 * 这里刻意停留在 `ua-parser-js@1.0.41`（MIT）。v2 起该包改为 AGPL-3.0-or-later，
 * 与「AGPL 社区版 + 商业许可版」的双轨发布冲突，而本工具只用到 v1 就有的
 * `new UAParser(ua).getResult()`，因此降级代价仅是几个显示名不同（v2 起把
 * `Mac OS` 改叫 `macOS`）。这些差异在这里补齐，UI 不必知道用的是哪个大版本。
 */
const OS_NAME_ALIASES: Record<string, string> = {
  'Mac OS': 'macOS',
  'Mac OS X': 'macOS',
  'Chrome OS': 'ChromeOS',
};

export function parseUserAgent(input: string): ToolResult<UaInfo> {
  const ua = input.trim();
  if (!ua) return { ok: false, error: 'EMPTY' };

  const r = new UAParser(ua).getResult();
  const osName = r.os.name ? (OS_NAME_ALIASES[r.os.name] ?? r.os.name) : undefined;
  return {
    ok: true,
    value: {
      ua: r.ua || ua,
      browser: field(r.browser.name, r.browser.version, r.browser.major),
      engine: field(r.engine.name, r.engine.version),
      os: field(osName, r.os.version),
      device: field(r.device.model || r.device.type, r.device.vendor, r.device.type),
      cpu: field(r.cpu.architecture),
    },
  };
}
