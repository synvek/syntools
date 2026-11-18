import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext } from 'react-router-dom';
import { i18n } from '@/core/i18n';
import { useUnsavedChanges } from '@/core/hooks/useUnsavedChanges';
import { downloadBytes } from '@/core/pdf/download';
import { PdfPasswordField } from '@/core/pdf/PdfPasswordField';
import { PdfRunButton } from '@/core/pdf/ui';
import {
  applyDraftModel,
  deleteDraft,
  latestDraft,
  putDraft,
  readDraftAttachments,
  readDraftBytes,
  type DraftModel,
  type DraftRecord,
} from './io/draftStore';
import { copyObjects, pasteObjects } from './commands/clipboard';
import { flattenPdf } from './io/savePdf';
import {
  addObject,
  addObjects,
  clampPage,
  createDoc,
  isDirty,
  markSaved,
  removeObjects,
  setCurrentPage,
  setViewMode,
  setZoom,
  setZoomMode,
  updateObject,
  updateObjects,
  visiblePageCount,
  visiblePages,
} from './model/doc';
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  createHistory,
  currentDoc,
  record,
  redo as historyRedo,
  syncPresent,
  undo as historyUndo,
  type History,
} from './model/history';
import {
  createTextObject,
  nextZ,
  reorderZ,
  setObjectLocked,
  setObjectOpacity,
  type ZOrderAction,
} from './model/objects';
import type { NormRect, PdfEditorDoc, PdfPageState, PdfTextObject } from './model/types';
import { OverlayLayer } from './overlay/OverlayLayer';
import { PageScrollView } from './render/PageScrollView';
import { usePdfDocument } from './render/usePdfDocument';
import { buildPdfRibbonTabs } from './ribbonTabs';
import type { PdfPanel, PdfRibbonActions, PdfTool } from './ribbonTabs';
import { registerPdfEditorStrings } from './strings';
import { DraftPrompt } from './ui/DraftPrompt';
import { LeaveGuard } from './ui/LeaveGuard';
import { OutlinePanel } from './ui/OutlinePanel';
import { PdfEditorView } from './ui/PdfEditorView';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { SaveStatus } from './ui/SaveStatus';
import type { SaveState } from './ui/SaveStatus';
import { StatusBar } from './ui/StatusBar';
import { ThumbnailRail } from './ui/ThumbnailRail';

// Tool copy is registered lazily with this chunk, keeping it out of the first-screen language bundle
registerPdfEditorStrings(i18n);

type Panels = Record<PdfPanel, boolean>;

const CLOSED_PANELS: Panels = { thumbnails: false, outline: false, properties: false };

/**
 * Controller: open pipeline, undo/redo, overlay objects, save and keyboard.
 *
 * State ownership:
 * - the open pipeline lives in `usePdfDocument` (bytes, password, pdfjs proxy);
 * - the editable document lives in `History` — `present.doc` is the single rendered truth, so undo
 *   restores page/zoom/content in one step and `markSaved` never enters the undo stack;
 * - selection, panels, tool and canvas theme are UI state and are not part of the draft.
 */
