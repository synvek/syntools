import { useTranslation } from 'react-i18next';
import {
  Field,
  NumberInput,
  PanelSection,
  Select,
  Slider,
  TextInput,
  ToggleChip,
} from './controls';
import { usePhotoStore } from '../store';
import type { TextAlign } from '../model/types';

const FONT_FAMILIES = [
  { id: 'PingFang SC', label: '苹方 / PingFang SC' },
  { id: 'Microsoft YaHei', label: '微软雅黑' },
  { id: 'Noto Serif SC', label: '宋体 / Serif' },
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Courier New', label: 'Courier New' },
];

/** 属性面板：几何 + 文字 / 形状各自的样式属性。 */
export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  if (!layer) {
    return (
      <p className="px-1 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('tools.photo.noLayer')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelSection title={t('tools.photo.tabProperty')}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('tools.photo.posX')}>
            <NumberInput
              ariaLabel={t('tools.photo.posX')}
              value={Math.round(layer.x)}
              onChange={(x) => patchActive({ x }, false)}
            />
          </Field>
          <Field label={t('tools.photo.posY')}>
            <NumberInput
              ariaLabel={t('tools.photo.posY')}
              value={Math.round(layer.y)}
              onChange={(y) => patchActive({ y }, false)}
            />
          </Field>
          <Field label={t('tools.photo.widthLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.widthLabel')}
              value={Math.round(layer.width)}
              min={1}
              onChange={(width) => patchActive({ width }, false)}
            />
          </Field>
          <Field label={t('tools.photo.heightLabel')}>
            <NumberInput
              ariaLabel={t('tools.photo.heightLabel')}
              value={Math.round(layer.height)}
              min={1}
              onChange={(height) => patchActive({ height }, false)}
            />
          </Field>
        </div>
        <Slider
          label={t('tools.photo.rotation')}
          value={Math.round(layer.rotation)}
          min={-180}
          max={180}
          onChange={(rotation) => patchActive({ rotation }, false)}
        />
        <div className="flex gap-1">
          <ToggleChip
            label={t('tools.photo.flipH')}
            active={layer.flipX}
            onClick={() => patchActive({ flipX: !layer.flipX })}
          />
          <ToggleChip
            label={t('tools.photo.flipV')}
            active={layer.flipY}
            onClick={() => patchActive({ flipY: !layer.flipY })}
          />
        </div>
      </PanelSection>

      {layer.kind === 'text' ? (
        <PanelSection title={t('tools.photo.textContent')}>
          <TextInput
            ariaLabel={t('tools.photo.textContent')}
            value={layer.text}
            onChange={(text) => patchActive({ text } as never, false)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('tools.photo.fontSize')}>
              <NumberInput
                ariaLabel={t('tools.photo.fontSize')}
                value={Math.round(layer.fontSize)}
                min={6}
                max={400}
                onChange={(fontSize) => patchActive({ fontSize } as never, false)}
              />
            </Field>
            <Field label={t('tools.photo.fontFamily')}>
              <Select
                ariaLabel={t('tools.photo.fontFamily')}
                value={layer.fontFamily}
                options={FONT_FAMILIES}
                onChange={(fontFamily) => patchActive({ fontFamily } as never)}
              />
            </Field>
          </div>
          <Field label={t('tools.photo.color')}>
            <input
              type="color"
              aria-label={t('tools.photo.color')}
              value={layer.fill}
              onChange={(event) => patchActive({ fill: event.target.value } as never)}
              className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
            />
          </Field>
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
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as TextAlign[]).map((align) => (
              <ToggleChip
                key={align}
                label={
                  align === 'left'
                    ? t('tools.photo.alignLeft')
                    : align === 'center'
                      ? t('tools.photo.alignCenter')
                      : t('tools.photo.alignRight')
                }
                active={layer.align === align}
                onClick={() => patchActive({ align } as never)}
              />
            ))}
          </div>
        </PanelSection>
      ) : null}

      {layer.kind === 'shape' ? (
        <PanelSection title={t('tools.photo.shapeKind')}>
          <Field label={t('tools.photo.fill')}>
            <input
              type="color"
              aria-label={t('tools.photo.fill')}
              value={layer.fill}
              onChange={(event) => patchActive({ fill: event.target.value } as never)}
              className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
            />
          </Field>
          <Field label={t('tools.photo.stroke')}>
            <input
              type="color"
              aria-label={t('tools.photo.stroke')}
              value={layer.stroke}
              onChange={(event) => patchActive({ stroke: event.target.value } as never)}
              className="h-8 w-full cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-700"
            />
          </Field>
          <Slider
            label={t('tools.photo.strokeWidth')}
            value={Math.round(layer.strokeWidth)}
            min={0}
            max={40}
            onChange={(strokeWidth) => patchActive({ strokeWidth } as never, false)}
          />
          {layer.shape === 'roundRect' ? (
            <Slider
              label={t('tools.photo.cornerRadius')}
              value={Math.round(layer.cornerRadius)}
              min={0}
              max={200}
              onChange={(cornerRadius) => patchActive({ cornerRadius } as never, false)}
            />
          ) : null}
        </PanelSection>
      ) : null}
    </div>
  );
}
