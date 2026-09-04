/** 涂鸦画板辅助：画笔尺寸钳制 */
export function clampBrushSize(n: number, min = 1, max = 32): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}
