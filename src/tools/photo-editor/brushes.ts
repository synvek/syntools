import { DEFAULT_BRUSH_PRESETS, normalizeBrushPresets } from './core';
import type { BrushPreset } from './core';

/**
 * Persistence for custom brush presets (localStorage).
 *
 * Only **user-created** presets are stored; built-ins come from `core.DEFAULT_BRUSH_PRESETS` (names via i18n),
 * so upgrading the built-ins never clashes with user data. All reads / writes are fault-tolerant and corrupt data falls back to an empty list.
 */

const STORAGE_KEY = 'syntools.photo.brushPresets';
const MAX_PRESETS = 12;

export function loadBrushPresets(): BrushPreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeBrushPresets(JSON.parse(raw)).slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

export function saveBrushPresets(presets: BrushPreset[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
  } catch {
    // Private mode / quota exceeded: degrade silently (presets are a convenience, not the main flow)
  }
}

/** Full preset list shown in the UI: built-ins first, custom ones after */
export function allBrushPresets(custom: BrushPreset[]): BrushPreset[] {
  return [...DEFAULT_BRUSH_PRESETS, ...custom];
}
