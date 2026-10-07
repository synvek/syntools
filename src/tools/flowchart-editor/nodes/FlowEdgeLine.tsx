import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
import { edgeStyleOf, polylineMidpoint, polylinePath, type Point } from '../ops';
import { useFlowStore } from '../store';
import {
  DEFAULT_EDGE_STYLE,
  EDGE_LABEL_POSITION_RATIO,
  type EdgeArrow,
  type FlowEdgeData,
  type EdgeLabelPosition,
  type FlowEdgeStyle,
} from '../model/types';

const BOX = 10;

/** 连线标签槽位：主标签 + 起点 / 终点标签 */
type LabelSlot = 'main' | 'source' | 'target';

/** 路径取点缓存（键为 path 字符串）：避免同一路径反复建 DOM 测量 */
const pathPointCache = new Map<string, { el: SVGPathElement; length: number }>();

/**
 * 取路径上指定比例处的点（0=起点，1=终点）。
 *
 * 用离屏 `<path>` 的 `getPointAtLength` 求解，因此对直线 / 折线 / 折点正交路由 / 贝塞尔
 * 都成立，不需要为每种线型分别推导参数方程。路径字符串作为缓存键，
 * 结果在连续缩放/平移（path 不变）时直接复用；缓存过大时整体清空，避免无界增长。
 */
function pointOnPath(d: string, fraction: number): { x: number; y: number } | null {
  if (!d || typeof document === 'undefined') return null;
  let entry = pathPointCache.get(d);
  if (!entry) {
    try {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d);
      const length = el.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return null;
      if (pathPointCache.size > 400) pathPointCache.clear();
      entry = { el, length };
      pathPointCache.set(d, entry);
    } catch {
      return null;
    }
  }
  try {
    const t = Math.min(1, Math.max(0, fraction));
    const p = entry.el.getPointAtLength(entry.length * t);
    return { x: p.x, y: p.y };
  } catch {
    return null;
  }
}

/** 折线拐角倒角半径（仅 smoothstep 使用；step 保持直角） */
const POLYLINE_RADIUS = 10;

