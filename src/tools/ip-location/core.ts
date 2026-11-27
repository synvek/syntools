import type { ToolResult } from '@/core/types';
import { zhCity, zhProvince } from './regions';

/**
 * 访客 IP 归属地：把 `/api/ip-info` 的响应规范化成界面可用的结构。
 *
 * 纯函数，不发起请求（请求在组件里做），这样运营商归类、地名本地化都能单测。
 */

export type Carrier = 'unicom' | 'telecom' | 'mobile' | 'broadnet' | 'cernet' | 'other' | 'unknown';

export type IpLocationError = 'UNAVAILABLE';

export interface IpLocation {
  ip: string;
  /** ISO-3166-1 alpha-2，未知时为空串 */
  countryCode: string;
  /** 按界面语言本地化的国家/地区名 */
  countryName: string;
  /** 省/州名（中文界面下已本地化） */
  province: string;
  provinceCode: string;
  city: string;
  /** 国内运营商归类结果，用于显示「联通 / 电信 / 移动」 */
  carrier: Carrier;
  /** 原始网络名称（如 China Telecom / Chinanet Guangdong province network） */
  isp: string;
  asn: number | null;
  timezone: string;
  continent: string;
  postalCode: string;
  /** Cloudflare 接入节点三字码，解释「为什么城市可能不准」 */
  colo: string;
}

/**
 * ASN → 运营商。只收国内三大运营商、广电与教育网中最常见的号段：
 * 4134/4809/4811/4812 电信，4837/4808/9929/17621 联通，9808/5604x 移动，4538/23910 教育网。
 */
const ASN_CARRIER: Record<number, Carrier> = {
  4134: 'telecom',
  4809: 'telecom',
  4811: 'telecom',
  4812: 'telecom',
  4837: 'unicom',
  4808: 'unicom',
  9929: 'unicom',
  17621: 'unicom',
  9808: 'mobile',
  56040: 'mobile',
  56041: 'mobile',
  56042: 'mobile',
  56044: 'mobile',
  56046: 'mobile',
  56048: 'mobile',
  4538: 'cernet',
  23910: 'cernet',
};

/**
 * 网络名称关键词 → 运营商。
 * 数据源给的是 `asOrganization` 原文（Chinanet / China Unicom / CMNET …），
 * 关键词比 ASN 更能覆盖省级分公司这类没有独立 ASN 的网络。
 */
const CARRIER_PATTERNS: readonly (readonly [RegExp, Carrier])[] = [
  [/chinanet|chinatelecom|china\s*telecom|\bctcc\b|中国电信/i, 'telecom'],
  [/china\s*unicom|\bcucc\b|china169|netcom|中国联通/i, 'unicom'],
  [/china\s*mobile|\bcmcc\b|cmnet|中国移动/i, 'mobile'],
  [/\bcbn\b|broadnet|中国广电/i, 'broadnet'],
  [/cernet|china education and research|教育网/i, 'cernet'],
];

/**
 * 归类运营商。
 *
 * 只在目标国家为中国（或国家未知）时做中文运营商匹配：否则 "T-Mobile USA" 这类
 * 网络名会被误判成「中国移动」。境外网络统一归为 `other`，界面直接显示原始 ISP。
 */
export function detectCarrier(isp: string, asn: number | null, countryCode = 'CN'): Carrier {
  const name = isp.trim();
  if (countryCode && countryCode !== 'CN') return name ? 'other' : 'unknown';
  for (const [pattern, carrier] of CARRIER_PATTERNS) {
    if (pattern.test(name)) return carrier;
  }
  if (asn !== null && ASN_CARRIER[asn]) return ASN_CARRIER[asn];
  return name ? 'other' : 'unknown';
}

/** 按界面语言显示国家/地区名（`Intl.DisplayNames`，不额外引入数据表） */
export function countryDisplayName(code: string, lang: string): string {
  const cc = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return code;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function str(value: unknown, max = 96): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * 校验并规范化接口响应。
 *
 * 任何字段缺失都退化为空串/`null`，由界面显示 `—`；只有「完全没有任何地理信息」
 * 才是错误，此时返回 `UNAVAILABLE`（本地开发、或边缘节点没有该地区的数据）。
 */
export function normalizeIpInfo(raw: unknown, lang = 'en'): ToolResult<IpLocation> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'UNAVAILABLE' };
  const src = raw as Record<string, unknown>;
  if (src.available === false) return { ok: false, error: 'UNAVAILABLE' };

  const ip = str(src.ip, 64);
  const isp = str(src.isp, 64);
  const countryCode = str(src.country, 2).toUpperCase();
  const provinceRaw = str(src.region);
  const cityRaw = str(src.city);
  if (!countryCode && !isp && !cityRaw && !ip) return { ok: false, error: 'UNAVAILABLE' };

  const asn = typeof src.asn === 'number' && Number.isFinite(src.asn) ? src.asn : null;
  const chinese = lang.toLowerCase().startsWith('zh');

  return {
    ok: true,
    value: {
      ip,
      countryCode,
      countryName: countryCode ? countryDisplayName(countryCode, lang) : '',
      province: chinese ? (zhProvince(provinceRaw) ?? provinceRaw) : provinceRaw,
      provinceCode: str(src.regionCode, 16),
      city: chinese ? (zhCity(cityRaw) ?? cityRaw) : cityRaw,
      carrier: detectCarrier(isp, asn, countryCode),
      isp,
      asn,
      timezone: str(src.timezone, 64),
      continent: str(src.continent, 2).toUpperCase(),
      postalCode: str(src.postalCode, 16),
      colo: str(src.colo, 8),
    },
  };
}
