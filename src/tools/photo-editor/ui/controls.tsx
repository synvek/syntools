import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';
import type { ToolId } from '../model/types';

/** 面板通用控件：统一控件高度（32px）与深色模式样式，避免各面板各写一套。 */

const LABEL_CLASS = 'text-xs font-medium text-gray-500 dark:text-gray-400';
const INPUT_CLASS =
  'h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-300 px-2.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';
const PRIMARY_CLASS =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

export function PanelSection({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {title}
          </span>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <span className={LABEL_CLASS}>{label}</span>
        <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
          {value}
          {suffix ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 dark:bg-gray-700"
      />
    </label>
  );
}

/** 单行滑杆：用于顶部工具条这类横向空间紧张的位置（标签只作无障碍名，不占宽度） */
export function CompactSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5" title={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-700"
      />
      <span className="w-9 shrink-0 text-right font-mono text-[11px] text-gray-400 dark:text-gray-500">
        {value}
        {suffix ?? ''}
      </span>
    </label>
  );
}

export function NumberInput({
  value,
  min,
  max,
  ariaLabel,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number(event.target.value))}
      className={INPUT_CLASS}
    />
  );
}

export function TextInput({
  value,
  ariaLabel,
  placeholder,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    />
  );
}

export function Select<T extends string>({
  value,
  options,
  ariaLabel,
  disabled,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${INPUT_CLASS} cursor-pointer disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  title,
  primary,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={primary ? PRIMARY_CLASS : BUTTON_CLASS}
    >
      {children}
    </button>
  );
}

export function IconTextButton({
  icon,
  label,
  onClick,
  disabled,
  title,
  active,
  testId,
}: {
  icon: string;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  testId?: string;
}) {
  const accessibleName = title ?? label ?? icon;
  return (
    <button
      type="button"
      title={accessibleName}
      aria-label={accessibleName}
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`${BUTTON_CLASS} ${active ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-300' : ''}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label ? <span>{label}</span> : null}
    </button>
  );
}

export function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 rounded-md border px-2.5 text-xs transition-colors ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  );
}

/** 工具箱按钮：竖排图标，当前工具高亮 */
export function ToolButton({
  tool,
  icon,
  label,
  shortcut,
  active,
  onSelect,
}: {
  tool: ToolId;
  icon: string;
  label: string;
  shortcut: string;
  active: boolean;
  onSelect: (tool: ToolId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool)}
      aria-label={label}
      aria-pressed={active}
      data-tool={tool}
      title={`${label}（${shortcut}）`}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-100 active:scale-95 ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      }`}
    >
      <Icon name={icon} className="h-4 w-4" />
      {active ? (
        <span className="absolute -bottom-0.5 right-0.5 rounded bg-blue-700/90 px-1 text-[9px] font-medium text-white">
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
