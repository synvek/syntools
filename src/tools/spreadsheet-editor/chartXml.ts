import { resolveChart, type ChartConfig, type ChartSpec, type ChartType } from './charts';
import { columnIndexToName, type WorkbookSnapshotLite } from './core';
import {
  dirOf,
  parseRelationships,
  relevantContentTypeEntries,
  relsPathFor,
  resolveSheetParts,
  type RawChartParts,
} from './rawChartParts';

/**
 * 把站内图表写成 Excel **原生图表**（DrawingML），注入到 exceljs 产出的 .xlsx 里。
 *
 * 为什么必须自己注入：exceljs 的 drawing 层只实现图片（`xdr:pic`），
 * 没有 `graphicFrame` / `c:chart`，公开 API 也没有 addChart；
 * SheetJS 社区版同样不写图表。而 .xlsx 就是 zip + OOXML，
 * 因此用已在依赖里的 jszip 做后处理注入。
 *
 * 注入点（必需，缺一 Excel 会报“需要修复”）：
 * 1. `xl/charts/chartN.xml`        —— 图表定义
 * 2. `xl/drawings/drawingM.xml`    —— 锚点 + graphicFrame 指向 chart
 * 3. `xl/drawings/_rels/drawingM.xml.rels` —— drawing → chart 关系
 * 4. `xl/worksheets/_rels/*.rels`  —— sheet → drawing 关系
 * 5. `xl/worksheets/sheetK.xml`    —— 末尾插入 `<drawing r:id="..."/>`
 * 6. `[Content_Types].xml`         —— 追加 drawing / chart 的 Override
 */

export const EMU_PER_PX = 9525;

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XDR_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const REL_DRAWING = `${R_NS}/drawing`;
const REL_CHART = `${R_NS}/chart`;
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml';
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

/** 两轴 id：任一合法正整数即可，只要图组与坐标轴互相引用一致 */
const CAT_AX_ID = '111111111';
const VAL_AX_ID = '222222222';

/** 系列配色（与站内 ECharts 观感接近，同时便于区分多系列） */
const SERIES_COLORS = [
  '5470C6',
  '91CC75',
  'FAC858',
  'EE6666',
  '73C0DE',
  '3BA272',
  'FC8452',
  '9A60B4',
];

export interface SheetMetrics {
  defaultColumnWidth: number;
  defaultRowHeight: number;
  rowHeaderWidth: number;
  columnHeaderHeight: number;
}

export const DEFAULT_SHEET_METRICS: SheetMetrics = {
  defaultColumnWidth: 93,
  defaultRowHeight: 27,
  rowHeaderWidth: 46,
  columnHeaderHeight: 20,
};

/* -------------------------------- 基础工具 -------------------------------- */

/** XML 文本转义，并丢弃 XML 1.0 不允许的控制字符（\t \n \r 除外） */
export function xmlEscape(text: string): string {
  let cleaned = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    cleaned += char;
  }
  // 属性值都用双引号包裹，因此只需转义 & < > "；
  // 单引号保持原样，避免把公式里的 'Sheet'! 写成 &apos;Sheet&apos;!
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 公式里的工作表名前缀。Excel 允许对任意表名加单引号，
 * 因此这里一律加引号（并翻倍内部单引号），避免「含空格/点号/数字开头」等一大类错误。
 */
export function sheetRefPrefix(sheetName: string): string {
  const name = sheetName || 'Sheet1';
  return `'${name.replace(/'/g, "''")}'`;
}

/** 绝对单元格引用：'Sheet'!$B$2 */
export function absoluteCellRef(sheetName: string, row: number, column: number): string {
  return `${sheetRefPrefix(sheetName)}!$${columnIndexToName(column)}$${row + 1}`;
}

/** 绝对单列区域引用：'Sheet'!$B$2:$B$4 */
export function absoluteRangeRef(
  sheetName: string,
  startRow: number,
  endRow: number,
  column: number,
): string {
  const letter = columnIndexToName(column);
  return `${sheetRefPrefix(sheetName)}!$${letter}$${startRow + 1}:$${letter}$${endRow + 1}`;
}

function strCache(values: readonly string[]): string {
  const points = values
    .map((value, index) => `<c:pt idx="${index}"><c:v>${xmlEscape(value)}</c:v></c:pt>`)
    .join('');
  return `<c:strCache><c:ptCount val="${values.length}"/>${points}</c:strCache>`;
}

