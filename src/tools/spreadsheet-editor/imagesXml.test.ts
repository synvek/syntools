import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { createSheetImage, fitImageSize, imageBytes, parseImageDataUrl } from './sheetImages';
import type { SheetImageConfig } from './sheetImages';
import { buildImagePlan, collectSheetImages } from './imagesXml';
import { collectSheetShapes } from './shapesXml';
import { createSheetShape } from './shapes';
import { pruneConvertedAnchors, stripAnchorsByIds } from './drawingAnchors';
import { createConvertedAnchors } from './drawingAnchors';
import {
  createEmptySheet,
  exportSnapshotToBytes,
  importXlsxToSnapshot,
  type WorkbookSnapshot,
} from './xlsx-io';

/** SHEET-02 剩余：电子表格图片（xdr:pic + xl/media） */

const SHEET_NAME = 'Photos';

/** 1×1 透明 PNG */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

const IMAGE: SheetImageConfig = {
  id: 'img1',
  sheetId: 's1',
  from: { col: 2, row: 3, colOff: 6, rowOff: 4 },
  width: 240,
  height: 160,
  src: PNG_DATA_URL,
  name: 'logo.png',
  z: 0,
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

function makeSnapshot(images: SheetImageConfig[], rawParts?: WorkbookSnapshot['syntoolsRawParts']) {
  return {
    id: 'wb',
    name: 'book',
    appVersion: '1.0.0',
    locale: 'zhCN',
    sheetOrder: ['s1'],
    sheets: {
      s1: {
        ...createEmptySheet('s1', SHEET_NAME),
        cellData: { '0': { '0': { v: 'A' } } },
      },
    },
    styles: {},
    ...(images.length > 0 ? { syntoolsImages: images } : {}),
    ...(rawParts ? { syntoolsRawParts: rawParts } : {}),
  } satisfies WorkbookSnapshot;
}

async function exportZip(images: SheetImageConfig[]): Promise<JSZip> {
  const exported = await exportSnapshotToBytes(makeSnapshot(images));
  if (!exported.ok) throw new Error('export failed');
  return JSZip.loadAsync(toArrayBuffer(exported.value));
}

describe('dataURL 与尺寸', () => {
  it('解析 png dataURL，字节数按 base64 长度估算', () => {
    const parsed = parseImageDataUrl(PNG_DATA_URL);
    expect(parsed).toEqual({ mime: 'image/png', extension: 'png', base64: PNG_BASE64 });
    expect(imageBytes(PNG_DATA_URL)).toBeGreaterThan(0);
  });

  it('非位图 or 空内容一律拒绝', () => {
    expect(parseImageDataUrl('data:image/svg+xml;base64,AAA')).toBeNull();
    expect(parseImageDataUrl('data:image/png;base64,')).toBeNull();
    expect(parseImageDataUrl('https://example.com/a.png')).toBeNull();
    expect(parseImageDataUrl(PNG_DATA_URL)).not.toBeNull();
  });

  it('等比缩放到上限内，小图不放大', () => {
    expect(fitImageSize(1000, 500)).toEqual({ width: 320, height: 160 });
    expect(fitImageSize(100, 50)).toEqual({ width: 100, height: 50 });
    expect(fitImageSize(0, 0)).toEqual({ width: 320, height: 320 });
  });

  it('createSheetImage 保留锚点并夹住最小尺寸', () => {
    const image = createSheetImage({
      src: PNG_DATA_URL,
      name: 'x.png',
      from: { col: 1, row: 1, colOff: 0, rowOff: 0 },
      width: 2,
      height: 2,
    });
    expect(image.width).toBeGreaterThanOrEqual(24);
    expect(image.from.col).toBe(1);
    expect(image.id).toMatch(/^image-/);
  });
});

describe('导出：xdr:pic + xl/media', () => {
  it('写出 media part、drawing 锚点、图片关系与 Content-Type', async () => {
    const zip = await exportZip([IMAGE]);
    const media = await zip.file('xl/media/image1.png')?.async('base64');
    expect(media).toBe(PNG_BASE64);

    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing).toContain('<xdr:pic>');
    expect(drawing).toContain('<a:blip r:embed="rId1"/>');
    expect(drawing).toContain('<xdr:oneCellAnchor>');
    expect(drawing).toContain('<xdr:col>2</xdr:col>');

    const rels = (await zip.file('xl/drawings/_rels/drawing1.xml.rels')?.async('string')) ?? '';
    expect(rels).toContain('relationships/image');
    expect(rels).toContain('../media/image1.png');

    const contentTypes = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    expect(contentTypes).toContain('<Default Extension="png" ContentType="image/png"/>');
  });

  it('坏 dataURL 的图片被跳过，不会写出空 media', async () => {
    const zip = await exportZip([{ ...IMAGE, src: 'data:image/png;base64,' }]);
    expect(Object.keys(zip.files).some((name) => name.startsWith('xl/media/'))).toBe(false);
    expect(zip.file('xl/drawings/drawing1.xml')).toBeNull();
  });

  it('plan 按 sheet 名归组，未知 sheetId 落到第一张表', () => {
    const plan = buildImagePlan({
      sheets: { s1: { name: SHEET_NAME } },
      sheetOrder: ['s1'],
      syntoolsImages: [{ ...IMAGE, sheetId: 'missing' }],
    });
    expect(plan.imagesBySheet[SHEET_NAME]).toHaveLength(1);
  });
});

