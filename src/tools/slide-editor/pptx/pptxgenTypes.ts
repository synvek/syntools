/**
 * Minimal type contract for pptxgenjs.
 *
 * pptxgenjs@3.12's `types/index.d.ts` puts every interface inside a **non-exported**
 * `declare namespace` (`export as namespace` only exposes the default export),
 * so named types such as `TextPropsOptions` / `ShapeProps` can't be imported.
 *
 * Only the fields we actually use are declared here, as a narrow interface that:
 * - keeps type checking under TS strict;
 * - doesn't depend on upstream packaging details — upgrading pptxgenjs only needs the missing fields filled in from compile errors.
 *
 * Units: positions in inches, font size/stroke width/spacing in pt, colors as 6-digit hex without `#`.
 */

export type PptxHexColor = string;
export type PptxHAlign = 'left' | 'center' | 'right' | 'justify';
export type PptxVAlign = 'top' | 'middle' | 'bottom';

export interface PptxFill {
  type?: 'none' | 'solid';
  color?: PptxHexColor;
  /** Opacity percentage 0-100 */
  transparency?: number;
}

export interface PptxLine {
  color?: PptxHexColor;
  width?: number;
  dash?: 'solid' | 'dash' | 'sysDash' | 'lgDash';
  /** v3.3+ arrow heads, matching DrawingML `a:headEnd` / `a:tailEnd` types */
  beginArrowType?: 'none' | 'arrow' | 'diamond' | 'oval' | 'stealth' | 'triangle';
  endArrowType?: 'none' | 'arrow' | 'diamond' | 'oval' | 'stealth' | 'triangle';
}

export interface PptxBorder extends PptxLine {
  type?: 'solid' | 'dash' | 'none';
  pt?: number;
}

export interface PptxShadow {
  type: 'outer' | 'inner';
  color?: PptxHexColor;
  blur?: number;
  offset?: number;
  angle?: number;
  opacity?: number;
}

export interface PptxHyperlink {
  url?: string;
  tooltip?: string;
}

export interface PptxTextOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotate?: number;

  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean | 'sngStrike' | 'dblStrike';
  color?: PptxHexColor;
  fontFace?: string;
  align?: PptxHAlign;
  valign?: PptxVAlign;

  charSpacing?: number;
  superscript?: boolean;
  subscript?: boolean;
  highlight?: PptxHexColor;
  hyperlink?: PptxHyperlink;

  breakLine?: boolean;
  bullet?: boolean | { type?: 'number' | 'bullet'; style?: string; code?: string };
  lineSpacingMultiple?: number;
  indentLevel?: number;
  paraSpaceBefore?: number;
  paraSpaceAfter?: number;

  margin?: number | [number, number, number, number];
  shadow?: PptxShadow;
  wrap?: boolean;
  fit?: 'none' | 'shrink' | 'resize';
  fill?: PptxFill;
  line?: PptxLine;
  isTextBox?: boolean;
}

export interface PptxTextProps {
  text?: string;
  options?: PptxTextOptions;
}

export interface PptxShapeOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  shape?: string;
  fill?: PptxFill;
  line?: PptxLine;
  shadow?: PptxShadow;
  hyperlink?: PptxHyperlink;
  align?: PptxHAlign;
}

export interface PptxImageOptions {
  data?: string;
  path?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
  hyperlink?: PptxHyperlink;
}

/** Cell: pptxgenjs reads colspan / rowspan and styles from `options` */
export interface PptxTableCell {
  text?: string;
  options?: PptxTextOptions & {
    colspan?: number;
    rowspan?: number;
  };
}

export interface PptxTableOptions extends PptxTextOptions {
  colW?: number | number[];
  rowH?: number | number[];
  border?: PptxBorder | [PptxBorder, PptxBorder, PptxBorder, PptxBorder];
  autoPage?: boolean;
}

export interface PptxChartData {
  name?: string;
  labels?: string[] | string[][];
  values?: number[];
}

export interface PptxGridLine {
  style?: 'solid' | 'none' | 'dash';
  color?: PptxHexColor;
}

export interface PptxChartOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  barGrouping?: string;
  chartColors?: PptxHexColor[];
  showLegend?: boolean;
  showValue?: boolean;
  catGridLine?: PptxGridLine;
  valGridLine?: PptxGridLine;
  title?: string;
}

export interface PptxSlide {
  background?: PptxFill;
  addText(text: PptxTextProps[] | string, options?: PptxTextOptions): PptxSlide;
  addShape(shapeName: string, options?: PptxShapeOptions): PptxSlide;
  addImage(options: PptxImageOptions): PptxSlide;
  addTable(rows: PptxTableCell[][], options?: PptxTableOptions): PptxSlide;
  addChart(type: string, data: PptxChartData[], options?: PptxChartOptions): PptxSlide;
  addNotes(notes: string): PptxSlide;
}

export interface PptxBackground {
  color?: PptxHexColor;
  transparency?: number;
}

export interface PptxMasterObject {
  text?: PptxTextProps;
  rect?: PptxShapeOptions;
  line?: PptxShapeOptions;
  image?: PptxImageOptions;
  chart?: PptxChartOptions;
}

export interface PptxPresentation {
  layout: string;
  title?: string;
  defineLayout(layout: { name: string; width: number; height: number }): void;
  defineSlideMaster(props: {
    title: string;
    background?: PptxBackground;
    objects?: PptxMasterObject[];
  }): void;
  addSlide(options?: { masterName?: string }): PptxSlide;
  write(options: { outputType: string; compression?: boolean }): Promise<unknown>;
}
