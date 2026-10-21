import type { ShapeKind } from './model/types';

/**
 * 形状种类 → 图标名（与 `SHAPE_KINDS` 一一对应）。
 *
 * 单独成模块的原因：形状组按钮、形状浮层、图层面板里的形状徽标都要用同一份映射，
 * 各写一份很容易出现「浮层里是矩形图标、按钮上还是通用 shapes」这种不一致。
 */
export const SHAPE_ICONS: Record<ShapeKind, string> = {
  rect: 'shapeRect',
  roundRect: 'shapeRoundRect',
  ellipse: 'shapeEllipse',
  line: 'shapeLine',
  arrow: 'shapeArrow',
  star: 'shapeStar',
};
