import Konva from 'konva';
import { toRad } from '../core';
import type {
  Fill,
  GradientFill,
  MediaAsset,
  ShapeElement,
  SlideElement,
  Stroke,
  TableElement,
  TextBody,
} from '../model/types';
import { scaleBodyFonts } from '../model/text';
import { createChartNode } from './chartNode';
import { createFormulaNode, createIconNode } from './shapeNodes';
import { acquireImage } from './imageCache';
import { layoutTextBody } from './textLayout';

/**
 * SlideElement → Konva.Node 工厂与更新器。
 *
 * 约定：每个元素映射为一个 Konva.Group（承载 id / 位置 / 旋转 / 翻转 / 透明度），
 * 组内的子图形由 `konvaChildKind` 区分，diff 同步时只要 kind 不变就只更新属性，
 * 避免每次都重建节点导致的闪烁与 GC 压力。
 */

export interface RenderContext {
  media: Record<string, MediaAsset>;
  onImageReady: () => void;
}

const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';
const DEFAULT_SIZE = 18;

export function fillToColor(fill: Fill | undefined): string | undefined {
  if (!fill) return undefined;
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'gradient') {
    const first = fill.stops[0]?.color;
    return first;
  }
  return undefined;
}

export function fillToAlpha(fill: Fill | undefined): number | undefined {
  if (fill?.type === 'solid') return fill.alpha;
  return undefined;
}

/** 线性渐变 → Konva 起止点（画布坐标，盒子左上角为原点） */
function gradientPoints(
  fill: GradientFill,
  width: number,
  height: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const angle = (((fill.angle ?? 0) % 360) + 360) % 360;
  const rad = toRad(angle);
  const cx = width / 2;
  const cy = height / 2;
  const len = (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) / 2;
  const dx = Math.sin(rad) * len;
  const dy = -Math.cos(rad) * len;
  return { start: { x: cx - dx, y: cy - dy }, end: { x: cx + dx, y: cy + dy } };
}

function applyFill(node: Konva.Shape, fill: Fill | undefined, width: number, height: number): void {
  if (!fill || fill.type === 'none') {
    node.fill(undefined);
    node.strokeScaleEnabled(true);
    return;
  }
  const alpha = fillToAlpha(fill);
  if (alpha !== undefined) node.opacity(alpha);
  if (fill.type === 'solid') {
    node.fill(fill.color);
    return;
  }
  if (fill.type === 'gradient') {
    const points = gradientPoints(fill, width, height);
    node.fillLinearGradientStartPoint(points.start);
    node.fillLinearGradientEndPoint(points.end);
    node.fillLinearGradientColorStops(
      fill.stops.flatMap((stop) => [Math.min(1, Math.max(0, stop.offset)), stop.color]),
    );
  }
}

function applyStroke(node: Konva.Shape, stroke: Stroke | undefined): void {
  if (!stroke) {
    node.stroke(undefined);
    node.strokeWidth(0);
    return;
  }
  node.stroke(stroke.color);
  node.strokeWidth(stroke.width);
  node.dash(stroke.dash ?? []);
}

/** 文本 body → Konva.Group（内部按 run 片段分段，保留混排样式） */
export function createTextNodes(body: TextBody, width: number, height: number): Konva.Group {
  const group = new Konva.Group({ listening: false });

  // normAutofit：超框时先等比缩小字号重新排版（最多迭代 3 次），
  // 这与 PowerPoint「自动调整文字大小」的行为一致；直接压缩 Y 轴会把文字压扁。
  let effective = body;
  let layout = layoutTextBody(effective, { width, height });
  for (let attempt = 0; attempt < 3 && height > 0 && layout.height > height; attempt += 1) {
    const factor = Math.max(0.2, (height / layout.height) * 0.98);
    effective = scaleBodyFonts(effective, factor);
    layout = layoutTextBody(effective, { width, height });
  }
  // 缩到下限仍溢出时退回纵向压缩兜底，至少保证内容都在框内
  if (layout.height > height && height > 0) {
    group.scaleY(height / layout.height);
  }
  for (const line of layout.lines) {
    for (const segment of line.segments) {
      if (!segment.text) continue;
      const style = segment.style ?? {};
      const text = new Konva.Text({
        text: segment.text,
        x: segment.x,
        y: segment.y,
        width: segment.width + 1,
        height: segment.height,
        fontSize: style.size ?? DEFAULT_SIZE,
        fontFamily: style.font || DEFAULT_FONT,
        fontStyle: style.italic ? 'italic' : 'normal',
        fontVariant: style.bold ? 'bold' : 'normal',
        fill: style.color ?? '#000000',
        textDecoration: style.underline ? 'underline' : style.strike ? 'line-through' : '',
        lineHeight: 1,
        verticalAlign: 'middle',
        wrap: 'none',
        listening: false,
        perfectDrawEnabled: false,
      });
      group.add(text);
    }
  }
  return group;
}

