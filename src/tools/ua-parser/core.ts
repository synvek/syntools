import { UAParser } from 'ua-parser-js';
import type { ToolResult } from '@/core/types';

/**
 * User-Agent parsing: browser / engine / OS / device / CPU.
 */

export type UaError = 'EMPTY';

export interface UaField {
  name: string;
  version: string;
  /** Extra fields such as browser major / device type */
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
 * Display aliases for OS names.
 *
 * We deliberately stay on `ua-parser-js@1.0.41` (MIT). From v2 on the package is
 * AGPL-3.0-or-later, which conflicts with the dual "AGPL community edition +"
 * "commercial license" release, while this tool only uses `new UAParser(ua).getResult()`
 * from v1, so the downgrade only costs a few display names (v2 renames `Mac OS` to `macOS`). We patch those here.
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