/** 数值缓存：空值写成缺失点（Excel 会视为空），ptCount 仍为完整长度 */
function numCache(values: readonly (number | null)[]): string {
  const points = values
    .map((value, index) =>
      value === null ? '' : `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`,
    )
    .join('');
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numCache>`;
}

/* ------------------------------ 图表 XML 生成 ------------------------------ */

function seriesXml(spec: ChartSpec, index: number, sheetName: string, type: ChartType): string {
  const item = spec.series[index];
  const title = item.nameCell
    ? `<c:tx><c:strRef><c:f>${xmlEscape(
        absoluteCellRef(sheetName, item.nameCell.row, item.nameCell.column),
      )}</c:f>${strCache([item.name])}</c:strRef></c:tx>`
    : `<c:tx><c:v>${xmlEscape(item.name)}</c:v></c:tx>`;
  const category =
    spec.categoryColumn === null
      ? ''
      : `<c:cat><c:strRef><c:f>${xmlEscape(
          absoluteRangeRef(
            sheetName,
            spec.categoryStartRow,
            spec.categoryEndRow,
            spec.categoryColumn,
          ),
        )}</c:f>${strCache(spec.categories)}</c:strRef></c:cat>`;
  const values = `<c:val><c:numRef><c:f>${xmlEscape(
    absoluteRangeRef(sheetName, item.startRow, item.endRow, item.column),
  )}</c:f>${numCache(item.data)}</c:numRef></c:val>`;
  // 饼图由 varyColors 着色，不写系列填充
  const shape =
    type === 'pie'
      ? ''
      : `<c:spPr><a:solidFill><a:srgbClr val="${
          SERIES_COLORS[index % SERIES_COLORS.length]
        }"/></a:solidFill></c:spPr>`;
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${title}${shape}${category}${values}</c:ser>`;
}

/** 分类轴 + 数值轴（元素顺序按 CT_CatAx / CT_ValAx 规定） */
function axesXml(): string {
  const catAx = `<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${CAT_AX_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  return catAx + valAx;
}

