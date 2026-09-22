import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import { useMindStore } from '../store';
import { MIND_DIRECTIONS } from '../model/types';
import type { MindLayoutDirection } from '../model/types';

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  compact?: boolean;
  active?: boolean;
  glyph?: string;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  primary,
  compact,
  active,
  glyph,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'h-7 w-8 text-[13px]' : 'h-8 gap-1.5 px-3 text-[13px]'
      } ${
        primary
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : active
            ? 'border border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'
            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {glyph ? <span>{glyph}</span> : null}
      {compact && glyph ? null : <span>{label}</span>}
    </button>
  );
}

const DIRECTION_GLYPH: Record<MindLayoutDirection, string> = {
  right: '→',
  both: '↔',
  down: '↓',
};

interface ToolbarProps {
  onTemplates: () => void;
}

export function Toolbar({ onTemplates }: ToolbarProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const canUndo = useMindStore((s) => s.past.length > 0);
  const canRedo = useMindStore((s) => s.future.length > 0);
  const direction = useMindStore((s) => s.doc.direction);
  const selectedId = useMindStore((s) => s.selectedId);
  const rootId = useMindStore((s) => s.doc.rootId);
  const sep = <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

  const isRoot = !selectedId || selectedId === rootId;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolbarButton label={t('tools.mindmap.templates')} onClick={onTemplates} />

        {sep}

        <ToolbarButton
          label={t('tools.mindmap.undo')}
          onClick={() => useMindStore.getState().undo()}
          disabled={!canUndo}
        />
        <ToolbarButton
          label={t('tools.mindmap.redo')}
          onClick={() => useMindStore.getState().redo()}
          disabled={!canRedo}
        />

        {sep}

        <ToolbarButton
          label={t('tools.mindmap.duplicate')}
          onClick={() => useMindStore.getState().duplicateAt()}
        />
        <ToolbarButton
          label={t('tools.mindmap.delete')}
          onClick={() => useMindStore.getState().removeAt()}
          disabled={isRoot}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {MIND_DIRECTIONS.map((dir) => (
          <ToolbarButton
            key={dir}
            compact
            glyph={DIRECTION_GLYPH[dir]}
            label={t(`tools.mindmap.dir_${dir}`)}
            active={direction === dir}
            onClick={() => useMindStore.getState().setDirection(dir)}
          />
        ))}

        {sep}

        <ToolbarButton
          label={t('tools.mindmap.addChild')}
          onClick={() => useMindStore.getState().addChildOf()}
        />
        <ToolbarButton
          label={t('tools.mindmap.addSibling')}
          onClick={() => useMindStore.getState().addSiblingOf()}
        />

        {sep}

        <ToolbarButton
          compact
          glyph="⇥"
          label={t('tools.mindmap.indent')}
          onClick={() => useMindStore.getState().indentAt()}
        />
        <ToolbarButton
          compact
          glyph="⇤"
          label={t('tools.mindmap.outdent')}
          onClick={() => useMindStore.getState().outdentAt()}
        />
        <ToolbarButton
          compact
          glyph="↑"
          label={t('tools.mindmap.moveUp')}
          onClick={() => useMindStore.getState().moveAt(null, -1)}
        />
        <ToolbarButton
          compact
          glyph="↓"
          label={t('tools.mindmap.moveDown')}
          onClick={() => useMindStore.getState().moveAt(null, 1)}
        />

        {sep}

        <ToolbarButton
          compact
          glyph="⊟"
          label={t('tools.mindmap.collapseAll')}
          onClick={() => useMindStore.getState().setAllCollapsed(true)}
        />
        <ToolbarButton
          compact
          glyph="⊞"
          label={t('tools.mindmap.expandAll')}
          onClick={() => useMindStore.getState().setAllCollapsed(false)}
        />

        {sep}

        <ToolbarButton
          label={t('tools.mindmap.fitView')}
          onClick={() => fitView({ padding: 0.25, maxZoom: 1 })}
        />
      </div>
    </div>
  );
}
