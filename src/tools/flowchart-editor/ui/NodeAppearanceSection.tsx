import { useTranslation } from 'react-i18next';
import type { FlowNodePatch, FlowNodeStyle } from '../model/types';
import type { ShapeDraw } from '../model/shapes';

const FONT_FAMILIES = [
  'system-ui, sans-serif',
  'PingFang SC, Microsoft YaHei, sans-serif',
  'Georgia, serif',
  'SimSun, serif',
  'Menlo, Consolas, monospace',
  'KaiTi, STKaiti, serif',
];

const DASHES: Array<NonNullable<FlowNodeStyle['lineDash']>> = ['solid', 'dashed', 'dotted'];

const inputCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

const colorCls =
  'h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

/** 节点「外观」分组：透明度 / 文字色 / 线型 / 字体 / 阴影 / 圆角 / 折角 */
export function NodeAppearanceSection({
  style,
  draw,
  patch,
  onEnd,
}: {
  style: FlowNodeStyle;
  draw?: ShapeDraw;
  patch: (p: FlowNodePatch) => void;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const corner = style.cornerRadius ?? (draw === 'roundRect' ? 10 : 4);
  const fold = style.foldSize ?? 16;

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.appearance')}
      </h3>

      <Field label={`${t('tools.flowchart.opacity')} ${Math.round((style.opacity ?? 1) * 100)}%`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={style.opacity ?? 1}
          onChange={(e) => patch({ style: { opacity: Number(e.target.value) } })}
          onBlur={onEnd}
          className="w-full accent-blue-500"
        />
      </Field>

      <Field label={t('tools.flowchart.textColor')}>
        <input
          type="color"
          className={colorCls}
          value={style.textColor ?? style.stroke}
          onChange={(e) => patch({ style: { textColor: e.target.value } })}
          onBlur={onEnd}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.flowchart.edgeDash')}>
          <select
            className={inputCls}
            value={style.lineDash ?? 'solid'}
            onChange={(e) =>
              patch({
                style: { lineDash: e.target.value as NonNullable<FlowNodeStyle['lineDash']> },
              })
            }
            onBlur={onEnd}
          >
            {DASHES.map((v) => (
              <option key={v} value={v}>
                {t(`tools.flowchart.${v}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('tools.flowchart.fontFamily')}>
          <select
            className={inputCls}
            value={style.fontFamily ?? FONT_FAMILIES[0]}
            onChange={(e) => patch({ style: { fontFamily: e.target.value } })}
            onBlur={onEnd}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f.split(',')[0]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={() => patch({ style: { shadow: !style.shadow } })}
        onBlur={onEnd}
        className={`w-full rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
          style.shadow
            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
            : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
      >
        {t('tools.flowchart.shadow')}
      </button>

      {draw === 'roundRect' || draw === 'rect' ? (
        <Field label={`${t('tools.flowchart.cornerRadius')} ${corner}`}>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={corner}
            onChange={(e) => patch({ style: { cornerRadius: Number(e.target.value) } })}
            onBlur={onEnd}
            className="w-full accent-blue-500"
          />
        </Field>
      ) : null}

      {draw === 'note' ? (
        <Field label={`${t('tools.flowchart.foldSize')} ${fold}`}>
          <input
            type="range"
            min={0}
            max={60}
            step={1}
            value={fold}
            onChange={(e) => patch({ style: { foldSize: Number(e.target.value) } })}
            onBlur={onEnd}
            className="w-full accent-blue-500"
          />
        </Field>
      ) : null}
    </div>
  );
}
