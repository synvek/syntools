import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { EditorMenuBar } from '@/core/components/EditorMenuBar';
import { EditorStatusBar } from '@/core/components/EditorStatusBar';
import {
  EDITOR_ICON_BUTTON_CLASS,
  EDITOR_TITLE_INPUT_CLASS,
  editorMenuItem,
  estimateJsonBytes,
  formatBytes,
  type EditorMenu,
} from '@/core/components/editorChrome';
import { useViewportFill } from '@/core/hooks/useViewportFill';
import { i18n } from '@/core/i18n';
import { buildTemplateDoc, type TemplateKind, type TemplateTranslator } from './model/templates';
import { LAYOUT_DENSITY } from './layout';
import {
  copySelection,
  cutSelection,
  flipSelected,
  groupSelected,
  pasteClipboard,
  rotateSelected,
  ungroupSelected,
} from './flowOps';
import { useFlowStore } from './store';
import { readDraft, writeDraft, clearDraft } from './draft';
import {
  clearPersistedDoc,
  loadPersistedDoc,
  loadPersistedSession,
  loadPersistedSnapshots,
  savePersistedDoc,
  savePersistedSession,
  savePersistedSnapshots,
} from './store/persist';
import { hasFlowchartStrings, registerFlowchartStrings } from './strings';

/** Whether the element is in a text-input state (input / textarea / contenteditable) */
function isTypingElement(el: unknown): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Whether text editing is currently active: checks both the event target and the focused element.
 *
 * Inline editors (shape text / table cells / edge labels / layer rename) unmount synchronously on Enter submit,
 * by which point `document.activeElement` has fallen back to body; looking only at the focused element would
 * mistake the submit for a canvas action (classic symptom: Enter inside a node also triggers "Enter creates node below").
 */
function isTypingContext(e: KeyboardEvent): boolean {
  return isTypingElement(e.target) || isTypingElement(document.activeElement);
}
import {
  FORMULA_NODE_SIZE,
  ICON_NODE_SIZE,
  IMAGE_NODE_SIZE,
  TABLE_NODE_SIZE,
  type FlowNodeData,
  type FlowNodeType,
  type ShapeKind,
} from './model/types';
import { shapeSize } from './model/shapes';
import {
  absolutePositionOf,
  absoluteRectOf,
  formulaData,
  iconData,
  imageData,
  tableData,
} from './core';
import { fitInto, loadImageFile } from './model/image';
import { activePageOf } from './model/migrate';
import { FlowCanvas } from './ui/FlowCanvas';
import { IoMenu } from './ui/IoMenu';
import { ShapePalette } from './ui/ShapePalette';
import { NARROW_QUERY, useMediaQuery } from './ui/useMediaQuery';
import { Onboarding } from './ui/Onboarding';
import { hasSeenOnboarding } from './ui/onboardingStorage';
import { Toolbar } from './ui/Toolbar';
import { PropertyPanel } from './ui/PropertyPanel';
import { ArrangePanel } from './ui/ArrangePanel';
import { LayerPanel } from './ui/LayerPanel';
import { SnapshotPanel } from './ui/SnapshotPanel';
import { SearchPanel } from './ui/SearchPanel';
import { ShortcutHelpDialog } from './ui/ShortcutHelpDialog';
import { PageBrowser } from '@/core/components/PageBrowser';
import { PageThumbnail } from './model/PageThumbnail';
import { PresentOverlay } from '@/core/components/PresentOverlay';
import { TemplatePanel } from './ui/TemplatePanel';
import { captureViewportDataUrl, DEFAULT_RASTER_OPTIONS } from './io/raster';
import { parseDrawioXmlAsync } from './io/drawio';
import './flowchart.css';
import '@xyflow/react/dist/style.css';

const DRAFT_DEBOUNCE_MS = 1200;

/** Right panel: properties / arrange / layers / history snapshots / full-graph search */
const PANELS = ['prop', 'arrange', 'layer', 'history', 'search'] as const;
type PanelKey = (typeof PANELS)[number];

