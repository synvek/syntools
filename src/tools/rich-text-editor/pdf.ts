import type { ToolResult } from '@/core/types';
import { applyPagedBreaks, planPageStarts } from './PageView';
import { isFloatingImageElement } from './imageLayer';
import {
  DEFAULT_PAGE_SETUP,
  normalizePageSetup,
  pageMetricsToPx,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';
import { parseSectionBreakElement, type SectionedBlock } from './sections';

/**
 * PDF export adapter layer:
 * - Mode 1 (text): handed to the browser print view, producing a selectable, searchable text PDF
 *   (CJK text renders correctly);
 * - Mode 2 (snapshot): lay out at the content width, rasterize, then slice on block boundaries into a
 *   multi-page PDF.
 *
 * Both modes share one page setup (paper/margins/orientation), keeping the layout identical.
 */

const MAX_PAGES = 200;
/** Chunked-render threshold for large documents (px): above it, toPng runs per page segment to avoid one huge canvas */
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
 * Whether the current environment supports a print dialog.
 * In desktop WebViews like Tauri (WKWebView / WebView2), window.print() silently does nothing, so PDF
 * export must fall back to snapshot mode there.
 */
export function printSupported(): boolean {
  return !('__TAURI_INTERNALS__' in window) && !('__TAURI__' in window);
}

/**
 * Print the whole document (relies on the user choosing "Save as PDF" in the print dialog).
 * @param flow The print flow container in page view: applies the same block pagination as the on-screen
 *             page view, so with CSS `break-before: page` the printed pagination matches what you see.
 */
export function printToPdf(flow?: HTMLElement | null, setup?: PageSetupConfig | null): void {
  const metrics = resolvePageMetrics(setup ?? DEFAULT_PAGE_SETUP);
  // With multiple columns, let the browser/print engine flow by column; forced block breaks would cut the columns wrongly
  if (flow && metrics.columns === 1) applyPagedBreaks(flow, metrics);
  window.print();
}

/**
 * High-fidelity PDF: rasterize the whole container laid out at the A4 content width,
 * then slice it on block boundaries into a multi-page A4 image PDF.
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
    // Available content height in CSS px, taken from the page metrics (not derived from the container
    // width) so the slice height is the exact number the on-screen page view paginated with.
    const pageHeightPx = pageMetricsToPx(metrics).contentHeightPx;
    const baseTop = container.getBoundingClientRect().top;

    // Section-aware slicing: the snapshot PDF must paginate exactly like the on-screen page view,
    // otherwise a multi-section document exports a different page count than it displays.
    const setups: PageSetupConfig[] = [setup];
    const blocks: SectionedBlock[] = [];
    for (const child of Array.from(container.children)) {
      const el = child as HTMLElement;
      if (el.hasAttribute('data-section-break')) {
        const parsedSetup = parseSectionBreakElement(el, setup);
        setups.push(parsedSetup.pageSetup);
        // Zero-height block: the forced page start belongs to the next visible block
        blocks.push({ top: 0, height: 0, section: setups.length - 1 });
        continue;
      }
      // Floating images are out of the text flow (same rule as on-screen pagination)
      if (isFloatingImageElement(el)) {
        blocks.push({ top: 0, height: 0, section: setups.length - 1 });
        continue;
      }
      const rect = el.getBoundingClientRect();
      blocks.push({ top: rect.top - baseTop, height: rect.height, section: setups.length - 1 });
    }

    // Multi-column layout is flowed by the browser/Word itself, and block-based page cutting drifts
    // under columns, so slice at a fixed page height to stay consistent with print/Word column flow
    let cuts: number[];
    let pageSections: number[];
    if (metrics.columns > 1) {
      const fixed = Array.from(
        { length: Math.max(0, Math.ceil(height / pageHeightPx) - 1) },
        (_, index) => (index + 1) * pageHeightPx,
      );
      cuts = fixed;
      pageSections = [0, ...fixed.map(() => 0)];
    } else {
      // Same planner as the page view and the print path: it also honors explicit page-break nodes
      // (a block after a break must start a page), so the snapshot can't drift from the screen.
      const starts = planPageStarts(Array.from(container.children), blocks, pageHeightPx);
      cuts = starts.map((index) => blocks[index].top);
      pageSections = [0, ...starts.map((index) => blocks[index].section)];
    }
    const bounds = [0, ...cuts, height];
    const pages = bounds
      .slice(0, -1)
      .map((start, index) => ({
        start,
        height: bounds[index + 1] - start,
        // Empty pages are filtered out below, so carry the section index on the page itself
        section: pageSections[index] ?? 0,
      }))
      .filter((page) => page.height > 1)
      .slice(0, MAX_PAGES);
    if (pages.length === 0) return { ok: false, error: 'RENDER_FAILED' };

    // Rasterize large documents in height chunks, avoiding one oversized canvas (browser size limits / memory)
    const pixelRatio = height > CHUNK_HEIGHT_PX ? 1.5 : 2;
    const background = setup.background ?? '#ffffff';
    const source = await rasterize(container, width, height, pixelRatio, onProgress, background);
    const renderedRatio = source.height / height;

    const { jsPDF } = await import('jspdf');
    // First page defines the PDF's initial format; later pages may differ (one paper size per section)
    const firstSetup = setups[pages[0]?.section ?? 0] ?? setup;
    const firstMetrics = resolvePageMetrics(firstSetup);
    const doc = new jsPDF({
      unit: 'mm',
      format: [firstMetrics.widthMm, firstMetrics.heightMm],
      orientation: 'portrait',
      compress: true,
    });
    // Page background: the snapshot is already filled, so only the sheet margins outside the content area need it
    if (firstSetup.background) {
      doc.setFillColor(firstSetup.background);
      doc.rect(0, 0, firstMetrics.widthMm, firstMetrics.heightMm, 'F');
    }

    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i];
      const pageSetup = setups[page.section] ?? setup;
      const pageMetrics = resolvePageMetrics(pageSetup);
      if (i > 0) doc.addPage([pageMetrics.widthMm, pageMetrics.heightMm], 'portrait');
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
      const pageHeightMm = Math.min(pageMetrics.contentHeightMm, page.height / pxPerMm);
      doc.addImage(
        pageUrl,
        'JPEG',
        pageSetup.margin.left,
        pageSetup.margin.top,
        // Content width stays the document width: the snapshot is rendered once at that width
        metrics.contentWidthMm,
        pageHeightMm,
      );
      // Watermark: drawn as text over the snapshot so opacity and rotation stay controllable
      drawWatermark(doc, pageSetup, pageMetrics);
      // Header / footer / page number (drawn as text over the snapshot)
      drawHeaderFooter(doc, pageSetup, pageMetrics, i + 1);
      onProgress?.((i + 1) / pages.length);
    }

    const output = doc.output('arraybuffer');
    return { ok: true, value: new Uint8Array(output) };
  } catch {
    return { ok: false, error: 'SNAPSHOT_FAILED' };
  }
}

/**
 * Rasterize the container into a canvas: above the chunk threshold, render in height segments and
 * stitch them, avoiding one oversized canvas hitting browser size limits or memory spikes.
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

/** Hex color -> RGB triple (jsPDF sets colors per channel) */
function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16) || 0,
    Number.parseInt(value.slice(2, 4), 16) || 0,
    Number.parseInt(value.slice(4, 6), 16) || 0,
  ];
}

/**
 * Draw the text watermark on a snapshot page.
 * Consistent with screen/print: centered in the content area, tilted by the inverse of rotation, with
 * opacity controlled via GState.
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
  // Font size scales with content width, keeping the same visual ratio as the vw-sized text on screen
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

/** Draw header / footer / page number on a snapshot page (header mid top margin, footer mid bottom margin) */
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
