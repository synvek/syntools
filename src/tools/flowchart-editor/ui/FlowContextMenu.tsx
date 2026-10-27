import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '../store';
import {
  alignSelected,
  copySelection,
  cutSelection,
  flipSelected,
  groupSelected,
  layerOp,
  patchSelectedEdgeStyle,
  pasteClipboard,
  rotateSelected,
  toggleHidden,
  toggleLocked,
  ungroupSelected,
} from '../flowOps';
import {
  SHAPE_CATEGORY_ORDER,
  shapeDefOf,
  shapesOfCategory,
  type ShapeCategory,
} from '../model/shapes';
import { EDGE_RELATION_PRESETS, isContainerKind } from '../model/types';
import { ShapeGlyph } from './ShapeGlyph';

/**
 * The object hit by the right click and the menu position.
 * `x` / `y` are relative to the canvas container's top-left corner and `bounds` is the container size (to keep the menu inside the viewport).
 */
export interface FlowContextTarget {
  kind: 'node' | 'edge' | 'pane';
  x: number;
  y: number;
  bounds: { width: number; height: number };
  nodeId?: string;
  edgeId?: string;
}

interface FlowContextMenuProps {
  target: FlowContextTarget | null;
  onClose: () => void;
}

const MENU_CLS =
  'pointer-events-auto absolute w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900';

function Row({ label, onClick, testId }: { label: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-500/10"
    >
      {label}
    </button>
  );
}

function Separator() {
  return <div className="my-1 border-t border-gray-100 dark:border-gray-800" />;
}

/**
 * Canvas context menu: on nodes it offers "change shape" plus common edit actions, on edges the routing actions,
 * and on empty space paste / select all / fit view.
 *
 * Closing: a click outside the menu, Esc, wheel / pan / zoom. Esc is intercepted in the capture phase
 * so it does not also trigger the editor's global Esc (clear selection).
 */
