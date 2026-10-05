/**
 * 分页打印导出：把整张图按纸张尺寸切片，输出多页 PDF。
 *
 * 实现方式：先用与导出同一条 DOM 截图管线拿到整图位图，
 * 再按「纸张内容区」逐页铺贴——每页把位图按负偏移定位，
 * 由 PDF 页面自身的裁剪得到分页效果（无需二次裁剪图片）。
 */

import { jsPDF } from 'jspdf';
import type { Node } from '@xyflow/react';
import { capturePage } from './raster';
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

/**
 * 把构件导出为分页 PDF。
 * nodes 需为「当前画布上已渲染的那一页」的节点集合。
 */
export async function exportPrintPdf(
  nodes: Node<FlowNodeData>[],
  options: PrintOptions,
  filename: string,
): Promise<{ ok: true; pages: number } | { ok: false; error: string }> {
  const shot = await capturePage(filename, nodes, {
    format: 'png',
    scale: options.scale,
    transparent: false,
    padding: 8,
    range: 'current',
  });
  if (!shot) return { ok: false, error: nodes.length === 0 ? 'EMPTY' : 'EXPORT_FAILED' };

  const { cols, rows, pageWidth, pageHeight } = printGrid(
    { width: shot.width, height: shot.height },
    options,
  );
  const innerW = pageWidth - options.margin * 2;
  const innerH = pageHeight - options.margin * 2;
  const orientation = options.landscape ? 'landscape' : 'portrait';

  const pdf = new jsPDF({ unit: 'px', format: [pageWidth, pageHeight], orientation });
  let pageIndex = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (pageIndex > 0) pdf.addPage([pageWidth, pageHeight], orientation);
      // 负偏移让当前切片落在纸张内容区内；页面自身会裁掉超出部分
      pdf.addImage(
        shot.dataUrl,
        'PNG',
        options.margin - col * innerW,
        options.margin - row * innerH,
        shot.width,
        shot.height,
      );
      pageIndex += 1;
    }
  }
  pdf.save(`${filename}.pdf`);
  return { ok: true, pages: pageIndex };
}
