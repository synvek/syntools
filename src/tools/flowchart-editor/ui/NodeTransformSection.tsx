import { useTranslation } from 'react-i18next';
import { ROTATION_SNAP_STEP, type FlowNodePatch, type FlowNodeStyleView } from '../model/types';
import { normalizeRotation } from '../core';

/** 快捷旋转角度：与 draw.io 的「旋转 90°」心智一致 */
const QUICK_ANGLES = [0, 90, 180, 270];

const inputCls =
  'h-8 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/**
 * 节点「变换」分组：旋转角度（滑块 + 数值 + 快捷角度）与水平/垂直镜像。
 * 与画布上的旋转手柄同源（都写 `style.rotation` / `flipH` / `flipV`），双向联动。
 */
export function NodeTransformSection({
  style,
  patch,
  onEnd,
  fallback,
}: {
  style: FlowNodeStyleView;
  patch: (p: FlowNodePatch) => void;
  onEnd: () => void;
  fallback: FlowNodeStyleView;
}) {
  const { t } = useTranslation();
  const rotation = normalizeRotation(style.rotation ?? fallback.rotation ?? 0);
  const flipActive =
    'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300';
  const flipIdle =
    'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700';

  const setRotation = (deg: number) => patch({ style: { rotation: normalizeRotation(deg) } });
  const toggleFlip = (key: 'flipH' | 'flipV') => {
    const current = style[key] === true;
    onEnd();
    patch({ style: { [key]: current ? undefined : true } });
  };

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.flowchart.transform')}
      </h3>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          {`${t('tools.flowchart.rotation')} ${Math.round(rotation)}°`}
        </span>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={Math.round(rotation)}
          aria-label={t('tools.flowchart.rotation')}
          data-testid="flowchart-param-rotation"
          onChange={(e) => setRotation(Number(e.target.value))}
          onBlur={onEnd}
          className="w-full accent-blue-500"
        />
      </label>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={359}
          step={ROTATION_SNAP_STEP}
          value={Math.round(rotation)}
          aria-label={t('tools.flowchart.rotationValue')}
          data-testid="flowchart-rotation-value"
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) setRotation(v);
          }}
          onBlur={onEnd}
          className={`${inputCls} w-20`}
        />
        <div className="flex flex-1 gap-1">
          {QUICK_ANGLES.map((deg) => (
            <button
              key={deg}
              type="button"
              data-testid={`flowchart-rotate-${deg}`}
              onClick={() => setRotation(rotation + deg)}
              title={`+${deg}°`}
              className="flex-1 rounded-md border border-gray-200 px-1 py-1 text-[11px] text-gray-600 transition-colors hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-500/10"
            >
              {`+${deg}°`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          data-testid="flowchart-flip-h"
          onClick={() => toggleFlip('flipH')}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
            style.flipH === true ? flipActive : flipIdle
          }`}
        >
          {t('tools.flowchart.flipH')}
        </button>
        <button
          type="button"
          data-testid="flowchart-flip-v"
          onClick={() => toggleFlip('flipV')}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
            style.flipV === true ? flipActive : flipIdle
          }`}
        >
          {t('tools.flowchart.flipV')}
        </button>
        <button
          type="button"
          data-testid="flowchart-transform-reset"
          disabled={rotation === 0 && style.flipH !== true && style.flipV !== true}
          onClick={() =>
            patch({ style: { rotation: undefined, flipH: undefined, flipV: undefined } })
          }
          onBlur={onEnd}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t('tools.flowchart.reset')}
        </button>
      </div>
    </div>
  );
}
