import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  icon?: ReactNode;
}

function ToolbarButton({ label, onClick, disabled, primary, icon }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface ToolbarProps {
  onNew: () => void;
  onTemplates: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
}

export function Toolbar(props: ToolbarProps) {
  const { t } = useTranslation();
  const sep = <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <ToolbarButton
        label={t('tools.flowchart.newDoc')}
        onClick={props.onNew}
        icon={<span className="text-base leading-none">＋</span>}
      />
      <ToolbarButton label={t('tools.flowchart.templates')} onClick={props.onTemplates} />
      <ToolbarButton label={t('tools.flowchart.autoLayout')} onClick={props.onAutoLayout} />
      <ToolbarButton label={t('tools.flowchart.clear')} onClick={props.onClear} />

      {sep}

      <ToolbarButton
        label={t('tools.flowchart.undo')}
        onClick={props.onUndo}
        disabled={!props.canUndo}
      />
      <ToolbarButton
        label={t('tools.flowchart.redo')}
        onClick={props.onRedo}
        disabled={!props.canRedo}
      />
      <ToolbarButton label={t('tools.flowchart.duplicate')} onClick={props.onDuplicate} />
      <ToolbarButton label={t('tools.flowchart.delete')} onClick={props.onDelete} />

      <div className="ml-auto flex items-center gap-1.5">
        <ToolbarButton
          label={t('tools.flowchart.exportPng')}
          onClick={props.onExportPng}
          disabled={props.busy}
          primary
        />
        <ToolbarButton
          label={t('tools.flowchart.exportSvg')}
          onClick={props.onExportSvg}
          disabled={props.busy}
        />
      </div>
    </div>
  );
}
