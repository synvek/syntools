import { isSingleSeriesChart } from '../slide-editor/model/chart';
import type { SlideDoc, SlideElement } from '../slide-editor/model/types';
import type { WorkbookSnapshot } from '../spreadsheet-editor/xlsx-io';
import { countExtras, readWorkbookExtras } from '../spreadsheet-editor/xlsx-extras';
import type { Metrics } from './types';

/**
 * Metrics are deliberately structural: how many of each thing exists, and how rich it is.
 * Ids, names, timestamps and byte sizes are excluded so a golden file never churns.
 */

function countByType(elements: SlideElement[], acc: Metrics): void {
  for (const element of elements) {
    acc.elements += 1;
    acc[element.type] = (acc[element.type] ?? 0) + 1;

    if (element.type === 'text') {
      acc.textRuns += element.body.paragraphs.reduce((sum, p) => sum + p.runs.length, 0);
      acc.paragraphs += element.body.paragraphs.length;
      acc.bullets += element.body.paragraphs.filter((p) => p.bullet).length;
      acc.numbered += element.body.paragraphs.filter((p) => p.numbering).length;
      if (element.fill) acc.filledTextFrames += 1;
    }

    if (element.type === 'shape') {
      if (element.geom.custGeom) {
        acc.custGeomShapes += 1;
        acc.custGeomPoints += element.geom.custGeom.length;
      }
      if (element.geom.adj) acc.adjValues += Object.keys(element.geom.adj).length;
      if (element.geom.prst && !element.geom.custGeom) acc.prstShapes += 1;
      if (element.fill?.type === 'gradient') acc.gradientFills += 1;
      if (element.body) acc.shapeTextFrames += 1;
    }

    if (element.type === 'line') {
      if (element.startCxn?.shapeId) acc.boundConnectors += 1;
      if (element.endCxn?.shapeId) acc.boundConnectors += 1;
      if (element.head && element.head !== 'none') acc.arrowHeads += 1;
      if (element.tail && element.tail !== 'none') acc.arrowTails += 1;
    }

    if (element.type === 'table') {
      acc.tableCells += element.rows.reduce((sum, row) => sum + row.length, 0);
      acc.tableMerges += element.rows.reduce(
        (sum, row) => sum + row.filter((cell) => Boolean(cell.colSpan || cell.rowSpan)).length,
        0,
      );
      acc.tableStyledCells += element.rows.reduce(
        (sum, row) => sum + row.filter((cell) => Boolean(cell.fill)).length,
        0,
      );
    }

    if (element.type === 'chart') {
      // Pie/doughnut render and export only the first series (normalizeChartData truncates them),
      // so count what the user actually sees — otherwise a 2-series pie reads as data loss after
      // a round trip even though nothing visible changed.
      acc.chartSeries += isSingleSeriesChart(element.chartType)
        ? Math.min(1, element.series.length)
        : element.series.length;
      acc.chartCategories += element.categories.length;
    }

    if (element.type === 'group') countByType(element.children, acc);

    if (element.shadow) acc.shadows += 1;
    if (element.rotation) acc.rotations += 1;
    if (element.flipX || element.flipY) acc.flips += 1;
  }
}

export function slideMetrics(doc: SlideDoc): Metrics {
  const acc: Metrics = {
    slides: doc.slides.length,
    masters: doc.masters.length,
    layouts: doc.layouts.length,
    media: Object.keys(doc.media).length,
    masterElements: doc.masters.reduce((sum, m) => sum + m.elements.length, 0),
    layoutElements: doc.layouts.reduce((sum, l) => sum + l.elements.length, 0),
    elements: 0,
    text: 0,
    shape: 0,
    line: 0,
    table: 0,
    chart: 0,
    image: 0,
    group: 0,
    icon: 0,
    formula: 0,
    placeholder: 0,
    textRuns: 0,
    paragraphs: 0,
    bullets: 0,
    numbered: 0,
    filledTextFrames: 0,
    shapeTextFrames: 0,
    prstShapes: 0,
    custGeomShapes: 0,
    custGeomPoints: 0,
    adjValues: 0,
    gradientFills: 0,
    boundConnectors: 0,
    arrowHeads: 0,
    arrowTails: 0,
    tableCells: 0,
    tableMerges: 0,
    tableStyledCells: 0,
    chartSeries: 0,
    chartCategories: 0,
    shadows: 0,
    rotations: 0,
    flips: 0,
  };
  for (const slide of doc.slides) countByType(slide.elements, acc);
  acc.slidesWithBackground = doc.slides.filter((s) => Boolean(s.background)).length;
  return acc;
}

