import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { Fill, RunStyle, SlideElement, Stroke, TextAlign } from '../model/types';
import { useSlideStore } from '../store';
import { ActionRow, ColorInput, Field, NumberInput, Section, ToggleGroup } from './controls';

/** 右侧属性面板：无选中时编辑页面，选中时编辑元素（位置/填充/文字/层序） */
export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = useSlideStore((s) => s.doc);
  const slideIndex = useSlideStore((s) => s.slideIndex);
  const selection = useSlideStore((s) => s.selection);
  const patchElement = useSlideStore((s) => s.patchElement);
  const updateSlide = useSlideStore((s) => s.updateSlide);
  const removeSelected = useSlideStore((s) => s.removeSelected);
  const duplicateSelected = useSlideStore((s) => s.duplicateSelected);
  const bringForward = useSlideStore((s) => s.bringForward);
  const sendBackward = useSlideStore((s) => s.sendBackward);

  const slide = doc.slides[slideIndex];
  const element = slide?.elements.find((item) => item.id === selection[selection.length - 1]);

  if (!element) {
    return (
      <div className="flex flex-col gap-3">
        <Section title={t('tools.slide.panelPage')}>
          <Field label={t('tools.slide.background')}>
            <ColorInput
              ariaLabel={t('tools.slide.background')}
              value={slide?.background ?? doc.theme.colors.lt1 ?? '#FFFFFF'}
              onChange={(color) => updateSlide({ background: color })}
            />
          </Field>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {t('tools.slide.noSelection')}
          </p>
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
        <ActionRow>
          <button
            type="button"
            onClick={() => apply({ flipX: !element.flipX })}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.flipH')}
          </button>
          <button
            type="button"
            onClick={() => apply({ flipY: !element.flipY })}
            className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('tools.slide.flipV')}
          </button>
          <ToggleGlyph
            label={t('tools.slide.bringForward')}
            active={false}
            onClick={bringForward}
            text="↑"
          />
          <ToggleGlyph
            label={t('tools.slide.sendBackward')}
            active={false}
            onClick={sendBackward}
            text="↓"
          />
        </ActionRow>
      </Section>

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
        </Section>
      ) : null}

      {body ? (
        <Section title={t('tools.slide.panelText')}>
          <Field label={t('tools.slide.fontSize')}>
            <NumberInput
              ariaLabel={t('tools.slide.fontSize')}
              value={Math.round(firstStyle?.size ?? 18)}
              min={6}
              max={200}
              onChange={(size) => patchStyle({ size })}
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
              label={t('tools.slide.bullet')}
              active={Boolean(body.paragraphs[0]?.bullet)}
              onClick={() =>
                apply({
                  body: {
                    ...body,
                    paragraphs: body.paragraphs.map((p, index) =>
                      index === 0 ? { ...p, bullet: !p.bullet } : p,
                    ),
                  },
                } as Partial<SlideElement>)
              }
              text="•"
            />
          </ActionRow>
        </Section>
      ) : null}

      <Section title={t('tools.slide.panelPage')}>
        <Field label={t('tools.slide.background')}>
          <ColorInput
            ariaLabel={t('tools.slide.background')}
            value={slide?.background ?? doc.theme.colors.lt1 ?? '#FFFFFF'}
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
    </div>
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
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
      } ${bold ? 'font-bold' : ''} ${italic ? 'italic' : ''} ${underline ? 'underline' : ''}`}
    >
      {text}
    </button>
  );
}
