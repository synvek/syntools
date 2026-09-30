import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuButton } from './MenuButton';

/**
 * 工具栏色板（对标 PowerPoint 的「字体颜色 / 形状填充 / 形状轮廓」下拉）。
 *
 * 为什么需要它：属性面板里的 `input[type=color]` 只有系统取色器，改色要点 3 次
 * 才能落到一个常用色；而「主题色 + 标准色」宫格是高频操作里最省事的入口。
 *
 * 面板内容是固定结构（主题色行 / 标准色行 / 可选的无操作 / 自定义取色器），
 * 因此直接复用 `MenuButton` 的 `panel` 模式，定位与关闭行为保持一致。
 */

/** 标准色（Office 常用的 10 × 2 紧凑色板） */
const STANDARD_COLORS = [
  '#000000',
  '#404040',
  '#808080',
  '#BFBFBF',
  '#FFFFFF',
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
];

const SWATCH =
  'h-5 w-5 rounded border border-black/10 transition-transform hover:scale-110 dark:border-white/20';

function SwatchGrid({
  colors,
  value,
  onPick,
}: {
  colors: string[];
  value?: string;
  onPick: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {colors.map((color) => {
        const active = value?.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            aria-pressed={active}
            onClick={() => onPick(color)}
            style={{ backgroundColor: color }}
            className={`${SWATCH} ${active ? 'ring-2 ring-blue-500' : ''}`}
          />
        );
      })}
    </div>
  );
}

export function ColorPickerButton({
  label,
  value,
  onChange,
  onClear,
  clearLabel,
  /** 主题色板（通常取文档主题的 12 色） */
  themeColors,
  disabled,
  /** 触发器里的前置图标（字体颜色 / 填充 / 轮廓各用各的图形） */
  glyph,
  extra,
}: {
  label: string;
  value?: string;
  onChange: (color: string) => void;
  /** 提供时在面板底部加一个「无填充/无颜色」按钮 */
  onClear?: () => void;
  clearLabel?: string;
  themeColors?: string[];
  disabled?: boolean;
  glyph?: ReactNode;
  /** 面板底部的附加参数行（轮廓的「粗细」这类，对标 PowerPoint 的形状轮廓下拉） */
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const customInputId = useId();
  const current = value ?? '#000000';
  /**
   * 触发器沿用 PowerPoint 的紧凑写法：图标 + 下方一条颜色条，
   * 而不是「图标 + 独立色块 + 箭头」——后者每个控件多占约 12px，
   * 四个颜色控件叠起来正好把「格式」行挤到换行。
   * 当前没有该颜色时（如未设高亮）色条画成斜纹示意「无」。
   */
  const triggerContent = (
    <span className="flex flex-col items-center leading-none">
      {glyph}
      <span
        aria-hidden="true"
        style={value ? { backgroundColor: value } : undefined}
        className={`mt-[2px] h-[3px] w-4 rounded-sm ${
          value ? '' : 'bg-[repeating-linear-gradient(90deg,#d1d5db_0_2px,transparent_2px_4px)]'
        }`}
      />
    </span>
  );

  const panel = (close: () => void) => (
    <div className="flex flex-col gap-2 p-2">
      {themeColors && themeColors.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            {t('tools.slide.themeColors')}
          </span>
          {/* 选完即收，与 PowerPoint 的字体颜色/形状填充一致 */}
          <SwatchGrid
            colors={themeColors}
            value={value}
            onPick={(color) => {
              onChange(color);
              close();
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">
          {t('tools.slide.standardColors')}
        </span>
        <SwatchGrid
          colors={STANDARD_COLORS}
          value={value}
          onPick={(color) => {
            onChange(color);
            close();
          }}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
        {/*
          自定义取色沿用原生 input[type=color]。原生取色器本身是一个弹窗，
          这里保持面板不关闭，否则用户刚在系统取色器里拖完滑块面板就消失了。
        */}
        <input
          id={customInputId}
          type="color"
          aria-label={t('tools.slide.customColor')}
          value={/^#[0-9a-fA-F]{6}$/.test(current) ? current : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
        />
        <label
          htmlFor={customInputId}
          className="cursor-pointer text-[11px] text-gray-500 dark:text-gray-400"
        >
          {t('tools.slide.customColor')}
        </label>
        {onClear ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              close();
            }}
            className="ml-auto h-6 rounded border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {clearLabel ?? t('tools.slide.noFill')}
          </button>
        ) : null}
      </div>

      {extra ? (
        <div className="border-t border-gray-200 pt-2 dark:border-gray-700">{extra}</div>
      ) : null}
    </div>
  );

  return (
    <MenuButton
      label={label}
      panel={panel}
      panelClassName="w-[168px]"
      triggerContent={triggerContent}
      size="md"
      disabled={disabled}
    />
  );
}
