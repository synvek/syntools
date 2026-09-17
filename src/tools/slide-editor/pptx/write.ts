import { pxToEmu, ptToHundredthsPt, resolvePresetGeometry } from '../core';
import type {
  Fill,
  Paragraph,
  RunStyle,
  ShapeElement,
  SlideElement,
  Stroke,
  TableElement,
  TextAlign,
  TextBody,
  TextElement,
} from '../model/types';
import { escapeXml } from './templates';

/**
 * SlideElement → DrawingML 字符串。
 *
 * 之所以手写字符串而不是用 XMLBuilder：PowerPoint 对子元素顺序零容忍，
 * 显式的模板顺序比「对象键顺序」更可控、更容易在单测里断言。
 */

let idSeq = 1;
function nextShapeId(): number {
  idSeq += 1;
  return idSeq;
}

export function resetShapeIds(): void {
  idSeq = 1;
}

const ALIGN_ATTR: Record<TextAlign, string> = {
  left: 'l',
  center: 'ctr',
  right: 'r',
  justify: 'just',
};

function xfrmXml(
  element: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    flipX?: boolean;
    flipY?: boolean;
  },
  tag = 'a:xfrm',
): string {
  const attrs = [
    element.rotation ? ` rot="${Math.round((element.rotation ?? 0) * 60000)}"` : '',
    element.flipX ? ' flipH="1"' : '',
    element.flipY ? ' flipV="1"' : '',
  ].join('');
  return [
    `<${tag}${attrs}>`,
    `<a:off x="${pxToEmu(element.x)}" y="${pxToEmu(element.y)}"/>`,
    `<a:ext cx="${pxToEmu(element.width)}" cy="${pxToEmu(element.height)}"/>`,
    `</${tag}>`,
  ].join('');
}

