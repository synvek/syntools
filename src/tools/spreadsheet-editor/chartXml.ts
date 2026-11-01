import {
  resolveChart,
  seriesRenderKind,
  usesSecondaryAxis,
  type ChartConfig,
  type ChartSpec,
  type ChartType,
  type SeriesRenderKind,
} from './charts';
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
 * Writes in-app charts as **native Excel charts** (DrawingML) and injects them into the .xlsx that
 * exceljs produces.
 *
 * Why the manual injection: exceljs's drawing layer only implements pictures (`xdr:pic`) — no
 * `graphicFrame` / `c:chart`, and no public addChart API; community SheetJS does not write charts
 * either. But .xlsx is just zip + OOXML, so jszip (already a dependency) handles the post-processing.
 *
 * Injection points (all required — Excel otherwise complains it "needs repair"):
 * 1. `xl/charts/chartN.xml`        — chart definition
 * 2. `xl/drawings/drawingM.xml`    — anchor + graphicFrame pointing at the chart
 * 3. `xl/drawings/_rels/drawingM.xml.rels` — drawing → chart relationships
 * 4. `xl/worksheets/_rels/*.rels`  — sheet → drawing relationship
 * 5. `xl/worksheets/sheetK.xml`    — `<drawing r:id="..."/>` appended at the end
 * 6. `[Content_Types].xml`         — Override entries for the new drawing / chart parts
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

/** Axis ids: any valid positive integers, as long as the chart group and axes cross-reference consistently */
const CAT_AX_ID = '111111111';
const VAL_AX_ID = '222222222';
/**
 * 次坐标轴的数值轴。Excel 的双轴图就是"两个图表组共用同一个分类轴、各自一条数值轴"，
 * 次轴用 `axPos="r"` + `crosses="max"` 落到右侧，不需要第二条分类轴。
 */
const SECOND_VAL_AX_ID = '333333333';

/** Series palette (close to the in-app ECharts look, and easy to tell series apart) */
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

/* -------------------------------- Basic helpers -------------------------------- */

/** Escape XML text, dropping control characters XML 1.0 forbids (except \t \n \r) */
export function xmlEscape(text: string): string {
  let cleaned = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    cleaned += char;
  }
  // Attribute values are always double-quoted, so only & < > " need escaping;
  // single quotes stay as-is, so a formula's 'Sheet'! is not turned into &apos;Sheet&apos;!
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Sheet-name prefix used in formulas. Excel allows single quotes around any sheet name, so always
 * quote here (doubling any inner quotes) to avoid the whole class of "space / dot / leading digit"
 * bugs.
 */
export function sheetRefPrefix(sheetName: string): string {
  const name = sheetName || 'Sheet1';
  return `'${name.replace(/'/g, "''")}'`;
}

/** Absolute cell reference: 'Sheet'!$B$2 */
export function absoluteCellRef(sheetName: string, row: number, column: number): string {
  return `${sheetRefPrefix(sheetName)}!$${columnIndexToName(column)}$${row + 1}`;
}

/** Absolute single-column range reference: 'Sheet'!$B$2:$B$4 */
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

