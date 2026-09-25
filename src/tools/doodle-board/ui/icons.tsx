/** 画板专用图标：全局 Icon 集里缺少的工具形状，集中在此避免污染公共图标集。 */

import type { ReactNode } from 'react';

export type BoardIconName =
  | 'pen'
  | 'marker'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'picker'
  | 'move'
  | 'undo'
  | 'redo'
  | 'fill'
  | 'swap'
  | 'zoomIn'
  | 'zoomOut'
  | 'fit'
  | 'chevronUp'
  | 'chevronDown'
  | 'sliders'
  | 'download'
  | 'trash';

const paths: Record<BoardIconName, ReactNode> = {
  pen: <path d="M17 3.5 20.5 7 11 16.5H7.5V13L17 3.5ZM7.5 16.5 5 21l4.5-2.5" />,
  marker: (
    <>
      <path d="M9 15h11" />
      <path d="M14 4 18 8l-5 5h-4V9l5-5Z" />
    </>
  ),
  eraser: (
    <>
      <path d="M8 20h11" />
      <path d="M15.5 4.5 20 9l-8.5 8.5H7l-2.5-2.5 11-10.5Z" />
    </>
  ),
  line: <path d="M5 19 19 5" />,
  arrow: (
    <>
      <path d="M5 19 19 5" />
      <path d="M12 5h7v7" />
    </>
  ),
  rect: <rect x="4" y="6" width="16" height="12" rx="2" />,
  // 必须是 ellipse：<circle> 忽略 rx/ry，半径取默认值 0 会画不出任何东西
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6.5" />,
  // 五边形：多边形的「多点连线」语义比三角形更直观
  polygon: (
    <path d="M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.23l-3 9.24a2 2 0 0 1-1.9 1.41H7a2 2 0 0 1-1.9-1.41l-3-9.24a2 2 0 0 1 .73-2.23z" />
  ),
  picker: (
    <>
      <path d="M3 21v-3l9-9" />
      <path d="M11.5 7.5 16.5 12.5" />
      <path d="M15 4.5a2.5 2.5 0 0 1 3.5 3.5L15 11.5 12.5 9 15 4.5Z" />
    </>
  ),
  move: <path d="M12 2v20M2 12h20M15 5l-3-3-3 3M15 19l-3 3-3-3M5 9l-3 3 3 3M19 9l3 3-3 3" />,
  swap: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M8 11h6" />
    </>
  ),
  // 适应窗口：四角框
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  // 更多设置：两条轨道 + 滑钮
  sliders: (
    <>
      <path d="M4 8h16M4 16h16" />
      <circle cx="15" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </>
  ),
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14" />,
  trash: <path d="M5 7h14M9 7V4h6v3M8 7v12h8V7M10.5 11v5M13.5 11v5" />,
  text: (
    <>
      <path d="M5 6V4h14v2M12 4v16M9 20h6" />
    </>
  ),
  undo: <path d="M9 7H15a5 5 0 0 1 0 10H8M9 7l3-3M9 7l3 3" />,
  redo: <path d="M15 7H9a5 5 0 0 0 0 10h7M15 7l-3-3M15 7l-3 3" />,
  fill: (
    <>
      <path d="M4 12 12 4l8 8-8 8-8-8Z" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
};

interface BoardIconProps {
  name: BoardIconName;
  className?: string;
}

export function BoardIcon({ name, className = 'h-4 w-4' }: BoardIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
