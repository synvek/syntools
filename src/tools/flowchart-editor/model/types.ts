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
  // UML 通用
  | 'umlActor'
  | 'umlNote'
  | 'umlBoundary'
  | 'umlControl'
  | 'umlEntity'
  | 'umlFrame'
  // UML 用例图
  | 'umlUseCase'
  | 'umlSubject'
  | 'umlInclude'
  | 'umlExtend'
  | 'umlExtensionPoint'
  // UML 类图
  | 'umlClass'
  | 'umlInterface'
  | 'umlEnumeration'
  | 'umlDataType'
  | 'umlAbstractClass'
  | 'umlActiveClass'
  | 'umlTemplateClass'
  | 'umlAssociationClass'
  // UML 对象/包图
  | 'umlPackage'
  | 'umlObject'
  | 'umlObjectSlot'
  | 'umlModel'
  | 'umlProfile'
  // UML 时序图
  | 'umlLifeline'
  | 'umlActivation'
  | 'umlDestroy'
  | 'umlCombinedFragment'
  | 'umlInteractionUse'
  | 'umlStateInvariant'
  | 'umlGate'
  // UML 活动图
  | 'umlForkJoin'
  | 'umlAction'
  | 'umlActivity'
  | 'umlDecisionMerge'
  | 'umlInitialNode'
  | 'umlActivityFinal'
  | 'umlFlowFinal'
  | 'umlObjectNode'
  | 'umlSendSignal'
  | 'umlReceiveSignal'
  | 'umlActivityPartition'
  // UML 状态图
  | 'umlState'
  | 'umlStateInitial'
  | 'umlStateFinal'
  | 'umlChoice'
  | 'umlJunction'
  | 'umlTerminate'
  | 'umlEntryPoint'
  | 'umlExitPoint'
  | 'umlHistory'
  | 'umlHistoryDeep'
  | 'umlCompositeState'
  // UML 组件图
  | 'umlComponent'
  | 'umlProvidedInterface'
  | 'umlRequiredInterface'
  | 'umlPort'
  | 'umlSubsystem'
  // UML 部署图
  | 'umlNode'
  | 'umlDevice'
  | 'umlExecutionEnvironment'
  | 'umlArtifact'
  | 'umlDeploymentSpec'
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
  /**
   * 形状可调参数（类 draw.io 调整顶点）：键 → 数值，仅记录被用户改动过的键。
   * 键与取值范围由图形目录的 `ShapeDef.adjust` 声明，见 `model/shapes/adjust.ts`。
   */
  shapeParams?: Record<string, number>;
  /* ------------------------------ 节点变换 ------------------------------ */
  /**
   * 旋转角度（度，0~360 顺时针）。
   * 以节点包围盒中心为原点做纯 CSS transform，**不改动几何与连线锚点**：
   * 连线仍吸附未旋转的轴对齐包围盒，与 draw.io 的 bbox 行为一致。
   */
  rotation?: number;
  /** 水平镜像（左右翻转） */
  flipH?: boolean;
  /** 垂直镜像（上下翻转） */
  flipV?: boolean;
  /* ------------------------------ 文本排版 ------------------------------ */
  /** 文本垂直对齐（缺省 middle，与历史行为一致） */
  verticalAlign?: VerticalAlign;
  /** 行高（倍数，缺省 1.25） */
  lineHeight?: number;
  /** 文字自动缩放以适应框体（缺省关闭） */
  autoShrink?: boolean;
  /** 标签背景色（缺省透明） */
  labelBackground?: string;
  /** 超链接（仅允许 http/https/mailto 协议，渲染时校验） */
  link?: string;
}

/** 文本垂直对齐 */
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/** 垂直对齐下拉选项 */
export const VERTICAL_ALIGN_OPTIONS: VerticalAlign[] = ['top', 'middle', 'bottom'];

/** 垂直对齐 → 弹性主轴映射（面板与渲染共用，避免散落魔术字符串） */
export const VERTICAL_ALIGN_FLEX: Record<VerticalAlign, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

/** 旋转默认吸附步长（度）；按住 Shift 使用精细步长 */
export const ROTATION_SNAP_STEP = 15;
/** 旋转精细步长（按住 Shift，度） */
export const ROTATION_FINE_STEP = 45;
/** 默认行高倍数（与历史 CSS 行为一致） */
export const DEFAULT_LINE_HEIGHT = 1.25;