/** 生成 chartN.xml（chartSpace → chart → plotArea → 图组 + 坐标轴） */
export function buildChartXml(spec: ChartSpec, type: ChartType, sheetName: string): string {
  const sers = spec.series.map((_, index) => seriesXml(spec, index, sheetName, type)).join('');
  let group: string;
  if (type === 'pie') {
    group = `<c:pieChart><c:varyColors val="1"/>${sers}</c:pieChart>`;
  } else if (type === 'line') {
    group = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:lineChart>`;
  } else {
    group = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="150"/><c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:barChart>`;
  }
  const axes = type === 'pie' ? '' : axesXml();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${group}${axes}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

/* -------------------------------- 锚点计算 -------------------------------- */

export interface ChartAnchorPx {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingAnchor {
  col: number;
  colOff: number;
  row: number;
  rowOff: number;
  cx: number;
  cy: number;
}

/**
 * 像素（相对工作表区域，含行列头）→ 一单元格锚点。
 * 减去行列头尺寸后按默认列宽 / 行高换算。
 */
export function computeAnchor(anchor: ChartAnchorPx, metrics: SheetMetrics): DrawingAnchor {
  const left = Math.max(0, anchor.x - metrics.rowHeaderWidth);
  const top = Math.max(0, anchor.y - metrics.columnHeaderHeight);
  const columnWidth = Math.max(1, metrics.defaultColumnWidth);
  const rowHeight = Math.max(1, metrics.defaultRowHeight);
  return {
    col: Math.floor(left / columnWidth),
    colOff: Math.round((left % columnWidth) * EMU_PER_PX),
    row: Math.floor(top / rowHeight),
    rowOff: Math.round((top % rowHeight) * EMU_PER_PX),
    cx: Math.max(EMU_PER_PX, Math.round(anchor.width * EMU_PER_PX)),
    cy: Math.max(EMU_PER_PX, Math.round(anchor.height * EMU_PER_PX)),
  };
}

/** oneCellAnchor + graphicFrame（引用 chart 部件的关系 id） */
export function buildAnchorXml(
  anchor: ChartAnchorPx,
  metrics: SheetMetrics,
  relId: string,
  shapeId = 2,
): string {
  const a = computeAnchor(anchor, metrics);
  return (
    `<xdr:oneCellAnchor>` +
    `<xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>${a.colOff}</xdr:colOff>` +
    `<xdr:row>${a.row}</xdr:row><xdr:rowOff>${a.rowOff}</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${a.cx}" cy="${a.cy}"/>` +
    `<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr><xdr:cNvPr id="${shapeId}" name="Chart ${shapeId}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>` +
    `<a:graphic><a:graphicData uri="${CHART_NS}"><c:chart xmlns:c="${CHART_NS}" xmlns:r="${R_NS}" r:id="${relId}"/></a:graphicData></a:graphic>` +
    `</xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`
  );
}

/** 新建 drawing 部件（anchorsXml 可为空，后续追加） */
export function buildDrawingXml(anchorsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}" xmlns:c="${CHART_NS}" xmlns:r="${R_NS}">${anchorsXml}</xdr:wsDr>`;
}

/** 往既有 drawing 追加锚点（导入保留的 drawing 上继续加图） */
export function appendAnchorsToDrawing(drawingXml: string, anchorsXml: string): string {
  if (!anchorsXml) return drawingXml;
  const close = drawingXml.lastIndexOf('</xdr:wsDr>');
  if (close < 0) return buildDrawingXml(anchorsXml);
  return `${drawingXml.slice(0, close)}${anchorsXml}${drawingXml.slice(close)}`;
}

/* ------------------------------ 关系与内容类型 ------------------------------ */

/** 幂等地插入一条关系，返回最新 rels 与关系 id（rId 从已用的最大编号继续） */
export function upsertRelationship(
  xml: string | null,
  type: string,
  target: string,
): { xml: string; id: string } {
  const current = parseRelationships(xml);
  const existing = current.find((item) => item.type === type && item.target === target);
  if (existing && xml) return { xml, id: existing.id };
  let maxId = 0;
  for (const item of current) {
    const matched = /^rId(\d+)$/.exec(item.id);
    if (matched) maxId = Math.max(maxId, Number(matched[1]));
  }
  const id = `rId${maxId + 1}`;
  const element = `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
  const body =
    xml ??
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PKG_REL_NS}"></Relationships>`;
  const close = body.lastIndexOf('</Relationships>');
  return {
    xml: close < 0 ? body + element : `${body.slice(0, close)}${element}${body.slice(close)}`,
    id,
  };
}

/** 工作表根节点必须声明 r: 命名空间（exceljs 未必写全） */
export function ensureRelationshipNamespace(sheetXml: string): string {
  // 跳过 <?xml ... ?> 声明，避免把属性加到声明上（否则直接破坏 XML）
  const declarationEnd = sheetXml.startsWith('<?xml') ? sheetXml.indexOf('?>') : -1;
  const searchFrom = declarationEnd < 0 ? 0 : declarationEnd + 2;
  const rootStart = sheetXml.indexOf('<', searchFrom);
  if (rootStart < 0) return sheetXml;
  const rootEnd = sheetXml.indexOf('>', rootStart);
  if (rootEnd < 0) return sheetXml;
  return /xmlns:r=/.test(sheetXml.slice(rootStart, rootEnd))
    ? sheetXml
    : `${sheetXml.slice(0, rootEnd)} xmlns:r="${R_NS}"${sheetXml.slice(rootEnd)}`;
}

/**
 * 在 sheetN.xml 末尾插入 `<drawing/>`。
 * CT_Worksheet 里 drawing 排在 pageSetup/headerFooter 之后、tableParts/extLst 之前，
 * 因此优先插到 tableParts / extLst 前，否则插到 </worksheet> 前。
 */
export function insertDrawingIntoSheet(sheetXml: string, relId: string): string {
  if (!sheetXml) return sheetXml;
  const withNamespace = ensureRelationshipNamespace(sheetXml);
  const element = `<drawing r:id="${relId}"/>`;
  for (const tag of ['<tableParts', '<extLst']) {
    const index = withNamespace.indexOf(tag);
    if (index >= 0)
      return `${withNamespace.slice(0, index)}${element}${withNamespace.slice(index)}`;
  }
  const close = withNamespace.lastIndexOf('</worksheet>');
  return close < 0
    ? withNamespace
    : `${withNamespace.slice(0, close)}${element}${withNamespace.slice(close)}`;
}

export function contentTypeOverride(partName: string, contentType: string): string {
  return `<Override PartName="${partName}" ContentType="${contentType}"/>`;
}

/** 合并内容类型条目（按 PartName / Extension 去重后追加） */
export function addContentTypeEntries(xml: string, entries: readonly string[]): string {
  if (entries.length === 0) return xml;
  const keyOf = (tag: string) => {
    const part = /\bPartName="([^"]*)"/.exec(tag)?.[1];
    if (part) return `P:${part}`;
    const extension = /\bExtension="([^"]*)"/.exec(tag)?.[1];
    return extension ? `E:${extension}` : tag;
  };
  const seen = new Set((xml.match(/<(?:Override|Default)\b[^>]*?\/?>/g) ?? []).map(keyOf));
  const additions: string[] = [];
  for (const tag of entries) {
    const key = keyOf(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(tag);
  }
  if (additions.length === 0) return xml;
  const close = xml.lastIndexOf('</Types>');
  const block = additions.join('');
  return close < 0 ? xml + block : `${xml.slice(0, close)}${block}${xml.slice(close)}`;
}

