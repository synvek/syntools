import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/core/i18n';
import zhTools from '@/core/i18n/locales/zh.tools';
import IpLocationTool from './IpLocationTool';

const tr = (key: string) => String(i18n.t(key));

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => payload } as unknown as Response;
}

const PLUS_PAYLOAD = {
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

describe('IpLocationTool', () => {
  beforeEach(async () => {
    // 工具页文案随工具 chunk 懒加载：等 i18n 初始化完成后再注册，否则会被 init 覆盖
    await i18n.changeLanguage('zh');
    i18n.addResourceBundle('zh', 'translation', zhTools, true, true);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('展示省市与运营商', async () => {
    fetchMock.mockResolvedValue(jsonResponse(PLUS_PAYLOAD));
    render(<IpLocationTool />);

    expect(await screen.findByText('广东省 · GD')).toBeInTheDocument();
    expect(screen.getByText('深圳市')).toBeInTheDocument();
    expect(screen.getByText('中国电信')).toBeInTheDocument();
    expect(screen.getByText('113.87.1.1')).toBeInTheDocument();
  });

  it('接口 404 时提示未启用 PLUS 模式', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    render(<IpLocationTool />);

    expect(await screen.findByText(tr('tools.ip-location.err.NOT_FOUND'))).toBeInTheDocument();
    expect(screen.getByText(tr('tools.ip-location.hintNotFound'))).toBeInTheDocument();
  });

  it('边缘节点无数据时提示不可用', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ip: '', available: false }));
    render(<IpLocationTool />);

    expect(await screen.findByText(tr('tools.ip-location.err.UNAVAILABLE'))).toBeInTheDocument();
  });

  it('请求失败时提示重试', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed to fetch'));
    render(<IpLocationTool />);

    expect(await screen.findByText(tr('tools.ip-location.err.NETWORK'))).toBeInTheDocument();
  });
});
