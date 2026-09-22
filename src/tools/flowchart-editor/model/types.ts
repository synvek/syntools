/**
 * 流程图编辑器数据模型契约。
 * 这里只放纯数据结构（不依赖 React Flow），方便 core.ts 单测与草稿序列化。
 * React Flow 的 Node/Edge 类型在 store.ts 中按需引入。
 * 尺寸查询请走 `./shapes`（图形目录），避免 types → shapes 的循环依赖。
 */

export type ShapeKind =
  // 通用图形
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'diamond'
  | 'parallelogram'
  | 'trapezoid'
  | 'hexagon'
  | 'cylinder'
  | 'note'
  | 'triangle'
  | 'star'
  | 'pentagon'
  | 'octagon'
  | 'chevron'
  | 'card'
  | 'callout'
  | 'cloud'
  | 'cross'
  | 'plus'
  | 'flag'
  | 'lightning'
  | 'arrow'
  | 'bracket'
  // 流程图
  | 'startEnd'
  | 'decision'
  | 'data'
  | 'document'
  | 'predefined'
  | 'manualInput'
  | 'manualOperation'
  | 'preparation'
  | 'database'
  | 'display'
  | 'onPageConnector'
  | 'offPageConnector'
  | 'terminator'
  | 'parallelMode'
  | 'loopLimit'
  // UML
  | 'umlActor'
  | 'umlUseCase'
  | 'umlClass'
  | 'umlInterface'
  | 'umlPackage'
  | 'umlNote'
  | 'umlLifeline'
  | 'umlState'
  | 'umlStateInitial'
  | 'umlStateFinal'
  | 'umlForkJoin'
  // BPMN 2.0
  | 'bpmnEventStart'
  | 'bpmnEventIntermediate'
  | 'bpmnEventEnd'
  | 'bpmnGatewayExclusive'
  | 'bpmnGatewayParallel'
  | 'bpmnGatewayInclusive'
  | 'bpmnTask'
  | 'bpmnSubProcess'
  | 'bpmnCallActivity'
  | 'bpmnDataObject'
  | 'bpmnDataStore'
  | 'bpmnTextAnnotation'
  // 网络与云架构
  | 'netServer'
  | 'netClient'
  | 'netRouter'
  | 'netSwitch'
  | 'netFirewall'
  | 'netLoadBalancer'
  | 'netCloud'
  | 'netCdn'
  | 'netDatabase'
  | 'netStorage'
  // 组织结构
  | 'orgUnit'
  | 'orgAssistant'
  | 'orgTeam'
  // 思维导图
  | 'mindCenter'
  | 'mindTopic'
  | 'mindSub'
  // ER
  | 'erEntity'
  | 'erAttribute'
  | 'erRelationship'
  | 'erWeakEntity'
  // 容器
  | 'swimlane'
  | 'swimlaneV'
  | 'group';

export type Align = 'left' | 'center' | 'right';

export interface FlowNodeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: Align;
  /** 整体不透明度 0~1（驱动 fill-opacity，文字同步） */
  opacity?: number;
  /** 是否显示投影 */
  shadow?: boolean;
  /** 描边线型（节点轮廓虚线） */
  lineDash?: 'solid' | 'dashed' | 'dotted';
  /** 字体族 */
  fontFamily?: string;
  /** 文字颜色（与 stroke 区分） */
  textColor?: string;
  /** 圆角半径（roundRect / rect 可选圆角） */
  cornerRadius?: number;
  /** 便签（note）右上折角三角块大小 */
  foldSize?: number;
}

export interface FlowNodeData extends Record<string, unknown> {
  kind: ShapeKind;
  label: string;
  style: FlowNodeStyle;
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string;
}

/** 连线线型 */
export type EdgeType = 'straight' | 'smoothstep' | 'step' | 'bezier';

/** 连线线样式：实线 / 虚线 / 点线 / 点划线 / 实线手绘 / 虚线手绘 */
export type EdgeDash = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'sketch' | 'sketchDashed';

/** 连线箭头风格 */
export type EdgeArrow = 'none' | 'arrowclosed' | 'arrow' | 'circle' | 'diamond' | 'square' | 'bar';

/** 连线样式（工具栏 / 属性面板可编辑） */
export interface FlowEdgeStyle {
  /** straight 直线 / smoothstep 圆角折线 / step 直角折线 / bezier 曲线 */
  type: EdgeType;
  stroke: string;
  strokeWidth: number;
  dash: EdgeDash;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
}

export const DEFAULT_EDGE_STYLE: FlowEdgeStyle = {
  type: 'smoothstep',
  stroke: '#475569',
  strokeWidth: 2,
  dash: 'solid',
  startArrow: 'none',
  endArrow: 'arrowclosed',
};

/** 连线类型下拉选项 */
export const EDGE_TYPE_OPTIONS: EdgeType[] = ['smoothstep', 'straight', 'step', 'bezier'];
/** 线样式下拉选项 */
export const EDGE_DASH_OPTIONS: EdgeDash[] = [
  'solid',
  'dashed',
  'dotted',
  'dashdot',
  'sketch',
  'sketchDashed',
];
/** 箭头下拉选项 */
export const EDGE_ARROW_OPTIONS: EdgeArrow[] = [
  'none',
  'arrowclosed',
  'arrow',
  'circle',
  'diamond',
  'square',
  'bar',
];

/** 箭头 → i18n 键后缀（tools.flowchart.arrow*） */
export const EDGE_ARROW_LABEL_KEY: Record<EdgeArrow, string> = {
  none: 'arrowNone',
  arrowclosed: 'arrowSolid',
  arrow: 'arrowOpen',
  circle: 'arrowCircle',
  diamond: 'arrowDiamond',
  square: 'arrowSquare',
  bar: 'arrowBar',
};

