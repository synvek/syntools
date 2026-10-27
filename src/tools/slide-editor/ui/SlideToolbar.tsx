import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  createImageElement,
  createLineElement,
  createShapeElement,
  createTableElement,
  createTextElement,
} from '../model/factory';
import { createMediaFromFile } from '../model/media';
import type { ShapeGeometry } from '../model/types';
import { useSlideStore } from '../store';
import { FormatBar } from './FormatBar';
import { InsertPanel, type InsertPanelTab } from './InsertPanel';
import { MenuButton, type MenuItem } from './MenuButton';
import {
  AlignIcon,
  DistributeIcon,
  FlipIcon,
  GroupIcon,
  LayerIcon,
  RedoIcon,
  UndoIcon,
  UngroupIcon,
} from './toolIcons';

/**
 * Toolbar: shares the same button language as the word processor / spreadsheet tools —
 *
 * - **most buttons are icon-only**, with text only as tooltip (title / aria-label): no border when idle,
 *   blue fill when active (following the EditorToolbar convention);
 * - **a few "category entry" dropdowns** keep icon + text (shape / align / distribute / flip), because pure
 *   icons can't tell those four apart; the dropdown items still show text.
 *
 * Two rows: format / insert·arrange·view.
 * The last three form their own clusters (CLUSTER) so narrow screens wrap them as a whole;
 * "arrange" is entirely a **selection-dependent** group and degrades to disabled when nothing is selected.
 */

const SHAPES: { key: string; geom: ShapeGeometry }[] = [
  { key: 'shapeRect', geom: { kind: 'rect', prst: 'rect' } },
  { key: 'shapeRoundRect', geom: { kind: 'rect', radius: 0.167, prst: 'roundRect' } },
  { key: 'shapeEllipse', geom: { kind: 'ellipse', prst: 'ellipse' } },
  {
    key: 'shapeTriangle',
    geom: { kind: 'polygon', points: [0.5, 0, 1, 1, 0, 1], prst: 'triangle' },
  },
  { key: 'shapeStar', geom: { kind: 'star', innerRatio: 0.382, prst: 'star' } },
  {
    key: 'shapeArrow',
    geom: {
      kind: 'polygon',
      points: [0, 0.25, 0.6, 0.25, 0.6, 0, 1, 0.5, 0.6, 1, 0.6, 0.75, 0, 0.75],
      prst: 'rightArrow',
    },
  },
];

const ROW =
  'slide-glass flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 p-1.5 shadow-sm dark:border-gray-700';
const GROUP = 'flex flex-wrap items-center gap-0.5';
/** Logical cluster: binds several GROUPs into one wrapping unit so narrow screens don't split them across rows */
const CLUSTER = 'flex shrink-0 items-center gap-1';
/** Group divider, matching the word-processor toolbar */
const SEP = <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

const BTN_BASE =
  'flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_IDLE =
  'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';
const BTN_ACTIVE = 'border-blue-600 bg-blue-600 text-white';