/** 箭头形状（在 0..10 的 viewBox 内绘制，颜色取连线描边色） */
function arrowShape(kind: EdgeArrow, color: string): ReactElement | null {
  switch (kind) {
    case 'arrowclosed':
      return <path d="M0,0 L10,5 L0,10 Z" fill={color} />;
    case 'arrow':
      return (
        <path
          d="M0,0 L10,5 L0,10"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case 'circle':
      return <circle cx={5} cy={5} r={4.2} fill={color} />;
    case 'diamond':
      return <path d="M0,5 L5,0 L10,5 L5,10 Z" fill={color} />;
    case 'diamondHollow':
      // 聚合：空心菱形（UML 聚合关系）
      return (
        <path
          d="M0,5 L5,0 L10,5 L5,10 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      );
    case 'triangle':
      // 泛化 / 实现：空心三角（尖端朝外）
      return (
        <path
          d="M9.4,5 L0.6,0.6 L0.6,9.4 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      );
    case 'square':
      return <rect x={0.6} y={0.6} width={8.8} height={8.8} rx={1.2} fill={color} />;
    case 'bar':
      return <path d="M5,0 L5,10" stroke={color} strokeWidth={2.4} strokeLinecap="round" />;
    default:
      return null;
  }
}

/** 箭头尖端对齐路径端点：三角类对齐尖端，其它几何形居中对齐 */
function refXOf(kind: EdgeArrow): number {
  return kind === 'arrowclosed' || kind === 'arrow' || kind === 'triangle' ? BOX : BOX / 2;
}

function EdgeMarker({ id, kind, color }: { id: string; kind: EdgeArrow; color: string }) {
  return (
    <marker
      id={id}
      viewBox={`0 0 ${BOX} ${BOX}`}
      markerWidth={16}
      markerHeight={16}
      refX={refXOf(kind)}
      refY={BOX / 2}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      {arrowShape(kind, color)}
    </marker>
  );
}

/**
 * 自定义连线：按 style.type 生成路径，并按 startArrow / endArrow 自绘箭头，
 * 因此箭头风格不受 React Flow 内置 marker 限制（实心/空心/圆点/菱形/方块/竖线）。
 *
 * 存在 `data.waypoints` 时改为折线路径（正交路由结果），标签也改为
 * 可双击就地编辑的 HTML 元素（通过 EdgeLabelRenderer 渲染）。
 */
export function FlowEdgeLine(props: EdgeProps) {
  const { t } = useTranslation();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label } = props;
  const data = props.data as FlowEdgeData | undefined;
  const style: FlowEdgeStyle = { ...DEFAULT_EDGE_STYLE, ...data?.style };
  // 选中态：加粗并高亮描边（自定义边用内联样式，故在此显式处理选中反馈）
  const selected = props.selected === true;
  const strokeColor = selected ? '#2563EB' : style.stroke;
  const strokeWidth = selected ? style.strokeWidth + 1.5 : style.strokeWidth;
  /** 正在就地编辑的标签槽位（null 表示无） */
  const [editingSlot, setEditingSlot] = useState<LabelSlot | null>(null);
  const [draft, setDraft] = useState('');

  const waypoints = data?.waypoints ?? [];
  let path: string;
  let labelX: number;
  let labelY: number;

  if (waypoints.length > 0) {
    const points: Point[] = [
      { x: sourceX, y: sourceY },
      ...waypoints.map((p) => ({ x: p.x, y: p.y })),
      { x: targetX, y: targetY },
    ];
    path = polylinePath(points, style.type === 'smoothstep' ? POLYLINE_RADIUS : 0);
    const mid = polylineMidpoint(points);
    labelX = mid.x;
    labelY = mid.y;
  } else {
    const params = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
    if (style.type === 'straight') {
      [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    } else if (style.type === 'step') {
      // 直角折线 = 圆角折线（圆角半径 0）
      [path, labelX, labelY] = getSmoothStepPath({ ...params, borderRadius: 0 });
    } else if (style.type === 'smoothstep') {
      [path, labelX, labelY] = getSmoothStepPath(params);
    } else {
      [path, labelX, labelY] = getBezierPath(params);
    }
  }

  const startId = `${id}__start`;
  const endId = `${id}__end`;
  const text = typeof label === 'string' ? label : '';
  const sourceText = data?.sourceLabel ?? '';
  const targetText = data?.targetLabel ?? '';
  const labelPosition: EdgeLabelPosition = data?.labelPosition ?? 'center';

  /** 三处标签的文本与落点：无文本的槽位不计算路径取点（零开销） */
  const slots: Array<{
    slot: LabelSlot;
    text: string;
    x: number;
    y: number;
    testId: string;
  }> = [
    {
      slot: 'main',
      text,
      ...(labelPosition === 'center'
        ? { x: labelX, y: labelY }
        : (pointOnPath(path, EDGE_LABEL_POSITION_RATIO[labelPosition]) ?? {
            x: labelX,
            y: labelY,
          })),
      testId: 'edge-label',
    },
  ];
  if (sourceText) {
    const p = pointOnPath(path, EDGE_LABEL_POSITION_RATIO.nearSource) ?? {
      x: sourceX,
      y: sourceY,
    };
    slots.push({ slot: 'source', text: sourceText, x: p.x, y: p.y, testId: 'edge-label-source' });
  }
  if (targetText) {
    const p = pointOnPath(path, EDGE_LABEL_POSITION_RATIO.nearTarget) ?? {
      x: targetX,
      y: targetY,
    };
    slots.push({ slot: 'target', text: targetText, x: p.x, y: p.y, testId: 'edge-label-target' });
  }

  const commitLabel = (slot: LabelSlot) => {
    setEditingSlot(null);
    if (slot === 'main') {
      if (draft !== text) useFlowStore.getState().patchEdgeLabel(id, draft);
      return;
    }
    const prev = slot === 'source' ? sourceText : targetText;
    if (draft !== prev)
      useFlowStore
        .getState()
        .setEdgeLabelField(id, `${slot}Label` as 'sourceLabel' | 'targetLabel', draft);
  };

  return (
    <>
      <defs>
        {style.startArrow !== 'none' ? (
          <EdgeMarker id={startId} kind={style.startArrow} color={strokeColor} />
        ) : null}
        {style.endArrow !== 'none' ? (
          <EdgeMarker id={endId} kind={style.endArrow} color={strokeColor} />
        ) : null}
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerStart={style.startArrow !== 'none' ? `url(#${startId})` : undefined}
        markerEnd={style.endArrow !== 'none' ? `url(#${endId})` : undefined}
        style={edgeStyleOf({ ...style, stroke: strokeColor, strokeWidth })}
        interactionWidth={20}
      />

      {/* 连线标签：主标签 + 起点 / 终点标签，双击就地编辑（不走 BaseEdge 的 SVG 文本，便于富交互） */}
      <EdgeLabelRenderer>
        {slots.map((s) => (
          <div
            key={s.slot}
            className="nodrag nopan absolute"
            style={{ transform: `translate(-50%, -50%) translate(${s.x}px, ${s.y}px)` }}
          >
            {editingSlot === s.slot ? (
              <input
                autoFocus
                value={draft}
                placeholder={t('tools.flowchart.edgeLabel')}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitLabel(s.slot)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitLabel(s.slot);
                  if (e.key === 'Escape') setEditingSlot(null);
                }}
                className="pointer-events-auto w-24 rounded border border-blue-400 bg-white px-1 py-0.5 text-center text-[11px] outline-none dark:bg-gray-900 dark:text-gray-100"
              />
            ) : s.text || (s.slot === 'main' && selected) ? (
              <button
                type="button"
                data-testid={s.testId}
                title={t('tools.flowchart.edgeLabel')}
                onDoubleClick={() => {
                  setDraft(s.text);
                  setEditingSlot(s.slot);
                }}
                className={`pointer-events-auto rounded border px-1 py-0.5 text-[11px] leading-tight shadow-sm transition-colors ${
                  s.text
                    ? 'border-gray-200 bg-white/95 text-gray-700 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-200'
                    : 'border-dashed border-blue-300 bg-white/70 text-blue-500 dark:bg-gray-900/70'
                }`}
              >
                {s.text || '＋'}
              </button>
            ) : null}
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
}
