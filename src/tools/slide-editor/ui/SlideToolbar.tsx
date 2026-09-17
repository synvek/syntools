import { useRef } from 'react';
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

/** 顶部工具栏：文稿标题、撤销重做、插入、缩放、放映与导入导出 */
export function SlideToolbar({
  busy,
  onNew,
  onImportFile,
  onExport,
  onPresent,
  onFailure,
}: {
  busy: 'import' | 'export' | null;
  onNew: () => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onPresent: () => void;
  onFailure: (errorCode: string) => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const doc = useSlideStore((s) => s.doc);
  const scale = useSlideStore((s) => s.viewport.scale);
  const canUndo = useSlideStore((s) => s.past.length > 0);
  const canRedo = useSlideStore((s) => s.future.length > 0);
  const setDocName = useSlideStore((s) => s.setDocName);
  const setScale = useSlideStore((s) => s.setScale);
  const setViewport = useSlideStore((s) => s.setViewport);
  const addElement = useSlideStore((s) => s.addElement);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const moveSlide = useSlideStore((s) => s.moveSlide);
  const slideIndex = useSlideStore((s) => s.slideIndex);

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

  return (
    <div className="flex flex-col gap-2">
      <div className="slide-glass flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-2 shadow-sm dark:border-gray-700">
        <input
          type="text"
          value={doc.name}
          aria-label={t('tools.slide.docTitle')}
          placeholder={t('tools.slide.titlePlaceholder')}
          onChange={(event) => setDocName(event.target.value)}
          className="h-8 min-w-[160px] flex-1 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-700">
          <ToolButton label={t('tools.slide.insertText')} icon="text" onClick={insertText} />
          {SHAPES.map((shape) => (
            <button
              key={shape.key}
              type="button"
              title={t(`tools.slide.${shape.key}`)}
              aria-label={t(`tools.slide.${shape.key}`)}
              onClick={() => insertShape(shape.geom)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ShapeGlyph geom={shape.geom} />
            </button>
          ))}
          <ToolButton label={t('tools.slide.insertLine')} icon="pen" onClick={insertLine} />
          <ToolButton
            label={t('tools.slide.insertImage')}
            icon="image"
            onClick={() => fileInputRef.current?.click()}
          />
          <ToolButton label={t('tools.slide.insertTable')} icon="table" onClick={insertTable} />
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-700">
          <button
            type="button"
            title={t('tools.slide.zoomOut')}
            aria-label={t('tools.slide.zoomOut')}
            onClick={() => setScale(Math.max(0.1, Math.round((scale - 0.1) * 100) / 100))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-base leading-none text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            −
          </button>
          <span className="w-10 text-center text-[12px] tabular-nums text-gray-500 dark:text-gray-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            title={t('tools.slide.zoomIn')}
            aria-label={t('tools.slide.zoomIn')}
            onClick={() => setScale(Math.min(3, Math.round((scale + 0.1) * 100) / 100))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-base leading-none text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            +
          </button>
          <ToolButton
            label={t('tools.slide.zoomFit')}
            icon="ruler"
            onClick={() => setViewport({ scale: 0 })}
          />
        </div>

        <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-700">
          <ToolButton
            label={t('tools.slide.moveUp')}
            icon="swap"
            onClick={() => moveSlide(slideIndex, Math.max(0, slideIndex - 1))}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={busy !== null}
          >
            <Icon name="upload" className="h-4 w-4" />
            {busy === 'import' ? t('tools.slide.importing') : t('tools.slide.importPptx')}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={busy !== null}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="download" className="h-4 w-4" />
            {busy === 'export' ? t('tools.slide.exporting') : t('tools.slide.exportPptx')}
          </button>
          <button
            type="button"
            onClick={onPresent}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-[12px] text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Icon name="slides" className="h-4 w-4" />
            {t('tools.slide.present')}
          </button>
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
        <input
          ref={importInputRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onImportFile(file);
          }}
        />
      </div>

      <div className="slide-glass flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 p-2 shadow-sm dark:border-gray-700">
        <ToolButton label={t('tools.slide.newDoc')} icon="slides" onClick={onNew} />
        <ToolButton
          label={t('tools.slide.undo')}
          icon="chevron"
          onClick={undo}
          disabled={!canUndo}
        />
        <ToolButton
          label={t('tools.slide.redo')}
          icon="chevron"
          onClick={redo}
          disabled={!canRedo}
        />
      </div>
    </div>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 px-2 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <Icon name={icon} className="h-4 w-4" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

/** 形状按钮内的几何缩略图（内联 SVG，避免额外依赖） */
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