function createShapeNode(element: ShapeElement): Konva.Shape {
  const { geom } = element;
  if (geom.kind === 'ellipse') {
    return new Konva.Ellipse({
      x: element.width / 2,
      y: element.height / 2,
      radiusX: element.width / 2,
      radiusY: element.height / 2,
    });
  }
  if (geom.kind === 'star') {
    const points = /\d+$/.exec(geom.prst)?.[0];
    return new Konva.Star({
      x: element.width / 2,
      y: element.height / 2,
      numPoints: Number(points ?? 5),
      innerRadius: (Math.min(element.width, element.height) / 2) * (geom.innerRatio ?? 0.4),
      outerRadius: Math.min(element.width, element.height) / 2,
    });
  }
  if (geom.kind === 'polygon' && geom.points) {
    const flat = geom.points.map((value, index) =>
      index % 2 === 0 ? value * element.width : value * element.height,
    );
    return new Konva.Line({ points: flat, closed: true });
  }
  if (geom.kind === 'path' && geom.path) {
    return new Konva.Path({ data: geom.path });
  }
  return new Konva.Rect({
    width: element.width,
    height: element.height,
    cornerRadius: (geom.radius ?? 0) * Math.min(element.width, element.height),
  });
}

/**
 * 表格渲染。
 *
 * 必须消费 cell.colSpan / rowSpan：早期实现只按行列下标取 colWidths[rowHeights]，
 * 合并单元格会被画成错位/空洞（而导出反而是正确的），导致「看到的和导出的不一致」。
 * 这里用占用矩阵跳过被合并覆盖的格子，并把跨列/跨行的宽高累加起来。
 */
function createTableNode(element: TableElement): Konva.Group {
  const group = new Konva.Group({ listening: true });
  const { rows, colWidths, rowHeights } = element;
  const border = element.borderColor ?? '#BFBFBF';
  const colCount = Math.max(colWidths.length, ...rows.map((row) => row.length), 1);
  const fallbackWidth = element.width / colCount;
  const fallbackHeight = element.height / Math.max(1, rows.length);

  /** 累加前 n 列的宽度（网格列号，而不是数组下标） */
  const widthBefore = (gridCol: number): number => {
    let total = 0;
    for (let c = 0; c < gridCol; c += 1) total += colWidths[c] ?? fallbackWidth;
    return total;
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    // 关键：列位置用「网格列号」推进，而不是数组下标 ——
    // 否则一行里出现 gridSpan 后，后面所有单元格都会左移错位。
    let gridCol = 0;
    let y = 0;
    for (let r = 0; r < rowIndex; r += 1) y += rowHeights[r] ?? fallbackHeight;

    for (let arrayIndex = 0; arrayIndex < rows[rowIndex].length; arrayIndex += 1) {
      const cell = rows[rowIndex][arrayIndex];
      const colSpan = Math.max(1, cell.colSpan ?? 1);
      const rowSpan = Math.max(1, cell.rowSpan ?? 1);
      const x = widthBefore(gridCol);
      let width = 0;
      for (let c = gridCol; c < gridCol + colSpan; c += 1) {
        width += colWidths[c] ?? fallbackWidth;
      }
      let height = 0;
      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        height += rowHeights[r] ?? fallbackHeight;
      }
      // 命中标记用「数组下标」：store 的 patchTableCell / activeCell 都按数组槽位操作
      const colIndex = arrayIndex;
      gridCol += colSpan;

      // 被合并覆盖的格子不绘制（但仍占据网格位置）
      if (cell.covered) continue;

      const isHeader = element.headerRow && rowIndex === 0;
      const isBanded = element.bandRow && rowIndex % 2 === 1;
      const fill = cell.fill ?? (isHeader ? '#E7E6E6' : isBanded ? '#F2F2F2' : '#FFFFFF');
      const rect = new Konva.Rect({
        x,
        y,
        width,
        height,
        fill,
        stroke: border,
        strokeWidth: 1,
        // 单元格可点击：属性面板需要知道当前活动单元格以便编辑文字
        name: 'cell',
        listening: true,
      });
      rect.setAttr('cellRow', rowIndex);
      rect.setAttr('cellCol', colIndex);
      group.add(rect);

      if (cell.text) {
        const pad = 4;
        const text = new Konva.Text({
          x: x + pad,
          y: y + pad,
          width: width - pad * 2,
          height: height - pad * 2,
          text: cell.text,
          fontSize: cell.size ?? 14,
          fontFamily: DEFAULT_FONT,
          // 表头默认加粗（与 PowerPoint 的表头行样式一致）
          fontStyle: cell.bold || isHeader ? 'bold' : 'normal',
          fill: cell.color ?? '#000000',
          align: cell.align ?? 'left',
          verticalAlign: cell.valign ?? 'middle',
          wrap: 'word',
          listening: false,
          perfectDrawEnabled: false,
        });
        group.add(text);
      }
    }
  }
  return group;
}

