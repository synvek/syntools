import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';
import {
  alignOf,
  alignPatch,
  cornerRadiusOf,
  cornerRadiusPatch,
  fillColorOf,
  fillPatch,
  fontSizeOf,
  fontSizeStepPatch,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  lineSpacingOf,
  listKindOf,
  listPatch,
  opacityOf,
  opacityPatch,
  paragraphPatch,
  runStyleOf,
  runStylePatch,
  shadowOf,
  shadowPatch,
  strokeColorOf,
  strokeColorPatch,
  strokeWidthOf,
  strokeWidthPatch,
  supportsCorner,
  supportsFill,
  supportsShadow,
  supportsStroke,
  supportsText,
  textBodyOf,
} from '../model/format';
import type { RunStyle, SlideElement, TextAlign } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { ColorPickerButton } from './ColorPickerButton';
import { NumberInput, SelectInput } from './controls';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldGlyph,
  BulletListIcon,
  CornerRadiusIcon,
  FontSizeDownIcon,
  FontSizeUpIcon,
  HighlightIcon,
  ItalicGlyph,
  LineSpacingIcon,
  NumberListIcon,
  OpacityIcon,
  OutlineIcon,
  ShadowIcon,
  StrikeGlyph,
  TextColorIcon,
  UnderlineGlyph,
} from './formatIcons';
import { MenuButton, type MenuItem } from './MenuButton';

/**
 * 工具栏「格式」行 —— 对标 PowerPoint / WPS 的上下文格式选项卡。
 *
 * 为什么搬到工具栏：字体、字号、颜色、填充、对齐这几项是**最高频且最需要即时视觉反馈**
 * 的操作，每次都要「选中元素 → 目光移到右侧面板 → 找到对应字段 → 改」；
 * 放在紧邻画布的工具栏里，视线几乎不用离开正在编辑的对象。
 *
 * 与「排列」行同一套取舍：**未选中元素时整行禁用而不是整行消失**。
 * 上下文选项卡在竞品里是「选中才出现」，但那会让工具栏高度跳动、画布上下抖动；
 * 这里用禁用态表达同一件事，代价是常驻一行。
 *
 * 职责边界（避免与右侧面板重复）：
 * - 工具栏 = 高频、点击型、单一取值（字体/字号/字形/颜色/填充/轮廓/对齐/列表/透明度/圆角/阴影开关）
 * - 右侧面板 = 低频、需要精确数值或长文本（坐标尺寸、裁剪四边、缩进段距、字距、上下标、竖排、超链接、表格、图表数据、公式源码、阴影细参数、页面与备注）
 */

/** 中西文混排常用字体（无联网字体加载，只列系统常见族） */
const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Impact',
  'PingFang SC',
  'Microsoft YaHei',
  'SimSun',
  'SimHei',
  'Noto Sans',
  'sans-serif',
  'serif',
  'monospace',
];

const LINE_SPACINGS = [0.8, 1, 1.2, 1.5, 2, 2.5, 3];

const ALIGNS: { value: TextAlign; icon: ReactNode; labelKey: string }[] = [
  { value: 'left', icon: <AlignLeftIcon />, labelKey: 'alignLeft' },
  { value: 'center', icon: <AlignCenterIcon />, labelKey: 'alignCenter' },
  { value: 'right', icon: <AlignRightIcon />, labelKey: 'alignRight' },
  { value: 'justify', icon: <AlignJustifyIcon />, labelKey: 'alignJustify' },
];

const ROW =
  'slide-glass flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 p-1.5 shadow-sm dark:border-gray-700';
/**
 * 组内**不允许**换行（`flex` 而非 `flex-wrap`）：窄窗口下整行会折成两行，
 * 若组内也参与换行，「字体」和「字号」这种强关联的控件会被拆到不同行，读起来像两组。
 */
const GROUP = 'flex shrink-0 items-center gap-0.5';
/** 分组竖线，与工具栏其它行一致 */
const SEP = <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

const BTN_BASE =
  'flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_IDLE =
  'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';
const BTN_ACTIVE = 'border-blue-600 bg-blue-600 text-white';

