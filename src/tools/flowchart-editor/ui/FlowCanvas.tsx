import { forwardRef, useCallback, useRef, type DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  useReactFlow,
  useViewport,
  type NodeChange,
} from '@xyflow/react';
import { useFlowStore, type FlowNode } from '../store';
import { ShapeNode } from '../nodes/ShapeNode';
import { FlowEdgeLine } from '../nodes/FlowEdgeLine';
import { absolutePositionOf, absoluteRectOf, computeHelperLines } from '../core';
import {
  type FlowEdgeStyle,
  type FlowNodeData,
  isContainerKind,
  type ShapeKind,
} from '../model/types';
import { shapeSize } from '../model/shapes';
import { QuickConnectOverlay } from './QuickConnectOverlay';
import { CanvasScrollbars } from './CanvasScrollbars';

const nodeTypes = { shape: ShapeNode };
const edgeTypes = { flow: FlowEdgeLine };

/** 默认线型 → React Flow 连接线型（自由锚点拖拽时跟随工具栏线型） */
const CONNECTION_LINE_TYPES: Record<FlowEdgeStyle['type'], ConnectionLineType> = {
  straight: ConnectionLineType.Straight,
  step: ConnectionLineType.Step,
  smoothstep: ConnectionLineType.SmoothStep,
  bezier: ConnectionLineType.Bezier,
};

const defaultEdgeOptions = { type: 'flow' };

