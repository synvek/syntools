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
  // Pie slices are coloured via varyColors, so no series fill is written
  const shape =
    type === 'pie'
      ? ''
      : `<c:spPr><a:solidFill><a:srgbClr val="${
          SERIES_COLORS[index % SERIES_COLORS.length]
        }"/></a:solidFill></c:spPr>`;
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>${title}${shape}${category}${values}</c:ser>`;
}

/** Category axis + value axis (element order per CT_CatAx / CT_ValAx) */
function axesXml(): string {
  const catAx = `<c:catAx><c:axId val="${CAT_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${VAL_AX_ID}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="${VAL_AX_ID}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${CAT_AX_ID}"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  return catAx + valAx;
}

/** Build chartN.xml (chartSpace → chart → plotArea → chart group + axes) */
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
