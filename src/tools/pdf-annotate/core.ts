import type { ToolResult } from '@/core/types';
import {
  loadPdfFromFile,
  annotatePages,
  getVisualPageSize,
  type AnnotateKind,
  type PdfAnnotation,
  isPdfFile,
  PDF_MAX_BYTES,
} from '@/core/pdf';

export { isPdfFile, PDF_MAX_BYTES };
export type { AnnotateKind, PdfAnnotation };

export type Point = { x: number; y: number };

/**
 * 草稿使用页面归一化坐标（0–1，原点左上），与缩放无关。
 * 导出时再换算为 PDF 视觉坐标（原点左下，单位 pt）。
 */
export type AnnotateDraft =
  | {
      id: string;
      kind: 'highlight' | 'rect';
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number; // 屏幕像素线宽（按绘制时的视觉粗细）
    }
  | {
      id: string;
      kind: 'line';
      pageIndex: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      kind: 'ellipse' | 'circle';
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
      strokeWidth: number;
      filled?: boolean;
    }
  | {
      id: string;
      kind: 'pen';
      pageIndex: number;
      points: Point[];
      color: string;
      strokeWidth: number;
    }
  | {
      id: string;
      kind: 'text';
      pageIndex: number;
      x: number;
      y: number;
      text: string;
      fontSize: number; // 屏幕像素字号
      color: string;
    };

export const ANNOTATE_TOOLS: AnnotateKind[] = [
  'pen',
  'highlight',
  'rect',
  'ellipse',
  'circle',
  'line',
  'text',
];

export function newDraftId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toNorm(px: number, py: number, display: { width: number; height: number }): Point {
  return { x: px / display.width, y: py / display.height };
}

export function fromNorm(nx: number, ny: number, display: { width: number; height: number }): Point {
  return { x: nx * display.width, y: ny * display.height };
}

/** 归一化（左上）→ PDF 视觉坐标（左下，pt） */
export function normToPdfPoint(
  nx: number,
  ny: number,
  pageSize: { width: number; height: number },
): Point {
  return { x: nx * pageSize.width, y: (1 - ny) * pageSize.height };
}

export function draftToPdfAnnotation(
  draft: AnnotateDraft,
  display: { width: number; height: number },
  pageSize: { width: number; height: number },
): PdfAnnotation {
  const map = (nx: number, ny: number) => normToPdfPoint(nx, ny, pageSize);
  // 线宽/字号按「相对当前页宽」换算到 pt（display 为导出时该页渲染尺寸）
  const pxToPt = pageSize.width / display.width;

  if (draft.kind === 'pen') {
    return {
      kind: 'pen',
      pageIndex: draft.pageIndex,
      points: draft.points.map((p) => map(p.x, p.y)),
      color: draft.color,
      borderWidth: Math.max(0.5, draft.strokeWidth * pxToPt),
      opacity: 0.95,
    };
  }

  if (draft.kind === 'text') {
    const p = map(draft.x, draft.y + draft.fontSize / display.height);
    return {
      kind: 'text',
      pageIndex: draft.pageIndex,
      x: p.x,
      y: p.y,
      text: draft.text,
      fontSize: draft.fontSize * pxToPt,
      color: draft.color,
    };
  }

  if (draft.kind === 'line') {
    const a = map(draft.x1, draft.y1);
    const b = map(draft.x2, draft.y2);
    return {
      kind: 'line',
      pageIndex: draft.pageIndex,
      x: a.x,
      y: a.y,
      width: b.x - a.x,
      height: b.y - a.y,
      color: draft.color,
      borderWidth: Math.max(0.5, draft.strokeWidth * pxToPt),
      opacity: 0.95,
    };
  }

  if (draft.kind === 'ellipse' || draft.kind === 'circle') {
    const left = Math.min(draft.x, draft.x + draft.width);
    const right = Math.max(draft.x, draft.x + draft.width);
    const top = Math.min(draft.y, draft.y + draft.height);
    const bottom = Math.max(draft.y, draft.y + draft.height);
    const c = map((left + right) / 2, (top + bottom) / 2);
    const rx = (Math.abs(draft.width) / 2) * pageSize.width;
    const ry = (Math.abs(draft.height) / 2) * pageSize.height;
    const r = draft.kind === 'circle' ? Math.max(rx, ry) : rx;
    return {
      kind: draft.kind,
      pageIndex: draft.pageIndex,
      x: c.x,
      y: c.y,
      width: r,
      height: draft.kind === 'circle' ? r : ry,
      color: draft.color,
      borderWidth: Math.max(0.5, draft.strokeWidth * pxToPt),
      opacity: 0.9,
    };
  }

  const left = Math.min(draft.x, draft.x + draft.width);
  const top = Math.min(draft.y, draft.y + draft.height);
  const w = Math.abs(draft.width);
  const h = Math.abs(draft.height);
  const bl = map(left, top + h);
  return {
    kind: draft.kind,
    pageIndex: draft.pageIndex,
    x: bl.x,
    y: bl.y,
    width: w * pageSize.width,
    height: h * pageSize.height,
    color: draft.color,
    opacity: draft.kind === 'highlight' ? 0.35 : 0.9,
    borderWidth: draft.kind === 'rect' ? Math.max(0.5, draft.strokeWidth * pxToPt) : 0,
  };
}

export async function annotatePdfFile(
  file: File,
  drafts: AnnotateDraft[],
  displaySizes: Array<{ width: number; height: number }>,
  password?: string,
): Promise<ToolResult<Uint8Array>> {
  if (drafts.length === 0) return { ok: false, error: 'EMPTY' };
  const loaded = await loadPdfFromFile(file, { password });
  if (!loaded.ok) return loaded;
  const pages = loaded.value.getPages();
  const mapped: PdfAnnotation[] = [];
  for (const d of drafts) {
    if (d.pageIndex < 0 || d.pageIndex >= pages.length) continue;
    const display = displaySizes[d.pageIndex];
    if (!display || display.width < 1 || display.height < 1) continue;
    const pageSize = getVisualPageSize(pages[d.pageIndex]);
    mapped.push(draftToPdfAnnotation(d, display, pageSize));
  }
  if (mapped.length === 0) return { ok: false, error: 'EMPTY' };
  return annotatePages(loaded.value, mapped);
}
