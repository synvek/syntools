/**
 * Shape library: prstGeom presets exposed in the insert panel.
 *
 * Much smaller than `PRST_GEOMS` in `core.ts` — that table must cover the 30+ preset geometries the
 * import side can encounter, while the insert panel only needs everyday shapes; the deliberate
 * narrowing means every shape has a proper name in all 9 languages instead of showing Chinese or a raw code in English UIs.
 */

export interface ShapePreset {
  /** DrawingML preset geometry name, sharing values with import/export */
  prst: string;
  /** i18n key suffix under `tools.slide.*` */
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
