import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { backgroundToColor } from '../core';
import { shapeAdjustValues, shapeAdjustments } from '../../../core/drawing/shapeDefs';
import type { Fill, RunStyle, SlideElement, Stroke } from '../model/types';
import { fillColorOf, fillPatch, supportsFill } from '../model/format';
import { createMediaFromFile } from '../model/media';
import { PATTERN_PRESETS } from '../model/patterns';
import { patternTileUrl } from '../render/patternTile';
import { containerElements, useSlideStore } from '../store';
import { ChartEditor } from './ChartEditor';
import {
  ActionRow,
  ColorInput,
  Field,
  NumberInput,
  Section,
  TextArea,
  TextInput,
  ToggleGroup,
} from './controls';

/** Right-side property panel: edits the slide when nothing is selected, the element (position/fill/text/z-order) when something is */
export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const viewMode = useSlideStore((s) => s.viewMode);
  const masterKind = useSlideStore((s) => s.masterKind);
  const masterIndex = useSlideStore((s) => s.masterIndex);
  const selection = useSlideStore((s) => s.selection);
  const patchElement = useSlideStore((s) => s.patchElement);
  const setShapeAdjustment = useSlideStore((s) => s.setShapeAdjustment);
  const updateSlide = useSlideStore((s) => s.updateSlide);
  const removeSelected = useSlideStore((s) => s.removeSelected);
  const duplicateSelected = useSlideStore((s) => s.duplicateSelected);

  // Always read elements from the "current editing container": master view edits master/layout elements
  const element = containerElements({ doc, viewMode, slideIndex, masterKind, masterIndex }).find(
    (item) => item.id === selection[selection.length - 1],
  );
  const activeCell = useSlideStore((s) => s.activeCell);
  const setTableSize = useSlideStore((s) => s.setTableSize);
  const patchTableCell = useSlideStore((s) => s.patchTableCell);
  const mergeCellRight = useSlideStore((s) => s.mergeCellRight);
  const splitCell = useSlideStore((s) => s.splitCell);

  // Slide-level background/notes always come from the "current slide", whatever the container (neither shows in master view)
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
        {/* Notes are a slide-level property, so the "no element selected" branch is the most natural home */}
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

  /** Pattern fill currently on the element (P2-S4); `undefined` for solid / gradient / none */
  const activePatternFill =
    supportsFill(element) && element.fill?.type === 'pattern' ? element.fill : undefined;
  /** `fillPatch` returns null for elements without a fill; the panel only renders this section for those that have one */
  const applyFill = (fill: Fill) => {
    const patch = fillPatch(element, fill);
    if (patch) apply(patch);
  };
  /** Picture fill currently on the element (P2-S4.2) */
  const activeImageFill =
    supportsFill(element) && element.fill?.type === 'image' ? element.fill : undefined;
  /**
   * Picture fill: the file becomes a normal media asset (so it is shared with any `p:pic` using the
   * same bytes) and the element only stores the media id.
   */
  const chooseFillPicture = async (file: File) => {
    const result = await createMediaFromFile(file);
    if (!result.ok) return;
    const asset = result.value;
    useSlideStore.setState((state) => ({
      doc: {
        ...state.doc,
        media: { ...state.doc.media, [asset.id]: asset },
        version: state.doc.version + 1,
      },
    }));
    applyFill({ type: 'image', mediaId: asset.id, mode: 'stretch' });
  };

  const stroke =
    element.type === 'shape' || element.type === 'text' || element.type === 'image'
      ? element.stroke
      : element.type === 'line'
        ? element.stroke
        : undefined;
  const body =
    element.type === 'text' ? element.body : element.type === 'shape' ? element.body : undefined;
  const firstStyle: RunStyle | undefined = body?.paragraphs[0]?.runs[0]?.style;
  const cropValue = (side: 'left' | 'top' | 'right' | 'bottom'): number =>
    element.type === 'image' ? (element.crop?.[side] ?? 0) : 0;

  const patchCrop = (side: 'left' | 'top' | 'right' | 'bottom', value: number) => {
    if (element.type !== 'image') return;
    apply({
      crop: { left: 0, top: 0, right: 0, bottom: 0, ...element.crop, [side]: value },
    } as Partial<SlideElement>);
  };

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
  /** Paragraph-level props (line spacing/indent/space before and after) write to every paragraph: they live on Paragraph, not RunStyle */
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
        </div>
        {/* Z-order / align / distribute / group / flip / lock / hide are all selection-only actions,
            now collected in the toolbar's "arrange" row; opacity/radius are in the "format" row;
            only geometry that needs exact numbers is left here, which keeps the semantics clean. */}
      </Section>

      {element.type === 'shape' && shapeAdjustments(element.geom.prst).length > 0 ? (
        <Section title={t('tools.slide.shapeAdjust')}>
          <div className="grid grid-cols-2 gap-2">
            {shapeAdjustments(element.geom.prst).map((spec, index) => {
              const values = shapeAdjustValues(element.geom);
              return (
                <Field key={spec.id} label={`${t('tools.slide.shapeAdjust')} ${index + 1}`}>
                  <NumberInput
                    ariaLabel={`${t('tools.slide.shapeAdjust')} ${index + 1}`}
                    value={Math.round(values[spec.id] * 100)}
                    min={Math.round(spec.min * 100)}
                    max={Math.round(spec.max * 100)}
                    onChange={(value) => setShapeAdjustment(element.id, { [spec.id]: value / 100 })}
                  />
                </Field>
              );
            })}
          </div>
        </Section>
      ) : null}

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

      {/*
        填充色 / 描边色 / 线宽 / 圆角已移到顶部工具栏的「格式」行（高频改色不该来回跑面板）。
        这里只保留需要精确数值的裁剪四边与描边线宽之外的细节。
      */}
      {element.type === 'image' ? (
        <Section title={t('tools.slide.panelImage')}>
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
        </Section>
      ) : null}

      {/* Line: color and weight live in the toolbar's "outline" dropdown; only the dash style stays here */}
      {element.type === 'line' ? (
        <Section title={t('tools.slide.panelLine')}>
          <Field label={t('tools.slide.strokeStyle')}>
            <ToggleGroup
              ariaLabel={t('tools.slide.strokeStyle')}
              value={stroke?.dash?.length ? 'dashed' : 'solid'}
              onChange={(value) =>
                patchStroke({
                  color: stroke?.color ?? '#000000',
                  width: stroke?.width ?? 2,
                  dash: value === 'dashed' ? [8, 6] : undefined,
                })
              }
              options={[
                { value: 'solid', label: t('tools.slide.strokeSolid') },
                { value: 'dashed', label: t('tools.slide.strokeDashed') },
              ]}
            />
          </Field>
        </Section>
      ) : null}

      {/*
        文字：字体 / 字号 / 字形 / 颜色 / 高亮 / 对齐 / 行距 / 项目符号 已移到顶部工具栏
        「格式」行；这里保留需要精确数值或低频的项（缩进、段距、字距、上下标、竖排）。
      */}
      {body ? (
        <Section title={t('tools.slide.panelText')}>
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

          {/* Run-level extras: letter spacing / baseline (DrawingML a:spc / baseline), low-frequency items the toolbar skips */}
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

      {/* Element-level hyperlink (DrawingML a:hlinkClick): written by the pptxgen channel on export */}
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

      {/* P2-S4: 图案填充。纯色/无填充留在工具栏（高频），图案属于低频、需要预览的操作 */}
      {supportsFill(element) ? (
        <Section title={t('tools.slide.panelPattern')}>
          <div className="grid grid-cols-5 gap-1.5">
            {PATTERN_PRESETS.map((prst) => (
              <button
                key={prst}
                type="button"
                data-pattern-preset={prst}
                aria-label={prst}
                title={prst}
                onClick={() =>
                  // Switching preset keeps the user's inks instead of resetting them
                  applyFill(
                    activePatternFill
                      ? { ...activePatternFill, prst }
                      : {
                          type: 'pattern',
                          prst,
                          fgColor: fillColorOf(element) ?? '#1F3864',
                          bgColor: '#FFFFFF',
                        },
                  )
                }
                className={`h-8 rounded-md border transition-shadow ${
                  activePatternFill?.prst === prst
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                    : 'border-gray-300 hover:border-blue-400 dark:border-gray-600'
                }`}
                style={{
                  backgroundImage: `url(${patternTileUrl(
                    prst,
                    activePatternFill?.fgColor ?? '#1F3864',
                    activePatternFill?.bgColor ?? '#FFFFFF',
                  )})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '8px 8px',
                }}
              />
            ))}
          </div>
          {activePatternFill ? (
            <>
              <Field label={t('tools.slide.patternForeground')}>
                <ColorInput
                  ariaLabel={t('tools.slide.patternForeground')}
                  value={activePatternFill.fgColor}
                  onChange={(fgColor) => applyFill({ ...activePatternFill, fgColor })}
                />
              </Field>
              <Field label={t('tools.slide.patternBackground')}>
                <ColorInput
                  ariaLabel={t('tools.slide.patternBackground')}
                  value={activePatternFill.bgColor}
                  onChange={(bgColor) => applyFill({ ...activePatternFill, bgColor })}
                />
              </Field>
            </>
          ) : null}
        </Section>
      ) : null}

      {/* P2-S4.2: 图片填充。图片进 doc.media，元素只存 mediaId，因此与普通图片共用同一份资源 */}
      {supportsFill(element) ? (
        <Section title={t('tools.slide.panelPictureFill')}>
          <ActionRow>
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              {activeImageFill ? t('tools.slide.replacePicture') : t('tools.slide.choosePicture')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml"
                className="hidden"
                data-testid="picture-fill-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void chooseFillPicture(file);
                }}
              />
            </label>
            {activeImageFill ? (
              <button
                type="button"
                onClick={() => applyFill({ type: 'none' })}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {t('tools.slide.clearPictureFill')}
              </button>
            ) : null}
          </ActionRow>
          {activeImageFill ? (
            <>
              <Field label={t('tools.slide.pictureFillMode')}>
                <ToggleGroup
                  ariaLabel={t('tools.slide.pictureFillMode')}
                  value={activeImageFill.mode}
                  options={[
                    { value: 'stretch' as const, label: t('tools.slide.pictureFillStretch') },
                    { value: 'tile' as const, label: t('tools.slide.pictureFillTile') },
                  ]}
                  onChange={(mode) => applyFill({ ...activeImageFill, mode })}
                />
              </Field>
              {activeImageFill.mode === 'tile' ? (
                <Field label={t('tools.slide.pictureFillScale')}>
                  <NumberInput
                    ariaLabel={t('tools.slide.pictureFillScale')}
                    value={Math.round(activeImageFill.scale ?? 100)}
                    min={5}
                    max={400}
                    onChange={(scale) => applyFill({ ...activeImageFill, scale })}
                  />
                </Field>
              ) : null}
            </>
          ) : null}
        </Section>
      ) : null}

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

      {/* P2-S3.1: glow. 半径 0 视为"没有光晕" —— 否则会导出一个 rad="0" 的 a:glow */}
      <Section title={t('tools.slide.panelGlow')}>
        <Field label={t('tools.slide.glowColor')}>
          <ColorInput
            ariaLabel={t('tools.slide.glowColor')}
            value={element.glow?.color ?? '#38BDF8'}
            onChange={(color) => apply({ glow: { color, radius: 8, ...element.glow } })}
          />
        </Field>
        <Field label={t('tools.slide.glowRadius')}>
          <NumberInput
            ariaLabel={t('tools.slide.glowRadius')}
            value={Math.round(element.glow?.radius ?? 0)}
            min={0}
            max={80}
            onChange={(radius) =>
              apply({
                glow: radius > 0 ? { color: '#38BDF8', ...element.glow, radius } : undefined,
              })
            }
          />
        </Field>
      </Section>

      {/* P2-S3.2: soft edge. 半径 0 视为"没有柔化"，与 glow 同一规则 */}
      <Section title={t('tools.slide.panelSoftEdge')}>
        <Field label={t('tools.slide.softEdgeRadius')}>
          <NumberInput
            ariaLabel={t('tools.slide.softEdgeRadius')}
            value={Math.round(element.softEdge?.radius ?? 0)}
            min={0}
            max={120}
            onChange={(radius) => apply({ softEdge: radius > 0 ? { radius } : undefined })}
          />
        </Field>
      </Section>

      {/* P2-S3.3: 内阴影。几何与外部阴影一致，但画在剪影内侧；默认 6/4/4 让新加的效果立刻可见 */}
      <Section title={t('tools.slide.panelInnerShadow')}>
        <Field label={t('tools.slide.innerShadowColor')}>
          <ColorInput
            ariaLabel={t('tools.slide.innerShadowColor')}
            value={element.innerShadow?.color ?? '#000000'}
            onChange={(color) =>
              apply({
                innerShadow: { blur: 6, offsetX: 4, offsetY: 4, ...element.innerShadow, color },
              })
            }
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label={t('tools.slide.innerShadowBlur')}>
            <NumberInput
              ariaLabel={t('tools.slide.innerShadowBlur')}
              value={Math.round(element.innerShadow?.blur ?? 0)}
              min={0}
              max={80}
              onChange={(blur) =>
                apply({
                  innerShadow: {
                    color: '#000000',
                    offsetX: 4,
                    offsetY: 4,
                    ...element.innerShadow,
                    blur,
                  },
                })
              }
            />
          </Field>
          <Field label={t('tools.slide.innerShadowOffsetX')}>
            <NumberInput
              ariaLabel={t('tools.slide.innerShadowOffsetX')}
              value={Math.round(element.innerShadow?.offsetX ?? 0)}
              min={-60}
              max={60}
              onChange={(offsetX) =>
                apply({
                  innerShadow: {
                    color: '#000000',
                    blur: 6,
                    offsetY: 4,
                    ...element.innerShadow,
                    offsetX,
                  },
                })
              }
            />
          </Field>
          <Field label={t('tools.slide.innerShadowOffsetY')}>
            <NumberInput
              ariaLabel={t('tools.slide.innerShadowOffsetY')}
              value={Math.round(element.innerShadow?.offsetY ?? 0)}
              min={-60}
              max={60}
              onChange={(offsetY) =>
                apply({
                  innerShadow: {
                    color: '#000000',
                    blur: 6,
                    offsetX: 4,
                    ...element.innerShadow,
                    offsetY,
                  },
                })
              }
            />
          </Field>
        </div>
      </Section>

      {/* Page-level settings only appear in normal view: in master view MasterView provides the master background entry */}
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

/** Text action button (align/group/lock etc.), grayed out when disabled */
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

/** Direction markers for the four crop edges (language-neutral, so no 9-language copy per direction) */
function sideLabel(side: 'left' | 'top' | 'right' | 'bottom'): string {
  return side === 'left' ? '←' : side === 'top' ? '↑' : side === 'right' ? '→' : '↓';
}
