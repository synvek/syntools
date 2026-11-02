import type { RibbonAccent, RibbonGroup as RibbonGroupModel, RibbonItem } from './types';
import { RIBBON_ACCENT, RIBBON_GROUP_LABEL } from './ribbonTheme';
import { RibbonButton } from './RibbonButton';
import { RibbonColorPicker } from './RibbonColorPicker';
import { RibbonMenuButton, RibbonSplitButton } from './RibbonSplitButton';
import { RibbonSelect } from './RibbonSelect';

/** Prefix for command test ids, so e2e can target one command without relying on the label */
function itemTestId(groupId: string, itemId: string): string {
  return `ribbon-${groupId}-${itemId}`;
}

function ItemView({
  item,
  accent,
  onInvoked,
  groupId,
}: {
  item: RibbonItem;
  accent: RibbonAccent;
  onInvoked?: () => void;
  groupId: string;
}) {
  const wrap = (run: () => void) => () => {
    run();
    onInvoked?.();
  };

  switch (item.kind) {
    case 'button':
      return (
        <RibbonButton
          label={item.label}
          icon={item.icon}
          size={item.size}
          disabled={item.disabled}
          hint={item.hint}
          accent={accent}
          onClick={wrap(item.onSelect)}
          testId={itemTestId(groupId, item.id)}
        />
      );
    case 'toggle':
      return (
        <RibbonButton
          label={item.label}
          icon={item.icon}
          size={item.size}
          active={item.active}
          pressed={Boolean(item.active)}
          disabled={item.disabled}
          hint={item.hint}
          accent={accent}
          onClick={wrap(item.onSelect)}
          testId={itemTestId(groupId, item.id)}
        />
      );
    case 'menu':
      return (
        <RibbonMenuButton
          label={item.label}
          icon={item.icon}
          size={item.size}
          disabled={item.disabled}
          hint={item.hint}
          menu={item.menu}
          testId={itemTestId(groupId, item.id)}
        />
      );
    case 'split':
      return (
        <RibbonSplitButton
          label={item.label}
          icon={item.icon}
          size={item.size}
          active={item.active}
          disabled={item.disabled}
          hint={item.hint}
          accent={accent}
          menu={item.menu}
          onSelect={wrap(item.onSelect)}
          testId={itemTestId(groupId, item.id)}
        />
      );
    case 'select':
      return (
        <RibbonSelect
          label={item.label}
          value={item.value}
          options={item.options}
          width={item.width}
          disabled={item.disabled}
          onChange={(value) => {
            item.onChange(value);
            onInvoked?.();
          }}
          testId={itemTestId(groupId, item.id)}
        />
      );
    case 'color':
      return (
        <RibbonColorPicker
          label={item.label}
          icon={item.icon}
          size={item.size}
          value={item.value}
          accent={accent}
          disabled={item.disabled}
          hint={item.hint}
          onPick={(color) => {
            item.onPick(color);
            onInvoked?.();
          }}
          onReset={
            item.onReset
              ? () => {
                  item.onReset?.();
                  onInvoked?.();
                }
              : undefined
          }
          resetLabel={item.resetLabel}
          testId={itemTestId(groupId, item.id)}
        />
      );
  }
}

/**
 * One ribbon group: commands on top, the group caption underneath, a dialog launcher in the
 * bottom-right corner.
 *
 * The item row is a fixed-height **column** flexbox: large buttons (56px) fill a column on their own,
 * small buttons (24px) stack two per column — the exact packing an Office ribbon uses.
 */
export function RibbonGroupView({
  group,
  accent,
  onInvoked,
  hidden,
  divider = false,
}: {
  group: RibbonGroupModel;
  accent: RibbonAccent;
  onInvoked?: () => void;
  hidden?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      data-ribbon-group={group.id}
      data-hidden={hidden ? 'true' : undefined}
      className={`relative flex shrink-0 flex-col gap-0.5 px-1 ${
        divider ? 'border-l border-gray-300/70 dark:border-[#3a3a3a]' : ''
      } ${hidden ? 'hidden' : ''}`}
    >
      <div className="flex h-14 flex-col flex-wrap content-start items-start gap-x-0.5 gap-y-0.5">
        {group.items.map((item) => (
          <ItemView
            key={item.id}
            item={item}
            accent={accent}
            onInvoked={onInvoked}
            groupId={group.id}
          />
        ))}
      </div>
      <div className={RIBBON_GROUP_LABEL}>{group.label}</div>
      {group.overlay}
      {group.onLauncher ? (
        <button
          type="button"
          aria-label={`${group.label} ▾`}
          title={group.label}
          onClick={group.onLauncher}
          className={`absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-sm ${RIBBON_ACCENT[accent].launcher}`}
        >
          <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
            <path d="M7 1v6H1V1h6Z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M4 4h3v3H4z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
