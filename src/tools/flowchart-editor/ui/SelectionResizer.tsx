import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { absoluteRectOf } from '../core';
import { isContainerKind, type GroupScaleItem } from '../model/types';

/** Minimum bounding-box edge length (px, flow coordinates): prevents an unusable overall scale */
const MIN_BOX = 24;
const HANDLE_SIZE = 10;

type Dir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** The eight resize handles: normalized positions relative to the bounding box */
const HANDLES: Array<{ dir: Dir; nx: number; ny: number; cursor: string }> = [
  { dir: 'nw', nx: 0, ny: 0, cursor: 'nwse-resize' },
  { dir: 'n', nx: 0.5, ny: 0, cursor: 'ns-resize' },
  { dir: 'ne', nx: 1, ny: 0, cursor: 'nesw-resize' },
  { dir: 'e', nx: 1, ny: 0.5, cursor: 'ew-resize' },
  { dir: 'se', nx: 1, ny: 1, cursor: 'nwse-resize' },
  { dir: 's', nx: 0.5, ny: 1, cursor: 'ns-resize' },
  { dir: 'sw', nx: 0, ny: 1, cursor: 'nesw-resize' },
  { dir: 'w', nx: 0, ny: 0.5, cursor: 'ew-resize' },
];

interface DragState {
  dir: Dir;
  /** Bounding box at gesture start (flow coordinates) */
  box: { x: number; y: number; width: number; height: number };
  /** Pointer position at gesture start (screen coordinates) */
  pointer: { x: number; y: number };
  originals: GroupScaleItem[];
  zoom: number;
}

/**
 * Multi-select group resize: renders 8 handles on the selection's bounding box and scales every selected node proportionally while dragging.
 *
 * - The overlay is positioned in screen space (`useViewport` conversion), so it follows pan/zoom in real time;
 * - Not offered when containers (swimlane / group) are involved (container resizing already propagates to children via `onNodesChange`);
 * - History is committed once at drag start, the process writes with `history=false`, and it is finalized on release.
 */
export function SelectionResizer() {
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const nodes = useFlowStore((s) => s.nodes);
  const { x: vx, y: vy, zoom } = useViewport();
  const drag = useRef<DragState | null>(null);

  const targets = nodes.filter((n) => selectedNodes.includes(n.id));
  if (targets.length < 2 || targets.some((n) => isContainerKind(n.data.kind))) return null;

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const rects = targets.map((n) => absoluteRectOf(n, byId));
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  const box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  const toScreenX = (flowX: number) => flowX * zoom + vx;
  const toScreenY = (flowY: number) => flowY * zoom + vy;
  const left = toScreenX(box.x);
  const top = toScreenY(box.y);
  const width = box.width * zoom;
  const height = box.height * zoom;

  const onDown = (dir: Dir) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    useFlowStore.getState().commit();
    const originals: GroupScaleItem[] = targets.map((n) => {
      const rect = absoluteRectOf(n, byId);
      return { id: n.id, absX: rect.x, absY: rect.y, width: rect.width, height: rect.height };
    });
    drag.current = {
      dir,
      box,
      pointer: { x: e.clientX, y: e.clientY },
      originals,
      zoom,
    };

    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = (ev.clientX - d.pointer.x) / d.zoom;
      const dy = (ev.clientY - d.pointer.y) / d.zoom;
      const hasE = d.dir.includes('e');
      const hasW = d.dir.includes('w');
      const hasN = d.dir.includes('n');
      const hasS = d.dir.includes('s');

      // Each row / column is anchored to the opposite edge, which stays put during the resize
      const anchorX = hasW ? d.box.x + d.box.width : d.box.x;
      const anchorY = hasN ? d.box.y + d.box.height : d.box.y;

      let sx = 1;
      let sy = 1;
      if (hasE || hasW) {
        const nextWidth = hasE ? d.box.width + dx : d.box.width - dx;
        sx = Math.max(MIN_BOX, nextWidth) / d.box.width;
      }
      if (hasN || hasS) {
        const nextHeight = hasS ? d.box.height + dy : d.box.height - dy;
        sy = Math.max(MIN_BOX, nextHeight) / d.box.height;
      }
      // Shift: proportional (the ratio comes from the axis with the larger displacement)
      if (ev.shiftKey) {
        const uniform = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
        sx = uniform;
        sy = uniform;
      }
      if (d.box.width <= 0 || d.box.height <= 0) return;
      useFlowStore.getState().scaleSelection(d.originals, { x: anchorX, y: anchorY }, sx, sy);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      drag.current = null;
      useFlowStore.getState().commit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className="selection-resizer"
      data-testid="flowchart-selection-resizer"
      style={{ left, top, width, height }}
    >
      {HANDLES.map((h) => (
        <button
          key={h.dir}
          type="button"
          data-testid={`flowchart-selection-handle-${h.dir}`}
          aria-label={`resize-${h.dir}`}
          onPointerDown={onDown(h.dir)}
          className="selection-resizer__handle"
          style={{
            left: h.nx * 100 + '%',
            top: h.ny * 100 + '%',
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: h.cursor,
          }}
        />
      ))}
    </div>
  );
}
