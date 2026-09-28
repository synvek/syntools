import JSZip from 'jszip';
import type { ToolResult } from '@/core/types';
import { createLayout, createMaster } from '../model/factory';
import { extensionForMime } from '../model/media';
import type { SlideDoc } from '../model/types';
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

  // 母版/版式内容此前被整段丢弃（只写一个空母版 + 空白版式），导入再导出会丢掉
  // 母版上的 Logo、页码等公共元素。这里按文档真实内容逐个部件写出。
  const masters = doc.masters.length > 0 ? doc.masters : [createMaster()];
  const layouts = doc.layouts.length > 0 ? doc.layouts : [createLayout()];
  const masterIndexById = new Map(masters.map((master, index) => [master.id, index]));
  // 版式找不到所属母版时挂到第 1 个母版，避免出现悬空 rel
  const layoutMasterIndex = layouts.map((layout) => masterIndexById.get(layout.masterId) ?? 0);

  // 母版/版式元素里可能引用图片，用空 relMap：媒体只随幻灯片导出，母版图片暂不内联
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
  // 有备注的页需要额外写 notesSlide 部件，并同步到 [Content_Types].xml
  const notesSlides = doc.slides
    .map((slide, index) => ({ slide, number: index + 1 }))
    .filter((entry) => Boolean(entry.slide.notes?.trim()));
  const notesNumbers = notesSlides.map((entry) => entry.number);
  // [Content_Types].xml 需要知道备注页数量，故先算再写
  zip.file('[Content_Types].xml', contentTypes(doc, layouts.length, masters.length, notesNumbers));

  resetShapeIds();
  doc.slides.forEach((slide, index) => {
    // 隐藏元素不导出，与画布渲染保持一致
    const elements = slide.elements.filter((element) => element.visible !== false);
    const relMap = relMapFor(elements, mediaEntries);
    const rels = mediaEntries
      .filter((entry) => relMap.has(entry.mediaId))
      .map((entry) => ({ rId: relMap.get(entry.mediaId) as string, target: entry.fileName }));
    const notes = slide.notes?.trim()
      ? // 图片关系占用 rId2..rId(n+1)，备注取下一个空位避免冲突
        { rId: `rId${rels.length + 2}`, target: `notesSlide${index + 1}.xml` }
      : null;
    zip.file(`ppt/slides/slide${index + 1}.xml`, slideXml(elements, relMap, slide.background));
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
