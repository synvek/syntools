import { normalizeBackground } from '../core';
import { SCHEMA_VERSION } from './factory';
import type {
  Slide,
  SlideBackground,
  SlideDoc,
  SlideElement,
  SlideLayout,
  SlideMaster,
} from './types';

/**
 * 文档结构迁移。
 *
 * v2 相对 v1 的变化：
 * - 页面/版式/母版背景由「纯色字符串」升级为 `Fill`（支持渐变）；
 * - 新增 chart / formula / icon 元素（v1 数据只是没有这些元素，无需转换）；
 * - 新增 run 级扩展属性（字距/上下标/高亮/超链接）与元素级超链接/投影，均为可选字段。
 *
 * 迁移是**幂等**的：已归一化的数据再次迁移不产生变化。
 * `.sld` 工程文件与 localStorage 草稿共用同一入口，避免两条读取路径行为不一致。
 */

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

/** 读取时的背景归一化：旧 string → SolidFill，非法值剔除 */
function migrateBackground(bg: SlideBackground | undefined): SlideBackground | undefined {
  if (bg === undefined || bg === null) return undefined;
  if (typeof bg !== 'string') return bg;
  // 非法色值（如旧版本写入的 'transparent'）直接丢弃，回落到母版继承
  return normalizeBackground(bg) ?? undefined;
}

/** 元素级迁移：v1→v2 目前只需保证组合元素内部递归一致 */
function migrateElement(element: SlideElement): SlideElement {
  if (element.type === 'group' && Array.isArray(element.children)) {
    return { ...element, children: element.children.map(migrateElement) };
  }
  return element;
}

function migrateElements(elements: SlideElement[] | undefined): SlideElement[] {
  if (!Array.isArray(elements)) return [];
  return elements.map(migrateElement);
}

function migrateSlide(slide: Slide): Slide {
  return {
    ...slide,
    background: migrateBackground(slide.background),
    elements: migrateElements(slide.elements),
  };
}

function migrateLayout(layout: SlideLayout): SlideLayout {
  return {
    ...layout,
    background: migrateBackground(layout.background),
    elements: migrateElements(layout.elements),
  };
}

function migrateMaster(master: SlideMaster): SlideMaster {
  return {
    ...master,
    background: migrateBackground(master.background),
    elements: migrateElements(master.elements),
  };
}

/**
 * 把任意历史版本的 SlideDoc 升到当前 schema。
 *
 * 对损坏数据做最小防御：slides / masters / layouts / media 缺失时补空容器，
 * 避免渲染层因 undefined 崩溃（localStorage 里可能残留半截 JSON）。
 */
export function migrateDoc(input: SlideDoc): SlideDoc {
  if (!input || typeof input !== 'object') return input;
  if (input.schemaVersion === CURRENT_SCHEMA_VERSION) return input;

  return {
    ...input,
    width: input.width || 1280,
    height: input.height || 720,
    masters: Array.isArray(input.masters) ? input.masters.map(migrateMaster) : [],
    layouts: Array.isArray(input.layouts) ? input.layouts.map(migrateLayout) : [],
    slides: Array.isArray(input.slides) ? input.slides.map(migrateSlide) : [],
    media: input.media && typeof input.media === 'object' ? input.media : {},
    version: input.version || 1,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}
