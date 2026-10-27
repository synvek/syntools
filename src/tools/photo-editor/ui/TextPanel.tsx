import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FONT_FAMILIES, MAX_WARP_AMOUNT, TEXT_WARP_KINDS } from '../core';
import {
  Button,
  Field,
  NumberInput,
  PanelSection,
  Select,
  Slider,
  TextArea,
  ToggleChip,
} from './controls';
import { usePhotoStore } from '../store';
import { applyRunStyleToRange, rangeRunStyle } from '../model/textRuns';
import type {
  TextAlign,
  TextDirection,
  TextLayer,
  TextRunStyle,
  TextWarpKind,
} from '../model/types';

/**
 * Text panel: content + character + paragraph + warp in separate sections
 * (mirroring Photoshop's "Character / Paragraph / Warp Text").
 *
 * Multi-line & rich text:
 * - the content field is a textarea, so Enter inserts a real newline;
 * - selecting part of the text and using the character buttons applies the style only to that range
 *   (`model/textRuns.ts`); with no selection the whole layer's default is changed.
 *
 * The Properties panel keeps only the "content" quick edit; every layout detail is gathered here so the
 * same parameters cannot drift apart. Warp style names are proper nouns and go through i18n as `textWarp_<kind>`.
 */
export function TextPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);
  const layerId = layer?.id;
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // Character indexes are per layer: reset when the selection moves to another text layer
  useEffect(() => {
    setSelection({ start: 0, end: 0 });
  }, [layerId]);

  if (!layer || layer.kind !== 'text') {
    return (
      <p className="px-1 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.photo.textPanelHint')}
      </p>
    );
  }

  const aligns: TextAlign[] = ['left', 'center', 'right'];
  const alignLabel: Record<TextAlign, string> = {
    left: t('tools.photo.alignLeft'),
    center: t('tools.photo.alignCenter'),
    right: t('tools.photo.alignRight'),
  };
  const warp = layer.warp;
  const warpLabel = (kind: TextWarpKind) => t(`tools.photo.textWarp_${kind}`);

  const text = layer.text;
  const hasRange = selection.end > selection.start;
  /** No selection (or the whole text selected) → edit the layer default; otherwise only the selected chars */
  const coversAll = !hasRange || (selection.start === 0 && selection.end >= text.length);

  const styleActive = (key: 'bold' | 'italic' | 'underline'): boolean =>
    coversAll ? layer[key] : Boolean(rangeRunStyle(layer, selection.start, selection.end)[key]);

  const applyCharStyle = (patch: TextRunStyle, layerPatch: Partial<TextLayer>) => {
    if (coversAll) {
      patchActive(
        {
          ...layerPatch,
          // Existing runs must follow the new default too, or their overrides would mask the change
          ...(layer.runs && layer.runs.length > 0
            ? { runs: applyRunStyleToRange(layer, 0, text.length, patch) }
            : {}),
        } as never,
        false,
      );
      return;
    }
    patchActive(
      { runs: applyRunStyleToRange(layer, selection.start, selection.end, patch) } as never,
      false,
    );
  };

  const toggleFlag = (key: 'bold' | 'italic' | 'underline') => {
    const next = !styleActive(key);
    applyCharStyle({ [key]: next }, { [key]: next } as Partial<TextLayer>);
  };

  return (
    <div className="flex flex-col gap-3">
      <PanelSection title={t('tools.photo.textContent')}>
        <TextArea
          ariaLabel={t('tools.photo.textContent')}
          value={text}
          onChange={(value) => patchActive({ text: value } as never, false)}
          onSelect={(start, end) => setSelection({ start, end })}
        />
        <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
          {t('tools.photo.textMultiLineHint')}
        </p>
      </PanelSection>

      <PanelSection title={t('tools.photo.textCharacter')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.photo.fontFamily')}>
            <Select
              ariaLabel={t('tools.photo.fontFamily')}
              value={layer.fontFamily}
              options={FONT_FAMILIES}
              onChange={(fontFamily) => patchActive({ fontFamily } as never)}
            />
          </Field>
          <Field label={t('tools.photo.fontSize')}>
            <NumberInput
              ariaLabel={t('tools.photo.fontSize')}
              value={Math.round(layer.fontSize)}
              min={6}
              max={400}
              onChange={(fontSize) => applyCharStyle({ fontSize }, { fontSize })}
            />
          </Field>
          <Field label={t('tools.photo.letterSpacing')}>
            <NumberInput
              ariaLabel={t('tools.photo.letterSpacing')}
              value={Math.round(layer.letterSpacing ?? 0)}
              min={-50}
              max={200}
              onChange={(letterSpacing) => patchActive({ letterSpacing } as never, false)}
            />
          </Field>
        </div>
        <Slider
          label={t('tools.photo.lineHeight')}
          value={Math.round((layer.lineHeight ?? 1.4) * 100)}
          min={100}
          max={400}
          onChange={(value) => patchActive({ lineHeight: value / 100 } as never, false)}
          suffix="%"
        />
        <div className="flex flex-wrap gap-1">
          <ToggleChip
            label={t('tools.photo.bold')}
            active={styleActive('bold')}
            onClick={() => toggleFlag('bold')}
          />
          <ToggleChip
            label={t('tools.photo.italic')}
            active={styleActive('italic')}
            onClick={() => toggleFlag('italic')}
          />
          <ToggleChip
            label={t('tools.photo.underline')}
            active={styleActive('underline')}
            onClick={() => toggleFlag('underline')}
          />
        </div>
        <Field label={t('tools.photo.color')}>
          <input
            type="color"
            aria-label={t('tools.photo.textColor')}
            value={layer.fill}
            onChange={(event) =>
              applyCharStyle({ fill: event.target.value }, { fill: event.target.value })
            }
            className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
          />
        </Field>
        <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
          {t('tools.photo.richTextHint')}
        </p>
        <Button
          onClick={() => patchActive({ runs: undefined } as never)}
          title={t('tools.photo.clearFormatting')}
        >
          {t('tools.photo.clearFormatting')}
        </Button>
      </PanelSection>

      <PanelSection title={t('tools.photo.textParagraph')}>
        <Field label={t('tools.photo.textDirection')}>
          <div className="flex gap-1">
            {(['horizontal', 'vertical'] as TextDirection[]).map((direction) => (
              <ToggleChip
                key={direction}
                label={
                  direction === 'horizontal'
                    ? t('tools.photo.textHorizontal')
                    : t('tools.photo.textVertical')
                }
                active={(layer.direction ?? 'horizontal') === direction}
                onClick={() => patchActive({ direction } as never)}
              />
            ))}
          </div>
        </Field>
        <Field label={t('tools.photo.alignment')}>
          <div className="flex gap-1">
            {aligns.map((align) => (
              <ToggleChip
                key={align}
                label={alignLabel[align]}
                active={layer.align === align}
                onClick={() => patchActive({ align } as never)}
              />
            ))}
          </div>
        </Field>
        <Field label={t('tools.photo.paragraphSpacing')}>
          <NumberInput
            ariaLabel={t('tools.photo.paragraphSpacing')}
            value={Math.round(layer.paragraphSpacing ?? 0)}
            min={0}
            max={400}
            onChange={(paragraphSpacing) => patchActive({ paragraphSpacing } as never, false)}
          />
        </Field>
      </PanelSection>

      <PanelSection title={t('tools.photo.textWarp')}>
        <Field label={t('tools.photo.warpStyle')}>
          <Select
            ariaLabel={t('tools.photo.warpStyle')}
            value={warp.kind}
            options={TEXT_WARP_KINDS.map((kind) => ({ id: kind, label: warpLabel(kind) }))}
            onChange={(kind) =>
              patchActive({ warp: { ...warp, kind: kind as TextWarpKind } } as never)
            }
          />
        </Field>
        <Slider
          label={t('tools.photo.warpBend')}
          value={warp.bend}
          min={-MAX_WARP_AMOUNT}
          max={MAX_WARP_AMOUNT}
          onChange={(bend) => patchActive({ warp: { ...warp, bend } } as never, false)}
          suffix="%"
        />
        <Slider
          label={t('tools.photo.warpHorizontal')}
          value={warp.horizontal}
          min={-MAX_WARP_AMOUNT}
          max={MAX_WARP_AMOUNT}
          onChange={(horizontal) => patchActive({ warp: { ...warp, horizontal } } as never, false)}
          suffix="%"
        />
        <Button
          onClick={() => patchActive({ warp: { kind: 'none', bend: 0, horizontal: 0 } } as never)}
          title={t('tools.photo.warpReset')}
        >
          {t('tools.photo.warpReset')}
        </Button>
      </PanelSection>
    </div>
  );
}
