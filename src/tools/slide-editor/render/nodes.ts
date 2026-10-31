import Konva from 'konva';
import { toRad } from '../core';
import { resolvePresetGeometry } from '../../../core/drawing/shapeDefs';
import type {
  Fill,
  GlowStyle,
  GradientFill,
  InnerShadowStyle,
  LineElement,
  MediaAsset,
  ShadowStyle,
  SoftEdgeStyle,
  ShapeElement,
  ShapeGeometry,
  SlideElement,
  Stroke,
  TableElement,
  TextBody,
} from '../model/types';
import { scaleBodyFonts } from '../model/text';
import { commandsToSvg, hasCustomGeometry, scaleCommands } from '../../../core/drawing/custGeom';
import { createChartNode } from './chartNode';
import { createFormulaNode, createIconNode } from './shapeNodes';
import { acquireImage } from './imageCache';
import { patternTile } from './patternTile';
import { layoutTextBody } from './textLayout';
import {
  NO_SHADOW_PROPS,
  glowShadowProps,
  innerShadowPaint,
  outerShadowProps,
  softEdgeRadius,
} from './effects';

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
  /**
   * Groups entered for child editing (P1-1.5), top-down. Children of an entered group listen
   * (and the group's transparent hit rect is dropped) so individual children can be clicked,
   * dragged and transformed; otherwise a click selects the group as a whole.
   */
  enteredGroups?: string[];
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
  // Pattern: the plate colour stands in wherever one colour has to represent the fill
  if (fill.type === 'pattern') return fill.bgColor;
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
  // Konva keeps every fill flavour on the node and picks one by priority, so switching away from a
  // pattern has to reset the priority — otherwise the old tile keeps painting over the new colour.
  if (!fill || fill.type === 'none') {
    node.fillPriority('color');
    node.fill(undefined);
    node.strokeScaleEnabled(true);
    return;
  }
  const alpha = fillToAlpha(fill);
  if (alpha !== undefined) node.opacity(alpha);
  if (fill.type === 'solid') {
    node.fillPriority('color');
    node.fill(fill.color);
    return;
  }
  if (fill.type === 'pattern') {
    const tile = patternTile(fill);
    if (!tile) {
      // No DOM (node-side raster): fall back to the pattern's ink so the shape is not invisible
      node.fillPriority('color');
      node.fill(fill.fgColor);
      return;
    }
    node.fillPriority('pattern');
    node.fillPatternImage(tile);
    node.fillPatternRepeat('repeat');
    node.fillPatternScale({ x: 1, y: 1 });
    return;
  }
  node.fillPriority('color');
  const points = gradientPoints(fill, width, height);
  node.fillLinearGradientStartPoint(points.start);
  node.fillLinearGradientEndPoint(points.end);
  node.fillLinearGradientColorStops(
    fill.stops.flatMap((stop) => [Math.min(1, Math.max(0, stop.offset)), stop.color]),
  );
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

/**
 * P2-S3: draw the element's outer shadow on canvas.
 *
 * Until this landed the `shadow` field only existed in the exported pptx and the property panel —
 * the editing canvas, thumbnails and PNG export never painted it, so "what you see" and "what you
 * get" disagreed. Konva needs the props on the painted child shape (a Group has no shadow), hence
 * the per-branch calls below.
 */
function applyShadow(node: Konva.Shape, shadow: ShadowStyle | undefined, fromStroke = false): void {
  const props = outerShadowProps(shadow, { fromStroke });
  node.setAttrs(props ?? NO_SHADOW_PROPS);
}

/**
 * P2-S3.1: glow is drawn as a **duplicate behind** the real shape.
 *
 * Konva has one shadow slot per node, so a glow and an outer shadow cannot live on the same shape.
 * The clone carries the halo (zero-offset shadow) and stays non-listening: it is paint, not a
 * click target, and must not double up hit testing or the transformer.
 */
