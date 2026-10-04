import type { ToolResult } from '@/core/types';
import { computePageBreaks } from './core';
import { applyPagedBreaks } from './PageView';
import {
  DEFAULT_PAGE_SETUP,
  normalizePageSetup,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';

/**
 * PDF 导出适配层：
 * - 模式一（text）：交给浏览器打印视图，生成可选可检索的文字 PDF（中文不乱码）；
 * - 模式二（snapshot）：按内容宽度排版后光栅化，再按块级边界切片拼成多页 PDF。
 *
 * 两种模式共用同一份页面设置（纸张/边距/方向），确保版式一致。
 */

const MAX_PAGES = 200;
/** 大文档分片渲染阈值（px）：超过时按页区段分片 toPng，避免单张超大 canvas */
const CHUNK_HEIGHT_PX = 6000;

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
    img.src = dataUrl;
  });
}

/**
 * 当前环境是否支持打印对话框。
 * Tauri 等桌面 WebView（WKWebView / WebView2）中 window.print() 静默无效，
 * 此时导出 PDF 应回退到快照模式。
 */
export function printSupported(): boolean {
  return !('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window);
}

/**
 * 打印整篇文档（依赖用户在打印对话框中选择「另存为 PDF」）。
 * @param flow 页面视图下传入打印流容器：套用与屏幕页面视图同一套块级分页，
 *             配合 CSS `break-before: page` 使打印分页与所见一致。
 */
export function printToPdf(flow?: HTMLElement | null, setup?: PageSetupConfig | null): void {
  const metrics = resolvePageMetrics(setup ?? DEFAULT_PAGE_SETUP);
  // 多栏时交给浏览器/打印引擎按列自然流排，块级强制换页会把列布局切错
  if (flow && metrics.columns === 1) applyPagedBreaks(flow, metrics);
  window.print();
}

/**
 * 高保真 PDF：把按 A4 内容宽度排版的容器整体光栅化，
 * 再按块级元素的边界切片为多页 A4 图片 PDF。
 */
export async function snapshotToPdf(
  container: HTMLElement,
  onProgress?: (value: number) => void,
  setupInput?: PageSetupConfig | null,
): Promise<ToolResult<Uint8Array>> {
  try {
    const setup = normalizePageSetup(setupInput ?? DEFAULT_PAGE_SETUP);
    const metrics = resolvePageMetrics(setup);
    const width = container.clientWidth;
    const height = container.scrollHeight;
    if (!width || !height) return { ok: false, error: 'RENDER_FAILED' };

    const pxPerMm = width / metrics.contentWidthMm;
    const pageHeightPx = metrics.contentHeightMm * pxPerMm;
    const baseTop = container.getBoundingClientRect().top;
    const items = Array.from(container.children).map((child) => {
      const rect = child.getBoundingClientRect();
      return { top: rect.top - baseTop, height: rect.height };
    });
    // 分栏排版由浏览器/Word 自行流排，块级切页算法在列布局下会错位，
    // 因此多栏时按固定页高切片，与打印/Word 的列流保持一致
    const cuts =
      metrics.columns > 1
        ? Array.from(
            { length: Math.max(0, Math.ceil(height / pageHeightPx) - 1) },
            (_, index) => (index + 1) * pageHeightPx,
          )
        : computePageBreaks(items, pageHeightPx);
    const bounds = [0, ...cuts, height];
    const pages = bounds
      .slice(0, -1)
      .map((start, index) => ({ start, height: bounds[index + 1] - start }))
      .filter((page) => page.height > 1)
      .slice(0, MAX_PAGES);
    if (pages.length === 0) return { ok: false, error: 'RENDER_FAILED' };

    // 大文档按高度分片光栅化，避免单张超大 canvas（浏览器尺寸上限/内存）
    const pixelRatio = height > CHUNK_HEIGHT_PX ? 1.5 : 2;
    const background = setup.background ?? '#ffffff';
    const source = await rasterize(container, width, height, pixelRatio, onProgress, background);
    const renderedRatio = source.height / height;

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({
      unit: 'mm',
      format: [metrics.widthMm, metrics.heightMm],
      orientation: 'portrait',
      compress: true,
    });
    // 页面背景：快照已按背景色填充，这里只需补内容区之外的纸张边距
    if (setup.background) {
      doc.setFillColor(setup.background);
      doc.rect(0, 0, metrics.widthMm, metrics.heightMm, 'F');
    }

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      if (i > 0) doc.addPage();
      const sliceHeightPx = Math.max(
        1,
        Math.min(
          Math.round(page.height * renderedRatio),
          source.height - Math.round(page.start * renderedRatio),
        ),
      );
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = sliceHeightPx;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { ok: false, error: 'RENDER_FAILED' };
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, -Math.round(page.start * renderedRatio));
      const pageUrl = canvas.toDataURL('image/jpeg', 0.92);
      const pageHeightMm = Math.min(metrics.contentHeightMm, page.height / pxPerMm);
      doc.addImage(
        pageUrl,
        'JPEG',
        setup.margin.left,
        setup.margin.top,
        metrics.contentWidthMm,
        pageHeightMm,
      );
      // 水印：文本层叠在快照之上，保证透明度与旋转可控
      drawWatermark(doc, setup, metrics);
      // 页眉 / 页脚 / 页码（文本层叠在快照之上）
      drawHeaderFooter(doc, setup, metrics, i + 1);
      onProgress?.((i + 1) / pages.length);
    }

    const output = doc.output('arraybuffer');
    return { ok: true, value: new Uint8Array(output) };
  } catch {
    return { ok: false, error: 'SNAPSHOT_FAILED' };
  }
}

