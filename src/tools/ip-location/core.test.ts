import { describe, expect, it } from 'vitest';
import { countryDisplayName, detectCarrier, normalizeIpInfo } from './core';
import { zhCity, zhProvince } from './regions';

const CN_PAYLOAD = {
  ip: '113.87.1.1',
  available: true,
  country: 'CN',
  region: 'Guangdong',
  regionCode: 'GD',
  city: 'Shenzhen',
  continent: 'AS',
  postalCode: '',
  timezone: 'Asia/Shanghai',
  asn: 4134,
  isp: 'Chinanet',
  colo: 'HKG',
};

describe('detectCarrier', () => {
  it('按网络名称识别国内运营商', () => {
    expect(detectCarrier('Chinanet', 4134, 'CN')).toBe('telecom');
    expect(detectCarrier('China Telecom', null, 'CN')).toBe('telecom');
    expect(detectCarrier('China Unicom', null, 'CN')).toBe('unicom');
    expect(detectCarrier('CMNET', null, 'CN')).toBe('mobile');
    expect(detectCarrier('China Education and Research Network', null, 'CN')).toBe('cernet');
  });

  it('网络名称无法识别时回退到 ASN', () => {
    expect(detectCarrier('', 4837, 'CN')).toBe('unicom');
    expect(detectCarrier('some provincial network', 9808, 'CN')).toBe('mobile');
  });

  it('境外网络不套用国内运营商标签', () => {
    // "T-Mobile USA" 含有 mobile，不能被当成中国移动
    expect(detectCarrier('T-Mobile USA', 21928, 'US')).toBe('other');
    expect(detectCarrier('', null, 'US')).toBe('unknown');
  });

  it('完全未知时返回 unknown', () => {
    expect(detectCarrier('', null, 'CN')).toBe('unknown');
  });
});

describe('countryDisplayName', () => {
  it('按语言本地化国家名', () => {
    expect(countryDisplayName('CN', 'en')).toBe('China');
    expect(countryDisplayName('cn', 'zh')).toBe('中国');
  });

  it('非法代码原样返回', () => {
    expect(countryDisplayName('', 'zh')).toBe('');
    expect(countryDisplayName('CHN', 'zh')).toBe('CHN');
  });
});

describe('normalizeIpInfo', () => {
  it('中文界面下本地化省市', () => {
    const result = normalizeIpInfo(CN_PAYLOAD, 'zh');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.province).toBe('广东省');
    expect(result.value.city).toBe('深圳市');
    expect(result.value.countryName).toBe('中国');
    expect(result.value.carrier).toBe('telecom');
    expect(result.value.asn).toBe(4134);
    expect(result.value.colo).toBe('HKG');
  });

  it('英文界面保留原始地名', () => {
    const result = normalizeIpInfo(CN_PAYLOAD, 'en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.province).toBe('Guangdong');
    expect(result.value.city).toBe('Shenzhen');
  });

  it('边缘节点没有地理数据时返回 UNAVAILABLE', () => {
    expect(normalizeIpInfo({ ip: '', available: false }, 'zh')).toEqual({
      ok: false,
      error: 'UNAVAILABLE',
    });
    expect(normalizeIpInfo(null, 'zh')).toEqual({ ok: false, error: 'UNAVAILABLE' });
    expect(normalizeIpInfo('oops', 'zh')).toEqual({ ok: false, error: 'UNAVAILABLE' });
    expect(normalizeIpInfo({}, 'zh')).toEqual({ ok: false, error: 'UNAVAILABLE' });
  });

  it('字段类型异常时降级而不是抛错', () => {
    const result = normalizeIpInfo({ country: 42, asn: 'x', city: null, ip: '1.1.1.1' }, 'en');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.countryCode).toBe('');
    expect(result.value.asn).toBeNull();
    expect(result.value.city).toBe('');
    expect(result.value.ip).toBe('1.1.1.1');
  });
});

describe('中文地名表', () => {
  it('覆盖省级行政区与常见城市', () => {
    expect(zhProvince('Inner Mongolia')).toBe('内蒙古自治区');
    expect(zhProvince('Shaanxi')).toBe('陕西省');
    expect(zhCity('Xi’an')).toBe('西安市');
    expect(zhCity('Urumqi')).toBe('乌鲁木齐市');
  });

  it('未收录的地名返回 undefined，交给调用方回退原文', () => {
    expect(zhProvince('Somewhere')).toBeUndefined();
    expect(zhCity('Atlantis')).toBeUndefined();
  });
});
