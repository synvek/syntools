import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMindStore } from '../store';
import { depthOf, findNode } from '../model/tree';
import { defaultShapeOf, defaultStyleOf, themeOf } from '../model/themes';
import { MIND_ALIGNS, MIND_SHAPES, type MindAlign, type MindNodeShape } from '../model/types';

const inputCls =
  'h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

export function PropertyPanel() {
  const { t } = useTranslation();
  const doc = useMindStore((s) => s.doc);
  const layout = useMindStore((s) => s.layout);
  const selectedId = useMindStore((s) => s.selectedId);
  const patch = useMindStore((s) => s.patch);
  const setText = useMindStore((s) => s.setText);
  const setSide = useMindStore((s) => s.setSide);
  const toggleCollapseAt = useMindStore((s) => s.toggleCollapseAt);

  // 连续输入只压入一次历史（与 flowchart 属性面板同一约定）
  const session = useRef(false);
  const begin = () => {
    if (!session.current) {
      useMindStore.getState().commit();
      session.current = true;
    }
  };
  const end = () => {
    session.current = false;
  };

  const rec = selectedId ? findNode(doc.nodes, selectedId) : undefined;
  if (!rec || !selectedId) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-gray-400 dark:text-gray-500">
        {t('tools.mindmap.noSelection')}
      </div>
    );
  }

  const theme = themeOf(doc.themeId);
  const box = layout.nodes.find((n) => n.id === selectedId);
  const depth = depthOf(doc.nodes, selectedId);
  const base = defaultStyleOf(theme, depth, box?.color ?? theme.root.fill);
  const style = { ...base, ...(rec.style ?? {}) };
  const isRoot = rec.parentId === null;

  return (
    <div className="flex flex-col gap-3 p-1">
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('tools.mindmap.panelTitle')}
      </h2>

      <Field label={t('tools.mindmap.text')}>
        <input
          className={inputCls}
          value={rec.text}
          onChange={(e) => {
            begin();
            setText(selectedId, e.target.value);
          }}
          onBlur={end}
        />
      </Field>

      <Field label={t('tools.mindmap.note')}>
        <textarea
          className="min-h-[56px] w-full rounded-md border border-gray-200 bg-white p-2 text-[13px] text-gray-800 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          value={rec.note ?? ''}
          onChange={(e) => {
            begin();
            patch(selectedId, { note: e.target.value });
          }}
          onBlur={end}
          placeholder="—"
        />
      </Field>

      <Field label={t('tools.mindmap.shape')}>
        <select
          className={inputCls}
          value={rec.shape ?? defaultShapeOf(theme, depth)}
          onChange={(e) => patch(selectedId, { shape: e.target.value as MindNodeShape })}
        >
          {MIND_SHAPES.map((s) => (
            <option key={s} value={s}>
              {t(`tools.mindmap.shape_${s}`)}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.mindmap.branchColor')}>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={box?.color ?? theme.root.fill}
            onChange={(e) => patch(selectedId, { color: e.target.value })}
          />
        </Field>
        <Field label={t('tools.mindmap.fill')}>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={style.fill}
            onChange={(e) => patch(selectedId, { style: { fill: e.target.value } })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('tools.mindmap.fontSize')}>
          <input
            type="number"
            min={10}
            max={32}
            className={inputCls}
            value={style.fontSize}
            onChange={(e) =>
              patch(selectedId, { style: { fontSize: Number(e.target.value) || 13 } })
            }
          />
        </Field>
        <Field label={t('tools.mindmap.textColor')}>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            value={style.textColor}
            onChange={(e) => patch(selectedId, { style: { textColor: e.target.value } })}
          />
        </Field>
      </div>

      <Field label={t('tools.mindmap.align')}>
        <div className="flex gap-1">
          {MIND_ALIGNS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => patch(selectedId, { style: { align: a as MindAlign } })}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                style.align === a
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {t(
                `tools.mindmap.align${a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}`,
              )}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => patch(selectedId, { style: { bold: !style.bold } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] font-bold transition-colors ${
            style.bold
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.mindmap.bold')}
        </button>
        <button
          type="button"
          onClick={() => patch(selectedId, { style: { italic: !style.italic } })}
          className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] italic transition-colors ${
            style.italic
              ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
              : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {t('tools.mindmap.italic')}
        </button>
      </div>

      {/* 左右分布布局下，一级分支可指定所在侧 */}
      {doc.direction === 'both' && depth === 1 ? (
        <Field label={t('tools.mindmap.side')}>
          <div className="flex gap-1">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => setSide(selectedId, side)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                  (rec.side ?? 'right') === side
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {t(`tools.mindmap.side${side === 'left' ? 'Left' : 'Right'}`)}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <button
        type="button"
        disabled={isRoot}
        onClick={() => toggleCollapseAt(selectedId)}
        className="rounded-md border border-gray-200 px-2 py-1.5 text-[12px] text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {rec.collapsed ? t('tools.mindmap.expand') : t('tools.mindmap.collapse')}
      </button>
    </div>
  );
}
