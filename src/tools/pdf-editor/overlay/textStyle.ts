import type { CSSProperties } from 'react';
import type { PdfTextObject } from '../model/types';

/**
 * Text styling shared by the rendered box and the editing textarea.
 *
 * Lives outside the component files so `react-refresh` keeps working (a module may only export
 * components to stay hot-reloadable).
 */
export function textCss(object: PdfTextObject, scale: number): CSSProperties {
  return {
    color: object.color,
    fontSize: `${Math.max(1, object.fontSize * scale)}px`,
    lineHeight: object.lineHeight,
    textAlign: object.align,
    fontWeight: object.bold ? 600 : 400,
    fontStyle: object.italic ? 'italic' : 'normal',
    fontFamily: object.fontFamily,
    background: object.bg,
    border: object.border ? `1px solid ${object.border}` : undefined,
  };
}
