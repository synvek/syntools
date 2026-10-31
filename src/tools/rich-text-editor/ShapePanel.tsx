import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import { resolvePresetGeometry } from '../../core/drawing/shapeDefs';
import type { ImageLayer } from './imageLayer';
import { IMAGE_LAYERS } from './imageLayer';
import {
  SHAPE_PRESETS,
  findSelectedShape,
  shapeSpec,
  type DocShapeAttrs,
  type ShapeDash,
} from './shapeNode';
import { shapePathD } from './shapeSvg';

/**
 * Shape panel (P3-1.2 / P3-1.4): preset palette plus the properties of the selected shape.
 *
 * Only the selected shape is edited — the panel holds no local copy of the document, so every
 * change goes through the node attributes (undo/redo and docx export read the same data).
 */

interface ShapePanelProps {
  editor: Editor | null;
  onClose: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  basic: 'tools.richText.shapeGroupBasic',
  arrow: 'tools.richText.shapeGroupArrow',
  star: 'tools.richText.shapeGroupStar',
  flowchart: 'tools.richText.shapeGroupFlowchart',
};

const LAYER_LABELS: Record<ImageLayer, string> = {
  inline: 'tools.richText.imageLayerInline',
  'wrap-left': 'tools.richText.imageLayerWrapLeft',
  'wrap-right': 'tools.richText.imageLayerWrapRight',
  'top-bottom': 'tools.richText.imageLayerTopBottom',
  front: 'tools.richText.imageLayerFront',
  behind: 'tools.richText.imageLayerBehind',
};