export function SlideToolbar({ onFailure }: { onFailure: (errorCode: string) => void }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<InsertPanelTab | null>(null);
  const doc = useSlideStore((s) => s.doc);
  const scale = useSlideStore((s) => s.viewport.scale);
  const selection = useSlideStore((s) => s.selection);
  const canUndo = useSlideStore((s) => s.past.length > 0);
  const canRedo = useSlideStore((s) => s.future.length > 0);
  const setScale = useSlideStore((s) => s.setScale);
  const setViewport = useSlideStore((s) => s.setViewport);
  const addElement = useSlideStore((s) => s.addElement);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const moveSlide = useSlideStore((s) => s.moveSlide);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const gridSnap = useSlideStore((s) => s.gridSnap);
  const showRulers = useSlideStore((s) => s.showRulers);
  const toggleGridSnap = useSlideStore((s) => s.toggleGridSnap);
  const toggleRulers = useSlideStore((s) => s.toggleRulers);

  const bringToFront = useSlideStore((s) => s.bringToFront);
  const sendToBack = useSlideStore((s) => s.sendToBack);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);
  const alignSelected = useSlideStore((s) => s.alignSelected);
  const distributeSelected = useSlideStore((s) => s.distributeSelected);
  const groupSelected = useSlideStore((s) => s.groupSelected);
  const ungroupSelected = useSlideStore((s) => s.ungroupSelected);
  const toggleLockSelected = useSlideStore((s) => s.toggleLockSelected);
  const toggleVisibleSelected = useSlideStore((s) => s.toggleVisibleSelected);
  const patchSelected = useSlideStore((s) => s.patchSelected);
  const formatPainter = useSlideStore((s) => s.formatPainter);
  const copyFormat = useSlideStore((s) => s.copyFormat);
  const applyFormat = useSlideStore((s) => s.applyFormat);
  const clearFormatPainter = useSlideStore((s) => s.clearFormatPainter);

  const hasSelection = selection.length > 0;

  const insertText = () => addElement(createTextElement(doc, t('tools.slide.insertText')));
  const insertShape = (geom: ShapeGeometry) => addElement(createShapeElement(doc, geom));
  const insertLine = () => addElement(createLineElement(doc));
  const insertTable = () => addElement(createTableElement(doc));

  const handleImage = async (file: File) => {
    const result = await createMediaFromFile(file);
    if (!result.ok) {
      onFailure(result.error);
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
    addElement(createImageElement(doc, asset));
  };

  const shapeItems: MenuItem[] = SHAPES.map((shape) => ({
    key: shape.key,
    label: t(`tools.slide.${shape.key}`),
    glyph: <ShapeGlyph geom={shape.geom} />,
    onClick: () => insertShape(shape.geom),
  }));

  const alignItems: MenuItem[] = [
    { key: 'left', label: t('tools.slide.alignLeft'), onClick: () => alignSelected('left') },
    {
      key: 'hcenter',
      label: t('tools.slide.alignCenter'),
      onClick: () => alignSelected('hcenter'),
    },
    { key: 'right', label: t('tools.slide.alignRight'), onClick: () => alignSelected('right') },
    { key: 'top', label: t('tools.slide.alignTop'), onClick: () => alignSelected('top') },
    {
      key: 'vcenter',
      label: t('tools.slide.alignMiddle'),
      onClick: () => alignSelected('vcenter'),
    },
    { key: 'bottom', label: t('tools.slide.alignBottom'), onClick: () => alignSelected('bottom') },
  ];

  const distributeItems: MenuItem[] = [
    {
      key: 'h',
      label: t('tools.slide.distributeH'),
      disabled: selection.length < 3,
      onClick: () => distributeSelected('horizontal'),
    },
    {
      key: 'v',
      label: t('tools.slide.distributeV'),
      disabled: selection.length < 3,
      onClick: () => distributeSelected('vertical'),
    },
  ];

  const flipItems: MenuItem[] = [
    { key: 'flipH', label: t('tools.slide.flipH'), onClick: () => toggleFlip('flipX') },
    { key: 'flipV', label: t('tools.slide.flipV'), onClick: () => toggleFlip('flipY') },
  ];

  /** Flip is a "negate" operation, so it must read the current value: patchSelected works for multi-select too */
  function toggleFlip(axis: 'flipX' | 'flipY') {
    const state = useSlideStore.getState();
    const slide = state.doc.slides[state.slideIndex];
    const target = slide?.elements.find(
      (el) => el.id === state.selection[state.selection.length - 1],
    );
    if (!target) return;
    patchSelected({ [axis]: !target[axis] } as never);
  }

  /** Active state of the lock/hide buttons: "on" only when every selected element is in that state */
  const allLocked = (): boolean => {
    const state = useSlideStore.getState();
    const slide = state.doc.slides[state.slideIndex];
    const picked = (slide?.elements ?? []).filter((el) => state.selection.includes(el.id));
    return picked.length > 0 && picked.every((el) => el.locked);
  };

  const anyHidden = (): boolean => {
    const state = useSlideStore.getState();
    const slide = state.doc.slides[state.slideIndex];
    const picked = (slide?.elements ?? []).filter((el) => state.selection.includes(el.id));
    return picked.length > 0 && picked.every((el) => el.visible === false);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* ── Format: font/size/style/color/fill/outline/paragraph/effects; disabled when nothing is selected ── */}
      <FormatBar />

      {/* ── Insert + arrange + view: three clusters wrapping as units; "arrange" needs a selection ── */}
      <div className={ROW}>
        {/* Insert (undo/redo included): shares the row with "arrange" so narrow screens don't split the block */}
        <div className={CLUSTER}>
          <div className={GROUP}>
            <IconButton label={t('tools.slide.insertText')} onClick={insertText}>
              <Icon name="text" className="h-4 w-4" />
            </IconButton>
            {/* A dropdown is a "category entry", so keeping the text is clearer */}
            <MenuButton
              label={t('tools.slide.insertShape')}
              icon="shapes"
              items={shapeItems}
              size="md"
              showLabel
            />
            <IconButton label={t('tools.slide.insertLine')} onClick={insertLine}>
              <Icon name="pen" className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t('tools.slide.insertImage')}
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="image" className="h-4 w-4" />
            </IconButton>
            <IconButton label={t('tools.slide.insertTable')} onClick={insertTable}>
              <Icon name="table" className="h-4 w-4" />
            </IconButton>
            {SEP}
            <IconButton label={t('tools.slide.insertChart')} onClick={() => setPanel('chart')}>
              <ChartIcon />
            </IconButton>
            <IconButton label={t('tools.slide.insertFormula')} onClick={() => setPanel('formula')}>
              <FormulaIcon />
            </IconButton>
            <IconButton label={t('tools.slide.insertIcon')} onClick={() => setPanel('icon')}>
              <IconSparkIcon />
            </IconButton>
            {/* Shape library: its own glyph sets it apart from "Shape ▾"; icon-only keeps this group consistent */}
            <IconButton label={t('tools.slide.insertShapeLib')} onClick={() => setPanel('shape')}>
              <ShapeLibraryIcon />
            </IconButton>
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton label={t('tools.slide.undo')} onClick={undo} disabled={!canUndo}>
              <UndoIcon />
            </IconButton>
            <IconButton label={t('tools.slide.redo')} onClick={redo} disabled={!canRedo}>
              <RedoIcon />
            </IconButton>
          </div>
        </div>

        {/* View: zoom / grid / rulers / page. After insert, so it shares that row */}
        <div className={CLUSTER}>
          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.zoomOut')}
              onClick={() => setScale(Math.max(0.1, Math.round((scale - 0.1) * 100) / 100))}
            >
              <Icon name="zoomOut" className="h-4 w-4" />
            </IconButton>
            {/* The percentage is a value display, not a button, so it keeps text */}
            <span className="w-10 text-center text-[12px] tabular-nums text-gray-500 dark:text-gray-400">
              {Math.round(scale * 100)}%
            </span>
            <IconButton
              label={t('tools.slide.zoomIn')}
              onClick={() => setScale(Math.min(3, Math.round((scale + 0.1) * 100) / 100))}
            >
              <Icon name="zoomIn" className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t('tools.slide.zoomFit')}
              // Fit to window also resets panning, otherwise it looks like the click did nothing
              onClick={() => setViewport({ scale: 0, panX: 0, panY: 0 })}
            >
              <Icon name="fitScreen" className="h-4 w-4" />
            </IconButton>
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.gridSnap')}
              active={gridSnap}
              onClick={toggleGridSnap}
            >
              <Icon name="grid" className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t('tools.slide.showRulers')}
              active={showRulers}
              onClick={toggleRulers}
            >
              <Icon name="ruler" className="h-4 w-4" />
            </IconButton>
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.moveUp')}
              onClick={() => moveSlide(slideIndex, Math.max(0, slideIndex - 1))}
            >
              <Icon name="swap" className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className={CLUSTER}>
          <div className={GROUP}>
            <MenuButton
              label={t('tools.slide.alignTitle')}
              glyph={<AlignIcon />}
              items={alignItems}
              disabled={!hasSelection}
              showLabel
            />
            <MenuButton
              label={t('tools.slide.distributeTitle')}
              glyph={<DistributeIcon />}
              items={distributeItems}
              disabled={selection.length < 3}
              showLabel
            />
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.bringToFront')}
              disabled={!hasSelection}
              onClick={bringToFront}
            >
              <LayerIcon variant="front" />
            </IconButton>
            <IconButton
              label={t('tools.slide.bringForward')}
              disabled={!hasSelection}
              onClick={bringForward}
            >
              <LayerIcon variant="forward" />
            </IconButton>
            <IconButton
              label={t('tools.slide.sendBackward')}
              disabled={!hasSelection}
              onClick={sendBackward}
            >
              <LayerIcon variant="backward" />
            </IconButton>
            <IconButton
              label={t('tools.slide.sendToBack')}
              disabled={!hasSelection}
              onClick={sendToBack}
            >
              <LayerIcon variant="back" />
            </IconButton>
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.group')}
              disabled={selection.length < 2}
              onClick={groupSelected}
            >
              <GroupIcon />
            </IconButton>
            <IconButton
              label={t('tools.slide.ungroup')}
              disabled={!hasSelection}
              onClick={ungroupSelected}
            >
              <UngroupIcon />
            </IconButton>
            <MenuButton
              label={t('tools.slide.flipTitle')}
              glyph={<FlipIcon />}
              items={flipItems}
              disabled={!hasSelection}
              showLabel
            />
          </div>

          {SEP}

          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.lock')}
              active={allLocked()}
              disabled={!hasSelection}
              onClick={toggleLockSelected}
            >
              <Icon name={allLocked() ? 'lock' : 'unlock'} className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t('tools.slide.hide')}
              active={anyHidden()}
              disabled={!hasSelection}
              onClick={toggleVisibleSelected}
            >
              <Icon name={anyHidden() ? 'eyeOff' : 'eye'} className="h-4 w-4" />
            </IconButton>
          </div>

          {SEP}

          {/* Format painter: "copy format" then "apply format"; the button stays active in between */}
          <div className={GROUP}>
            <IconButton
              label={t('tools.slide.copyFormat')}
              active={formatPainter !== null}
              disabled={!hasSelection}
              onClick={copyFormat}
            >
              <FormatPainterIcon active={formatPainter !== null} />
            </IconButton>
            <IconButton
              label={t('tools.slide.applyFormat')}
              active={formatPainter !== null}
              disabled={formatPainter === null || !hasSelection}
              onClick={applyFormat}
            >
              <Icon name="brush" className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={t('tools.slide.clearFormat')}
              disabled={formatPainter === null}
              onClick={clearFormatPainter}
            >
              <Icon name="close" className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImage(file);
        }}
      />

      {panel ? <InsertPanel initialTab={panel} onClose={() => setPanel(null)} /> : null}
    </div>
  );
}