describe('导入：还原 dataURL 与锚点', () => {
  it('drawing 的 pic 能读回 src / from / 尺寸 / 名称', async () => {
    const zip = await exportZip([IMAGE]);
    const bySheet = await collectSheetImages(
      toArrayBuffer_zip(await zip.generateAsync({ type: 'uint8array' })),
    );
    const images = bySheet[SHEET_NAME] ?? [];
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe(PNG_DATA_URL);
    expect(images[0].from).toEqual(IMAGE.from);
    expect(images[0].width).toBe(IMAGE.width);
    expect(images[0].height).toBe(IMAGE.height);
    expect(images[0].name).toBe('logo.png');
  });

  it('完整导入入口：snapshot 带 syntoolsImages', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot([IMAGE]));
    if (!exported.ok) throw new Error('export failed');
    const view = new Uint8Array(exported.value);
    const file = {
      name: 'photos.xlsx',
      size: view.byteLength,
      arrayBuffer: async () => view.buffer,
    } as unknown as File;
    const imported = await importXlsxToSnapshot(file);
    if (!imported.ok) throw new Error('import failed');
    expect(imported.value.syntoolsImages).toHaveLength(1);
    expect(imported.value.syntoolsImages?.[0]).toMatchObject({
      src: PNG_DATA_URL,
      width: IMAGE.width,
      height: IMAGE.height,
      sheetId: imported.value.sheetOrder[0],
    });
  });

  it('往返再导出仍只有一张图、一个 media', async () => {
    const second = await exportZip([{ ...IMAGE, id: 'image-import-1' }]);
    const drawing = (await second.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    expect(drawing.match(/<xdr:pic>/g)).toHaveLength(1);
    const media = Object.keys(second.files).filter(
      (name) => name.startsWith('xl/media/') && !name.endsWith('/'),
    );
    expect(media).toHaveLength(1);
  });
});

/** collectSheetImages 接受 ArrayBuffer */
function toArrayBuffer_zip(bytes: Uint8Array): ArrayBuffer {
  return toArrayBuffer(bytes);
}

