import { describe, expect, it } from 'vitest';
import { exportDocxBlob, importDocx } from './docx';
import { extractDocxShapes, placeShapesInHtml } from './docxShapeImport';
import { shapeSpec } from './shapeNode';

// jsdom lacks Blob/File.prototype.arrayBuffer (test-only shim, same as docx.test.ts)
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

/**
 * P3-1.5: reading `wps:wsp` back.
 *
 * The anchoring contract is "equal text or nothing": these tests pin both branches, plus a full
 * export → import round-trip through the real docx library and mammoth.
 */

const DOC_HEAD =
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><w:body>';

function drawingXml(inner: string): string {
  return `<w:p><w:r><w:drawing>${inner}</w:drawing></w:r></w:p>`;
}

function wspXml(options: { prst: string; adj?: number; text?: string }): string {
  const avLst =
    options.adj === undefined
      ? '<a:avLst/>'
      : `<a:avLst><a:gd name="adj1" fmla="val ${Math.round(options.adj * 100000)}"/></a:avLst>`;
  return [
    '<wps:wsp>',
    '<wps:cNvPr id="101" name="Shape 101"/>',
    '<wps:cNvSpPr/>',
    '<wps:spPr>',
    '<a:xfrm rot="0"><a:off x="0" y="0"/><a:ext cx="1619250" cy="952500"/></a:xfrm>',
    `<a:prstGeom prst="${options.prst}">${avLst}</a:prstGeom>`,
    '<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill>',
    '<a:ln w="9525"><a:solidFill><a:srgbClr val="2F5597"/></a:solidFill><a:prstDash val="dash"/></a:ln>',
    '</w:spPr>',
    options.text
      ? `<wps:txbx><w:txbxContent><w:p><w:r><w:t>${options.text}</w:t></w:r></w:p></w:txbxContent></wps:txbx>`
      : '',
    '<wps:bodyPr rot="0" vert="horz" wrap="square"/>',
    '</wps:wsp>',
  ].join('');
}

const graphic = (options: { prst: string; adj?: number; text?: string }): string =>
  '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">' +
  wspXml(options) +
  '</a:graphicData></a:graphic>';

const inlineDrawing = (options: { prst: string; adj?: number; text?: string }): string =>
  `<wp:inline><wp:extent cx="1619250" cy="952500"/><wp:docPr id="101" name="Shape 101"/>${graphic(
    options,
  )}</wp:inline>`;

function anchorDrawing(options: {
  behindDoc: boolean;
  wrap: 'none' | 'left' | 'right' | 'top-bottom';
}): string {
  const wrap =
    options.wrap === 'right'
      ? '<wp:wrapSquare wrapText="right"/>'
      : options.wrap === 'left'
        ? '<wp:wrapSquare wrapText="left"/>'
        : options.wrap === 'top-bottom'
          ? '<wp:wrapTopAndBottom/>'
          : '<wp:wrapNone/>';
  return [
    `<wp:anchor behindDoc="${options.behindDoc ? 1 : 0}" simplePos="0" relativeHeight="2">`,
    '<wp:simplePos x="0" y="0"/>',
    '<wp:positionH relativeFrom="column"><wp:posOffset>228600</wp:posOffset></wp:positionH>',
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>57150</wp:posOffset></wp:positionV>',
    '<wp:extent cx="1619250" cy="952500"/><wp:docPr id="102" name="Shape 102"/>',
    wrap,
    graphic({ prst: 'ellipse' }),
    '</wp:anchor>',
  ].join('');
}

describe('extractDocxShapes', () => {
  it('读回 prst / 尺寸 / 填充 / 描边 / 虚线 / 文字', () => {
    const xml = `${DOC_HEAD}<w:p><w:r><w:t>正文</w:t></w:r></w:p>${drawingXml(
      inlineDrawing({ prst: 'roundRect', adj: 0.2, text: '标签' }),
    )}</w:body></w:document>`;
    const { shapes, blocks } = extractDocxShapes(xml);
    expect(blocks).toEqual(['正文']);
    expect(shapes).toHaveLength(1);
    const [shape] = shapes;
    expect(shape.attrs.prst).toBe('roundRect');
    expect(shape.attrs.adj?.adj1).toBeCloseTo(0.2, 5);
    // 1619250 EMU = 170px, 952500 EMU = 100px
    expect(shape.attrs.width).toBe(170);
    expect(shape.attrs.height).toBe(100);
    expect(shape.attrs.fill).toBe('#4472c4');
    expect(shape.attrs.stroke).toBe('#2f5597');
    expect(shape.attrs.strokeWidth).toBe(1);
    expect(shape.attrs.dash).toBe('dash');
    expect(shape.attrs.text).toBe('标签');
    // Text style falls back to the defaults when the run carries no properties
    expect(shape.attrs.textSize).toBe(14);
    expect(shape.attrs.textAlign).toBe('center');
    expect(shape.attrs.layer).toBe('inline');
    expect(shape.blockIndex).toBe(1);
  });

  it('浮动形状读回锚定模式与偏移（EMU → px）', () => {
    const behind = extractDocxShapes(
      `${DOC_HEAD}${drawingXml(anchorDrawing({ behindDoc: true, wrap: 'none' }))}</w:body></w:document>`,
    ).shapes[0];
    expect(behind.attrs.layer).toBe('behind');
    expect(behind.attrs.offsetX).toBe(24);
    expect(behind.attrs.offsetY).toBe(6);

    // wrapText names the side that carries text: "right" = the shape sits on the left
    const wrapped = extractDocxShapes(
      `${DOC_HEAD}${drawingXml(anchorDrawing({ behindDoc: false, wrap: 'right' }))}</w:body></w:document>`,
    ).shapes[0];
    expect(wrapped.attrs.layer).toBe('wrap-left');

    const other = extractDocxShapes(
      `${DOC_HEAD}${drawingXml(anchorDrawing({ behindDoc: false, wrap: 'left' }))}</w:body></w:document>`,
    ).shapes[0];
    expect(other.attrs.layer).toBe('wrap-right');
  });

  it('形状文字不参与可见文本流（否则锚定永远不相等）', () => {
    const xml = `${DOC_HEAD}${drawingXml(inlineDrawing({ prst: 'rect', text: '形状文字' }))}</w:body></w:document>`;
    expect(extractDocxShapes(xml).blocks).toEqual([]);
  });

  it('表格里的形状记为不支持，而不是错位插入', () => {
    const xml = `${DOC_HEAD}<w:tbl><w:tr><w:tc>${drawingXml(
      inlineDrawing({ prst: 'rect' }),
    )}</w:tc></w:tr></w:tbl></w:body></w:document>`;
    const result = extractDocxShapes(xml);
    expect(result.shapes).toHaveLength(0);
    expect(result.unsupported).toBe(1);
  });

  it('空 XML 不抛错', () => {
    expect(extractDocxShapes('')).toEqual({ shapes: [], blocks: [], unsupported: 0 });
  });
});

