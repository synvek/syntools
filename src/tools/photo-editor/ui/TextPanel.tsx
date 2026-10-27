import { useTranslation } from 'react-i18next';
import { FONT_FAMILIES, MAX_WARP_AMOUNT, TEXT_WARP_KINDS } from '../core';
import {
  Button,
  Field,
  NumberInput,
  PanelSection,
  Select,
  Slider,
  TextInput,
  ToggleChip,
} from './controls';
import { usePhotoStore } from '../store';
import type { TextAlign, TextWarpKind } from '../model/types';

/**
 * Text panel: character + paragraph + warp in three sections (mirroring Photoshop's "Character / Paragraph / Warp Text").
 *
 * The Properties panel keeps only the "content" quick edit; every layout detail is gathered here so the same parameters cannot drift apart.
 * Warp style names are proper nouns and go through i18n as `textWarp_<kind>`.
 */
export function TextPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

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

  return (
    <div className="flex flex-col gap-3">
      <PanelSection title={t('tools.photo.textContent')}>
        <TextInput
          ariaLabel={t('tools.photo.textContent')}
          value={layer.text}
          onChange={(text) => patchActive({ text } as never, false)}
        />
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
              onChange={(fontSize) => patchActive({ fontSize } as never, false)}
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
            active={layer.bold}
            onClick={() => patchActive({ bold: !layer.bold } as never)}
          />
          <ToggleChip
            label={t('tools.photo.italic')}
            active={layer.italic}
            onClick={() => patchActive({ italic: !layer.italic } as never)}
          />
          <ToggleChip
            label={t('tools.photo.underline')}
            active={layer.underline}
            onClick={() => patchActive({ underline: !layer.underline } as never)}
          />
        </div>
        <Field label={t('tools.photo.color')}>
          <input
            type="color"
            aria-label={t('tools.photo.textColor')}
            value={layer.fill}
            onChange={(event) => patchActive({ fill: event.target.value } as never)}
            className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
          />
        </Field>
      </PanelSection>

      <PanelSection title={t('tools.photo.textParagraph')}>
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
