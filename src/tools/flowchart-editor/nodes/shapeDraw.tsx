import type { ReactElement } from 'react';
import type { ShapeDef } from '../model/shapes';
import { type FlowNodeStyle, SWIMLANE_HEADER_HEIGHT, SWIMLANE_HEADER_WIDTH } from '../model/types';

/** 正 n 边形顶点（默认顶点朝上） */
function regularPolygon(sides: number, w: number, h: number, rotDeg = -90): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 1;
  const ry = h / 2 - 1;
  const rot = (rotDeg * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(2)},${(cy + ry * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** 星形顶点（外/内交替） */
function starPoints(points: number, w: number, h: number, inner = 0.44, rotDeg = -90): string {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 1;
  const ry = h / 2 - 1;
  const rot = (rotDeg * Math.PI) / 180;
  const arr: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? 1 : inner;
    const a = rot + (i * Math.PI) / points;
    arr.push(`${(cx + rx * r * Math.cos(a)).toFixed(2)},${(cy + ry * r * Math.sin(a)).toFixed(2)}`);
  }
  return arr.join(' ');
}

/** 加号/十字形多边形（厚度按尺寸比例） */
function plusPoints(w: number, h: number): string {
  const wx = w * 0.34;
  const hy = h * 0.34;
  return [
    `${wx},0`,
    `${w - wx},0`,
    `${w - wx},${hy}`,
    `${w},${hy}`,
    `${w},${h - hy}`,
    `${w - wx},${h - hy}`,
    `${w - wx},${h}`,
    `${wx},${h}`,
    `${wx},${h - hy}`,
    `0,${h - hy}`,
    `0,${hy}`,
    `${wx},${hy}`,
  ].join(' ');
}

/** 生成形状的基础外形（SVG 子元素），由图形目录的 draw 字段驱动；style 可选，用于圆角/折角 */
export function drawShape(
  def: ShapeDef,
  w: number,
  h: number,
  style?: Partial<FlowNodeStyle>,
): ReactElement {
  switch (def.draw) {
    case 'rect': {
      const r = style?.cornerRadius ?? 4;
      return <rect x={0} y={0} width={w} height={h} rx={r} ry={r} />;
    }
    case 'roundRect': {
      const r = style?.cornerRadius ?? 10;
      return <rect x={0} y={0} width={w} height={h} rx={r} ry={r} />;
    }
    case 'capsule':
      return <rect x={0} y={0} width={w} height={h} rx={h / 2} ry={h / 2} />;
    case 'ellipse':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />;
    case 'circle':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} />;
    case 'diamond':
      return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} />;
    case 'parallelogram':
      return <polygon points={`${h / 4},0 ${w},0 ${w - h / 4},${h} 0,${h}`} />;
    case 'invParallelogram':
      return <polygon points={`0,0 ${w - h / 4},0 ${w},${h} ${h / 4},${h}`} />;
    case 'trapezoid':
      return <polygon points={`${w * 0.16},0 ${w * 0.84},0 ${w},${h} 0,${h}`} />;
    case 'invTrapezoid':
      return <polygon points={`0,0 ${w},0 ${w * 0.84},${h} ${w * 0.16},${h}`} />;
    case 'hexagon':
      return (
        <polygon
          points={`${w * 0.16},0 ${w * 0.84},0 ${w},${h / 2} ${w * 0.84},${h} ${w * 0.16},${h} 0,${h / 2}`}
        />
      );
    case 'cylinder': {
      const ry = Math.min(h * 0.16, w * 0.22);
      return (
        <path
          d={
            `M0,${ry} A${w / 2},${ry} 0 0,1 ${w},${ry} V${h - ry} A${w / 2},${ry} 0 0,1 0,${h - ry} Z ` +
            `M0,${ry} A${w / 2},${ry} 0 0,0 ${w},${ry}`
          }
        />
      );
    }
    case 'document': {
      const wave = Math.min(14, h * 0.2);
      return (
        <path
          d={`M0,0 H${w} V${h - wave} a${w / 4},${wave} 0 0,1 -${w / 2},0 a${w / 4},${wave} 0 0,1 -${w / 2},0 Z`}
        />
      );
    }
    case 'note': {
      const c = Math.max(
        0,
        Math.min(style?.foldSize ?? Math.min(16, w * 0.13), Math.min(w, h) * 0.9),
      );
      if (c < 0.5) return <rect x={0} y={0} width={w} height={h} />;
      return <path d={`M0,0 H${w - c} L${w},${c} V${h} H0 Z M${w - c},0 V${c} H${w}`} />;
    }
    case 'triangle':
      return <polygon points={`${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`} />;
    case 'star':
      return <polygon points={starPoints(5, w, h)} />;
    case 'pentagon':
      return <polygon points={regularPolygon(5, w, h)} />;
    case 'octagon':
      return <polygon points={regularPolygon(8, w, h)} />;
    case 'chevron':
      // 右向雪佛龙箭头
      return (
        <path d={`M0,0 H${w * 0.62} L${w},${h / 2} L${w * 0.62},${h} H0 L${w * 0.38},${h / 2} Z`} />
      );
    case 'card': {
      // 圆角矩形 + 右上折角（名片/卡片）
      const r = Math.min(12, w / 2, h / 2);
      const c = Math.min(22, w * 0.22, h * 0.5);
      return (
        <path
          d={`M${r},0 H${w - c} L${w},${c} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`}
        />
      );
    }
    case 'callout': {
      // 圆角气泡 + 左下尾巴（标注）
      const r = Math.min(12, w / 2, h / 2);
      const bh = h * 0.8;
      return (
        <path
          d={`M${r},0 H${w - r} Q${w},0 ${w},${r} V${bh - r} Q${w},${bh} ${w - r},${bh} H${r} Q0,${bh} 0,${bh - r} V${r} Q0,0 ${r},0 Z M${w * 0.28},${bh} L${w * 0.2},${h} L${w * 0.46},${bh} Z`}
        />
      );
    }
    case 'cloud': {
      // 云朵（贝塞尔近似）
      const cy = h * 0.6;
      return (
        <path
          d={`M${w * 0.28},${cy} C${w * 0.1},${cy} ${w * 0.1},${cy * 0.55} ${w * 0.28},${cy * 0.55} C${w * 0.26},${cy * 0.3} ${w * 0.6},${cy * 0.28} ${w * 0.6},${cy * 0.52} C${w * 0.78},${cy * 0.34} ${w * 0.95},${cy * 0.55} ${w * 0.8},${cy * 0.66} C${w * 0.96},${cy * 0.82} ${w * 0.72},${cy} ${w * 0.52},${cy * 0.92} C${w * 0.36},${cy * 1.04} ${w * 0.16},${cy * 0.92} ${w * 0.28},${cy} Z`}
        />
      );
    }
    case 'plus':
      return <polygon points={plusPoints(w, h)} />;
    case 'cross':
      // 十字旋转 45° 即为 X 形
      return (
        <g transform={`rotate(45 ${w / 2} ${h / 2})`}>
          <polygon points={plusPoints(w, h)} />
        </g>
      );
    case 'flag': {
      // 旗杆 + 三角旗
      const poleX = w * 0.2;
      const poleW = Math.max(3, w * 0.05);
      return (
        <path
          d={`M${poleX - poleW / 2},0 H${poleX + poleW / 2} V${h} H${poleX - poleW / 2} Z M${poleX + poleW / 2},${h * 0.1} H${w * 0.9} L${w * 0.78},${h * 0.32} L${w * 0.9},${h * 0.54} H${poleX + poleW / 2} Z`}
        />
      );
    }
    case 'lightning':
      return (
        <polygon
          points={`${w * 0.55},0 ${w * 0.2},${h * 0.55} ${w * 0.46},${h * 0.55} ${w * 0.34},${h} ${w * 0.84},${h * 0.4} ${w * 0.56},${h * 0.4}`}
        />
      );
    case 'arrow':
      // 右向块状箭头
      return (
        <polygon
          points={`0,${h * 0.35} ${w * 0.62},${h * 0.35} ${w * 0.62},${h * 0.15} ${w},${h / 2} ${w * 0.62},${h * 0.85} ${w * 0.62},${h * 0.65} 0,${h * 0.65}`}
        />
      );
    case 'bracket': {
      // 左方括号 [ 形
      const t = Math.min(w * 0.3, h * 0.28);
      return (
        <polygon
          points={`0,0 ${w},0 ${w},${t} ${t},${t} ${t},${h - t} ${w},${h - t} ${w},${h} 0,${h}`}
        />
      );
    }
    case 'bar':
      return <rect x={0} y={0} width={w} height={h} rx={2} ry={2} />;
    case 'laneH':
      // 横向泳道：外框 + 左侧竖条标题栏
      return (
        <g>
          <rect x={0} y={0} width={w} height={h} rx={10} ry={10} />
          <path
            d={`M10,0 H${SWIMLANE_HEADER_WIDTH} V${h} H10 A10,10 0 0 1 0,${h - 10} V10 A10,10 0 0 1 10,0 Z`}
            className="swimlane-header"
          />
        </g>
      );
    case 'laneV':
      // 纵向泳道：外框 + 顶部横条标题栏
      return (
        <g>
          <rect x={0} y={0} width={w} height={h} rx={10} ry={10} />
          <path
            d={`M0,10 a10,10 0 0 1 10,-10 h${w - 20} a10,10 0 0 1 10,10 v${SWIMLANE_HEADER_HEIGHT - 10} h-${w} z`}
            className="swimlane-header"
          />
        </g>
      );
    case 'group':
      // 编组：虚线框 + 淡背景（fill 由外层 g 继承）
      return <rect x={0} y={0} width={w} height={h} rx={8} ry={8} strokeDasharray="7 5" />;
    case 'path':
    default:
      return <path d={def.path ? def.path(w, h) : `M0,0 H${w} V${h} H0 Z`} />;
  }
}