/** 节点类型：图形 / 图片 / 内置图标 / 公式 */
export type FlowNodeType = 'shape' | 'image' | 'icon' | 'formula';

/** 非图形节点的默认尺寸 */
export const IMAGE_NODE_SIZE: ShapeSize = { width: 240, height: 160 };
export const ICON_NODE_SIZE: ShapeSize = { width: 64, height: 64 };
export const FORMULA_NODE_SIZE: ShapeSize = { width: 200, height: 64 };

/** 单张图片的最大边长（超过则等比压缩，控制草稿体积） */
export const IMAGE_MAX_EDGE = 1600;
/** 草稿体积上限（字符数，约 4MB）；超限时降级为「不含图片」的草稿 */
export const DRAFT_SIZE_LIMIT = 4_000_000;

/** 单次粘贴/导入可插入的最大节点数（防止异常内容拖垮画布） */
export const MAX_PASTE_NODES = 500;

export interface FlowNodeData extends Record<string, unknown> {
  kind: ShapeKind;
  label: string;
  style: FlowNodeStyle;
  /** 图片节点的 dataURL（type === 'image'） */
  src?: string;
  /** 图标节点的图标 id（type === 'icon'） */
  iconId?: string;
  /** 公式节点的 LaTeX 源码（type === 'formula'） */
  formula?: string;
  /**
   * 容器（泳道 / 编组）折叠：仅保留标题栏并隐藏子节点。
   * 放在 data 上以便随 React Flow 节点自动流转；缺省即展开，子节点数据完整保留。
   */
  collapsed?: boolean;
  /** 导入时未识别的 mxGraph 样式 token（Draw.io 往返时回写，减少样式丢失） */
  mxStyle?: string[];
}

/** 连线折点（画布绝对坐标） */
export interface Waypoint {
  x: number;
  y: number;
}

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string;
  /** 起点侧标签（缺省不显示）；与主标签、终点标签互相独立 */
  sourceLabel?: string;
  /** 终点侧标签（缺省不显示） */
  targetLabel?: string;
  /** 主标签在路径上的位置：居中（缺省）/ 靠近起点 / 靠近终点 */
  labelPosition?: EdgeLabelPosition;
  /** 连线样式（渲染层读取，展示于属性面板） */
  style?: FlowEdgeStyle;
  /** 手动/导入的折点；缺省表示无折点 */
  waypoints?: Waypoint[];
  /** 导入时未识别的 mxGraph 样式 token（Draw.io 往返时回写） */
  mxStyle?: string[];
}

/** 主标签在连线路径上的位置 */
export type EdgeLabelPosition = 'center' | 'nearSource' | 'nearTarget';

export const EDGE_LABEL_POSITION_OPTIONS: EdgeLabelPosition[] = [
  'center',
  'nearSource',
  'nearTarget',
];

/** 标签位置 → 路径长度比例（用于按路径取点渲染） */
export const EDGE_LABEL_POSITION_RATIO: Record<EdgeLabelPosition, number> = {
  center: 0.5,
  nearSource: 0.2,
  nearTarget: 0.8,
};

/** 连线线型 */
export type EdgeType = 'straight' | 'smoothstep' | 'step' | 'bezier';

/** 连线线样式：实线 / 虚线 / 点线 / 点划线 / 实线手绘 / 虚线手绘 */
export type EdgeDash = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'sketch' | 'sketchDashed';

/** 连线箭头风格 */
export type EdgeArrow =
  | 'none'
  | 'arrowclosed'
  | 'arrow'
  | 'circle'
  | 'diamond'
  | 'diamondHollow'
  | 'triangle'
  | 'square'
  | 'bar';

/** 连线跳线样式：不跳 / 弧线跨越 */
export type EdgeJumpStyle = 'none' | 'arc';

/** 跳线下拉选项 */
export const EDGE_JUMP_OPTIONS: EdgeJumpStyle[] = ['none', 'arc'];

/** 连线样式（工具栏 / 属性面板可编辑） */
export interface FlowEdgeStyle {
  /** straight 直线 / smoothstep 圆角折线 / step 直角折线 / bezier 曲线 */
  type: EdgeType;
  stroke: string;
  strokeWidth: number;
  dash: EdgeDash;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
  /** 跳线样式（缺省 none，与历史行为一致） */
  jumpStyle?: EdgeJumpStyle;
}

