import { useTranslation } from 'react-i18next';
import { DROP_MIME } from './FlowCanvas';
import { type ShapeKind } from '../model/types';

interface PaletteItem {
  kind: ShapeKind;
  key: string;
}

const GROUPS: Array<{ titleKey: string; items: PaletteItem[] }> = [
  {
    titleKey: 'groupBasic',
    items: [
      { kind: 'rect', key: 'shape_rect' },
      { kind: 'startEnd', key: 'shape_startEnd' },
      { kind: 'data', key: 'shape_data' },
    ],
  },
  {
    titleKey: 'groupFlow',
    items: [{ kind: 'decision', key: 'shape_decision' }],
  },
  {
    titleKey: 'groupBpmn',
    items: [
      { kind: 'swimlane', key: 'shape_swimlane' },
      { kind: 'swimlaneV', key: 'shape_swimlaneV' },
      { kind: 'bpmnTask', key: 'shape_bpmnTask' },
    ],
  },
];

function ShapeGlyph({ kind }: { kind: ShapeKind }) {
  const common = { fill: '#EFF6FF', stroke: '#2563EB', strokeWidth: 2 };
  switch (kind) {
    case 'startEnd':
      return <rect x={4} y={12} width={40} height={16} rx={8} {...common} />;
    case 'decision':
      return <polygon points="24,4 44,20 24,36 4,20" {...common} />;
    case 'data':
      return <polygon points="10,4 44,4 34,36 0,36" {...common} />;
    case 'swimlane':
      // 横向泳道：标题栏在左侧
      return (
        <g>
          <rect x={4} y={8} width={40} height={24} rx={3} {...common} />
          <rect
            x={4}
            y={8}
            width={6}
            height={24}
            rx={3}
            fill="#dbeafe"
            stroke="#2563EB"
            strokeWidth={2}
          />
        </g>
      );
    case 'swimlaneV':
      // 纵向泳道：标题栏在顶部
      return (
        <g>
          <rect x={17} y={5} width={14} height={30} rx={3} {...common} />
          <rect
            x={17}
            y={5}
            width={14}
            height={6}
            rx={3}
            fill="#dbeafe"
            stroke="#2563EB"
            strokeWidth={2}
          />
        </g>
      );
    case 'bpmnTask':
      return <rect x={4} y={8} width={40} height={24} rx={4} {...common} />;
    case 'rect':
    default:
      return <rect x={4} y={10} width={40} height={20} rx={2} {...common} />;
  }
}

interface ShapePaletteProps {
  onAddNode: (kind: ShapeKind) => void;
}

export function ShapePalette({ onAddNode }: ShapePaletteProps) {
  const { t } = useTranslation();
  return (
    <aside className="flex w-[208px] shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.paletteTitle')}
      </h2>
      {GROUPS.map((group) => (
        <div key={group.titleKey} className="flex flex-col gap-1.5">
          <p className="px-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
            {t(`tools.flowchart.${group.titleKey}`)}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((item) => (
              <button
                key={item.kind}
                type="button"
                draggable
                onClick={() => onAddNode(item.kind)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DROP_MIME, item.kind);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                title={t(`tools.flowchart.${item.key}`)}
                className="group flex cursor-grab flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-2 text-[11px] text-gray-600 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 active:cursor-grabbing"
              >
                <svg viewBox="0 0 48 40" className="h-9 w-12" aria-hidden="true">
                  <ShapeGlyph kind={item.kind} />
                </svg>
                <span className="truncate text-center leading-tight">
                  {t(`tools.flowchart.${item.key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