/** Format painter icon: a small "+" on the brush head when active, hinting that a style was copied */
function FormatPainterIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M3 2h7a1 1 0 0 1 1 1v3H3z" />
      <path d="M5 7h4v2H5z" />
      <path d="M6 10h2v4H6z" />
      {active ? <path d="M12 9h1.5v1.5H15V12h-1.5v1.5H12V12h-1.5v-1.5H12z" /> : null}
    </svg>
  );
}

/** Chart icon (inline SVG, following toolIcons' 16×16 convention) */
function ChartIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="1" y="9" width="3" height="6" />
      <rect x="6" y="5" width="3" height="10" />
      <rect x="11" y="2" width="3" height="13" />
    </svg>
  );
}

/** Formula icon */
function FormulaIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontStyle="italic" fill="currentColor">
        ƒx
      </text>
    </svg>
  );
}

/**
 * Shape library icon: a 2×2 "square / circle / triangle / diamond" combo,
 * distinct from the `shapes` icon used by "Shape ▾" (they're adjacent, so the same icon would be confusing).
 */
function ShapeLibraryIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="1.2" y="1.2" width="5.6" height="5.6" rx="1" />
      <circle cx="11.8" cy="4" r="2.8" />
      <polygon points="4,8.8 7.2,15 0.8,15" />
      <polygon points="11.8,8.9 15.1,12.2 11.8,15.5 8.5,12.2" />
    </svg>
  );
}

