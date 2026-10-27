import { describe, expect, it } from 'vitest';
import {
  SEO_LANGS,
  SITE_DESCRIPTION,
  SITE_TITLE,
  STATIC_PAGE_SEO,
  TOOL_DESCRIPTION_SUFFIX,
  pageTitle,
  seoLangOf,
  staticPageSeo,
} from '@/core/seo/copy';
import { SHELL_TEXT, STATIC_PAGE_SECTIONS } from '@/core/seo/sections';

const PATHS = ['/download/', '/pricing/', '/security/', '/privacy/', '/about/'] as const;

/**
 * This table feeds two places: the head baked into static HTML at build time, and head sync at runtime.
 * A missing language or an empty description silently degrades one side (no error, just wasted output).
 */
describe('SEO 文案完整性', () => {
  it('每种 SEO 语言都配齐站点级字段', () => {
    for (const lang of SEO_LANGS) {
      expect(SITE_TITLE[lang].length, `${lang} SITE_TITLE`).toBeGreaterThan(0);
      expect(SITE_DESCRIPTION[lang].length, `${lang} SITE_DESCRIPTION`).toBeGreaterThan(80);
      expect(
        TOOL_DESCRIPTION_SUFFIX[lang].length,
        `${lang} TOOL_DESCRIPTION_SUFFIX`,
      ).toBeGreaterThan(0);
      expect(Object.keys(SHELL_TEXT[lang]).length).toBeGreaterThanOrEqual(7);
    }
  });

  it('五个静态页在每种语言下都有标题与描述', () => {
    for (const lang of SEO_LANGS) {
      for (const path of PATHS) {
        const page = STATIC_PAGE_SEO[lang][path];
        expect(page, `${lang} ${path} 缺失`).toBeTruthy();
        expect(page.title.length, `${lang} ${path} title`).toBeGreaterThan(0);
        expect(page.description.length, `${lang} ${path} description`).toBeGreaterThan(60);
      }
    }
  });

  it('定价 / 安全 / 隐私 / 关于 带可抓取的正文小节', () => {
    for (const lang of SEO_LANGS) {
      for (const path of ['/pricing/', '/security/', '/privacy/', '/about/'] as const) {
        const sections = STATIC_PAGE_SECTIONS[lang][path] ?? [];
        expect(sections.length, `${lang} ${path} sections`).toBeGreaterThan(0);
        for (const section of sections) {
          expect(section.heading.length).toBeGreaterThan(0);
          expect(section.items.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('下载页不需要正文章节（内容全在构建产物清单里）', () => {
    expect(STATIC_PAGE_SECTIONS.en['/download/']).toBeUndefined();
  });

  it('英文与中文的描述不能是同一串（漏翻会原样复制）', () => {
    for (const path of PATHS) {
      expect(STATIC_PAGE_SEO.en[path].description).not.toBe(STATIC_PAGE_SEO.zh[path].description);
    }
    expect(SITE_DESCRIPTION.en).not.toBe(SITE_DESCRIPTION.zh);
  });
});

describe('pageTitle', () => {
  it('页面标题 + 站点名，分隔符两侧各一个空格', () => {
    expect(pageTitle('Pricing and Licensing', 'en')).toBe('Pricing and Licensing - SynTools');
    expect(pageTitle('定价与商业许可', 'zh')).toBe('定价与商业许可 - SynTools');
  });

  it('不传标题时直接返回站点标题，不出现「SynTools - SynTools」', () => {
    expect(pageTitle('', 'zh')).toBe(SITE_TITLE.zh);
    expect(pageTitle(undefined, 'en')).toBe(SITE_TITLE.en);
  });
});

describe('staticPageSeo', () => {
  it('接受带/不带尾斜杠与语言前缀', () => {
    const zh = staticPageSeo('/pricing/', 'zh');
    expect(staticPageSeo('/pricing', 'zh')).toEqual(zh);
    expect(staticPageSeo('/zh/pricing/', 'zh')).toEqual(zh);
    expect(staticPageSeo('/zh/pricing', 'zh')).toEqual(zh);
  });

  it('首页返回站点描述', () => {
    expect(staticPageSeo('/', 'en')?.description).toBe(SITE_DESCRIPTION.en);
    expect(staticPageSeo('/zh/', 'zh')?.description).toBe(SITE_DESCRIPTION.zh);
  });

  it('未知路径返回 null（由调用方决定是否保留原值）', () => {
    expect(staticPageSeo('/tools/json-format/', 'en')).toBeNull();
    expect(staticPageSeo('/nope/', 'en')).toBeNull();
  });

  it('查询串被忽略', () => {
    expect(staticPageSeo('/pricing?from=x', 'en')).toEqual(staticPageSeo('/pricing/', 'en'));
  });
});

describe('seoLangOf', () => {
  it('繁体与简体共用中文 SEO 文案，其余回落英文', () => {
    expect(seoLangOf('zh')).toBe('zh');
    expect(seoLangOf('zh-TW')).toBe('zh');
    for (const lang of ['en', 'ja', 'fr', 'de', 'it', 'es', 'pt'] as const) {
      expect(seoLangOf(lang)).toBe('en');
    }
  });
});
