/**
 * Shared PDF editor model types.
 *
 * Types only — no runtime imports, no React, no pdfjs, no pdf-lib. The model layer must stay
 * runnable in plain jsdom so `coords` / `doc` / `objects` / `history` can be unit tested without
 * mocking a canvas or a PDF worker.
 */

/** Normalized rectangle: relative to the *visual* page (after /Rotate), origin top-left, 0–1 */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalized page rotation (clockwise, as the viewer sees it) */
export type PdfRotation = 0 | 90 | 180 | 270;

export type ViewMode = 'single' | 'continuous';
export type ZoomMode = 'custom' | 'fit-width' | 'fit-page';

/** Original file: the single source of truth every save rebuilds from */
export interface PdfSource {
  bytes: Uint8Array;
  pageCount: number;
  encrypted: boolean;
  /**
   * Password used to open an encrypted file. Kept in memory only — it is required to re-open the
   * bytes with pdf-lib at save time, and must never be written to a draft or a download.
   */
  password?: string;
  /** Stable identity for drafts (pdfjs fingerprints, or name+size+lastModified fallback) */
  fingerprint: string;
}

/** Per-page output state; `rotation` is added on top of the file's own /Rotate */
export interface PdfPageState {
  sourceIndex: number;
  rotation: PdfRotation;
  /** Deleted pages stay in the array so `sourceIndex` never shifts */
  deleted?: boolean;
}

export type PdfTextAlign = 'left' | 'center' | 'right';

/**
 * Overlay text that rewrites existing content (decision D1 = B).
 *
 * The cover is painted before the new text, so the original glyphs are hidden without touching the
 * content stream; `sourceText` is kept for traceability and for the M3 auto-fit work.
 */
export interface PdfTextPatch {
  /** Cover colour, usually white — matches the page background, not the text colour */
  cover: string;
  sourceText?: string;
}

export interface PdfObjectBase {
  id: string;
  /** `PdfPageState.sourceIndex` of the page this object is anchored to */
  page: number;
  rect: NormRect;
  /** Object rotation in degrees (free rotation, not page rotation) */
  rotation: number;
  /** 0–1 */
  opacity: number;
  locked?: boolean;
  /** Paint order, ascending; higher paints later (on top) */
  z: number;
}

export interface PdfTextObject extends PdfObjectBase {
  kind: 'text';
  text: string;
  fontFamily: string;
  /** Font size in PDF points (converted from screen px at save time) */
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
  align: PdfTextAlign;
  lineHeight: number;
  bg?: string;
  border?: string;
  patch?: PdfTextPatch;
}

export interface PdfImageObject extends PdfObjectBase {
  kind: 'image';
  dataUrl: string;
  naturalW: number;
  naturalH: number;
  fit: 'contain' | 'cover' | 'fill';
}

export interface PdfInkObject extends PdfObjectBase {
  kind: 'ink';
  /** Normalized points inside `rect` */
  points: Array<{ x: number; y: number }>;
  color: string;
  /** Stroke width in PDF points */
  width: number;
  smooth: boolean;
}

export interface PdfMarkupObject extends PdfObjectBase {
  kind: 'markup';
  type: 'highlight' | 'underline' | 'strikeout';
  color: string;
  /** One quad per text line covered by the markup */
  quads: NormRect[];
}

export interface PdfShapeObject extends PdfObjectBase {
  kind: 'shape';
  type: 'rect' | 'ellipse' | 'arrow' | 'line';
  stroke: string;
  fill?: string;
  /** Stroke width in PDF points */
  width: number;
  dash?: number[];
}

export interface PdfNoteObject extends PdfObjectBase {
  kind: 'note';
  body: string;
  author?: string;
  icon: 'note' | 'comment' | 'help';
}

/** Stamps and signatures are images with a fixed meaning; kept as one shape */
export interface PdfStampObject extends PdfObjectBase {
  kind: 'stamp' | 'signature';
  dataUrl: string;
  naturalW: number;
  naturalH: number;
}

export type PdfObject =
  | PdfTextObject
  | PdfImageObject
  | PdfInkObject
  | PdfMarkupObject
  | PdfShapeObject
  | PdfNoteObject
  | PdfStampObject;

export interface PdfEditorDoc {
  id: string;
  name: string;
  source: PdfSource;
  /** Output order. Length always equals `source.pageCount`. */
  pages: PdfPageState[];
  /** Overlay objects, paint order = ascending `z` */
  objects: PdfObject[];
  /** AcroForm values, keyed by field name (M3) */
  forms: Record<string, string | boolean>;
  meta: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
  };
  /**
   * View state is part of the draft but *not* of `revision`: scrolling and zooming must never
   * show "unsaved changes".
   */
  view: {
    mode: ViewMode;
    zoom: number;
    zoomMode: ZoomMode;
    /** 1-based page number in visible order */
    page: number;
  };
  updatedAt: number;
  /** Bumped by every content mutation */
  revision: number;
  /** `revision` at the last successful save (or at open) */
  savedRevision: number;
}