/** Icon library icon */
function IconSparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="5" r="2.2" opacity="0.9" />
      <rect x="9" y="2.5" width="5" height="5" rx="1" opacity="0.65" />
      <polygon points="8,11 12,15 4,15" opacity="0.8" />
    </svg>
  );
}

/** Toolbar icon button: icon only, text via tooltip; blue fill when active */
function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={`${BTN_BASE} ${active ? BTN_ACTIVE : BTN_IDLE}`}
    >
      {children}
    </button>
  );
}

/** Shape thumbnail (inline SVG to avoid extra dependencies) */
function ShapeGlyph({ geom }: { geom: ShapeGeometry }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16' } as const;
  if (geom.kind === 'ellipse') {
    return (
      <svg {...common} aria-hidden="true">
        <ellipse cx="8" cy="8" rx="7" ry="6" fill="currentColor" opacity="0.75" />
      </svg>
    );
  }
  if (geom.kind === 'star') {
    return (
      <svg {...common} aria-hidden="true">
        <polygon
          points="8,1 10,6 15,6 11,9 12,15 8,11 4,15 5,9 1,6 6,6"
          fill="currentColor"
          opacity="0.75"
        />
      </svg>
    );
  }
  if (geom.kind === 'polygon' && geom.points) {
    const pts = geom.points
      .reduce<string[]>((acc, value, index) => {
        if (index % 2 === 0) acc.push(`${value * 16},${(geom.points?.[index + 1] ?? 0) * 16}`);
        return acc;
      }, [])
      .join(' ');
    return (
      <svg {...common} aria-hidden="true">
        <polygon points={pts} fill="currentColor" opacity="0.75" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx={geom.radius ? 3 : 1}
        fill="currentColor"
        opacity="0.75"
      />
    </svg>
  );
}
