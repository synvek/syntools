/**
 * 自绘矢量导出：把文档渲染为纯 SVG（形状为 path、文字为 <text>，可缩放、文字可选）。
 *
 * 相对 DOM 截图（html-to-image）的优点：
 * - 输出是真矢量，外部工具（Illustrator / Inkscape）打开正常，文字可编辑可选；
 * - 无需切到对应页再截图，多页导出不必打乱用户当前页；
 * - 形状与画布共用 `drawShape`，视觉一致。
 *
 * 局限：公式节点依赖 KaTeX 的 HTML 输出，无法矢量化为 SVG 文本，
 * 由调用方检测到公式节点时回退到 DOM 截图路径（见 `pageHasFormula`）。
 */

import { downloadDataUrl } from '@/core/pdf/download';
import { activePageOf } from '../model/migrate';
import type { FlowDoc, FlowPage } from '../model/types';
import { VectorScene } from './VectorScene';

export interface VectorExportOptions {
  /** 导出范围：仅选中 / 当前页 / 全部页（默认当前页） */
  range?: 'selection' | 'current' | 'all';
  /** 内容外留白（像素） */
  padding?: number;
  /** 透明背景 */
  transparent?: boolean;
  /** `range=selection` 时要导出的节点 id */
  selection?: readonly string[];
}

/** 只保留选中节点（及它们的容器父节点）与相关连线 */
function filterPage(page: FlowPage, ids?: readonly string[]): FlowPage {
  if (!ids || ids.length === 0) return page;
  const keep = new Set(ids);
  const nodes = page.nodes.filter(
    (n) => keep.has(n.id) || (n.parentId ? keep.has(n.parentId) : false),
  );
  const keptIds = new Set(nodes.map((n) => n.id));
  return {
    ...page,
    nodes,
    edges: page.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)),
  };
}

/** 该页是否包含矢量管线无法忠实呈现的公式节点 */
export function pageHasFormula(page: FlowPage): boolean {
  return page.nodes.some((n) => n.type === 'formula');
}

/** 渲染单页为矢量 SVG 字符串 */
export async function pageToVectorSvg(
  page: FlowPage,
  options: VectorExportOptions = {},
): Promise<string> {
  const padding = options.padding ?? 24;
  const transparent = options.transparent ?? false;
  const filtered = filterPage(page, options.selection);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(VectorScene({ page: filtered, padding, transparent }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}

/** 矢量 SVG → PNG dataURL（用于 PDF / 位图回退） */
export async function vectorSvgToPngDataUrl(svg: string, scale = 2): Promise<string | null> {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG_LOAD_FAILED'));
      img.src = url;
    });
    const width = img.naturalWidth || img.width || 1;
    const height = img.naturalHeight || img.height || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function safeName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned || fallback;
}

function pagesOf(doc: FlowDoc, options: VectorExportOptions): FlowPage[] {
  if (options.range === 'all') return doc.pages;
  const active = activePageOf(doc);
  return active ? [active] : [];
}

/** 导出矢量 SVG：单页直接下载，多页打包为 ZIP */
export async function exportVectorSvg(
  doc: FlowDoc,
  filename: string,
  options: VectorExportOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pages = pagesOf(doc, options).filter(
    (p) => filterPage(p, options.selection).nodes.length > 0,
  );
  if (pages.length === 0) return { ok: false, error: 'EMPTY' };

  if (pages.length === 1) {
    const svg = await pageToVectorSvg(pages[0], options);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    downloadDataUrl(url, `${filename}.svg`);
    URL.revokeObjectURL(url);
    return { ok: true };
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i += 1) {
    const svg = await pageToVectorSvg(pages[i], options);
    zip.file(`${String(i + 1).padStart(2, '0')}-${safeName(pages[i].name, 'page')}.svg`, svg);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `${filename}.zip`);
  URL.revokeObjectURL(url);
  return { ok: true };
}
