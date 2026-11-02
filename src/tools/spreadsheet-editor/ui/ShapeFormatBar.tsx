import { useTranslation } from 'react-i18next';
import { SHEET_SHAPE_PRESETS, type SheetShapeConfig } from '../shapes';

interface ShapeFormatBarProps {
  shape: SheetShapeConfig | null;
  onChange: (patch: Partial<SheetShapeConfig>) => void;
  onRemove: () => void;
  onBringFront: () => void;
  onSendBack: () => void;
}

const fieldClass =
  'h-7 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900';
const colorClass = 'h-7 w-8 rounded border border-gray-300 bg-transparent dark:border-gray-600';

/**
 * 选中形状后的上下文格式栏（对应 Excel 的「形状格式」选项卡）。
 *
 * 表格没有功能区，所以这条栏贴在工作表上沿出现：与形状内嵌的浮动小面板相比，
 * 固定位置的工具条更符合"工具栏改样式"的预期，也不会挡住形状本身。
 */
export function ShapeFormatBar({
  shape,
  onChange,
  onRemove,
  onBringFront,
  onSendBack,
}: ShapeFormatBarProps) {
  const { t } = useTranslation();
  if (!shape) return null;

  const presets = SHEET_SHAPE_PRESETS.flat();

  return (
    <div
      data-testid="sheet-shape-format-bar"
      className="mb-1 flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
    >
      <span className="mr-1 font-medium text-gray-700 dark:text-gray-200">
        {t('tools.sheet.shapeFormat')}
      </span>

      <select
        aria-label={t('tools.sheet.insertShape')}
        value={shape.prst}
        onChange={(event) => onChange({ prst: event.target.value, adj: undefined })}
        className={fieldClass}
      >
        {presets.map((preset) => (
          <option key={preset.prst} value={preset.prst}>
            {t(`tools.sheet.${preset.labelKey}`)}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span>{t('tools.sheet.shapeFill')}</span>
        <input
          type="color"
          aria-label={t('tools.sheet.shapeFill')}
          value={shape.fill}
          onChange={(event) => onChange({ fill: event.target.value })}
          className={colorClass}
        />
      </label>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span>{t('tools.sheet.shapeStroke')}</span>
        <input
          type="color"
          aria-label={t('tools.sheet.shapeStroke')}
          value={shape.stroke}
          onChange={(event) => onChange({ stroke: event.target.value })}
          className={colorClass}
        />
      </label>

      <input
        type="number"
        min={0}
        max={24}
        aria-label={t('tools.sheet.shapeStroke')}
        title={t('tools.sheet.shapeStroke')}
        value={Math.round(shape.strokeWidth)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) {
            onChange({ strokeWidth: Math.min(24, Math.max(0, parsed)) });
          }
        }}
        className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
      />

      <input
        type="number"
        min={0}
        max={359}
        aria-label={t('tools.sheet.shapeRotate')}
        title={t('tools.sheet.shapeRotate')}
        value={Math.round(shape.rotation ?? 0)}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange({ rotation: ((parsed % 360) + 360) % 360 });
        }}
        className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
      />

      <input
        type="text"
        value={shape.text ?? ''}
        placeholder={t('tools.sheet.shapeText')}
        aria-label={t('tools.sheet.shapeText')}
        onChange={(event) => onChange({ text: event.target.value })}
        className="h-7 w-36 rounded-md border border-gray-300 bg-white px-1.5 text-xs dark:border-gray-600 dark:bg-gray-900"
      />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onBringFront}
          className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {t('tools.sheet.shapeBringFront')}
        </button>
        <button
          type="button"
          onClick={onSendBack}
          className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {t('tools.sheet.shapeSendBack')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="h-7 rounded-md border border-red-300 px-2 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          {t('tools.sheet.shapeRemove')}
        </button>
      </div>
    </div>
  );
}