function fillXml(fill: Fill | undefined): string {
  if (!fill || fill.type === 'none') return '<a:noFill/>';
  if (fill.type === 'solid') {
    const hex = fill.color.replace(/^#/, '').toUpperCase();
    const alpha =
      fill.alpha === undefined ? '' : `<a:alpha val="${Math.round(fill.alpha * 100000)}"/>`;
    return `<a:solidFill><a:srgbClr val="${hex}">${alpha}</a:srgbClr></a:solidFill>`;
  }
  const stops = fill.stops
    .map(
      (stop) =>
        `<a:gs pos="${Math.round(stop.offset * 100000)}"><a:srgbClr val="${stop.color.replace(/^#/, '').toUpperCase()}"/></a:gs>`,
    )
    .join('');
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="${Math.round((fill.angle ?? 0) * 60000)}" scaled="0"/><a:tileRect/></a:gradFill>`;
}

function strokeXml(stroke: Stroke | undefined): string {
  if (!stroke) return '<a:noFill/>';
  const width = Math.max(1, Math.round(stroke.width * 12700));
  const color = stroke.color.replace(/^#/, '').toUpperCase();
  return `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:prstDash val="solid"/><a:omitArrowheads/></a:ln>`;
}

function runXml(text: string, style: RunStyle | undefined): string {
  const attrs = [
    'lang="zh-CN"',
    'altLang="en-US"',
    'dirty="0"',
    style?.size ? `sz="${ptToHundredthsPt(style.size)}"` : '',
    style?.bold ? 'b="1"' : '',
    style?.italic ? 'i="1"' : '',
    style?.underline ? 'u="sng"' : '',
    style?.strike ? 'strike="sng"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const parts: string[] = [];
  if (style?.color) {
    parts.push(
      `<a:solidFill><a:srgbClr val="${style.color.replace(/^#/, '').toUpperCase()}"/></a:solidFill>`,
    );
  }
  if (style?.font) parts.push(`<a:latin typeface="${escapeXml(style.font)}"/>`);
  const children =
    parts.length > 0 ? `<a:rPr ${attrs}>${parts.join('')}</a:rPr>` : `<a:rPr ${attrs}/>`;
  return `<a:r>${children}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

function paragraphXml(paragraph: Paragraph): string {
  const pPrAttrs = [];
  if (paragraph.align) pPrAttrs.push(`algn="${ALIGN_ATTR[paragraph.align]}"`);
  if (paragraph.indent) pPrAttrs.push(`marL="${pxToEmu(paragraph.indent)}"`);
  const bullet = paragraph.bullet
    ? '<a:buClrTx/><a:buSzPct val="100000"/><a:buFontTx/><a:buChar char="•"/>'
    : '';
  const lnSpc = paragraph.lineSpacing
    ? `<a:lnSpc><a:spcPct val="${Math.round(paragraph.lineSpacing * 1000)}"/></a:lnSpc>`
    : '';
  const spcBef = paragraph.spaceBefore
    ? `<a:spcBef><a:spcPts val="${Math.round(paragraph.spaceBefore * 100)}"/></a:spcBef>`
    : '';
  const spcAft = paragraph.spaceAfter
    ? `<a:spcAft><a:spcPts val="${Math.round(paragraph.spaceAfter * 100)}"/></a:spcAft>`
    : '';
  const pPrChild = bullet || lnSpc || spcBef || spcAft;
  const pPr =
    pPrAttrs.length > 0 || pPrChild ? `<a:pPr ${pPrAttrs.join(' ')}>${pPrChild}</a:pPr>` : '';
  const runs = paragraph.runs.map((run) => runXml(run.text, run.style)).join('');
  return `<a:p>${pPr}${runs}</a:p>`;
}

function bodyXml(body: TextBody): string {
  const anchors = { top: 't', middle: 'ctr', bottom: 'b' } as const;
  const margins = body.margins ?? { left: 9, top: 5, right: 9, bottom: 5 };
  const wrap = body.wrap === false ? ' wrap="none"' : '';
  const anchor = ` anchor="${anchors[body.anchor ?? 'top']}"`;
  const attrs = [
    `lIns="${pxToEmu(margins.left)}"`,
    `tIns="${pxToEmu(margins.top)}"`,
    `rIns="${pxToEmu(margins.right)}"`,
    `bIns="${pxToEmu(margins.bottom)}"`,
  ].join(' ');
  const autoFit = body.autoFit === 'autofit' ? '<a:spAutoFit/>' : '<a:noAutofit/>';
  return `<a:bodyPr ${attrs}${wrap}${anchor}>${autoFit}</a:bodyPr>`;
}

/** 完整 txBody（命名限定：形状/表格/图片文本框分别用不同前缀） */
export function textBodyXml(body: TextBody, prefix: 'p' | 'a'): string {
  const paragraphs = body.paragraphs.length > 0 ? body.paragraphs : [{ runs: [{ text: '' }] }];
  return `<${prefix}:txBody>${bodyXml(body)}<a:lstStyle/>${paragraphs.map(paragraphXml).join('')}</${prefix}:txBody>`;
}

function prstGeomXml(prst: string): string {
  const geom = resolvePresetGeometry(prst);
  return `<a:prstGeom prst="${escapeXml(geom.prst)}"><a:avLst/></a:prstGeom>`;
}

function shapeXml(element: ShapeElement, body: TextBody | undefined): string {
  const id = nextShapeId();
  const parts = [
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(element.name ?? `Shape ${id}`)}"/><p:cNvSpPr/>`,
    element.placeholder
      ? `<p:nvPr><p:ph type="${escapeXml(element.placeholder.kind)}"${element.placeholder.index ? ` idx="${escapeXml(element.placeholder.index)}"` : ''}/></p:nvPr>`
      : '<p:nvPr/>',
    '</p:nvSpPr>',
    `<p:spPr>${xfrmXml(element)}${prstGeomXml(element.geom.prst)}${fillXml(element.fill)}${strokeXml(element.stroke)}</p:spPr>`,
  ];
  if (body) parts.push(textBodyXml(body, 'p'));
  return `<p:sp>${parts.join('')}</p:sp>`;
}

function textXml(element: TextElement): string {
  const id = nextShapeId();
  return [
    '<p:sp>',
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(element.name ?? `Text ${id}`)}"/><p:cNvSpPr txBox="1"/>`,
    element.placeholder
      ? `<p:nvPr><p:ph type="${escapeXml(element.placeholder.kind)}"${element.placeholder.index ? ` idx="${escapeXml(element.placeholder.index)}"` : ''}/></p:nvPr>`
      : '<p:nvPr/>',
    '</p:nvSpPr>',
    `<p:spPr>${xfrmXml(element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml(element.fill)}${strokeXml(element.stroke)}</p:spPr>`,
    textBodyXml(element.body, 'p'),
    '</p:sp>',
  ].join('');
}

function imageXml(
  element: { x: number; y: number; width: number; height: number; rotation?: number },
  rId: string,
  crop: { left: number; top: number; right: number; bottom: number } | undefined,
): string {
  const id = nextShapeId();
  const srcRect = crop
    ? `<a:srcRect l="${Math.round(crop.left * 100000)}" t="${Math.round(crop.top * 100000)}" r="${Math.round(crop.right * 100000)}" b="${Math.round(crop.bottom * 100000)}"/>`
    : '';
  return [
    '<p:pic>',
    `<p:nvPicPr><p:cNvPr id="${id}" name="Image ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`,
    `<p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch>${srcRect}</p:blipFill>`,
    `<p:spPr>${xfrmXml(element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`,
    '</p:pic>',
  ].join('');
}

function lineXml(element: {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points: number[];
  stroke?: Stroke;
}): string {
  const flipH = (element.points[2] ?? 0) < 0;
  const flipV = (element.points[3] ?? 0) < 0;
  return [
    '<p:cxnSp>',
    `<p:nvCxnSpPr><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>`,
    `<p:spPr>${xfrmXml({ ...element, flipX: flipH, flipY: flipV })}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${strokeXml(element.stroke ?? { color: '#000000', width: 1 })}</p:spPr>`,
    '</p:cxnSp>',
  ].join('');
}