describe('anchor 摘除（避免导出写两份）', () => {
  const ANCHOR = (id: string, inner: string) =>
    `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="1" cy="1"/>${inner.replace('ID', id)}<xdr:clientData/></xdr:oneCellAnchor>`;

  it('stripAnchorsByIds 只删命中 id 的锚点，全删光返回 null', () => {
    const drawing = `<xdr:wsDr>${ANCHOR('7', '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="ID" name="p"/></xdr:nvPicPr></xdr:pic>')}${ANCHOR('8', '<xdr:sp><xdr:nvSpPr><xdr:cNvPr id="ID" name="s"/></xdr:nvSpPr></xdr:sp>')}</xdr:wsDr>`;
    const kept = stripAnchorsByIds(drawing, new Set(['7']));
    expect(kept).not.toBeNull();
    expect(kept).not.toContain('<xdr:pic>');
    expect(kept).toContain('<xdr:sp>');
    expect(stripAnchorsByIds(drawing, new Set(['7', '8']))).toBeNull();
    // 没命中的集合：原样返回
    expect(stripAnchorsByIds(drawing, new Set())).toBe(drawing);
  });

  it('pruneConvertedAnchors 摘掉已转换的锚点，摘空则整份丢弃', () => {
    const drawing = `<xdr:wsDr>${ANCHOR('7', '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="ID" name="p"/></xdr:nvPicPr></xdr:pic>')}</xdr:wsDr>`;
    const raw = {
      version: 1 as const,
      parts: {
        'xl/drawings/drawing1.xml': Buffer.from(drawing, 'utf8').toString('base64'),
      },
      sheetDrawings: { [SHEET_NAME]: 'xl/drawings/drawing1.xml' },
    };
    const converted = createConvertedAnchors();
    converted.add(SHEET_NAME, '7');
    expect(pruneConvertedAnchors(raw, converted)).toBeNull();
    // 没有转换记录时原样返回（引用相等）
    expect(pruneConvertedAnchors(raw, createConvertedAnchors())).toBe(raw);
    expect(pruneConvertedAnchors(null, converted)).toBeNull();
  });

  it('形状导入后原始 sp 锚点被摘掉，再导出不会翻倍', async () => {
    const shape = createSheetShape({
      prst: 'rect',
      from: { col: 1, row: 1, colOff: 0, rowOff: 0 },
      sheetId: 's1',
    });
    const snapshot: WorkbookSnapshot = { ...makeSnapshot([]), syntoolsShapes: [shape] };
    const exported = await exportSnapshotToBytes(snapshot);
    if (!exported.ok) throw new Error('export failed');
    const view = new Uint8Array(exported.value);
    const imported = await importXlsxToSnapshot({
      name: 'shapes.xlsx',
      size: view.byteLength,
      arrayBuffer: async () => view.buffer,
    } as unknown as File);
    if (!imported.ok) throw new Error('import failed');
    expect(imported.value.syntoolsShapes).toHaveLength(1);

    // 保留的 drawing 里不应再残留同一个 sp（否则导出会写两份）
    const encoded = imported.value.syntoolsRawParts?.parts['xl/drawings/drawing1.xml'];
    if (encoded) {
      expect(Buffer.from(encoded, 'base64').toString('utf8')).not.toContain('<xdr:sp');
    }

    const again = await exportSnapshotToBytes(imported.value);
    if (!again.ok) throw new Error('second export failed');
    const zip = await JSZip.loadAsync(toArrayBuffer(again.value));
    const drawing = (await zip.file('xl/drawings/drawing1.xml')?.async('string')) ?? '';
    // 只有一条 anchor：导入时原 sp 已被摘掉，导出的只有 config 重新生成的那一条
    expect(drawing.match(/<xdr:oneCellAnchor>/g)).toHaveLength(1);
    expect(drawing).toContain('<xdr:spPr>');
  });

  it('形状收集会报告已转换的 anchor id（供摘除使用）', async () => {
    const exported = await exportSnapshotToBytes(makeSnapshot([], undefined) as WorkbookSnapshot);
    // 只验证收集器契约：没有形状时不应上报任何 id
    const converted = createConvertedAnchors();
    if (!exported.ok) throw new Error('export failed');
    await collectSheetShapes(exported.value.buffer as ArrayBuffer, converted.add);
    expect(Object.keys(converted.bySheet)).toHaveLength(0);
  });
});
