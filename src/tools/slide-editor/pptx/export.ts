import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';
import { extensionForMime } from '../model/media';
import type { SlideDoc } from '../model/types';
import {
  appXml,
  contentTypes,
  coreXml,
  presentationRels,
  presentationXml,
  rootRels,
  slideLayoutRels,
  slideLayoutXml,
  slideMasterRels,
  slideMasterXml,
  themeXml,
} from './templates';
import { resetShapeIds, slideRelsXml, slideXml } from './write';

/** PPTX 导出：SlideDoc → 可被 PowerPoint / WPS / LibreOffice 打开的 OPC 包 */

export type SlideExportErrorCode = 'EMPTY' | 'EXPORT_FAILED';

interface MediaEntry {
  mediaId: string;
  fileName: string;
  bytes: Uint8Array;
}

/** 收集文档里真正被引用到的媒体（按 mediaId 去重） */
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

/** 每张幻灯片用到的 mediaId → rId（从 rId2 起，rId1 固定给 layout） */
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

export async function exportPptx(doc: SlideDoc): Promise<ToolResult<Uint8Array>> {
  if (doc.slides.length === 0) return { ok: false, error: 'EMPTY' };
  const zip = new JSZip();
  const mediaEntries = collectMedia(doc);

  zip.file('[Content_Types].xml', contentTypes(doc));
  zip.file('_rels/.rels', rootRels());
  zip.file('docProps/core.xml', coreXml(doc.name || 'presentation'));
  zip.file('docProps/app.xml', appXml(doc.slides.length, doc.name || 'presentation'));
  zip.file('ppt/presentation.xml', presentationXml(doc.slides.length, doc));
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels(doc.slides.length));
  zip.file('ppt/theme/theme1.xml', themeXml(doc.theme));
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml(1));
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels());
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml(doc.name || 'Title Slide', 'blank'));
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels());

  for (const entry of mediaEntries) {
    zip.file(`ppt/media/${entry.fileName}`, entry.bytes);
  }

  resetShapeIds();
  doc.slides.forEach((slide, index) => {
    const relMap = relMapFor(slide.elements, mediaEntries);
    const rels = mediaEntries
      .filter((entry) => relMap.has(entry.mediaId))
      .map((entry) => ({ rId: relMap.get(entry.mediaId) as string, target: entry.fileName }));
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      slideXml(slide.elements, relMap, slide.background),
    );
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, slideRelsXml(rels));
  });

  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
  return { ok: true, value: new Uint8Array(buffer) };
}
