import { forwardRef, useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  ControlButton,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Connection,
  type NodeChange,
} from '@xyflow/react';
import { useFlowStore, type FlowEdge, type FlowNode } from '../store';
import { ShapeNode } from '../nodes/ShapeNode';
import { FlowEdgeLine } from '../nodes/FlowEdgeLine';
import { ImageNode } from '../nodes/ImageNode';
import { IconNode } from '../nodes/IconNode';
import { FormulaNode } from '../nodes/FormulaNode';
import {
  absolutePositionOf,
  absoluteRectOf,
  cachedAbsoluteRectOf,
  computeHelperLines,
} from '../core';
import {
  type FlowEdgeStyle,
  type FlowNodeData,
  isContainerKind,
  type ShapeKind,
} from '../model/types';
import { shapeSize } from '../model/shapes';
import { QuickConnectOverlay } from './QuickConnectOverlay';
import { CanvasScrollbars } from './CanvasScrollbars';
import { EdgeEndpointHandles } from './EdgeEndpointHandles';
import { EdgeWaypointEditor } from './EdgeWaypointEditor';
import { FlowContextMenu, type FlowContextTarget } from './FlowContextMenu';

const nodeTypes = {
  shape: ShapeNode,
  image: ImageNode,
  icon: IconNode,
  formula: FormulaNode,
};
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

/** 右键命中未选中节点时：将其设为唯一选中项（同步 React Flow 内部的 selected 标记） */
function selectOnlyNode(id: string): void {
  useFlowStore.setState((s) => ({
    selectedNodes: [id],
    selectedEdges: [],
    nodes: s.nodes.map((n) =>
      Boolean(n.selected) === (n.id === id) ? n : { ...n, selected: n.id === id },
    ),
    edges: s.edges.some((e) => e.selected)
      ? s.edges.map((e) => (e.selected ? { ...e, selected: false } : e))
      : s.edges,
  }));
}