export default function PdfEditorTool() {
  const { t } = useTranslation();
  const pdf = usePdfDocument();

  const [history, setHistory] = useState<History | null>(null);
  const [tool, setTool] = useState<PdfTool>('select');
  const [darkCanvas, setDarkCanvas] = useState(false);
  const [panels, setPanels] = useState<Panels>(CLOSED_PANELS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Drafts (M1-8): last unsaved edits, offered on the empty state instead of restored silently
  const [draft, setDraft] = useState<DraftRecord | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const draftRevRef = useRef<number | undefined>(undefined);
  const draftConflictRef = useRef(false);
  /** Model waiting for its bytes: set when resuming, or when the user re-picks a model-only draft */
  const pendingModelRef = useRef<{ fingerprint: string; model: DraftModel } | null>(null);
  const draftFingerprintRef = useRef<string | null>(null);

  const doc = history ? currentDoc(history) : null;
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  // Latest document for async callbacks (autosave debounce, in-flight draft writes)
  const docRef = useRef<PdfEditorDoc | null>(null);
  docRef.current = doc;

  // Offer the newest draft once, without blocking the first paint
  useEffect(() => {
    let cancelled = false;
    void latestDraft().then((record) => {
      if (!cancelled) setDraft(record);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A new document resets the draft revision chain: `baseRev` only makes sense per fingerprint
  const docFingerprint = doc?.source.fingerprint ?? null;
  useEffect(() => {
    if (docFingerprint === draftFingerprintRef.current) return;
    draftFingerprintRef.current = docFingerprint;
    draftRevRef.current = undefined;
    draftConflictRef.current = false;
  }, [docFingerprint]);

  // Open pipeline → document model. Re-opening the same file keeps the existing model instance.
  useEffect(() => {
    if (pdf.status === 'idle') {
      setHistory(null);
      setSelectedIds([]);
      setEditingId(null);
      setSaveError(null);
      setBanner(null);
      return;
    }
    const source = pdf.source;
    if (pdf.status !== 'ready' || !source) return;
    const name = pdf.name ?? 'document.pdf';

    // A draft is applied exactly once: either resuming from the prompt, or re-picking a file whose
    // draft only kept the model (quota guard). `draft` is cleared so the next open starts clean.
    const pending = pendingModelRef.current;
    const modelOnly =
      draft && !draft.sourceBytes && draft.fingerprint === source.fingerprint ? draft : null;
    const restoredModel =
      pending?.fingerprint === source.fingerprint
        ? pending.model
        : modelOnly
          ? modelOnly.model
          : null;
    if (restoredModel) {
      pendingModelRef.current = null;
      setDraft(null);
      setBanner(t('tools.pdfEditor.draftRestored'));
      void deleteDraft(source.fingerprint);
    }

    setHistory((previous) => {
      const current = previous ? currentDoc(previous) : null;
      if (current && current.source.fingerprint === source.fingerprint) {
        // Same document (re-open / unlock): refresh bytes and password, keep edits
        return syncPresent(previous as History, { ...current, source });
      }
      return createHistory(
        restoredModel
          ? applyDraftModel(
              restoredModel,
              source,
              draft && draft.fingerprint === source.fingerprint ? readDraftAttachments(draft) : [],
            )
          : createDoc({ name, source }),
      );
    });
    setSaveError(null);
  }, [pdf.status, pdf.source, pdf.name, draft, t]);

  /* ---------------------------------------------------------------------- */
  /* Draft autosave                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!doc || saving || !isDirty(doc)) return;
    // Encrypted files cannot be reopened without the in-memory password, so they are not drafted
    if (doc.source.encrypted || draftConflictRef.current) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        const latest = docRef.current;
        // Saved or closed while the debounce was pending: nothing to draft
        if (!latest || !isDirty(latest) || savingRef.current) return;

        const result = await putDraft(latest, {
          baseRev: draftRevRef.current,
          bytes: latest.source.bytes,
        });
        if (!result.ok) {
          if (result.error === 'CONFLICT') {
            // Another tab wrote after us; stop retrying so we never clobber it
            draftConflictRef.current = true;
            setBanner(t('tools.pdfEditor.draftConflict'));
          }
          return;
        }

        draftRevRef.current = result.value.rev;
        const current = docRef.current;
        if (
          !current ||
          !isDirty(current) ||
          current.source.fingerprint !== latest.source.fingerprint
        ) {
          // The save landed while this write was in flight; do not resurrect the draft
          void deleteDraft(latest.source.fingerprint);
          return;
        }
        if (result.value.modelOnly) setBanner(t('tools.pdfEditor.draftModelOnly'));
      })();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [doc, saving, t]);

  /* ---------------------------------------------------------------------- */
  /* History-aware mutations                                                 */
  /* ---------------------------------------------------------------------- */

  const mutate = useCallback(
    (
      reducer: (current: PdfEditorDoc) => PdfEditorDoc,
      options: { label: string; mergeKey?: string; view?: boolean },
    ) => {
      setHistory((previous) => {
        if (!previous) return previous;
        const current = currentDoc(previous);
        const next = reducer(current);
        if (next === current) return previous;
        return options.view
          ? syncPresent(previous, next)
          : record(previous, next, { label: options.label, mergeKey: options.mergeKey });
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setEditingId(null);
    setHistory((previous) => (previous ? historyUndo(previous) : previous));
  }, []);

  const redo = useCallback(() => {
    setEditingId(null);
    setHistory((previous) => (previous ? historyRedo(previous) : previous));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Objects                                                                 */
  /* ---------------------------------------------------------------------- */

  const handleCreateObject = useCallback(
    (pageId: string, rect: NormRect): string => {
      // Built outside the updater: React may run the updater later, but the overlay needs the id
      // synchronously to enter edit mode.
      const object = createTextObject({
        page: pageId,
        rect,
        text: '',
        z: nextZ(doc?.objects ?? []),
      });
      mutate((current) => addObject(current, object), { label: 'add-text' });
      setSelectedIds([object.id]);
      return object.id;
    },
    [doc?.objects, mutate],
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => {
      mutate(
        (current) =>
          updateObject(current, id, (object) =>
            object.kind === 'text' ? { ...object, text } : object,
          ),
        { label: 'edit-text', mergeKey: `text:${id}` },
      );
    },
    [mutate],
  );

  /** Empty boxes are discarded, and an edit session always ends without a stray caret */
  const handleEndEdit = useCallback(() => {
    const id = editingId;
    setEditingId(null);
    if (!id || !doc) return;

    const object = doc.objects.find((candidate) => candidate.id === id);
    if (object?.kind === 'text' && !object.text.trim()) {
      mutate((current) => removeObjects(current, new Set([id])), { label: 'discard-empty-text' });
      setSelectedIds([]);
    }
  }, [doc, editingId, mutate]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    setEditingId(null);
    setSelectedIds([]);
    mutate((current) => removeObjects(current, ids), { label: 'delete-object' });
  }, [mutate, selectedIds]);

  const handleMoveObjects = useCallback(
    (updates: Array<{ id: string; rect: NormRect }>) => {
      if (updates.length === 0) return;
      const rects = new Map(updates.map((update) => [update.id, update.rect]));
      mutate(
        (current) =>
          updateObjects(current, new Set(rects.keys()), (object) => {
            const rect = rects.get(object.id);
            return rect ? { ...object, rect } : object;
          }),
        { label: 'move-object', mergeKey: 'move-objects' },
      );
    },
    [mutate],
  );

  const handleResizeObject = useCallback(
    (id: string, rect: NormRect) => {
      mutate((current) => updateObject(current, id, (object) => ({ ...object, rect })), {
        label: 'resize-object',
        mergeKey: `resize:${id}`,
      });
    },
    [mutate],
  );

  const handleRotateObject = useCallback(
    (id: string, rotation: number) => {
      mutate((current) => updateObject(current, id, (object) => ({ ...object, rotation })), {
        label: 'rotate-object',
        mergeKey: `rotate:${id}`,
      });
    },
    [mutate],
  );

  const updateSelected = useCallback(
    (patch: Partial<PdfTextObject>) => {
      if (!selectedId) return;
      mutate(
        (current) =>
          updateObject(current, selectedId, (object) =>
            object.kind === 'text' ? { ...object, ...patch } : object,
          ),
        { label: 'style-object' },
      );
    },
    [mutate, selectedId],
  );

  const setSelectedOpacity = useCallback(
    (value: number) => {
      if (!selectedId) return;
      mutate(
        (current) => ({
          ...current,
          objects: setObjectOpacity(current.objects, selectedId, value),
        }),
        { label: 'opacity-object' },
      );
    },
    [mutate, selectedId],
  );

  const toggleSelectedLock = useCallback(() => {
    if (!selectedId || !doc) return;
    const object = doc.objects.find((candidate) => candidate.id === selectedId);
    if (!object) return;
    mutate(
      (current) => ({
        ...current,
        objects: setObjectLocked(current.objects, selectedId, !object.locked),
      }),
      { label: 'lock-object' },
    );
  }, [doc, mutate, selectedId]);

  const changeSelectedZ = useCallback(
    (action: ZOrderAction) => {
      if (!selectedId) return;
      mutate(
        (current) => {
          const objects = reorderZ(current.objects, selectedId, action);
          return objects === current.objects ? current : { ...current, objects };
        },
        { label: 'z-order' },
      );
    },
    [mutate, selectedId],
  );

  const currentPageId = useCallback((): string | null => {
    if (!doc) return null;
    return visiblePages(doc)[doc.view.page - 1]?.id ?? null;
  }, [doc]);

  const copySelection = useCallback(() => {
    if (!doc || selectedIds.length === 0) return;
    copyObjects(doc.objects.filter((object) => selectedIds.includes(object.id)));
  }, [doc, selectedIds]);

  const pasteSelection = useCallback(() => {
    if (!doc) return;
    const anchorPage =
      doc.objects.find((object) => selectedIds.includes(object.id))?.page ?? currentPageId();
    if (!anchorPage) return;
    const pasted = pasteObjects({ objects: doc.objects, pageId: anchorPage });
    if (pasted.length === 0) return;
    mutate((current) => addObjects(current, pasted), { label: 'paste' });
    setSelectedIds(pasted.map((object) => object.id));
  }, [currentPageId, doc, mutate, selectedIds]);

  const cutSelection = useCallback(() => {
    if (selectedIds.length === 0) return;
    copySelection();
    deleteSelected();
  }, [copySelection, deleteSelected, selectedIds]);

  const selectAllObjects = useCallback(() => {
    if (!doc) return;
    const pageId = currentPageId();
    const ids = doc.objects
      .filter((object) => !pageId || object.page === pageId)
      .map((object) => object.id);
    setSelectedIds(ids);
    setEditingId(null);
  }, [currentPageId, doc]);

  /** Arrow keys: 0.1% or 1% (Shift) of the page, one history entry per press */
  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;
      const ids = new Set(selectedIds);
      mutate(
        (current) =>
          updateObjects(current, ids, (object) => {
            if (object.locked) return object;
            return {
              ...object,
              rect: { ...object.rect, x: object.rect.x + dx, y: object.rect.y + dy },
            };
          }),
        { label: 'nudge', mergeKey: 'nudge' },
      );
    },
    [mutate, selectedIds],
  );

  /* ---------------------------------------------------------------------- */
  /* Saving                                                                  */
  /* ---------------------------------------------------------------------- */

  const save = useCallback(async () => {
    if (!doc || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setBanner(null);

    try {
      const result = await flattenPdf(doc);
      if (!result.ok) {
        setSaveError(t(`tools.pdfEditor.err.${result.error}`));
        return;
      }
      downloadBytes(result.value.bytes, result.value.filename, 'application/pdf');
      setHistory((previous) =>
        previous ? syncPresent(previous, markSaved(currentDoc(previous))) : previous,
      );
      // The edits now live in the downloaded file, so the draft has served its purpose
      void deleteDraft(doc.source.fingerprint);
      draftRevRef.current = undefined;
      setDraft(null);
      if (result.value.rasterized) setBanner(t('tools.pdfEditor.textRasterNote'));
    } catch {
      setSaveError(t('tools.pdfEditor.err.PROCESS_FAILED'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [doc, t]);

  /* ---------------------------------------------------------------------- */
  /* Ribbon commands                                                         */
  /* ---------------------------------------------------------------------- */

  const actions: PdfRibbonActions = useMemo(
    () => ({
      undo,
      redo,
      setTool,
      setZoom: (zoom) =>
        mutate((current) => setZoomMode(setZoom(current, zoom), 'custom'), {
          label: 'zoom',
          view: true,
        }),
      fit: (mode) => mutate((current) => setZoomMode(current, mode), { label: 'fit', view: true }),
      goToPage: (page) =>
        mutate((current) => setCurrentPage(current, page), {
          label: 'go-to-page',
          view: true,
        }),
      prevPage: () =>
        mutate((current) => setCurrentPage(current, current.view.page - 1), {
          label: 'prev-page',
          view: true,
        }),
      nextPage: () =>
        mutate((current) => setCurrentPage(current, current.view.page + 1), {
          label: 'next-page',
          view: true,
        }),
      setViewMode: (mode) =>
        mutate((current) => setViewMode(current, mode), {
          label: 'view-mode',
          view: true,
        }),
      togglePanel: (panel) => setPanels((current) => ({ ...current, [panel]: !current[panel] })),
      toggleDarkCanvas: () => setDarkCanvas((value) => !value),
    }),
    [mutate, redo, undo],
  );

  const tabs = useMemo(
    () =>
      buildPdfRibbonTabs({
        t,
        hasDoc: doc !== null,
        view: {
          mode: doc?.view.mode ?? 'continuous',
          zoom: doc?.view.zoom ?? 1,
          zoomMode: doc?.view.zoomMode ?? 'fit-width',
          page: doc?.view.page ?? 1,
          pageCount: doc ? visiblePageCount(doc) : 0,
        },
        history: {
          canUndo: history ? historyCanUndo(history) : false,
          canRedo: history ? historyCanRedo(history) : false,
        },
        panels,
        panelsAvailable: true,
        darkCanvas,
        tool,
        actions,
      }),
    [t, doc, history, panels, darkCanvas, tool, actions],
  );

  const pages = useMemo(() => (doc ? visiblePages(doc) : []), [doc]);

  /* ---------------------------------------------------------------------- */
  /* Viewport callbacks                                                      */
  /* ---------------------------------------------------------------------- */

  const { openFile, openBytes } = pdf;
  const handleFile = useCallback(
    (file: File) => {
      void openFile(file);
    },
    [openFile],
  );

  /* ---------------------------------------------------------------------- */
  /* Draft restore                                                           */
  /* ---------------------------------------------------------------------- */

  const resumeDraft = useCallback(async () => {
    if (!draft) return;
    const bytes = readDraftBytes(draft);
    if (!bytes) {
      setBanner(t('tools.pdfEditor.draftNoSource'));
      return;
    }
    setDraftBusy(true);
    draftRevRef.current = draft.rev;
    pendingModelRef.current = { fingerprint: draft.fingerprint, model: draft.model };
    const opened = await openBytes(draft.name, bytes, draft.fingerprint);
    setDraftBusy(false);
    if (!opened) pendingModelRef.current = null;
  }, [draft, openBytes, t]);

  const discardDraft = useCallback(() => {
    if (!draft) return;
    pendingModelRef.current = null;
    setDraft(null);
    void deleteDraft(draft.fingerprint);
  }, [draft]);

  // Fit modes: the viewport reports what "fit" resolved to, so the ribbon shows the real percentage
  const handleResolvedScale = useCallback(
    (scale: number) => mutate((current) => setZoom(current, scale), { label: 'scale', view: true }),
    [mutate],
  );

  const handlePageChange = useCallback(
    (page: number) =>
      mutate((current) => setCurrentPage(current, page), {
        label: 'scroll-page',
        view: true,
      }),
    [mutate],
  );

  const handleZoomBy = useCallback(
    (factor: number) => {
      mutate((current) => setZoomMode(setZoom(current, current.view.zoom * factor), 'custom'), {
        label: 'zoom',
        view: true,
      });
    },
    [mutate],
  );

  const stepPage = useCallback(
    (delta: number) => {
      mutate((current) => setCurrentPage(current, current.view.page + delta), {
        label: 'step-page',
        view: true,
      });
    },
    [mutate],
  );

  const jumpToEdge = useCallback(
    (edge: 'start' | 'end') => {
      mutate(
        (current) => setCurrentPage(current, edge === 'start' ? 1 : visiblePageCount(current)),
        { label: 'jump-page', view: true },
      );
    },
    [mutate],
  );

  const selectPage = useCallback(
    (page: number) => {
      mutate((current) => setCurrentPage(current, clampPage(current, page)), {
        label: 'select-page',
        view: true,
      });
    },
    [mutate],
  );

  /* ---------------------------------------------------------------------- */
  /* Keyboard                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable === true);
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // ⌘/Ctrl+S is intercepted even inside fields: the browser save dialog must never win
      if (mod && key === 's') {
        event.preventDefault();
        void save();
        return;
      }

      if (inField) return;
      if (!doc) return;

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === 'a') {
        event.preventDefault();
        selectAllObjects();
        return;
      }
      if (mod && key === 'c') {
        copySelection();
        return;
      }
      if (mod && key === 'x') {
        event.preventDefault();
        cutSelection();
        return;
      }
      if (mod && key === 'v') {
        event.preventDefault();
        pasteSelection();
        return;
      }
      if (mod && (key === ']' || key === '[')) {
        event.preventDefault();
        changeSelectedZ(key === ']' ? 'front' : 'back');
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length === 0) return;
        event.preventDefault();
        deleteSelected();
        return;
      }
      if (event.key.startsWith('Arrow') && selectedIds.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 0.01 : 0.001;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }
      if (event.key === 'PageDown') {
        event.preventDefault();
        stepPage(1);
        return;
      }
      if (event.key === 'PageUp') {
        event.preventDefault();
        stepPage(-1);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        jumpToEdge('start');
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        jumpToEdge('end');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    changeSelectedZ,
    copySelection,
    cutSelection,
    deleteSelected,
    doc,
    jumpToEdge,
    nudgeSelection,
    pasteSelection,
    redo,
    save,
    selectAllObjects,
    selectedIds.length,
    stepPage,
    undo,
  ]);

  const dirty = doc ? isDirty(doc) : false;
  useUnsavedChanges(dirty, t('tools.pdfEditor.unsavedMessage'));
  // `useBlocker` throws outside a data router; the guard is only mounted where that exists
  const inRouter = useInRouterContext();

  /* ---------------------------------------------------------------------- */
  /* Rendering                                                               */
  /* ---------------------------------------------------------------------- */

  const selectedObject =
    selectedId !== null ? (doc?.objects.find((object) => object.id === selectedId) ?? null) : null;

  const passwordBlock = pdf.needsPassword ? (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2 pb-6">
      <PdfPasswordField
        value={pdf.password}
        onChange={pdf.setPassword}
        error={pdf.error}
        autoFocus
      />
      <PdfRunButton
        label={pdf.busy ? t('common.loading') : t('pdf.unlock')}
        disabled={!pdf.password.trim() || pdf.busy}
        onClick={() => void pdf.unlock()}
      />
    </div>
  ) : null;

  const renderOverlay = (page: PdfPageState, scale: number) => (
    <OverlayLayer
      objects={doc?.objects ?? []}
      page={page.id}
      scale={scale}
      selectedIds={selectedIds}
      editingId={editingId}
      onSelect={(ids) => {
        setSelectedIds(ids);
        if (editingId && !ids.includes(editingId)) setEditingId(null);
      }}
      onStartEdit={(id) => {
        setSelectedIds([id]);
        setEditingId(id);
      }}
      onEndEdit={handleEndEdit}
      onCreate={(rect) => handleCreateObject(page.id, rect)}
      onTextChange={handleTextChange}
      onMove={handleMoveObjects}
      onResize={handleResizeObject}
      onRotate={handleRotateObject}
    />
  );

  const pageArea =
    doc && pdf.pdfDoc ? (
      <PageScrollView
        pdfDoc={pdf.pdfDoc}
        pages={pages}
        view={doc.view}
        tool={tool}
        darkCanvas={darkCanvas}
        onResolvedScale={handleResolvedScale}
        onPageChange={handlePageChange}
        overlay={renderOverlay}
        onZoomBy={handleZoomBy}
      />
    ) : null;

  const showThumbnails = doc !== null && panels.thumbnails && pdf.pdfDoc !== null;
  const showOutline = doc !== null && panels.outline && pdf.pdfDoc !== null;

  const leftPanel =
    showThumbnails || showOutline ? (
      <div className="flex min-h-0 gap-3">
        {showThumbnails && pdf.pdfDoc ? (
          <ThumbnailRail
            pdfDoc={pdf.pdfDoc}
            pages={pages}
            currentPage={doc?.view.page ?? 1}
            onSelect={selectPage}
          />
        ) : null}
        {showOutline && pdf.pdfDoc ? (
          <OutlinePanel pdfDoc={pdf.pdfDoc} onSelect={selectPage} />
        ) : null}
      </div>
    ) : undefined;

  const rightPanel =
    doc && panels.properties ? (
      <PropertiesPanel
        object={selectedObject}
        onChangeText={updateSelected}
        onOpacityChange={setSelectedOpacity}
        onToggleLock={toggleSelectedLock}
        onZOrder={changeSelectedZ}
        onDelete={deleteSelected}
      />
    ) : undefined;

  const saveState: SaveState = !doc
    ? 'none'
    : saving
      ? 'saving'
      : saveError
        ? 'failed'
        : dirty
          ? 'dirty'
          : 'saved';

  const headerRight = doc ? <SaveStatus state={saveState} name={doc.name} /> : null;

  const errorMessage =
    saveError ?? (pdf.error && !pdf.needsPassword ? t(`tools.pdfEditor.err.${pdf.error}`) : null);

  return (
    <>
      {inRouter ? <LeaveGuard dirty={dirty} /> : null}
      <PdfEditorView
        doc={doc}
        tabs={tabs}
        onFile={handleFile}
        emptyExtra={passwordBlock}
        draftPrompt={
          !doc && pdf.status === 'idle' && draft ? (
            <DraftPrompt
              draft={draft}
              resumable={draft.sourceBytes !== null}
              busy={draftBusy}
              onResume={() => void resumeDraft()}
              onDiscard={discardDraft}
            />
          ) : undefined
        }
        pageArea={pageArea}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        error={pdf.error && !pdf.needsPassword ? t(`tools.pdfEditor.err.${pdf.error}`) : null}
        banner={doc ? (errorMessage ?? banner) : null}
        note={pdf.busy ? t('common.loading') : null}
        headerRight={headerRight}
        statusBar={<StatusBar doc={doc} pdfDoc={pdf.pdfDoc} />}
      />
    </>
  );
}
