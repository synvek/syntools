import { useTranslation } from 'react-i18next';
import { useReactFlow, useViewport } from '@xyflow/react';
import { useFlowStore } from '../store';
import { anchorOf, type HierarchyNode } from '../core';
import type { FlowEdgeData, Waypoint } from '../model/types';

/** 折点手柄边长（屏幕像素） */
const HANDLE = 9;
/** 段中点「加折点」手柄边长 */
const ADD_HANDLE = 7;

type EditorNode = HierarchyNode & { id: string; hidden?: boolean };

/**
 * 折点编辑层：选中连线后，在每个折点上显示可拖拽手柄（双击删除），
 * 并在每段中点显示「＋」手柄（点击插入折点）。
 *
 * 与 EdgeEndpointHandles 一致：用 viewport 变换把画布坐标换算成屏幕坐标，
 * 覆盖在 React Flow 之上；拖拽期间不写入历史，松手后由 commit 合并为一次撤销。
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

  /** 拖拽折点：跟手移动，松手结束 */
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
    // 每段中点：点击插入折点（插入位置即段序号）
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
              // 屏幕坐标 → 画布坐标后插入到该段序号处
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
