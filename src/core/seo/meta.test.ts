import { describe, expect, it } from 'vitest';
import { resolvePageSeo } from '@/core/seo/meta';
import { SITE_DESCRIPTION, SITE_TITLE, STATIC_PAGE_SEO } from '@/core/seo/copy';

/** 用固定表代替 i18next：这里只验证「路径 → 标题/描述」的取值逻辑 */
function fakeT(dict: Record<string, string>) {
  return (key: string) => dict[key] ?? '';
}

const TOOL_DICT = {
  'toolsMeta.json-format.name': 'JSON 格式化',
  'toolsMeta.json-format.description': '格式化 / 压缩 / 校验',
};

describe('resolvePageSeo', () => {
  it('工具页用 toolsMeta 拼标题，描述带上「不上传」后缀', () => {
    const seo = resolvePageSeo('/tools/json-format/', 'zh', fakeT(TOOL_DICT));
    expect(seo?.title).toBe('JSON 格式化 - SynTools');
    expect(seo?.description).toBe('格式化 / 压缩 / 校验 纯前端处理，数据不离开浏览器。');
  });

  it('中文树里的工具页同样解析得出来（前缀不影响结果）', () => {
    const zh = resolvePageSeo('/zh/tools/json-format/', 'zh', fakeT(TOOL_DICT));
    const en = resolvePageSeo('/tools/json-format/', 'zh', fakeT(TOOL_DICT));
    expect(zh).toEqual(en);
  });

  it('界面是英文时用英文后缀', () => {
    const seo = resolvePageSeo(
      '/tools/json-format/',
      'en',
      fakeT({
        'toolsMeta.json-format.name': 'JSON Formatter',
        'toolsMeta.json-format.description': 'Format, minify and validate',
      }),
    );
    expect(seo?.title).toBe('JSON Formatter - SynTools');
    expect(seo?.description).toBe(
      'Format, minify and validate Processed entirely on the client; data never leaves your browser.',
    );
  });

  it('某语种缺这条工具的文案时返回 null，交给调用方保留预渲染值', () => {
    expect(resolvePageSeo('/tools/json-format/', 'ja', fakeT({}))).toBeNull();
  });

  it('静态页取共享文案表', () => {
    const seo = resolvePageSeo('/pricing/', 'zh', fakeT({}));
    expect(seo?.title).toBe(`${STATIC_PAGE_SEO.zh['/pricing/'].title} - SynTools`);
    expect(seo?.description).toBe(STATIC_PAGE_SEO.zh['/pricing/'].description);
  });

  it('首页回落到站点标题与站点描述', () => {
    const seo = resolvePageSeo('/', 'zh', fakeT({}));
    expect(seo?.title).toBe(SITE_TITLE.zh);
    expect(seo?.description).toBe(SITE_DESCRIPTION.zh);
  });

  it('未知路径返回 null', () => {
    expect(resolvePageSeo('/nope/', 'en', fakeT({}))).toBeNull();
  });
});
