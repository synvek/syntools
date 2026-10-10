/**
 * 渲染性能策略的纯函数（无 React / DOM 依赖，便于单测）。
 */

/**
 * 启用大图虚拟化的节点数下限。
 * 实测 150 以内全量渲染更快且无闪烁；超过后仅渲染可视区域收益明显。
 */
export const VIRTUALIZE_THRESHOLD = 150;

/**
 * 视口可容纳的节点数估算系数：1 个节点约占 12000 px²（含间距）。
 * 大屏可同时容纳更多节点，全量渲染反而更快（免去虚拟化的测量开销）；
 * 小屏则更早切到虚拟化。结果夹在 [80, 600] 之间，避免极端分辨率下抖动。
 */
export const VIEWPORT_NODE_AREA = 12_000;

/** 自适应虚拟化阈值：节点数超过「下限」与「视口容量」的较大者才开启 */
export function virtualizeThresholdOf(viewportArea: number): number {
  const capacity = Math.round(viewportArea / VIEWPORT_NODE_AREA);
  return Math.max(VIRTUALIZE_THRESHOLD, Math.min(600, Math.max(80, capacity)));
}
