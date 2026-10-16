import { DEFAULT_BRUSH_PRESETS, normalizeBrushPresets } from './core';
import type { BrushPreset } from './core';

/**
 * 自定义画笔预设的持久化（localStorage）。
 *
 * 只存**用户自建**的预设；内置预设来自 `core.DEFAULT_BRUSH_PRESETS`（名字走 i18n），
 * 因此升级内置预设不会与用户数据冲突。读写全部容错，损坏数据一律回落到空列表。
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
    // 隐私模式 / 配额不足：静默降级（预设只是便利功能，不影响主流程）
  }
}

/** 界面展示用的完整预设列表：内置在前，自定义在后 */
export function allBrushPresets(custom: BrushPreset[]): BrushPreset[] {
  return [...DEFAULT_BRUSH_PRESETS, ...custom];
}
