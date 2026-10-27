/**
 * Mind map editor data model contract.
 * Pure data structures only (no React Flow dependency), so the core layer unit-tests easily and
 * drafts serialise simply. A mind map is a tree: one root plus parent / child levels, with
 * coordinates computed by model/layout.ts and handed to the canvas for rendering.
 */

/** Layout direction: rightward logic chart / split left and right / downward org chart */
export type MindLayoutDirection = 'right' | 'both' | 'down';

/** Node outline shapes (the ones mind maps commonly use) */
export type MindNodeShape = 'rounded' | 'pill' | 'underline' | 'rect' | 'ellipse';

/** Side of the top-level branch, only for the both-sides layout */
export type MindSide = 'left' | 'right';

export type MindAlign = 'left' | 'center' | 'right';

export interface MindNodeStyle {
  fill: string;
  stroke: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: MindAlign;
}

export interface MindNodeRec {
  id: string;
  /** null for the root node */
  parentId: string | null;
  text: string;
  note?: string;
  /** When collapsed, the subtree is excluded from layout (data is kept) */
  collapsed?: boolean;
  side?: MindSide;
  shape?: MindNodeShape;
  /** Branch colour; derived from the theme and depth when omitted */
  color?: string;
  style?: Partial<MindNodeStyle>;
}

export interface MindDoc {
  version: 1;
  /** Document title, used for export filenames (matches the toolbar title input) */
  name?: string;
  rootId: string;
  nodes: MindNodeRec[];
  direction: MindLayoutDirection;
  themeId: string;
}

export const MIND_DIRECTIONS: MindLayoutDirection[] = ['right', 'both', 'down'];

export const MIND_SHAPES: MindNodeShape[] = ['rounded', 'pill', 'underline', 'rect', 'ellipse'];

export const MIND_ALIGNS: MindAlign[] = ['left', 'center', 'right'];

/** One canvas (a sheet) reuses MindDoc as its content payload */
export interface MindSheet {
  id: string;
  name: string;
  doc: MindDoc;
}

/** Multi-sheet project (persisted form): a document title plus several sheets */
export interface MindProject {
  version: 2;
  /** Document title, used for export filenames (matches the toolbar title input) */
  name?: string;
  sheets: MindSheet[];
  activeSheetId?: string;
}