/** Numeric cache: nulls become missing points (Excel treats them as blank) while ptCount stays the full length */
function numCache(values: readonly (number | null)[]): string {
  const points = values
    .map((value, index) =>
      value === null ? '' : `<c:pt idx="${index}"><c:v>${value}</c:v></c:pt>`,
    )
    .join('');
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numCache>`;
}

/* ------------------------------ Chart XML generation ------------------------------ */

/** 散点图的 X 值：分类文字 → 序号，数字串 → 数值（与 `charts.ts` 的 ECharts 侧保持一致） */
function scatterXValues(categories: readonly string[]): (number | null)[] {
  return categories.map((label, index) => {
    const parsed = Number(String(label).replace(/[,%\s]/g, ''));
    return Number.isFinite(parsed) && String(label).trim() !== '' ? parsed : index + 1;
  });
}

function seriesXml(
  spec: ChartSpec,
  index: number,
  sheetName: string,
  type: ChartType,
  kind: ChartType = type,
): string {
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
  // Pie slices are coloured via varyColors, so no series fill is written.
  // 面积图叠在一起，半透明才能看清每一层（与 ECharts 的 areaStyle.opacity = 0.6 对齐）
  const color = SERIES_COLORS[index % SERIES_COLORS.length];
  const shape =
    type === 'pie'
      ? ''
      : kind === 'area'
        ? `<c:spPr><a:solidFill><a:srgbClr val="${color}"><a:alpha val="60000"/></a:srgbClr></a:solidFill></c:spPr>`
        : `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr>`;

  // 散点图：X 轴也是数值轴，序列里必须用 xVal/yVal（不能用 cat/val，Excel 会当成"无法识别的图表"）
  if (kind === 'scatter') {
    const xRef =
      spec.categoryColumn === null
        ? ''
        : `<c:f>${xmlEscape(
            absoluteRangeRef(
              sheetName,
              spec.categoryStartRow,
              spec.categoryEndRow,
              spec.categoryColumn,
            ),
          )}</c:f>`;
    const xVal = `<c:xVal><c:numRef>${xRef}${numCache(scatterXValues(spec.categories))}</c:numRef></c:xVal>`;
    const yVal = `<c:yVal><c:numRef><c:f>${xmlEscape(
      absoluteRangeRef(sheetName, item.startRow, item.endRow, item.column),
    )}</c:f>${numCache(item.data)}</c:numRef></c:yVal>`;
    return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${title}${shape}<c:marker><c:symbol val="circle"/><c:size val="6"/></c:marker>${xVal}${yVal}</c:ser>`;
  }

  // 雷达图的每个"分类"是一个指标轴，cat/val 的写法与柱状图相同
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${title}${shape}${category}${values}</c:ser>`;
}

/** Category axis + value axis (element order per CT_CatAx / CT_ValAx) */
function axesXml(hasSecondary = false): string {
  const catAx = `<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${CAT_AX_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  if (!hasSecondary) return catAx + valAx;
  // 次轴：不画网格线（与主轴网格线会重叠成一片），crosses="max" 让它在分类轴最右端交叉 → 显示在右侧
  const secondaryValAx = `<c:valAx><c:axId val="${SECOND_VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="r"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${CAT_AX_ID}"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>`;
  return catAx + valAx + secondaryValAx;
}

/** 一组同画法、同坐标轴的系列：OOXML 里一个 chart group 只能一种画法、一对 axId */
interface ChartGroup {
  render: SeriesRenderKind;
  secondary: boolean;
  indexes: number[];
}

/** 输出顺序固定为 柱 → 线 → 面积（主组在前、次组在后），Excel 的图例顺序才与系列顺序一致 */
const RENDER_ORDER: SeriesRenderKind[] = ['bar', 'line', 'area'];

function groupSeries(spec: ChartSpec, type: ChartType, secondary: boolean): ChartGroup[] {
  const total = spec.series.length;
  const groups: ChartGroup[] = [];
  for (const render of RENDER_ORDER) {
    for (const onSecondary of [false, true]) {
      const indexes = spec.series
        .map((_, index) => index)
        .filter(
          (index) =>
            seriesRenderKind(type, index, total) === render &&
            usesSecondaryAxis(secondary, index, total) === onSecondary,
        );
      if (indexes.length > 0) {
        groups.push({ render, secondary: onSecondary, indexes });
      }
    }
  }
  return groups;
}

function groupXml(group: ChartGroup, spec: ChartSpec, sheetName: string, type: ChartType): string {
  const sers = group.indexes
    .map((index) => seriesXml(spec, index, sheetName, type, group.render))
    .join('');
  const axIds = `<c:axId val="${CAT_AX_ID}"/><c:axId val="${
    group.secondary ? SECOND_VAL_AX_ID : VAL_AX_ID
  }"/>`;
  if (group.render === 'line') {
    return `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/>${axIds}</c:lineChart>`;
  }
  if (group.render === 'area') {
    return `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}${axIds}</c:areaChart>`;
  }
  return `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="150"/>${axIds}</c:barChart>`;
}

export interface ChartXmlOptions {
  /** 最后一个系列走次坐标轴（与 `ChartConfig.secondary` 是同一个字段） */
  secondary?: boolean;
}

