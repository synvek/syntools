import { createStroke, createTextBody } from './factory';
import { setBodyAlign } from './text';
import type {
  Fill,
  Paragraph,
  RunStyle,
  ShadowStyle,
  SlideElement,
  TextAlign,
  TextBody,
} from './types';

/**
 * Pure logic behind the toolbar's "format" row.
 *
 * Three design rules (all required):
 *
 * 1. **Patches, not new elements**: every `*Patch` returns a patch with *style fields only*, fed straight into
 *    the store's `patchSelectedWith`. With a multi-select each element is computed from its **own
 *    current value**, otherwise changing the font would wipe the text in the other elements.
 * 2. **`null` means "not supported"**: callers disable the button or skip the element, never write bogus fields.
 * 3. **Readers are side-effect free**: `*Of` / `supports*` only read, so the UI can derive current values
 *    and disabled states; only writes add an empty body on demand when a shape has none (typing into a shape).
 */

/** Font size ladder (pt): matches the step of PowerPoint's ribbon "increase/decrease font size" */
export const FONT_SIZE_STEP = 2;
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 200;

/** Restrained defaults used when enabling a shadow (a light drop shadow to the bottom right) */
export const DEFAULT_SHADOW: ShadowStyle = {
  color: '#000000',
  blur: 8,
  offsetX: 2,
  offsetY: 2,
  opacity: 0.35,
};

/** Default font size (kept in sync with `createTextBody`) */
const DEFAULT_FONT_SIZE = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------ Capability checks ------------------------------ */

/** Text-capable: text boxes and shapes (a shape gets a body on demand) */
type TextCapable = Extract<SlideElement, { type: 'text' | 'shape' }>;
type FillCapable = Extract<SlideElement, { type: 'text' | 'shape' }>;
type StrokeCapable = Extract<SlideElement, { type: 'text' | 'shape' | 'image' | 'line' }>;
type CornerCapable = Extract<SlideElement, { type: 'text' | 'image' }>;

/**
 * These checks double as **type guards**: after `if (!supportsX(element)) return null` TypeScript
 * narrows the union to the concrete element, so reading/writing `fill` / `stroke` / `body` needs no casts.
 */
export function supportsText(element: SlideElement): element is TextCapable {
  return element.type === 'text' || element.type === 'shape';
}

/** Fill-capable: text boxes and shapes (images/lines/tables/charts have no fill semantics) */
export function supportsFill(element: SlideElement): element is FillCapable {
  return element.type === 'text' || element.type === 'shape';
}

/** Stroke-capable: text boxes/shapes/images have an outline, a line is the outline itself */
export function supportsStroke(element: SlideElement): element is StrokeCapable {
  return (
    element.type === 'text' ||
    element.type === 'shape' ||
    element.type === 'image' ||
    element.type === 'line'
  );
}

/** Corner radius-capable: only text boxes and images model cornerRadius */
export function supportsCorner(element: SlideElement): element is CornerCapable {
  return element.type === 'text' || element.type === 'image';
}

/** Shadow-capable: meaningless for lines and tables, and placeholder boxes are degraded display */
export function supportsShadow(element: SlideElement): boolean {
  return element.type !== 'line' && element.type !== 'table' && element.type !== 'placeholder';
}

/* ------------------------------ Reading ------------------------------ */

/** Text body (without filling it in) */
export function textBodyOf(element: SlideElement): TextBody | undefined {
  if (element.type === 'text') return element.body;
  if (element.type === 'shape') return element.body;
  return undefined;
}

/** Style of the first run */
export function runStyleOf(element: SlideElement): RunStyle | undefined {
  return textBodyOf(element)?.paragraphs[0]?.runs[0]?.style;
}

/** First paragraph (paragraph-level props: align/line spacing/bullets) */
export function paragraphOf(element: SlideElement): Paragraph | undefined {
  return textBodyOf(element)?.paragraphs[0];
}

export function fontSizeOf(element: SlideElement): number {
  return Math.round(runStyleOf(element)?.size ?? DEFAULT_FONT_SIZE);
}

export function alignOf(element: SlideElement): TextAlign {
  return paragraphOf(element)?.align ?? 'left';
}

export function lineSpacingOf(element: SlideElement): number {
  return Number((paragraphOf(element)?.lineSpacing ?? 1.2).toFixed(2));
}

/** List kind: bullet / numbered / none (mutually exclusive, see the Paragraph comment) */
export function listKindOf(element: SlideElement): 'none' | 'bullet' | 'numbering' {
  const paragraph = paragraphOf(element);
  if (paragraph?.bullet) return 'bullet';
  if (paragraph?.numbering) return 'numbering';
  return 'none';
}

export function fillColorOf(element: SlideElement): string | undefined {
  if (!supportsFill(element)) return undefined;
  return element.fill?.type === 'solid' ? element.fill.color : undefined;
}

/** Whether a non-none fill is explicitly set (drives the "no fill" highlighted state) */
export function hasFillOf(element: SlideElement): boolean {
  if (!supportsFill(element)) return false;
  return Boolean(element.fill && element.fill.type !== 'none');
}

export function strokeColorOf(element: SlideElement): string | undefined {
  if (!supportsStroke(element)) return undefined;
  return element.stroke?.color;
}

