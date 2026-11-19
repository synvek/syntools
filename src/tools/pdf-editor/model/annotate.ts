/**
 * Annotation tool identity and the style an annotation is created with.
 *
 * Tools are plain strings on purpose: the ribbon, the overlay and the controller all switch on them,
 * and a closed union keeps an unknown tool from silently behaving like `select`.
 */

import type { PdfMarkupObject, PdfShapeObject } from './types';

export type MarkupTool = PdfMarkupObject['type'];
export type ShapeTool = PdfShapeObject['type'];

export type PdfTool =
  | 'select'
  | 'hand'
  | MarkupTool
  | ShapeTool
  | 'ink'
  | 'eraser'
  | 'note'
  | 'text'
  /** Rewrite an existing line of text (M3-2); the line layer owns the pointer */
  | 'patch';

export const MARKUP_TOOLS: readonly MarkupTool[] = ['highlight', 'underline', 'strikeout'];
export const SHAPE_TOOLS: readonly ShapeTool[] = ['rect', 'ellipse', 'arrow', 'line'];

export function isMarkupTool(tool: PdfTool): tool is MarkupTool {
  return (MARKUP_TOOLS as readonly string[]).includes(tool);
}

export function isShapeTool(tool: PdfTool): tool is ShapeTool {
  return (SHAPE_TOOLS as readonly string[]).includes(tool);
}

/** Tools that paint by dragging on the page (the eraser and note are click tools) */
export function isDrawingTool(tool: PdfTool): boolean {
  return isMarkupTool(tool) || isShapeTool(tool) || tool === 'ink';
}

/** True when the tool owns the pointer, so selection must not start a drag */
export function isAnnotateTool(tool: PdfTool): boolean {
  return tool !== 'select' && tool !== 'hand';
}

/** Style applied to newly created annotations; the ribbon edits it */
export interface AnnotationStyle {
  markupColor: string;
  inkColor: string;
  inkWidth: number;
  shapeStroke: string;
  shapeWidth: number;
  /** Applied to markup/shape/ink; text and images have their own opacity */
  opacity: number;
}

export const INITIAL_ANNOTATION_STYLE: AnnotationStyle = {
  markupColor: '#fde047',
  inkColor: '#e11d48',
  inkWidth: 2,
  shapeStroke: '#e11d48',
  shapeWidth: 2,
  opacity: 1,
};

/** Colour the format group shows for the active tool */
export function styleColorFor(style: AnnotationStyle, tool: PdfTool): string | null {
  if (isMarkupTool(tool)) return style.markupColor;
  if (isShapeTool(tool)) return style.shapeStroke;
  if (tool === 'ink') return style.inkColor;
  return null;
}

/** Stroke width the format group shows for the active tool */
export function styleWidthFor(style: AnnotationStyle, tool: PdfTool): number | null {
  if (isShapeTool(tool)) return style.shapeWidth;
  if (tool === 'ink') return style.inkWidth;
  return null;
}

/** Write one colour back into the style for the tool that owns it */
export function withStyleColor(
  style: AnnotationStyle,
  tool: PdfTool,
  color: string,
): AnnotationStyle {
  if (isMarkupTool(tool)) return { ...style, markupColor: color };
  if (isShapeTool(tool)) return { ...style, shapeStroke: color };
  if (tool === 'ink') return { ...style, inkColor: color };
  return style;
}

/** Write one stroke width back into the style for the tool that owns it */
export function withStyleWidth(
  style: AnnotationStyle,
  tool: PdfTool,
  width: number,
): AnnotationStyle {
  if (isShapeTool(tool)) return { ...style, shapeWidth: width };
  if (tool === 'ink') return { ...style, inkWidth: width };
  return style;
}
