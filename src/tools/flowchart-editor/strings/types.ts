/**
 * 流程图编辑器文案的类型契约：每个语种一个 bundle（UI 文案 + 图形名），
 * 由 `strings/index.ts` 按需加载后合并成 i18next 资源。
 */

export type StringTree = { [key: string]: string | StringTree };
export type ResourceTree = { tools: { flowchart: StringTree } };

/** 图形名映射：`ShapeKind` → 显示名 */
export type ShapeLabelMap = Record<string, string>;

export interface LangBundle {
  /** UI 文案（`tools.flowchart.*`） */
  ui: ResourceTree;
  /** 图形名（注册时加 `shape_` 前缀） */
  shapes: ShapeLabelMap;
}