export const DEFAULT_EDGE_STYLE: FlowEdgeStyle = {
  type: 'smoothstep',
  stroke: '#475569',
  strokeWidth: 2,
  dash: 'solid',
  startArrow: 'none',
  endArrow: 'arrowclosed',
  jumpStyle: 'none',
};

/** 连线类型下拉选项 */
export const EDGE_TYPE_OPTIONS: EdgeType[] = ['smoothstep', 'straight', 'step', 'bezier'];

/** UML 关系预设：一键把连线切到该关系的线型 / 线样式 / 箭头组合 */
export interface EdgeRelationPreset {
  id: string;
  /** i18n 键后缀（tools.flowchart.relation*） */
  labelKey: string;
  patch: Partial<FlowEdgeStyle>;
}

/**
 * 关系预设一览（纯数据，零渲染成本）。
 * 箭头方向按 UML 约定：泛化 / 实现 / 依赖的空心三角与开放箭头指向「被指向方」（终点），
 * 聚合 / 组合的菱形位于「整体」一端（起点）。
 */
export const EDGE_RELATION_PRESETS: EdgeRelationPreset[] = [
  {
    id: 'association',
    labelKey: 'relationAssociation',
    patch: { type: 'straight', dash: 'solid', startArrow: 'none', endArrow: 'arrow' },
  },
  {
    id: 'generalization',
    labelKey: 'relationGeneralization',
    patch: { type: 'straight', dash: 'solid', startArrow: 'none', endArrow: 'triangle' },
  },
  {
    id: 'realization',
    labelKey: 'relationRealization',
    patch: { type: 'straight', dash: 'dashed', startArrow: 'none', endArrow: 'triangle' },
  },
  {
    id: 'dependency',
    labelKey: 'relationDependency',
    patch: { type: 'straight', dash: 'dashed', startArrow: 'none', endArrow: 'arrow' },
  },
  {
    id: 'aggregation',
    labelKey: 'relationAggregation',
    patch: { type: 'straight', dash: 'solid', startArrow: 'diamondHollow', endArrow: 'arrow' },
  },
  {
    id: 'composition',
    labelKey: 'relationComposition',
    patch: { type: 'straight', dash: 'solid', startArrow: 'diamond', endArrow: 'arrow' },
  },
];
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
  'diamondHollow',
  'triangle',
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
  diamondHollow: 'arrowDiamondHollow',
  triangle: 'arrowTriangle',
  square: 'arrowSquare',
  bar: 'arrowBar',
};

/** 部分更新节点数据：style 允许只传需要改动的字段 */
export type FlowNodePatch = Partial<Omit<FlowNodeData, 'style'>> & {
  style?: Partial<FlowNodeStyle>;
};

/** 节点样式视图：字段缺省表示多选批次内取值不一致（混合态） */
export type FlowNodeStyleView = Partial<FlowNodeStyle>;

/** 画布网格吸附尺寸可选值 */
export const GRID_SIZE_OPTIONS = [5, 10, 20, 25] as const;

/** 画布网格样式（背景绘制方式） */
export type GridStyle = 'dots' | 'lines' | 'cross' | 'none';

export const GRID_STYLE_OPTIONS: GridStyle[] = ['dots', 'lines', 'cross', 'none'];

/** 画布背景预设色（含透明） */
export const CANVAS_BACKGROUND_OPTIONS = [
  'transparent',
  '#FFFFFF',
  '#F8FAFC',
  '#F1F5F9',
  '#0F172A',
] as const;

/** 鼠标滚轮行为：平移（历史默认）/ 缩放（draw.io 习惯） */
export type WheelMode = 'pan' | 'zoom';

/** 标尺与参考线的轴向 */
export type GuideAxis = 'x' | 'y';

/**
 * 持久参考线（画布坐标系）。
 * `x` 轴参考线为竖直直线（记住 x 坐标），`y` 轴为水平直线。
 */
export interface CanvasGuide {
  axis: GuideAxis;
  pos: number;
}

/** 纸张预设（px @96dpi 的常见规格，页面边界用） */
export interface PaperPreset {
  id: string;
  width: number;
  height: number;
}

export const PAPER_PRESETS: PaperPreset[] = [
  { id: 'a4l', width: 1123, height: 794 },
  { id: 'a4p', width: 794, height: 1123 },
  { id: 'a3l', width: 1587, height: 1123 },
  { id: 'letterl', width: 1056, height: 816 },
  { id: 'letterp', width: 816, height: 1056 },
];