/** 生成外形内部的装饰符号（网关 X/+、事件内圈、机架线等） */
export function drawDecor(def: ShapeDef, w: number, h: number): ReactElement | null {
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  const common = { fill: 'none' } as const;

  switch (def.decor) {
    case 'x': {
      const d = m * 0.2;
      return (
        <path
          {...common}
          d={`M${cx - d},${cy - d} L${cx + d},${cy + d} M${cx - d},${cy + d} L${cx + d},${cy - d}`}
        />
      );
    }
    case 'plus': {
      const d = m * 0.2;
      return <path {...common} d={`M${cx - d},${cy} H${cx + d} M${cx},${cy - d} V${cy + d}`} />;
    }
    case 'innerCircle':
      return <circle {...common} cx={cx} cy={cy} r={m * 0.18} />;
    case 'doubleCircle':
      return <circle {...common} cx={cx} cy={cy} r={m * 0.3} />;
    case 'thickRing':
      return <circle {...common} cx={cx} cy={cy} r={m * 0.28} strokeWidth={3} />;
    case 'grid':
      return <path {...common} d={`M${w / 3},0 V${h} M${(w * 2) / 3},0 V${h}`} />;
    case 'serverLines':
      return <path {...common} d={`M0,${h * 0.34} H${w} M0,${h * 0.67} H${w}`} />;
    case 'screen':
      return (
        <path
          {...common}
          d={`M${w * 0.12},${h * 0.1} H${w * 0.88} V${h * 0.7} H${w * 0.12} Z M${cx},${h * 0.7} V${h * 0.88}`}
        />
      );
    case 'crossArrows':
      return (
        <path
          {...common}
          d={
            `M${w * 0.14},${h * 0.34} H${w * 0.86} M${w * 0.72},${h * 0.18} L${w * 0.86},${h * 0.34} L${w * 0.72},${h * 0.5} ` +
            `M${w * 0.86},${h * 0.66} H${w * 0.14} M${w * 0.28},${h * 0.5} L${w * 0.14},${h * 0.66} L${w * 0.28},${h * 0.82}`
          }
        />
      );
    case 'brick':
      return (
        <path
          {...common}
          d={`M0,${h * 0.33} H${w} M0,${h * 0.66} H${w} M${w * 0.5},0 V${h * 0.33} M${w * 0.28},${h * 0.33} V${h * 0.66} M${w * 0.72},${h * 0.66} V${h}`}
        />
      );
    case 'split':
      return (
        <path
          {...common}
          d={`M0,${cy} H${w * 0.4} M${w * 0.4},${cy} L${w * 0.78},${h * 0.25} M${w * 0.4},${cy} L${w * 0.78},${cy} M${w * 0.4},${cy} L${w * 0.78},${h * 0.75}`}
        />
      );
    case 'globe':
      return (
        <path
          {...common}
          d={`M${cx},${h * 0.12} V${h * 0.88} M${w * 0.16},${h * 0.32} H${w * 0.84} M${w * 0.16},${h * 0.68} H${w * 0.84}`}
        />
      );
    case 'disk':
      return <path {...common} d={`M0,${h * 0.4} H${w} M0,${h * 0.62} H${w}`} />;
    case 'compartments':
      return <path {...common} d={`M0,${h * 0.34} H${w} M0,${h * 0.67} H${w}`} />;
    case 'plusBox': {
      const d = 9;
      const y = h * 0.82;
      return <path {...common} d={`M${cx - d},${y} H${cx + d} M${cx},${y - d} V${y + d}`} />;
    }
    case 'none':
    default:
      return null;
  }
}
