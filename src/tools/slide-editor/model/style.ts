import type { Fill, RunStyle, ShadowStyle, SlideElement, Stroke, TextBody } from './types';

/**
 * 格式刷：把「源元素的视觉样式」抽成快照，再套用到目标元素。
 *
 * 只搬运**样式**，不搬运几何（位置/尺寸/旋转属于版式而非格式），
 * 与 PowerPoint 格式刷的行为一致：形状 ↔ 形状带填充描边，文本 ↔ 文本带字体格式。
 */

export interface StyleSnapshot {
  /** 源元素类型，用于决定目标元素能吃下哪些字段 */
  source: SlideElement['type'];
  fill?: Fill;
  stroke?: Stroke;
  shadow?: ShadowStyle;
  cornerRadius?: number;
  /** 文本格式（来自第一个 run / 第一段） */
  run?: RunStyle;
  paragraph?: Pick<
    TextBody['paragraphs'][number],
    'align' | 'lineSpacing' | 'bullet' | 'numbering'
  >;
  /** 图表视觉开关 */
  chartOptions?: Record<string, unknown>;
  /** 公式/图标的着色 */
  color?: string;
}

/** 取出元素的可复制样式（几何与内容一律不动） */
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
  return snapshot;
}

/** 快照是否为空（没有任何可搬运的样式） */
export function isEmptySnapshot(snapshot: StyleSnapshot): boolean {
  return (
    !snapshot.fill &&
    !snapshot.stroke &&
    !snapshot.shadow &&
    snapshot.cornerRadius === undefined &&
    !snapshot.run &&
    !snapshot.paragraph &&
    !snapshot.chartOptions &&
    !snapshot.color
  );
}

/** 把快照套用到元素，返回**仅含样式字段**的补丁（供 patchElements 使用） */
export function applyStyleSnapshot(
  element: SlideElement,
  snapshot: StyleSnapshot,
): Partial<SlideElement> {
  const patch: Record<string, unknown> = {};

  // 填充/描边：形状与文本框互相可刷；图片只吃描边
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

  // 文本：run 级样式刷到每个 run，段落级刷到每段
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
