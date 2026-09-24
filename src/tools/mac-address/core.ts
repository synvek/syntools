import type { ToolResult } from '@/core/types';

export type MacSeparator = ':' | '-' | '.' | 'none';

export interface MacInfo {
  bytes: number[];
  normalized: string;
  colon: string;
  hyphen: string;
  dot: string;
  bare: string;
  binary: string;
  eui64: string;
  linkLocal: string;
  isMulticast: boolean;
  isLocallyAdministered: boolean;
  isBroadcast: boolean;
  vendor: string | null;
  oui: string;
}

/** 常见 OUI 厂商前缀（内置精简表，未收录时返回 null） */
const OUI_VENDOR: Record<string, string> = {
  '000c29': 'VMware',
  '005056': 'VMware',
  '001c42': 'Parallels',
  '0242ac': 'Docker',
  b827eb: 'Raspberry Pi Foundation',
  dca632: 'Raspberry Pi Foundation',
  '00155d': 'Microsoft / Hyper-V',
  '0050f2': 'Microsoft',
  '001a11': 'Google',
  '3c22fb': 'Google',
  f4f5e8: 'Google',
  '0017f2': 'Apple',
  '001cb3': 'Apple',
  '3c0754': 'Apple',
  a4d1d2: 'Apple',
  f0dce2: 'Apple',
  '001b63': 'Apple',
  '001cf0': 'Huawei',
  '00e0fc': 'Huawei',
  '286ed4': 'Huawei',
  '4c1fcc': 'Huawei',
  '00e04c': 'Realtek',
  '1cbfce': 'TP-Link',
  '50c7bf': 'TP-Link',
  '98ded0': 'TP-Link',
  b0958e: 'TP-Link',
  '0022b0': 'Intel',
  '3c970e': 'Intel',
  a0a8cd: 'Intel',
  '8c1645': 'Intel',
  '0014d1': 'Xiaomi',
  '64b473': 'Xiaomi',
  '7c2ebd': 'Xiaomi',
  '00166c': 'Samsung',
  '5cf370': 'Samsung',
  a0f4c7: 'Samsung',
  '0017c4': 'Dell',
  f48e38: 'Dell',
  '3c4a92': 'Dell',
  '001e8f': 'Cisco',
  '2c3f38': 'Cisco',
  '58ac78': 'Cisco',
  '0026b9': 'HP',
  '3c52a1': 'HP',
  '9c8e99': 'HP',
  '000569': 'Lenovo',
  '54ee75': 'Lenovo',
  f0bf97: 'Lenovo',
};

/** 解析常见 MAC 写法：00:1A:2B:3C:4D:5E / 00-1A-... / 001A.2B3C.4D5E / 001A2B3C4D5E */
export function parseMac(input: string): ToolResult<number[]> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'EMPTY' };

  const compact = raw.replace(/[\s]/g, '');
  let hex: string;
  if (/^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$/.test(compact)) {
    hex = compact.replace(/:/g, '');
  } else if (/^[0-9a-fA-F]{2}(-[0-9a-fA-F]{2}){5}$/.test(compact)) {
    hex = compact.replace(/-/g, '');
  } else if (/^[0-9a-fA-F]{4}(\.[0-9a-fA-F]{4}){2}$/.test(compact)) {
    hex = compact.replace(/\./g, '');
  } else if (/^[0-9a-fA-F]{12}$/.test(compact)) {
    hex = compact;
  } else {
    return { ok: false, error: 'INVALID' };
  }

  const bytes = Array.from({ length: 6 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  return { ok: true, value: bytes };
}

function formatMac(bytes: number[], separator: MacSeparator, upper: boolean): string {
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  const out = upper ? hex.map((h) => h.toUpperCase()) : hex;
  switch (separator) {
    case ':':
      return out.join(':');
    case '-':
      return out.join('-');
    case '.':
      return `${out.slice(0, 2).join('')}.${out.slice(2, 4).join('')}.${out.slice(4, 6).join('')}`;
    case 'none':
      return out.join('');
  }
}

/** EUI-64：在第 3/4 字节之间插入 fffe 并翻转 U/L 位 */
function toEui64(bytes: number[]): string {
  const modified = bytes.slice(0, 3).concat([0xff, 0xfe], bytes.slice(3));
  modified[0] ^= 0x02;
  return formatMac(modified, ':', false);
}

/** IPv6 链路本地地址（fe80::/64 + EUI-64） */
function toLinkLocal(bytes: number[]): string {
  const eui = toEui64(bytes)
    .split(':')
    .map((h) => parseInt(h, 16));
  const groups = ['fe80', '0', '0', '0'];
  for (let i = 0; i < 4; i += 1) {
    groups.push(((eui[i * 2] << 8) | eui[i * 2 + 1]).toString(16));
  }
  return groups.join(':');
}

export function analyzeMac(input: string): ToolResult<MacInfo> {
  const parsed = parseMac(input);
  if (!parsed.ok) return parsed;
  const bytes = parsed.value;
  const oui = formatMac(bytes.slice(0, 3), 'none', false);
  const first = bytes[0];

  return {
    ok: true,
    value: {
      bytes,
      normalized: formatMac(bytes, ':', true),
      colon: formatMac(bytes, ':', false),
      hyphen: formatMac(bytes, '-', true),
      dot: formatMac(bytes, '.', false),
      bare: formatMac(bytes, 'none', true),
      binary: bytes.map((b) => b.toString(2).padStart(8, '0')).join(' '),
      eui64: toEui64(bytes),
      linkLocal: toLinkLocal(bytes),
      isMulticast: (first & 0x01) === 1,
      isLocallyAdministered: (first & 0x02) === 2,
      isBroadcast: bytes.every((b) => b === 0xff),
      vendor: OUI_VENDOR[oui] ?? null,
      oui: formatMac(bytes.slice(0, 3), '-', true),
    },
  };
}

export interface MacGenerateOptions {
  count: number;
  separator: MacSeparator;
  upper: boolean;
  locallyAdministered: boolean;
  multicast: boolean;
}

export function generateMacs(
  options: MacGenerateOptions,
  rand: () => number = Math.random,
): ToolResult<string[]> {
  const { count, separator, upper, locallyAdministered, multicast } = options;
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = Array.from({ length: 6 }, () => Math.floor(rand() * 256));
    if (locallyAdministered) bytes[0] |= 0x02;
    else bytes[0] &= ~0x02;
    if (multicast) bytes[0] |= 0x01;
    else bytes[0] &= ~0x01;
    out.push(formatMac(bytes, separator, upper));
  }
  return { ok: true, value: out };
}