/**
 * P2-S3.2: soft edge = cache the node and blur it.
 *
 * Konva has nothing like `a:softEdge`, so the silhouette is rasterised (`cache()`) and pushed
 * through the blur filter. Consequences the caller must respect:
 * - the cache is baked at the current size, so any geometry change needs a re-cache → elements with
 *   a soft edge never take the fast property path (`sync.ts`);
 * - caching is expensive, so it only happens when the radius is > 0.
 */
function applySoftEdge(node: Konva.Shape, softEdge: SoftEdgeStyle | undefined): void {
  const radius = softEdgeRadius(softEdge);
  if (radius <= 0) return;
  node.filters([Konva.Filters.Blur]);
  node.blurRadius(radius);
  // Padding covers the blurred tail, otherwise the fade is clipped at the element bounds
  node.cache({ pixelRatio: 1, offset: Math.ceil(radius) });
}

function addGlow(
  group: Konva.Group,
  source: Konva.Shape,
  glow: GlowStyle | undefined,
  fromStroke = false,
): void {
  const props = glowShadowProps(glow, { fromStroke });
  if (!props) return;
  const halo = source.clone({ listening: false }) as Konva.Shape;
  halo.setAttrs(props);
  halo.listening(false);
  group.add(halo);
}

/**
 * P2-S3.3: inner shadow painted as an overlay on top of the silhouette.
 *
 * Konva's shadow slot can only paint outside a shape, so the overlay is assembled from three layers
 * inside a **cached** group (see `innerShadowPaint` for the layer-by-layer reasoning):
 * plate → `destination-in` silhouette → `destination-out` blurred, offset silhouette.
 *
 * The **eroder** carries the blur, not the overlay: blurring the subtraction result loses the whole
 * effect at zero offset (`A − A = ∅`), while PowerPoint paints a soft ring in that case — that is
 * exactly what `A − blur(A)` produces.
 *
 * The cache is not optional: `destination-out` on an uncached node would punch a hole through every
 * element painted underneath it. For the same reason the overlay never takes the fast property path
 * (`sync.ts`), and the group must stay `listening:false` — it is paint, not a hit target.
 */
function addInnerShadow(
  group: Konva.Group,
  silhouette: Konva.Shape,
  inner: InnerShadowStyle | undefined,
  size: { width: number; height: number },
): void {
  const paint = innerShadowPaint(inner);
  if (!paint) return;
  const { width, height } = size;
  if (!(width > 0 && height > 0)) return;

  /** Crisp copy of the silhouette: same geometry, no stroke / shadow / filters / own effects */
  const silhouetteCopy = (extra: Konva.ShapeConfig): Konva.Shape =>
    silhouette.clone({
      listening: false,
      strokeEnabled: false,
      shadowEnabled: false,
      filters: [],
      opacity: 1,
      ...extra,
    }) as Konva.Shape;

  const overlay = new Konva.Group({ name: 'innerShadow', listening: false, width, height });
  overlay.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill: paint.color,
      opacity: paint.opacity,
      listening: false,
    }),
  );
  // Keep only the part of the plate that lies inside the silhouette
  overlay.add(silhouetteCopy({ globalCompositeOperation: 'destination-in' }));
  // Then erase an offset copy: what survives is the band along the edge opposite the offset
  const eroder = silhouetteCopy({
    x: paint.offsetX,
    y: paint.offsetY,
    globalCompositeOperation: 'destination-out',
  });
  if (paint.blur > 0) {
    eroder.filters([Konva.Filters.Blur]);
    eroder.blurRadius(paint.blur);
    // A cached shape clips the blurred tail at its own bounds, so the padding is mandatory here
    eroder.cache({ pixelRatio: 1, offset: paint.cacheOffset });
  }
  overlay.add(eroder);

  // Isolates the composite operations above from everything painted before it on the layer
  overlay.cache({ pixelRatio: 1 });
  group.add(overlay);
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
  // Explicit custom geometry wins over prst: re-deriving it would redraw a hand-drawn path
  // as a rectangle. The commands are normalized, so they are scaled to the element box here.
  if (hasCustomGeometry(element.geom) && element.geom.custGeom) {
    return new Konva.Path({
      data: commandsToSvg(scaleCommands(element.geom.custGeom, element.width, element.height)),
    });
  }
  // `prst` + `adj` is authoritative: the stored points/radius are only a fallback for
  // documents written before adjustment values existed.
  const geom = resolvePresetGeometry(element.geom.prst, element.geom.adj);
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
 * Draw an arrow head/tail for a polyline.
 * `atEnd=false` uses the first segment, `atEnd=true` uses the last one.
 */