/* ------------------------------- 计划与注入 ------------------------------- */

export interface PlannedChart {
  chartXml: string;
  anchor: ChartAnchorPx;
}

export interface XlsxChartPlan {
  /** 工作表名 → 待注入的图表 */
  chartsBySheet: Record<string, PlannedChart[]>;
  /** 工作表名 → 像素换算度量 */
  metricsBySheet: Record<string, SheetMetrics>;
  /** 导入时保留的原生图表部件（原样回填） */
  passthrough: RawChartParts | null;
}

interface PlanSheet {
  name?: string;
  cellData?: Record<string, Record<string, { v?: unknown; f?: unknown }>>;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  rowHeader?: { width?: number };
  columnHeader?: { height?: number };
}

export interface ChartPlanSource extends WorkbookSnapshotLite {
  sheets?: Record<string, PlanSheet>;
  syntoolsCharts?: ChartConfig[];
  syntoolsRawParts?: RawChartParts;
}

/** 快照 → 注入计划（哪些表要加哪些图 + 各自度量 + 需回填的原生部件） */
export function buildChartPlan(source: ChartPlanSource): XlsxChartPlan {
  const metricsBySheet: Record<string, SheetMetrics> = {};
  for (const sheet of Object.values(source.sheets ?? {})) {
    const name = sheet.name;
    if (!name) continue;
    metricsBySheet[name] = {
      defaultColumnWidth: sheet.defaultColumnWidth || DEFAULT_SHEET_METRICS.defaultColumnWidth,
      defaultRowHeight: sheet.defaultRowHeight || DEFAULT_SHEET_METRICS.defaultRowHeight,
      rowHeaderWidth: sheet.rowHeader?.width ?? DEFAULT_SHEET_METRICS.rowHeaderWidth,
      columnHeaderHeight: sheet.columnHeader?.height ?? DEFAULT_SHEET_METRICS.columnHeaderHeight,
    };
  }

  const chartsBySheet: Record<string, PlannedChart[]> = {};
  for (const config of source.syntoolsCharts ?? []) {
    const fallbackId = (source.sheetOrder ?? [])[0];
    const sheetId = config.sheetId && source.sheets?.[config.sheetId] ? config.sheetId : fallbackId;
    const sheetName = sheetId ? source.sheets?.[sheetId]?.name : undefined;
    if (!sheetName) continue;
    const spec = resolveChart(source, sheetId ?? null, config.range);
    if (!spec.ok) continue;
    (chartsBySheet[sheetName] ??= []).push({
      chartXml: buildChartXml(spec.value, config.type, sheetName),
      anchor: { x: config.x, y: config.y, width: config.width, height: config.height },
    });
  }

  return { chartsBySheet, metricsBySheet, passthrough: source.syntoolsRawParts ?? null };
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

async function readText(
  zip: { file: (path: string) => { async: (type: 'string') => Promise<string> } | null },
  path: string,
): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async('string') : null;
}

/**
 * 把图表注入到 exceljs 产出的 .xlsx。
 * 无新图表且无保留部件时由调用方直接跳过（这里也可安全处理空计划）。
 */
