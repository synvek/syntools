import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { exportDocxBlob } from './docx';
import {
  buildShapeDrawingXml,
  injectDocumentNamespaces,
  injectShapeDrawings,
  replaceTokenParagraph,
  shapeToken,
  type ShapeExportEntry,
} from './docxShapeExport';
import { shapeSpec } from './shapeNode';

/**
 * P3-1.3 / P3-1.4: the token + zip post-processing path.
 *
 * Two levels are covered: the string helpers in isolation (structure assertions per anchor mode)
 * and a real `exportDocxBlob` run whose `word/document.xml` must contain the drawing and no token.
 */

const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blobToArrayBuffer(blob));
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

function entry(overrides: Partial<ShapeExportEntry> = {}): ShapeExportEntry {
  return {
    id: 's1',
    index: 1,
    attrs: shapeSpec({ prst: 'roundRect', adj: { adj1: 0.2 }, text: '' }),
    ...overrides,
  };
}

/** Shape markup as the editor serializes it (the docx writer reads these attributes) */
function shapeHtml(attrs: string): string {
  return `<div data-doc-shape="roundRect" data-shape-prst="roundRect" data-shape-w="170" data-shape-h="100" ${attrs}></div>`;
}

describe('shapeToken / 占位段替换', () => {
  it('token 只含 ASCII，避免转义与断行问题', () => {
    const token = shapeToken('s1');
    expect(token).toBe('@@SHAPE:s1@@');
    expect(/^[\x20-\x21\x23-\x7e]+$/.test(token)).toBe(true);
  });

  it('替换独占整段的 token 段落', () => {
    const xml =
      '<w:body><w:p><w:r><w:t>a</w:t></w:r></w:p><w:p><w:r><w:t>@@SHAPE:s1@@</w:t></w:r></w:p><w:p/></w:body>';
    const next = replaceTokenParagraph(xml, shapeToken('s1'), '<w:drawing/>');
    expect(next).not.toContain('@@SHAPE:s1@@');
    expect(next).toContain('<w:p><w:r><w:drawing/></w:r></w:p>');
    // Neighbouring paragraphs survive
    expect(next).toContain('<w:t>a</w:t>');
    expect(next).toContain('<w:p/>');
  });

  it('用户正文里出现相同文本时不误伤（整段内容不只有 token）', () => {
    const xml = '<w:p><w:r><w:t>前缀 @@SHAPE:s1@@ 后缀</w:t></w:r></w:p>';
    expect(replaceTokenParagraph(xml, shapeToken('s1'), '<w:drawing/>')).toBe(xml);
  });

  it('找不到 token 时原样返回', () => {
    const xml = '<w:body/>';
    expect(replaceTokenParagraph(xml, shapeToken('s9'), '<w:drawing/>')).toBe(xml);
  });
});