/** 页面尺寸下限（避免纸张被压成不可用尺寸） */
export const MIN_PAGE_SIZE = 200;

/** 画布上一个节点的持久化记录 */
export interface FlowNodeRec {
  id: string;
  type: FlowNodeType;
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
  /** 导入时未识别的 mxGraph 样式 token（Draw.io 往返时回写） */
  mxStyle?: string[];
}

/** 画布上一条连线的持久化记录 */
export interface FlowEdgeRec {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  /** 起点侧标签（旧文档缺省即不显示） */
  sourceLabel?: string;
  /** 终点侧标签（旧文档缺省即不显示） */
  targetLabel?: string;
  /** 主标签位置（缺省 center） */
  labelPosition?: EdgeLabelPosition;
  style?: FlowEdgeStyle;
  /** 折点（画布绝对坐标）；旧文档缺省即无折点 */
  waypoints?: Waypoint[];
  /** 导入时未识别的 mxGraph 样式 token（Draw.io 往返时回写） */
  mxStyle?: string[];
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
  /** 纸张/画布尺寸（缺省即无页边界，与历史行为一致） */
  size?: ShapeSize;
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
  umlNote: '注释',
  umlBoundary: '边界',
  umlControl: '控制',
  umlEntity: '实体',
  umlFrame: '图框',
  umlUseCase: '用例',
  umlSubject: '系统边界',
  umlInclude: '包含关系',
  umlExtend: '扩展关系',
  umlExtensionPoint: '扩展点',
  umlClass: '类',
  umlInterface: '接口',
  umlEnumeration: '枚举',
  umlDataType: '数据类型',
  umlAbstractClass: '抽象类',
  umlActiveClass: '活动类',
  umlTemplateClass: '模板类',
  umlAssociationClass: '关联类',
  umlPackage: '包',
  umlObject: '对象',
  umlObjectSlot: '对象（带槽）',
  umlModel: '模型',
  umlProfile: '剖面',
  umlLifeline: '生命线',
  umlActivation: '激活条',
  umlDestroy: '销毁',
  umlCombinedFragment: '组合片段',
  umlInteractionUse: '交互引用',
  umlStateInvariant: '状态不变式',
  umlGate: '门',
  umlForkJoin: '分叉/汇合',
  umlAction: '动作',
  umlActivity: '活动',
  umlDecisionMerge: '判断/合并',
  umlInitialNode: '初始节点',
  umlActivityFinal: '活动结束',
  umlFlowFinal: '流结束',
  umlObjectNode: '对象节点',
  umlSendSignal: '发送信号',
  umlReceiveSignal: '接收信号',
  umlActivityPartition: '活动分区',
  umlState: '状态',
  umlStateInitial: '初始状态',
  umlStateFinal: '终止状态',
  umlChoice: '选择',
  umlJunction: '汇合点',
  umlTerminate: '终止',
  umlEntryPoint: '入口点',
  umlExitPoint: '出口点',
  umlHistory: '浅历史',
  umlHistoryDeep: '深历史',
  umlCompositeState: '组合状态',
  umlComponent: '组件',
  umlProvidedInterface: '提供接口',
  umlRequiredInterface: '需求接口',
  umlPort: '端口',
  umlSubsystem: '子系统',
  umlNode: '节点',
  umlDevice: '设备',
  umlExecutionEnvironment: '运行环境',
  umlArtifact: '制品',
  umlDeploymentSpec: '部署规范',
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

/** 几何编辑补丁（属性面板 X / Y / W / H）：X / Y 为画布绝对坐标；仅修改传入字段 */
export interface NodeGeometryPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** 多选整体缩放时单个节点的几何快照（画布绝对坐标 + 实际尺寸） */
export interface GroupScaleItem {
  id: string;
  absX: number;
  absY: number;
  width: number;
  height: number;
}

/**
 * 节点变换补丁（旋转 / 镜像）。
 * 值为 `undefined` 表示「清除该字段」；为具体值表示写入。
 */
export interface NodeTransformPatch {
  rotation?: number | undefined;
  flipH?: boolean | undefined;
  flipV?: boolean | undefined;
}

/** 几何编辑的尺寸下限（与 NodeResizer 的最小尺寸保持一致：容器更大） */
export function minNodeSize(kind: ShapeKind): ShapeSize {
  return isContainerKind(kind) ? { width: 200, height: 140 } : { width: 48, height: 32 };
}
