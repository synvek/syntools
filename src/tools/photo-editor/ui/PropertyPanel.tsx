import { useTranslation } from 'react-i18next';
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import {
  Field,
  NumberInput,
  PanelSection,
  Select,
  Slider,
  TextInput,
  ToggleChip,
} from './controls';
import { MaskPanel } from './MaskPanel';
import { usePhotoStore } from '../store';
import type { CanvasBackground } from '../model/types';

/** 属性面板：几何 + 文字 / 形状各自的样式属性。 */
export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = usePhotoStore((s) => s.doc);
  const patchActive = usePhotoStore((s) => s.patchActive);
  const rasterizeSmart = usePhotoStore((s) => s.rasterizeSmart);
  const applyCanvas = usePhotoStore((s) => s.applyCanvas);
  const layer = doc.layers.find((item) => item.id === doc.activeLayerId);

  // 未选中图层时展示「文档属性」：画布尺寸与背景（这一入口以前只在新建画布时出现过）
  if (!layer) {
    return (
      <div className="flex flex-col gap-3">
        <p className="px-1 text-center text-xs text-gray-400 dark:text-gray-500">
          {t('tools.photo.noLayer')}
        </p>
        <PanelSection title={t('tools.photo.docProps')}>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('tools.photo.canvasWidth')}>
              <NumberInput
                ariaLabel={t('tools.photo.canvasWidth')}
                value={doc.width}
                min={MIN_CANVAS_SIZE}
                max={MAX_CANVAS_SIZE}
                onChange={(width) => applyCanvas(width, doc.height, doc.background)}
              />
            </Field>
            <Field label={t('tools.photo.canvasHeight')}>
              <NumberInput
                ariaLabel={t('tools.photo.canvasHeight')}
                value={doc.height}
                min={MIN_CANVAS_SIZE}
                max={MAX_CANVAS_SIZE}
                onChange={(height) => applyCanvas(doc.width, height, doc.background)}
              />
            </Field>
          </div>
          <Field label={t('tools.photo.canvasBackground')}>
            <Select
              ariaLabel={t('tools.photo.canvasBackground')}
              value={doc.background}
              options={[
                { id: 'white', label: t('tools.photo.bgWhite') },
                { id: 'black', label: t('tools.photo.bgBlack') },
                { id: 'transparent', label: t('tools.photo.bgTransparent') },
              ]}
              onChange={(background: CanvasBackground) =>
                applyCanvas(doc.width, doc.height, background)
              }
            />
          </Field>
        </PanelSection>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MaskPanel layer={layer} />
      {layer.kind === 'smart' ? (
        <div
          data-testid="smart-section"
          className="rounded-lg border border-gray-200 p-2 dark:border-gray-800"
        >
          <div className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            {t('tools.photo.smartTitle')}
          </div>
          <p className="mb-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            {t('tools.photo.smartSource', {
              w: Math.round(layer.sourceWidth),
              h: Math.round(layer.sourceHeight),
            })}
          </p>
          <button
            type="button"
            data-testid="smart-rasterize"
            onClick={() => rasterizeSmart(layer.id)}
            className="rounded-md border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t('tools.photo.rasterize')}
          </button>
        </div>
      ) : null}
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
          {/* 字符 / 段落 / 变形等完整参数在「文字」面板，这里只留最常用的内容编辑 */}
          <p className="text-[10px] leading-4 text-gray-400 dark:text-gray-500">
            {t('tools.photo.textPanelTip')}
          </p>
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
