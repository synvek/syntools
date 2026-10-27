import Konva from 'konva';
import { selectionContours, transformHandles } from '../core';
import type { SamplePoint } from '../core';
import type { LayerBox, MeshGridState, SnapGuide } from '../core';
import type { PhotoDoc, Rect, Selection } from '../model/types';

/**
 * Overlay drawing: selection (marching ants), crop box (dimmed outside + rule of thirds), transform box.
 * All `listening: false` and purely visual; hit testing happens geometrically in `interaction/pointer.ts`.
 */

export function clearOverlay(layer: Konva.Layer): void {
  layer.destroyChildren();
}

/** 1 / scale: keeps stroke width and dash gaps visually constant at any zoom */
function hairline(scale: number): number {
  return 1 / Math.max(0.05, scale);
}

export function drawSelection(layer: Konva.Layer, selection: Selection, scale: number): void {
  const strokeWidth = hairline(scale);
  const dash = [6 * strokeWidth, 4 * strokeWidth];
  // Hand-drawn: rect / oval / lasso / boolean results all stroke as multiple closed subpaths, since
  // Konva.Line would connect the end of one outline to the start of the next.
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
  // Inverted stroke so the ants stay visible on both dark and light images
  const ghost = shape.clone({ stroke: '#FFFFFF', dash: dash.slice().reverse(), opacity: 0.7 });
  layer.add(ghost);
}

/**
 * Free-transform box: the rotated frame + 8 square scale handles + a rotate handle above the top edge.
 * Stroke width and handle size divide by scale so they stay visually constant at any zoom.
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

/** Gradient drag preview: a dashed line from start to end with a dot at each end */
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

  // Punch out the crop area: destination-out clears the middle, revealing the undimmed image
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

  // Rule-of-thirds guides
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
 * Quick mask: unselected areas are tinted red (the selected area is punched out).
 *
 * Cheap but equivalent: lay down translucent red, then `destination-out` the mask's white (selected) parts.
 * That **reuses the mask canvas itself**, with no same-size temp canvas, so painting stays smooth.
 * Order matters: draw it before the ants, since `destination-out` erases earlier content on the layer.
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
 * Mesh warp overlay: pre-warp outline (thin dashes) + warped grid + control-point squares.
 *
 * Drawing both "original" and "current" positions is deliberate: once warped, the eye can't tell which
 * points moved, so the reference lines are the only visual anchor.
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
        // Connect horizontals row by row, then verticals column by column: grid lines neither close nor join
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
 * Snap guides: thin magenta lines across the canvas (Photoshop's smart-guide color).
 * Only the guides that actually snap are drawn, and they vanish on release — permanent ones would be noise.
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

/** Sample-source marker for stamp / healing (crosshair + small circle) */
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

/** Color sampler point: numbered dot + crosshair (the sampler's visual marker) */
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