/**
 * 光栅化容器为 canvas：超过分片阈值时按高度分段渲染再拼接，
 * 避免单张超大 canvas 触发浏览器尺寸上限或内存峰值。
 */
async function rasterize(
  container: HTMLElement,
  widthPx: number,
  heightPx: number,
  ratio: number,
  onProgress?: (value: number) => void,
  background = '#ffffff',
): Promise<HTMLCanvasElement> {
  const { toPng } = await import('html-to-image');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(widthPx * ratio));
  canvas.height = Math.max(1, Math.round(heightPx * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (heightPx <= CHUNK_HEIGHT_PX) {
    const url = await toPng(container, {
      pixelRatio: ratio,
      backgroundColor: background,
      cacheBust: true,
    });
    const image = await loadImage(url);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  const total = Math.ceil(heightPx / CHUNK_HEIGHT_PX);
  for (let index = 0, offset = 0; offset < heightPx; index += 1, offset += CHUNK_HEIGHT_PX) {
    const chunk = Math.min(CHUNK_HEIGHT_PX, heightPx - offset);
    const url = await toPng(container, {
      pixelRatio: ratio,
      backgroundColor: background,
      cacheBust: true,
      width: widthPx,
      height: chunk,
      style: { transform: `translateY(${-offset}px)`, transformOrigin: 'top left' },
    });
    const image = await loadImage(url);
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      0,
      Math.round(offset * ratio),
      image.naturalWidth,
      image.naturalHeight,
    );
    onProgress?.((index + 1) / (total + 1));
  }
  return canvas;
}

/** 十六进制颜色 → RGB 三元组（jsPDF 需要分通道设置颜色） */
function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16) || 0,
    Number.parseInt(value.slice(2, 4), 16) || 0,
    Number.parseInt(value.slice(4, 6), 16) || 0,
  ];
}

/**
 * 在快照页上绘制文字水印。
 * 与屏幕/打印一致：位于内容区中心、按 rotation 反向倾斜、透明度由 GState 控制。
 */
function drawWatermark(
  doc: import('jspdf').jsPDF,
  setup: PageSetupConfig,
  metrics: { widthMm: number; heightMm: number; contentWidthMm: number; contentHeightMm: number },
): void {
  const watermark = setup.watermark;
  if (!watermark || !watermark.text.trim()) return;
  const [r, g, b] = hexToRgb(watermark.color);
  doc.saveGraphicsState();
  // 字号随内容宽度缩放：与屏幕用 vw 级字号保持同样的视觉比例
  doc.setFontSize(Math.max(24, Math.round(metrics.contentWidthMm * 0.9)));
  doc.setTextColor(r, g, b);
  const gState = (doc as unknown as { GState?: new (options: { opacity: number }) => unknown })
    .GState;
  const setGState = (doc as unknown as { setGState?: (state: unknown) => void }).setGState;
  if (gState && setGState) setGState.call(doc, new gState({ opacity: watermark.opacity }));
  doc.text(watermark.text, metrics.widthMm / 2, metrics.heightMm / 2, {
    align: 'center',
    baseline: 'middle',
    angle: -watermark.rotation,
  });
  doc.restoreGraphicsState();
}

/** 在快照页上绘制页眉 / 页脚 / 页码（页眉位于上边距中部，页脚位于下边距中部） */
function drawHeaderFooter(
  doc: import('jspdf').jsPDF,
  setup: PageSetupConfig,
  metrics: { widthMm: number; heightMm: number },
  page: number,
): void {
  doc.setFontSize(9);
  doc.setTextColor(110, 118, 129);
  const left = setup.margin.left;
  if (setup.header.trim()) {
    doc.text(setup.header.trim(), left, Math.max(4, setup.margin.top / 2));
  }
  const footerY = metrics.heightMm - Math.max(4, setup.margin.bottom / 2);
  if (setup.footer.trim()) {
    doc.text(setup.footer.trim(), left, footerY);
  }
  if (setup.showPageNumber) {
    const label = String(page);
    doc.text(label, metrics.widthMm - setup.margin.right - doc.getTextWidth(label), footerY);
  }
}
