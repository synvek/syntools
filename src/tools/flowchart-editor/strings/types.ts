/**
 * Type contract for the flowchart editor's copy: one bundle per language (UI copy + shape names),
 * loaded on demand by `strings/index.ts` and merged into i18next resources.
 */

export type StringTree = { [key: string]: string | StringTree };
export type ResourceTree = { tools: { flowchart: StringTree } };

/** Shape name mapping: `ShapeKind` → display name */
export type ShapeLabelMap = Record<string, string>;

export interface LangBundle {
  /** UI copy (`tools.flowchart.*`) */
  ui: ResourceTree;
  /** Shape names (prefixed with `shape_` when registered) */
  shapes: ShapeLabelMap;
}
