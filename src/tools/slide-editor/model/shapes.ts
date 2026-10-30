/**
 * Shape library exposed by the insert panel, derived from `shapeDefs.ts`.
 *
 * The panel needs grouping and a label for every entry; `SHAPE_DEFS` is the single source so
 * geometry, adjustment handles and the panel can never drift apart.
 */
import { SHAPE_DEFS, type ShapeGroup } from '../../../core/drawing/shapeDefs';

export interface ShapePreset {
  /** DrawingML preset geometry name, sharing values with import/export */
  prst: string;
  /** i18n key suffix under `tools.slide.*` */
  labelKey: string;
  /** Panel section */
  group: ShapeGroup;
}

export const SHAPE_PRESETS: ShapePreset[] = SHAPE_DEFS.map((def) => ({
  prst: def.prst,
  labelKey: def.labelKey,
  group: def.group,
}));

export const SHAPE_GROUPS: { id: ShapeGroup; labelKey: string }[] = [
  { id: 'basic', labelKey: 'shapeGroupBasic' },
  { id: 'arrow', labelKey: 'shapeGroupArrow' },
  { id: 'star', labelKey: 'shapeGroupStar' },
  { id: 'flowchart', labelKey: 'shapeGroupFlowchart' },
  { id: 'callout', labelKey: 'shapeGroupCallout' },
  { id: 'math', labelKey: 'shapeGroupMath' },
];
