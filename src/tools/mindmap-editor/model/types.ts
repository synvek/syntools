/**
 * 脑图编辑器数据模型契约。
 * 只放纯数据结构（不依赖 React Flow），便于 core 层单测与草稿序列化。
 * 脑图本质是「树」：单一根 + 父子层级，坐标由 model/layout.ts 计算后交给画布渲染。
 */

/** 布局方向：向右逻辑图 / 左右两侧分布 / 向下组织图 */
export type MindLayoutDirection = 'right' | 'both' | 'down';

/** 节点外框形状（脑图常见的几种） */
export type MindNodeShape = 'rounded' | 'pill' | 'underline' | 'rect' | 'ellipse';

/** 仅「左右分布」布局下的一级分支所在侧 */
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
  /** 根节点为 null */
  parentId: string | null;
  text: string;
  note?: string;
  /** 折叠后其子树不参与布局（数据保留） */
  collapsed?: boolean;
  side?: MindSide;
  shape?: MindNodeShape;
  /** 分支主色；缺省时按主题与层级推导 */
  color?: string;
  style?: Partial<MindNodeStyle>;
}

export interface MindDoc {
  version: 1;
  /** 文档标题：导出文件名来源（与工具栏标题输入框一致） */
  name?: string;
  rootId: string;
  nodes: MindNodeRec[];
  direction: MindLayoutDirection;
  themeId: string;
}

export const MIND_DIRECTIONS: MindLayoutDirection[] = ['right', 'both', 'down'];

export const MIND_SHAPES: MindNodeShape[] = ['rounded', 'pill', 'underline', 'rect', 'ellipse'];

export const MIND_ALIGNS: MindAlign[] = ['left', 'center', 'right'];

/** 单张画布（脑图一个 sheet）复用 MindDoc 作为内容载体 */
export interface MindSheet {
  id: string;
  name: string;
  doc: MindDoc;
}

/** 多画布工程（持久化形态）：文档标题 + 多张画布 */
export interface MindProject {
  version: 2;
  /** 文档标题：导出文件名来源（与工具栏标题输入框一致） */
  name?: string;
  sheets: MindSheet[];
  activeSheetId?: string;
}
