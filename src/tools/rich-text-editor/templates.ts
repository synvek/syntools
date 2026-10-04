import type { PageSetupConfig } from './pageSetup';

/**
 * 文档模板：一组「页面设置 + 正文骨架」的预设，用于一键开篇。
 *
 * 模板正文里的可见文字由调用方传入的翻译函数提供（`body` 为 `t => html`），
 * 因此模板数据本身与语言无关，切换语言后套用即为当前语言。
 */

export interface DocumentTemplate {
  id: string;
  /** 名称 / 描述 / 正文字符串的 i18n key 前缀（`tools.richText.<key>`） */
  nameKey: string;
  descriptionKey: string;
  /** 模板自身的页面设置覆盖（应用时会与当前设置合并） */
  pageSetup: Partial<PageSetupConfig>;
  /** 正文骨架；`t` 为当前语言的翻译函数 */
  body: (t: (key: string) => string) => string;
}

/** 模板列表（顺序即面板展示顺序） */
export const DOCUMENT_TEMPLATES: readonly DocumentTemplate[] = [
  {
    id: 'blank',
    nameKey: 'templateBlank',
    descriptionKey: 'templateBlankDesc',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      columns: 1,
      watermark: null,
      background: null,
      header: '',
      footer: '',
      showPageNumber: true,
    },
    body: () => '<p></p>',
  },
  {
    id: 'official',
    nameKey: 'templateOfficial',
    descriptionKey: 'templateOfficialDesc',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: 37, right: 26, bottom: 35, left: 28 },
      columns: 1,
      watermark: null,
      background: null,
      header: '',
      footer: '',
      showPageNumber: false,
      differentFirstPage: true,
    },
    body: (t) =>
      [
        `<h2 style="text-align: center">${t('templateBodyHeading')}</h2>`,
        `<p>${t('templateBodyBody')}</p>`,
        `<p style="text-align: right">${t('templateBodySignature')}</p>`,
      ].join(''),
  },
  {
    id: 'report',
    nameKey: 'templateReport',
    descriptionKey: 'templateReportDesc',
    pageSetup: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
      columns: 1,
      watermark: null,
      background: null,
      header: '',
      footer: '',
      showPageNumber: true,
      differentFirstPage: false,
    },
    body: (t) =>
      [
        `<h1 style="text-align: center">${t('templateBodyHeading')}</h1>`,
        '<div data-toc="true" class="rte-toc"></div>',
        `<h2>${t('templateBodySection')}</h2>`,
        `<p>${t('templateBodyBody')}</p>`,
      ].join(''),
  },
];

/** 按 id 取模板 */
export function findTemplate(id: string): DocumentTemplate | null {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id) ?? null;
}

export interface TemplateApplication {
  title: string;
  html: string;
  pageSetup: Partial<PageSetupConfig>;
  templateId: string;
}

/**
 * 生成套用结果：页面设置以「当前设置 + 模板覆盖」合并，
 * 模板未声明的字段（如分栏）沿用用户当前选择，避免套用模板时静默改掉用户的版式偏好。
 */
export function buildTemplateApplication(
  template: DocumentTemplate,
  current: { title: string; pageSetup: PageSetupConfig },
  t: (key: string) => string,
): TemplateApplication {
  return {
    title: current.title.trim(),
    html: template.body(t),
    pageSetup: { ...current.pageSetup, ...template.pageSetup },
    templateId: template.id,
  };
}
