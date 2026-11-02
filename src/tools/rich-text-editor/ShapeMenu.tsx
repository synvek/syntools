import { useTranslation } from 'react-i18next';
import { resolvePresetGeometry } from '../../core/drawing/shapeDefs';
import { SHAPE_PRESETS } from './shapeNode';
import { shapePathD } from './shapeSvg';

interface ShapeMenuProps {
  open: boolean;
  /** 当前选中形状的预设，命中时高亮（从工具栏换形状） */
  activePrst: string | null;
  /** 选一个预设 → 进入拖拽绘制（Word / Excel 的行为：选完形状再画） */
  onPick: (prst: string) => void;
  /** 打开完整样式面板（尺寸/旋转/文字等长尾属性） */
  onOpenPanel: () => void;
  onClose: () => void;
  /**
   * `draw`（默认）：插入形状，选完预设进入拖拽绘制；`change`：更换选中形状的预设，选完立即生效。
   * 两种模式共用同一套网格，只是提示语与收尾方式不同。
   */
  mode?: 'draw' | 'change';
}

const GROUP_LABELS: Record<string, string> = {
  basic: 'tools.richText.shapeGroupBasic',
  arrow: 'tools.richText.shapeGroupArrow',
  star: 'tools.richText.shapeGroupStar',
  flowchart: 'tools.richText.shapeGroupFlowchart',
};

/**
 * 形状库下拉（对应 Word「插入 → 形状」、Excel「插入 → 形状」的网格）。
 *
 * 与侧边面板的区别是职责：这里只负责"挑一个形状"，挑完立刻进入画布绘制；
 * 尺寸、旋转、文字排版这些长尾属性仍然回到面板里改。一个下拉装不下全部控件，
 * 硬塞进去的结果是每次都要滚三层。
 */
export function ShapeMenu({
  open,
  activePrst,
  onPick,
  onOpenPanel,
  onClose,
  mode = 'draw',
}: ShapeMenuProps) {
  const { t } = useTranslation();
  if (!open) return null;
  const drawing = mode === 'draw';

  return (
    <div
      data-testid={drawing ? 'rich-text-shape-menu' : 'rich-text-shape-change'}
      role="menu"
      aria-label={
        drawing ? t('tools.richText.shapeInsert') : t('tools.richText.ribbon.changeShape')
      }
      className="absolute left-0 top-full z-40 mt-1 w-[268px] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
    >
      {drawing ? (
        <p className="mb-1 px-1 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.richText.shapeDrawHint')}
        </p>
      ) : null}
      <div className="max-h-[280px] overflow-auto">
        {(['basic', 'arrow', 'star', 'flowchart'] as const).map((group) => (
          <div key={group} className="mb-1.5">
            <p className="mb-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t(GROUP_LABELS[group])}
            </p>
            <div className="grid grid-cols-8 gap-1">
              {SHAPE_PRESETS.filter((preset) => preset.group === group).map((preset) => (
                <button
                  key={preset.prst}
                  type="button"
                  role="menuitem"
                  data-shape-preset={preset.prst}
                  title={preset.prst}
                  aria-label={preset.prst}
                  aria-pressed={activePrst === preset.prst}
                  onClick={() => onPick(preset.prst)}
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${
                    activePrst === preset.prst
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
                  }`}
                >
                  <svg viewBox="0 0 32 24" width="24" height="18" aria-hidden="true">
                    <path
                      d={shapePathD(resolvePresetGeometry(preset.prst), 32, 24)}
                      fill="currentColor"
                      className="text-gray-500 dark:text-gray-300"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 border-t border-gray-200 pt-1 dark:border-gray-700">
        {drawing ? (
          <button
            type="button"
            onClick={onOpenPanel}
            className="rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.richText.shapeMoreStyles')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {t('tools.richText.shapeClose')}
        </button>
      </div>
    </div>
  );
}
