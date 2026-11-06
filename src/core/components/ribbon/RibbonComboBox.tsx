import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { RibbonAccent, RibbonSelectItem, RibbonSelectPreview } from './types';
import { RIBBON_ACCENT, Z_PANEL } from './ribbonTheme';

/**
 * Office-style combo box for the ribbon (font family / font size / style / number format).
 *
 * Why not a native `<select>`: browsers paint the option text in the UI font, so a font list showed every
 * name in the same typeface and a style list showed plain labels. Office users pick a font by *seeing*
 * the font, so the list has to be rendered by us — each row carries its own preview and the trigger
 * echoes the active value.
 *
 * The trade-off is that the interaction is ours too: `role="combobox"` + `role="listbox"`, arrow /
 * Home / End / Enter / Esc, first-letter type-ahead, outside-click dismissal. `editable` turns the
 * trigger into a text field for arbitrary values (Word's font size box) while keeping the preset list.
 */

const WIDTHS = {
  // Short single-value boxes (letter spacing, text case) that share a row with icons
  xxs: 'w-[2.75rem]',
  xs: 'w-[3.25rem]',
  sm: 'w-[5.5rem]',
  md: 'w-[8.5rem]',
} as const;

const CHEVRON = (
  <svg viewBox="0 0 8 8" className="h-2 w-2 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M1 2.5 4 6l3-3.5z" />
  </svg>
);

const CHECK = (
  <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M4.6 9.2 1.4 6l1-1 2.2 2.2 4.9-4.9 1 1z" />
  </svg>
);

/** Inline style for a preview — this is what makes the list look like Office instead of a listbox */
function previewStyle(preview?: RibbonSelectPreview): CSSProperties | undefined {
  if (!preview) return undefined;
  return {
    fontFamily: preview.fontFamily,
    fontSize: preview.fontSize,
    fontWeight: preview.fontWeight,
    fontStyle: preview.fontStyle,
    textDecoration: preview.textDecoration,
    color: preview.color,
    letterSpacing: preview.letterSpacing,
  };
}

