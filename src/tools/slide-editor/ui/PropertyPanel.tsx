import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { backgroundToColor } from '../core';
import type { Fill, RunStyle, SlideElement, Stroke, TextAlign } from '../model/types';
import { containerElements, useSlideStore } from '../store';
import { ChartEditor } from './ChartEditor';
import {
  ActionRow,
  ColorInput,
  Field,
  NumberInput,
  Section,
  SelectInput,
  TextArea,
  TextInput,
  ToggleGroup,
} from './controls';

/** 中西文混排常用字体（无联网字体加载，只列系统常见族） */
const FONT_OPTIONS = [
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

/** 右侧属性面板：无选中时编辑页面，选中时编辑元素（位置/填充/文字/层序） */
export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const patchElement = useSlideStore((s) => s.patchElement);
  const updateSlide = useSlideStore((s) => s.updateSlide);
  const removeSelected = useSlideStore((s) => s.removeSelected);
  const duplicateSelected = useSlideStore((s) => s.duplicateSelected);

  // 统一按「当前编辑容器」取元素：母版视图下编辑的是母版/版式元素
  const element = containerElements({ doc, viewMode, slideIndex, masterKind, masterIndex }).find(
    (item) => item.id === selection[selection.length - 1],
  );
  const activeCell = useSlideStore((s) => s.activeCell);
  const setTableSize = useSlideStore((s) => s.setTableSize);
  const patchTableCell = useSlideStore((s) => s.patchTableCell);
  const mergeCellRight = useSlideStore((s) => s.mergeCellRight);
  const splitCell = useSlideStore((s) => s.splitCell);

  // 页级背景/备注始终取「当前页」，与正在编辑的容器无关（母版视图下这两项不展示）
  const currentSlide = doc.slides[slideIndex];
  const pageBackground =
    currentSlide?.background ??
    doc.layouts.find((layout) => layout.id === currentSlide?.layoutId)?.background ??
    doc.masters[0]?.background;

  if (!element) {
    return (
      <div className="flex flex-col gap-3">
        <Section title={t('tools.slide.panelPage')}>
          <Field label={t('tools.slide.background')}>
            <ColorInput
              ariaLabel={t('tools.slide.background')}
              value={backgroundToColor(pageBackground, doc.theme.colors.lt1 ?? '#FFFFFF')}
              onChange={(color) => updateSlide({ background: color })}
            />
          </Field>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.slide.noSelection')}
          </p>
        </Section>
        {/* 备注是页级属性，放在「未选中元素」分支下语义最自然 */}
        <Section title={t('tools.slide.notes')}>
          <TextArea
            ariaLabel={t('tools.slide.notes')}
            value={currentSlide?.notes ?? ''}
            placeholder={t('tools.slide.notesHint')}
            onChange={(notes) => updateSlide({ notes })}
          />
        </Section>
      </div>
    );
  }

  const apply = (patch: Partial<SlideElement>) => patchElement(element.id, patch);

  const fill = element.type === 'shape' || element.type === 'text' ? element.fill : undefined;
  const stroke =
    element.type === 'shape' || element.type === 'text' || element.type === 'image'
      ? element.stroke
      : element.type === 'line'
        ? element.stroke
        : undefined;
  const body =
    element.type === 'text' ? element.body : element.type === 'shape' ? element.body : undefined;
  const firstStyle: RunStyle | undefined = body?.paragraphs[0]?.runs[0]?.style;
  const align: TextAlign = body?.paragraphs[0]?.align ?? 'left';

  const cornerRadiusValue =
    element.type === 'text' || element.type === 'image' ? (element.cornerRadius ?? 0) : 0;

  const cropValue = (side: 'left' | 'top' | 'right' | 'bottom'): number =>
    element.type === 'image' ? (element.crop?.[side] ?? 0) : 0;

  const patchCrop = (side: 'left' | 'top' | 'right' | 'bottom', value: number) => {
    if (element.type !== 'image') return;
    apply({
      crop: { left: 0, top: 0, right: 0, bottom: 0, ...element.crop, [side]: value },
    } as Partial<SlideElement>);
  };

  const patchFill = (next: Fill) => apply({ fill: next } as Partial<SlideElement>);
  const patchStroke = (next: Stroke | undefined) =>
    apply({ stroke: next } as Partial<SlideElement>);
  const patchStyle = (patch: Partial<RunStyle>) => {
    if (!body) return;
    const next = {
      ...body,
      paragraphs: body.paragraphs.map((paragraph, index) =>
        index === 0
          ? {
              ...paragraph,
              runs: paragraph.runs.map((run, runIndex) =>
                runIndex === 0 ? { ...run, style: { ...(run.style ?? {}), ...patch } } : run,
              ),
            }
          : paragraph,
      ),
    };
    apply({ body: next } as Partial<SlideElement>);
  };
  const patchAlign = (next: TextAlign) => {
    if (!body) return;
    apply({
      body: { ...body, paragraphs: body.paragraphs.map((p) => ({ ...p, align: next })) },
    } as Partial<SlideElement>);
  };
  /** 段落级属性（行距/缩进/段前后）写回全部段落：这类字段在 Paragraph 上而非 RunStyle 上 */
  const patchParagraph = (patch: {
    lineSpacing?: number;
    indent?: number;
    spaceBefore?: number;
    spaceAfter?: number;
  }) => {
    if (!body) return;
    apply({
      body: { ...body, paragraphs: body.paragraphs.map((p) => ({ ...p, ...patch })) },
    } as Partial<SlideElement>);
  };

  return (
    <div className="flex flex-col gap-3">
      <Section title={t('tools.slide.panelElement')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.slide.axisX')}>
            <NumberInput
              ariaLabel={t('tools.slide.axisX')}
              value={Math.round(element.x)}
              onChange={(value) => apply({ x: value })}
            />
          </Field>
          <Field label={t('tools.slide.axisY')}>
            <NumberInput
              ariaLabel={t('tools.slide.axisY')}
              value={Math.round(element.y)}
              onChange={(value) => apply({ y: value })}
            />
          </Field>
          <Field label={t('tools.slide.widthLabel')}>
            <NumberInput
              ariaLabel={t('tools.slide.widthLabel')}
              value={Math.round(element.width)}
              min={4}
              onChange={(value) => apply({ width: value })}
            />
          </Field>
          <Field label={t('tools.slide.heightLabel')}>
            <NumberInput
              ariaLabel={t('tools.slide.heightLabel')}
              value={Math.round(element.height)}
              min={4}
              onChange={(value) => apply({ height: value })}
            />
          </Field>
          <Field label={t('tools.slide.rotation')}>
            <NumberInput
              ariaLabel={t('tools.slide.rotation')}
              value={Math.round(element.rotation ?? 0)}
              min={-360}
              max={360}
              onChange={(value) => apply({ rotation: value })}
            />
          </Field>
          <Field label={t('tools.slide.opacity')}>
            <NumberInput
              ariaLabel={t('tools.slide.opacity')}
              value={Math.round((element.opacity ?? 1) * 100)}
              min={0}
              max={100}
              onChange={(value) => apply({ opacity: value / 100 })}
            />
          </Field>
        </div>
        {/* 层级 / 对齐 / 分布 / 组合 / 翻转 / 锁定 / 隐藏 都是「选中态操作」，
            已统一收进顶部工具栏的「排列」行；这里只保留数值属性，语义更干净。 */}
      </Section>

      {element.type === 'table' ? (
        <Section title={t('tools.slide.tableTitle')}>
          <Field label={t('tools.slide.tableRows')}>
            <NumberInput
              ariaLabel={t('tools.slide.tableRows')}
              value={element.rows.length}
              min={1}
              max={50}
              onChange={(rows) => setTableSize(rows, element.colWidths.length)}
            />
          </Field>
          <Field label={t('tools.slide.tableCols')}>
            <NumberInput
              ariaLabel={t('tools.slide.tableCols')}
              value={element.colWidths.length}
              min={1}
              max={50}
              onChange={(cols) => setTableSize(element.rows.length, cols)}
            />
          </Field>
          <ActionRow>
            <ActionButton
              label={t('tools.slide.headerRow')}
              onClick={() => apply({ headerRow: !element.headerRow } as Partial<SlideElement>)}
            />
            <ActionButton
              label={t('tools.slide.bandRow')}
              onClick={() => apply({ bandRow: !element.bandRow } as Partial<SlideElement>)}
            />
          </ActionRow>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {activeCell
              ? `${t('tools.slide.activeCell')}: ${activeCell.row + 1}, ${activeCell.col + 1}`
              : t('tools.slide.cellHint')}
          </p>
          {activeCell ? (
            <>
              <Field label={t('tools.slide.cellText')}>
                <TextInput
                  ariaLabel={t('tools.slide.cellText')}
                  value={element.rows[activeCell.row]?.[activeCell.col]?.text ?? ''}
                  onChange={(text) => patchTableCell(activeCell.row, activeCell.col, { text })}
                />
              </Field>
              <ActionRow>
                <ActionButton
                  label={t('tools.slide.mergeRight')}
                  disabled={activeCell.col >= element.rows[activeCell.row].length - 1}
                  onClick={mergeCellRight}
                />
                <ActionButton
                  label={t('tools.slide.splitCell')}
                  disabled={(element.rows[activeCell.row]?.[activeCell.col]?.colSpan ?? 1) <= 1}
                  onClick={splitCell}
                />
              </ActionRow>
            </>
          ) : null}
        </Section>
      ) : null}

      {element.type !== 'line' && element.type !== 'table' ? (
        <Section title={t('tools.slide.fill')}>
          <Field label={t('tools.slide.fill')}>
            <ColorInput
              ariaLabel={t('tools.slide.fill')}
              value={fill && fill.type === 'solid' ? fill.color : '#FFFFFF'}
              onChange={(color) => patchFill({ type: 'solid', color })}
            />
          </Field>
          <Field label={t('tools.slide.stroke')}>
            <ColorInput
              ariaLabel={t('tools.slide.stroke')}
              value={stroke?.color ?? '#000000'}
              onChange={(color) =>
                patchStroke({ color, width: stroke?.width ?? 1, dash: stroke?.dash })
              }
            />
          </Field>
          <Field label={t('tools.slide.strokeWidth')}>
            <NumberInput
              ariaLabel={t('tools.slide.strokeWidth')}
              value={stroke?.width ?? 0}
              min={0}
              step={0.5}
              onChange={(width) =>
                patchStroke({ color: stroke?.color ?? '#000000', width, dash: stroke?.dash })
              }
            />
          </Field>
          {/* 圆角：文本框与图片都支持（渲染与导出均已打通，此前只是没有入口） */}
          {element.type === 'text' || element.type === 'image' ? (
            <Field label={t('tools.slide.cornerRadius')}>
              <NumberInput
                ariaLabel={t('tools.slide.cornerRadius')}
                value={Math.round(cornerRadiusValue)}
                min={0}
                max={200}
                onChange={(value) => apply({ cornerRadius: value } as Partial<SlideElement>)}
              />
            </Field>
          ) : null}
          {element.type === 'image' ? (
            <>
              {(['left', 'top', 'right', 'bottom'] as const).map((side) => (
                <Field key={side} label={`${t('tools.slide.crop')}·${sideLabel(side)}`}>
                  <NumberInput
                    ariaLabel={`${t('tools.slide.crop')} ${side}`}
                    value={Math.round(cropValue(side) * 100)}
                    min={0}
                    max={90}
                    suffix="%"
                    onChange={(value) => patchCrop(side, value / 100)}
                  />
                </Field>
              ))}
            </>
          ) : null}
        </Section>
      ) : null}

      {body ? (
        <Section title={t('tools.slide.panelText')}>
          <Field label={t('tools.slide.fontFamily')}>
            <SelectInput
              ariaLabel={t('tools.slide.fontFamily')}
              value={firstStyle?.font ?? 'Arial'}
              options={FONT_OPTIONS}
              onChange={(font) => patchStyle({ font })}
            />
          </Field>
          <Field label={t('tools.slide.fontSize')}>
            <NumberInput
              ariaLabel={t('tools.slide.fontSize')}
              value={Math.round(firstStyle?.size ?? 18)}
              min={6}
              max={200}
              onChange={(size) => patchStyle({ size })}
            />
          </Field>
          <Field label={t('tools.slide.lineHeight')}>
            <NumberInput
              ariaLabel={t('tools.slide.lineHeight')}
              value={Number((body.paragraphs[0]?.lineSpacing ?? 1.2).toFixed(2))}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(lineSpacing) => patchParagraph({ lineSpacing })}
            />
          </Field>
          <Field label={t('tools.slide.indent')}>
            <NumberInput
              ariaLabel={t('tools.slide.indent')}
              value={Math.round(body.paragraphs[0]?.indent ?? 0)}
              min={0}
              max={400}
              onChange={(indent) => patchParagraph({ indent })}
            />
          </Field>
          <Field label={t('tools.slide.spaceBefore')}>
            <NumberInput
              ariaLabel={t('tools.slide.spaceBefore')}
              value={Math.round(body.paragraphs[0]?.spaceBefore ?? 0)}
              min={0}
              max={400}
              onChange={(spaceBefore) => patchParagraph({ spaceBefore })}
            />
          </Field>
          <Field label={t('tools.slide.spaceAfter')}>
            <NumberInput
              ariaLabel={t('tools.slide.spaceAfter')}
              value={Math.round(body.paragraphs[0]?.spaceAfter ?? 0)}
              min={0}
              max={400}
              onChange={(spaceAfter) => patchParagraph({ spaceAfter })}
            />
          </Field>
          <Field label={t('tools.slide.color')}>
            <ColorInput
              ariaLabel={t('tools.slide.color')}
              value={firstStyle?.color ?? '#000000'}
              onChange={(color) => patchStyle({ color })}
            />
          </Field>
          <ToggleGroup
            ariaLabel={t('tools.slide.panelText')}
            value={align}
            onChange={(value) => patchAlign(value)}
            options={[
              { value: 'left', label: t('tools.slide.alignLeft') },
              { value: 'center', label: t('tools.slide.alignCenter') },
              { value: 'right', label: t('tools.slide.alignRight') },
            ]}
          />
          <ActionRow>
            <ToggleGlyph
              label={t('tools.slide.bold')}
              active={Boolean(firstStyle?.bold)}
              onClick={() => patchStyle({ bold: !firstStyle?.bold })}
              text="B"
              bold
            />
            <ToggleGlyph
              label={t('tools.slide.italic')}
              active={Boolean(firstStyle?.italic)}
              onClick={() => patchStyle({ italic: !firstStyle?.italic })}
              text="I"
              italic
            />
            <ToggleGlyph
              label={t('tools.slide.underline')}
              active={Boolean(firstStyle?.underline)}
              onClick={() => patchStyle({ underline: !firstStyle?.underline })}
              text="U"
              underline
            />
            <ToggleGlyph
              label={t('tools.slide.strike')}
              active={Boolean(firstStyle?.strike)}
              onClick={() => patchStyle({ strike: !firstStyle?.strike })}
              text="S"
              strike
            />
            <ToggleGlyph
              label={t('tools.slide.bullet')}
              active={Boolean(body.paragraphs[0]?.bullet)}
              onClick={() =>
                apply({
                  body: {
                    ...body,
                    // 项目符号与编号互斥：开启其一时清掉另一个
                    paragraphs: body.paragraphs.map((p, index) =>
                      index === 0 ? { ...p, bullet: !p.bullet, numbering: false } : p,
                    ),
                  },
                } as Partial<SlideElement>)
              }
              text="•"
            />
            <ToggleGlyph
              label={t('tools.slide.numbering')}
              active={Boolean(body.paragraphs[0]?.numbering)}
              onClick={() =>
                apply({
                  body: {
                    ...body,
                    paragraphs: body.paragraphs.map((p, index) =>
                      index === 0 ? { ...p, numbering: !p.numbering, bullet: false } : p,
                    ),
                  },
                } as Partial<SlideElement>)
              }
              text="1."
            />
          </ActionRow>

          {/* run 级扩展属性：字距 / 上下标 / 高亮（DrawingML a:spc / baseline / highlight） */}
          <Field label={t('tools.slide.charSpacing')}>
            <NumberInput
              ariaLabel={t('tools.slide.charSpacing')}
              value={Number((firstStyle?.spacing ?? 0).toFixed(1))}
              min={-10}
              max={40}
              step={0.5}
              onChange={(spacing) => patchStyle({ spacing })}
            />
          </Field>
          <Field label={t('tools.slide.highlight')}>
            <ColorInput
              ariaLabel={t('tools.slide.highlight')}
              value={firstStyle?.highlight ?? '#FFFFFF'}
              onChange={(highlight) => patchStyle({ highlight })}
            />
          </Field>
          <ActionRow>
            <ToggleGlyph
              label={t('tools.slide.superscript')}
              active={(firstStyle?.baseline ?? 0) > 0}
              onClick={() => patchStyle({ baseline: (firstStyle?.baseline ?? 0) > 0 ? 0 : 30 })}
              text="x²"
            />
            <ToggleGlyph
              label={t('tools.slide.subscript')}
              active={(firstStyle?.baseline ?? 0) < 0}
              onClick={() => patchStyle({ baseline: (firstStyle?.baseline ?? 0) < 0 ? 0 : -25 })}
              text="x₂"
            />
            <ToggleGlyph
              label={t('tools.slide.textVertical')}
              active={Boolean(body.vert && body.vert !== 'horz')}
              onClick={() =>
                apply({
                  body: {
                    ...body,
                    vert: body.vert && body.vert !== 'horz' ? 'horz' : 'vert',
                  },
                } as Partial<SlideElement>)
              }
              text="▤"
            />
          </ActionRow>
        </Section>
      ) : null}

      {element.type === 'chart' ? <ChartEditor element={element} /> : null}

      {element.type === 'formula' ? (
        <Section title={t('tools.slide.panelFormula')}>
          <Field label={t('tools.slide.formulaLabel')}>
            <TextArea
              ariaLabel={t('tools.slide.formulaLabel')}
              value={element.latex}
              onChange={(latex) => apply({ latex } as Partial<SlideElement>)}
            />
          </Field>
          <Field label={t('tools.slide.fontSize')}>
            <NumberInput
              ariaLabel={t('tools.slide.fontSize')}
              value={Math.round(element.fontSize ?? 32)}
              min={8}
              max={160}
              onChange={(fontSize) => apply({ fontSize } as Partial<SlideElement>)}
            />
          </Field>
          <Field label={t('tools.slide.color')}>
            <ColorInput
              ariaLabel={t('tools.slide.color')}
              value={element.color ?? '#111827'}
              onChange={(color) => apply({ color } as Partial<SlideElement>)}
            />
          </Field>
        </Section>
      ) : null}

      {element.type === 'icon' ? (
        <Section title={t('tools.slide.panelIcon')}>
          <Field label={t('tools.slide.color')}>
            <ColorInput
              ariaLabel={t('tools.slide.color')}
              value={element.color ?? '#2563EB'}
              onChange={(color) => apply({ color } as Partial<SlideElement>)}
            />
          </Field>
        </Section>
      ) : null}

      {/* 元素级超链接（DrawingML a:hlinkClick）：导出时由 pptxgen 通道写出 */}
      <Section title={t('tools.slide.panelLink')}>
        <Field label={t('tools.slide.hyperlink')}>
          <TextInput
            ariaLabel={t('tools.slide.hyperlink')}
            value={element.hyperlink ?? ''}
            placeholder={t('tools.slide.hyperlinkHint')}
            onChange={(hyperlink) => apply({ hyperlink: hyperlink || undefined })}
          />
        </Field>
      </Section>

      <Section title={t('tools.slide.panelShadow')}>
        <Field label={t('tools.slide.shadowColor')}>
          <ColorInput
            ariaLabel={t('tools.slide.shadowColor')}
            value={element.shadow?.color ?? '#000000'}
            onChange={(color) =>
              apply({
                shadow: { color, blur: 8, offsetX: 2, offsetY: 2, ...element.shadow },
              })
            }
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={t('tools.slide.shadowBlur')}>
            <NumberInput
              ariaLabel={t('tools.slide.shadowBlur')}
              value={Math.round(element.shadow?.blur ?? 0)}
              min={0}
              max={80}
              onChange={(blur) =>
                apply({
                  shadow: {
                    color: '#000000',
                    offsetX: 2,
                    offsetY: 2,
                    ...element.shadow,
                    blur,
                  },
                })
              }
            />
          </Field>
          <Field label={t('tools.slide.shadowOffsetX')}>
            <NumberInput
              ariaLabel={t('tools.slide.shadowOffsetX')}
              value={Math.round(element.shadow?.offsetX ?? 0)}
              min={-60}
              max={60}
              onChange={(offsetX) =>
                apply({
                  shadow: {
                    color: '#000000',
                    blur: 8,
                    offsetY: 2,
                    ...element.shadow,
                    offsetX,
                  },
                })
              }
            />
          </Field>
          <Field label={t('tools.slide.shadowOffsetY')}>
            <NumberInput
              ariaLabel={t('tools.slide.shadowOffsetY')}
              value={Math.round(element.shadow?.offsetY ?? 0)}
              min={-60}
              max={60}
              onChange={(offsetY) =>
                apply({
                  shadow: {
                    color: '#000000',
                    blur: 8,
                    offsetX: 2,
                    ...element.shadow,
                    offsetY,
                  },
                })
              }
            />
          </Field>
        </div>
      </Section>

      {/* 页面级设置只在普通视图出现：母版视图下母版背景由 MasterView 提供入口 */}
      {viewMode === 'normal' ? (
        <Section title={t('tools.slide.panelPage')}>
          <Field label={t('tools.slide.background')}>
            <ColorInput
              ariaLabel={t('tools.slide.background')}
              value={backgroundToColor(pageBackground, doc.theme.colors.lt1 ?? '#FFFFFF')}
              onChange={(color) => updateSlide({ background: color })}
            />
          </Field>
          <ActionRow>
            <button
              type="button"
              onClick={duplicateSelected}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Icon name="copy" className="h-3.5 w-3.5" />
              {t('tools.slide.duplicate')}
            </button>
            <button
              type="button"
              onClick={removeSelected}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-red-300 px-2 text-[11px] text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
              {t('tools.slide.deleteSlide')}
            </button>
          </ActionRow>
        </Section>
      ) : null}
    </div>
  );
}

/** 文字型动作按钮（对齐/组合/锁定等），禁用态统一置灰 */
function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 items-center rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {label}
    </button>
  );
}

function ToggleGlyph({
  label,
  active,
  onClick,
  text,
  bold,
  italic,
  underline,
  strike,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-7 w-8 items-center justify-center rounded-md border text-[12px] transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
      } ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''} ${
        strike ? 'line-through' : ''
      }`}
    >
      {text}
    </button>
  );
}

/** 裁剪四边的方向标记（语言无关，避免为四个方向各加 9 语文案） */
function sideLabel(side: 'left' | 'top' | 'right' | 'bottom'): string {
  return side === 'left' ? '←' : side === 'top' ? '↑' : side === 'right' ? '→' : '↓';
}
