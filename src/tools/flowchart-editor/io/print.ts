/**
 * 分页打印导出：把整张图按纸张尺寸切片，输出多页 PDF。
 *
 * 实现方式：先用与导出同一条 DOM 截图管线拿到整图位图，
 * 再按「纸张内容区」逐页铺贴——每页把位图按负偏移定位，
 * 由 PDF 页面自身的裁剪得到分页效果（无需二次裁剪图片）。
 */

import { jsPDF } from 'jspdf';
import type { Node } from '@xyflow/react';
import { capturePage, type CapturedPage } from './raster';
import type { FlowNodeData } from '../model/types';

export type PaperSize = 'a4' | 'a3';

export interface PrintOptions {
  paper: PaperSize;
  /** 横向打印 */
  landscape: boolean;
  /** 截图倍率（决定打印清晰度） */
  scale: number;
  /** 页边距（px，96dpi） */
  margin: number;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paper: 'a4',
  landscape: false,
  scale: 2,
  margin: 24,
};

/** 纸张像素尺寸（96dpi） */
const PAPER_PX: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 794, height: 1123 },
  a3: { width: 1123, height: 1587 },
};

export const PAPER_OPTIONS: PaperSize[] = ['a4', 'a3'];

/** 计算分页网格（导出的页码与页数可据此提示用户） */
export function printGrid(
  content: { width: number; height: number },
  options: PrintOptions,
): { cols: number; rows: number; pageWidth: number; pageHeight: number } {
  const paper = PAPER_PX[options.paper];
  const pageWidth = options.landscape ? paper.height : paper.width;
  const pageHeight = options.landscape ? paper.width : paper.height;
  const innerW = Math.max(1, pageWidth - options.margin * 2);
  const innerH = Math.max(1, pageHeight - options.margin * 2);
  return {
    cols: Math.max(1, Math.ceil(content.width / innerW)),
    rows: Math.max(1, Math.ceil(content.height / innerH)),
    pageWidth,
    pageHeight,
  };
}

/** 纸张尺寸与内容区（同一份打印任务共用同一纸张，保证多页尺寸一致） */
function paperLayout(options: PrintOptions) {
  const { pageWidth, pageHeight } = printGrid({ width: 1, height: 1 }, options);
  return {
    pageWidth,
    pageHeight,
    innerW: pageWidth - options.margin * 2,
    innerH: pageHeight - options.margin * 2,
    orientation: (options.landscape ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
  };
}

/**
 * 把一张整图位图按纸张切片追加到 PDF，返回追加后的总页数。
 * 负偏移让当前切片落在纸张内容区内；页面自身会裁掉超出部分。
 */
function appendSlices(
  pdf: jsPDF,
  shot: { dataUrl: string; width: number; height: number },
  options: PrintOptions,
  layout: ReturnType<typeof paperLayout>,
  startIndex: number,
): number {
  const { cols, rows } = printGrid({ width: shot.width, height: shot.height }, options);
  let pageIndex = startIndex;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (pageIndex > 0) pdf.addPage([layout.pageWidth, layout.pageHeight], layout.orientation);
      pdf.addImage(
        shot.dataUrl,
        'PNG',
        options.margin - col * layout.innerW,
        options.margin - row * layout.innerH,
        shot.width,
        shot.height,
      );
      pageIndex += 1;
    }
  }
  return pageIndex;
}

/** 截取打印用的整图位图（与导出同一管线，保证保真度一致） */
function captureForPrint(nodes: Node<FlowNodeData>[], options: PrintOptions, name: string) {
  return capturePage(name, nodes, {
    format: 'png',
    scale: options.scale,
    transparent: false,
    padding: 8,
    range: 'current',
  });
}

/**
 * 把构件导出为分页 PDF。
 * nodes 需为「当前画布上已渲染的那一页」的节点集合。
 */
export async function exportPrintPdf(
  nodes: Node<FlowNodeData>[],
  options: PrintOptions,
  filename: string,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  const shot = await captureForPrint(nodes, options, filename);
  if (!shot) return { ok: false, error: nodes.length === 0 ? 'EMPTY' : 'EXPORT_FAILED' };

  const layout = paperLayout(options);
  const pdf = new jsPDF({
    unit: 'px',
    format: [layout.pageWidth, layout.pageHeight],
    orientation: layout.orientation,
  });
  const pages = appendSlices(pdf, shot, options, layout, 0);
  pdf.save(`${filename}.pdf`);
  return { ok: true, pages };
}

/**
 * 多页打印：把每一页的整图位图依次切片，合并为一个 PDF。
 * 调用方需保证每个 `dataUrl` 是在对应页处于活动状态时截取的（与多页位图导出一致）。
 */
export async function exportPrintPdfSet(
  captures: CapturedPage[],
  options: PrintOptions,
  filename: string,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  if (captures.length === 0) return { ok: false, error: 'EMPTY' };
  const layout = paperLayout(options);
  const pdf = new jsPDF({
    unit: 'px',
    format: [layout.pageWidth, layout.pageHeight],
    orientation: layout.orientation,
  });
  let pageIndex = 0;
  for (const shot of captures) pageIndex = appendSlices(pdf, shot, options, layout, pageIndex);
  pdf.save(`${filename}.pdf`);
  return { ok: true, pages: pageIndex };
}