/** 右键命中未选中连线时：将其设为唯一选中项 */
function selectOnlyEdge(id: string): void {
  useFlowStore.setState((s) => ({
    selectedEdges: [id],
    selectedNodes: [],
    edges: s.edges.map((e) =>
      Boolean(e.selected) === (e.id === id) ? e : { ...e, selected: e.id === id },
    ),
    nodes: s.nodes.some((n) => n.selected)
      ? s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n))
      : s.nodes,
  }));
}

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
  const { t } = useTranslation();
  const { screenToFlowPosition, fitView, zoomTo } = useReactFlow();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const onNodesChangeStore = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const storeOnConnect = useFlowStore((s) => s.onConnect);
  const onSelectionChange = useFlowStore((s) => s.onSelectionChange);
  /** onConnect 是否已为本次拖拽创建过连线（避免 onConnectEnd 重复补建） */
  const connectedRef = useRef(false);
  /** 是否处于「重连端点」拖拽（此时不应用补建逻辑） */
  const reconnectingRef = useRef(false);
  /** 本容器的 DOM 引用：既转交给外部（画布中心插入定位），也用于右键菜单的坐标换算 */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<FlowContextTarget | null>(null);

  const setHostRef = useCallback(
    (el: HTMLDivElement | null) => {
      hostRef.current = el;
      if (typeof ref === 'function') ref(el);
      // 对象 ref：React 类型把 current 标为只读，这里按可写引用转交
      else if (ref) (ref as { current: HTMLDivElement | null }).current = el;
    },
    [ref],
  );

  /** 打开右键菜单：把指针位置换算成相对画布容器的坐标 */
  const openContextMenu = useCallback(
    (
      event: React.MouseEvent | MouseEvent,
      target: Pick<FlowContextTarget, 'kind' | 'nodeId' | 'edgeId'>,
    ) => {
      const host = hostRef.current;
      if (!host) return;
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      setContextMenu({
        ...target,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        bounds: { width: rect.width, height: rect.height },
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const onConnect = useCallback(
    (connection: Connection) => {
      connectedRef.current = true;
      storeOnConnect(connection);
    },
    [storeOnConnect],
  );

  const onReconnect = useCallback((oldEdge: FlowEdge, connection: Connection) => {
    useFlowStore.getState().reconnectEdge(oldEdge.id, connection);
  }, []);
  const addNode = useFlowStore((s) => s.addNode);
  const defaultEdge = useFlowStore((s) => s.defaultEdge);
  const gridEnabled = useFlowStore((s) => s.gridEnabled);
  const gridSize = useFlowStore((s) => s.gridSize);
  const connectionLineType = CONNECTION_LINE_TYPES[defaultEdge.type];

  /** 离开编辑器时清理连线拖拽标记 */
  useEffect(
    () => () => {
      document.body.classList.remove('flow-connecting');
    },
    [],
  );

  /** 自由连线起点（onConnectEnd 据此判断落点：目标图形 / 空白处） */
  const connectingFrom = useRef<{
    nodeId?: string | null;
    handleId?: string | null;
    x?: number;
    y?: number;
  } | null>(null);

  const onConnectStart = useCallback((e: unknown, params: unknown) => {
    document.body.classList.add('flow-connecting');
    connectedRef.current = false;
    // 从锚点开始新建连线：让出已有连线的选中态（重连拖拽不在此列，由 onReconnectStart 先行标记）
    if (!reconnectingRef.current) useFlowStore.getState().deselectEdges();
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
    const alreadyConnected = connectedRef.current;
    connectedRef.current = false;
    // 重连拖拽由其自身逻辑处理
    if (reconnectingRef.current) return;
    // onConnect 已创建连线（落点吸附到锚点）：不再补建
    if (alreadyConnected) return;
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

  /** 正在拖动的节点 id（rAF 收口时读取；null 表示未拖动） */
  const draggingIdRef = useRef<string | null>(null);
  /** 待执行的辅助线计算帧（rAF 句柄） */
  const helperRafRef = useRef<number | null>(null);

  /**
   * 计算对齐辅助线并把落点吸附到辅助线（读取最新 store 状态）。
   * 抽成独立函数以便用 rAF 节流：一次拖拽在一帧内可能触发多次位置变更，
   * 只保留最后一次计算，配合 cachedAbsoluteRectOf 复用未移动节点的包围盒。
   */
  const applyHelperSnap = useCallback(() => {
    const state = useFlowStore.getState();
    const draggedId = draggingIdRef.current;
    if (!draggedId) return;
    const all = state.nodes;
    const dragged = all.find((n) => n.id === draggedId);
    if (!dragged) return;
    const byId = new Map(all.map((n) => [n.id, n] as const));
    const draggedRect = absoluteRectOf(dragged, byId);
    // 跨容器对齐：与同页所有可见节点比较，但排除自身与自身后代（否则会自我吸附）
    const descendants = new Set<string>();
    const collectChildren = (id: string) => {
      for (const n of all) {
        if (n.parentId === id && !descendants.has(n.id)) {
          descendants.add(n.id);
          collectChildren(n.id);
        }
      }
    };
    collectChildren(dragged.id);
    const others = all
      .filter((n) => n.id !== dragged.id && !descendants.has(n.id) && n.hidden !== true)
      .map((n) => cachedAbsoluteRectOf(n, byId));
    const lines = computeHelperLines(draggedRect, others, state.alignTolerance);
    state.setHelperLines(lines);
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
  }, []);

  const cancelHelperSnap = useCallback(() => {
    if (helperRafRef.current !== null) {
      cancelAnimationFrame(helperRafRef.current);
      helperRafRef.current = null;
    }
  }, []);

  const scheduleHelperSnap = useCallback(() => {
    if (helperRafRef.current !== null) return;
    helperRafRef.current = requestAnimationFrame(() => {
      helperRafRef.current = null;
      applyHelperSnap();
    });
  }, [applyHelperSnap]);

  // 卸载时取消待执行帧，避免对已销毁画布写入
  useEffect(() => () => cancelHelperSnap(), [cancelHelperSnap]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeStore(changes);
      const drag = changes.find(
        (c): c is NodeChange & { type: 'position'; dragging: boolean } =>
          c.type === 'position' && (c as { dragging?: boolean }).dragging === true,
      );
      if (drag) {
        draggingIdRef.current = drag.id;
        // rAF 节流：一帧内多次位置变更只计算一次（拖拽 O(n)/帧 → 每帧至多一次增量计算）
        scheduleHelperSnap();
      } else if (changes.some((c) => c.type === 'position')) {
        // 拖拽结束：先同步收口一次吸附，避免松手瞬间被还原，再清理辅助线
        if (draggingIdRef.current) {
          cancelHelperSnap();
          applyHelperSnap();
        }
        draggingIdRef.current = null;
        useFlowStore.getState().setHelperLines(null);
      }
    },
    [onNodesChangeStore, scheduleHelperSnap, cancelHelperSnap, applyHelperSnap],
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
    <div
      ref={setHostRef}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={() => {
          reconnectingRef.current = true;
        }}
        onReconnectEnd={() => {
          reconnectingRef.current = false;
        }}
        onSelectionChange={onSelectionChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={() => useFlowStore.getState().commit()}
        onNodeDragStop={(_, node) => useFlowStore.getState().reparentNode(node.id)}
        // 右键菜单：节点（切换形状 / 编辑动作）、连线（布线动作）、空白（粘贴 / 全选等）
        onNodeContextMenu={(event, node) => {
          if (!useFlowStore.getState().selectedNodes.includes(node.id)) selectOnlyNode(node.id);
          openContextMenu(event, { kind: 'node', nodeId: node.id });
        }}
        onEdgeContextMenu={(event, edge) => {
          if (!useFlowStore.getState().selectedEdges.includes(edge.id)) selectOnlyEdge(edge.id);
          openContextMenu(event, { kind: 'edge', edgeId: edge.id });
        }}
        onPaneContextMenu={(event) => openContextMenu(event, { kind: 'pane' })}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={32}
        edgesReconnectable
        // 端点圆始终不可见，只作为「重连拖拽」的承载元素：
        // EdgeEndpointHandles 自绘方块按下时会向它派发 mousedown，之后由 React Flow 完成拖拽。
        // 取较小半径以减少不可见的挡点击区域。
        reconnectRadius={10}
        connectionLineType={connectionLineType}
        connectionLineStyle={{ stroke: '#2563EB', strokeWidth: 2, strokeDasharray: '5 4' }}
        snapToGrid={gridEnabled}
        snapGrid={[gridSize, gridSize]}
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
        <Controls showZoom showFitView={false} showInteractive={false}>
          <ControlButton
            onClick={() => fitView({ padding: 0.3, minZoom: 0.2, maxZoom: 2.5 })}
            title={t('tools.flowchart.fitView')}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M16 3h3a2 2 0 0 1 2 2v3" />
              <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </ControlButton>
          <ControlButton onClick={() => zoomTo(1)} title={t('tools.flowchart.zoomActual')}>
            <span className="text-[11px] font-semibold">1:1</span>
          </ControlButton>
        </Controls>
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => ((n.data as FlowNodeData)?.style?.fill as string) ?? '#cbd5e1'}
          className="!bottom-2 !right-2 !h-24 !w-36 rounded-md border border-gray-200 bg-white/90 dark:border-gray-700 dark:bg-gray-900/90"
        />
      </ReactFlow>
      <HelperLines />
      <EdgeEndpointHandles />
      <EdgeWaypointEditor />
      <QuickConnectOverlay />
      <FlowContextMenu target={contextMenu} onClose={closeContextMenu} />
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
