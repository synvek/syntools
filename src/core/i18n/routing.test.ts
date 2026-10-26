import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROUTED_LANG,
  alternatesFor,
  langPrefix,
  routedLangFromPath,
  stripLangPrefix,
  withLangPrefix,
} from '@/core/i18n/routing';

/**
 * 这组规则决定了「语言写在哪条 URL 上」，任何一条算错都会导致：
 * - 中文页面被 canonical 到英文树（重复内容）；
 * - 站内链接把用户甩回另一种语言；
 * - 预渲染落盘目录与运行时前缀不一致（404）。
 * 所以逐条钉死。
 */
describe('routedLangFromPath', () => {
  it('无前缀路径属于默认语言', () => {
    expect(routedLangFromPath('/')).toBe('en');
    expect(routedLangFromPath('/pricing/')).toBe('en');
    expect(routedLangFromPath('/tools/json-format/')).toBe('en');
    expect(DEFAULT_ROUTED_LANG).toBe('en');
  });

  it('/zh 前缀（带不带尾斜杠）都识别为中文', () => {
    expect(routedLangFromPath('/zh')).toBe('zh');
    expect(routedLangFromPath('/zh/')).toBe('zh');
    expect(routedLangFromPath('/zh/pricing/')).toBe('zh');
    expect(routedLangFromPath('/zh/tools/json-format/')).toBe('zh');
  });

  it('不把 zh-TW 之类当成中文树', () => {
    expect(routedLangFromPath('/zh-TW/pricing/')).toBe('en');
    expect(routedLangFromPath('/zh-CN')).toBe('en');
    // 前缀必须是完整的一段：/zhtools 不是语言
    expect(routedLangFromPath('/zhtools/')).toBe('en');
  });

  it('查询串与 hash 不影响判断', () => {
    expect(routedLangFromPath('/zh/tools/base64/?s=abc')).toBe('zh');
    expect(routedLangFromPath('/pricing#faq')).toBe('en');
  });
});

describe('stripLangPrefix', () => {
  it('去掉已知前缀，保留其余部分', () => {
    expect(stripLangPrefix('/zh')).toBe('/');
    expect(stripLangPrefix('/zh/')).toBe('/');
    expect(stripLangPrefix('/zh/pricing/')).toBe('/pricing/');
    expect(stripLangPrefix('/zh/tools/json-format/')).toBe('/tools/json-format/');
  });

  it('无前缀路径原样返回', () => {
    expect(stripLangPrefix('/')).toBe('/');
    expect(stripLangPrefix('/pricing/')).toBe('/pricing/');
    expect(stripLangPrefix('/zh-TW/pricing/')).toBe('/zh-TW/pricing/');
  });

  it('查询串与 hash 跟着走', () => {
    expect(stripLangPrefix('/zh/tools/base64/?s=abc')).toBe('/tools/base64/?s=abc');
    expect(stripLangPrefix('/zh/pricing#faq')).toBe('/pricing#faq');
  });
});

describe('withLangPrefix', () => {
  it('给无前缀路径加前缀', () => {
    expect(withLangPrefix('/pricing', 'zh')).toBe('/zh/pricing');
    expect(withLangPrefix('/tools/base64/?s=1', 'zh')).toBe('/zh/tools/base64/?s=1');
  });

  it('默认语言不加前缀', () => {
    expect(withLangPrefix('/pricing', 'en')).toBe('/pricing');
    expect(withLangPrefix('/', 'en')).toBe('/');
  });

  it('幂等：已带前缀不会叠加', () => {
    expect(withLangPrefix('/zh/pricing', 'zh')).toBe('/zh/pricing');
    expect(withLangPrefix('/zh/pricing', 'en')).toBe('/pricing');
  });

  it('外链与协议相对地址原样返回', () => {
    expect(withLangPrefix('https://github.com/synvek/syntools', 'zh')).toBe(
      'https://github.com/synvek/syntools',
    );
    expect(withLangPrefix('//cdn.example.com/x', 'zh')).toBe('//cdn.example.com/x');
    expect(withLangPrefix('mailto:a@b.c', 'zh')).toBe('mailto:a@b.c');
  });
});

describe('langPrefix / alternatesFor', () => {
  it('前缀格式固定', () => {
    expect(langPrefix('en')).toBe('');
    expect(langPrefix('zh')).toBe('/zh');
  });

  it('alternates 覆盖两种语言且互不重复', () => {
    const list = alternatesFor('/tools/base64/');
    expect(list.map((a) => a.lang)).toEqual(['en', 'zh']);
    expect(list.map((a) => a.href)).toEqual(['/tools/base64/', '/zh/tools/base64/']);
  });
});
