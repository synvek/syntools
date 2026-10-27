import type { PageSetupConfig } from './pageSetup';

/**
 * Document templates: presets of "page setup + body skeleton" for starting a document in one click.
 *
 * Visible text in the body comes from a translation function passed by the caller (`body` is `t => html`),
 * so the template data is language-neutral and applying it yields the current language.
 */

export interface DocumentTemplate {
  id: string;
  /** i18n key prefix for name / description / body strings (`tools.richText.<key>`) */
  nameKey: string;
  descriptionKey: string;
  /** Page setup overrides of this template (merged with the current setup on apply) */
  pageSetup: Partial<PageSetupConfig>;
  /** Body skeleton; `t` is the translation function for the current language */
  body: (t: (key: string) => string) => string;
}

/** Template list (order matches the panel) */
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

/** Look up a template by id */
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
 * Build the apply result: page setup is the current setup merged with the template overrides,
 * and fields the template omits (such as columns) keep the user's choice, so applying never silently changes their layout.
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
