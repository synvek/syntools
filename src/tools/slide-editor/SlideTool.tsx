import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@/core/components/ProgressBar';
import { HintTip } from '@/core/components/DocumentHeader';
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
import { translateToolError } from '@/core/i18n/helpers';
import { downloadBytes, downloadDataUrl } from '@/core/pdf/download';
import { buildExportFilename } from './core';
import { clearDraft, readDraft, writeDraft } from './draft';
import { disposeRaster, exportSlidesToPdf, renderSlideToDataUrl } from './io/raster';
import { buildDeck, parseOutline } from './io/outline';
import { openProject, saveProject } from './io/project';
import { attachKeyboard } from './interaction/keyboard';
import { disposeThumbnails } from './render/thumbnail';
import { createMediaFromFile, revokeAllMediaUrls } from './model/media';
import {
  SHAPE_PRESETS,
  createDoc,
  createImageElement,
  createLineElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from './model/factory';
import { checkImportFile, importPptxFile } from './pptx/import';
import { exportPptx } from './pptx/export';
import { registerSlideStrings } from './strings';
import { containerElements, useSlideStore } from './store';
import { FindReplaceBar } from './ui/FindReplaceBar';
import { LayerPanel } from './ui/LayerPanel';
import { MasterView } from './ui/MasterView';
import { PresentOverlay } from './ui/PresentOverlay';
import { PropertyPanel } from './ui/PropertyPanel';
import { SlideCanvas } from './ui/SlideCanvas';
import { SlideToolbar } from './ui/SlideToolbar';
import { TemplateGallery } from './ui/TemplateGallery';
import { ThemePanel } from './ui/ThemePanel';
import { ThumbnailRail } from './ui/ThumbnailRail';
import './slide.css';

// Tool copy is registered lazily with this chunk, keeping it out of the first-screen language bundle
registerSlideStrings(i18n);

type BusyKind = 'import' | 'export' | null;
type Failure = { error: string; params?: Record<string, string | number> };

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DRAFT_DEBOUNCE_MS = 1200;

/**
 * Slide editor: Konva canvas + browser-local pptx import/export.
 * All Konva / DOM side effects stay inside lazily loaded modules, so prerender SSR never triggers them.
 */
export default function SlideTool() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const report = useSlideStore((s) => s.report);
  const viewMode = useSlideStore((s) => s.viewMode);
  const setViewMode = useSlideStore((s) => s.setViewMode);
  const loadDoc = useSlideStore((s) => s.loadDoc);
  const selectSlide = useSlideStore((s) => s.selectSlide);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const removeSelected = useSlideStore((s) => s.removeSelected);
  const duplicateSelected = useSlideStore((s) => s.duplicateSelected);
  const select = useSlideStore((s) => s.select);
  const setDocName = useSlideStore((s) => s.setDocName);
  const copySelected = useSlideStore((s) => s.copySelected);
  const cutSelected = useSlideStore((s) => s.cutSelected);
  const pasteClipboard = useSlideStore((s) => s.pasteClipboard);
  const groupSelected = useSlideStore((s) => s.groupSelected);
  const ungroupSelected = useSlideStore((s) => s.ungroupSelected);
  // Menu-only actions/state (the toolbar owns its own copies of most of these)
  const addElement = useSlideStore((s) => s.addElement);
  const addSlide = useSlideStore((s) => s.addSlide);
  const duplicateSlide = useSlideStore((s) => s.duplicateSlide);
  const removeSlide = useSlideStore((s) => s.removeSlide);
  const canUndo = useSlideStore((s) => s.past.length > 0);
  const canRedo = useSlideStore((s) => s.future.length > 0);
  const gridSnap = useSlideStore((s) => s.gridSnap);
  const showRulers = useSlideStore((s) => s.showRulers);
  const toggleGridSnap = useSlideStore((s) => s.toggleGridSnap);
  const toggleRulers = useSlideStore((s) => s.toggleRulers);
  const scale = useSlideStore((s) => s.viewport.scale);
  const setScale = useSlideStore((s) => s.setScale);
  const setViewport = useSlideStore((s) => s.setViewport);
  const setInsertPanel = useSlideStore((s) => s.setInsertPanel);
  const formatPainter = useSlideStore((s) => s.formatPainter);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState<BusyKind>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [rightTab, setRightTab] = useState<'element' | 'layers' | 'theme' | 'template'>('element');
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [outlineText, setOutlineText] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);
  /** Workspace height (thumbnail rail + canvas + right panel) = the space left below the first screen */
  const workRowRef = useRef<HTMLDivElement | null>(null);
  const workHeight = useViewportFill(workRowRef, { min: 360, signature: viewMode });

  const fail = useCallback((error: string, params?: Record<string, string | number>) => {
    setFailure({ error, params });
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      setFailure(null);
      const check = checkImportFile(file);
      if (!check.ok) {
        setFailure(check as Failure);
        return;
      }
      setBusy('import');
      const result = await importPptxFile(file);
      setBusy(null);
      if (!result.ok) {
        setFailure(result as Failure);
        return;
      }
      loadDoc(result.value.doc, result.value.report);
    },
    [loadDoc],
  );

  const handleExport = useCallback(async () => {
    setFailure(null);
    setBusy('export');
    const result = await exportPptx(useSlideStore.getState().doc);
    setBusy(null);
    if (!result.ok) {
      setFailure(result as Failure);
      return;
    }
    downloadBytes(
      result.value,
      buildExportFilename(useSlideStore.getState().doc.name || 'presentation', 'pptx'),
      PPTX_MIME,
    );
  }, []);

  /** Export PDF: rasterize each slide then combine, reusing core/pdf's imagesToPdf */
  const handleExportPdf = useCallback(async () => {
    setFailure(null);
    setBusy('export');
    const state = useSlideStore.getState();
    const result = await exportSlidesToPdf(state.doc);
    setBusy(null);
    if (!result.ok) {
      setFailure(result as Failure);
      return;
    }
    downloadBytes(
      result.value,
      buildExportFilename(state.doc.name || 'presentation', 'pdf'),
      'application/pdf',
    );
  }, []);

  /** Export the current slide as PNG (2× resolution or more) */
  const handleExportPng = useCallback(() => {
    setFailure(null);
    const state = useSlideStore.getState();
    const slide = state.doc.slides[state.slideIndex];
    if (!slide) return;
    const dataUrl = renderSlideToDataUrl(state.doc, slide);
    if (!dataUrl) {
      setFailure({ error: 'RENDER_FAILED' });
      return;
    }
    downloadDataUrl(
      dataUrl,
      buildExportFilename(`${state.doc.name || 'presentation'}-${state.slideIndex + 1}`, 'png'),
    );
  }, []);

  /** Open a .sld project file: lossless restore (raw image bytes included) */
  const handleOpenProject = useCallback(
    async (file: File) => {
      setFailure(null);
      setBusy('import');
      const result = await openProject(file);
      setBusy(null);
      if (!result.ok) {
        setFailure(result as Failure);
        return;
      }
      loadDoc(result.value, null);
    },
    [loadDoc],
  );

  /** Save as a .sld project file (image bytes packed in, bypassing OOXML fidelity loss) */
  const handleSaveProject = useCallback(async () => {
    setFailure(null);
    setBusy('export');
    const state = useSlideStore.getState();
    const result = await saveProject(state.doc);
    setBusy(null);
    if (!result.ok) {
      setFailure(result as Failure);
      return;
    }
    downloadBytes(
      result.value,
      buildExportFilename(state.doc.name || 'presentation', 'sld'),
      'application/zip',
    );
  }, []);

  /** Outline → slides: parse, then replace the current slide set wholesale */
  const handleOutlineGenerate = useCallback(() => {
    const state = useSlideStore.getState();
    const slides = buildDeck(state.doc, parseOutline(outlineText), state.doc.layouts[0]?.id);
    if (slides.length === 0) {
      setFailure({ error: 'EMPTY' });
      return;
    }
    setFailure(null);
    state.replaceSlides(slides);
    setOutlineOpen(false);
    setOutlineText('');
  }, [outlineText]);

  const handleNew = useCallback(() => {
    if (
      useSlideStore.getState().doc.slides.length > 0 &&
      !window.confirm(t('common.discardConfirm'))
    ) {
      return;
    }
    loadDoc(createDoc(''), null);
    clearDraft();
    setDraftSaved(false);
  }, [loadDoc, t]);

  const handleClear = useCallback(() => {
    loadDoc(createDoc(''), null);
    clearDraft();
    setDraftSaved(false);
  }, [loadDoc]);

  // Restore the local draft on first mount
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.doc.slides.length > 0) loadDoc(draft.doc, null);
    return () => {
      revokeAllMediaUrls();
      disposeThumbnails();
      disposeRaster();
    };
  }, [loadDoc]);

  // Debounced draft write after document changes
  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setDraftSaved(writeDraft(useSlideStore.getState().doc));
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [doc]);

  useEffect(
    () =>
      attachKeyboard({
        onDelete: () => removeSelected(),
        onUndo: () => undo(),
        onRedo: () => redo(),
        onDuplicate: () => duplicateSelected(),
        onNudge: (dx, dy) => moveBy(dx, dy),
        onSelectAll: () => select(containerElements(useSlideStore.getState()).map((el) => el.id)),
        onEscape: () => select([]),
        onCopy: () => copySelected(),
        onCut: () => cutSelected(),
        onPaste: () => pasteClipboard(),
        onGroup: () => groupSelected(),
        onUngroup: () => ungroupSelected(),
        onPrevSlide: () => selectSlide(useSlideStore.getState().slideIndex - 1),
        onNextSlide: () => selectSlide(useSlideStore.getState().slideIndex + 1),
        onPresent: () => setPresenting(true),
        onFind: () => setFindOpen(true),
        onCopyFormat: () => useSlideStore.getState().copyFormat(),
        onPasteFormat: () => useSlideStore.getState().applyFormat(),
        onToggleMaster: () =>
          setViewMode(useSlideStore.getState().viewMode === 'master' ? 'normal' : 'master'),
      }),
    [
      copySelected,
      cutSelected,
      duplicateSelected,
      groupSelected,
      pasteClipboard,
      redo,
      removeSelected,
      select,
      selectSlide,
      setViewMode,
      undo,
      ungroupSelected,
    ],
  );

  /** Menu image insert: same decode + media registration path as the toolbar picker */
  const handleInsertImage = useCallback(
    async (file: File) => {
      const result = await createMediaFromFile(file);
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const asset = result.value;
      useSlideStore.setState((state) => ({
        doc: {
          ...state.doc,
          media: { ...state.doc.media, [asset.id]: asset },
          version: state.doc.version + 1,
        },
      }));
      addElement(createImageElement(useSlideStore.getState().doc, asset));
    },
    [addElement, fail],
  );

  const hasSelection = selection.length > 0;
  const hasElements = (doc.slides[slideIndex]?.elements.length ?? 0) > 0;
  const selectedElements = (doc.slides[slideIndex]?.elements ?? []).filter((el) =>
    selection.includes(el.id),
  );
  const allLocked = selectedElements.length > 0 && selectedElements.every((el) => el.locked);
  const allHidden =
    selectedElements.length > 0 && selectedElements.every((el) => el.visible === false);

  const menus: EditorMenu[] = [
    {
      id: 'file',
      label: t('common.menuFile'),
      entries: [
        editorMenuItem('file-new', t('tools.slide.newDoc'), handleNew, { shortcut: '⌘N' }),
        editorMenuItem('file-import-pptx', t('tools.slide.importPptx'), () =>
          importInputRef.current?.click(),
        ),
        editorMenuItem('file-import-project', t('tools.slide.openProject'), () =>
          projectInputRef.current?.click(),
        ),
        editorMenuItem('file-import-outline', t('tools.slide.outlineImport'), () =>
          setOutlineOpen(true),
        ),
        { type: 'separator' },
        editorMenuItem('file-export-pptx', t('tools.slide.exportPptx'), () => void handleExport()),
        editorMenuItem('file-export-pdf', t('tools.slide.exportPdf'), () => void handleExportPdf()),
        editorMenuItem('file-export-image', t('tools.slide.exportImage'), () => handleExportPng()),
        editorMenuItem(
          'file-export-project',
          t('tools.slide.saveProject'),
          () => void handleSaveProject(),
        ),
        { type: 'separator' },
        editorMenuItem('file-clear', t('common.clear'), handleClear, {
          danger: true,
          disabled: doc.slides.length === 0 && !doc.name.trim(),
        }),
      ],
    },
    {
      id: 'edit',
      label: t('common.menuEdit'),
      entries: [
        editorMenuItem('edit-undo', t('tools.slide.undo'), undo, {
          shortcut: '⌘Z',
          disabled: !canUndo,
        }),
        editorMenuItem('edit-redo', t('tools.slide.redo'), redo, {
          shortcut: '⇧⌘Z',
          disabled: !canRedo,
        }),
        { type: 'separator' },
        editorMenuItem('edit-cut', t('tools.slide.cut'), cutSelected, {
          shortcut: '⌘X',
          disabled: !hasSelection,
        }),
        editorMenuItem('edit-copy', t('tools.slide.copy'), copySelected, {
          shortcut: '⌘C',
          disabled: !hasSelection,
        }),
        editorMenuItem('edit-paste', t('tools.slide.paste'), pasteClipboard, { shortcut: '⌘V' }),
        editorMenuItem('edit-duplicate', t('tools.slide.duplicateElement'), duplicateSelected, {
          shortcut: '⌘D',
          disabled: !hasSelection,
        }),
        editorMenuItem('edit-delete', t('tools.slide.deleteElement'), removeSelected, {
          shortcut: 'Del',
          danger: true,
          disabled: !hasSelection,
        }),
        { type: 'separator' },
        editorMenuItem(
          'edit-select-all',
          t('tools.slide.selectAll'),
          () => select(containerElements(useSlideStore.getState()).map((el) => el.id)),
          { shortcut: '⌘A', disabled: !hasElements },
        ),
        editorMenuItem('edit-find', t('tools.slide.findReplace'), () => setFindOpen(true), {
          shortcut: '⌘F',
        }),
        { type: 'separator' },
        editorMenuItem(
          'edit-copy-format',
          t('tools.slide.copyFormat'),
          () => useSlideStore.getState().copyFormat(),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'edit-apply-format',
          t('tools.slide.applyFormat'),
          () => useSlideStore.getState().applyFormat(),
          { disabled: formatPainter === null || !hasSelection },
        ),
      ],
    },
    {
      id: 'insert',
      label: t('common.menuInsert'),
      entries: [
        editorMenuItem('insert-text', t('tools.slide.insertText'), () =>
          addElement(createTextElement(useSlideStore.getState().doc, t('tools.slide.insertText'))),
        ),
        editorMenuItem('insert-image', t('tools.slide.insertImage'), () =>
          imageInputRef.current?.click(),
        ),
        editorMenuItem('insert-line', t('tools.slide.insertLine'), () =>
          addElement(createLineElement(useSlideStore.getState().doc)),
        ),
        editorMenuItem('insert-table', t('tools.slide.insertTable'), () =>
          addElement(createTableElement(useSlideStore.getState().doc)),
        ),
        { type: 'separator' },
        ...SHAPE_PRESETS.map((preset) =>
          editorMenuItem(`insert-${preset.key}`, t(`tools.slide.${preset.key}`), () =>
            addElement(createShapeElement(useSlideStore.getState().doc, preset.geom)),
          ),
        ),
        { type: 'separator' },
        editorMenuItem('insert-chart', t('tools.slide.insertChart'), () => setInsertPanel('chart')),
        editorMenuItem('insert-formula', t('tools.slide.insertFormula'), () =>
          setInsertPanel('formula'),
        ),
        editorMenuItem('insert-icon', t('tools.slide.insertIcon'), () => setInsertPanel('icon')),
        editorMenuItem('insert-shape-lib', t('tools.slide.insertShapeLib'), () =>
          setInsertPanel('shape'),
        ),
        { type: 'separator' },
        editorMenuItem('insert-slide', t('tools.slide.addSlide'), addSlide),
        editorMenuItem('insert-slide-copy', t('tools.slide.duplicate'), () =>
          duplicateSlide(useSlideStore.getState().slideIndex),
        ),
        editorMenuItem(
          'insert-slide-delete',
          t('tools.slide.deleteSlide'),
          () => removeSlide(useSlideStore.getState().slideIndex),
          { danger: true, disabled: doc.slides.length <= 1 },
        ),
      ],
    },
    {
      id: 'arrange',
      label: t('tools.slide.arrangeTitle'),
      entries: [
        editorMenuItem(
          'arrange-front',
          t('tools.slide.bringToFront'),
          () => useSlideStore.getState().bringToFront(),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-forward',
          t('tools.slide.bringForward'),
          () => useSlideStore.getState().bringForward(),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-backward',
          t('tools.slide.sendBackward'),
          () => useSlideStore.getState().sendBackward(),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-back',
          t('tools.slide.sendToBack'),
          () => useSlideStore.getState().sendToBack(),
          { disabled: !hasSelection },
        ),
        { type: 'separator' },
        editorMenuItem(
          'arrange-align-left',
          t('tools.slide.alignLeft'),
          () => useSlideStore.getState().alignSelected('left'),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-align-center',
          t('tools.slide.alignCenter'),
          () => useSlideStore.getState().alignSelected('hcenter'),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-align-right',
          t('tools.slide.alignRight'),
          () => useSlideStore.getState().alignSelected('right'),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-align-top',
          t('tools.slide.alignTop'),
          () => useSlideStore.getState().alignSelected('top'),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-align-middle',
          t('tools.slide.alignMiddle'),
          () => useSlideStore.getState().alignSelected('vcenter'),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-align-bottom',
          t('tools.slide.alignBottom'),
          () => useSlideStore.getState().alignSelected('bottom'),
          { disabled: !hasSelection },
        ),
        { type: 'separator' },
        editorMenuItem(
          'arrange-distribute-h',
          t('tools.slide.distributeH'),
          () => useSlideStore.getState().distributeSelected('horizontal'),
          { disabled: selection.length < 3 },
        ),
        editorMenuItem(
          'arrange-distribute-v',
          t('tools.slide.distributeV'),
          () => useSlideStore.getState().distributeSelected('vertical'),
          { disabled: selection.length < 3 },
        ),
        { type: 'separator' },
        editorMenuItem(
          'arrange-group',
          t('tools.slide.group'),
          () => useSlideStore.getState().groupSelected(),
          { shortcut: '⌘G', disabled: selection.length < 2 },
        ),
        editorMenuItem(
          'arrange-ungroup',
          t('tools.slide.ungroup'),
          () => useSlideStore.getState().ungroupSelected(),
          { shortcut: '⇧⌘G', disabled: !hasSelection },
        ),
        { type: 'separator' },
        editorMenuItem(
          'arrange-lock',
          t(allLocked ? 'tools.slide.unlock' : 'tools.slide.lock'),
          () => useSlideStore.getState().toggleLockSelected(),
          { disabled: !hasSelection },
        ),
        editorMenuItem(
          'arrange-visibility',
          t(allHidden ? 'tools.slide.show' : 'tools.slide.hide'),
          () => useSlideStore.getState().toggleVisibleSelected(),
          { disabled: !hasSelection },
        ),
      ],
    },
    {
      id: 'view',
      label: t('common.menuView'),
      entries: [
        editorMenuItem(
          'view-normal',
          `${t('tools.slide.viewNormal')}${viewMode === 'normal' ? ' ✓' : ''}`,
          () => setViewMode('normal'),
        ),
        editorMenuItem(
          'view-master',
          `${t('tools.slide.viewMaster')}${viewMode === 'master' ? ' ✓' : ''}`,
          () => setViewMode('master'),
        ),
        { type: 'separator' },
        editorMenuItem('view-present', t('tools.slide.present'), () => setPresenting(true), {
          disabled: doc.slides.length === 0,
        }),
        { type: 'separator' },
        editorMenuItem(
          'view-grid',
          `${t('tools.slide.gridSnap')}${gridSnap ? ' ✓' : ''}`,
          toggleGridSnap,
        ),
        editorMenuItem(
          'view-rulers',
          `${t('tools.slide.showRulers')}${showRulers ? ' ✓' : ''}`,
          toggleRulers,
        ),
        { type: 'separator' },
        editorMenuItem('view-zoom-out', t('tools.slide.zoomOut'), () =>
          setScale(Math.max(0.1, Math.round((scale - 0.1) * 100) / 100)),
        ),
        editorMenuItem('view-zoom-in', t('tools.slide.zoomIn'), () =>
          setScale(Math.min(3, Math.round((scale + 0.1) * 100) / 100)),
        ),
        editorMenuItem('view-zoom-fit', t('tools.slide.zoomFit'), () =>
          setViewport({ scale: 0, panX: 0, panY: 0 }),
        ),
        ...[0.5, 0.75, 1, 1.5, 2].map((level) =>
          editorMenuItem(
            `view-zoom-${Math.round(level * 100)}`,
            `${Math.round(level * 100)}%${Math.abs(scale - level) < 0.001 ? ' ✓' : ''}`,
            () => setScale(level),
          ),
        ),
      ],
    },
  ];

  const statusText = draftSaved ? t('tools.slide.saved') : t('tools.slide.saving');
  const memory = useMemo(() => formatBytes(estimateJsonBytes(doc)), [doc]);

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
              disabled={doc.slides.length === 0 && !doc.name.trim()}
              aria-label={t('common.clear')}
              title={t('common.clear')}
              className={`${EDITOR_ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
            <HintTip text={t('tools.slide.unsupportedTip')} />
          </>
        }
        center={
          <input
            type="text"
            value={doc.name}
            aria-label={t('tools.slide.docTitle')}
            placeholder={t('tools.slide.titlePlaceholder')}
            onChange={(event) => setDocName(event.target.value)}
            className={EDITOR_TITLE_INPUT_CLASS}
          />
        }
        right={
          <>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('tools.slide.newDoc')}
              title={t('tools.slide.newDoc')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="slides" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPresenting(true)}
              data-testid="slide-present"
              aria-label={t('tools.slide.present')}
              title={t('tools.slide.present')}
              className={EDITOR_ICON_BUTTON_CLASS}
            >
              <Icon name="present" className="h-4 w-4" />
            </button>
          </>
        }
      />

      <SlideToolbar onFailure={(error) => fail(error)} />

      {viewMode === 'master' ? (
        <MasterView onRuntimeFailure={() => setRuntimeError(true)} />
      ) : (
        <div
          ref={workRowRef}
          className="flex h-[max(360px,calc(100vh-28rem))] gap-3"
          style={workHeight ? { height: workHeight } : undefined}
        >
          <ThumbnailRail />

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <SlideCanvas onRuntimeFailure={() => setRuntimeError(true)} />
          </main>

          <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="flex gap-1">
              {(['element', 'layers', 'theme', 'template'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRightTab(tab)}
                  className={`h-7 flex-1 rounded-md text-[12px] transition-colors ${
                    rightTab === tab
                      ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'element'
                    ? t('tools.slide.panelElement')
                    : tab === 'layers'
                      ? t('tools.slide.panelLayers')
                      : tab === 'theme'
                        ? t('tools.slide.panelTheme')
                        : t('tools.slide.panelTemplate')}
                </button>
              ))}
            </div>
            {rightTab === 'element' ? (
              <PropertyPanel />
            ) : rightTab === 'layers' ? (
              <LayerPanel />
            ) : rightTab === 'theme' ? (
              <ThemePanel />
            ) : (
              <TemplateGallery />
            )}
          </aside>
        </div>
      )}

      <EditorStatusBar
        left={
          <>
            <span>
              {t('tools.slide.slidesLabel')}: {doc.slides.length} · {slideIndex + 1}/
              {doc.slides.length}
            </span>
            <span>
              {selection.length > 0
                ? t('tools.slide.selected', { count: selection.length })
                : t('tools.slide.noSelection')}
            </span>
            {report && report.placeholders > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t('tools.slide.downgraded', { count: report.placeholders })}
              </span>
            ) : null}
          </>
        }
        right={<span>{t('common.memoryUsage', { size: memory })}</span>}
      />

      {findOpen ? <FindReplaceBar onClose={() => setFindOpen(false)} /> : null}

      {busy !== null ? (
        <ProgressBar
          indeterminate
          label={busy === 'import' ? t('tools.slide.importing') : t('tools.slide.exporting')}
        />
      ) : null}

      {failure ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.slide', {
            ok: false,
            error: failure.error,
            params: failure.params,
          })}
        </p>
      ) : null}

      {runtimeError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {translateToolError('tools.slide', { ok: false, error: 'RUNTIME_FAILED' })}
        </p>
      ) : null}

      <input
        ref={importInputRef}
        type="file"
        accept=".pptx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImport(file);
        }}
      />

      <input
        ref={projectInputRef}
        type="file"
        accept=".sld"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleOpenProject(file);
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleInsertImage(file);
        }}
      />

      {outlineOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('tools.slide.outlineImport')}
            </h2>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              {t('tools.slide.outlineHint')}
            </p>
            <textarea
              aria-label={t('tools.slide.outlineImport')}
              rows={12}
              value={outlineText}
              onChange={(event) => setOutlineText(event.target.value)}
              className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1.5 font-mono text-[12px] leading-relaxed text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOutlineOpen(false)}
                className="h-8 rounded-md border border-gray-300 px-3 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.slide.outlineCancel')}
              </button>
              <button
                type="button"
                onClick={handleOutlineGenerate}
                className="h-8 rounded-md bg-blue-600 px-3 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t('tools.slide.outlineGenerate')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {presenting ? <PresentOverlay onClose={() => setPresenting(false)} /> : null}
    </div>
  );
}

/** Arrow-key nudge: move every selected element (through the store's container-aware action, so master view works too) */
function moveBy(dx: number, dy: number): void {
  const state = useSlideStore.getState();
  if (state.selection.length === 0) return;
  state.commit();
  state.moveSelected(dx, dy);
}