/** Panel → i18n key suffix */
const PANEL_LABEL_KEY: Record<PanelKey, string> = {
  prop: 'panelTitle',
  arrange: 'arrangePanel',
  layer: 'layers',
  history: 'history',
  search: 'searchNodes',
};

function FlowchartInner() {
  const { t, i18n: i18nInstance } = useTranslation();
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  /** Whether the current language's copy has finished loading on demand */
  const [stringsReady, setStringsReady] = useState(() =>
    hasFlowchartStrings(i18nInstance.language),
  );
  /** Workspace height (shape library + canvas + property panel) = remaining first-screen space */
  const workRowRef = useRef<HTMLDivElement | null>(null);
  // Return null for the whole tool until the copy is ready (the workspace is not mounted yet); the ready flag is the recompute signal
  const workHeight = useViewportFill(workRowRef, {
    min: 360,
    signature: stringsReady ? 'ready' : 'loading',
  });

  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const docName = useFlowStore((s) => s.docName);
  const setDocName = useFlowStore((s) => s.setDocName);
  const canUndo = useFlowStore((s) => s.past.length > 0);
  const canRedo = useFlowStore((s) => s.future.length > 0);
  const selectedCount = useFlowStore((s) => s.selectedNodes.length + s.selectedEdges.length);
  const pageOrder = useFlowStore((s) => s.pageOrder);
  const activePageId = useFlowStore((s) => s.activePageId);
  const pageData = useFlowStore((s) => s.pageData);
  // Session settings that need persisting (grid / layout / alignment threshold) plus named snapshots
  const gridEnabled = useFlowStore((s) => s.gridEnabled);
  const gridSize = useFlowStore((s) => s.gridSize);
  const layoutDirection = useFlowStore((s) => s.layoutDirection);
  const layoutDensity = useFlowStore((s) => s.layoutDensity);
  const alignTolerance = useFlowStore((s) => s.alignTolerance);
  const wheelMode = useFlowStore((s) => s.wheelMode);
  const canvasBackground = useFlowStore((s) => s.canvasBackground);
  const gridStyle = useFlowStore((s) => s.gridStyle);
  const guides = useFlowStore((s) => s.guides);
  const rulersVisible = useFlowStore((s) => s.rulersVisible);
  const pageSize = useFlowStore((s) => s.pageSize);
  const snapshots = useFlowStore((s) => s.snapshots);

  /**
   * Live snapshot of each page (the active page is serialized in place), used only for overview thumbnails.
   * Depends on nodes/edges/pageData, so thumbnails follow along during editing.
   */
  const pages = useMemo(
    () => useFlowStore.getState().getDoc().pages,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageOrder, activePageId, pageData, nodes, edges],
  );

  const [busy, setBusy] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelKey>('prop');
  /** On narrow screens (<lg) the two side columns become drawers; wide screens keep three columns */
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [drawer, setDrawer] = useState<null | 'palette' | 'panel'>(null);
  /** First-run onboarding: shown automatically only on first visit, reopenable from the empty state or shortcut help */
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => {
    if (!hasSeenOnboarding()) setGuideOpen(true);
  }, []);
  const [draftSaved, setDraftSaved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [presentSrc, setPresentSrc] = useState<string | null>(null);
  const [presentFailed, setPresentFailed] = useState(false);
  /** Whether session settings / snapshots have been restored from IndexedDB (avoids overwriting stored settings with defaults) */
  const [hydrated, setHydrated] = useState(false);

  /** Present mode: render the overlay (showing "generating") first and capture on the next frame, so large images do not stall the first paint */
  const openPresent = () => {
    setPresentSrc(null);
    setPresentFailed(false);
    setPresenting(true);
    window.setTimeout(() => {
      void captureViewportDataUrl(useFlowStore.getState().nodes, {
        ...DEFAULT_RASTER_OPTIONS,
        format: 'png',
        transparent: false,
        padding: 40,
      }).then((url) => {
        if (url) setPresentSrc(url);
        else setPresentFailed(true);
      });
    }, 0);
  };

  const saveTimer = useRef<number | null>(null);
  const firstSave = useRef(true);

  // Only fit the view when a whole diagram is loaded (draft / template).
  // The fitView prop cannot be used: it fits once the first node is measured,
  // so the first element of a new diagram would always be centered no matter where it is dragged.
  // Default to 100% (actual size) so text and components look close to their designed size instead of being shrunk out of sight.
  const fitViewSoon = useCallback(() => {
    requestAnimationFrame(() => fitView({ padding: 0.3, minZoom: 1, maxZoom: 1 }));
  }, [fitView]);

  // Copy is loaded per language on demand: render only once ready, avoiding a flash of key names
  useEffect(() => {
    let alive = true;
    void registerFlowchartStrings(i18n, i18nInstance.language).then(() => {
      if (alive) setStringsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [i18nInstance.language]);

  // Load once the copy is ready: prefer the full IndexedDB draft (images included), fall back to the localStorage draft, otherwise reset to an empty document
  useEffect(() => {
    if (!stringsReady) return;
    let alive = true;
    void (async () => {
      const persisted = await loadPersistedDoc();
      if (!alive) return;
      if (persisted && (activePageOf(persisted)?.nodes.length ?? 0) > 0) {
        useFlowStore.getState().load(persisted);
        setDraftSaved(true);
        fitViewSoon();
        return;
      }
      // Fallback: a legacy localStorage draft (images may already have been dropped)
      const draft = readDraft();
      const page = activePageOf(draft);
      if (draft && page && page.nodes.length > 0) {
        useFlowStore.getState().load(draft);
        setDraftSaved(true);
        fitViewSoon();
        return;
      }
      useFlowStore.getState().load(null);
    })();
    return () => {
      alive = false;
    };
  }, [fitViewSoon, stringsReady]);

  // Restore session settings and named snapshots (silently falls back to defaults when IndexedDB is unavailable)
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [session, snaps] = await Promise.all([
        loadPersistedSession(),
        loadPersistedSnapshots(),
      ]);
      if (!alive) return;
      if (session) {
        useFlowStore.setState(session);
        if (session.panel) setPanel(session.panel);
      }
      if (snaps.length > 0) useFlowStore.setState({ snapshots: snaps });
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist session settings after they change (not before hydration, to avoid defaults overwriting stored settings)
  useEffect(() => {
    if (!hydrated) return;
    void savePersistedSession({
      gridEnabled,
      gridSize,
      layoutDirection,
      layoutDensity,
      alignTolerance,
      panel,
      wheelMode,
      canvasBackground,
      gridStyle,
      guides,
      rulersVisible,
    });
  }, [
    hydrated,
    gridEnabled,
    gridSize,
    layoutDirection,
    layoutDensity,
    alignTolerance,
    panel,
    wheelMode,
    canvasBackground,
    gridStyle,
    guides,
    rulersVisible,
  ]);

  // Persist named snapshots after they change
  useEffect(() => {
    if (!hydrated) return;
    void savePersistedSnapshots(snapshots);
  }, [hydrated, snapshots]);

  /**
   * Saving: write localStorage first (synchronous and instantly restorable, size-limited so images may be lost),
   * then IndexedDB (asynchronous, images included). Either one succeeding counts as "saved";
   * only when IndexedDB also fails and localStorage dropped images is the user advised to switch to project files.
   */
  const persistNow = useCallback(async () => {
    const doc = useFlowStore.getState().getDoc();
    const local = writeDraft(doc);
    const persisted = await savePersistedDoc(doc);
    setDraftSaved(local.saved || persisted);
    if (local.droppedImages && !persisted) setFailure(t('tools.flowchart.draftTooLarge'));
  }, [t]);

  // Debounced local draft write after changes (edit → unsaved → flushed as saved after 1.2s)
  useEffect(() => {
    // The data on first mount already comes from the draft, so no need to write it again
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    setDraftSaved(false);
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistNow();
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
    // docName is part of the dependencies: changing only the title must also persist
  }, [nodes, edges, docName, persistNow]);

  const addNodeAtCenter = useCallback(
    (kind: ShapeKind) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const size = shapeSize(kind);
      useFlowStore.getState().addNode(kind, {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      });
    },
    [screenToFlowPosition],
  );

  /** Insert a non-shape node (image / icon / formula) at the canvas center */
  const addMediaAtCenter = useCallback(
    (type: FlowNodeType, data: FlowNodeData, size: { width: number; height: number }) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      useFlowStore.getState().addTypedNode(type, data, size, {
        x: Math.round(point.x - size.width / 2),
        y: Math.round(point.y - size.height / 2),
      });
    },
    [screenToFlowPosition],
  );

  const handleAddIcon = useCallback(
    (iconId: string) => addMediaAtCenter('icon', iconData(iconId), ICON_NODE_SIZE),
    [addMediaAtCenter],
  );

  const handleAddFormula = useCallback(
    () => addMediaAtCenter('formula', formulaData('E = mc^2'), FORMULA_NODE_SIZE),
    [addMediaAtCenter],
  );

  const handleAddTable = useCallback(
    () => addMediaAtCenter('table', tableData(3, 3), TABLE_NODE_SIZE),
    [addMediaAtCenter],
  );

  const imageRef = useRef<HTMLInputElement>(null);
  const handleImageFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setFailure(null);
      const loaded = await loadImageFile(file);
      if (!loaded) {
        setFailure(t('tools.flowchart.imageFailed'));
        return;
      }
      const size = fitInto({ width: loaded.width, height: loaded.height }, IMAGE_NODE_SIZE);
      addMediaAtCenter('image', imageData(loaded.src), size);
    },
    [addMediaAtCenter, t],
  );

  const handleNew = useCallback(() => {
    if (useFlowStore.getState().nodes.length > 0 && !window.confirm(t('common.discardConfirm'))) {
      return;
    }
    useFlowStore.getState().load(null);
    clearDraft();
    void clearPersistedDoc();
    setDraftSaved(false);
  }, [t]);

  const handleClear = useCallback(() => {
    useFlowStore.getState().clear();
    useFlowStore.getState().setDocName('');
    clearDraft();
    void clearPersistedDoc();
    setDraftSaved(false);
  }, []);

  /** Template copy goes through i18n (tokens in model/templateLabels.ts); missing keys fall back to English */
  const translateTemplate = useCallback<TemplateTranslator>(
    (key) => String(i18n.t(`tools.flowchart.tpl_${key}`)),
    [],
  );

  const handleTemplate = useCallback(
    (kind: TemplateKind) => {
      useFlowStore.getState().load(buildTemplateDoc(kind, translateTemplate));
      fitViewSoon();
    },
    [fitViewSoon, translateTemplate],
  );

  const handleDelete = useCallback(() => useFlowStore.getState().removeSelected(), []);
  const handleDuplicate = useCallback(() => useFlowStore.getState().duplicateSelected(), []);

  /** Coalescing timer for arrow-key nudges: one continuous key press produces a single undo entry */
  const nudgeTimer = useRef<number | null>(null);
  const nudge = useCallback((dx: number, dy: number) => {
    const st = useFlowStore.getState();
    if (st.selectedNodes.length === 0) return;
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    else st.commit();
    nudgeTimer.current = window.setTimeout(() => {
      nudgeTimer.current = null;
    }, 600);
    st.nudgeSelected(dx, dy);
  }, []);

  /** Tab / Enter: with a single selected node as the source, create a connected node to its right / below */
  const spawnFromSelection = useCallback((dir: 'right' | 'bottom'): boolean => {
    const st = useFlowStore.getState();
    if (st.selectedNodes.length !== 1) return false;
    const node = st.nodes.find((n) => n.id === st.selectedNodes[0]);
    if (!node) return false;
    const byId = new Map(st.nodes.map((n) => [n.id, n] as const));
    const rect = absoluteRectOf(node, byId);
    const gap = 60;
    const position =
      dir === 'right'
        ? { x: rect.x + rect.width + gap, y: rect.y }
        : { x: rect.x, y: rect.y + rect.height + gap };
    return st.spawnConnectedNode(node.id, position) !== undefined;
  }, []);

  /**
   * Ctrl/⌘+S: skip the debounce and write the current document to local storage immediately.
   * This tool has no server, so "save" means persisting the draft (localStorage + IndexedDB).
   */
  const handleSave = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void persistNow();
  }, [persistNow]);

  /** Full-graph search focus: center the viewport on that node (absolute coordinates including parent container offsets) */
  const locateNode = useCallback(
    (nodeId: string) => {
      const st = useFlowStore.getState();
      const node = st.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const byId = new Map(st.nodes.map((n) => [n.id, n] as const));
      const abs = absolutePositionOf(node, byId);
      const size = {
        width: node.width ?? 120,
        height: node.height ?? 60,
      };
      setCenter(abs.x + size.width / 2, abs.y + size.height / 2, { zoom: 1.1, duration: 300 });
    },
    [setCenter],
  );

  // Keyboard shortcuts: undo/redo/cut copy paste/save/export/delete/nudge/select all/rename/create node (not intercepted while editing text)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingContext(e)) return;
      // Step aside while any modal overlay (present / templates / page overview) is open:
      // editor shortcuts should neither act on the covered canvas nor steal the overlay's Esc.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      // Ctrl/⌘ + PageUp/PageDown: previous / next page (matching the feel of switching sheets in a spreadsheet)
      if (mod && (e.key === 'PageUp' || e.key === 'PageDown')) {
        e.preventDefault();
        const st = useFlowStore.getState();
        const index = st.pageOrder.findIndex((page) => page.id === st.activePageId);
        const next = st.pageOrder[index + (e.key === 'PageDown' ? 1 : -1)];
        if (next) st.switchPage(next.id);
        return;
      }
      if (!mod && e.key === 'Escape') {
        // Esc clears the selection. Defer the store update until this event finishes dispatching:
        // a synchronous store update would make other overlays (e.g. page overview) re-bind listeners mid-dispatch and miss the Esc.
        queueMicrotask(() => useFlowStore.getState().clearSelection());
      } else if (!mod && e.key === 'F1') {
        // F1 opens shortcut help (`?`/`/` are taken by the global tool search, so they are not claimed)
        e.preventDefault();
        setHelpOpen(true);
      } else if (!mod && e.key === 'F2') {
        // F2 renames the selected node: focus the text input in the property panel
        const labelInput = document.querySelector<HTMLInputElement>(
          '[data-testid="flowchart-label-input"]',
        );
        if (labelInput) {
          e.preventDefault();
          labelInput.focus();
          labelInput.select();
        }
      } else if (mod && e.key.toLowerCase() === 'y') {
        // Ctrl/⌘+Y redo (equivalent to Ctrl/⌘+Shift+Z)
        e.preventDefault();
        useFlowStore.getState().redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        // Ctrl/⌘+S saves the draft immediately
        e.preventDefault();
        handleSave();
      } else if (mod && (e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'e')) {
        // Ctrl/⌘+P / Ctrl/⌘+E open the export panel
        e.preventDefault();
        setExportOpen(true);
      } else if (mod && e.key.toLowerCase() === 'x') {
        // Ctrl/⌘+X cuts the selected elements
        e.preventDefault();
        cutSelection();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useFlowStore.getState().redo();
        else useFlowStore.getState().undo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        useFlowStore.getState().duplicateSelected();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
      } else if (mod && e.key.toLowerCase() === 'a') {
        // Select all nodes and edges on the current page
        e.preventDefault();
        useFlowStore.getState().selectAll();
      } else if (mod && e.key.toLowerCase() === 'r') {
        // Ctrl/⌘+R rotates 90° clockwise, with Shift 90° counter-clockwise (matching draw.io's rotate shortcut)
        e.preventDefault();
        rotateSelected(e.shiftKey ? -90 : 90);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        // Ctrl/⌘+Shift+H mirrors horizontally
        e.preventDefault();
        flipSelected('h');
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'j') {
        // Ctrl/⌘+Shift+J mirrors vertically
        e.preventDefault();
        flipSelected('v');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        useFlowStore.getState().removeSelected();
      } else if (!mod && !e.altKey && e.key.startsWith('Arrow')) {
        // Arrow keys nudge the selected nodes (1px by default, ⇧ accelerates to 10px)
        const st = useFlowStore.getState();
        if (st.selectedNodes.length === 0) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        e.preventDefault();
        nudge(dx, dy);
      } else if (!mod && !e.shiftKey && e.key === 'Tab') {
        if (spawnFromSelection('right')) e.preventDefault();
      } else if (!mod && !e.shiftKey && e.key === 'Enter') {
        if (spawnFromSelection('bottom')) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudge, spawnFromSelection, handleSave]);

  /**
   * Paste straight from draw.io: detect mxGraph content on the system clipboard and insert it into the current page.
   *
   * - Only takes over when the canvas is idle (not in an input, no modal overlay), so plain text paste is unaffected;
   * - Reuses the existing `parseDrawioXmlAsync` (supports uncompressed, base64+deflate and URI-encoded content);
   * - Parsing is pure XML data parsing with no script execution; node count is capped.
   */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text || !/mxGraphModel|mxfile|<mxCell/i.test(text)) return;
      e.preventDefault();
      void (async () => {
        const doc = await parseDrawioXmlAsync(text);
        if (!doc) {
          setFailure(t('tools.flowchart.pasteFailed'));
          return;
        }
        const host = canvasRef.current?.getBoundingClientRect();
        const center = host
          ? { x: host.left + host.width / 2, y: host.top + host.height / 2 }
          : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        const point = screenToFlowPosition(center);
        useFlowStore.getState().insertDoc(doc, point);
      })();
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [screenToFlowPosition, t]);

  // Document size estimate: re-serialize only when nodes/edges change, avoiding work on every drag
  const memory = useMemo(() => formatBytes(estimateJsonBytes({ nodes, edges })), [nodes, edges]);

  // Render nothing until the copy is ready (only the current language's small chunk needs to load)
  if (!stringsReady) return null;

  const menus: EditorMenu[] = [
    {
      id: 'file',
      label: t('common.menuFile'),
      entries: [
        editorMenuItem('file-new', t('tools.flowchart.newDoc'), handleNew, { shortcut: '⌘N' }),
        { type: 'separator' },
        editorMenuItem('file-clear', t('common.clear'), handleClear, {
          danger: true,
          disabled: nodes.length === 0 && !docName.trim(),
        }),
      ],
    },
    {
      id: 'edit',
      label: t('common.menuEdit'),
      entries: [
        editorMenuItem(
          'edit-undo',
          t('tools.flowchart.undo'),
          () => useFlowStore.getState().undo(),
          { shortcut: '⌘Z', disabled: !canUndo },
        ),
        editorMenuItem(
          'edit-redo',
          t('tools.flowchart.redo'),
          () => useFlowStore.getState().redo(),
          { shortcut: '⇧⌘Z', disabled: !canRedo },
        ),
        { type: 'separator' },
        editorMenuItem('edit-duplicate', t('tools.flowchart.duplicate'), handleDuplicate, {
          shortcut: '⌘D',
        }),
        editorMenuItem('edit-delete', t('tools.flowchart.delete'), handleDelete, {
          shortcut: 'Del',
          danger: true,
        }),
      ],
    },
    {
      id: 'help',
      label: t('common.menuHelp'),
      entries: [
        editorMenuItem('help-shortcuts', t('tools.flowchart.shortcutHelp'), () =>
          setHelpOpen(true),
        ),
      ],
    },
  ];

  const statusText = draftSaved ? t('tools.flowchart.saved') : t('tools.flowchart.saving');

  return (
    <div className="flex flex-col gap-3" data-tool-root>
      <EditorMenuBar
        menus={menus}
        ariaLabel={t('common.menuBar')}
        actions={
          <>
            <span
              role="status"
              title={statusText}
              aria-label={statusText}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                draftSaved
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <Icon name={draftSaved ? 'check' : 'clock'} className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={nodes.length === 0 && !docName.trim()}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
            <IoMenu
              compact
              busy={busy}
              setBusy={setBusy}
              onError={setFailure}
              open={exportOpen}
              onOpenChange={setExportOpen}
            />
          </>
        }
        center={
          <input
            type="text"
            value={docName}
            aria-label={t('tools.flowchart.docTitle')}
            placeholder={t('tools.flowchart.titlePlaceholder')}
            onChange={(event) => setDocName(event.target.value)}
            className={EDITOR_TITLE_INPUT_CLASS}
          />
        }
        right={
          <>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('tools.flowchart.newDoc')}
              title={t('tools.flowchart.newDoc')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="diagram" className="h-4 w-4" />
            </button>
            <button
              type="button"
              data-testid="flowchart-present"
              onClick={openPresent}
              disabled={nodes.length === 0}
              aria-label={t('tools.flowchart.present')}
              title={t('tools.flowchart.present')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="present" className="h-4 w-4" />
            </button>
          </>
        }
      />

      <Toolbar
        onTemplates={() => setTemplatesOpen(true)}
        onShortcutHelp={() => setHelpOpen(true)}
        onAutoLayout={() => {
          const st = useFlowStore.getState();
          // Two-pass layout: keeps the swimlane / group hierarchy, with direction and spacing taken from the toolbar settings
          st.applyAutoLayout({
            direction: st.layoutDirection,
            ...LAYOUT_DENSITY[st.layoutDensity],
          });
        }}
        onUndo={() => useFlowStore.getState().undo()}
        onRedo={() => useFlowStore.getState().redo()}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* Narrow screens: the two side columns become drawers toggled from the bottom */}
      {isNarrow ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            data-testid="flowchart-drawer-palette"
            aria-expanded={drawer === 'palette'}
            onClick={() => setDrawer(drawer === 'palette' ? null : 'palette')}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              drawer === 'palette'
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300'
            }`}
          >
            {t('tools.flowchart.paletteTitle')}
          </button>
          <button
            type="button"
            data-testid="flowchart-drawer-panel"
            aria-expanded={drawer === 'panel'}
            onClick={() => setDrawer(drawer === 'panel' ? null : 'panel')}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
              drawer === 'panel'
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300'
            }`}
          >
            {t('tools.flowchart.panelTitle')}
          </button>
        </div>
      ) : null}

      {isNarrow && drawer ? (
        <button
          type="button"
          aria-label={t('tools.flowchart.closeDialog')}
          data-testid="flowchart-drawer-backdrop"
          onClick={() => setDrawer(null)}
          className="fixed inset-0 z-30 bg-black/30"
        />
      ) : null}

      <div
        ref={workRowRef}
        className="flex h-[max(360px,calc(100vh-28rem))] gap-3"
        style={workHeight ? { height: workHeight } : undefined}
      >
        <div
          className={
            isNarrow
              ? `fixed inset-y-0 left-0 z-40 w-[280px] overflow-y-auto bg-gray-50 p-2 shadow-2xl transition-transform duration-200 dark:bg-gray-900 ${
                  drawer === 'palette' ? 'translate-x-0' : '-translate-x-full'
                }`
              : 'contents'
          }
        >
          <ShapePalette
            onAddNode={addNodeAtCenter}
            onAddIcon={handleAddIcon}
            onAddImage={() => imageRef.current?.click()}
            onAddFormula={handleAddFormula}
            onAddTable={handleAddTable}
          />
        </div>
        <input
          ref={imageRef}
          data-testid="flowchart-image-input"
          type="file"
          accept="image/*"
          onChange={(e) => void handleImageFile(e)}
          className="hidden"
        />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="relative min-h-0 flex-1">
            <FlowCanvas containerRef={canvasRef} />
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                  {t('tools.flowchart.emptyHint')}
                </p>
                <button
                  type="button"
                  data-testid="flowchart-show-guide"
                  onClick={() => setGuideOpen(true)}
                  className="pointer-events-auto rounded-md border border-blue-200 bg-white/90 px-2.5 py-1 text-[12px] font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-500/40 dark:bg-gray-900/90 dark:text-blue-300 dark:hover:bg-blue-500/10"
                >
                  {t('tools.flowchart.showGuide')}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 px-2 py-1 dark:border-gray-800">
            <button
              type="button"
              data-testid="flowchart-duplicate-page"
              onClick={() => useFlowStore.getState().duplicatePage(activePageId)}
              className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
            >
              {t('tools.flowchart.duplicatePage')}
            </button>
            {pageSize ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {`${pageSize.width} × ${pageSize.height}`}
              </span>
            ) : null}
          </div>
          <PageBrowser
            pages={pageOrder}
            activeId={activePageId}
            labels={{
              add: t('tools.flowchart.addPage'),
              renameHint: t('tools.flowchart.renameHint'),
              moveLeft: t('tools.flowchart.movePageLeft'),
              moveRight: t('tools.flowchart.movePageRight'),
              remove: t('tools.flowchart.removePage'),
              prev: t('tools.flowchart.prevPage'),
              next: t('tools.flowchart.nextPage'),
              openOverview: t('tools.flowchart.openPageOverview'),
              overviewTitle: t('tools.flowchart.pageOverview'),
              close: t('tools.flowchart.closeOverview'),
              empty: t('tools.flowchart.emptyPage'),
              counter: t('tools.flowchart.pageCounter'),
            }}
            thumbnail={(id) => {
              const page = pages.find((item) => item.id === id);
              // An empty page returns null so the overview card shows the "blank page" hint
              const hasContent = page?.nodes.some((node) => !node.hidden) ?? false;
              return page && hasContent ? <PageThumbnail page={page} /> : null;
            }}
            onSelect={(id) => useFlowStore.getState().switchPage(id)}
            onAdd={() => useFlowStore.getState().addPage()}
            onRename={(id, name) => useFlowStore.getState().renamePage(id, name)}
            onRemove={(id) => useFlowStore.getState().removePage(id)}
            onMove={(id, dir) => useFlowStore.getState().movePage(id, dir)}
          />
        </main>

        <aside
          className={`flex shrink-0 flex-col gap-2 overflow-hidden border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40 ${
            isNarrow
              ? `fixed inset-y-0 right-0 z-40 w-[280px] rounded-none transition-transform duration-200 ${
                  drawer === 'panel' ? 'translate-x-0' : 'translate-x-full'
                }`
              : 'w-[248px] rounded-xl'
          }`}
        >
          <div className="flex flex-wrap gap-1">
            {PANELS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                className={`min-w-[46px] flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                  panel === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-blue-50 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-blue-500/10'
                }`}
              >
                {t(`tools.flowchart.${PANEL_LABEL_KEY[key]}`)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === 'prop' ? <PropertyPanel /> : null}
            {panel === 'arrange' ? <ArrangePanel /> : null}
            {panel === 'layer' ? <LayerPanel /> : null}
            {panel === 'history' ? <SnapshotPanel /> : null}
            {panel === 'search' ? <SearchPanel onLocate={locateNode} /> : null}
          </div>
        </aside>
      </div>

      <EditorStatusBar
        left={
          <span>
            {t('tools.flowchart.nodesLabel')}: {nodes.length} · {t('tools.flowchart.edgesLabel')}:{' '}
            {edges.length}
            {selectedCount > 0
              ? ` · ${t('tools.flowchart.selected', { count: selectedCount })}`
              : ''}
          </span>
        }
        right={<span>{t('common.memoryUsage', { size: memory })}</span>}
      />

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {failure}
        </p>
      ) : null}

      {presenting ? (
        <PresentOverlay
          title={docName.trim() || t('tools.flowchart.titlePlaceholder')}
          onClose={() => setPresenting(false)}
          exitLabel={t('tools.flowchart.exitPresent')}
          loadingLabel={t('tools.flowchart.presentLoading')}
          failedLabel={t('tools.flowchart.presentFailed')}
          loading={!presentSrc && !presentFailed}
          failed={presentFailed}
        >
          {presentSrc ? (
            <img
              src={presentSrc}
              alt=""
              data-testid="present-image"
              className="max-h-full max-w-full rounded-lg bg-white shadow-2xl"
            />
          ) : null}
        </PresentOverlay>
      ) : null}

      {helpOpen ? <ShortcutHelpDialog onClose={() => setHelpOpen(false)} /> : null}

      {guideOpen ? <Onboarding onClose={() => setGuideOpen(false)} /> : null}

      <TemplatePanel
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={handleTemplate}
      />
    </div>
  );
}

export default function FlowchartTool() {
  return (
    <ReactFlowProvider>
      <FlowchartInner />
    </ReactFlowProvider>
  );
}