export async function injectChartsIntoXlsx(
  buffer: ArrayBuffer,
  plan: XlsxChartPlan,
): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const sheetParts = await resolveSheetParts(zip);
  const passthrough = plan.passthrough;

  let nextChartNumber = 1;
  let nextDrawingNumber = 1;
  const contentTypeEntries: string[] = [];

  // 1) 回填导入时保留的原生图表部件（路径不变，编号避让）
  if (passthrough) {
    for (const [path, base64] of Object.entries(passthrough.parts)) {
      zip.file(path, base64, { base64: true });
      const chart = /^xl\/charts\/chart(\d+)\.xml$/.exec(path);
      if (chart) nextChartNumber = Math.max(nextChartNumber, Number(chart[1]) + 1);
      const drawing = /^xl\/drawings\/drawing(\d+)\.xml$/.exec(path);
      if (drawing) nextDrawingNumber = Math.max(nextDrawingNumber, Number(drawing[1]) + 1);
    }
    contentTypeEntries.push(
      ...relevantContentTypeEntries(passthrough.contentTypes, Object.keys(passthrough.parts)),
    );
  }

  // 2) 逐表处理（含「只在导入侧有原生图表」的表，需要补 sheet → drawing 关系）
  const sheetNames = new Set([
    ...Object.keys(plan.chartsBySheet),
    ...Object.keys(passthrough?.sheetDrawings ?? {}),
  ]);

  for (const sheetName of sheetNames) {
    const sheetPath = sheetParts[sheetName];
    if (!sheetPath) continue;
    const sheetXml = await readText(zip, sheetPath);
    if (sheetXml === null) continue;

    const pending = plan.chartsBySheet[sheetName] ?? [];
    const existingDrawing = passthrough?.sheetDrawings[sheetName] ?? null;
    if (pending.length === 0 && !existingDrawing) continue;

    const metrics = plan.metricsBySheet[sheetName] ?? DEFAULT_SHEET_METRICS;

    // a) 分配 chart 部件
    const assignments = pending.map((item) => {
      const chartPath = `xl/charts/chart${nextChartNumber}.xml`;
      nextChartNumber += 1;
      zip.file(chartPath, item.chartXml);
      contentTypeEntries.push(contentTypeOverride(`/${chartPath}`, CT_CHART));
      return { chartPath, anchor: item.anchor };
    });

    // b) drawing 部件：沿用导入的（追加锚点），否则新建
    let drawingPath = existingDrawing;
    if (!drawingPath) {
      drawingPath = `xl/drawings/drawing${nextDrawingNumber}.xml`;
      nextDrawingNumber += 1;
      contentTypeEntries.push(contentTypeOverride(`/${drawingPath}`, CT_DRAWING));
      zip.file(drawingPath, buildDrawingXml(''));
    }
    const drawingRelsPath = relsPathFor(drawingPath);

    // c) 分配 chart → drawing 关系 id
    let drawingRelsXml = await readText(zip, drawingRelsPath);
    const relIds: string[] = [];
    for (const item of assignments) {
      const updated = upsertRelationship(
        drawingRelsXml,
        REL_CHART,
        `../charts/${basename(item.chartPath)}`,
      );
      drawingRelsXml = updated.xml;
      relIds.push(updated.id);
    }
    if (assignments.length > 0 && drawingRelsXml) zip.file(drawingRelsPath, drawingRelsXml);

    // d) drawing 里追加锚点（cNvPr id 从 2 开始，避免与既有锚点冲突时也足够安全）
    if (assignments.length > 0) {
      const drawingXml = (await readText(zip, drawingPath)) ?? buildDrawingXml('');
      const anchorsXml = assignments
        .map((item, index) => buildAnchorXml(item.anchor, metrics, relIds[index], index + 2))
        .join('');
      zip.file(drawingPath, appendAnchorsToDrawing(drawingXml, anchorsXml));
    }

    // e) 工作表 → drawing 关系 + <drawing/>
    const sheetRelsPath = relsPathFor(sheetPath);
    const sheetRelsXml = await readText(zip, sheetRelsPath);
    const drawingRel = upsertRelationship(
      sheetRelsXml,
      REL_DRAWING,
      `../drawings/${basename(drawingPath)}`,
    );
    zip.file(sheetRelsPath, drawingRel.xml);
    zip.file(sheetPath, insertDrawingIntoSheet(sheetXml, drawingRel.id));
  }

  // 3) 合并内容类型
  const contentTypes = await readText(zip, '[Content_Types].xml');
  if (contentTypes) {
    zip.file('[Content_Types].xml', addContentTypeEntries(contentTypes, contentTypeEntries));
  }

  return (await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
  })) as ArrayBuffer;
}

export { dirOf };
