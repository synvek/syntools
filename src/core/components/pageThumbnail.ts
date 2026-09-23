/**
 * 缩略图几何：把「内容包围盒」等比放进缩略图框，返回平移与缩放。
 * 单独放在 .ts 里（不含组件），便于各工具复用与单测。
 */

export const PAGE_THUMB_SIZE = { width: 168, height: 104 };

export function fitScene(
  bounds: { width: number; height: number },
  box: { width: number; height: number } = PAGE_THUMB_SIZE,
  padding = 8,
): { scale: number; x: number; y: number } {
  const scale = Math.min(
    1,
    Math.max(
      0.01,
      Math.min(
        (box.width - padding * 2) / bounds.width,
        (box.height - padding * 2) / bounds.height,
      ),
    ),
  );
  return {
    scale,
    x: (box.width - bounds.width * scale) / 2,
    y: (box.height - bounds.height * scale) / 2,
  };
}