/** 手绘线型使用的油漆抖动滤镜（全局定义一次，供连线 url(#flow-sketch) 引用） */
function SketchFilter() {
  return (
    <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
      <defs>
        <filter id="flow-sketch" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018"
            numOctaves="3"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

const DROP_MIME = 'application/flowchart-kind';

function HelperLines() {
  const { x: vx, y: vy, zoom } = useViewport();
  const lines = useFlowStore((s) => s.helperLines);
  if (!lines) return null;
  return (
    <>
      {lines.vertical !== undefined && (
        <div
          className={
            lines.verticalCenter
              ? 'pointer-events-none absolute inset-y-0 z-50 border-l border-dashed border-sky-500'
              : 'pointer-events-none absolute inset-y-0 z-50 w-px bg-rose-400'
          }
          style={{ left: vx + lines.vertical * zoom }}
        />
      )}
      {lines.horizontal !== undefined && (
        <div
          className={
            lines.horizontalCenter
              ? 'pointer-events-none absolute inset-x-0 z-50 border-t border-dashed border-sky-500'
              : 'pointer-events-none absolute inset-x-0 z-50 h-px bg-rose-400'
          }
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
  const defaultEdge = useFlowStore((s) => s.defaultEdge);
  const connectionLineType = CONNECTION_LINE_TYPES[defaultEdge.type];

  /** 自由连线起点（onConnectEnd 据此判断落点：目标图形 / 空白处） */
  const connectingFrom = useRef<{
    nodeId?: string | null;
    handleId?: string | null;
    x?: number;
    y?: number;
  } | null>(null);

  const onConnectStart = useCallback((e: unknown, params: unknown) => {
    document.body.classList.add('flow-connecting');
    const p = params as { nodeId?: string | null; handleId?: string | null } | undefined;
    const ev = e as MouseEvent | TouchEvent | undefined;
    let x: number | undefined;
    let y: number | undefined;
    if (ev && 'changedTouches' in ev && ev.changedTouches.length > 0) {
      x = ev.changedTouches[0].clientX;
      y = ev.changedTouches[0].clientY;
    } else if (ev && 'clientX' in ev) {
      x = (ev as MouseEvent).clientX;
      y = (ev as MouseEvent).clientY;
    }
    connectingFrom.current = { nodeId: p?.nodeId ?? null, handleId: p?.handleId ?? null, x, y };
  }, []);

  /**
   * 自由连线落点：
   * - 落在其它图形「身上」→ 取最近边补建连线；
   * - 落在 handle → onConnect 已处理，跳过；
   * - 落在空白画布 / 自身 / 未拖动 → 不生成任何内容（仅连接到已有图形）。
   */
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    document.body.classList.remove('flow-connecting');
    const from = connectingFrom.current;
    connectingFrom.current = null;
    if (!from?.nodeId) return;
    const pt =
      'changedTouches' in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
    // 未拖动（基本是点击锚点）：不生成，避免误建
    if (
      from.x !== undefined &&
      from.y !== undefined &&
      Math.hypot(pt.clientX - from.x, pt.clientY - from.y) < 20
    ) {
      return;
    }
    const el = document.elementFromPoint(pt.clientX, pt.clientY) as HTMLElement | null;
    if (!el) return;
    // 落在 handle 上：onConnect 已处理，避免重复
    if (el.closest('.react-flow__handle')) return;

    const nodes = useFlowStore.getState().nodes;
    const src = nodes.find((n) => n.id === from.nodeId);
    if (!src) return;

    const nodeEl = el.closest('.react-flow__node') as HTMLElement | null;
    const targetId = nodeEl?.getAttribute('data-id');

    // 命中另一个图形：连到其身上最近边
    if (targetId && targetId !== from.nodeId) {
      const tgt = nodes.find((n) => n.id === targetId);
      if (!tgt || isContainerKind(tgt.data.kind)) return;
      const byId = new Map(nodes.map((n) => [n.id, n] as const));
      const sb = absoluteRectOf(src, byId);
      const tb = absoluteRectOf(tgt, byId);
      const dx = tb.x + tb.width / 2 - (sb.x + sb.width / 2);
      const dy = tb.y + tb.height / 2 - (sb.y + sb.height / 2);
      let sh = 'b';
      let th = 't';
      if (Math.abs(dx) >= Math.abs(dy)) {
        sh = dx >= 0 ? 'r' : 'l';
        th = dx >= 0 ? 'l' : 'r';
      } else {
        sh = dy >= 0 ? 'b' : 't';
        th = dy >= 0 ? 't' : 'b';
      }
      useFlowStore.getState().onConnect({
        source: from.nodeId,
        sourceHandle: sh,
        target: targetId,
        targetHandle: th,
      });
      return;
    }

    // 落在自身图形 / 空白画布：不生成任何内容
  }, []);

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
      let x = point.x - size.width / 2;
      const y = point.y - size.height / 2;
      // 自动居中对齐：若落点中心与同层某节点中心 x 接近，则对齐到该中心（便于竖直堆叠成直线）
      const others = useFlowStore
        .getState()
        .nodes.filter((n) => !n.parentId && !isContainerKind(n.data.kind));
      const cx = x + size.width / 2;
      let best = Infinity;
      let snapCx = cx;
      for (const o of others) {
        const os = shapeSize(o.data.kind);
        const ocx = o.position.x + (o.width ?? os.width) / 2;
        const d = Math.abs(ocx - cx);
        if (d < best && d <= 14) {
          best = d;
          snapCx = ocx;
        }
      }
      if (best <= 14) x = snapCx - size.width / 2;
      addNode(kind, { x: Math.round(x), y: Math.round(y) });
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={() => useFlowStore.getState().commit()}
        onNodeDragStop={(_, node) => useFlowStore.getState().reparentNode(node.id)}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={32}
        connectionLineType={connectionLineType}
        connectionLineStyle={{ stroke: '#2563EB', strokeWidth: 2, strokeDasharray: '5 4' }}
        snapToGrid
        snapGrid={[10, 10]}
        // 绘图工具习惯：左键拖出选框，中键/右键平移画布
        selectionOnDrag
        panOnDrag={[1, 2]}
        // 滚轮/触控板滚动 = 平移（上下滚上下、左右滚左右），缩放改由 Ctrl/⌘+滚轮 或双指捏合触发
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomOnPinch
        multiSelectionKeyCode={['Meta', 'Control']}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-gray-50 dark:bg-gray-950"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => ((n.data as FlowNodeData)?.style?.fill as string) ?? '#cbd5e1'}
          className="!bottom-2 !right-2 !h-24 !w-36 rounded-md border border-gray-200 bg-white/90 dark:border-gray-700 dark:bg-gray-900/90"
        />
      </ReactFlow>
      <HelperLines />
      <QuickConnectOverlay />
      <CanvasScrollbars />
      <SketchFilter />
    </div>
  );
});

export function FlowCanvas(props: { containerRef?: React.Ref<HTMLDivElement> }) {
  return <FlowInner ref={props.containerRef} />;
}

export { DROP_MIME };
export type { FlowNode };