/** Build chartN.xml (chartSpace → chart → plotArea → chart group + axes) */
export function buildChartXml(
  spec: ChartSpec,
  type: ChartType,
  sheetName: string,
  options: ChartXmlOptions = {},
): string {
  const sers = spec.series.map((_, index) => seriesXml(spec, index, sheetName, type)).join('');
  const axIds = `<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/>`;
  let group: string;
  let hasSecondary = false;
  if (type === 'pie') {
    group = `<c:pieChart><c:varyColors val="1"/>${sers}</c:pieChart>`;
  } else if (type === 'scatter') {
    group = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${sers}${axIds}</c:scatterChart>`;
  } else if (type === 'radar') {
    group = `<c:radarChart><c:radarStyle val="marker"/><c:varyColors val="0"/>${sers}${axIds}</c:radarChart>`;
  } else {
    /**
     * 柱 / 线 / 面积 / 组合 + 可选双轴：按"画法 × 坐标轴"分组，每组一个 chart group。
     * 拆组而不是给单组混排，是因为 OOXML 里系列的画法和所属轴都由 chart group 决定；
     * 双轴则是两组共用同一个分类轴、各带一条数值轴（与 Excel 自己生成的结构一致）。
     */
    const groups = groupSeries(spec, type, options.secondary === true);
    hasSecondary = groups.some((item) => item.secondary);
    group = groups.map((item) => groupXml(item, spec, sheetName, type)).join('');
  }
  const axes = type === 'pie' ? '' : axesXml(hasSecondary);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${A_NS}" xmlns:r="${R_NS}"><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/>${group}${axes}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}

/* ------------------------------ Chart XML read-back ------------------------------ */

/** 从 chart part 读回来的结构（P2-S8 回读）：只取定位与类型需要的字段 */
export interface ParsedChartXml {
  type: ChartType;
  /** 系列引用里的表名（去掉引号）；没有任何引用时为 null */
  sheetName: string | null;
  /** 分类轴 / X 值的引用（原样 `f` 文本） */
  categoryRef: string | null;
  /** 每个系列数值引用（原样 `f` 文本，顺序与系列一致） */
  valueRefs: string[];
}

/** `'My Sheet'!$B$2:$B$4` → 表名 + 绝对引用（表名去掉引号并还原 `''`） */
export function splitSheetRef(ref: string): { sheetName: string | null; body: string } {
  const text = ref.trim();
  const bang = text.lastIndexOf('!');
  if (bang < 0) return { sheetName: null, body: text };
  let name = text.slice(0, bang).trim();
  if (name.startsWith("'")) name = name.slice(1, name.endsWith("'") ? -1 : undefined);
  return { sheetName: name.replace(/''/g, "'"), body: text.slice(bang + 1) };
}

/**
 * 读 chart part 的类型与系列引用。
 *
 * 只认结构、不解析样式：用途是"告诉用户文件里有什么图表"以及回读我们导出的类型，
 * 派生的坐标轴 / 图例 / 主题色一律忽略 —— 猜错样式比不猜更糟。
 */
export function parseChartXml(xml: string): ParsedChartXml | null {
  const hasBar = /<c:barChart\b/.test(xml) || /<c:bar3DChart\b/.test(xml);
  const hasLine = /<c:lineChart\b/.test(xml) || /<c:line3DChart\b/.test(xml);
  const hasArea = /<c:areaChart\b/.test(xml) || /<c:area3DChart\b/.test(xml);
  let type: ChartType | null = null;
  if (hasBar && hasLine) type = 'combo';
  else if (/<c:scatterChart\b/.test(xml)) type = 'scatter';
  else if (/<c:radarChart\b/.test(xml)) type = 'radar';
  else if (/<c:pieChart\b/.test(xml) || /<c:doughnutChart\b/.test(xml)) type = 'pie';
  // 面积图排在折线之前：Excel 的"带数据标记的面积图"可能同时带 lineChart
  else if (hasArea) type = 'area';
  else if (hasLine) type = 'line';
  else if (hasBar) type = 'bar';
  if (!type) return null;

  const seriesBlocks = xml.match(/<c:ser\b[\s\S]*?<\/c:ser>/g) ?? [];
  const categoryRef = firstRef(seriesBlocks, /<c:(?:cat|xVal)\b[\s\S]*?<c:f>([^<]*)<\/c:f>/);
  const valueRefs = seriesBlocks
    .map((block) => /<c:(?:val|yVal)\b[\s\S]*?<c:f>([^<]*)<\/c:f>/.exec(block)?.[1]?.trim())
    .filter((ref): ref is string => Boolean(ref));

  const first = categoryRef ?? valueRefs[0] ?? null;
  const sheetName = first ? splitSheetRef(first).sheetName : null;
  return { type, sheetName, categoryRef, valueRefs };
}

function firstRef(blocks: readonly string[], pattern: RegExp): string | null {
  for (const block of blocks) {
    const hit = pattern.exec(block)?.[1]?.trim();
    if (hit) return hit;
  }
  return null;
}

/* -------------------------------- Anchor maths -------------------------------- */

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
 * Pixels (relative to the sheet area, header rows/columns included) → a one-cell anchor.
 * Subtract the header sizes first, then convert using the default column width / row height.
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

/** oneCellAnchor + graphicFrame (referencing the chart part's relationship id) */
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

/** Create a new drawing part (anchorsXml may be empty and appended later) */
export function buildDrawingXml(anchorsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}" xmlns:c="${CHART_NS}" xmlns:r="${R_NS}">${anchorsXml}</xdr:wsDr>`;
}

/** Append anchors to an existing drawing (add charts to a drawing kept from import) */
export function appendAnchorsToDrawing(drawingXml: string, anchorsXml: string): string {
  if (!anchorsXml) return drawingXml;
  const close = drawingXml.lastIndexOf('</xdr:wsDr>');
  if (close < 0) return buildDrawingXml(anchorsXml);
  return `${drawingXml.slice(0, close)}${anchorsXml}${drawingXml.slice(close)}`;
}

/* ------------------------------ Relationships and content types ------------------------------ */

/** Idempotently insert a relationship, returning the updated rels and its id (rIds continue from the highest used) */
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

/** The worksheet root must declare the r: namespace (exceljs does not always write it) */
export function ensureRelationshipNamespace(sheetXml: string): string {
  // Skip the <?xml ... ?> declaration, or the attribute would land on it and break the XML
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
 * Insert `<drawing/>` at the end of sheetN.xml.
 * In CT_Worksheet, drawing comes after pageSetup/headerFooter and before tableParts/extLst, so insert
 * before tableParts / extLst when present, otherwise before </worksheet>.
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

/** Merge content-type entries (deduplicated by PartName / Extension, then appended) */
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

/* ------------------------------- Plan and injection ------------------------------- */

export interface PlannedChart {
  chartXml: string;
  anchor: ChartAnchorPx;
}

export interface XlsxChartPlan {
  /** Sheet name → charts to inject */
  chartsBySheet: Record<string, PlannedChart[]>;
  /** Sheet name → pixel conversion metrics */
  metricsBySheet: Record<string, SheetMetrics>;
  /** Native chart parts kept from import (written back unchanged) */
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

/** Snapshot → injection plan (which charts go into which sheet, their metrics, and the native parts to write back) */
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
      chartXml: buildChartXml(spec.value, config.type, sheetName, {
        secondary: config.secondary,
      }),
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
 * Inject the charts into the .xlsx produced by exceljs.
 * Callers skip this when there are no new charts and no kept parts (an empty plan is handled safely
 * here too).
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

  // 1) Write back native chart parts kept from import (same paths, numbering skipped)
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

  // 2) Handle each sheet (including sheets that only have native charts from import, which still need a sheet → drawing link)
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

    // a) Allocate chart parts
    const assignments = pending.map((item) => {
      const chartPath = `xl/charts/chart${nextChartNumber}.xml`;
      nextChartNumber += 1;
      zip.file(chartPath, item.chartXml);
      contentTypeEntries.push(contentTypeOverride(`/${chartPath}`, CT_CHART));
      return { chartPath, anchor: item.anchor };
    });

    // b) drawing part: reuse the imported one (appending anchors), otherwise create it
    let drawingPath = existingDrawing;
    if (!drawingPath) {
      drawingPath = `xl/drawings/drawing${nextDrawingNumber}.xml`;
      nextDrawingNumber += 1;
      contentTypeEntries.push(contentTypeOverride(`/${drawingPath}`, CT_DRAWING));
      zip.file(drawingPath, buildDrawingXml(''));
    }
    const drawingRelsPath = relsPathFor(drawingPath);

    // c) Allocate chart → drawing relationship ids
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

    // d) Append anchors to the drawing (cNvPr ids start at 2, which also keeps them clear of existing anchors)
    if (assignments.length > 0) {
      const drawingXml = (await readText(zip, drawingPath)) ?? buildDrawingXml('');
      const anchorsXml = assignments
        .map((item, index) => buildAnchorXml(item.anchor, metrics, relIds[index], index + 2))
        .join('');
      zip.file(drawingPath, appendAnchorsToDrawing(drawingXml, anchorsXml));
    }

    // e) sheet → drawing relationship + <drawing/>
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

  // 3) Merge content types
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
