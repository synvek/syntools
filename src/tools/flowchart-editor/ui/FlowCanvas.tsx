import { forwardRef, useCallback, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useViewport,
  type NodeChange,
} from '@xyflow/react';
import { useFlowStore, type FlowNode } from '../store';
import { ShapeNode } from '../nodes/ShapeNode';
import { absolutePositionOf, absoluteRectOf, computeHelperLines } from '../core';
import { shapeSize, type FlowNodeData, type ShapeKind } from '../model/types';

const nodeTypes = { shape: ShapeNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 18, height: 18 },
};

const DROP_MIME = 'application/flowchart-kind';

function HelperLines() {
  const { x: vx, y: vy, zoom } = useViewport();
  const lines = useFlowStore((s) => s.helperLines);
  if (!lines) return null;
  return (
    <>
      {lines.vertical !== undefined && (
        <div
          className="pointer-events-none absolute inset-y-0 z-50 w-px bg-rose-400"
          style={{ left: vx + lines.vertical * zoom }}
        />
      )}
      {lines.horizontal !== undefined && (
        <div
          className="pointer-events-none absolute inset-x-0 z-50 h-px bg-rose-400"
          style={{ top: vy + lines.horizontal * zoom }}
        />
      )}
    </>
  );
}

const FlowInner = forwardRef<HTMLDivElement>(function FlowInner(_props, ref) {
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChangeStore = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const onConnect = useFlowStore((s) => s.onConnect);
  const onSelectionChange = useFlowStore((s) => s.onSelectionChange);
  const addNode = useFlowStore((s) => s.addNode);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeStore(changes);
      const drag = changes.find(
        (c): c is NodeChange & { type: 'position'; dragging: boolean } =>
          c.type === 'position' && (c as { dragging?: boolean }).dragging === true,
      );
      if (drag) {
        const all = useFlowStore.getState().nodes;
        const dragged = all.find((n) => n.id === drag.id);
        if (dragged) {
          const byId = new Map(all.map((n) => [n.id, n] as const));
          const draggedRect = absoluteRectOf(dragged, byId);
          // 只在同一层级（同一泳道内或同在画布顶层）之间显示对齐参考线
          const others = all
            .filter(
              (n) => n.id !== dragged.id && (n.parentId ?? null) === (dragged.parentId ?? null),
            )
            .map((n) => absoluteRectOf(n, byId));
          const lines = computeHelperLines(draggedRect, others);
          useFlowStore.getState().setHelperLines(lines);
          if (lines.x !== undefined || lines.y !== undefined) {
            // helper lines 返回的是绝对吸附坐标，需转换回节点自身坐标系
            const parent = dragged.parentId ? byId.get(dragged.parentId) : undefined;
            const parentAbs = parent ? absolutePositionOf(parent, byId) : { x: 0, y: 0 };
            const snapped = {
              x: (lines.x ?? draggedRect.x) - parentAbs.x,
              y: (lines.y ?? draggedRect.y) - parentAbs.y,
            };
            useFlowStore.setState((s) => ({
              nodes: s.nodes.map((n) => (n.id === dragged.id ? { ...n, position: snapped } : n)),
            }));
          }
        }
      } else if (changes.some((c) => c.type === 'position')) {
        useFlowStore.getState().setHelperLines(null);
      }
    },
    [onNodesChangeStore],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(DROP_MIME) as ShapeKind;
      if (!kind) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const size = shapeSize(kind);
      addNode(kind, {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      });
    },
    [screenToFlowPosition, addNode],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div ref={ref} className="relative h-full w-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodeDragStart={() => useFlowStore.getState().commit()}
        onNodeDragStop={(_, node) => useFlowStore.getState().reparentNode(node.id)}
        connectionMode={ConnectionMode.Loose}
        snapToGrid
        snapGrid={[8, 8]}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        className="group bg-gray-50 dark:bg-gray-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => ((n.data as FlowNodeData)?.style?.fill as string) ?? '#cbd5e1'}
          className="!bottom-2 !right-2 !h-24 !w-36 rounded-md border border-gray-200 bg-white/90 dark:border-gray-700 dark:bg-gray-900/90"
        />
      </ReactFlow>
      <HelperLines />
    </div>
  );
});

export function FlowCanvas(props: { containerRef?: React.Ref<HTMLDivElement> }) {
  return <FlowInner ref={props.containerRef} />;
}

export { DROP_MIME };
export type { FlowNode };
