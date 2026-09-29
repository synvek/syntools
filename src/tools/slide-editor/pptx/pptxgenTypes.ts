/**
 * pptxgenjs 的最小类型契约。
 *
 * pptxgenjs@3.12 的 `types/index.d.ts` 把所有接口放在一个**未导出**的
 * `declare namespace` 里（`export as namespace` 只暴露了 default），
 * 因此外部拿不到 `TextPropsOptions` / `ShapeProps` 等具名类型。
 *
 * 这里只声明我们真正用到的字段，作为一层窄接口：
 * - 保持 TS strict 下的类型检查；
 * - 不依赖上游打包细节，升级 pptxgenjs 时只需按编译错误补齐字段。
 *
 * 单位约定：位置用 inch，字号/线宽/间距用 pt，颜色是不带 `#` 的 6 位十六进制。
 */

export type PptxHexColor = string;
export type PptxHAlign = 'left' | 'center' | 'right' | 'justify';
export type PptxVAlign = 'top' | 'middle' | 'bottom';

export interface PptxFill {
  type?: 'none' | 'solid';
  color?: PptxHexColor;
  /** 透明度百分比 0-100 */
  transparency?: number;
}

export interface PptxLine {
  color?: PptxHexColor;
  width?: number;
  dash?: 'solid' | 'dash' | 'sysDash' | 'lgDash';
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
  wrap?: boolean;
  fit?: 'none' | 'shrink' | 'resize';
  fill?: PptxFill;
  line?: PptxLine;
  shadow?: PptxShadow;
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

/** 单元格：pptxgenjs 从 `options` 上读取 colspan / rowspan 与样式 */
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
