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
 * 工具栏「格式」行的纯逻辑。
 *
 * 设计约定（三条，缺一不可）：
 *
 * 1. **补丁而不是新元素**：每个 `*Patch` 返回*仅含样式字段*的补丁，直接喂给 store 的
 *    `patchSelectedWith`。多选时逐元素按**各自当前值**计算，不会把首个元素的 body
 *    整体覆盖到其它元素上（否则多选改字体就会抹掉别的元素里的文字）。
 * 2. **`null` 表示不具备该能力**：调用方据此禁用按钮或跳过元素，而不是静默写入无效字段。
 * 3. **读取函数无副作用**：`*Of` / `supports*` 只读，供 UI 决定当前值与禁用态；
 *    形状没有文字 body 时，写入路径才按需补一个空 body（等价于竞品里「在形状里直接打字」）。
 */

/** 字号阶梯（pt）：与 PowerPoint 功能区「增大/减小字号」的步进一致 */
export const FONT_SIZE_STEP = 2;
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 200;

/** 开启阴影时使用的克制默认值（右下轻投影） */
export const DEFAULT_SHADOW: ShadowStyle = {
  color: '#000000',
  blur: 8,
  offsetX: 2,
  offsetY: 2,
  opacity: 0.35,
};

/** 默认字号（与 `createTextBody` 保持一致） */
const DEFAULT_FONT_SIZE = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/* ------------------------------ 能力判定 ------------------------------ */

/** 可承载文字：文本框与形状（形状无 body 时按需补） */
type TextCapable = Extract<SlideElement, { type: 'text' | 'shape' }>;
type FillCapable = Extract<SlideElement, { type: 'text' | 'shape' }>;
type StrokeCapable = Extract<SlideElement, { type: 'text' | 'shape' | 'image' | 'line' }>;
type CornerCapable = Extract<SlideElement, { type: 'text' | 'image' }>;

/**
 * 这些判定同时是**类型守卫**：调用处 `if (!supportsX(element)) return null` 之后
 * TypeScript 就能把联合类型收窄到具体元素，读写 `fill` / `stroke` / `body` 才不用反复断言。
 */
export function supportsText(element: SlideElement): element is TextCapable {
  return element.type === 'text' || element.type === 'shape';
}

/** 可设置填充：文本框与形状（图片/线条/表格/图表没有填充语义） */
export function supportsFill(element: SlideElement): element is FillCapable {
  return element.type === 'text' || element.type === 'shape';
}

/** 可设置轮廓：文本框/形状/图片有描边，线条就是描边本身 */
export function supportsStroke(element: SlideElement): element is StrokeCapable {
  return (
    element.type === 'text' ||
    element.type === 'shape' ||
    element.type === 'image' ||
    element.type === 'line'
  );
}

/** 可设置圆角：只有文本框与图片建模了 cornerRadius */
export function supportsCorner(element: SlideElement): element is CornerCapable {
  return element.type === 'text' || element.type === 'image';
}

/** 可设置阴影：线条与表格没有意义，占位框是降级展示也不需要 */
export function supportsShadow(element: SlideElement): boolean {
  return element.type !== 'line' && element.type !== 'table' && element.type !== 'placeholder';
}

/* ------------------------------ 读取 ------------------------------ */

/** 取文字 body（不补全） */
export function textBodyOf(element: SlideElement): TextBody | undefined {
  if (element.type === 'text') return element.body;
  if (element.type === 'shape') return element.body;
  return undefined;
}

/** 首个 run 的样式 */
export function runStyleOf(element: SlideElement): RunStyle | undefined {
  return textBodyOf(element)?.paragraphs[0]?.runs[0]?.style;
}

/** 首段（段落级属性：对齐/行距/项目符号） */
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

/** 列表形态：项目符号 / 编号 / 无（两者互斥，见 Paragraph 注释） */
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

/** 是否显式设置了非 none 的填充（用于「无填充」的高亮态） */
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

/* ------------------------------ 写入 ------------------------------ */

/** 取（必要时补全）文字 body */
function ensureBody(element: SlideElement): TextBody | undefined {
  const body = textBodyOf(element);
  if (body) return body;
  if (element.type === 'shape') return createTextBody('');
  return undefined;
}

/** 逐段改写 body */
function bodyPatch(
  element: SlideElement,
  updater: (body: TextBody) => TextBody,
): Partial<SlideElement> | null {
  const body = ensureBody(element);
  if (!body) return null;
  return { body: updater(body) } as Partial<SlideElement>;
}

/** run 级样式：写到整框的每个 run（与属性面板一致，避免只改第一个 run 造成的半截生效） */
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

/** 字号阶梯：基于各自当前字号增减，多选时不会把不同字号拉平 */
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

/** 段落级属性（行距/缩进/段前后） */
export function paragraphPatch(
  element: SlideElement,
  patch: Partial<Pick<Paragraph, 'lineSpacing' | 'indent' | 'spaceBefore' | 'spaceAfter'>>,
): Partial<SlideElement> | null {
  return bodyPatch(element, (body) => ({
    ...body,
    paragraphs: body.paragraphs.map((paragraph) => ({ ...paragraph, ...patch })),
  }));
}

/** 项目符号 / 编号 / 无：三者互斥，一次只留一个 */
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

/** 填充：纯色或「无填充」 */
export function fillPatch(
  element: SlideElement,
  fill: Fill | 'none',
): Partial<SlideElement> | null {
  if (!supportsFill(element)) return null;
  return { fill: fill === 'none' ? { type: 'none' } : fill } as Partial<SlideElement>;
}

/** 描边颜色：原本没有描边时给一条默认线宽，避免「选了颜色却看不见」 */
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
  // 线宽归零等价于去掉描边，不留下「0 宽但有色」的隐式状态
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
 * 不透明度（0~1）。所有元素都支持，因此不需要元素参数 ——
 * 保留统一签名反而会引入未使用参数。
 */
export function opacityPatch(opacity: number): Partial<SlideElement> {
  return { opacity: clamp(opacity, 0, 1) } as Partial<SlideElement>;
}

/** 阴影开关：开启用默认参数（已有参数则保留），关闭直接移除字段 */
export function shadowPatch(element: SlideElement, enabled: boolean): Partial<SlideElement> | null {
  if (!supportsShadow(element)) return null;
  return {
    shadow: enabled ? (element.shadow ?? DEFAULT_SHADOW) : undefined,
  } as Partial<SlideElement>;
}
