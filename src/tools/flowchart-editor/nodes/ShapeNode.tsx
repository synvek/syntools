import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useFlowStore } from '../store';
import { nodeTransformCss, safeLinkHref } from '../core';
import {
  DEFAULT_LINE_HEIGHT,
  VERTICAL_ALIGN_FLEX,
  type FlowNodeData,
  isContainerKind,
} from '../model/types';
import { paramValue, shapeDefOf, shapeSize } from '../model/shapes';
import { renderInlineMarkdown } from '../model/markdown';
import { drawDecor, drawShape } from './shapeDraw';
import { ShapeAdjustHandles } from './ShapeAdjustHandles';
import { ShapeRotateHandle } from './ShapeRotateHandle';
import { nodeDashArrayOf } from '../ops';
import { useQuickConnect } from '../quickConnect';

/**
 * Free-edge anchors: 3 on each of the top and bottom sides (including near both corners), 1 on each side, 8 in total.
 * With ConnectionMode.Loose, any anchor can start or end an edge, close to Draw.io's free-connection feel.
 */
const HANDLES: Array<{ id: string; position: Position; offset: string }> = [
  { id: 't-l', position: Position.Top, offset: '25%' },
  { id: 't', position: Position.Top, offset: '50%' },
  { id: 't-r', position: Position.Top, offset: '75%' },
  { id: 'b-l', position: Position.Bottom, offset: '25%' },
  { id: 'b', position: Position.Bottom, offset: '50%' },
  { id: 'b-r', position: Position.Bottom, offset: '75%' },
  { id: 'l', position: Position.Left, offset: '50%' },
  { id: 'r', position: Position.Right, offset: '50%' },
];

/**
 * Hover quick-connect arrows (draw.io / ProcessOn style): one click creates a same-kind connected shape in that direction
 * and links it automatically. Only shown for plain shapes, not containers (swimlane/group).
 */
const QUICK_DIRS: Array<{
  dir: 'up' | 'down' | 'left' | 'right';
  pos: React.CSSProperties;
  rotate: number;
}> = [
  { dir: 'up', pos: { left: '50%', top: -18, transform: 'translate(-50%, -50%)' }, rotate: 0 },
  {
    dir: 'down',
    pos: { left: '50%', bottom: -18, transform: 'translate(-50%, 50%)' },
    rotate: 180,
  },
  { dir: 'left', pos: { left: -18, top: '50%', transform: 'translate(-50%, -50%)' }, rotate: -90 },
  { dir: 'right', pos: { right: -18, top: '50%', transform: 'translate(50%, -50%)' }, rotate: 90 },
];

/**
 * Hold Shift to resize proportionally: NodeResizer only has a static `keepAspectRatio`,
 * so the global Shift state is tracked and passed in on demand. Listeners are mounted only while a node is selected.
 */
function useShiftHeld(enabled: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setHeld(false);
      return;
    }
    const isShift = (e: KeyboardEvent) => e.key === 'Shift';
    const onDown = (e: KeyboardEvent) => {
      if (isShift(e)) setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (isShift(e)) setHeld(false);
    };
    const onBlur = () => setHeld(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);
  return held;
}