/** 元素 → Konva.Group（含全部子图形） */
export function createElementNode(element: SlideElement, ctx: RenderContext): Konva.Group {
  const group = new Konva.Group({
    id: element.id,
    name: 'element',
    x: element.x,
    y: element.y,
    // 记录元素盒子尺寸：Transformer 与 transformend 读取 node.width()/height()
    // 计算落点尺寸，未设置时 Group 默认返回 0，会导致旋转后元素尺寸被清零消失。
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    scaleX: element.flipX ? -1 : 1,
    scaleY: element.flipY ? -1 : 1,
    opacity: element.opacity ?? 1,
    listening: true,
    draggable: !element.locked,
    dragDistance: 3,
  });
  group.setAttr('elType', element.type);
  // 锁定标记写在节点上：命中与框选在 pointer.ts 里读它来决定是否跳过
  group.setAttr('elLocked', Boolean(element.locked));

  switch (element.type) {
    case 'text': {
      // 无填充的文本框需要一块透明的命中区域，否则只有文字字形可点（文字又是 listening:false），
      // 整框无法被选中 / 拖拽。透明填充仍会被 Konva 计入命中画布。
      const hit = new Konva.Rect({
        width: element.width,
        height: element.height,
        fill: 'rgba(0,0,0,0)',
        listening: true,
      });
      group.add(hit);
      if (element.fill && element.fill.type !== 'none') {
        const bg = new Konva.Rect({
          width: element.width,
          height: element.height,
          fill: fillToColor(element.fill),
          opacity: fillToAlpha(element.fill) ?? 1,
          cornerRadius: element.cornerRadius ?? 0,
        });
        applyStroke(bg, element.stroke);
        group.add(bg);
      }
      group.add(createTextNodes(element.body, element.width, element.height));
      break;
    }
    case 'shape': {
      const shape = createShapeNode(element);
      applyFill(shape, element.fill, element.width, element.height);
      applyStroke(shape, element.stroke);
      group.add(shape);
      if (element.body) group.add(createTextNodes(element.body, element.width, element.height));
      break;
    }
    case 'image': {
      const asset = ctx.media[element.mediaId];
      const image = asset ? acquireImage(asset, ctx.onImageReady) : undefined;
      const crop = element.crop;
      const node = new Konva.Image({
        width: element.width,
        height: element.height,
        image,
        cornerRadius: element.cornerRadius ?? 0,
        listening: true,
      });
      if (crop && asset) {
        node.crop({
          x: asset.width * crop.left,
          y: asset.height * crop.top,
          width: asset.width * (1 - crop.left - crop.right),
          height: asset.height * (1 - crop.top - crop.bottom),
        });
      }
      node.setAttr('mediaId', element.mediaId);
      applyStroke(node, element.stroke);
      group.add(node);
      break;
    }
    case 'line': {
      const line = new Konva.Line({
        points: element.points,
        stroke: element.stroke?.color ?? '#000000',
        strokeWidth: element.stroke?.width ?? 1,
        dash: element.stroke?.dash ?? [],
        lineCap: 'round',
        hitStrokeWidth: Math.max(8, element.stroke?.width ?? 1),
      });
      group.add(line);
      break;
    }
    case 'table': {
      group.add(createTableNode(element));
      break;
    }
    case 'group': {
      // 子坐标是相对 group 原点的（见 GroupElement 注释），直接挂进已定位的 Group 即可。
      // 子元素关闭命中：MVP 采用 PowerPoint 的「整组选中」语义，避免点到组内单个子元素。
      for (const child of element.children) {
        const node = createElementNode(child, ctx);
        node.listening(false);
        group.add(node);
      }
      // 子元素已不参与命中，靠这块透明矩形保证整组可被点击 / 拖拽 / 框选
      group.add(
        new Konva.Rect({
          width: element.width,
          height: element.height,
          fill: 'rgba(0,0,0,0)',
          listening: true,
        }),
      );
      break;
    }
    case 'chart': {
      // 透明命中区：图表节点 listening:false，整框仍需可选中/可拖拽
      const hit = new Konva.Rect({
        width: element.width,
        height: element.height,
        fill: 'rgba(0,0,0,0)',
        listening: true,
      });
      group.add(hit);
      group.add(createChartNode(element));
      break;
    }
    case 'formula': {
      const hit = new Konva.Rect({
        width: element.width,
        height: element.height,
        fill: 'rgba(0,0,0,0)',
        listening: true,
      });
      group.add(hit);
      group.add(createFormulaNode(element));
      break;
    }
    case 'icon': {
      const hit = new Konva.Rect({
        width: element.width,
        height: element.height,
        fill: 'rgba(0,0,0,0)',
        listening: true,
      });
      group.add(hit);
      group.add(createIconNode(element));
      break;
    }
    case 'placeholder': {
      const rect = new Konva.Rect({
        width: element.width,
        height: element.height,
        fill: '#F1F5F9',
        stroke: '#94A3B8',
        strokeWidth: 1,
        dash: [6, 4],
      });
      group.add(rect);
      const label = new Konva.Text({
        width: element.width,
        height: element.height,
        text: element.label,
        fontSize: 14,
        fontFamily: DEFAULT_FONT,
        fill: '#64748B',
        align: 'center',
        verticalAlign: 'middle',
        wrap: 'word',
        listening: false,
      });
      group.add(label);
      break;
    }
  }
  return group;
}

