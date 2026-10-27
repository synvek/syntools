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

/** Edge label slots: main label + source / target labels */
type LabelSlot = 'main' | 'source' | 'target';

/** Path sampling cache (keyed by the path string): avoids rebuilding a DOM measurement for the same path */
const pathPointCache = new Map<string, { el: SVGPathElement; length: number }>();

/**
 * Point at the given ratio along a path (0 = start, 1 = end).
 *
 * Solved with an off-screen `<path>`'s `getPointAtLength`, which works for straight / polyline / waypoint
 * orthogonal / bezier paths alike, with no per-type parametric equation to derive. The path string is the cache key,
 * so results are reused across pan/zoom (the path is unchanged); the cache is cleared wholesale when it grows too large.
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

/** Polyline corner chamfer radius (used by smoothstep only; step keeps right angles) */
const POLYLINE_RADIUS = 10;

/** Arrow shapes (drawn in a 0..10 viewBox, colored with the edge stroke) */
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
      // Aggregation: hollow diamond (UML aggregation)
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
      // Generalization / realization: hollow triangle (tip pointing outward)
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

/** Align the arrow tip with the path endpoint: triangle-like shapes align by the tip, other geometries are centered */
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
 * Custom edge: builds the path from style.type and draws arrows from startArrow / endArrow,
 * so arrow styles are free of React Flow's built-in marker limits (solid/hollow/circle/diamond/square/bar).
 *
 * With `data.waypoints` present it switches to a polyline path (the orthogonal routing result), and labels become
 * HTML elements that can be double-clicked for in-place editing (rendered through EdgeLabelRenderer).
 */
export function FlowEdgeLine(props: EdgeProps) {
  const { t } = useTranslation();
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label } = props;
  const data = props.data as FlowEdgeData | undefined;
  const style: FlowEdgeStyle = { ...DEFAULT_EDGE_STYLE, ...data?.style };
  // Selected state: thicker and highlighted stroke (custom edges use inline styles, so selection feedback is explicit here)
  const selected = props.selected === true;
  const strokeColor = selected ? '#2563EB' : style.stroke;
  const strokeWidth = selected ? style.strokeWidth + 1.5 : style.strokeWidth;
  /** Label slot currently being edited in place (null means none) */
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
      // Right-angle polyline = rounded polyline with a radius of 0
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

  /** Text and anchor point of the three labels: slots without text skip path sampling (zero cost) */
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

      {/* Edge labels: main label + source / target labels, double-click to edit in place (bypassing BaseEdge's SVG text for richer interaction) */}
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
                  // Stop propagation: the input unmounts after submit, so global shortcuts do not mistake it for a canvas action
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitLabel(s.slot);
                  }
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
