import type {
  Fill,
  GlowStyle,
  RunStyle,
  ShadowStyle,
  SoftEdgeStyle,
  SlideElement,
  Stroke,
  TextBody,
} from './types';

/**
 * Format painter: captures the visual style of a source element as a snapshot and applies it to targets.
 *
 * Only **styles** travel, never geometry (position/size/rotation is layout, not formatting), matching
 * PowerPoint's format painter: shape ↔ shape carries fill and outline, text ↔ text carries font formatting.
 */

export interface StyleSnapshot {
  /** Source element type, deciding which fields a target can accept */
  source: SlideElement['type'];
  fill?: Fill;
  stroke?: Stroke;
  shadow?: ShadowStyle;
  /** Outer glow (P2-S3), carried by the same rules as the shadow */
  glow?: GlowStyle;
  /** Soft edge (P2-S3.2), carried by the same rules as the shadow */
  softEdge?: SoftEdgeStyle;
  cornerRadius?: number;
  /** Text formatting (from the first run / first paragraph) */
  run?: RunStyle;
  paragraph?: Pick<
    TextBody['paragraphs'][number],
    'align' | 'lineSpacing' | 'bullet' | 'numbering'
  >;
  /** Chart visual toggles */
  chartOptions?: Record<string, unknown>;
  /** Tint for formulas/icons */
  color?: string;
}

/** Extract the copyable style of an element (geometry and content stay untouched) */
export function extractStyleSnapshot(element: SlideElement): StyleSnapshot {
  const snapshot: StyleSnapshot = { source: element.type };
  if (element.type === 'shape' || element.type === 'text') {
    snapshot.fill = element.fill;
    snapshot.stroke = element.stroke;
  }
  if (element.type === 'image' || element.type === 'line') snapshot.stroke = element.stroke;
  if (element.type === 'text' || element.type === 'image') {
    snapshot.cornerRadius = element.cornerRadius;
  }
  if (element.type === 'formula' || element.type === 'icon') snapshot.color = element.color;

  const body =
    element.type === 'text' ? element.body : element.type === 'shape' ? element.body : undefined;
  if (body) {
    const paragraph = body.paragraphs[0];
    const run = paragraph?.runs[0];
    if (run?.style) snapshot.run = run.style;
    if (paragraph) {
      snapshot.paragraph = {
        align: paragraph.align,
        lineSpacing: paragraph.lineSpacing,
        bullet: paragraph.bullet,
        numbering: paragraph.numbering,
      };
    }
  }
  if (element.type === 'chart') {
    snapshot.chartOptions = { ...element.options };
  }
  // Effects are element-level, so every type can carry them (before P2-S3 the painter dropped the shadow)
  if (element.shadow) snapshot.shadow = element.shadow;
  if (element.glow) snapshot.glow = element.glow;
  if (element.softEdge) snapshot.softEdge = element.softEdge;
  return snapshot;
}

/** Whether the snapshot is empty (no style to carry) */
export function isEmptySnapshot(snapshot: StyleSnapshot): boolean {
  return (
    !snapshot.fill &&
    !snapshot.stroke &&
    !snapshot.shadow &&
    !snapshot.glow &&
    !snapshot.softEdge &&
    snapshot.cornerRadius === undefined &&
    !snapshot.run &&
    !snapshot.paragraph &&
    !snapshot.chartOptions &&
    !snapshot.color
  );
}

/** Apply a snapshot to an element, returning a **style-only** patch (for patchElements) */
export function applyStyleSnapshot(
  element: SlideElement,
  snapshot: StyleSnapshot,
): Partial<SlideElement> {
  const patch: Record<string, unknown> = {};

  // Fill/outline: shapes and text boxes paint each other; images only take an outline
  if (element.type === 'shape' || element.type === 'text') {
    if (snapshot.fill !== undefined) patch.fill = snapshot.fill;
    if (snapshot.stroke !== undefined) patch.stroke = snapshot.stroke;
  } else if (element.type === 'image' || element.type === 'line') {
    if (snapshot.stroke !== undefined) patch.stroke = snapshot.stroke;
  }
  if (
    snapshot.cornerRadius !== undefined &&
    (element.type === 'text' || element.type === 'image')
  ) {
    patch.cornerRadius = snapshot.cornerRadius;
  }
  if (snapshot.color !== undefined && (element.type === 'formula' || element.type === 'icon')) {
    patch.color = snapshot.color;
  }
  if (
    snapshot.chartOptions !== undefined &&
    element.type === 'chart' &&
    !Array.isArray(snapshot.chartOptions)
  ) {
    patch.options = { ...element.options, ...snapshot.chartOptions };
  }
  if (snapshot.shadow !== undefined) patch.shadow = snapshot.shadow;
  if (snapshot.glow !== undefined) patch.glow = snapshot.glow;
  if (snapshot.softEdge !== undefined) patch.softEdge = snapshot.softEdge;

  // Text: run-level styles go to every run, paragraph-level to every paragraph
  const body =
    element.type === 'text' ? element.body : element.type === 'shape' ? element.body : undefined;
  if (body && (snapshot.run || snapshot.paragraph)) {
    patch.body = {
      ...body,
      paragraphs: body.paragraphs.map((paragraph) => ({
        ...paragraph,
        ...(snapshot.paragraph ?? {}),
        runs: snapshot.run
          ? paragraph.runs.map((run) => ({
              ...run,
              style: { ...(run.style ?? {}), ...snapshot.run },
            }))
          : paragraph.runs,
      })),
    } satisfies TextBody;
  }

  return patch as Partial<SlideElement>;
}