describe('wps:wsp 结构', () => {
  it('inline 形状写 wp:inline，并带 prstGeom + avLst', () => {
    const xml = buildShapeDrawingXml(entry());
    expect(xml).toContain('<wp:inline>');
    expect(xml).not.toContain('wp:anchor');
    expect(xml).toContain('<wps:wsp>');
    expect(xml).toContain('<a:prstGeom prst="roundRect">');
    expect(xml).toContain('<a:gd name="adj1" fmla="val 20000"/>');
    expect(xml).toContain('<a:srgbClr val="4472C4"/>');
  });

  it('六种锚定模式分别写成 inline / wrapSquare / wrapTopAndBottom / wrapNone + behindDoc', () => {
    const layers = [
      ['inline', ''],
      ['wrap-left', '<wp:wrapSquare wrapText="right"/>'],
      ['wrap-right', '<wp:wrapSquare wrapText="left"/>'],
      ['top-bottom', '<wp:wrapTopAndBottom/>'],
      ['front', '<wp:wrapNone/>'],
      ['behind', '<wp:wrapNone/>'],
    ] as const;
    for (const [layer, wrap] of layers) {
      const xml = buildShapeDrawingXml(
        entry({
          attrs: shapeSpec({ prst: 'rect', layer: layer as never, offsetX: 10, offsetY: 20 }),
        }),
      );
      if (layer === 'inline') {
        expect(xml).toContain('<wp:inline>');
        continue;
      }
      expect(xml).toContain('<wp:anchor');
      expect(xml).toContain(wrap);
      expect(xml).toContain(`behindDoc="${layer === 'behind' ? 1 : 0}"`);
      // Offsets are EMU (px × 9525)
      expect(xml).toContain(`<wp:posOffset>${10 * 9525}</wp:posOffset>`);
      expect(xml).toContain(`<wp:posOffset>${20 * 9525}</wp:posOffset>`);
    }
  });

  it('形状文字写进 wps:txbx，换行拆成多个段落', () => {
    const xml = buildShapeDrawingXml(
      entry({ attrs: shapeSpec({ prst: 'rect', text: '第一行\n第二行 <>&' }) }),
    );
    expect(xml).toContain('<wps:txbx><w:txbxContent>');
    expect((xml.match(/<w:p>/g) ?? []).length).toBe(2);
    expect(xml).toContain('第二行 &lt;&gt;&amp;');
    // bodyPr follows txbx (Word's own element order)
    expect(xml.indexOf('<wps:txbx>')).toBeLessThan(xml.indexOf('<wps:bodyPr'));
  });

  it('形状文字样式写进 w:rPr（粗/斜/下划线/颜色/字号/对齐）', () => {
    const xml = buildShapeDrawingXml(
      entry({
        attrs: shapeSpec({
          prst: 'rect',
          text: '样式',
          textBold: true,
          textItalic: true,
          textUnderline: true,
          textColor: '#123456',
          textSize: 20,
          textAlign: 'right',
        }),
      }),
    );
    expect(xml).toContain('<w:b/><w:i/><w:u w:val="single"/>');
    expect(xml).toContain('<w:color w:val="123456"/>');
    // 20px = 15pt = 30 half-points
    expect(xml).toContain('<w:sz w:val="30"/>');
    expect(xml).toContain('<w:jc w:val="right"/>');
  });

  it('无文字时不写 txbx', () => {
    expect(buildShapeDrawingXml(entry())).not.toContain('<wps:txbx>');
  });

  it('旋转写进 a:xfrm@rot（1/60000 度）', () => {
    const xml = buildShapeDrawingXml(entry({ attrs: shapeSpec({ prst: 'rect', rotation: 45 }) }));
    expect(xml).toContain('rot="2700000"');
  });
});

describe('命名空间注入', () => {
  it('补齐 wp / a / wps / mc 与 mc:Ignorable', () => {
    const xml = injectDocumentNamespaces('<w:document xmlns:w="w"><w:body/></w:document>');
    expect(xml).toContain('xmlns:wp=');
    expect(xml).toContain('xmlns:a=');
    expect(xml).toContain('xmlns:wps=');
    expect(xml).toContain('mc:Ignorable="wps"');
  });

  it('幂等：二次注入不重复', () => {
    const once = injectDocumentNamespaces('<w:document xmlns:w="w"></w:document>');
    const twice = injectDocumentNamespaces(once);
    expect(twice).toBe(once);
    expect((twice.match(/xmlns:wps=/g) ?? []).length).toBe(1);
  });

  it('已有 mc:Ignorable 时追加 wps 而不是覆盖', () => {
    const xml = injectDocumentNamespaces(
      '<w:document xmlns:mc="m" mc:Ignorable="w14 w15"><w:body/></w:document>',
    );
    expect(xml).toContain('mc:Ignorable="w14 w15 wps"');
  });
});

describe('exportDocxBlob 端到端', () => {
  it('含形状的文档导出后 document.xml 里有 wps:wsp 且没有残留 token', async () => {
    const html = `<p>正文</p>${shapeHtml('data-shape-layer-inline="true"')}`;
    const result = await exportDocxBlob(html, 'shape');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wps:wsp>');
    expect(xml).toContain('xmlns:wps=');
    expect(xml).toContain('<a:prstGeom prst="roundRect">');
    expect(xml).not.toContain('@@SHAPE:');
    expect(xml).toContain('正文');
  });

  it('浮动形状导出为 wp:anchor + behindDoc', async () => {
    const html = `<p>正文</p>${shapeHtml(
      'data-layer="behind" data-shape-x="24" data-shape-y="48"',
    )}`;
    const result = await exportDocxBlob(html, 'shape');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).toContain('<wp:anchor');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain(`<wp:posOffset>${24 * 9525}</wp:posOffset>`);
  });

  it('无形状的文档不受二次注入影响（不出现 wps 元素）', async () => {
    const result = await exportDocxBlob('<p>纯文本</p>', 'plain');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const xml = await readDocumentXml(result.value);
    expect(xml).not.toContain('<wps:wsp>');
    expect(xml).not.toContain('<wp:anchor');
  });

  it('injectShapeDrawings 对空列表返回原 blob', async () => {
    const result = await exportDocxBlob('<p>x</p>', 'x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const same = await injectShapeDrawings(result.value, []);
    expect(same).toBe(result.value);
  });
});
