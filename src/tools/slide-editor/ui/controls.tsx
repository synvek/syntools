import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';

/** 面板原子组件：统一表单控件观感，避免各面板重复样式 */

export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="slide-panel-card rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
        {action}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-gray-500 dark:text-gray-400">
      <span className="shrink-0">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'h-7 w-full min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px] text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  ariaLabel,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        aria-label={ariaLabel}
        className={`${inputClass} w-16 ${suffix ? 'w-14' : ''}`}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      {suffix ? <span className="text-[11px] text-gray-400">{suffix}</span> : null}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}

export function ColorInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={ariaLabel}
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-transparent dark:border-gray-600"
      />
      <span className="font-mono text-[11px] uppercase text-gray-500 dark:text-gray-400">
        {value}
      </span>
    </div>
  );
}

export interface ToggleOption<T> {
  value: T;
  label: string;
  icon?: string;
}

export function ToggleGroup<T extends string | number | boolean>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ToggleOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={active}
            className={`inline-flex h-7 min-w-[28px] items-center justify-center gap-1 rounded-md border px-1.5 text-[11px] transition-colors ${
              active
                ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {option.icon ? <Icon name={option.icon} className="h-3.5 w-3.5" /> : option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

export function IconButton({
  label,
  icon,
  onClick,
  active,
  disabled,
  tone = 'default',
}: {
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'primary';
}) {
  const base =
    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  const palette =
    tone === 'primary'
      ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
      : active
        ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
        : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${palette}`}>
      <Icon name={icon} className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
