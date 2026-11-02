const WIDTHS = {
  xs: 'w-[3.25rem]',
  sm: 'w-[5.5rem]',
  md: 'w-[8.5rem]',
} as const;

/**
 * Compact native select used by the ribbon (font family / font size / number format).
 *
 * Native `<select>` on purpose: the editors already rely on system selects elsewhere, it is keyboard
 * and screen-reader friendly, and a custom listbox would be a lot of code for no visible gain at this
 * size (24px tall inside a 64px group).
 */
export function RibbonSelect({
  label,
  value,
  options,
  onChange,
  width = 'sm',
  disabled = false,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  width?: 'xs' | 'sm' | 'md';
  disabled?: boolean;
  testId?: string;
}) {
  // A value that is not part of the preset list (e.g. an imported font size) must still be selectable
  const missing = value !== '' && !options.some((option) => option.value === value);
  return (
    <select
      data-testid={testId}
      title={label}
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={`${WIDTHS[width]} h-6 shrink-0 rounded border border-gray-300 bg-white px-1 text-[11px] outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#4a4a4a] dark:bg-[#252525] dark:text-[#e8e8e8]`}
    >
      {missing ? <option value={value}>{value}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
