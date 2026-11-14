import type { SheetCommandId } from './commands';

/**
 * Keyboard shortcuts for the commands this tool owns (P1-1).
 *
 * Scope is deliberate: **only commands the sheet engine does not implement itself**. Bold, undo,
 * find and friends are handled inside Univer's own keymap, and binding them here as well would run
 * them twice (a toggle applied twice looks like nothing happened). The help overlay therefore says
 * so explicitly instead of pretending to own the whole keyboard.
 *
 * A second constraint is the browser: Ctrl/⌘+N, +T and +W cannot be intercepted, so they are not
 * offered at all. Everything listed here is verified to be preventable.
 */

export interface ParsedShortcut {
  /** Lower-cased `event.key` */
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutBinding {
  id: SheetCommandId;
  /** Human notation, e.g. `Mod+Shift+S`. `Mod` is ⌘ on macOS and Ctrl elsewhere */
  keys: string[];
}

/**
 * The bindings. Ordered by how often they are used so the help overlay reads like a cheat sheet.
 * Kept in sync with the command table by `shortcuts.test.ts` (every id must exist, no duplicates).
 */
export const SHEET_SHORTCUTS: ShortcutBinding[] = [
  { id: 'exportXlsx', keys: ['Mod+S'] },
  { id: 'importXlsx', keys: ['Mod+O'] },
  { id: 'print', keys: ['Mod+P'] },
  { id: 'exportCsv', keys: ['Mod+Shift+S'] },
  { id: 'formatCells', keys: ['Mod+Alt+1'] },
  { id: 'library', keys: ['Mod+Alt+L'] },
  { id: 'versions', keys: ['Mod+Alt+V'] },
  { id: 'newDoc', keys: ['Mod+Alt+N'] },
  { id: 'shortcutHelp', keys: ['Mod+Alt+/'] },
];

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  space: ' ',
  '+': '+',
};

/** `Mod+Shift+S` → `{ key: 's', mod: true, shift: true, alt: false }`; `null` when unusable */
export function parseShortcut(text: string): ParsedShortcut | null {
  const tokens = text
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const parsed: ParsedShortcut = { key: '', mod: false, shift: false, alt: false };
  for (const token of tokens) {
    if (token === 'mod' || token === 'cmd' || token === 'ctrl') parsed.mod = true;
    else if (token === 'shift') parsed.shift = true;
    else if (token === 'alt' || token === 'option') parsed.alt = true;
    else if (!parsed.key) parsed.key = KEY_ALIASES[token] ?? token;
    // A second non-modifier token means the notation is wrong — reject rather than guess
    else return null;
  }
  if (!parsed.key) return null;
  return parsed;
}

/** `navigator.platform` is deprecated but still the only synchronous answer inside the app */
export function isMacPlatform(): boolean {
  const platform =
    typeof navigator === 'undefined'
      ? ''
      : navigator.platform || (navigator as { userAgent?: string }).userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Display form: `⌘⇧S` on macOS, `Ctrl+Shift+S` everywhere else */
export function formatShortcut(text: string, mac: boolean): string {
  const parsed = parseShortcut(text);
  if (!parsed) return text;
  const key = parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key;
  if (mac)
    return `${parsed.mod ? '⌘' : ''}${parsed.shift ? '⇧' : ''}${parsed.alt ? '⌥' : ''}${key}`;
  const parts: string[] = [];
  if (parsed.mod) parts.push('Ctrl');
  if (parsed.shift) parts.push('Shift');
  if (parsed.alt) parts.push('Alt');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

export interface ShortcutEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Exact modifier match: extra modifiers make it *not* match, so `Mod+S` cannot be triggered by
 * `Mod+Shift+S` (which is Export CSV).
 */
export function matchesShortcut(
  event: ShortcutEventLike,
  parsed: ParsedShortcut,
  mac: boolean,
): boolean {
  const modPressed = mac ? event.metaKey : event.ctrlKey;
  const modOk = parsed.mod ? modPressed : !event.metaKey && !event.ctrlKey;
  return (
    modOk &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt &&
    event.key.toLowerCase() === parsed.key
  );
}

/** First command bound to the event, or `null`. Later duplicates never win silently (see tests). */
export function findShortcut(
  event: ShortcutEventLike,
  mac: boolean,
  bindings: ShortcutBinding[] = SHEET_SHORTCUTS,
): SheetCommandId | null {
  for (const binding of bindings) {
    for (const keys of binding.keys) {
      const parsed = parseShortcut(keys);
      if (parsed && matchesShortcut(event, parsed, mac)) return binding.id;
    }
  }
  return null;
}

/** Two commands claiming the same combo would make the second unreachable */
export function duplicateShortcuts(bindings: ShortcutBinding[] = SHEET_SHORTCUTS): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const binding of bindings) {
    for (const keys of binding.keys) {
      const parsed = parseShortcut(keys);
      if (!parsed) continue;
      const signature = `${parsed.mod ? 'mod+' : ''}${parsed.shift ? 'shift+' : ''}${
        parsed.alt ? 'alt+' : ''
      }${parsed.key}`;
      const owner = seen.get(signature);
      if (owner && owner !== binding.id) duplicates.push(`${signature}: ${owner} / ${binding.id}`);
      else seen.set(signature, binding.id);
    }
  }
  return duplicates;
}

/** Shortcut of one command, formatted for the current platform (used by the ⋯ menu) */
export function shortcutLabel(id: SheetCommandId, mac: boolean): string | null {
  const binding = SHEET_SHORTCUTS.find((entry) => entry.id === id);
  const first = binding?.keys[0];
  return first ? formatShortcut(first, mac) : null;
}
