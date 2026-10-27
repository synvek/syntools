import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';
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
import { TableNode } from '../nodes/TableNode';
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
import { virtualizeThresholdOf } from '../model/perf';
import { QuickConnectOverlay } from './QuickConnectOverlay';
import { CanvasScrollbars } from './CanvasScrollbars';
import { EdgeEndpointHandles } from './EdgeEndpointHandles';
import { EdgeJumpOverlay } from './EdgeJumpOverlay';
import { GuideLines, Ruler } from './Ruler';
import { SelectionResizer } from './SelectionResizer';
import { EdgeWaypointEditor } from './EdgeWaypointEditor';
import { FlowContextMenu, type FlowContextTarget } from './FlowContextMenu';

const nodeTypes = {
  shape: ShapeNode,
  image: ImageNode,
  icon: IconNode,
  formula: FormulaNode,
  table: TableNode,
};
const edgeTypes = { flow: FlowEdgeLine };

/** Default line type → React Flow connection line type (free-anchor dragging follows the toolbar line type) */
const CONNECTION_LINE_TYPES: Record<FlowEdgeStyle['type'], ConnectionLineType> = {
  straight: ConnectionLineType.Straight,
  step: ConnectionLineType.Step,
  smoothstep: ConnectionLineType.SmoothStep,
  bezier: ConnectionLineType.Bezier,
};

const defaultEdgeOptions = { type: 'flow' };

/* Adaptive virtualization thresholds live in `model/perf.ts` (pure functions, easy to unit-test). */

/** Paint-jitter filter for hand-drawn line types (defined once globally, referenced by edges as url(#flow-sketch)) */
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

/** Right-click on an unselected node: make it the sole selection (syncing React Flow's internal selected flag) */
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

/** Right-click on an unselected edge: make it the sole selection */
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

/** Paper page bounds: an absolutely positioned rect derived from the viewport (placed at the bottom of the canvas) */
function PageBoundary() {
  const size = useFlowStore((s) => s.pageSize);
  const { x: vx, y: vy, zoom } = useViewport();
  if (!size) return null;
  return (
    <div
      data-testid="flowchart-page-boundary"
      className="pointer-events-none absolute"
      style={{
        left: vx,
        top: vy,
        width: size.width * zoom,
        height: size.height * zoom,
        boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.7)',
      }}
      aria-hidden="true"
    />
  );
}

