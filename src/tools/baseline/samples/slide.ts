import {
  createChartElement,
  createDoc,
  createLineElement,
  createShapeElement,
  createSlide,
  createTableElement,
  createTextElement,
} from '../../slide-editor/model/factory';
import type {
  ChartElement,
  GroupElement,
  ImageElement,
  LineElement,
  ShapeElement,
  SlideDoc,
  TableElement,
  TextElement,
} from '../../slide-editor/model/types';

export interface SlideSample {
  id: string;
  title: string;
  /** Recorded in the report so a reviewer knows the number is expected, not a bug */
  notes?: string;
  doc: () => SlideDoc;
}

/** 1×1 transparent PNG: enough for the media pipeline without shipping a fixture file */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngBytes(): Uint8Array {
  const binary = atob(PNG_1X1);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const text = (doc: SlideDoc, value: string): TextElement =>
  createTextElement(doc, value) as TextElement;

export const slideSamples: SlideSample[] = [
  {
    id: 'slide/text-basic',
    title: '三页纯文本',
    doc: () => {
      const doc = createDoc('text-basic');
      doc.slides[0].elements = [text(doc, 'Baseline title')];
      const second = createSlide(doc.slides[0].layoutId);
      second.elements = [text(doc, 'Second slide')];
      const third = createSlide(doc.slides[0].layoutId);
      third.elements = [text(doc, 'Third slide')];
      doc.slides.push(second, third);
      return doc;
    },
  },
  {
    id: 'slide/text-rich',
    title: '多 run 富文本（粗斜下划删除线/高亮/上下标/链接）',
    doc: () => {
      const doc = createDoc('text-rich');
      const element = text(doc, '');
      element.body = {
        paragraphs: [
          {
            runs: [
              { text: 'Bold ', style: { bold: true, size: 28 } },
              { text: 'Italic ', style: { italic: true, size: 28 } },
              { text: 'Underline ', style: { underline: true, size: 28 } },
              { text: 'Strike ', style: { strike: true, size: 28 } },
              { text: 'Highlight', style: { highlight: '#FFF2CC', size: 28 } },
              { text: ' x', style: { baseline: 30000, size: 28 } },
              { text: 'H2O', style: { baseline: -25000, size: 28 } },
              { text: ' link', style: { hyperlink: 'https://example.com', color: '#0563C1' } },
            ],
            align: 'center',
          },
          { runs: [{ text: 'Bullet item', style: { size: 24 } }], bullet: true },
          { runs: [{ text: 'Numbered item', style: { size: 24 } }], numbering: true },
          { runs: [{ text: 'Indented', style: { size: 24, spacing: 1.5 } }], indent: 24 },
        ],
        anchor: 'middle',
      };
      element.width = 720;
      element.height = 320;
      doc.slides[0].elements = [element];
      return doc;
    },
  },
  {
    id: 'slide/shapes-presets',
    title: '8 个预设形状 + 调整值',
    doc: () => {
      const doc = createDoc('shapes-presets');
      const presets: { prst: string; adj?: Record<string, number> }[] = [
        { prst: 'rect' },
        { prst: 'roundRect', adj: { adj1: 0.25 } },
        { prst: 'ellipse' },
        { prst: 'triangle' },
        { prst: 'diamond' },
        { prst: 'pentagon' },
        { prst: 'rightArrow', adj: { adj1: 0.5, adj2: 0.6 } },
        { prst: 'chevron' },
      ];
      doc.slides[0].elements = presets.map((preset, index) => {
        const shape = createShapeElement(doc, {
          kind: preset.prst === 'ellipse' ? 'ellipse' : 'rect',
          prst: preset.prst,
          adj: preset.adj,
        }) as ShapeElement;
        shape.x = 80 + (index % 4) * 260;
        shape.y = 80 + Math.floor(index / 4) * 240;
        shape.width = 220;
        shape.height = 180;
        return shape;
      });
      return doc;
    },
  },
  {
    id: 'slide/shapes-custgeom',
    title: '自定义几何（贝塞尔 + 二次曲线 + 闭合）',
    doc: () => {
      const doc = createDoc('shapes-custgeom');
      const shape = createShapeElement(doc, {
        kind: 'path',
        prst: 'custom',
        custGeom: [
          { c: 'M', x: 0, y: 0.5 },
          { c: 'C', x1: 0.25, y1: 0, x2: 0.5, y2: 0, x: 0.5, y: 0.25 },
          { c: 'Q', x1: 0.75, y1: 0.25, x: 1, y: 0.5 },
          { c: 'L', x: 0.5, y: 1 },
          { c: 'Z' },
        ],
      }) as ShapeElement;
      shape.width = 360;
      shape.height = 280;
      doc.slides[0].elements = [shape];
      return doc;
    },
  },
  {
    id: 'slide/connectors',
    title: '连接线：自由线 + 绑定连接点 + 双箭头',
    doc: () => {
      const doc = createDoc('connectors');
      const box = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
      box.x = 120;
      box.y = 120;
      box.width = 240;
      box.height = 160;

      const bound = createLineElement(doc) as LineElement;
      bound.points = [0, 0, 240, 120];
      bound.startCxn = { shapeId: box.id, site: 2 };
      bound.endCxn = { shapeId: box.id, site: 4 };
      bound.route = 'elbow';
      bound.head = 'triangle';
      bound.tail = 'arrow';

      const free = createLineElement(doc) as LineElement;
      free.x = 520;
      free.y = 400;
      free.points = [0, 0, 300, 0];
      free.stroke = { color: '#C00000', width: 3, dash: [6, 4] };

      doc.slides[0].elements = [box, bound, free];
      return doc;
    },
  },
  {
    id: 'slide/group',
    title: '组合内嵌套文本/形状/线',
    notes: '默认 pptxgen 通道把组合拍平（无原生分组），导入后 group=0；legacy 通道保留 p:grpSp',
    doc: () => {
      const doc = createDoc('group');
      const innerText = text(doc, 'Grouped text');
      innerText.x = 20;
      innerText.y = 16;
      innerText.width = 260;
      innerText.height = 60;
      const innerShape = createShapeElement(doc, {
        kind: 'ellipse',
        prst: 'ellipse',
      }) as ShapeElement;
      innerShape.x = 20;
      innerShape.y = 90;
      innerShape.width = 140;
      innerShape.height = 90;
      const innerLine = createLineElement(doc) as LineElement;
      innerLine.x = 180;
      innerLine.y = 135;
      innerLine.width = 120;
      innerLine.points = [0, 0, 120, 0];

      const group: GroupElement = {
        id: 'group-1',
        type: 'group',
        x: 160,
        y: 140,
        width: 320,
        height: 200,
        children: [innerText, innerShape, innerLine],
      };
      doc.slides[0].elements = [group];
      return doc;
    },
  },
  {
    id: 'slide/fill-gradient',
    title: '渐变填充 + 渐变背景',
    notes: '默认 pptxgen 通道只支持纯色：导出侧把渐变降级为首色（gradientFills 1→0）',
    doc: () => {
      const doc = createDoc('fill-gradient');
      const shape = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
      shape.fill = {
        type: 'gradient',
        angle: 45,
        stops: [
          { offset: 0, color: '#4472C4' },
          { offset: 1, color: '#ED7D31' },
        ],
      };
      shape.width = 480;
      shape.height = 260;
      doc.slides[0].background = {
        type: 'gradient',
        angle: 90,
        stops: [
          { offset: 0, color: '#FFFFFF' },
          { offset: 1, color: '#DEEAF6' },
        ],
      };
      doc.slides[0].elements = [shape];
      return doc;
    },
  },
  {
    id: 'slide/shadow-transform',
    title: '阴影 + 旋转 + 翻转 + 透明度',
    notes: '导出写入 a:outerShdw，但导入侧不解析外阴影（shadows 1→0）',
    doc: () => {
      const doc = createDoc('shadow-transform');
      const base = createShapeElement(doc, {
        kind: 'rect',
        prst: 'roundRect',
        radius: 0.2,
      }) as ShapeElement;
      base.x = 200;
      base.y = 160;
      base.width = 300;
      base.height = 200;
      base.fill = { type: 'solid', color: '#2E75B6', alpha: 0.75 };
      base.shadow = { color: '#000000', blur: 18, offsetX: 6, offsetY: 8, opacity: 0.4 };
      base.rotation = 12;

      const flipped = createShapeElement(doc, { kind: 'rect', prst: 'triangle' }) as ShapeElement;
      flipped.x = 620;
      flipped.y = 200;
      flipped.width = 220;
      flipped.height = 180;
      flipped.flipX = true;
      flipped.opacity = 0.6;

      doc.slides[0].elements = [base, flipped];
      return doc;
    },
  },
  {
    id: 'slide/table-merge',
    title: '表格：横纵合并 + 表头',
    doc: () => {
      const doc = createDoc('table-merge');
      const table = createTableElement(doc, 4, 4) as TableElement;
      table.rows[0][0] = { ...table.rows[0][0], text: 'Merged 2×1', colSpan: 2, bold: true };
      table.rows[0][1] = { ...table.rows[0][1], text: '', covered: true, coveredBy: 'h' };
      table.rows[1][2] = { ...table.rows[1][2], text: 'Merged 2 rows', rowSpan: 2 };
      table.rows[2][2] = { ...table.rows[2][2], text: '', covered: true, coveredBy: 'v' };
      table.rows[1][0] = { ...table.rows[1][0], text: 'A1' };
      table.rows[1][1] = { ...table.rows[1][1], text: 'B1' };
      table.headerRow = true;
      doc.slides[0].elements = [table];
      return doc;
    },
  },
  {
    id: 'slide/table-style',
    title: '表格：单元格底色/加粗/对齐/斑马纹',
    doc: () => {
      const doc = createDoc('table-style');
      const table = createTableElement(doc, 3, 3) as TableElement;
      table.bandRow = true;
      table.rows = table.rows.map((row, rowIndex) =>
        row.map((cell, columnIndex) => ({
          ...cell,
          text: `R${rowIndex + 1}C${columnIndex + 1}`,
          bold: rowIndex === 0,
          fill: rowIndex === 0 ? '#1F3864' : columnIndex === 1 ? '#FFF2CC' : undefined,
          color: rowIndex === 0 ? '#FFFFFF' : '#404040',
          align: columnIndex === 0 ? 'left' : 'center',
          valign: 'middle',
        })),
      );
      doc.slides[0].elements = [table];
      return doc;
    },
  },
  {
    id: 'slide/chart-bar',
    title: '柱状图（原生图表 part）',
    doc: () => {
      const doc = createDoc('chart-bar');
      const chart = createChartElement(doc, 'bar') as ChartElement;
      chart.title = 'Revenue by quarter';
      doc.slides[0].elements = [chart];
      return doc;
    },
  },
  {
    id: 'slide/chart-pie-line',
    title: '饼图 + 折线图（两页）',
    notes: '饼图/环形图只用第一个系列（画布、导出、导入一致），指标按有效系列统计',
    doc: () => {
      const doc = createDoc('chart-mixed');
      const pie = createChartElement(doc, 'pie') as ChartElement;
      doc.slides[0].elements = [pie];
      const second = createSlide(doc.slides[0].layoutId);
      const line = createChartElement(doc, 'line') as ChartElement;
      line.categories = ['Q1', 'Q2', 'Q3', 'Q4'];
      line.series = [{ name: 'Trend', values: [10, 24, 18, 32] }];
      second.elements = [line];
      doc.slides.push(second);
      return doc;
    },
  },
  {
    id: 'slide/image-1px',
    title: '图片（1×1 PNG，验证媒体链路）',
    notes: 'jsdom 不触发 Image.onload，媒体解码失败 → 导入为占位框；媒体往返需在 e2e/浏览器验证',
    doc: () => {
      const doc = createDoc('image');
      const media = {
        id: 'media-1',
        mime: 'image/png',
        width: 1,
        height: 1,
        bytes: pngBytes(),
      };
      doc.media[media.id] = media;
      const image: ImageElement = {
        id: 'image-1',
        type: 'image',
        x: 240,
        y: 160,
        width: 320,
        height: 240,
        mediaId: media.id,
        crop: { left: 0.1, top: 0.1, right: 0.1, bottom: 0.1 },
        cornerRadius: 12,
      };
      doc.slides[0].elements = [image];
      return doc;
    },
  },
  {
    id: 'slide/master-layout',
    title: '母版/版式继承元素',
    notes: 'pptxgen 把母版对象写进版式：回读后 masterElements 1→0、layoutElements 0→1，属结构位移',
    doc: () => {
      const doc = createDoc('master-layout');
      const logo = createShapeElement(doc, { kind: 'rect', prst: 'rect' }) as ShapeElement;
      logo.x = 40;
      logo.y = 40;
      logo.width = 120;
      logo.height = 40;
      doc.masters[0].elements = [logo];

      const footer = text(doc, 'Company confidential');
      footer.x = 40;
      footer.y = 640;
      footer.width = 400;
      footer.height = 40;
      doc.layouts[0].elements = [footer];

      doc.slides[0].elements = [text(doc, 'Inherits logo + footer')];
      return doc;
    },
  },
  {
    id: 'slide/4x3',
    title: '4:3 页面尺寸下的几何',
    doc: () => {
      const doc = createDoc('4x3', '4:3');
      const shape = createShapeElement(doc, { kind: 'rect', prst: 'hexagon' }) as ShapeElement;
      shape.x = 60;
      shape.y = 60;
      shape.width = 360;
      shape.height = 240;
      const body = text(doc, '4:3 layout');
      body.x = 60;
      body.y = 340;
      body.width = 480;
      body.height = 80;
      doc.slides[0].elements = [shape, body];
      return doc;
    },
  },
];
