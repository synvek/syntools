import type { ShapeKind } from './model/types';

/**
 * Shape kind → icon name (one-to-one with `SHAPE_KINDS`).
 *
 * Why a separate module: the shape group button, the shape flyout and the shape badge in the layers panel all need the
 * same mapping, and separate copies drift into "the flyout shows a rectangle icon while the button still shows generic shapes".
 */
export const SHAPE_ICONS: Record<ShapeKind, string> = {
  rect: 'shapeRect',
  roundRect: 'shapeRoundRect',
  ellipse: 'shapeEllipse',
  line: 'shapeLine',
  arrow: 'shapeArrow',
  star: 'shapeStar',
};
