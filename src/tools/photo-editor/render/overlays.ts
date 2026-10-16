import Konva from 'konva';
import { selectionContours, transformHandles } from '../core';
import type { SamplePoint } from '../core';
import type { LayerBox, MeshGridState, SnapGuide } from '../core';
import type { PhotoDoc, Rect, Selection } from '../model/types';

/**
 * 覆盖层绘制：选区（蚂蚁线）、裁剪框（外部压暗 + 三分构图线）、自由变换框。
 * 全部 `listening: false`，只负责视觉，命中检测在 `interaction/pointer.ts` 里按几何算。
 */

export function clearOverlay(layer: Konva.Layer): void {
  layer.destroyChildren();
}

/** 1 / scale：让线宽与虚线间隔在任意缩放下看起来一致 */
function hairline(scale: number): number {
  return 1 / Math.max(0.05, scale);
}

export function drawSelection(layer: Konva.Layer, selection: Selection, scale: number): void {
  const strokeWidth = hairline(scale);
  const dash = [6 * strokeWidth, 4 * strokeWidth];
  // 自绘：矩形 / 椭圆 / 套索 / 布尔运算结果统一按「多个闭合子路径」描边，
  // 用 Konva.Line 会把各轮廓首尾连成斜线。
  const shape = new Konva.Shape({
    stroke: '#2563EB',
    strokeWidth,
    dash,
    sceneFunc: (ctx: Konva.Context, node: Konva.Shape) => {
      const raw = ctx as unknown as CanvasRenderingContext2D;
      raw.beginPath();
      for (const contour of selectionContours(selection)) {
        const path = contour.path;
        if (path.length < 6) continue;
        raw.moveTo(path[0], path[1]);
        for (let i = 2; i < path.length; i += 2) raw.lineTo(path[i], path[i + 1]);
        raw.closePath();
      }
      ctx.strokeShape(node);
    },
  });
  layer.add(shape);
  // 反色描边：在深色 / 浅色画面上都能看清蚂蚁线
  const ghost = shape.clone({ stroke: '#FFFFFF', dash: dash.slice().reverse(), opacity: 0.7 });
  layer.add(ghost);
}

/**
 * 自由变换框：旋转后的外框 + 8 个方形缩放手柄 + 顶边外侧的旋转柄。
 * 线宽与手柄边长按 1/scale 折算，保证任意缩放下视觉尺寸恒定。
 */
export function drawTransformBox(
  layer: Konva.Layer,
  box: LayerBox,
  scale: number,
  rotateOffset: number,
): void {
  const sw = hairline(scale);
  const size = 9 * sw;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  layer.add(
    new Konva.Rect({
      x: center.x,
      y: center.y,
      width: box.width,
      height: box.height,
      offsetX: box.width / 2,
      offsetY: box.height / 2,
      rotation: box.rotation,
      stroke: '#2563EB',
      strokeWidth: sw,
    }),
  );

  const handles = transformHandles(box, rotateOffset);
  const topCenter = handles.find((item) => item.id === 'n');
  const rotate = handles.find((item) => item.id === 'rotate');

  for (const handle of handles) {
    if (handle.id === 'rotate') continue;
    layer.add(
      new Konva.Rect({
        x: handle.x - size / 2,
        y: handle.y - size / 2,
        width: size,
        height: size,
        fill: '#FFFFFF',
        stroke: '#2563EB',
        strokeWidth: sw,
      }),
    );
  }

  if (rotate) {
    if (topCenter) {
      layer.add(
        new Konva.Line({
          points: [topCenter.x, topCenter.y, rotate.x, rotate.y],
          stroke: '#2563EB',
          strokeWidth: sw,
        }),
      );
    }
    layer.add(
      new Konva.Circle({
        x: rotate.x,
        y: rotate.y,
        radius: 5 * sw,
        fill: '#FFFFFF',
        stroke: '#2563EB',
        strokeWidth: sw,
      }),
    );
  }
}

