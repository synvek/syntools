import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import type { ImageLayer } from './imageLayer';
import { IMAGE_LAYERS } from './imageLayer';
import { SHAPE_PRESETS, type DocShapeAttrs, type ShapeDash } from './shapeNode';
import { applyShapeAttrs, useSelectedShape } from './useSelectedShape';

interface ShapeFormatBarProps {
  editor: Editor | null;
  /** 更多样式：打开侧边面板（尺寸/旋转/文字长尾属性） */
  onOpenPanel: () => void;
}

const LAYER_LABELS: Record<ImageLayer, string> = {
  inline: 'tools.richText.imageLayerInline',
  'wrap-left': 'tools.richText.imageLayerWrapLeft',
  'wrap-right': 'tools.richText.imageLayerWrapRight',
  'top-bottom': 'tools.richText.imageLayerTopBottom',
  front: 'tools.richText.imageLayerFront',
  behind: 'tools.richText.imageLayerBehind',
};

const fieldClass =
  'h-7 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900';
const colorClass = 'h-7 w-8 rounded border border-gray-300 bg-transparent dark:border-gray-600';

/**
 * 形状格式栏（对应 Word/Excel 选中形状后出现的「形状格式」上下文选项卡）。
 *
 * 只放高频控件：换形状、填充、轮廓、虚线、文字、环绕方式、删除。
 * 尺寸/旋转/调整点这类需要精细输入的东西留在侧边面板里 —— Word 也是这么分的
 * （功能区 + 右键「设置形状格式」），把两者塞进同一个条会让工具栏占掉半屏。
 */
export function ShapeFormatBar({ editor, onOpenPanel }: ShapeFormatBarProps) {
  const { t } = useTranslation();
  const selected = useSelectedShape(editor);
  if (!editor || !selected) return null;

  const attrs = selected.attrs;
  const update = (patch: Partial<DocShapeAttrs>) => applyShapeAttrs(editor, patch);

  return (
    <div
      data-testid="rich-text-shape-format-bar"
      className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800"
    >
      <span className="mr-1 font-medium text-gray-700 dark:text-gray-200">
        {t('tools.richText.shapeQuickFormat')}
      </span>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span className="sr-only">{t('tools.richText.shape')}</span>
        <select
          aria-label={t('tools.richText.shape')}
          value={attrs.prst}
          onChange={(event) => update({ prst: event.target.value, adj: null })}
          className={fieldClass}
        >
          {SHAPE_PRESETS.map((preset) => (
            <option key={preset.prst} value={preset.prst}>
              {preset.prst}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span>{t('tools.richText.shapeFill')}</span>
        <input
          type="color"
          aria-label={t('tools.richText.shapeFill')}
          value={attrs.fill}
          onChange={(event) => update({ fill: event.target.value })}
          className={colorClass}
        />
      </label>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span>{t('tools.richText.shapeStroke')}</span>
        <input
          type="color"
          aria-label={t('tools.richText.shapeStroke')}
          value={attrs.stroke}
          onChange={(event) => update({ stroke: event.target.value })}
          className={colorClass}
        />
      </label>

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span>{t('tools.richText.shapeStrokeWidth')}</span>
        <input
          type="number"
          min={0}
          max={24}
          aria-label={t('tools.richText.shapeStrokeWidth')}
          value={Math.round(attrs.strokeWidth)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) update({ strokeWidth: Math.min(24, Math.max(0, parsed)) });
          }}
          className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
        />
      </label>

      <select
        aria-label={t('tools.richText.shapeDash')}
        title={t('tools.richText.shapeDash')}
        value={attrs.dash ?? 'solid'}
        onChange={(event) => update({ dash: event.target.value as ShapeDash })}
        className={fieldClass}
      >
        <option value="solid">{t('tools.richText.shapeDashSolid')}</option>
        <option value="dash">{t('tools.richText.shapeDashDash')}</option>
        <option value="dot">{t('tools.richText.shapeDashDot')}</option>
      </select>

      <span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

      <input
        type="text"
        value={attrs.text}
        placeholder={t('tools.richText.shapeTextPlaceholder')}
        aria-label={t('tools.richText.shapeText')}
        onChange={(event) => update({ text: event.target.value })}
        className="h-7 w-36 rounded-md border border-gray-300 bg-white px-1.5 text-xs dark:border-gray-600 dark:bg-gray-900"
      />

      <label className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
        <span className="sr-only">{t('tools.richText.fontSize')}</span>
        <input
          type="number"
          min={6}
          max={96}
          aria-label={t('tools.richText.fontSize')}
          value={Math.round(attrs.textSize)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) update({ textSize: Math.min(96, Math.max(6, parsed)) });
          }}
          className="h-7 w-14 rounded-md border border-gray-300 bg-white px-1 text-xs dark:border-gray-600 dark:bg-gray-900"
        />
      </label>

      <input
        type="color"
        aria-label={t('tools.richText.color')}
        title={t('tools.richText.color')}
        value={attrs.textColor}
        onChange={(event) => update({ textColor: event.target.value })}
        className={colorClass}
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
        title={t('tools.richText.alignCenter')}
        value={attrs.textAlign}
        onChange={(event) =>
          update({ textAlign: event.target.value as DocShapeAttrs['textAlign'] })
        }
        className={fieldClass}
      >
        <option value="left">{t('tools.richText.alignLeft')}</option>
        <option value="center">{t('tools.richText.alignCenter')}</option>
        <option value="right">{t('tools.richText.alignRight')}</option>
      </select>

      <span className="mx-1 h-5 w-px bg-gray-300 dark:bg-gray-600" aria-hidden="true" />

      <select
        aria-label={t('tools.richText.imageLayer')}
        title={t('tools.richText.imageLayer')}
        value={attrs.layer}
        onChange={(event) =>
          editor
            .chain()
            .focus()
            .setNodeSelection(selected.pos)
            .setDocShapeLayer(event.target.value as ImageLayer)
            .run()
        }
        className={fieldClass}
      >
        {IMAGE_LAYERS.map((layer) => (
          <option key={layer} value={layer}>
            {t(LAYER_LABELS[layer])}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenPanel}
          className="h-7 rounded-md border border-gray-300 px-2 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          {t('tools.richText.shapeMoreStyles')}
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().removeDocShape().run()}
          className="h-7 rounded-md border border-red-300 px-2 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
        >
          {t('tools.richText.shapeDelete')}
        </button>
      </div>
    </div>
  );
}
