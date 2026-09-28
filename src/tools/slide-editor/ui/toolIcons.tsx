import type { ReactNode } from 'react';

/**
 * 幻灯片工具栏专用图标。
 *
 * 工具栏改成「以图标为主、文字走 tooltip」后，层级 / 组合 / 对齐 / 分布 / 翻转
 * 这些操作在共享 Icon 集里没有合适图形（`chevronLeft` 之类会被误读为「上一张」），
 * 因此集中在这里内联定义。画法与内置 Icon 集统一：24 视窗、currentColor 描边。
 */

const svg = (children: ReactNode, extra: { dashed?: boolean } = {}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden="true"
    {...(extra.dashed ? { strokeDasharray: '3 2.5' } : {})}
  >
    {children}
  </svg>
);

/** 撤销 / 重做：标准弯箭头造型（与文字处理器工具栏一致） */
export function UndoIcon() {
  return svg(
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
    </>,
  );
}

export function RedoIcon() {
  return svg(
    <>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
    </>,
  );
}

/** 对齐：外框 + 全部靠左的线 */
export function AlignIcon() {
  return svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M6.5 8h8M6.5 12h11M6.5 16h6" />
    </>,
  );
}

/** 分布：外框 + 三根等距竖条 */
export function DistributeIcon() {
  return svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8v8M12 8v8M17 8v8" />
    </>,
  );
}

/** 翻转：中轴 + 左右两个互为镜像的三角 */
export function FlipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M12 2v20" stroke="currentColor" strokeWidth={1.7} strokeDasharray="3 2.5" />
      <path d="M9.5 7 3.5 12l6 5z" fill="currentColor" fillOpacity={0.9} />
      <path d="M14.5 7l6 5-6 5z" fill="currentColor" fillOpacity={0.3} />
    </svg>
  );
}

/** 层级：front=置顶、back=置底、forward=上移一层、backward=下移一层 */
export function LayerIcon({ variant }: { variant: 'front' | 'back' | 'forward' | 'backward' }) {
  if (variant === 'front') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect
          x="8"
          y="8"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        />
        <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" fillOpacity={0.85} />
      </svg>
    );
  }
  if (variant === 'back') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" fillOpacity={0.35} />
        <rect
          x="4"
          y="4"
          width="12"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
        />
      </svg>
    );
  }
  if (variant === 'forward') {
    return svg(
      <>
        <rect x="4" y="10" width="11" height="11" rx="2" />
        <path d="M14 3v8M11 8.5 14 5.5l3 3" />
      </>,
    );
  }
  return svg(
    <>
      <rect x="4" y="3" width="11" height="11" rx="2" />
      <path d="M14 13v8M11 15.5l3 3 3-3" />
    </>,
  );
}

/** 组合：两个方块 + 虚线外框 */
export function GroupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1.5" fill="currentColor" fillOpacity={0.8} />
      <rect
        x="12.5"
        y="12.5"
        width="8.5"
        height="8.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity={0.8}
      />
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeDasharray="3 2.5"
      />
    </svg>
  );
}

/** 取消组合：两个方块 + 一道斜线 */
export function UngroupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1.5" fill="currentColor" fillOpacity={0.8} />
      <rect
        x="12.5"
        y="12.5"
        width="8.5"
        height="8.5"
        rx="1.5"
        fill="currentColor"
        fillOpacity={0.8}
      />
      <path d="M4.5 19.5 19.5 4.5" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </svg>
  );
}