describe('placeShapesInHtml', () => {
  const extracted = {
    shapes: [{ attrs: shapeSpec({ prst: 'roundRect', width: 170, height: 100 }), blockIndex: 1 }],
    blocks: ['第一段', '第二段'],
    unsupported: 0,
  };

  it('文本流相等时插到对应段落边界', () => {
    const result = placeShapesInHtml('<p>第一段</p><p>第二段</p>', extracted);
    expect(result.placed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.html.indexOf('第一段')).toBeLessThan(result.html.indexOf('data-doc-shape'));
    expect(result.html.indexOf('data-doc-shape')).toBeLessThan(result.html.indexOf('第二段'));
    expect(result.html).toContain('<path d="M ');
  });

  it('文本流不相等时全部降级并计数（不产生错位形状）', () => {
    const result = placeShapesInHtml('<p>第一段</p><p>被改动的段落</p>', extracted);
    expect(result.placed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.html).not.toContain('data-doc-shape');
  });

  it('末尾边界追加到正文最后', () => {
    const tail = {
      ...extracted,
      shapes: [{ attrs: shapeSpec({ prst: 'rect' }), blockIndex: 2 }],
    };
    const result = placeShapesInHtml('<p>第一段</p><p>第二段</p>', tail);
    expect(result.placed).toBe(1);
    expect(result.html.trimEnd().endsWith('</div>')).toBe(true);
  });
});

describe('docx 形状往返（导出 → 导入）', () => {
  const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });

  it('自研导出再导入：形状数、prst、adj、位置、填充与文字一致', async () => {
    const shape = shapeSpec({
      prst: 'roundRect',
      adj: { adj1: 0.25 },
      width: 200,
      height: 120,
      fill: '#ff8800',
      stroke: '#112233',
      strokeWidth: 2,
      text: '形状文字',
    });
    const html =
      `<p>第一段</p>` +
      `<div data-doc-shape="${shape.prst}" data-shape-prst="${shape.prst}" data-shape-adj='${JSON.stringify(
        shape.adj,
      )}' data-shape-w="${shape.width}" data-shape-h="${shape.height}" data-shape-fill="${
        shape.fill
      }" data-shape-stroke="${shape.stroke}" data-shape-stroke-width="${
        shape.strokeWidth
      }" data-shape-text="${shape.text}"></div>` +
      `<p>第二段</p>`;

    const exported = await exportDocxBlob(html, 'shapes');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const file = new File([await blobToArrayBuffer(exported.value)], 'shapes.docx');
    let reported: { shapes: number; skipped: number } | null = null;
    const imported = await importDocx(file, { onShapes: (info) => (reported = info) });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(reported).toEqual({ shapes: 1, skipped: 0 });
    const out = imported.value;
    expect(out).toContain('data-shape-prst="roundRect"');
    expect(out).toContain('data-shape-w="200"');
    expect(out).toContain('data-shape-fill="#ff8800"');
    expect(out).toContain('data-shape-text="形状文字"');
    // Position preserved: after the first paragraph, before the second
    expect(out.indexOf('第一段')).toBeLessThan(out.indexOf('data-doc-shape'));
    expect(out.indexOf('data-doc-shape')).toBeLessThan(out.indexOf('第二段'));
  });

  it('导入没有形状的文档时不触发 onShapes', async () => {
    const exported = await exportDocxBlob('<p>纯文本</p>', 'plain');
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const file = new File([await blobToArrayBuffer(exported.value)], 'plain.docx');
    let called = false;
    await importDocx(file, { onShapes: () => (called = true) });
    expect(called).toBe(false);
  });
});
