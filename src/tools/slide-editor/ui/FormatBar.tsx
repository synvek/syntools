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
 * The toolbar's "format" row — counterpart of PowerPoint / WPS's contextual format tab.
 *
 * Why it moved into the toolbar: font, size, color, fill and alignment are the **most frequent operations and
 * the ones that most need instant visual feedback**, yet each used to require "select element → look right to
 * the panel → find the field → change it"; next to the canvas, your eyes barely leave the object being edited.
 *
 * Same trade-off as the "arrange" row: **the row is disabled, not hidden, when nothing is selected**.
 * Competing products only show the contextual tab when something is selected, but that makes the toolbar height
 * jump and the canvas bounce; a disabled row says the same thing at the cost of one always-present row.
 *
 * Responsibility split (to avoid duplicating the right panel):
 * - toolbar = frequent, click-type, single-value (font/size/style/color/fill/outline/align/list/opacity/radius/shadow)
 * - right panel = rare, needs exact values or long text (position/size, crop, indent/spacing, tracking, baseline, vertical text, link, table, chart data, formula, shadow, page/notes)
 */

/** Common fonts for mixed CJK/Latin text (no web font loading, only widely available system families) */
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
 * Wrapping is **not allowed** inside a group (`flex`, not `flex-wrap`): in a narrow window the whole row wraps,
 * and if groups could wrap too, tightly coupled controls like "font" and "size" would split across lines.
 */
const GROUP = 'flex shrink-0 items-center gap-0.5';
/** Group divider, consistent with the toolbar's other rows */
const SEP = <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

const BTN_BASE =
  'flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_IDLE =
  'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';
const BTN_ACTIVE = 'border-blue-600 bg-blue-600 text-white';

/** Compact number field: icon + input, skipping the panel's text label */
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
  // The active element is the last one clicked, consistent with the right panel (same as PowerPoint's format tab)
  const active: SlideElement | undefined = elements.find(
    (element) => element.id === selection[selection.length - 1],
  );

  /** Compute a patch per element and apply in bulk, preserving each one's content on multi-select */
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

  /** Theme palette: the document theme's 10 common slots (matching PowerPoint's theme color row) */
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

  // Check the current line spacing in the menu (MenuButton items have no checked state, so use a leading marker)
  const currentLineSpacing = active ? lineSpacingOf(active) : 1.2;
  const lineSpacingItems: MenuItem[] = LINE_SPACINGS.map((value) => ({
    key: String(value),
    label: `${value === currentLineSpacing ? '✓ ' : '　'}${value}×`,
    onClick: () => apply((element) => paragraphPatch(element, { lineSpacing: value })),
  }));

  return (
    <div className={ROW}>
      {/* ── Font / size ── */}
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

      {/* ── Style ── */}
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
              // Take an absolute value rather than toggling per element: like PowerPoint, a mixed state becomes "on"
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

      {/* ── Color: text color / highlight / fill / outline ── */}
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
          // Weight lives in the "outline" dropdown, like PowerPoint's shape outline; a width of 0 means no outline
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

      {/* ── Paragraph: align / line spacing / list ── */}
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

      {/* ── Effects: opacity / corner radius / shadow ── */}
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

      {/* No selection: the row is disabled and the reason shown, so it isn't mistaken for "formatting is broken" */}
      {!active ? (
        <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.slide.noSelection')}
        </span>
      ) : null}

      {/* Hint when a shape has no text yet: font/size can be set directly, double-click to type */}
      {active && canText && !body ? (
        <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
          {t('tools.slide.emptyTextHint')}
        </span>
      ) : null}
    </div>
  );
}
