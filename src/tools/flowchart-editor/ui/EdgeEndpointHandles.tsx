import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { absoluteRectOf } from '../core';

/** Relative positions and outward normals of the eight anchors inside a shape (matching HANDLES in ShapeNode) */
const HANDLE_SIDES: Record<string, { fx: number; fy: number }> = {
  't-l': { fx: 0.25, fy: 0 },
  t: { fx: 0.5, fy: 0 },
  't-r': { fx: 0.75, fy: 0 },
  'b-l': { fx: 0.25, fy: 1 },
  b: { fx: 0.5, fy: 1 },
  'b-r': { fx: 0.75, fy: 1 },
  l: { fx: 0, fy: 0.5 },
  r: { fx: 1, fy: 0.5 },
};

/** Square edge length (canvas units, scales with zoom): shorter than the arrow, covering its root while leaving most of it visible */
const SQUARE = 9;
const MIN_SQUARE_PX = 7;

/**
 * Replaces React Flow's default large circular reconnect endpoints with a small self-drawn square.
 * The square center is exactly the edge endpoint (the anchor on the shape edge), so it covers only the arrow root
 * and most of the arrow stays visible; it is also far smaller than the original circle.
 *
 * Interaction: the square receives the press and dispatches a mousedown to React Flow's hidden native endpoint
 * through a **native mousedown listener**; dragging / snapping / dropping is then all handled by React Flow (it listens on document).
 * A native listener is required rather than React's onMouseDown: a synthetic event dispatched from inside a React handler is not processed.
 */
function EndpointSquare(props: {
  edgeId: string;
  end: 'source' | 'target';
  left: number;
  top: number;
  size: number;
}) {
  const { edgeId, end, left, top, size } = props;
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  const label =
    end === 'source' ? t('tools.flowchart.reconnectSource') : t('tools.flowchart.reconnectTarget');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: MouseEvent) => {
      const circle = document.querySelector<SVGElement>(
        `.react-flow__edge[data-id="${edgeId}"] .react-flow__edgeupdater-${end}`,
      );
      if (!circle) return;
      e.preventDefault();
      e.stopPropagation();
      circle.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: e.clientX,
          clientY: e.clientY,
        }),
      );
    };
    el.addEventListener('mousedown', onDown);
    return () => el.removeEventListener('mousedown', onDown);
  }, [edgeId, end]);

  return (
    <button
      ref={ref}
      type="button"
      data-testid="edge-endpoint"
      data-end={end}
      aria-label={label}
      title={label}
      className="edge-endpoint pointer-events-auto absolute cursor-grab rounded-[2px] border border-white bg-blue-600 shadow-sm transition-colors hover:bg-blue-700 active:cursor-grabbing"
      style={{ left, top, width: size, height: size }}
    />
  );
}

/** Reconnect endpoint squares at both ends of the selected edge */
export function EdgeEndpointHandles() {
  const { x: vx, y: vy, zoom } = useViewport();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);

  if (selectedEdges.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const selected = new Set(selectedEdges);
  const size = Math.max(MIN_SQUARE_PX, SQUARE * zoom);
  const items: Array<{
    key: string;
    edgeId: string;
    end: 'source' | 'target';
    left: number;
    top: number;
  }> = [];

  for (const edge of edges) {
    if (!selected.has(edge.id)) continue;
    for (const end of ['source', 'target'] as const) {
      const node = byId.get(end === 'source' ? edge.source : edge.target);
      if (!node) continue;
      const rect = absoluteRectOf(node, byId);
      const handleId = (end === 'source' ? edge.sourceHandle : edge.targetHandle) ?? '';
      const side = HANDLE_SIDES[handleId];
      let px: number;
      let py: number;
      if (side) {
        px = rect.x + rect.width * side.fx;
        py = rect.y + rect.height * side.fy;
      } else {
        // Edges without anchor info (e.g. imported data): take the midpoint of the side facing the opposite end from their relative positions
        const other = byId.get(end === 'source' ? edge.target : edge.source);
        const oRect = other ? absoluteRectOf(other, byId) : rect;
        const dx = oRect.x + oRect.width / 2 - (rect.x + rect.width / 2);
        const dy = oRect.y + oRect.height / 2 - (rect.y + rect.height / 2);
        if (Math.abs(dx) >= Math.abs(dy)) {
          px = rect.x + (dx >= 0 ? rect.width : 0);
          py = rect.y + rect.height / 2;
        } else {
          px = rect.x + rect.width / 2;
          py = rect.y + (dy >= 0 ? rect.height : 0);
        }
      }
      // Square center = edge endpoint (the shape edge), with no outward offset
      items.push({
        key: `${edge.id}-${end}`,
        edgeId: edge.id,
        end,
        left: vx + px * zoom - size / 2,
        top: vy + py * zoom - size / 2,
      });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {items.map((it) => (
        <EndpointSquare
          key={it.key}
          edgeId={it.edgeId}
          end={it.end}
          left={it.left}
          top={it.top}
          size={size}
        />
      ))}
    </div>
  );
}