/** Preset thumbnail: the same path the editor renders, so the palette never lies about the shape */
function PresetButton({
  prst,
  label,
  active,
  onClick,
}: {
  prst: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-shape-preset={prst}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-10 items-center justify-center rounded-md border transition-colors ${
        active
          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800'
      }`}
    >
      <svg viewBox="0 0 40 32" width="32" height="24" aria-hidden="true">
        <path
          d={shapePathD(resolvePresetGeometry(prst), 40, 32)}
          fill="currentColor"
          className="text-gray-500 dark:text-gray-300"
        />
      </svg>
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
      <span className="w-11 shrink-0">{label}</span>
      <input
        type="number"
        aria-label={label}
        value={Math.round(value)}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
        }}
        className="h-7 w-16 rounded-md border border-gray-300 bg-white px-1.5 text-xs dark:border-gray-600 dark:bg-gray-900"
      />
    </label>
  );
}

export function ShapePanel({ editor, onClose }: ShapePanelProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ pos: number; attrs: DocShapeAttrs } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const refresh = () => {
      const found = findSelectedShape(editor.state);
      setSelected(found ? { pos: found.pos, attrs: shapeSpec(found.node.attrs) } : null);
    };
    refresh();
    editor.on('transaction', refresh);
    editor.on('selectionUpdate', refresh);
    return () => {
      editor.off('transaction', refresh);
      editor.off('selectionUpdate', refresh);
    };
  }, [editor]);

  if (!editor) return null;

  const update = (attrs: Partial<DocShapeAttrs>) => {
    const found = findSelectedShape(editor.state);
    if (!found) return;
    const tr = editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      ...attrs,
    });
    editor.view.dispatch(tr);
  };

  const attrs = selected?.attrs;

  return (
    <div
      data-testid="rich-text-shapes"
      className="rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.shape')}
        </span>
        <button
          type="button"
          aria-label={t('tools.richText.shapeClose')}
          onClick={onClose}
          className="h-7 rounded-md border border-gray-300 px-2 text-xs dark:border-gray-600"
        >
          {t('tools.richText.shapeClose')}
        </button>
      </div>

      <div className="space-y-1.5">
        {(['basic', 'arrow', 'star', 'flowchart'] as const).map((group) => (
          <div key={group} className="flex items-start gap-1.5">
            <span className="w-14 shrink-0 pt-1 text-xs text-gray-500 dark:text-gray-400">
              {t(GROUP_LABELS[group])}
            </span>
            <div className="flex flex-wrap gap-1">
              {SHAPE_PRESETS.filter((preset) => preset.group === group).map((preset) => (
                <PresetButton
                  key={preset.prst}
                  prst={preset.prst}
                  label={preset.prst}
                  active={attrs?.prst === preset.prst}
                  onClick={() => {
                    if (attrs) update({ prst: preset.prst, adj: null });
                    else editor.chain().focus().insertDocShape({ prst: preset.prst }).run();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {attrs ? (
        <div className="mt-2 space-y-1.5 border-t border-gray-200 pt-2 dark:border-gray-700">
          <div className="flex flex-wrap gap-1.5">
            <NumberField
              label={t('tools.richText.shapeWidth')}
              value={attrs.width}
              min={20}
              max={4000}
              onChange={(width) => update({ width })}
            />
            <NumberField
              label={t('tools.richText.shapeHeight')}
              value={attrs.height}
              min={20}
              max={4000}
              onChange={(height) => update({ height })}
            />
            <NumberField
              label={t('tools.richText.shapeRotation')}
              value={attrs.rotation}
              min={-180}
              max={180}
              onChange={(rotation) => update({ rotation })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-11 shrink-0">{t('tools.richText.shapeFill')}</span>
              <input
                type="color"
                aria-label={t('tools.richText.shapeFill')}
                value={attrs.fill}
                onChange={(event) => update({ fill: event.target.value })}
                className="h-7 w-9 rounded border border-gray-300 bg-transparent dark:border-gray-600"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-11 shrink-0">{t('tools.richText.shapeStroke')}</span>
              <input
                type="color"
                aria-label={t('tools.richText.shapeStroke')}
                value={attrs.stroke}
                onChange={(event) => update({ stroke: event.target.value })}
                className="h-7 w-9 rounded border border-gray-300 bg-transparent dark:border-gray-600"
              />
            </label>
            <NumberField
              label={t('tools.richText.shapeStrokeWidth')}
              value={attrs.strokeWidth}
              min={0}
              max={24}
              onChange={(strokeWidth) => update({ strokeWidth })}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-11 shrink-0">{t('tools.richText.shapeDash')}</span>
              <select
                aria-label={t('tools.richText.shapeDash')}
                value={attrs.dash ?? 'solid'}
                onChange={(event) => update({ dash: event.target.value as ShapeDash })}
                className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="solid">{t('tools.richText.shapeDashSolid')}</option>
                <option value="dash">{t('tools.richText.shapeDashDash')}</option>
                <option value="dot">{t('tools.richText.shapeDashDot')}</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span className="w-11 shrink-0">{t('tools.richText.imageLayer')}</span>
              <select
                aria-label={t('tools.richText.imageLayer')}
                value={attrs.layer}
                onChange={(event) => {
                  const found = findSelectedShape(editor.state);
                  if (!found) return;
                  editor
                    .chain()
                    .focus()
                    .setNodeSelection(found.pos)
                    .setDocShapeLayer(event.target.value as ImageLayer)
                    .run();
                }}
                className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
              >
                {IMAGE_LAYERS.map((layer) => (
                  <option key={layer} value={layer}>
                    {t(LAYER_LABELS[layer])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-gray-600 dark:text-gray-300">
            <span className="mb-0.5 block">{t('tools.richText.shapeText')}</span>
            <textarea
              aria-label={t('tools.richText.shapeText')}
              placeholder={t('tools.richText.shapeTextPlaceholder')}
              value={attrs.text}
              rows={2}
              onChange={(event) => update({ text: event.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white px-1.5 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
            />
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <NumberField
              label={t('tools.richText.fontSize')}
              value={attrs.textSize}
              min={6}
              max={96}
              onChange={(textSize) => update({ textSize })}
            />
            <input
              type="color"
              aria-label={t('tools.richText.color')}
              value={attrs.textColor}
              onChange={(event) => update({ textColor: event.target.value })}
              className="h-7 w-9 rounded border border-gray-300 bg-transparent dark:border-gray-600"
            />
            {(
              [
                ['textBold', 'bold', 'font-bold', 'B'],
                ['textItalic', 'italic', 'italic', 'I'],
                ['textUnderline', 'underline', 'underline', 'U'],
              ] as const
            ).map(([key, labelKey, className, letter]) => (
              <button
                key={key}
                type="button"
                aria-label={t(`tools.richText.${labelKey}`)}
                aria-pressed={attrs[key]}
                onClick={() => update({ [key]: !attrs[key] } as Partial<DocShapeAttrs>)}
                className={`h-7 w-7 rounded-md border text-xs ${className} ${
                  attrs[key]
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {letter}
              </button>
            ))}
            <select
              aria-label={t('tools.richText.alignCenter')}
              value={attrs.textAlign}
              onChange={(event) =>
                update({ textAlign: event.target.value as DocShapeAttrs['textAlign'] })
              }
              className="h-7 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
            >
              <option value="left">{t('tools.richText.alignLeft')}</option>
              <option value="center">{t('tools.richText.alignCenter')}</option>
              <option value="right">{t('tools.richText.alignRight')}</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
              {t('tools.richText.shapeHintSelected')}
            </span>
            <button
              type="button"
              onClick={() => editor.chain().focus().removeDocShape().run()}
              className="h-7 shrink-0 rounded-md border border-red-300 px-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
            >
              {t('tools.richText.shapeDelete')}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          {t('tools.richText.shapeHintEmpty')}
        </p>
      )}
    </div>
  );
}
