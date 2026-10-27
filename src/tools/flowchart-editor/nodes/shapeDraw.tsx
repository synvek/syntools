import type { ReactElement } from 'react';
import { paramGetterFor, type ShapeDef } from '../model/shapes';
import type { FlowNodeStyle } from '../model/types';

/** Regular n-gon vertices (pointing up by default) */
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

/** Star vertices (alternating outer/inner) */
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

/** Plus/cross polygon (thickness proportional to the size, adjustable via the plusArm parameter) */
function plusPoints(w: number, h: number, ratio = 0.34): string {
  const wx = w * ratio;
  const hy = h * ratio;
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

/**
 * Generate a shape's base outline (SVG children), driven by the catalog's draw field.
 * `style` is optional: its `shapeParams` / `cornerRadius` / `foldSize` are resolved through `paramValue`
 * (falling back to the defaults declared in the shape catalog), and the drawing is identical to before the refactor.
 */
export function drawShape(
  def: ShapeDef,
  w: number,
  h: number,
  style?: Partial<FlowNodeStyle>,
): ReactElement {
  const p = paramGetterFor(def, style, w, h);
  switch (def.draw) {
    case 'rect': {
      const r = p('cornerRadius');
      return <rect x={0} y={0} width={w} height={h} rx={r} ry={r} />;
    }
    case 'roundRect': {
      const r = p('cornerRadius');
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
    case 'parallelogram': {
      const s = p('skew');
      return <polygon points={`${s},0 ${w},0 ${w - s},${h} 0,${h}`} />;
    }
    case 'invParallelogram': {
      const s = p('skew');
      return <polygon points={`0,0 ${w - s},0 ${w},${h} ${s},${h}`} />;
    }
    case 'trapezoid': {
      const s = p('inset');
      return <polygon points={`${s},0 ${w - s},0 ${w},${h} 0,${h}`} />;
    }
    case 'invTrapezoid': {
      const s = p('inset');
      return <polygon points={`0,0 ${w},0 ${w - s},${h} ${s},${h}`} />;
    }
    case 'hexagon': {
      const s = p('inset');
      return (
        <polygon points={`${s},0 ${w - s},0 ${w},${h / 2} ${w - s},${h} ${s},${h} 0,${h / 2}`} />
      );
    }
    case 'cylinder': {
      const ry = p('capHeight');
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
      const wave = p('waveHeight');
      return (
        <path
          d={`M0,0 H${w} V${h - wave} a${w / 4},${wave} 0 0,1 -${w / 2},0 a${w / 4},${wave} 0 0,1 -${w / 2},0 Z`}
        />
      );
    }
    case 'note': {
      const c = p('foldSize');
      if (c < 0.5) return <rect x={0} y={0} width={w} height={h} />;
      return <path d={`M0,0 H${w - c} L${w},${c} V${h} H0 Z M${w - c},0 V${c} H${w}`} />;
    }
    case 'triangle':
      return <polygon points={`${w / 2},1 ${w - 1},${h - 1} 1,${h - 1}`} />;
    case 'star':
      return <polygon points={starPoints(5, w, h, p('starInner'))} />;
    case 'pentagon':
      return <polygon points={regularPolygon(5, w, h)} />;
    case 'octagon':
      return <polygon points={regularPolygon(8, w, h)} />;
    case 'chevron': {
      // Right-facing chevron arrow; depth is the point depth (the left notch matches)
      const d2 = p('chevronDepth');
      return <path d={`M0,0 H${w - d2} L${w},${h / 2} L${w - d2},${h} H0 L${d2},${h / 2} Z`} />;
    }
    case 'card': {
      // Rounded rectangle + folded top-right corner (business card / card)
      const r = Math.min(12, w / 2, h / 2);
      const c = p('foldSize');
      return (
        <path
          d={`M${r},0 H${w - c} L${w},${c} V${h - r} Q${w},${h} ${w - r},${h} H${r} Q0,${h} 0,${h - r} V${r} Q0,0 ${r},0 Z`}
        />
      );
    }
    case 'callout': {
      // Rounded bubble + tail at the bottom-left (callout); calloutTail is the tail height
      const r = Math.min(12, w / 2, h / 2);
      const bh = h - p('calloutTail');
      return (
        <path
          d={`M${r},0 H${w - r} Q${w},0 ${w},${r} V${bh - r} Q${w},${bh} ${w - r},${bh} H${r} Q0,${bh} 0,${bh - r} V${r} Q0,0 ${r},0 Z M${w * 0.28},${bh} L${w * 0.2},${h} L${w * 0.46},${bh} Z`}
        />
      );
    }
    case 'cloud': {
      // Cloud (bezier approximation)
      const cy = h * 0.6;
      return (
        <path
          d={`M${w * 0.28},${cy} C${w * 0.1},${cy} ${w * 0.1},${cy * 0.55} ${w * 0.28},${cy * 0.55} C${w * 0.26},${cy * 0.3} ${w * 0.6},${cy * 0.28} ${w * 0.6},${cy * 0.52} C${w * 0.78},${cy * 0.34} ${w * 0.95},${cy * 0.55} ${w * 0.8},${cy * 0.66} C${w * 0.96},${cy * 0.82} ${w * 0.72},${cy} ${w * 0.52},${cy * 0.92} C${w * 0.36},${cy * 1.04} ${w * 0.16},${cy * 0.92} ${w * 0.28},${cy} Z`}
        />
      );
    }
    case 'plus':
      return <polygon points={plusPoints(w, h, p('plusArm'))} />;
    case 'cross':
      // A cross rotated 45° is an X
      return (
        <g transform={`rotate(45 ${w / 2} ${h / 2})`}>
          <polygon points={plusPoints(w, h, p('plusArm'))} />
        </g>
      );
    case 'flag': {
      // Flagpole + triangular flag
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
    case 'arrow': {
      // Right-facing block arrow; arrowHead is the head length
      const hs = w - p('arrowHead');
      return (
        <polygon
          points={`0,${h * 0.35} ${hs},${h * 0.35} ${hs},${h * 0.15} ${w},${h / 2} ${hs},${h * 0.85} ${hs},${h * 0.65} 0,${h * 0.65}`}
        />
      );
    }
    case 'bracket': {
      // Left square bracket [ shape; armThickness is the thickness of the top and bottom arms
      const t = p('bracketArm');
      return (
        <polygon
          points={`0,0 ${w},0 ${w},${t} ${t},${t} ${t},${h - t} ${w},${h - t} ${w},${h} 0,${h}`}
        />
      );
    }
    case 'bar':
      return <rect x={0} y={0} width={w} height={h} rx={2} ry={2} />;
    case 'laneH': {
      // Horizontal swimlane: outer frame + vertical title bar on the left
      const hw = p('laneHeader');
      return (
        <g>
          <rect x={0} y={0} width={w} height={h} rx={10} ry={10} />
          <path
            d={`M10,0 H${hw} V${h} H10 A10,10 0 0 1 0,${h - 10} V10 A10,10 0 0 1 10,0 Z`}
            className="swimlane-header"
          />
        </g>
      );
    }
    case 'laneV': {
      // Vertical swimlane: outer frame + horizontal title bar on top
      const hh = p('laneHeader');
      return (
        <g>
          <rect x={0} y={0} width={w} height={h} rx={10} ry={10} />
          <path
            d={`M0,10 a10,10 0 0 1 10,-10 h${w - 20} a10,10 0 0 1 10,10 v${hh - 10} h-${w} z`}
            className="swimlane-header"
          />
        </g>
      );
    }
    case 'group':
      // Group: dashed frame + faint background (fill inherited from the outer g)
      return <rect x={0} y={0} width={w} height={h} rx={8} ry={8} strokeDasharray="7 5" />;
    case 'path':
    default:
      return <path d={def.path ? def.path(w, h, p) : `M0,0 H${w} V${h} H0 Z`} />;
  }
}

/** Generate the decorative symbols inside the outline (gateway X/+, event inner circles, rack lines, class diagram compartments, etc.) */
export function drawDecor(
  def: ShapeDef,
  w: number,
  h: number,
  style?: Partial<FlowNodeStyle>,
): ReactElement | null {
  const p = paramGetterFor(def, style, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  const common = { fill: 'none' } as const;
  // The H / H* text of the history pseudo-states is drawn as stroked paths, avoiding any dependency on fonts and color inheritance.
  const histE = m * 0.22;
  const histF = m * 0.26;
  const histH =
    `M${cx - histE},${cy - histF} V${cy + histF} ` +
    `M${cx + histE},${cy - histF} V${cy + histF} ` +
    `M${cx - histE},${cy} H${cx + histE}`;

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
    case 'compartments': {
      // Compartment lines: two adjustable heights (dividerTop / dividerBottom), guaranteed not to overlap
      const d1 = p('dividerTop');
      const d2 = Math.max(d1 + 6, p('dividerBottom'));
      return <path {...common} d={`M0,${d1} H${w} M0,${d2} H${w}`} />;
    }
    case 'plusBox': {
      const d = 9;
      const y = h * 0.82;
      return <path {...common} d={`M${cx - d},${y} H${cx + d} M${cx},${y - d} V${y + d}`} />;
    }
    case 'bullseye':
      // Activity final: solid inner circle (the fill comes from the outer g)
      return <circle cx={cx} cy={cy} r={Math.min(w, h) * 0.28} />;
    case 'history':
      return <path {...common} d={histH} />;
    case 'historyDeep': {
      const ax = cx + histE * 1.15;
      const ay = cy - histF * 1.15;
      const ar = histF * 0.42;
      return (
        <path
          {...common}
          d={
            `${histH} ` +
            `M${ax - ar},${ay - ar} L${ax + ar},${ay + ar} ` +
            `M${ax + ar},${ay - ar} L${ax - ar},${ay + ar} ` +
            `M${ax - ar},${ay} H${ax + ar}`
          }
        />
      );
    }
    case 'none':
    default:
      return null;
  }
}
