import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SETUP } from './pageSetup';
import { DOCUMENT_TEMPLATES, buildTemplateApplication, findTemplate } from './templates';

/**
 * Template tests:
 * Template data is language-neutral (the body comes from a translation function),
 * and applying overrides only the fields the template declares, keeping the user's choices elsewhere.
 */

/** Fake i18n that returns the key as-is, so assertions can check the placeholders embedded in the body */
const t = (key: string) => `«${key}»`;

describe('built-in templates', () => {
  it('provides blank / official / report templates with unique ids', () => {
    expect(DOCUMENT_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'official',
      'report',
    ]);
    expect(new Set(DOCUMENT_TEMPLATES.map((template) => template.id)).size).toBe(3);
  });

  it('findTemplate returns registered templates and null for unknown ids', () => {
    expect(findTemplate('report')?.id).toBe('report');
    expect(findTemplate('nope')).toBeNull();
  });

  it('the blank template only provides an empty paragraph and no layout preferences', () => {
    const blank = findTemplate('blank');
    expect(blank?.body(t)).toBe('<p></p>');
    expect(blank?.pageSetup.columns).toBe(1);
    expect(blank?.pageSetup.watermark).toBeNull();
  });

  it('the report template includes a TOC node and section headings', () => {
    const html = findTemplate('report')?.body(t) ?? '';
    expect(html).toContain('data-toc="true"');
    expect(html).toContain('<h2>«templateBodySection»</h2>');
  });
});

describe('buildTemplateApplication', () => {
  it('merges page setup from template overrides and keeps current values for undeclared fields', () => {
    const current = {
      title: '我的文档',
      pageSetup: {
        ...DEFAULT_PAGE_SETUP,
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        footer: '第 1 页',
        watermark: { text: '草稿', opacity: 0.1, rotation: -30, color: '#999999' },
      },
    };
    // A template declaring only columns: every other field must come from the current settings
    const partial = { ...DOCUMENT_TEMPLATES[0], pageSetup: { columns: 3 as const } };
    const application = buildTemplateApplication(partial, current, t);
    expect(application.title).toBe('我的文档');
    expect(application.templateId).toBe('blank');
    expect(application.pageSetup.columns).toBe(3);
    expect(application.pageSetup.margin).toEqual(current.pageSetup.margin);
    expect(application.pageSetup.footer).toBe('第 1 页');
    expect(application.pageSetup.watermark).toEqual(current.pageSetup.watermark);
  });

  it('the report template explicitly overrides to a single column, no watermark, and wider margins', () => {
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

  it('the official template keeps its own margins and different-first-page setting', () => {
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

  it('leaves an empty title alone (the save flow decides the fallback)', () => {
    const blank = findTemplate('blank');
    if (!blank) return;
    expect(
      buildTemplateApplication(blank, { title: '   ', pageSetup: DEFAULT_PAGE_SETUP }, t).title,
    ).toBe('');
  });
});
