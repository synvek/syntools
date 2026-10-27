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
 * SlideElement → Konva.Node factory and updater.
 *
 * Convention: each element maps to one Konva.Group (carrying id / position / rotation / flip / opacity);
 * the child shape inside is identified by `konvaChildKind`, so diff sync only updates properties while the kind
 * is unchanged, avoiding the flicker and GC pressure of rebuilding nodes every time.
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

/** Linear gradient → Konva start/end points (canvas coordinates, box top-left as origin) */
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

/** Text body → Konva.Group (split into fragments per run, preserving mixed styles) */
export function createTextNodes(body: TextBody, width: number, height: number): Konva.Group {
  // Named so the whole group can be hidden during inline editing: the text is then rendered exclusively by
  // the DOM textarea, and drawing another copy on the canvas would double it (see startEditing / closeEditor in SlideCanvas).
  const group = new Konva.Group({ name: 'text', listening: false });

  // normAutofit: when it overflows, shrink the font proportionally and re-layout (at most 3 iterations),
  // matching PowerPoint's "shrink text on overflow"; squashing the Y axis would distort the text.
  let effective = body;
  let layout = layoutTextBody(effective, { width, height });
  for (let attempt = 0; attempt < 3 && height > 0 && layout.height > height; attempt += 1) {
    const factor = Math.max(0.2, (height / layout.height) * 0.98);
    effective = scaleBodyFonts(effective, factor);
    layout = layoutTextBody(effective, { width, height });
  }
  // Still overflowing at the lower bound: fall back to vertical compression so content stays inside the box
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
 * Table rendering.
 *
 * cell.colSpan / rowSpan must be honored: the early implementation indexed colWidths[rowHeights] by row/column
 * only, so merged cells were drawn offset or hollow (while export was correct), making the screen and the file disagree.
 * An occupancy matrix skips covered cells and accumulates width/height across colspans and rowspans.
 */
function createTableNode(element: TableElement): Konva.Group {
  const group = new Konva.Group({ listening: true });
  const { rows, colWidths, rowHeights } = element;
  const border = element.borderColor ?? '#BFBFBF';
  const colCount = Math.max(colWidths.length, ...rows.map((row) => row.length), 1);
  const fallbackWidth = element.width / colCount;
  const fallbackHeight = element.height / Math.max(1, rows.length);

  /** Accumulated width of the first n columns (grid column number, not array index) */
  const widthBefore = (gridCol: number): number => {
    let total = 0;
    for (let c = 0; c < gridCol; c += 1) total += colWidths[c] ?? fallbackWidth;
    return total;
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    // Key: advance the column position by "grid column number", not array index —
    // otherwise once a row contains gridSpan, every later cell shifts left.
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
      // The hit marker uses the "array index": the store's patchTableCell / activeCell operate on array slots
      const colIndex = arrayIndex;
      gridCol += colSpan;

      // Covered cells are not drawn (but still occupy grid positions)
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
        // Cells are clickable: the property panel needs the active cell to edit its text
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
          // Header cells are bold by default (matching PowerPoint's header row style)
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

/** Element → Konva.Group (with all child shapes) */
export function createElementNode(element: SlideElement, ctx: RenderContext): Konva.Group {
  const group = new Konva.Group({
    id: element.id,
    name: 'element',
    x: element.x,
    y: element.y,
    // Record the element box size: Transformer and transformend read node.width()/height()
    // to compute the landing size; unset, a Group reports 0 and a rotated element collapses to nothing.
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
  // The lock flag lives on the node: hit testing and rubber-band selection in pointer.ts read it to skip elements
  group.setAttr('elLocked', Boolean(element.locked));

  switch (element.type) {
    case 'text': {
      // A text box with no fill needs a transparent hit area, otherwise only the glyphs are clickable (and text is
      // listening:false), so the whole box can't be selected or dragged. A transparent fill still counts in the hit canvas.
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
      // Child coordinates are relative to the group origin (see the GroupElement comment), so they attach
      // directly to the already-positioned Group. Children don't listen: the MVP uses PowerPoint's "select whole group" semantics.
      for (const child of element.children) {
        const node = createElementNode(child, ctx);
        node.listening(false);
        group.add(node);
      }
      // Children no longer take part in hit testing; this transparent rect keeps the group clickable/draggable/selectable
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
      // Transparent hit area: chart nodes are listening:false but the box must still be selectable/draggable
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

/** Whether the element type changed (a change requires rebuilding the node) */
export function sameKind(node: Konva.Node, element: SlideElement): boolean {
  return node.getAttr('elType') === element.type;
}

/** Update geometry/visual properties only (fast path when the element type is unchanged) */
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
      // Images take the property fast path; corner radius and crop must be synced here or they won't refresh
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