export function strokeWidthOf(element: SlideElement): number {
  if (!supportsStroke(element)) return 0;
  return element.stroke?.width ?? 0;
}

export function shadowOf(element: SlideElement): ShadowStyle | undefined {
  if (!supportsShadow(element)) return undefined;
  return element.shadow;
}

export function opacityOf(element: SlideElement): number {
  return element.opacity ?? 1;
}

export function cornerRadiusOf(element: SlideElement): number {
  if (element.type === 'text' || element.type === 'image') return element.cornerRadius ?? 0;
  return 0;
}

/* ------------------------------ Writing ------------------------------ */

/** Text body, created on demand */
function ensureBody(element: SlideElement): TextBody | undefined {
  const body = textBodyOf(element);
  if (body) return body;
  if (element.type === 'shape') return createTextBody('');
  return undefined;
}

/** Rewrite the body paragraph by paragraph */
function bodyPatch(
  element: SlideElement,
  updater: (body: TextBody) => TextBody,
): Partial<SlideElement> | null {
  const body = ensureBody(element);
  if (!body) return null;
  return { body: updater(body) } as Partial<SlideElement>;
}

/** Run-level style: written to every run in the box (matching the property panel, so nothing is half-applied) */
export function runStylePatch(
  element: SlideElement,
  style: Partial<RunStyle>,
): Partial<SlideElement> | null {
  return bodyPatch(element, (body) => ({
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({
      ...paragraph,
      runs:
        paragraph.runs.length > 0
          ? paragraph.runs.map((run) => ({ ...run, style: { ...(run.style ?? {}), ...style } }))
          : [{ text: '', style: { ...style } }],
    })),
  }));
}

/** Font size ladder: step from each element's own size, so a multi-select doesn't flatten different sizes */
export function fontSizeStepPatch(
  element: SlideElement,
  delta: number,
): Partial<SlideElement> | null {
  const current = fontSizeOf(element);
  const next = clamp(Math.round((current + delta) * 10) / 10, FONT_SIZE_MIN, FONT_SIZE_MAX);
  if (next === current) return null;
  return runStylePatch(element, { size: next });
}

export function alignPatch(element: SlideElement, align: TextAlign): Partial<SlideElement> | null {
  return bodyPatch(element, (body) => setBodyAlign(body, align));
}

/** Paragraph-level props (line spacing/indent/space before and after) */
export function paragraphPatch(
  element: SlideElement,
  patch: Partial<Pick<Paragraph, 'lineSpacing' | 'indent' | 'spaceBefore' | 'spaceAfter'>>,
): Partial<SlideElement> | null {
  return bodyPatch(element, (body) => ({
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({ ...paragraph, ...patch })),
  }));
}

/** Bullet / numbered / none: mutually exclusive, only one survives */
export function listPatch(
  element: SlideElement,
  kind: 'none' | 'bullet' | 'numbering',
): Partial<SlideElement> | null {
  return bodyPatch(element, (body) => ({
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({
      ...paragraph,
      bullet: kind === 'bullet',
      numbering: kind === 'numbering',
    })),
  }));
}

/** Fill: solid color or "no fill" */
export function fillPatch(
  element: SlideElement,
  fill: Fill | 'none',
): Partial<SlideElement> | null {
  if (!supportsFill(element)) return null;
  return { fill: fill === 'none' ? { type: 'none' } : fill } as Partial<SlideElement>;
}

/** Stroke color: use a default width when there was no stroke, so a picked color isn't invisible */
export function strokeColorPatch(
  element: SlideElement,
  color: string,
): Partial<SlideElement> | null {
  if (!supportsStroke(element)) return null;
  const current = element.stroke ?? createStroke();
  return { stroke: { ...current, color } } as Partial<SlideElement>;
}

export function strokeWidthPatch(
  element: SlideElement,
  width: number,
): Partial<SlideElement> | null {
  if (!supportsStroke(element)) return null;
  // A zero width is equivalent to removing the stroke; avoid leaving an implicit "0 wide but colored" state
  if (width <= 0) return { stroke: undefined } as Partial<SlideElement>;
  const current = element.stroke ?? createStroke();
  return { stroke: { ...current, width } } as Partial<SlideElement>;
}

export function cornerRadiusPatch(
  element: SlideElement,
  radius: number,
): Partial<SlideElement> | null {
  if (!supportsCorner(element)) return null;
  return { cornerRadius: Math.max(0, Math.round(radius)) } as Partial<SlideElement>;
}

/**
 * Opacity (0~1). Every element supports it, so no element argument is needed —
 * keeping a uniform signature would only introduce an unused parameter.
 */
export function opacityPatch(opacity: number): Partial<SlideElement> {
  return { opacity: clamp(opacity, 0, 1) } as Partial<SlideElement>;
}

/** Shadow toggle: enabling uses the defaults (existing values are kept), disabling removes the field */
export function shadowPatch(element: SlideElement, enabled: boolean): Partial<SlideElement> | null {
  if (!supportsShadow(element)) return null;
  return {
    shadow: enabled ? (element.shadow ?? DEFAULT_SHADOW) : undefined,
  } as Partial<SlideElement>;
}
