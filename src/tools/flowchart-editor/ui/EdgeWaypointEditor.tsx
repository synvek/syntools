import { useTranslation } from 'react-i18next';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { anchorOf, type HierarchyNode } from '../core';
import type { FlowEdgeData, Waypoint } from '../model/types';

/** Waypoint handle edge length (screen pixels) */
const HANDLE = 9;
/** Edge length of the segment-midpoint "add waypoint" handle */
const ADD_HANDLE = 7;

type EditorNode = HierarchyNode & { id: string; hidden?: boolean };

/**
 * Waypoint editing layer: after an edge is selected, shows a draggable handle on each waypoint (double-click deletes),
 * plus a "+" handle at each segment midpoint (click to insert a waypoint).
 *
 * Like EdgeEndpointHandles: viewport transforms convert canvas coordinates to screen coordinates,
 * layered above React Flow; no history is written while dragging, and commit coalesces it into one undo step on release.
 */
export function EdgeWaypointEditor() {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const { x: vx, y: vy, zoom } = useViewport();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);

  if (selectedEdges.length === 0) return null;

  const byId = new Map(nodes.map((n) => [n.id, n as EditorNode] as const));
  const selected = new Set(selectedEdges);

  /** Drag a waypoint: follows the pointer, ends on release */
  const startDrag =
    (edgeId: string, index: number, waypoints: Waypoint[]) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const origin = waypoints[index];
      const from = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      useFlowStore.getState().commit();
      const onMove = (ev: PointerEvent) => {
        const p = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        const next = waypoints.map((w, i) =>
          i === index
            ? { x: Math.round(origin.x + (p.x - from.x)), y: Math.round(origin.y + (p.y - from.y)) }
            : { x: w.x, y: w.y },
        );
        useFlowStore.getState().setEdgeWaypoints(edgeId, next, false);
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    };

  const items: Array<{
    key: string;
    kind: 'point' | 'add';
    edgeId: string;
    index: number;
    x: number;
    y: number;
    waypoints: Waypoint[];
  }> = [];

  for (const edge of edges) {
    if (!selected.has(edge.id)) continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const data = edge.data as FlowEdgeData | undefined;
    const waypoints = data?.waypoints ?? [];
    const from = anchorOf(source, byId, edge.sourceHandle, target);
    const to = anchorOf(target, byId, edge.targetHandle, source);
    const path: Waypoint[] = [
      { x: from.point.x, y: from.point.y },
      ...waypoints.map((w) => ({ x: w.x, y: w.y })),
      { x: to.point.x, y: to.point.y },
    ];

    for (let i = 0; i < waypoints.length; i += 1) {
      items.push({
        key: `${edge.id}-w${i}`,
        kind: 'point',
        edgeId: edge.id,
        index: i,
        x: vx + waypoints[i].x * zoom,
        y: vy + waypoints[i].y * zoom,
        waypoints,
      });
    }
    // Each segment's midpoint: click to insert a waypoint (the insertion position is the segment index)
    for (let i = 0; i < path.length - 1; i += 1) {
      items.push({
        key: `${edge.id}-a${i}`,
        kind: 'add',
        edgeId: edge.id,
        index: i,
        x: vx + ((path[i].x + path[i + 1].x) / 2) * zoom,
        y: vy + ((path[i].y + path[i + 1].y) / 2) * zoom,
        waypoints,
      });
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {items.map((item) =>
        item.kind === 'point' ? (
          <button
            key={item.key}
            type="button"
            data-testid="edge-waypoint"
            aria-label={t('tools.flowchart.waypoint')}
            title={t('tools.flowchart.removeWaypoint')}
            onPointerDown={startDrag(item.edgeId, item.index, item.waypoints)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const next = item.waypoints.filter((_, i) => i !== item.index);
              useFlowStore.getState().setEdgeWaypoints(item.edgeId, next);
            }}
            className="pointer-events-auto absolute rounded-[2px] border border-white bg-amber-500 shadow-sm transition-colors hover:bg-amber-600"
            style={{
              left: item.x - HANDLE / 2,
              top: item.y - HANDLE / 2,
              width: HANDLE,
              height: HANDLE,
              cursor: 'move',
            }}
          />
        ) : (
          <button
            key={item.key}
            type="button"
            data-testid="edge-waypoint-add"
            aria-label={t('tools.flowchart.addWaypoint')}
            title={t('tools.flowchart.addWaypoint')}
            onClick={(e) => {
              e.stopPropagation();
              const next = [...item.waypoints];
              // Convert screen coordinates to canvas coordinates, then insert at that segment index
              next.splice(item.index, 0, {
                x: Math.round((item.x - vx) / zoom),
                y: Math.round((item.y - vy) / zoom),
              });
              useFlowStore.getState().setEdgeWaypoints(item.edgeId, next);
            }}
            className="pointer-events-auto absolute rounded-full border border-white bg-blue-400/70 opacity-60 shadow-sm transition-opacity hover:opacity-100"
            style={{
              left: item.x - ADD_HANDLE / 2,
              top: item.y - ADD_HANDLE / 2,
              width: ADD_HANDLE,
              height: ADD_HANDLE,
              cursor: 'copy',
            }}
          />
        ),
      )}
    </div>
  );
}
