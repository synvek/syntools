import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DROP_MIME } from './FlowCanvas';
import type { ShapeKind } from '../model/types';
import {
  SHAPE_CATEGORY_ORDER,
  shapesOfCategory,
  type ShapeCategory,
  type ShapeDef,
} from '../model/shapes';
import { drawShape } from '../nodes/shapeDraw';

/** 缩略图直接复用画布的绘制逻辑，保证预览与画上去的效果一致 */
function ShapeGlyph({ def }: { def: ShapeDef }) {
  const w = def.size.width;
  const h = def.size.height;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-7 w-7"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="#EFF6FF" stroke="#2563EB" strokeWidth={Math.max(2, w / 38)}>
        {drawShape(def, w, h)}
      </g>
    </svg>
  );
}

function ShapeButton({ def, onAddNode }: { def: ShapeDef; onAddNode: (kind: ShapeKind) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      draggable
      onClick={() => onAddNode(def.kind)}
      onDragStart={(e) => {
        e.dataTransfer.setData(DROP_MIME, def.kind);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={t(`tools.flowchart.shape_${def.kind}`)}
      className="flex cursor-grab items-center justify-center rounded-lg border border-gray-200 bg-white p-1 text-gray-600 transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-sm active:cursor-grabbing dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:border-blue-500"
    >
      <ShapeGlyph def={def} />
    </button>
  );
}

interface ShapePaletteProps {
  onAddNode: (kind: ShapeKind) => void;
}

export function ShapePalette({ onAddNode }: ShapePaletteProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<ShapeCategory, boolean>>(
    () =>
      Object.fromEntries(SHAPE_CATEGORY_ORDER.map((c) => [c, true])) as Record<
        ShapeCategory,
        boolean
      >,
  );
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // 侧边栏宽度可拖拽调整（默认 248，约 5 列）
  const [width, setWidth] = useState(248);
  const resizing = useRef(false);
  const onResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      if (!resizing.current) return;
      setWidth(Math.min(460, Math.max(180, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const sections = useMemo(() => {
    return SHAPE_CATEGORY_ORDER.map((c) => {
      const all = shapesOfCategory(c);
      const items = q
        ? all.filter((def) => {
            const name = t(`tools.flowchart.shape_${def.kind}`);
            return name.toLowerCase().includes(q) || def.kind.toLowerCase().includes(q);
          })
        : all;
      return { c, items };
    });
  }, [q, t]);

  const hasResult = q ? sections.some((s) => s.items.length > 0) : true;

  return (
    <aside
      className="relative flex shrink-0 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40"
      style={{ width }}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tools.flowchart.searchShape')}
        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
        {sections.map(({ c, items }) => {
          if (q && items.length === 0) return null;
          const open = expanded[c];
          return (
            <section key={c} className="rounded-lg">
              <button
                type="button"
                onClick={() => setExpanded((m) => ({ ...m, [c]: !m[c] }))}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-500/10"
              >
                <span>{t(`tools.flowchart.cat_${c}`)}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              {open ? (
                <div
                  className="grid gap-1.5 pb-1.5 pl-0.5 pr-0.5"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))' }}
                >
                  {items.map((def) => (
                    <ShapeButton key={def.kind} def={def} onAddNode={onAddNode} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!hasResult ? (
        <p className="py-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.flowchart.noShape')}
        </p>
      ) : null}

      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={onResizeStart}
        title={t('tools.flowchart.resizeSidebar')}
        className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-blue-400/50"
      />
    </aside>
  );
}
