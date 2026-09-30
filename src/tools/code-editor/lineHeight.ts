/**
 * 编辑区行几何：行号 ⇄ 像素位置的换算。
 *
 * 为什么需要它：编辑区与导出卡片的覆盖层（当前行高亮、查找命中、缩进引导线、
 * 折叠范围）都必须与文字行**严格对齐**。CSS 的 `line-height: 1.6`
 * （13px × 1.6 = 20.8px）是非整数，按行累加定位会在长文档里产生亚像素漂移，
 * 因此这里把行高锁定为整数常量，并由 `CodeSurface` 以内联 `--ce-line-h`
 * 注入 DOM，`editor.css` 只用 `var(--ce-line-h, 21px)` 消费 —— 单一来源，避免漂移。
 */

/** 行高（px）：13px 字号 × 1.6 向上取整为整数行盒 */
export const LINE_HEIGHT_PX = 21;
/** 编辑区 / 行号槽 / 导出卡片的上内边距（须与 editor.css 的 padding-top 同步） */
export const EDITOR_PADDING_TOP_PX = 12;
/** 编辑区左侧内边距（缩进引导线 / 括号高亮的横向基准，与 editor.css 的 padding-left 同步） */
export const EDITOR_PADDING_LEFT_PX = 16;
/** `tab-size`：与 editor.css 的 `tab-size` 保持同步，供缩进列数换算 */
export const TAB_SIZE = 2;
/** 行高 CSS 自定义属性名（editor.css 消费） */
export const LINE_HEIGHT_VAR = '--ce-line-h';

/** 行号（1 起始）→ 行盒顶部的相对像素位置 */
export function lineTopPx(line: number, paddingTop: number = EDITOR_PADDING_TOP_PX): number {
  const safe = Number.isFinite(line) ? Math.max(1, Math.trunc(line)) : 1;
  return paddingTop + (safe - 1) * LINE_HEIGHT_PX;
}

/** 相对像素位置 → 行号（1 起始）；总行数已知时钳制到有效范围 */
export function lineAtOffsetY(
  offsetY: number,
  totalLines: number = Number.MAX_SAFE_INTEGER,
  paddingTop: number = EDITOR_PADDING_TOP_PX,
): number {
  const raw = Math.floor((offsetY - paddingTop) / LINE_HEIGHT_PX) + 1;
  if (!Number.isFinite(raw)) return 1;
  const max = Number.isFinite(totalLines)
    ? Math.max(1, Math.trunc(totalLines))
    : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}
