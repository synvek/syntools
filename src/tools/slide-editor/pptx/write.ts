import { ALPHA_UNIT, EMU_PER_PX, normalizeBackground, pxToEmu, ptToHundredthsPt } from '../core';
import type {
  Fill,
  LineElement,
  Paragraph,
  RunStyle,
  ShadowStyle,
  ShapeElement,
  ShapeGeometry,
  SlideBackground,
  SlideElement,
  Stroke,
  TableElement,
  TextAlign,
  TextBody,
  TextElement,
} from '../model/types';
import { escapeXml } from './templates';
import { custGeomXml } from './custGeom';

/**
 * SlideElement → DrawingML strings.
 *
 * Why hand-written strings instead of an XMLBuilder: PowerPoint is zero-tolerance about child element
 * order, and explicit template order is more controllable and easier to assert in unit tests than "object key order".
 */

let idSeq = 1;
/** Stable internal element id → DrawingML cNvPr id, so connectors can reference shapes written later */
const shapeIdByElement = new Map<string, number>();

function nextShapeId(): number {
  idSeq += 1;
  return idSeq;
}

function shapeIdFor(elementId: string | undefined): number {
  if (!elementId) return nextShapeId();
  const existing = shapeIdByElement.get(elementId);
  if (existing !== undefined) return existing;
  const id = nextShapeId();
  shapeIdByElement.set(elementId, id);
  return id;
}