/** 元素类型是否发生变化（变化时必须重建节点） */
export function sameKind(node: Konva.Node, element: SlideElement): boolean {
  return node.getAttr('elType') === element.type;
}

/** 仅更新几何/视觉属性（元素类型未变时的快路径） */
export function patchElementNode(
  node: Konva.Group,
  element: SlideElement,
  ctx: RenderContext,
): void {
  node.setAttrs({
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    scaleX: element.flipX ? -1 : 1,
    scaleY: element.flipY ? -1 : 1,
    opacity: element.opacity ?? 1,
  });
  if (element.type === 'image') {
    const imageNode = node.findOne('Image') as Konva.Image | undefined;
    const asset = ctx.media[element.mediaId];
    if (imageNode && asset) {
      const image = acquireImage(asset, ctx.onImageReady);
      if (image && imageNode.image() !== image) imageNode.image(image);
      imageNode.width(element.width);
      imageNode.height(element.height);
      // 图片走属性快路径，圆角与裁剪必须在这里同步，否则改了不刷新
      imageNode.cornerRadius(element.cornerRadius ?? 0);
      const crop = element.crop;
      if (crop) {
        imageNode.crop({
          x: asset.width * crop.left,
          y: asset.height * crop.top,
          width: asset.width * (1 - crop.left - crop.right),
          height: asset.height * (1 - crop.top - crop.bottom),
        });
      } else {
        imageNode.crop({ x: 0, y: 0, width: 0, height: 0 });
      }
    }
  } else if (element.type === 'line') {
    const lineNode = node.findOne('Line') as Konva.Line | undefined;
    if (lineNode) {
      lineNode.points(element.points);
      lineNode.stroke(element.stroke?.color ?? '#000000');
      lineNode.strokeWidth(element.stroke?.width ?? 1);
    }
  }
}
