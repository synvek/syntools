/**
 * Narrow docx contract shared by every tool that exports Word documents.
 *
 * This is deliberately *not* the rich-text editor's full page-setup model: a PDF export has no
 * sections, watermarks or named styles to carry over. Keeping the interface small is what lets the
 * PDF editor use core/docx without pulling the editor's review/bookmark machinery into its bundle.
 */

/** Page geometry in millimetres; matches Word's "custom page size" dialog */
export interface DocxPageSetup {
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
}

/** A4 portrait with 25 mm margins — the default for every export path */
export const DEFAULT_DOCX_PAGE_SETUP: DocxPageSetup = {
  widthMm: 210,
  heightMm: 297,
  marginTopMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 25,
  marginRightMm: 25,
};

/** Paragraph alignment understood by both the HTML reader and the docx writer */
export type DocxAlign = 'left' | 'center' | 'right' | 'justify';

/** A heading level, clamped to Word's 1–6 outline levels */
export type DocxHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Structured content extracted from HTML before it reaches the `docx` package */
export type DocxBlock =
  | { type: 'heading'; level: DocxHeadingLevel; text: string }
  | { type: 'paragraph'; text: string; align?: DocxAlign }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'image'; src: string; widthPx: number; heightPx: number }
  | { type: 'pageBreak' };

export interface DocxExportOptions {
  /** Document title (also used as the file name hint by callers) */
  title?: string;
  pageSetup?: Partial<DocxPageSetup>;
  /** Header text on every page; omitted when empty */
  headerText?: string;
  /** Print a "page N of M" field in the footer */
  footerPageNumbers?: boolean;
}