function addArrowHead(
  group: Konva.Group,
  kind: LineElement['head'],
  points: number[],
  color: string,
  strokeWidth: number,
  atEnd: boolean,
): void {
  if (!kind || kind === 'none' || points.length < 4) return;
  const count = points.length;
  const tipX = atEnd ? points[count - 2] : points[0];
  const tipY = atEnd ? points[count - 1] : points[1];
  const fromX = atEnd ? points[count - 4] : points[2];
  const fromY = atEnd ? points[count - 3] : points[3];
  const dx = tipX - fromX;
  const dy = tipY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;

  const size = Math.max(7, strokeWidth * 4.5);
  const ux = dx / length;
  const uy = dy / length;
  const backX = tipX - ux * size;
  const backY = tipY - uy * size;
  const half = size * 0.45;
  const leftX = backX - uy * half;
  const leftY = backY + ux * half;
  const rightX = backX + uy * half;
  const rightY = backY - ux * half;

  if (kind === 'oval') {
    group.add(
      new Konva.Circle({
        x: tipX - ux * (size / 2),
        y: tipY - uy * (size / 2),
        radius: size / 2,
        fill: color,
        listening: false,
      }),
    );
    return;
  }

  let arrowPoints: number[];
  if (kind === 'diamond') {
    arrowPoints = [
      tipX,
      tipY,
      backX + uy * half,
      backY - ux * half,
      backX - ux * size * 0.6,
      backY - uy * size * 0.6,
      backX - uy * half,
      backY + ux * half,
    ];
  } else if (kind === 'triangle') {
    arrowPoints = [tipX, tipY, leftX, leftY, rightX, rightY];
  } else {
    // arrow / stealth: concave back notch
    const notch = kind === 'stealth' ? 0.55 : 0.3;
    arrowPoints = [
      tipX,
      tipY,
      leftX,
      leftY,
      backX - ux * size * notch,
      backY - uy * size * notch,
      rightX,
      rightY,
    ];
  }
  group.add(
    new Konva.Line({
      points: arrowPoints,
      closed: true,
      fill: color,
      stroke: color,
      strokeWidth: 0.5,
      listening: false,
    }),
  );
}

/**
 * Live-update a shape node after an adjustment handle drag, without rebuilding the layer.
 * The kind never changes during a handle drag, so mutating the existing node is safe.
 */