const FlowInner = forwardRef<HTMLDivElement>(function FlowInner(_props, ref) {
  const { t } = useTranslation();
  const { screenToFlowPosition, fitView, zoomTo } = useReactFlow();
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  /**
   * Viewport area (window size): used for the adaptive virtualization threshold.
   * Updated only when the window size changes, avoiding recomputation while dragging nodes.
   */
  const [viewportArea, setViewportArea] = useState(() =>
    typeof window === 'undefined' ? 1_200_000 : window.innerWidth * window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setViewportArea(window.innerWidth * window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  /**
   * Nodes to render: children of collapsed containers are marked hidden.
   *
   * Derives the view only and never touches the store: collapsing is view state, child data must stay intact;
   * with no collapsed container the original array reference is reused, avoiding needless re-renders.
   */
  const displayNodes = useMemo(() => {
    const collapsed = new Set<string>();
    for (const n of nodes) {
      if (n.data.collapsed === true) collapsed.add(n.id);
    }
    if (collapsed.size === 0) return nodes;
    return nodes.map((n) =>
      n.parentId && collapsed.has(n.parentId) && n.hidden !== true ? { ...n, hidden: true } : n,
    );
  }, [nodes]);
  const canvasBackground = useFlowStore((s) => s.canvasBackground);
  const gridStyle = useFlowStore((s) => s.gridStyle);
  const wheelMode = useFlowStore((s) => s.wheelMode);
  const rulersVisible = useFlowStore((s) => s.rulersVisible);
  const onNodesChangeStore = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const storeOnConnect = useFlowStore((s) => s.onConnect);
  const onSelectionChange = useFlowStore((s) => s.onSelectionChange);
  /** Whether onConnect already created an edge for this drag (so onConnectEnd does not build a duplicate) */
  const connectedRef = useRef(false);
  /** Whether a "reconnect endpoint" drag is in progress (the fallback creation logic is skipped then) */
  const reconnectingRef = useRef(false);
  /** DOM ref of this container: handed to the outside (for centering inserted nodes) and used for context-menu coordinate conversion */
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<FlowContextTarget | null>(null);

  const setHostRef = useCallback(
    (el: HTMLDivElement | null) => {
      hostRef.current = el;
      if (typeof ref === 'function') ref(el);
      // Object ref: React types mark current as readonly, so it is handed over as a writable reference
      else if (ref) (ref as { current: HTMLDivElement | null }).current = el;
    },
    [ref],
  );

  /** Open the context menu: convert the pointer position into coordinates relative to the canvas container */
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

  /** Reset the edge-drag flag when leaving the editor */
  useEffect(
    () => () => {
      document.body.classList.remove('flow-connecting');
    },
    [],
  );

  /** Free-edge start point (onConnectEnd uses it to decide the drop target: a shape / empty space) */
  const connectingFrom = useRef<{
    nodeId?: string | null;
    handleId?: string | null;
    x?: number;
    y?: number;
  } | null>(null);

  const onConnectStart = useCallback((e: unknown, params: unknown) => {
    document.body.classList.add('flow-connecting');
    connectedRef.current = false;
    // Start creating an edge from an anchor: yield the selection of existing edges (reconnect drags are excluded, flagged earlier by onReconnectStart)
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
   * Free-edge drop target:
   * - on another shape's body → create an edge from the nearest side;
   * - on a handle → already handled by onConnect, skip;
   * - on empty canvas / itself / no drag → create nothing (only connects to existing shapes).
   */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      document.body.classList.remove('flow-connecting');
      const from = connectingFrom.current;
      connectingFrom.current = null;
      const alreadyConnected = connectedRef.current;
      connectedRef.current = false;
      // Reconnect drags are handled by their own logic
      if (reconnectingRef.current) return;
      // onConnect already created the edge (drop snapped to an anchor): do not build another
      if (alreadyConnected) return;
      if (!from?.nodeId) return;
      const pt =
        'changedTouches' in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
      // Not dragged (basically a click on an anchor): create nothing, avoiding accidental edges
      if (
        from.x !== undefined &&
        from.y !== undefined &&
        Math.hypot(pt.clientX - from.x, pt.clientY - from.y) < 20
      ) {
        return;
      }
      const nodes = useFlowStore.getState().nodes;
      const src = nodes.find((n) => n.id === from.nodeId);
      if (!src) return;

      // Hit-test "node bounding boxes" in canvas coordinates instead of elementFromPoint / closest:
      // the DOM hit test is disturbed by node internals, overlay layers (SelectionResizer / QuickConnectOverlay, etc.),
      // the 8 always-present anchor hit areas, and paint timing, causing occasional "dropped on a shape but no edge" bugs.
      const flowPoint = screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      const byId = new Map(nodes.map((n) => [n.id, n] as const));
      const target = nodes.find((n) => {
        if (n.id === from.nodeId || isContainerKind(n.data.kind)) return false;
        const r = absoluteRectOf(n, byId);
        return (
          flowPoint.x >= r.x &&
          flowPoint.x <= r.x + r.width &&
          flowPoint.y >= r.y &&
          flowPoint.y <= r.y + r.height
        );
      });
      if (!target) return; // dropped on empty space / itself / a container → create nothing

      const sb = absoluteRectOf(src, byId);
      const tb = absoluteRectOf(target, byId);
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
        target: target.id,
        targetHandle: th,
      });
    },
    [screenToFlowPosition],
  );

  /** Id of the node being dragged (read when the rAF flush runs; null means no drag) */
  const draggingIdRef = useRef<string | null>(null);
  /** Pending guide-computation frame (rAF handle) */
  const helperRafRef = useRef<number | null>(null);

  /**
   * Compute alignment guides and snap the drop position to them (reads the latest store state).
   * Extracted into a function so it can be throttled with rAF: one drag may fire several position changes per frame,
   * so only the last computation is kept, and cachedAbsoluteRectOf reuses bounding boxes of unmoved nodes.
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
    // Cross-container alignment: compare against all visible nodes on the page, excluding itself and its own descendants (otherwise it snaps to itself)
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
      // helper lines return absolute snap coordinates, which must be converted back to the node's own coordinate system
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

  // Cancel the pending frame on unmount, avoiding writes to a destroyed canvas
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
        // rAF throttling: several position changes within one frame are computed once (O(n) per drag → at most one incremental pass per frame)
        scheduleHelperSnap();
      } else if (changes.some((c) => c.type === 'position')) {
        // Drag end: flush the snap synchronously first so it is not reverted on release, then clear the guides
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
      // Auto centering: when the drop center is close to the center x of a sibling node, align to that center (handy for stacking vertically in a line)
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

  /** Grid style → React Flow background variant */
  const bgVariant =
    gridStyle === 'lines'
      ? BackgroundVariant.Lines
      : gridStyle === 'cross'
        ? BackgroundVariant.Cross
        : BackgroundVariant.Dots;

  return (
    <div
      ref={setHostRef}
      className="relative h-full w-full"
      data-testid="flowchart-canvas"
      style={
        {
          // Canvas background color plus a same-name variable for the jump mask (keeping the gap across edges consistent with the background)
          background: canvasBackground === 'transparent' ? undefined : canvasBackground,
          '--flow-canvas-bg': canvasBackground === 'transparent' ? '#ffffff' : canvasBackground,
        } as CSSProperties
      }
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {/* Paper page bounds: placed below React Flow, shown only when a page size is set */}
      <PageBoundary />
      <ReactFlow
        nodes={displayNodes}
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
        /**
         * Turn off React Flow's "bring selection to front" default (true by default).
         * Layering in this editor is defined by node array order (see orderNodesByHierarchy / reorderLayers),
         * and keeping that default would temporarily lift the selected shape above z-index 1000,
         * giving the illusion of "click and it jumps to the top, restore by switching selection"; with it off, what you see is the real layering.
         */
        elevateNodesOnSelect={false}
        // Context menu: nodes (change shape / edit actions), edges (routing actions), empty canvas (paste / select all, etc.)
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
        // The endpoint circle stays invisible and only carries "reconnect dragging":
        // EdgeEndpointHandles dispatches mousedown to it when its custom square is pressed, and React Flow finishes the drag.
        // A small radius is used to shrink the invisible click-blocking area.
        reconnectRadius={10}
        connectionLineType={connectionLineType}
        connectionLineStyle={{ stroke: '#2563EB', strokeWidth: 2, strokeDasharray: '5 4' }}
        snapToGrid={gridEnabled}
        snapGrid={[gridSize, gridSize]}
        // Drawing-tool habit: drag with the left button for a selection box, pan the canvas with the middle/right button
        selectionOnDrag
        panOnDrag={[1, 2]}
        /**
         * Wheel behavior is switchable (a session setting, defaulting to legacy behavior):
         * - `pan`: wheel pans, Ctrl/⌘+wheel zooms (the original behavior)
         * - `zoom`: wheel zooms (draw.io habit), panning moves to middle/right-button drag
         */
        panOnScroll={wheelMode === 'pan'}
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={wheelMode === 'zoom'}
        zoomOnPinch
        multiSelectionKeyCode={['Meta', 'Control']}
        minZoom={0.2}
        maxZoom={2.5}
        /**
         * Large-graph virtualization: render only the nodes/edges inside the viewport.
         * Disabled for small graphs to avoid first-frame measurement flicker and overhead; rendering fully is most stable below the threshold.
         * The threshold adapts to the viewport area: large screens hold more nodes and render fully faster, small screens switch earlier.
         */
        onlyRenderVisibleElements={nodes.length > virtualizeThresholdOf(viewportArea)}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        className={
          canvasBackground === 'transparent' ? 'bg-gray-50 dark:bg-gray-950' : 'bg-transparent'
        }
      >
        {gridStyle === 'none' ? null : (
          <Background variant={bgVariant} gap={gridSize} size={1} color="#cbd5e1" />
        )}
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
      {rulersVisible ? <Ruler /> : null}
      <GuideLines />
      <EdgeJumpOverlay />
      <SelectionResizer />
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
