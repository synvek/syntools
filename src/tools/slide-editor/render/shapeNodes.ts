import Konva from 'konva';
import { findIcon } from '../model/icons';
import type { FormulaElement, IconElement } from '../model/types';

/**
 * Konva nodes for formulas and icons.
 *
 * Both must render **synchronously**: thumbnails and PNG / PDF raster export have no chance to await async
 * decoding, so everything is drawn directly with vector shapes / text instead of the async "HTML → bitmap" path.
 */

const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';
const MONO_FONT = 'Consolas, Menlo, monospace';

/**
 * Formula node.
 *
 * In the MVP the LaTeX source is shown in a monospace font (matching the degraded form used by .pptx export),
 * keeping the "insert → render → export" loop closed and looking the same in all three places.
 * KaTeX layout needs DOM + CSS, which can't happen on the synchronous render path; left as a future enhancement.
 */
export function createFormulaNode(element: FormulaElement): Konva.Group {
  const group = new Konva.Group({ listening: false });
  group.add(
    new Konva.Rect({
      width: element.width,
      height: element.height,
      fill: '#F8FAFC',
      stroke: '#CBD5E1',
      strokeWidth: 1,
      cornerRadius: 4,
    }),
  );
  const label = new Konva.Text({
    text: element.latex || '',
    width: element.width - 12,
    height: element.height - 8,
    x: 6,
    y: 4,
    fontSize: element.fontSize ?? 24,
    fontFamily: MONO_FONT,
    fill: element.color ?? '#111827',
    align: 'center',
    verticalAlign: 'middle',
    wrap: 'none',
    ellipsis: true,
    listening: false,
  });
  group.add(label);
  return group;
}

/** Icon node: built-in SVG paths drawn as Konva.Path vectors (scaled from a 24×24 viewBox) */
export function createIconNode(element: IconElement): Konva.Group {
  const group = new Konva.Group({ listening: false });
  const icon = findIcon(element.iconId);
  if (!icon) {
    const label = new Konva.Text({
      text: '?',
      width: element.width,
      height: element.height,
      fontSize: Math.max(10, Math.min(element.width, element.height) * 0.5),
      fontFamily: DEFAULT_FONT,
      fill: '#94A3B8',
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });
    group.add(label);
    return group;
  }
  const scale = Math.min(element.width, element.height) / 24;
  group.add(
    new Konva.Path({
      data: icon.path,
      fill: icon.stroke ? undefined : (element.color ?? '#2563EB'),
      stroke: icon.stroke ? (element.color ?? '#2563EB') : undefined,
      strokeWidth: icon.stroke ? 2 : 0,
      lineCap: 'round',
      lineJoin: 'round',
      scaleX: scale,
      scaleY: scale,
      // Centered: align the scaled 24×24 graphic to the element center
      x: (element.width - 24 * scale) / 2,
      y: (element.height - 24 * scale) / 2,
      listening: false,
    }),
  );
  return group;
}