export function reshapeShapeNode(
  node: Konva.Shape,
  element: ShapeElement,
  geom: ShapeGeometry,
): void {
  if (geom.kind === 'polygon' && geom.points && node instanceof Konva.Line) {
    node.points(
      geom.points.map((value, index) =>
        index % 2 === 0 ? value * element.width : value * element.height,
      ),
    );
    node.closed(true);
    return;
  }
  if (geom.kind === 'star' && node instanceof Konva.Star) {
    node.innerRadius((Math.min(element.width, element.height) / 2) * (geom.innerRatio ?? 0.4));
    node.outerRadius(Math.min(element.width, element.height) / 2);
    return;
  }
  if (geom.kind === 'rect' && node instanceof Konva.Rect) {
    node.cornerRadius((geom.radius ?? 0) * Math.min(element.width, element.height));
  }
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
          name: 'textBg',
        });
        applyStroke(bg, element.stroke);
        applySoftEdge(bg, element.softEdge);
        addGlow(group, bg, element.glow);
        applyShadow(bg, element.shadow);
        group.add(bg);
        addInnerShadow(group, bg, element.innerShadow, element);
      }
      group.add(createTextNodes(element.body, element.width, element.height));
      break;
    }
    case 'shape': {
      const shape = createShapeNode(element);
      shape.name('shapeBody');
      applyFill(shape, element.fill, element.width, element.height);
      applyStroke(shape, element.stroke);
      applySoftEdge(shape, element.softEdge);
      addGlow(group, shape, element.glow);
      applyShadow(shape, element.shadow);
      group.add(shape);
      // Clipped to the body, so it must sit above the fill but below the shape's own text
      addInnerShadow(group, shape, element.innerShadow, element);
      if (element.body) group.add(createTextNodes(element.body, element.width, element.height));
      break;
    }
    case 'image': {
      const asset = ctx.media[element.mediaId];
      const softEdge = element.softEdge;
      const crop = element.crop;
      // The node is built before the bitmap is requested so the ready-callback can re-cache it: a
      // soft edge caches a raster, and a cache taken before decoding would stay a placeholder.
      const node = new Konva.Image({
        width: element.width,
        height: element.height,
        image: undefined,
        cornerRadius: element.cornerRadius ?? 0,
        listening: true,
      });
      if (asset) {
        node.image(
          acquireImage(asset, () => {
            // Re-cache first, then ask for the redraw — the reverse order waits for the next frame
            if (softEdgeRadius(softEdge) > 0) {
              node.clearCache();
              applySoftEdge(node, softEdge);
            }
            ctx.onImageReady();
          }),
        );
      }
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
      applySoftEdge(node, softEdge);
      addGlow(group, node, element.glow);
      applyShadow(node, element.shadow);
      group.add(node);
      // The bitmap may not be decoded yet, so an inner shadow uses the element box as its silhouette
      // (instead of a clone of the Image node, which would be empty until `onImageReady`)
      addInnerShadow(
        group,
        new Konva.Rect({
          width: element.width,
          height: element.height,
          cornerRadius: element.cornerRadius ?? 0,
          fill: '#000000',
        }),
        element.innerShadow,
        element,
      );
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
      line.name('lineBody');
      applySoftEdge(line, element.softEdge);
      // 线条没有填充：Konva 只从描边取阴影/光晕，必须显式打开 fromStroke
      addGlow(group, line, element.glow, true);
      applyShadow(line, element.shadow, true);
      group.add(line);
      // Keep the binding on the node so pointer.ts can make connectors follow a dragged shape
      // without a store round-trip (the store path would rebuild the node mid-drag).
      group.setAttrs({
        cxnStartId: element.startCxn?.shapeId ?? '',
        cxnEndId: element.endCxn?.shapeId ?? '',
        cxnStartSite: element.startCxn?.site ?? 0,
        cxnEndSite: element.endCxn?.site ?? 0,
        cxnRoute: element.route ?? 'straight',
      });
      const color = element.stroke?.color ?? '#000000';
      const width = element.stroke?.width ?? 1;
      addArrowHead(group, element.head, element.points, color, width, false);
      addArrowHead(group, element.tail, element.points, color, width, true);
      break;
    }
    case 'table': {
      group.add(createTableNode(element));
      break;
    }
    case 'group': {
      // Child coordinates are relative to the group origin (see the GroupElement comment), so they attach
      // directly to the already-positioned Group. Children listen only while the group is entered;
      // otherwise the group is selected as a whole (PowerPoint semantics).
      const entered = ctx.enteredGroups?.includes(element.id) ?? false;
      for (const child of element.children) {
        const node = createElementNode(child, ctx);
        // A nested group stays clickable even when it isn't entered, so double-click can enter it
        node.listening(entered || child.type === 'group');
        group.add(node);
      }
      if (!entered) {
        // Transparent rect keeps the group clickable/draggable/selectable as one object
        group.add(
          new Konva.Rect({
            width: element.width,
            height: element.height,
            fill: 'rgba(0,0,0,0)',
            listening: true,
          }),
        );
      }
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
      applyShadow(imageNode, element.shadow);
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
      applyShadow(lineNode, element.shadow, true);
    }
  }
}