/** 渐变工具的拖拽示意：起点 → 终点虚线 + 两端圆点 */
export interface GradientGuide {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function drawGradientGuide(layer: Konva.Layer, guide: GradientGuide, scale: number): void {
  const sw = hairline(scale);
  layer.add(
    new Konva.Line({
      points: [guide.from.x, guide.from.y, guide.to.x, guide.to.y],
      stroke: '#2563EB',
      strokeWidth: sw,
      dash: [6 * sw, 4 * sw],
    }),
  );
  for (const point of [guide.from, guide.to]) {
    layer.add(
      new Konva.Circle({
        x: point.x,
        y: point.y,
        radius: 5 * sw,
        fill: '#FFFFFF',
        stroke: '#2563EB',
        strokeWidth: sw,
      }),
    );
  }
}

export function drawCrop(layer: Konva.Layer, rect: Rect, doc: PhotoDoc, scale: number): void {
  const strokeWidth = hairline(scale);
  const mask = new Konva.Rect({
    x: 0,
    y: 0,
    width: doc.width,
    height: doc.height,
    fill: 'rgba(15, 23, 42, 0.55)',
  });
  layer.add(mask);

  // 挖出裁剪区：destination-out 把中间掏空，露出未压暗的画面
  const hole = new Konva.Rect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    fill: '#000000',
    globalCompositeOperation: 'destination-out',
  });
  layer.add(hole);

  const frame = new Konva.Rect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    stroke: '#FFFFFF',
    strokeWidth,
  });
  layer.add(frame);

  // 三分构图参考线
  for (let i = 1; i <= 2; i += 1) {
    layer.add(
      new Konva.Line({
        points: [
          rect.x + (rect.width * i) / 3,
          rect.y,
          rect.x + (rect.width * i) / 3,
          rect.y + rect.height,
        ],
        stroke: 'rgba(255,255,255,0.5)',
        strokeWidth: strokeWidth / 1.5,
        dash: [4 * strokeWidth, 4 * strokeWidth],
      }),
    );
    layer.add(
      new Konva.Line({
        points: [
          rect.x,
          rect.y + (rect.height * i) / 3,
          rect.x + rect.width,
          rect.y + (rect.height * i) / 3,
        ],
        stroke: 'rgba(255,255,255,0.5)',
        strokeWidth: strokeWidth / 1.5,
        dash: [4 * strokeWidth, 4 * strokeWidth],
      }),
    );
  }
}

/**
 * 快速蒙版：未选中区域压红（选中区域被「挖空」）。
 *
 * 实现取巧但等价：先铺一层半透明红，再用蒙版画布以 `destination-out` 把白色（选中）部分擦掉。
 * 好处是**直接复用蒙版画布本身**，不需要为叠加效果再生成一张同尺寸临时画布（涂抹时才不掉帧）。
 * 顺序要求：必须在选区蚂蚁线之前绘制 —— `destination-out` 会擦掉同一图层里先前画的内容。
 */
export function drawQuickMask(
  layer: Konva.Layer,
  canvas: HTMLCanvasElement,
  doc: PhotoDoc,
  scale: number,
): void {
  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      fill: '#EF4444',
      opacity: 0.5,
      listening: false,
    }),
  );
  layer.add(
    new Konva.Image({
      image: canvas,
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      listening: false,
      globalCompositeOperation: 'destination-out',
    }),
  );
  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: doc.width,
      height: doc.height,
      stroke: '#EF4444',
      strokeWidth: hairline(scale) * 2,
      listening: false,
    }),
  );
}

/**
 * 网格变形覆盖层：变形前轮廓（细虚线）+ 变形后网格 + 控制点方块。
 *
 * 同时画「原位置」与「现位置」是刻意的：变形到一个近似网格后，肉眼几乎无法判断哪些点被拖动过，
 * 参照线是唯一的视觉锚点。
 */