function tableXml(element: TableElement): string {
  // nvGraphicFramePr 的子元素顺序：p:cNvPr → p:cNvGraphicFramePr → p:nvPr（缺 cNvPr 会让解析器报错）
  const id = nextShapeId();
  const rows = element.rows;
  // CT_Table 顺序：a:tblPr → a:tblGrid(a:gridCol*) → a:tr*
  const gridCols = `<a:tblGrid>${element.colWidths
    .map((width) => `<a:gridCol w="${pxToEmu(width)}"/>`)
    .join('')}</a:tblGrid>`;
  const rowsXml = rows
    .map((row, rowIndex) => {
      const height = element.rowHeights[rowIndex] ?? 32;
      const cells = row
        .map((cell) => {
          const body: TextBody = {
            paragraphs: [
              {
                runs: [
                  {
                    text: cell.text,
                    style: {
                      size: cell.size,
                      bold: cell.bold,
                      color: cell.color,
                    } as RunStyle,
                  },
                ],
                align: cell.align,
              },
            ],
            anchor: cell.valign,
            wrap: true,
            autoFit: 'none',
            margins: { left: 5, top: 3, right: 5, bottom: 3 },
          };
          const tcPrAttrs = [
            `anchor="${cell.valign === 'top' ? 't' : cell.valign === 'bottom' ? 'b' : 'ctr'}"`,
            'marL="68580" marR="68580" marT="34290" marB="34290"',
            cell.colSpan && cell.colSpan > 1 ? `gridSpan="${cell.colSpan}"` : '',
            cell.rowSpan && cell.rowSpan > 1 ? `rowSpan="${cell.rowSpan}"` : '',
          ]
            .filter(Boolean)
            .join(' ');
          return `<a:tc>${textBodyXml(body, 'a')}<a:tcPr ${tcPrAttrs}/></a:tc>`;
        })
        .join('');
      return `<a:tr h="${pxToEmu(height)}">${cells}</a:tr>`;
    })
    .join('');
  const graphicFrame = [
    '<p:graphicFrame>',
    `<p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>`,
    xfrmXml(element, 'p:xfrm'),
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">',
    `<a:tbl><a:tblPr firstRow="1" bandRow="1"/>${gridCols}${rowsXml}</a:tbl>`,
    '</a:graphicData></a:graphic>',
    '</p:graphicFrame>',
  ].join('');
  return graphicFrame;
}

/** 单个元素 → DrawingML（图片需要 relMap 提供 rId） */
export function elementXml(element: SlideElement, relMap: Map<string, string>): string {
  switch (element.type) {
    case 'text':
      return textXml(element);
    case 'shape':
      return shapeXml(element, element.body);
    case 'image': {
      const rId = relMap.get(element.mediaId);
      if (!rId) return '';
      return imageXml(element, rId, element.crop);
    }
    case 'line':
      return lineXml(element);
    case 'table':
      return tableXml(element);
    case 'group': {
      const children = element.children.map((child) => elementXml(child, relMap)).join('');
      return [
        '<p:grpSp>',
        '<p:nvGrpSpPr><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
        `<p:grpSpPr><a:xfrm><a:off x="${pxToEmu(element.x)}" y="${pxToEmu(element.y)}"/><a:ext cx="${pxToEmu(element.width)}" cy="${pxToEmu(element.height)}"/><a:chOff x="${pxToEmu(element.x)}" y="${pxToEmu(element.y)}"/><a:chExt cx="${pxToEmu(element.width)}" cy="${pxToEmu(element.height)}"/></a:xfrm></p:grpSpPr>`,
        children,
        '</p:grpSp>',
      ].join('');
    }
    case 'placeholder': {
      // 占位框导出为灰底矩形 + 说明文字，避免内容丢失
      const pseudo: ShapeElement = {
        id: element.id,
        type: 'shape',
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        geom: { kind: 'rect', prst: 'rect' },
        fill: { type: 'solid', color: '#F1F5F9' },
        stroke: { color: '#94A3B8', width: 1, dash: [6, 4] },
        body: {
          paragraphs: [
            {
              runs: [{ text: element.label, style: { size: 14, color: '#64748B' } }],
              align: 'center',
            },
          ],
          anchor: 'middle',
          wrap: true,
          autoFit: 'none',
          margins: { left: 8, top: 4, right: 8, bottom: 4 },
        },
      };
      return shapeXml(pseudo, pseudo.body);
    }
    default:
      return '';
  }
}

const SLIDE_NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** 组装整页 slide XML */
export function slideXml(
  elements: SlideElement[],
  relMap: Map<string, string>,
  background?: string,
): string {
  const body = elements.map((element) => elementXml(element, relMap)).join('');
  const bg = background
    ? `<p:bg><p:bgPr>${fillXml({ type: 'solid', color: background })}<a:effectLst/></p:bgPr></p:bg>`
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<p:sld ${SLIDE_NS}>`,
    '<p:cSld>',
    bg,
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    body,
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sld>',
  ].join('');
}

/** slide rels：layout rId1 + 用到的媒体 */
export function slideRelsXml(mediaRels: { rId: string; target: string }[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
    mediaRels
      .map(
        (rel) =>
          `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${rel.target}"/>`,
      )
      .join(''),
    '</Relationships>',
  ].join('');
}