export function sheetMetrics(snapshot: WorkbookSnapshot): Metrics {
  const acc: Metrics = {
    sheets: snapshot.sheetOrder.length,
    hiddenSheets: 0,
    cells: 0,
    formulas: 0,
    richTextCells: 0,
    hyperlinks: 0,
    notes: 0,
    merges: 0,
    freezeSheets: 0,
    /** Charts the editor can still edit */
    charts: (snapshot.syntoolsCharts ?? []).length,
    /** Charts that survive only as verbatim parts (edited file → import → export) */
    rawChartParts: Object.keys(snapshot.syntoolsRawParts?.parts ?? {}).length,
    /** CF/DV are measured across both channels: editor resources and preserved extras */
    cfRules: 0,
    dvRules: 0,
    commentThreads: Object.keys(snapshot.syntoolsComments ?? {}).length,
  };

  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (!sheet) continue;
    if (sheet.hidden) acc.hiddenSheets += 1;
    if (sheet.freeze.startRow >= 0 || sheet.freeze.startColumn >= 0) acc.freezeSheets += 1;
    acc.merges += sheet.mergeData.length;
    for (const row of Object.values(sheet.cellData)) {
      for (const cell of Object.values(row)) {
        acc.cells += 1;
        if (cell.f) acc.formulas += 1;
        if (cell.p) acc.richTextCells += 1;
        if (cell.custom?.hyperlink) acc.hyperlinks += 1;
        if (cell.custom?.note) acc.notes += 1;
      }
    }
  }

  // Channel 1: rules created inside the editor (Univer plugin resources)
  const resources = snapshot.resources as
    Record<string, Record<string, Record<string, unknown[]>>> | undefined;
  for (const [pluginName, units] of Object.entries(resources ?? {})) {
    const isCf = pluginName.includes('CONDITIONAL_FORMATTING');
    const isDv = pluginName.includes('DATA_VALIDATION');
    if (!isCf && !isDv) continue;
    for (const unit of Object.values(units ?? {})) {
      for (const rules of Object.values(unit ?? {})) {
        if (!Array.isArray(rules)) continue;
        if (isCf) acc.cfRules += rules.length;
        else acc.dvRules += rules.length;
      }
    }
  }

  // Channel 2: rules preserved from an imported file (never parsed, written back verbatim)
  const extras = countExtras(readWorkbookExtras(snapshot));
  acc.cfRules += extras.conditionalFormattings;
  acc.dvRules += extras.dataValidations;

  return acc;
}

/** Structural metrics of rich-text HTML (works for both the source and the re-imported HTML) */
export function docMetrics(html: string): Metrics {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  const count = (selector: string): number => body.querySelectorAll(selector).length;

  const acc: Metrics = {
    headings: count('h1,h2,h3,h4,h5,h6'),
    h1: count('h1'),
    h2: count('h2'),
    h3: count('h3'),
    paragraphs: count('p'),
    listItems: count('li'),
    orderedLists: count('ol'),
    unorderedLists: count('ul'),
    tables: count('table'),
    tableRows: count('tr'),
    tableCells: count('td,th'),
    colspanCells: count('td[colspan],th[colspan]'),
    blockquotes: count('blockquote'),
    codeBlocks: count('pre'),
    bold: count('strong,b'),
    italic: count('em,i'),
    underline: count('u'),
    strike: count('s,strike,del'),
    links: count('a[href]'),
    images: count('img'),
    chars: (body.textContent ?? '').replace(/\s+/g, ' ').trim().length,
  };
  return acc;
}