export function FlowContextMenu({ target, onClose }: FlowContextMenuProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const panelRef = useRef<HTMLDivElement>(null);
  /** Fallback positioning before the measured size is known (avoiding a first-frame jump) */
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const [shapeOpen, setShapeOpen] = useState(true);
  const [category, setCategory] = useState<ShapeCategory>('flow');

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const selectedNodes = useFlowStore((s) => s.selectedNodes);

  const node = target?.nodeId ? nodes.find((n) => n.id === target.nodeId) : undefined;
  const edge = target?.edgeId ? edges.find((e) => e.id === target.edgeId) : undefined;
  const nodeKind = node?.data.kind;

  // New target on every hit: reset the shape panel and expand the category containing the hit node by default
  useEffect(() => {
    if (!target) return;
    setShapeOpen(target.kind === 'node');
    const kind = target.nodeId
      ? useFlowStore.getState().nodes.find((n) => n.id === target.nodeId)?.data.kind
      : undefined;
    setCategory((kind ? shapeDefOf(kind)?.category : undefined) ?? 'flow');
  }, [target]);

  // Keep the menu inside the canvas viewport by its measured size (re-checked when the shape panel expands/collapses)
  useLayoutEffect(() => {
    if (!target) return;
    const el = panelRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(target.x, Math.max(8, target.bounds.width - width - 8))),
      top: Math.max(8, Math.min(target.y, Math.max(8, target.bounds.height - height - 8))),
    });
  }, [target, shapeOpen, category]);

  useEffect(() => {
    if (!target) return;
    const outside = (eventTarget: EventTarget | null) =>
      !panelRef.current?.contains(eventTarget as Node | null);
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Intercept in the capture phase so the editor's global Esc does not fire once the menu has closed
      event.stopPropagation();
      onClose();
    };
    const onWheel = (event: WheelEvent) => {
      // The shape panel scrolls internally, so scrolling inside it does not close the menu
      if (outside(event.target)) onClose();
    };
    // The canvas supports "right-button drag to pan": once an actual drag happens the menu closes, so it never lingers in place
    let origin: { x: number; y: number } | null = null;
    const onMove = (event: PointerEvent) => {
      if ((event.buttons & 2) === 0) {
        origin = null;
        return;
      }
      if (!origin) {
        origin = { x: event.clientX, y: event.clientY };
        return;
      }
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 4) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onMove);
    };
  }, [target, onClose]);

  if (!target) return null;

  /** Close the menu before running the action, so re-renders caused by the action do not hit a stale menu */
  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const selectedSet = new Set(selectedNodes);
  const canGroup = nodes.some(
    (n) => selectedSet.has(n.id) && !isContainerKind(n.data.kind) && n.hidden !== true,
  );
  const canUngroup = node?.data.kind === 'group';

  return (
    <div
      ref={panelRef}
      data-testid="flow-context-menu"
      role="menu"
      aria-label={t('tools.flowchart.contextMenu')}
      className={MENU_CLS}
      style={{ left: pos.left, top: pos.top }}
    >
      {target.kind === 'node' && node ? (
        <>
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {t('tools.flowchart.switchShape')}
          </p>

          <div className="mb-1 flex flex-wrap gap-1 px-1">
            {SHAPE_CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                  category === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-500/10'
                }`}
              >
                {t(`tools.flowchart.cat_${c}`)}
              </button>
            ))}
          </div>

          <div
            data-testid="context-shape-grid"
            className="mb-1 grid max-h-40 grid-cols-5 gap-1 overflow-y-auto border-y border-gray-100 px-1 py-1.5 dark:border-gray-800"
          >
            {shapesOfCategory(category).map((def) => (
              <button
                key={def.kind}
                type="button"
                data-testid={`context-shape-${def.kind}`}
                title={t(`tools.flowchart.shape_${def.kind}`)}
                aria-label={t(`tools.flowchart.shape_${def.kind}`)}
                aria-pressed={nodeKind === def.kind}
                onClick={run(() => useFlowStore.getState().changeNodeKind(node.id, def.kind))}
                className={`flex items-center justify-center rounded-md border p-0.5 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm ${
                  nodeKind === def.kind
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/60'
                }`}
              >
                <ShapeGlyph def={def} className="h-5 w-5" />
              </button>
            ))}
          </div>

          <Row testId="context-cut" label={t('tools.flowchart.cut')} onClick={run(cutSelection)} />
          <Row
            testId="context-copy"
            label={t('tools.flowchart.copy')}
            onClick={run(copySelection)}
          />
          <Row
            testId="context-paste"
            label={t('tools.flowchart.paste')}
            onClick={run(pasteClipboard)}
          />
          <Row
            testId="context-edit-label"
            label={t('tools.flowchart.editText')}
            onClick={run(() => {
              // Reuse the canvas in-place editing: dispatch a dblclick to the node
              const el = document.querySelector(`.react-flow__node[data-id="${node.id}"]`);
              el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            })}
          />
          <Row
            testId="context-duplicate"
            label={t('tools.flowchart.duplicate')}
            onClick={run(() => useFlowStore.getState().duplicateSelected())}
          />

          {/* Align: the same actions as the toolbar, so right-click offers quick alignment */}
          <div className="mb-1 flex flex-wrap gap-1 border-y border-gray-100 px-1 py-1.5 dark:border-gray-800">
            {(
              [
                ['left', '⇤'],
                ['hcenter', '↔'],
                ['right', '⇥'],
                ['top', '⇡'],
                ['vcenter', '⇕'],
                ['bottom', '⇣'],
              ] as const
            ).map(([mode, glyph]) => (
              <button
                key={mode}
                type="button"
                data-testid={`context-align-${mode}`}
                title={t(
                  `tools.flowchart.align${mode === 'hcenter' ? 'Center' : mode === 'vcenter' ? 'Middle' : mode[0].toUpperCase() + mode.slice(1)}`,
                )}
                onClick={run(() => alignSelected(mode))}
                className="flex h-7 flex-1 items-center justify-center rounded-md border border-gray-200 text-[13px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
              >
                {glyph}
              </button>
            ))}
          </div>

          {/* Transform: rotate and mirror */}
          <div className="mb-1 flex flex-wrap gap-1 px-1">
            {(
              [
                ['context-rotate-cw', '⟳', () => rotateSelected(90)],
                ['context-rotate-ccw', '⟲', () => rotateSelected(-90)],
                ['context-flip-h', '⇄', () => flipSelected('h')],
                ['context-flip-v', '⇅', () => flipSelected('v')],
              ] as const
            ).map(([id, glyph, action]) => (
              <button
                key={id}
                type="button"
                data-testid={id}
                onClick={run(action)}
                className="flex h-7 flex-1 items-center justify-center rounded-md border border-gray-200 text-[13px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
              >
                {glyph}
              </button>
            ))}
          </div>
          {canGroup ? (
            <Row
              testId="context-group"
              label={t('tools.flowchart.group')}
              onClick={run(groupSelected)}
            />
          ) : null}
          {canUngroup ? (
            <Row
              testId="context-ungroup"
              label={t('tools.flowchart.ungroup')}
              onClick={run(ungroupSelected)}
            />
          ) : null}
          <Row
            testId="context-layer-front"
            label={t('tools.flowchart.layerFront')}
            onClick={run(() => layerOp('front'))}
          />
          <Row
            testId="context-layer-back"
            label={t('tools.flowchart.layerBack')}
            onClick={run(() => layerOp('back'))}
          />
          <Separator />
          <Row
            testId="context-lock"
            label={t('tools.flowchart.toggleLock')}
            onClick={run(() => toggleLocked(selectedNodes))}
          />
          <Row
            testId="context-hide"
            label={t('tools.flowchart.toggleVisible')}
            onClick={run(() => toggleHidden(selectedNodes))}
          />
          <Row
            testId="context-delete"
            label={t('tools.flowchart.delete')}
            onClick={run(() => useFlowStore.getState().removeSelected())}
          />
        </>
      ) : null}

      {target.kind === 'edge' && edge ? (
        <>
          <Row
            testId="context-auto-route"
            label={t('tools.flowchart.autoRoute')}
            onClick={run(() => useFlowStore.getState().autoRouteSelectedEdges())}
          />
          <Row
            testId="context-clear-waypoints"
            label={t('tools.flowchart.clearWaypoints')}
            onClick={run(() => useFlowStore.getState().setEdgeWaypoints(edge.id, undefined))}
          />
          <Separator />
          {/* Relation presets: switch UML relation styles in one click */}
          <div className="mb-1 flex flex-wrap gap-1 px-1">
            {EDGE_RELATION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`context-relation-${preset.id}`}
                onClick={run(() => patchSelectedEdgeStyle(preset.patch))}
                className="rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
              >
                {t(`tools.flowchart.${preset.labelKey}`)}
              </button>
            ))}
          </div>
          <Separator />
          <Row
            testId="context-delete"
            label={t('tools.flowchart.delete')}
            onClick={run(() => useFlowStore.getState().removeSelected())}
          />
        </>
      ) : null}

      {target.kind === 'pane' ? (
        <>
          <Row
            testId="context-paste"
            label={t('tools.flowchart.paste')}
            onClick={run(pasteClipboard)}
          />
          <Row
            testId="context-select-all"
            label={t('tools.flowchart.selectAll')}
            onClick={run(() => useFlowStore.getState().selectAll())}
          />
          <Row
            testId="context-deselect"
            label={t('tools.flowchart.deselect')}
            onClick={run(() => useFlowStore.getState().clearSelection())}
          />
          <Row
            testId="context-route-all"
            label={t('tools.flowchart.routeAll')}
            onClick={run(() => useFlowStore.getState().autoRouteEdges('all'))}
          />
          <Separator />
          <Row
            testId="context-fit-view"
            label={t('tools.flowchart.fitView')}
            onClick={run(() => fitView({ padding: 0.3, minZoom: 0.2, maxZoom: 2.5 }))}
          />
        </>
      ) : null}
    </div>
  );
}
