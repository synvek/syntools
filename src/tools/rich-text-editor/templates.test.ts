import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SETUP } from './pageSetup';
import { DOCUMENT_TEMPLATES, buildTemplateApplication, findTemplate } from './templates';

/**
 * 模板测试：
 * 模板数据与语言无关（正文由翻译函数生成），
 * 套用时只覆盖模板显式声明的字段，未声明的沿用用户当前选择。
 */

/** 仿造 i18n：把 key 原样返回，便于断言正文里嵌入了正确的占位文案 */
const t = (key: string) => `«${key}»`;

describe('内置模板', () => {
  it('提供空白 / 公文 / 报告三套模板且 id 唯一', () => {
    expect(DOCUMENT_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'official',
      'report',
    ]);
    expect(new Set(DOCUMENT_TEMPLATES.map((template) => template.id)).size).toBe(3);
  });

  it('findTemplate 命中已注册模板，未知名返回 null', () => {
    expect(findTemplate('report')?.id).toBe('report');
    expect(findTemplate('nope')).toBeNull();
  });

  it('空白模板只提供空段落，不引入版式偏好', () => {
    const blank = findTemplate('blank');
    expect(blank?.body(t)).toBe('<p></p>');
    expect(blank?.pageSetup.columns).toBe(1);
    expect(blank?.pageSetup.watermark).toBeNull();
  });

  it('报告模板含目录节点与章节标题', () => {
    const html = findTemplate('report')?.body(t) ?? '';
    expect(html).toContain('data-toc="true"');
    expect(html).toContain('<h2>«templateBodySection»</h2>');
  });
});

describe('buildTemplateApplication', () => {
  it('页面设置按模板覆盖合并，模板未声明的字段沿用当前选择', () => {
    const current = {
      title: '我的文档',
      pageSetup: {
        ...DEFAULT_PAGE_SETUP,
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        footer: '第 1 页',
        watermark: { text: '草稿', opacity: 0.1, rotation: -30, color: '#999999' },
      },
    };
    // 仅声明分栏的模板：其余字段必须来自用户当前设置
    const partial = { ...DOCUMENT_TEMPLATES[0], pageSetup: { columns: 3 as const } };
    const application = buildTemplateApplication(partial, current, t);
    expect(application.title).toBe('我的文档');
    expect(application.templateId).toBe('blank');
    expect(application.pageSetup.columns).toBe(3);
    expect(application.pageSetup.margin).toEqual(current.pageSetup.margin);
    expect(application.pageSetup.footer).toBe('第 1 页');
    expect(application.pageSetup.watermark).toEqual(current.pageSetup.watermark);
  });

  it('报告模板显式覆盖为单栏、无水印与更宽的页边距', () => {
    const report = findTemplate('report');
    expect(report).not.toBeNull();
    if (!report) return;
    const application = buildTemplateApplication(
      report,
      { title: 'x', pageSetup: { ...DEFAULT_PAGE_SETUP, columns: 2 } },
      t,
    );
    expect(application.pageSetup.columns).toBe(1);
    expect(application.pageSetup.watermark).toBeNull();
    expect(application.pageSetup.margin?.top).toBe(25.4);
  });

  it('公文模板保留自身的页边距与首页不同设置', () => {
    const official = findTemplate('official');
    expect(official).not.toBeNull();
    if (!official) return;
    const application = buildTemplateApplication(
      official,
      { title: '', pageSetup: DEFAULT_PAGE_SETUP },
      t,
    );
    expect(application.pageSetup.differentFirstPage).toBe(true);
    expect(application.pageSetup.showPageNumber).toBe(false);
    expect(application.html).toContain('«templateBodySignature»');
  });

  it('标题为空时不做兜底命名（由后续保存流程决定）', () => {
    const blank = findTemplate('blank');
    if (!blank) return;
    expect(
      buildTemplateApplication(blank, { title: '   ', pageSetup: DEFAULT_PAGE_SETUP }, t).title,
    ).toBe('');
  });
});
