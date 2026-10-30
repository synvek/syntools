import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';
import { createLayout, createMaster } from '../model/factory';
import { extensionForMime } from '../model/media';
import type { SlideDoc, SlideElement } from '../model/types';
import {
  appXml,
  contentTypes,
  coreXml,
  notesSlideRels,
  notesSlideXml,
  presentationRels,
  presentationXml,
  rootRels,
  slideLayoutRels,
  slideLayoutXml,
  slideMasterRels,
  slideMasterXml,
  themeXml,
} from './templates';
import { elementXml, resetShapeIds, slideRelsXml, slideXml } from './write';

/**
 * PPTX export dispatcher: SlideDoc → an OPC package that PowerPoint / WPS / LibreOffice can open.
 *
 * Two channels:
 * - `pptxgen` (default): goes through pptxgenjs for natively editable charts, masters, table merges and
 *   run-level spacing/baseline/highlight/hyperlinks; pptxgenjs is imported dynamically, costing nothing up front.
 * - `legacy` (compatibility / fallback): uses the hand-written DrawingML writer, behaving exactly like v1.
 *
 * If the default channel fails, it falls back to legacy automatically, so "export" never becomes completely
 * unusable just because the new engine hit unexpected data.
 */

export type SlideExportErrorCode = 'EMPTY' | 'EXPORT_FAILED';

/** Export channel */
export type PptxExportChannel = 'pptxgen' | 'legacy';

/** Export options: compatibility mode forces the hand-written channel */
export interface PptxExportOptions {
  channel?: PptxExportChannel;
}

interface MediaEntry {
  mediaId: string;
  fileName: string;
  bytes: Uint8Array;
}

/** Collect the media actually referenced by the document (de-duplicated by mediaId) */
function collectMedia(doc: SlideDoc): MediaEntry[] {
  const used = new Set<string>();
  for (const slide of doc.slides) {
    for (const element of slide.elements) {
      if (element.type === 'image') used.add(element.mediaId);
    }
  }
  const entries: MediaEntry[] = [];
  let index = 1;
  for (const [mediaId, asset] of Object.entries(doc.media)) {
    if (!used.has(mediaId)) continue;
    if (!asset.bytes) continue;
    const ext = extensionForMime(asset.mime);
    entries.push({ mediaId, fileName: `image${index}.${ext}`, bytes: asset.bytes });
    index += 1;
  }
  return entries;
}

/** mediaId used by each slide → rId (from rId2; rId1 is always the layout) */
function relMapFor(
  slideElements: SlideDoc['slides'][number]['elements'],
  mediaEntries: MediaEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  mediaEntries.forEach((entry, index) => map.set(entry.mediaId, `rId${index + 2}`));
  const referenced = new Set(
    slideElements
      .filter((element) => element.type === 'image')
      .map((element) => (element.type === 'image' ? element.mediaId : '')),
  );
  const result = new Map<string, string>();
  for (const [mediaId, rId] of map) {
    if (referenced.has(mediaId)) result.set(mediaId, rId);
  }
  return result;
}

/**
 * pptxgenjs writes no `p:transition` / `p:timing` at all, so any document with a transition or an
 * entrance animation has to go through the hand-written channel (P2-5.4). This is a hard routing
 * rule, not a fallback: the alternative would be losing the motion silently.
 */
export function hasSlideMotion(doc: SlideDoc): boolean {
  return doc.slides.some(
    (slide) =>
      Boolean(slide.transition && slide.transition.type !== 'none') ||
      (slide.animations?.length ?? 0) > 0,
  );
}

/**
 * 动画**单独**把文档推去手写通道时，会连带降级的元素数量（原生图表 / 公式在手写通道里只是占位框）。
 * 只统计"本来会走 pptxgen"的文档 —— 已经因为 avLst/custGeom 走手写通道的文档不用重复提示。
 */
export function motionExportDegradations(doc: SlideDoc): number {
  if (!hasSlideMotion(doc) || requiresLegacy(doc)) return 0;
  let count = 0;
  const walk = (elements: SlideElement[]): void => {
    for (const element of elements) {
      if (element.type === 'chart' || element.type === 'formula') count += 1;
      else if (element.type === 'group') walk(element.children);
    }
  };
  for (const slide of doc.slides) walk(slide.elements);
  return count;
}

/**
 * pptxgenjs does not expose shape adjustment values (`a:avLst`) or connector bindings
 * (`a:stCxn`/`a:endCxn`), so documents that use them must go through the hand-written channel.
 */
function requiresLegacy(doc: SlideDoc): boolean {
  const walk = (elements: SlideElement[]): boolean =>
    elements.some((element) => {
      if (element.type === 'shape') {
        // pptxgenjs has no path API, so custom geometry must go through the legacy writer
        if (element.geom.custGeom && element.geom.custGeom.length > 0) return true;
        return element.geom.adj !== undefined && Object.keys(element.geom.adj).length > 0;
      }
      if (element.type === 'line') {
        return Boolean(element.startCxn?.shapeId || element.endCxn?.shapeId);
      }
      if (element.type === 'group') return walk(element.children);
      return false;
    });
  return [...doc.slides, ...doc.masters, ...doc.layouts].some((container) =>
    walk(container.elements),
  );
}

/**
 * Export entry point.
 *
 * `channel` defaults to `pptxgen`; when that channel returns EXPORT_FAILED it falls back to legacy automatically.
 * Both channels share the `EMPTY` check: an empty document has nothing to export either way.
 */