export function drawMeshGrid(layer: Konva.Layer, grid: MeshGridState, scale: number): void {
  const strokeWidth = hairline(scale);
  const size = 5 * strokeWidth;
  const pointAt = (points: { x: number; y: number }[], col: number, row: number) =>
    points[row * grid.cols + col] ?? { x: 0, y: 0 };
  const gridShape = (
    points: { x: number; y: number }[],
    stroke: string,
    dash?: number[],
  ): Konva.Shape =>
    new Konva.Shape({
      stroke,
      strokeWidth,
      dash,
      listening: false,
      sceneFunc: (ctx, shape) => {
        const raw = ctx as unknown as CanvasRenderingContext2D;
        raw.beginPath();
        // 先逐行连横线，再逐列连纵线：网格线既不属于闭合轮廓，也不能首尾相连
        for (let row = 0; row < grid.rows; row += 1) {
          for (let col = 0; col < grid.cols; col += 1) {
            const point = pointAt(points, col, row);
            if (col === 0) raw.moveTo(point.x, point.y);
            else raw.lineTo(point.x, point.y);
          }
        }
        for (let col = 0; col < grid.cols; col += 1) {
          for (let row = 0; row < grid.rows; row += 1) {
            const point = pointAt(points, col, row);
            if (row === 0) raw.moveTo(point.x, point.y);
            else raw.lineTo(point.x, point.y);
          }
        }
        ctx.strokeShape(shape);
      },
    });

  layer.add(gridShape(grid.basePoints, '#94A3B8', [4 * strokeWidth, 4 * strokeWidth]));
  layer.add(gridShape(grid.points, '#2563EB'));
  for (const point of grid.points) {
    layer.add(
      new Konva.Rect({
        x: point.x - size,
        y: point.y - size,
        width: size * 2,
        height: size * 2,
        fill: '#FFFFFF',
        stroke: '#2563EB',
        strokeWidth,
        listening: false,
      }),
    );
  }
}

/**
 * 吸附参考线：横贯画布的洋红细线（与 Photoshop 的智能参考线同色）。
 * 只画「真正吸住」的那几条，松手即消失 —— 常驻会变成噪声。
 */
export function drawSnapGuides(
  layer: Konva.Layer,
  guides: SnapGuide[],
  doc: PhotoDoc,
  scale: number,
): void {
  const strokeWidth = hairline(scale);
  for (const guide of guides) {
    const horizontal = guide.axis === 'y';
    layer.add(
      new Konva.Line({
        points: horizontal
          ? [0, guide.position, doc.width, guide.position]
          : [guide.position, 0, guide.position, doc.height],
        stroke: '#EC4899',
        strokeWidth,
        dash: [4 * strokeWidth, 3 * strokeWidth],
        listening: false,
      }),
    );
  }
}

/** 图章 / 修复的取样源标记（十字准星 + 小圆） */
export function drawCloneSource(
  layer: Konva.Layer,
  point: { x: number; y: number },
  scale: number,
): void {
  const strokeWidth = hairline(scale) * 1.5;
  const radius = 8 * hairline(scale);
  layer.add(
    new Konva.Circle({
      x: point.x,
      y: point.y,
      radius,
      stroke: '#0EA5E9',
      strokeWidth,
      listening: false,
    }),
  );
  layer.add(
    new Konva.Shape({
      stroke: '#0EA5E9',
      strokeWidth,
      listening: false,
      sceneFunc: (ctx, shape) => {
        const raw = ctx as unknown as CanvasRenderingContext2D;
        raw.beginPath();
        raw.moveTo(point.x - radius * 1.6, point.y);
        raw.lineTo(point.x + radius * 1.6, point.y);
        raw.moveTo(point.x, point.y - radius * 1.6);
        raw.lineTo(point.x, point.y + radius * 1.6);
        ctx.strokeShape(shape);
      },
    }),
  );
}

/** 颜色取样点：编号圆点 + 十字准星（取样器的可视标记） */
export function drawSamples(layer: Konva.Layer, samples: SamplePoint[], scale: number): void {
  const strokeWidth = hairline(scale);
  const radius = 7 * strokeWidth;
  samples.forEach((sample, index) => {
    layer.add(
      new Konva.Circle({
        x: sample.x,
        y: sample.y,
        radius,
        stroke: '#FFFFFF',
        strokeWidth: strokeWidth * 1.5,
        listening: false,
      }),
    );
    layer.add(
      new Konva.Circle({
        x: sample.x,
        y: sample.y,
        radius,
        stroke: '#111827',
        strokeWidth,
        listening: false,
      }),
    );
    layer.add(
      new Konva.Text({
        x: sample.x + radius + 2 * strokeWidth,
        y: sample.y - radius,
        text: String(index + 1),
        fontSize: 12 * strokeWidth,
        fill: '#111827',
        listening: false,
      }),
    );
  });
}