export function RibbonComboBox({
  item,
  accent,
  testId,
}: {
  item: RibbonSelectItem;
  accent: RibbonAccent;
  testId: string;
}) {
  const { label, value, options, onChange, width = 'sm', disabled = false } = item;
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Set when a pointer went down inside the popup: prevents the input's blur from committing a draft */
  const skipBlurRef = useRef(false);
  const typedRef = useRef({ buffer: '', at: 0 });
  const [open, setOpen] = useState(false);
  /** Popup side: triggers near the right edge would otherwise push the list off-screen */
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState(value);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const display = item.display ?? selected?.label ?? value;

  // Editable boxes may need to display a friendlier form of the stored value ('15px' → '15')
  const toDraft = item.toDraft;
  const fromDraft = item.fromDraft;

  useEffect(() => {
    setDraft(toDraft ? toDraft(value) : value);
  }, [toDraft, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active row visible while arrowing through a long font list
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    // jsdom (unit tests) has no scrollIntoView; the list is short there anyway
    if (typeof node?.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const rows = useMemo(
    () =>
      options.map((option, index) => ({ option, index })).filter(({ option }) => !option.heading),
    [options],
  );

  const openList = (): void => {
    if (disabled) return;
    const hit = rows.find(({ option }) => option.value === value);
    setActive(hit?.index ?? rows[0]?.index ?? 0);
    const rect = rootRef.current?.getBoundingClientRect();
    // 15rem is the widest the list can get; flip when it would not fit
    setAlign(rect && rect.left + 240 > window.innerWidth ? 'right' : 'left');
    setOpen(true);
  };

  const commit = (next: string): void => {
    setOpen(false);
    setDraft(toDraft ? toDraft(next) : next);
    if (next !== value) onChange(next);
  };

  const move = (delta: number): void => {
    if (rows.length === 0) return;
    const position = rows.findIndex(({ index }) => index === active);
    const base = position === -1 ? 0 : position;
    setActive(rows[(base + delta + rows.length) % rows.length]!.index);
  };

  const typeAhead = (key: string): void => {
    const now = Date.now();
    const buffer = now - typedRef.current.at > 600 ? key : typedRef.current.buffer + key;
    typedRef.current = { buffer, at: now };
    const needle = buffer.toLowerCase();
    const hit = rows.find(({ option }) => option.label.toLowerCase().startsWith(needle));
    if (!hit) return;
    setActive(hit.index);
    if (!open) setOpen(true);
  };

  /** Shared arrow handling: ↓/↑ walk the list, Enter picks, Esc closes */
  const onListKey = (event: ReactKeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    // Editable boxes commit whatever was typed; the preset list is only a shortcut
    if (event.key === 'Enter' && item.editable) {
      event.preventDefault();
      const text = draft.trim();
      commit(fromDraft ? fromDraft(text) : text);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      const option = options[active];
      if (option && !option.heading) commit(option.value);
      return;
    }
    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      if (item.editable) setDraft(toDraft ? toDraft(value) : value);
      return;
    }
    if (!item.editable && event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      typeAhead(event.key);
    }
  };

  const rowClass = (index: number): string =>
    `flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] text-gray-800 transition-colors dark:text-[#e8e8e8] ${
      index === active ? 'bg-black/[0.06] dark:bg-white/10' : ''
    }`;

  const popup = open ? (
    <div
      id={listId}
      ref={listRef}
      role="listbox"
      aria-label={label}
      onPointerDown={() => {
        skipBlurRef.current = true;
      }}
      className={`absolute top-full ${Z_PANEL} mt-0.5 max-h-[min(60vh,22rem)] ${align === 'right' ? 'right-0' : 'left-0'} w-max max-w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525] ${
        item.listWidth === 'wide' ? 'min-w-[15rem]' : 'min-w-[8rem]'
      }`}
    >
      {options.map((option, index) =>
        option.heading ? (
          <div
            key={`heading-${option.value}`}
            role="presentation"
            className="px-2 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-[#8a8a8a]"
          >
            {option.label}
          </div>
        ) : (
          <button
            key={option.value || 'default'}
            type="button"
            role="option"
            aria-selected={option.value === value}
            data-index={index}
            data-value={option.value}
            onPointerEnter={() => setActive(index)}
            onClick={() => commit(option.value)}
            className={rowClass(index)}
          >
            <span className="min-w-0 flex-1 truncate" style={previewStyle(option.preview)}>
              {option.label}
            </span>
            {option.preview?.hint ? (
              <span
                className="shrink-0 text-gray-400 dark:text-[#8a8a8a]"
                style={previewStyle(option.preview)}
              >
                {option.preview.hint}
              </span>
            ) : null}
            {option.value === value ? CHECK : null}
          </button>
        ),
      )}
    </div>
  ) : null;

  if (item.editable) {
    return (
      <div ref={rootRef} className={`relative shrink-0 ${WIDTHS[width]}`} data-testid={testId}>
        <div
          className={`flex h-6 w-full items-center gap-0.5 rounded border border-gray-300 bg-white pr-0.5 focus-within:border-gray-400 dark:border-[#4a4a4a] dark:bg-[#252525] ${
            disabled ? 'opacity-40' : ''
          } ${RIBBON_ACCENT[accent].ring} focus-within:ring-1`}
        >
          <input
            ref={inputRef}
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            title={label}
            value={draft}
            placeholder={item.display}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onListKey}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false;
                return;
              }
              const text = draft.trim();
              const next = fromDraft ? fromDraft(text) : text;
              if (next !== value) commit(next);
            }}
            className="h-full w-full min-w-0 bg-transparent px-1 text-[11px] text-gray-800 outline-none dark:text-[#e8e8e8]"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={label}
            aria-haspopup="listbox"
            onClick={() => (open ? setOpen(false) : openList())}
            className="flex h-5 w-3.5 items-center justify-center rounded-sm text-gray-500 hover:bg-black/[0.06] dark:text-[#a8a8a8] dark:hover:bg-white/10"
          >
            {CHEVRON}
          </button>
        </div>
        {popup}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`relative shrink-0 ${WIDTHS[width]}`} data-testid={testId}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        title={label}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onListKey}
        className={`flex h-6 w-full items-center justify-between gap-0.5 rounded border border-gray-300 bg-white px-1 text-[11px] text-gray-800 outline-none transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#4a4a4a] dark:bg-[#252525] dark:text-[#e8e8e8] ${RIBBON_ACCENT[accent].ring}`}
      >
        <span className="truncate" style={previewStyle(selected?.preview)}>
          {display}
        </span>
        <span className="text-gray-500 dark:text-[#a8a8a8]">{CHEVRON}</span>
      </button>
      {popup}
    </div>
  );
}
