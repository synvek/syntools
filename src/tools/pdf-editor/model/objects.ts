/**
 * Overlay object factories and small pure helpers.
 *
 * Only `text` is created in M1-6; the other kinds exist in `types.ts` so the save pipeline can be
 * written against the union without a later refactor. Everything here is pure and side-effect free
 * except `createObjectId`, which reads `crypto.randomUUID` when the platform has it.
 */

import { clampNormRect } from './coords';
import type { NormRect, PdfObject, PdfTextObject } from './types';

/** Default look of an inserted text box (11 pt Helvetica, Office-ish) */
export const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Helvetica',
  fontSize: 11,
  bold: false,
  italic: false,
  color: '#111111',
  align: 'left',
  lineHeight: 1.35,
} as const;

/** First z that paints on top: max + 1, starting at 1 so `0` can mean "unset" in debug output */
export function nextZ(objects: readonly PdfObject[]): number {
  let max = 0;
  for (const object of objects) {
    if (object.z > max) max = object.z;
  }
  return max + 1;
}

/** Paint order is ascending `z`; copy first so callers keep their array untouched */
export function sortByZ(objects: readonly PdfObject[]): PdfObject[] {
  return [...objects].sort((a, b) => a.z - b.z);
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Stable id for undo/hit-testing; `crypto.randomUUID` is available in every supported browser */
export function createObjectId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateTextObjectInput {
  /** `PdfPageState.id` (stable across reorders) */
  page: string;
  /** Normalized rect; clamped into the page */
  rect: NormRect;
  text: string;
  z?: number;
  id?: string;
  style?: Partial<
    Pick<
      PdfTextObject,
      | 'fontFamily'
      | 'fontSize'
      | 'bold'
      | 'italic'
      | 'color'
      | 'align'
      | 'lineHeight'
      | 'bg'
      | 'border'
      | 'patch'
      | 'opacity'
      | 'rotation'
      | 'locked'
    >
  >;
}

export function createTextObject(input: CreateTextObjectInput): PdfTextObject {
  const { style } = input;
  return {
    kind: 'text',
    id: input.id ?? createObjectId(),
    page: input.page,
    rect: clampNormRect(input.rect),
    z: input.z ?? 1,
    text: input.text,
    fontFamily: style?.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: style?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    bold: style?.bold ?? DEFAULT_TEXT_STYLE.bold,
    italic: style?.italic ?? DEFAULT_TEXT_STYLE.italic,
    color: style?.color ?? DEFAULT_TEXT_STYLE.color,
    align: style?.align ?? DEFAULT_TEXT_STYLE.align,
    lineHeight: style?.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    rotation: style?.rotation ?? 0,
    opacity: clampOpacity(style?.opacity ?? 1),
    locked: style?.locked,
    bg: style?.bg,
    border: style?.border,
    patch: style?.patch,
  };
}

/** Re-anchor an object to another page (drag from one thumbnail to another in M2) */
export function moveObjectToPage<T extends PdfObject>(object: T, page: string): T {
  return { ...object, page };
}
