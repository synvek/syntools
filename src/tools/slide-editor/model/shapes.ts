/**
 * 形状库：插入面板可见的 prstGeom 预设。
 *
 * 这里比 `core.ts` 的 `PRST_GEOMS` 小得多 —— 那个表要覆盖导入侧可能遇到的
 * 30+ 种预设几何，而插入面板只需覆盖日常高频形状；刻意收窄的好处是
 * 每个形状都能有 9 语言的正式名称，而不是在英文界面里显示中文或技术代号。
 */

export interface ShapePreset {
  /** DrawingML 预设几何名，与导入/导出共用同一套取值 */
  prst: string;
  /** `tools.slide.*` 下的 i18n 键后缀 */
  labelKey: string;
}

export const SHAPE_PRESETS: ShapePreset[] = [
  { prst: 'rect', labelKey: 'shapePresetRect' },
  { prst: 'roundRect', labelKey: 'shapePresetRoundRect' },
  { prst: 'snipRoundRect', labelKey: 'shapePresetSnipRoundRect' },
  { prst: 'ellipse', labelKey: 'shapePresetEllipse' },
  { prst: 'triangle', labelKey: 'shapePresetTriangle' },
  { prst: 'rtTriangle', labelKey: 'shapePresetRtTriangle' },
  { prst: 'diamond', labelKey: 'shapePresetDiamond' },
  { prst: 'trapezoid', labelKey: 'shapePresetTrapezoid' },
  { prst: 'pentagon', labelKey: 'shapePresetPentagon' },
  { prst: 'hexagon', labelKey: 'shapePresetHexagon' },
  { prst: 'rightArrow', labelKey: 'shapePresetRightArrow' },
  { prst: 'chevron', labelKey: 'shapePresetChevron' },
  { prst: 'star', labelKey: 'shapePresetStar' },
  { prst: 'star6', labelKey: 'shapePresetStar6' },
];