export async function exportPptx(
  doc: SlideDoc,
  options: PptxExportOptions = {},
): Promise<ToolResult<Uint8Array>> {
  if (!doc.slides || doc.slides.length === 0) return { ok: false, error: 'EMPTY' };

  if (options.channel !== 'legacy' && !hasSlideMotion(doc) && !requiresLegacy(doc)) {
    const { exportPptxPptxGen } = await import('./exportPptxgen');
    const result = await exportPptxPptxGen(doc);
    if (result.ok) return result;
    // An empty document needs no fallback (legacy returns EMPTY too); other failures fall back
    if (result.error !== 'EMPTY') return exportPptxLegacy(doc);
    return result;
  }
  return exportPptxLegacy(doc);
}

/** Hand-written channel: explicit DrawingML (compatibility mode) */
export async function exportPptxLegacy(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
  const zip = new JSZip();
  const mediaEntries = collectMedia(doc);

  // Master/layout content used to be dropped entirely (an empty master + blank layout were written), so importing
  // and re-exporting lost the logo, slide numbers and other shared elements. Each part is now written from real content.
  const masters = doc.masters.length > 0 ? doc.masters : [createMaster()];
  const layouts = doc.layouts.length > 0 ? doc.layouts : [createLayout()];
  const masterIndexById = new Map(masters.map((master, index) => [master.id, index]));
  // A layout whose master can't be found attaches to the first master, avoiding a dangling rel
  const layoutMasterIndex = layouts.map((layout) => masterIndexById.get(layout.masterId) ?? 0);

  // Master/layout elements may reference images; use an empty relMap: media ships with slides only, master images aren't inlined yet
  const emptyRelMap = new Map<string, string>();
  const masterShapes = (index: number) =>
    (masters[index]?.elements ?? [])
      .filter((element) => element.visible !== false)
      .map((element) => elementXml(element, emptyRelMap))
      .join('');

  zip.file('_rels/.rels', rootRels());
  zip.file('docProps/core.xml', coreXml(doc.name || 'presentation'));
  zip.file('docProps/app.xml', appXml(doc.slides.length, doc.name || 'presentation'));
  zip.file('ppt/presentation.xml', presentationXml(doc.slides.length, doc, masters.length));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels(doc.slides.length, masters.length));
  zip.file('ppt/theme/theme1.xml', themeXml(doc.theme));

  masters.forEach((_master, index) => {
    zip.file(
      `ppt/slideMasters/slideMaster${index + 1}.xml`,
      slideMasterXml(layouts.length, masterShapes(index)),
    );
    zip.file(
      `ppt/slideMasters/_rels/slideMaster${index + 1}.xml.rels`,
      slideMasterRels(layouts.length),
    );
  });
  layouts.forEach((layout, index) => {
    const shapes = (layout.elements ?? [])
      .filter((element) => element.visible !== false)
      .map((element) => elementXml(element, emptyRelMap))
      .join('');
    zip.file(
      `ppt/slideLayouts/slideLayout${index + 1}.xml`,
      slideLayoutXml(layout.name || doc.name || 'Title Slide', 'blank', shapes),
    );
    zip.file(
      `ppt/slideLayouts/_rels/slideLayout${index + 1}.xml.rels`,
      slideLayoutRels(layoutMasterIndex[index]),
    );
  });

  for (const entry of mediaEntries) {
    zip.file(`ppt/media/${entry.fileName}`, entry.bytes);
  }

  const layoutIndexById = new Map(layouts.map((layout, index) => [layout.id, index]));
  // Slides with notes need extra notesSlide parts, mirrored into [Content_Types].xml
  const notesSlides = doc.slides
    .map((slide, index) => ({ slide, number: index + 1 }))
    .filter((entry) => Boolean(entry.slide.notes?.trim()));
  const notesNumbers = notesSlides.map((entry) => entry.number);
  // [Content_Types].xml needs the notes count, so compute it before writing
  zip.file('[Content_Types].xml', contentTypes(doc, layouts.length, masters.length, notesNumbers));

  resetShapeIds();
  doc.slides.forEach((slide, index) => {
    // Hidden elements are not exported, matching canvas rendering
    const elements = slide.elements.filter((element) => element.visible !== false);
    const relMap = relMapFor(elements, mediaEntries);
    const rels = mediaEntries
      .filter((entry) => relMap.has(entry.mediaId))
      .map((entry) => ({ rId: relMap.get(entry.mediaId) as string, target: entry.fileName }));
    const notes = slide.notes?.trim()
      ? // Image rels occupy rId2..rId(n+1); notes take the next free slot to avoid a clash
        { rId: `rId${rels.length + 2}`, target: `notesSlide${index + 1}.xml` }
      : null;
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      slideXml(elements, relMap, slide.background, {
        transition: slide.transition,
        animations: slide.animations,
      }),
    );
    zip.file(
      `ppt/slides/_rels/slide${index + 1}.xml.rels`,
      slideRelsXml(rels, layoutIndexById.get(slide.layoutId ?? '') ?? 0, notes),
    );
  });

  for (const entry of notesSlides) {
    zip.file(
      `ppt/notesSlides/notesSlide${entry.number}.xml`,
      notesSlideXml(entry.slide.notes ?? ''),
    );
    zip.file(
      `ppt/notesSlides/_rels/notesSlide${entry.number}.xml.rels`,
      notesSlideRels(entry.number),
    );
  }

  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  return { ok: true, value: new Uint8Array(buffer) };
}