/** 紧凑数字字段：图标 + 输入框，省掉面板里的文字标签 */
function MiniNumber({
  label,
  icon,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1 text-gray-500 dark:text-gray-400"
      title={label}
    >
      {icon}
      <NumberInput
        ariaLabel={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        widthClass="w-11"
        onChange={onChange}
      />
    </span>
  );
}

export function FormatBar() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const patchSelectedWith = useSlideStore((s) => s.patchSelectedWith);

  const elements = containerElements({ doc, viewMode, slideIndex, masterKind, masterIndex });
  // 活动元素 = 最后点选的那个，与右侧面板口径一致（PowerPoint 的格式选项卡同理）
  const active: SlideElement | undefined = elements.find(
    (element) => element.id === selection[selection.length - 1],
  );

  /** 逐元素计算补丁后批量应用，多选时保留各自内容 */
  const apply = (updater: (element: SlideElement) => Partial<SlideElement> | null) =>
    patchSelectedWith(updater);

  const canText = active ? supportsText(active) : false;
  const canFill = active ? supportsFill(active) : false;
  const canStroke = active ? supportsStroke(active) : false;
  const canCorner = active ? supportsCorner(active) : false;
  const canShadow = active ? supportsShadow(active) : false;

  const run = active ? runStyleOf(active) : undefined;
  const body = active ? textBodyOf(active) : undefined;
  const align: TextAlign = active ? alignOf(active) : 'left';
  const listKind = active ? listKindOf(active) : 'none';

  /** 主题色板：取文档主题的 10 个常用槽位（与 PowerPoint 的主题色行一致） */
  const themeColors = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
  ]
    .map((key) => doc.theme.colors[key])
    .filter((color): color is string => /^#[0-9a-fA-F]{6}$/.test(color ?? ''));

  // 当前行距在菜单里打勾（MenuButton 的菜单项没有勾选态，用前置标记表达）
  const currentLineSpacing = active ? lineSpacingOf(active) : 1.2;
  const lineSpacingItems: MenuItem[] = LINE_SPACINGS.map((value) => ({
    key: String(value),
    label: `${value === currentLineSpacing ? '✓ ' : '　'}${value}×`,
    onClick: () => apply((element) => paragraphPatch(element, { lineSpacing: value })),
  }));

  return (
    <div className={ROW}>
      {/* ── 字体 / 字号 ── */}
      <div className={GROUP}>
        <SelectInput
          ariaLabel={t('tools.slide.fontFamily')}
          value={run?.font ?? 'Arial'}
          options={FONT_FAMILIES}
          widthClass="max-w-[92px]"
          disabled={!canText}
          onChange={(font) => apply((element) => runStylePatch(element, { font }))}
        />
        <MiniNumber
          label={t('tools.slide.fontSize')}
          icon={null}
          value={active ? fontSizeOf(active) : 18}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          disabled={!canText}
          onChange={(size) => apply((element) => runStylePatch(element, { size }))}
        />
        <button
          type="button"
          title={t('tools.slide.increaseFontSize')}
          aria-label={t('tools.slide.increaseFontSize')}
          disabled={!canText}
          onClick={() => apply((element) => fontSizeStepPatch(element, FONT_SIZE_STEP))}
          className={`${BTN_BASE} ${BTN_IDLE}`}
        >
          <FontSizeUpIcon />
        </button>
        <button
          type="button"
          title={t('tools.slide.decreaseFontSize')}
          aria-label={t('tools.slide.decreaseFontSize')}
          disabled={!canText}
          onClick={() => apply((element) => fontSizeStepPatch(element, -FONT_SIZE_STEP))}
          className={`${BTN_BASE} ${BTN_IDLE}`}
        >
          <FontSizeDownIcon />
        </button>
      </div>

      {SEP}

      {/* ── 字形 ── */}
      <div className={GROUP}>
        {(
          [
            { key: 'bold', label: t('tools.slide.bold'), glyph: <BoldGlyph /> },
            { key: 'italic', label: t('tools.slide.italic'), glyph: <ItalicGlyph /> },
            { key: 'underline', label: t('tools.slide.underline'), glyph: <UnderlineGlyph /> },
            { key: 'strike', label: t('tools.slide.strike'), glyph: <StrikeGlyph /> },
          ] as const
        ).map((item) => {
          const on = Boolean(run?.[item.key]);
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={on}
              disabled={!canText}
              // 取绝对值而非逐元素取反：与 PowerPoint 一致 —— 混合状态点击后统一为开启
              onClick={() =>
                apply((element) => runStylePatch(element, { [item.key]: !on } as Partial<RunStyle>))
              }
              className={`${BTN_BASE} ${on ? BTN_ACTIVE : BTN_IDLE}`}
            >
              {item.glyph}
            </button>
          );
        })}
      </div>

      {SEP}

      {/* ── 颜色：字体颜色 / 高亮 / 填充 / 轮廓 ── */}
      <div className={GROUP}>
        <ColorPickerButton
          label={t('tools.slide.color')}
          glyph={<TextColorIcon />}
          value={run?.color}
          themeColors={themeColors}
          disabled={!canText}
          onChange={(color) => apply((element) => runStylePatch(element, { color }))}
        />
        <ColorPickerButton
          label={t('tools.slide.highlight')}
          glyph={<HighlightIcon />}
          value={run?.highlight}
          themeColors={themeColors}
          disabled={!canText}
          onChange={(highlight) => apply((element) => runStylePatch(element, { highlight }))}
          onClear={() => apply((element) => runStylePatch(element, { highlight: undefined }))}
        />
        <ColorPickerButton
          label={t('tools.slide.fill')}
          glyph={<Icon name="bucket" className="h-4 w-4" />}
          value={active ? fillColorOf(active) : undefined}
          themeColors={themeColors}
          disabled={!canFill}
          onChange={(color) => apply((element) => fillPatch(element, { type: 'solid', color }))}
          onClear={() => apply((element) => fillPatch(element, 'none'))}
        />
        <ColorPickerButton
          label={t('tools.slide.stroke')}
          glyph={<OutlineIcon />}
          value={active ? strokeColorOf(active) : undefined}
          themeColors={themeColors}
          disabled={!canStroke}
          onChange={(color) => apply((element) => strokeColorPatch(element, color))}
          clearLabel={t('tools.slide.noStroke')}
          onClear={() => apply((element) => strokeWidthPatch(element, 0))}
          // 粗细放进「轮廓」下拉，对标 PowerPoint 的形状轮廓；线宽为 0 即无轮廓
          extra={
            <label className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>{t('tools.slide.strokeWidth')}</span>
              <span className="flex items-center gap-1">
                <NumberInput
                  ariaLabel={t('tools.slide.strokeWidth')}
                  value={active ? strokeWidthOf(active) : 0}
                  min={0}
                  max={40}
                  step={0.5}
                  disabled={!canStroke}
                  widthClass="w-11"
                  onChange={(width) => apply((element) => strokeWidthPatch(element, width))}
                />
              </span>
            </label>
          }
        />
      </div>

      {SEP}

      {/* ── 段落：对齐 / 行距 / 列表 ── */}
      <div className={GROUP}>
        {ALIGNS.map((item) => (
          <button
            key={item.value}
            type="button"
            title={t(`tools.slide.${item.labelKey}`)}
            aria-label={t(`tools.slide.${item.labelKey}`)}
            aria-pressed={align === item.value}
            disabled={!canText}
            onClick={() => apply((element) => alignPatch(element, item.value))}
            className={`${BTN_BASE} ${align === item.value ? BTN_ACTIVE : BTN_IDLE}`}
          >
            {item.icon}
          </button>
        ))}
        <MenuButton
          label={t('tools.slide.lineHeight')}
          glyph={<LineSpacingIcon />}
          items={lineSpacingItems}
          disabled={!canText}
        />
        <button
          type="button"
          title={t('tools.slide.bullet')}
          aria-label={t('tools.slide.bullet')}
          aria-pressed={listKind === 'bullet'}
          disabled={!canText}
          onClick={() =>
            apply((element) => listPatch(element, listKind === 'bullet' ? 'none' : 'bullet'))
          }
          className={`${BTN_BASE} ${listKind === 'bullet' ? BTN_ACTIVE : BTN_IDLE}`}
        >
          <BulletListIcon />
        </button>
        <button
          type="button"
          title={t('tools.slide.numbering')}
          aria-label={t('tools.slide.numbering')}
          aria-pressed={listKind === 'numbering'}
          disabled={!canText}
          onClick={() =>
            apply((element) => listPatch(element, listKind === 'numbering' ? 'none' : 'numbering'))
          }
          className={`${BTN_BASE} ${listKind === 'numbering' ? BTN_ACTIVE : BTN_IDLE}`}
        >
          <NumberListIcon />
        </button>
      </div>

      {SEP}

      {/* ── 效果：不透明度 / 圆角 / 阴影 ── */}
      <div className={GROUP}>
        <MiniNumber
          label={t('tools.slide.opacity')}
          icon={<OpacityIcon />}
          value={active ? Math.round(opacityOf(active) * 100) : 100}
          min={0}
          max={100}
          disabled={!active}
          onChange={(value) => apply(() => opacityPatch(value / 100))}
        />
        <MiniNumber
          label={t('tools.slide.cornerRadius')}
          icon={<CornerRadiusIcon />}
          value={active ? cornerRadiusOf(active) : 0}
          min={0}
          max={200}
          disabled={!canCorner}
          onChange={(value) => apply((element) => cornerRadiusPatch(element, value))}
        />
        <button
          type="button"
          title={t('tools.slide.panelShadow')}
          aria-label={t('tools.slide.panelShadow')}
          aria-pressed={Boolean(active && shadowOf(active))}
          disabled={!canShadow}
          onClick={() => apply((element) => shadowPatch(element, !element.shadow))}
          className={`${BTN_BASE} ${active && shadowOf(active) ? BTN_ACTIVE : BTN_IDLE}`}
        >
          <ShadowIcon />
        </button>
      </div>

      {/* 未选中元素：整行禁用，这里给出原因，避免被当成「格式功能坏了」 */}
      {!active ? (
        <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.slide.noSelection')}
        </span>
      ) : null}

      {/* 形状尚未带文字时提示：字体/字号可以直接设，双击即可输入 */}
      {active && canText && !body ? (
        <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.slide.emptyTextHint')}
        </span>
      ) : null}
    </div>
  );
}