/** 部分更新节点数据：style 允许只传需要改动的字段 */
export type FlowNodePatch = Partial<Omit<FlowNodeData, 'style'>> & {
  style?: Partial<FlowNodeStyle>;
};

/** 画布上一个节点的持久化记录 */
export interface FlowNodeRec {
  id: string;
  type: 'shape';
  /** 有 parentId 时，坐标是相对父节点（泳道/编组）的左上角 */
  position: { x: number; y: number };
  parentId?: string | null;
  data: FlowNodeData;
  /** 用户手动调整过的尺寸（未设置时取图形目录默认值） */
  width?: number;
  height?: number;
  /** 图层：隐藏 */
  hidden?: boolean;
  /** 图层：锁定（不可拖动/编辑） */
  locked?: boolean;
}

/** 画布上一条连线的持久化记录 */
export interface FlowEdgeRec {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  style?: FlowEdgeStyle;
}

/** v1：单页文档（历史草稿与旧项目文件） */
export interface FlowDocV1 {
  version: 1;
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
}

/** 一页画布 */
export interface FlowPage {
  id: string;
  name: string;
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
}

/** v2：多页文档（当前规范形态） */
export interface FlowDocV2 {
  version: 2;
  /** 文档标题：导出文件名来源（与工具栏标题输入框一致） */
  name?: string;
  pages: FlowPage[];
  activePageId?: string;
}

/** 内部统一使用 v2；v1 读取时经 `model/migrate.ts` 归一 */
export type FlowDoc = FlowDocV2;

/** 各形状的默认尺寸（像素） */
export interface ShapeSize {
  width: number;
  height: number;
}

/** 图形中文名（i18n 缺失时的回退，完整 9 语翻译见 strings.ts） */
export const SHAPE_LABELS: Record<ShapeKind, string> = {
  rect: '过程',
  roundRect: '圆角矩形',
  ellipse: '椭圆',
  diamond: '菱形',
  parallelogram: '平行四边形',
  trapezoid: '梯形',
  hexagon: '六边形',
  cylinder: '圆柱',
  note: '便签',
  triangle: '三角形',
  star: '星形',
  pentagon: '五边形',
  octagon: '八边形',
  chevron: '箭头',
  card: '卡片',
  callout: '标注',
  cloud: '云',
  cross: '叉号',
  plus: '加号',
  flag: '旗帜',
  lightning: '闪电',
  arrow: '箭头图形',
  bracket: '方括号',
  startEnd: '开始/结束',
  decision: '判断',
  data: '数据',
  document: '文档',
  predefined: '预定义过程',
  manualInput: '手动输入',
  manualOperation: '人工操作',
  preparation: '准备',
  database: '数据库',
  display: '显示',
  onPageConnector: '同页连接符',
  offPageConnector: '离页连接符',
  terminator: '终止',
  parallelMode: '并行模式',
  loopLimit: '循环上限',
  umlActor: '角色',
  umlUseCase: '用例',
  umlClass: '类',
  umlInterface: '接口',
  umlPackage: '包',
  umlNote: '注释',
  umlLifeline: '生命线',
  umlState: '状态',
  umlStateInitial: '初始状态',
  umlStateFinal: '终止状态',
  umlForkJoin: '分叉/汇合',
  bpmnEventStart: '开始事件',
  bpmnEventIntermediate: '中间事件',
  bpmnEventEnd: '结束事件',
  bpmnGatewayExclusive: '排他网关',
  bpmnGatewayParallel: '并行网关',
  bpmnGatewayInclusive: '包容网关',
  bpmnTask: '任务',
  bpmnSubProcess: '子流程',
  bpmnCallActivity: '调用活动',
  bpmnDataObject: '数据对象',
  bpmnDataStore: '数据存储',
  bpmnTextAnnotation: '文本注释',
  netServer: '服务器',
  netClient: '客户端',
  netRouter: '路由器',
  netSwitch: '交换机',
  netFirewall: '防火墙',
  netLoadBalancer: '负载均衡',
  netCloud: '云',
  netCdn: 'CDN',
  netDatabase: '数据库',
  netStorage: '存储',
  orgUnit: '组织单元',
  orgAssistant: '助理',
  orgTeam: '团队',
  mindCenter: '中心主题',
  mindTopic: '子主题',
  mindSub: '三级主题',
  erEntity: '实体',
  erAttribute: '属性',
  erRelationship: '关系',
  erWeakEntity: '弱实体',
  swimlane: '横向泳道',
  swimlaneV: '纵向泳道',
  group: '编组',
};

/** 横向泳道：标准横向长条 */
export const SWIMLANE_SIZE: ShapeSize = { width: 760, height: 220 };
/** 纵向泳道：标准纵向长条 */
export const SWIMLANE_V_SIZE: ShapeSize = { width: 240, height: 640 };
/** 泳道标题栏厚度（横向为高度，纵向为宽度） */
export const SWIMLANE_HEADER_HEIGHT = 40;
export const SWIMLANE_HEADER_WIDTH = 40;

/** 容器类形状可以容纳其它节点（泳道 / 编组） */
export function isContainerKind(kind: ShapeKind): boolean {
  return kind === 'swimlane' || kind === 'swimlaneV' || kind === 'group';
}

/** 是否为纵向容器（长边垂直，标题栏在顶部横排） */
export function isVerticalLane(kind: ShapeKind): boolean {
  return kind === 'swimlaneV';
}