export function resetShapeIds(): void {
  idSeq = 1;
  shapeIdByElement.clear();
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

function strokeXml(
  stroke: Stroke | undefined,
  ends?: { head?: LineElement['head']; tail?: LineElement['tail'] },
): string {
  if (!stroke) return '<a:noFill/>';
  const width = Math.max(1, Math.round(stroke.width * 12700));
  const color = stroke.color.replace(/^#/, '').toUpperCase();
  const head = ends?.head ? `<a:headEnd type="${ends.head}"/>` : '';
  const tail = ends?.tail ? `<a:tailEnd type="${ends.tail}"/>` : '';
  return `<a:ln w="${width}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:prstDash val="solid"/>${head}${tail}</a:ln>`;
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
    // Letter spacing (a:spc, unit 1/100 pt) and baseline (unit 0.1%)
    style?.spacing ? `spc="${ptToHundredthsPt(style.spacing)}"` : '',
    typeof style?.baseline === 'number' && style.baseline !== 0
      ? `baseline="${Math.round(style.baseline * 10)}"`
      : '',
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
  // Character highlight (a:highlight) must follow latin and come after uLn
  if (style?.highlight) {
    parts.push(
      `<a:highlight><a:srgbClr val="${style.highlight.replace(/^#/, '').toUpperCase()}"/></a:highlight>`,
    );
  }
  // Note: run-level hyperlinks need an OPC relationship (rId), and the legacy channel doesn't maintain
  // hyperlink rels, so a:hlinkClick is not written here — hyperlinks are fully exported by the pptxgen channel.
  const children =
    parts.length > 0 ? `<a:rPr ${attrs}>${parts.join('')}</a:rPr>` : `<a:rPr ${attrs}/>`;
  return `<a:r>${children}<a:t>${escapeXml(text)}</a:t></a:r>`;
}

function paragraphXml(paragraph: Paragraph): string {
  const pPrAttrs = [];
  if (paragraph.align) pPrAttrs.push(`algn="${ALIGN_ATTR[paragraph.align]}"`);
  if (paragraph.indent) pPrAttrs.push(`marL="${pxToEmu(paragraph.indent)}"`);
  // Numbered lists (buAutoNum, Arabic numerals) and bullets are mutually exclusive
  const bullet = paragraph.numbering
    ? '<a:buClrTx/><a:buSzPct val="100000"/><a:buFontTx/><a:buAutoNum type="arabicPeriod"/>'
    : paragraph.bullet
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
  const vert = body.vert && body.vert !== 'horz' ? ` vert="${escapeXml(body.vert)}"` : '';
  const attrs = [
    `lIns="${pxToEmu(margins.left)}"`,
    `tIns="${pxToEmu(margins.top)}"`,
    `rIns="${pxToEmu(margins.right)}"`,
    `bIns="${pxToEmu(margins.bottom)}"`,
  ].join(' ');
  const autoFit = body.autoFit === 'autofit' ? '<a:spAutoFit/>' : '<a:noAutofit/>';
  return `<a:bodyPr ${attrs}${wrap}${anchor}${vert}>${autoFit}</a:bodyPr>`;
}

/** Shadow → a:outerShdw (inside spPr's effectLst) */
function shadowXml(shadow: ShadowStyle | undefined): string {
  if (!shadow) return '';
  const alpha = Math.round((shadow.opacity ?? 1) * ALPHA_UNIT);
  const dist = Math.round(Math.sqrt(shadow.offsetX ** 2 + shadow.offsetY ** 2) * EMU_PER_PX);
  const dir = Math.round((Math.atan2(shadow.offsetX, -shadow.offsetY) * 60000 * 180) / Math.PI);
  const color = shadow.color.replace(/^#/, '').toUpperCase();
  return [
    '<a:effectLst>',
    `<a:outerShdw blurRad="${pxToEmu(shadow.blur)}" dist="${dist}" dir="${dir}" rotWithShape="0">`,
    `<a:srgbClr val="${color}"><a:alpha val="${alpha}"/></a:srgbClr>`,
    '</a:outerShdw>',
    '</a:effectLst>',
  ].join('');
}

/** Full txBody (namespace-qualified: shapes/tables/image text boxes use different prefixes) */
export function textBodyXml(body: TextBody, prefix: 'p' | 'a'): string {
  const paragraphs = body.paragraphs.length > 0 ? body.paragraphs : [{ runs: [{ text: '' }] }];
  return `<${prefix}:txBody>${bodyXml(body)}<a:lstStyle/>${paragraphs.map(paragraphXml).join('')}</${prefix}:txBody>`;
}

function avLstXml(adj: Record<string, number> | undefined): string {
  const entries = Object.entries(adj ?? {})
    .filter(([, value]) => Number.isFinite(value))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  if (entries.length === 0) return '<a:avLst/>';
  const gds = entries
    .map(
      ([name, value]) =>
        `<a:gd name="${escapeXml(name)}" fmla="val ${Math.round(value * 100000)}"/>`,
    )
    .join('');
  return `<a:avLst>${gds}</a:avLst>`;
}

function geomXml(geom: ShapeGeometry): string {
  // An explicit path must survive a round-trip: writing prst would silently redraw the shape
  if (geom.custGeom && geom.custGeom.length > 0) return custGeomXml(geom.custGeom);
  return `<a:prstGeom prst="${escapeXml(geom.prst || 'rect')}">${avLstXml(geom.adj)}</a:prstGeom>`;
}

function shapeXml(element: ShapeElement, body: TextBody | undefined): string {
  const id = shapeIdFor(element.id);
  const parts = [
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(element.name ?? `Shape ${id}`)}"/><p:cNvSpPr/>`,
    element.placeholder
      ? `<p:nvPr><p:ph type="${escapeXml(element.placeholder.kind)}"${element.placeholder.index ? ` idx="${escapeXml(element.placeholder.index)}"` : ''}/></p:nvPr>`
      : '<p:nvPr/>',
    '</p:nvSpPr>',
    `<p:spPr>${xfrmXml(element)}${geomXml(element.geom)}${fillXml(element.fill)}${strokeXml(element.stroke)}${shadowXml(element.shadow)}</p:spPr>`,
  ];
  if (body) parts.push(textBodyXml(body, 'p'));
  return `<p:sp>${parts.join('')}</p:sp>`;
}

function textXml(element: TextElement): string {
  const id = shapeIdFor(element.id);
  return [
    '<p:sp>',
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(element.name ?? `Text ${id}`)}"/><p:cNvSpPr txBox="1"/>`,
    element.placeholder
      ? `<p:nvPr><p:ph type="${escapeXml(element.placeholder.kind)}"${element.placeholder.index ? ` idx="${escapeXml(element.placeholder.index)}"` : ''}/></p:nvPr>`
      : '<p:nvPr/>',
    '</p:nvSpPr>',
    `<p:spPr>${xfrmXml(element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fillXml(element.fill)}${strokeXml(element.stroke)}${shadowXml(element.shadow)}</p:spPr>`,
    textBodyXml(element.body, 'p'),
    '</p:sp>',
  ].join('');
}

function imageXml(
  element: {
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  },
  rId: string,
  crop: { left: number; top: number; right: number; bottom: number } | undefined,
): string {
  const id = shapeIdFor(element.id);
  const srcRect = crop
    ? `<a:srcRect l="${Math.round(crop.left * 100000)}" t="${Math.round(crop.top * 100000)}" r="${Math.round(crop.right * 100000)}" b="${Math.round(crop.bottom * 100000)}"/>`
    : '';
  return [
    '<p:pic>',
    `<p:nvPicPr><p:cNvPr id="${id}" name="Image ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>`,
    `<p:blipFill><a:blip r:embed="${rId}"/>${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`,
    `<p:spPr>${xfrmXml(element)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>`,
    '</p:pic>',
  ].join('');
}

function lineXml(element: LineElement): string {
  const first = element.points;
  const flipH = (first[2] ?? 0) < 0;
  const flipV = (first[3] ?? 0) < 0;
  const id = shapeIdFor(element.id);
  const startId = element.startCxn?.shapeId
    ? shapeIdByElement.get(element.startCxn.shapeId)
    : undefined;
  const endId = element.endCxn?.shapeId ? shapeIdByElement.get(element.endCxn.shapeId) : undefined;
  const cxnPr =
    startId !== undefined || endId !== undefined
      ? `<p:cNvCxnSpPr>${startId !== undefined ? `<a:stCxn id="${startId}" idx="${element.startCxn?.site ?? 0}"/>` : ''}${endId !== undefined ? `<a:endCxn id="${endId}" idx="${element.endCxn?.site ?? 0}"/>` : ''}</p:cNvCxnSpPr>`
      : '<p:cNvCxnSpPr/>';
  return [
    '<p:cxnSp>',
    `<p:nvCxnSpPr><p:cNvPr id="${id}" name="${escapeXml(element.name ?? `Line ${id}`)}"/>${cxnPr}<p:nvPr/></p:nvCxnSpPr>`,
    `<p:spPr>${xfrmXml({ ...element, flipX: flipH, flipY: flipV })}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>${strokeXml(element.stroke ?? { color: '#000000', width: 1 }, { head: element.head, tail: element.tail })}</p:spPr>`,
    '</p:cxnSp>',
  ].join('');
}

function tableXml(element: TableElement): string {
  // Child order of nvGraphicFramePr: p:cNvPr → p:cNvGraphicFramePr → p:nvPr (a missing cNvPr makes parsers fail)
  const id = shapeIdFor(element.id);
  const rows = element.rows;
  // CT_Table order: a:tblPr → a:tblGrid(a:gridCol*) → a:tr*
  const gridCols = `<a:tblGrid>${element.colWidths
    .map((width) => `<a:gridCol w="${pxToEmu(width)}"/>`)
    .join('')}</a:tblGrid>`;
  const rowsXml = rows
    .map((row, rowIndex) => {
      const height = element.rowHeights[rowIndex] ?? 32;
      const cells = row
        .map((cell) => {
          // Covered cell: OOXML requires the placeholder to remain, carrying hMerge/vMerge markers
          if (cell.covered) {
            const mergeAttr = cell.coveredBy === 'v' ? 'vMerge="1"' : 'hMerge="1"';
            return `<a:tc ${mergeAttr}><a:txBody><a:bodyPr/><a:lstStyle/><a:p/></a:txBody><a:tcPr/></a:tc>`;
          }
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
          // gridSpan / rowSpan are attributes of a:tc itself (not of tcPr) —
          // they used to be written on tcPr, so PowerPoint ignored the merge and it was lost on round-trip
          const tcAttrs = [
            cell.colSpan && cell.colSpan > 1 ? `gridSpan="${cell.colSpan}"` : '',
            cell.rowSpan && cell.rowSpan > 1 ? `rowSpan="${cell.rowSpan}"` : '',
          ]
            .filter(Boolean)
            .join(' ');
          const tcPrAttrs = [
            `anchor="${cell.valign === 'top' ? 't' : cell.valign === 'bottom' ? 'b' : 'ctr'}"`,
            'marL="68580" marR="68580" marT="34290" marB="34290"',
          ].join(' ');
          return `<a:tc${tcAttrs ? ` ${tcAttrs}` : ''}>${textBodyXml(body, 'a')}<a:tcPr ${tcPrAttrs}/></a:tc>`;
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
    // Write header/banding from the element's own settings instead of hardcoding (otherwise imported table styles get overwritten)
    `<a:tbl><a:tblPr${element.headerRow ? ' firstRow="1"' : ''}${
      element.bandRow ? ' bandRow="1"' : ''
    }/>${gridCols}${rowsXml}</a:tbl>`,
    '</a:graphicData></a:graphic>',
    '</p:graphicFrame>',
  ].join('');
  return graphicFrame;
}

/** One element → DrawingML (images need relMap to supply rIds) */
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
        (() => {
          const gid = shapeIdFor(element.id);
          return `<p:nvGrpSpPr><p:cNvPr id="${gid}" name="Group ${gid}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`;
        })(),
        // Children are stored relative to the group origin, so the sub-coordinate system starts at (0,0) and spans the group's own size;
        // chExt then equals ext and the scale is 1, so children land in the right page position when written back.
        `<p:grpSpPr><a:xfrm><a:off x="${pxToEmu(element.x)}" y="${pxToEmu(element.y)}"/><a:ext cx="${pxToEmu(element.width)}" cy="${pxToEmu(element.height)}"/><a:chOff x="0" y="0"/><a:chExt cx="${pxToEmu(element.width)}" cy="${pxToEmu(element.height)}"/></a:xfrm></p:grpSpPr>`,
        children,
        '</p:grpSp>',
      ].join('');
    }
    case 'placeholder': {
      // Export placeholder boxes as a gray rect + caption so content isn't lost
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
    case 'chart':
    case 'formula': {
      // The legacy channel has no native chart/formula object: charts degrade to a placeholder box (data kept, type labeled),
      // formulas degrade to a text box showing the LaTeX source. Native support comes from the pptxgen channel.
      const pseudo: ShapeElement = {
        id: element.id,
        type: 'shape',
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        geom: { kind: 'rect', prst: 'rect' },
        fill: { type: 'solid', color: '#F8FAFC' },
        stroke: { color: '#CBD5E1', width: 1 },
        body: {
          paragraphs: [
            {
              runs: [
                {
                  text: element.type === 'chart' ? `Chart: ${element.chartType}` : element.latex,
                  style:
                    element.type === 'chart'
                      ? { size: 14, color: '#64748B' }
                      : {
                          size: element.fontSize ? element.fontSize / 2 : 18,
                          color: element.color,
                        },
                },
              ],
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
    case 'icon':
      // Built-in SVG icons have no vectorized path in the legacy channel, so they export as an empty placeholder box
      return '';
    default:
      return '';
  }
}

const SLIDE_NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** Reserve cNvPr ids up-front so a connector can reference a shape that is written later. */
function reserveShapeIds(elements: SlideElement[]): void {
  for (const element of elements) {
    shapeIdFor(element.id);
    if (element.type === 'group') reserveShapeIds(element.children);
  }
}

/** Assemble the full slide XML */
export function slideXml(
  elements: SlideElement[],
  relMap: Map<string, string>,
  background?: SlideBackground,
): string {
  reserveShapeIds(elements);
  const body = elements.map((element) => elementXml(element, relMap)).join('');
  // Backgrounds support solid and gradient (v2); old solid-color strings are normalized here
  const fill = normalizeBackground(background);
  const bg =
    fill && fill.type !== 'none'
      ? `<p:bg><p:bgPr>${fillXml(fill)}<a:effectLst/></p:bgPr></p:bg>`
      : '';
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<p:sld ${SLIDE_NS}>`,
    '<p:cSld>',
    bg,
    '<p:spTree>',
    '<p:nvGrpSpPr><p:cNvPr id="1" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
    body,
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sld>',
  ].join('');
}

/** Slide rels: layout rId1 + the media used */
/**
 * Slide relationships.
 *
 * @param mediaRels   Image relationships (rIds start at rId2, allocated by relMapFor)
 * @param layoutIndex Index of the layout this slide references (multi-layout exports can't all point at slideLayout1)
 * @param notes      Notes relationship; the caller guarantees its rId doesn't clash with images
 */
export function slideRelsXml(
  mediaRels: { rId: string; target: string }[],
  layoutIndex = 0,
  notes: { rId: string; target: string } | null = null,
): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layoutIndex + 1}.xml"/>`,
    notes
      ? `<Relationship Id="${notes.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/${notes.target}"/>`
      : '',
    mediaRels
      .map(
        (rel) =>
          `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${rel.target}"/>`,
      )
      .join(''),
    '</Relationships>',
  ].join('');
}