function ShapeNodeComponent({ id, data, selected, width, height }: NodeProps) {
  const { t } = useTranslation();
  const d = data as FlowNodeData;
  const def = shapeDefOf(d.kind);
  // A definite size is required: relying on a percentage height from the parent container would collapse the node to 0 height and hide it
  const fallback = shapeSize(d.kind);
  const w = width ?? fallback.width;
  const h = height ?? fallback.height;
  const setNodeLabel = useFlowStore((s) => s.setNodeLabel);
  /**
   * Whether this shape is an endpoint of a selected edge. If so the four quick-connect arrows are hidden:
   * they overlap the edge-reconnect endpoint circles (and the node layer is above), stealing their pointer events.
   * Only affects endpoint shapes; quick-connect arrows on other shapes and all edge anchors stay usable.
   */
  const endpointOfSelectedEdge = useFlowStore((s) => {
    if (s.selectedEdges.length === 0) return false;
    const sel = new Set(s.selectedEdges);
    return s.edges.some((e) => sel.has(e.id) && (e.source === id || e.target === id));
  });
  /** Render adjust handles only when this node is the single selection, avoiding stacked handles on multi-select */
  const soleSelected = useFlowStore(
    (s) => s.selectedNodes.length === 1 && s.selectedNodes.includes(id),
  );
  /** Hold Shift to resize proportionally (keyboard listeners only while selected) */
  const shiftHeld = useShiftHeld(selected === true);
  /** Number of direct children inside the container (shown in the title bar when collapsed; always 0 for non-containers) */
  const childCount = useFlowStore((s) =>
    isContainerKind(d.kind) ? s.nodes.filter((n) => n.parentId === id).length : 0,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  /** Actual font size after auto-shrink (null means the original size fits without overflow) */
  const [fitFontSize, setFitFontSize] = useState<number | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(d.label);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, d.label]);

  const commit = () => {
    setNodeLabel(id, draft, true);
    setEditing(false);
  };

  const style = d.style;
  const strokeColor = selected ? '#1D4ED8' : style.stroke;
  const strokeWidth = selected ? style.strokeWidth + 1.5 : style.strokeWidth;
  const textColor = style.textColor ?? strokeColor;
  const isContainer = isContainerKind(d.kind);
  const isGroup = d.kind === 'group';
  // Vertical swimlanes and groups have the title bar on top; horizontal swimlanes on the left
  const headerOnTop = def?.draw === 'laneV' || isGroup;
  // Swimlane title bar thickness (adjustable parameter laneHeader)
  const laneHeader = def ? paramValue(def, style, 'laneHeader', w, h) : 40;
  /**
   * Node transform (rotation / mirror): a pure CSS transform applied only to the inner shape + text container.
   * Geometry and edge anchors keep the unrotated axis-aligned bounding box (matching draw.io's bbox behavior);
   * the resize frame / adjust handles / edge anchors stay on the outer layer, always axis-aligned and hit-testable.
   */
  const transform = nodeTransformCss(style);
  /** Container collapsed: keep only the title bar; child nodes are hidden by the canvas layer (see FlowCanvas's derived nodes) */
  const collapsed = isContainer && d.collapsed === true;
  /** Vertical text alignment (defaults to middle, matching legacy behavior) */
  const justify = VERTICAL_ALIGN_FLEX[style.verticalAlign ?? 'middle'];
  const textLineHeight = style.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const href = safeLinkHref(style.link);

  /**
   * Text auto-shrink: when content overflows, binary-search the largest font size that fits (floor 8px).
   *
   * Font sizes are tried directly on the DOM to measure (avoiding a React re-render per candidate),
   * and the state is written once after convergence. Node size changes recompute via the width/height dependencies,
   * so no extra ResizeObserver is needed.
   */
  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el || editing || style.autoShrink !== true) {
      setFitFontSize(null);
      return;
    }
    const base = style.fontSize;
    const restore = () => {
      el.style.fontSize = `${base}px`;
    };
    const fits = (size: number) => {
      el.style.fontSize = `${size}px`;
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
    };
    if (fits(base)) {
      restore();
      setFitFontSize(null);
      return;
    }
    let lo = 8;
    let hi = base;
    for (let i = 0; i < 8 && hi - lo > 0.5; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    restore();
    setFitFontSize(Math.max(8, Math.round(lo * 2) / 2));
  }, [style.autoShrink, style.fontSize, style.lineHeight, d.label, w, h, editing]);

  return (
    <div
      ref={rootRef}
      className={`group/node relative${collapsed ? ' flow-node-collapsed' : ''}`}
      // Convenient for style hooks and end-to-end assertions on "current shape kind / collapsed state"
      data-kind={d.kind}
      data-collapsed={collapsed ? 'true' : undefined}
      onDoubleClick={() => !isContainer && setEditing(true)}
      style={{ width: w, height: h, cursor: 'grab' }}
    >
      <div
        className="absolute inset-0"
        data-testid="flowchart-node-transform"
        data-rotation={style.rotation ? String(style.rotation) : undefined}
        style={{ transform, transformOrigin: 'center' }}
      >
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="absolute inset-0 overflow-visible"
          style={
            style.shadow ? { filter: 'drop-shadow(0 2px 5px rgba(15,23,42,0.25))' } : undefined
          }
        >
          <g
            fill={style.fill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fillOpacity={style.opacity ?? 1}
            strokeDasharray={nodeDashArrayOf(style.lineDash, strokeWidth)}
            style={{ transition: 'stroke 120ms ease' }}
          >
            {def ? drawShape(def, w, h, style) : <rect x={0} y={0} width={w} height={h} rx={4} />}
          </g>
          {def ? (
            // fill takes the stroke color so decorations such as the solid inner circle of "activity final" follow the theme;
            // existing decorations all set fill:'none' explicitly, so they are unaffected.
            <g
              stroke={strokeColor}
              fill={strokeColor}
              strokeWidth={Math.max(1.5, strokeWidth - 0.5)}
            >
              {drawDecor(def, w, h, style)}
            </g>
          ) : null}
        </svg>

        {isContainer ? (
          headerOnTop ? (
            <div
              className="absolute left-0 top-0 flex items-center gap-1 truncate px-3 text-[13px] font-semibold"
              style={{
                height: isGroup ? 26 : laneHeader,
                width: w,
                color: style.stroke,
              }}
            >
              <span className="truncate">{d.label}</span>
            </div>
          ) : (
            <div
              className="absolute left-0 top-0 flex items-center justify-center text-[13px] font-semibold"
              style={{
                width: laneHeader,
                height: h,
                color: style.stroke,
                writingMode: 'vertical-rl',
              }}
            >
              {d.label}
            </div>
          )
        ) : editing ? (
          // Multi-line text: Enter / ⇧+Enter inserts a newline, ⌘/Ctrl+Enter submits, Esc cancels, blur submits automatically
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Must stop propagation: submitting unmounts the textarea synchronously, and an event bubbling on to window
              // would make the global shortcuts mistake it for a canvas action (Enter would create another connected node)
              e.stopPropagation();
              if (e.key === 'Escape') {
                setEditing(false);
                return;
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
              }
            }}
            className="nodrag absolute inset-0 z-10 resize-none bg-white/90 px-2 py-1 text-[13px] outline-none dark:bg-gray-900/90"
            style={{
              color: textColor,
              fontWeight: style.bold ? 700 : 400,
              fontStyle: style.italic ? 'italic' : 'normal',
              textAlign: style.align,
              lineHeight: textLineHeight,
            }}
          />
        ) : (
          <div
            ref={labelRef}
            className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden px-2"
            style={{
              color: textColor,
              fontSize: fitFontSize ?? style.fontSize,
              fontWeight: style.bold ? 700 : 400,
              fontStyle: style.italic ? 'italic' : 'normal',
              textAlign: style.align,
              fontFamily: style.fontFamily,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: textLineHeight,
              justifyContent: justify,
              background: style.labelBackground,
              borderRadius: style.labelBackground ? 3 : undefined,
            }}
          >
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`pointer-events-auto inline-block underline decoration-dotted underline-offset-2${
                  style.align === 'center'
                    ? ' self-center'
                    : style.align === 'right'
                      ? ' self-end'
                      : ' self-start'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {d.label || href}
              </a>
            ) : style.textFormat === 'markdown' && d.label ? (
              <span
                data-testid="flowchart-markdown-label"
                className="pointer-events-none [&_a]:pointer-events-auto [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-0.5"
                dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(d.label) }}
              />
            ) : (
              d.label || ' '
            )}
          </div>
        )}
      </div>

      {/* Collapsed badge: shows how many child nodes are hidden, so content does not look lost */}
      {collapsed && childCount > 0 ? (
        <span
          className="nodrag absolute z-30 rounded bg-slate-200 px-1 text-[10px] leading-4 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
          style={{ right: 22, top: 3 }}
          data-testid="flowchart-collapsed-count"
        >
          {childCount}
        </span>
      ) : null}

      {/* Container collapse / expand toggle: always visible, independent of selection */}
      {isContainer ? (
        <button
          type="button"
          data-testid="flowchart-collapse-toggle"
          aria-label={t(
            collapsed ? 'tools.flowchart.expandContainer' : 'tools.flowchart.collapseContainer',
          )}
          title={t(
            collapsed ? 'tools.flowchart.expandContainer' : 'tools.flowchart.collapseContainer',
          )}
          className="nodrag nopan absolute z-30 flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white text-[11px] font-bold leading-none text-gray-600 shadow-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          style={{ right: 3, top: 3 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            useFlowStore.getState().toggleContainerCollapsed(id);
          }}
        >
          {collapsed ? '+' : '−'}
        </button>
      ) : null}

      {/* Resize: containers (swimlane / group) can be resized too, only with a larger minimum size */}
      {selected ? (
        <NodeResizer
          minWidth={isContainer ? 200 : 48}
          minHeight={isContainer ? 140 : 32}
          // Hold Shift to resize proportionally (see useShiftHeld)
          keepAspectRatio={shiftHeld}
          onResizeStart={() => useFlowStore.getState().commit()}
        />
      ) : null}

      {/* Shape adjustable-parameter handles (draw.io-style yellow vertices): appear on single selection and update on drag */}
      {soleSelected && def ? (
        <ShapeAdjustHandles
          nodeId={id}
          def={def}
          style={style}
          w={w}
          h={h}
          containerRef={rootRef}
        />
      ) : null}

      {/* Rotate handle: appears only for a single selected shape (containers are rotated from the toolbar, avoiding overlap with the title bar) */}
      {soleSelected && !isContainer ? (
        <ShapeRotateHandle nodeId={id} style={style} containerRef={rootRef} />
      ) : null}

      {/* Containers provide no edge anchors */}
      {!isContainer &&
        HANDLES.map((handle) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="source"
            position={handle.position}
            /**
             * The anchor box is squeezed to 1px and placed inside the shape: React Flow computes edge endpoints from the anchor
             * box's outer edge, so a larger box pushes the endpoint outward (a 12px box puts it ~6px outside the shape);
             * once the box's outer edge coincides with the shape edge, the endpoint lands exactly on it.
             * A 0-size box is not an option: React Flow then lacks anchor measurements and cannot start an edge from it.
             */
            style={
              handle.position === Position.Top || handle.position === Position.Bottom
                ? { left: handle.offset, transform: 'translate(-50%, 0)' }
                : { top: handle.offset, transform: 'translate(0, -50%)' }
            }
            className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent"
          >
            {/* Visible dot (12px): centered on the anchor center (i.e. the shape edge) and carries the actual click */}
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-blue-500 ring-2 ring-blue-300/70 opacity-0 transition-opacity group-hover/node:opacity-100" />
          </Handle>
        ))}

      {/* Hover quick-connect arrows: drag out an edge and releasing it opens the shape picker */}
      {!isContainer &&
        QUICK_DIRS.map((q) => (
          <button
            key={q.dir}
            type="button"
            aria-label={`${t('tools.flowchart.quickConnect')}-${q.dir}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // Starting an edge from a quick-connect arrow: yield the selection of existing edges
              useFlowStore.getState().deselectEdges();
              useQuickConnect
                .getState()
                .start({ sourceId: id, dir: q.dir, x: e.clientX, y: e.clientY });
            }}
            className={`quick-connect nodrag nopan absolute z-20 flex cursor-crosshair items-center justify-center rounded-full bg-blue-500 text-white shadow-md ring-2 ring-white transition ${
              endpointOfSelectedEdge
                ? 'pointer-events-none opacity-0'
                : selected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/node:opacity-100'
            }`}
            style={q.pos}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              style={{ transform: `rotate(${q.rotate}deg)` }}
            >
              <path
                d="M12 4 L12 20 M6 10 L12 4 L18 10"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ))}
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
