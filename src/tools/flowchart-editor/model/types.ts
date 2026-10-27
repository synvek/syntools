/**
 * Data model contract for the flowchart editor.
 * Pure data structures only (no React Flow dependency) so core.ts can be unit-tested and drafts serialized.
 * React Flow Node/Edge types are imported on demand in store.ts.
 * For size lookups go through `./shapes` (the shape catalog) to avoid a types → shapes circular dependency.
 */

export type ShapeKind =
  // Generic shapes
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
  // Flowchart
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
  // UML common
  | 'umlActor'
  | 'umlNote'
  | 'umlBoundary'
  | 'umlControl'
  | 'umlEntity'
  | 'umlFrame'
  // UML use case diagram
  | 'umlUseCase'
  | 'umlSubject'
  | 'umlInclude'
  | 'umlExtend'
  | 'umlExtensionPoint'
  // UML class diagram
  | 'umlClass'
  | 'umlInterface'
  | 'umlEnumeration'
  | 'umlDataType'
  | 'umlAbstractClass'
  | 'umlActiveClass'
  | 'umlTemplateClass'
  | 'umlAssociationClass'
  // UML object / package diagram
  | 'umlPackage'
  | 'umlObject'
  | 'umlObjectSlot'
  | 'umlModel'
  | 'umlProfile'
  // UML sequence diagram
  | 'umlLifeline'
  | 'umlActivation'
  | 'umlDestroy'
  | 'umlCombinedFragment'
  | 'umlInteractionUse'
  | 'umlStateInvariant'
  | 'umlGate'
  // UML activity diagram
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
  // UML state diagram
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
  // UML component diagram
  | 'umlComponent'
  | 'umlProvidedInterface'
  | 'umlRequiredInterface'
  | 'umlPort'
  | 'umlSubsystem'
  // UML deployment diagram
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
  // Network and cloud architecture
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
  // Org chart
  | 'orgUnit'
  | 'orgAssistant'
  | 'orgTeam'
  // Mind map
  | 'mindCenter'
  | 'mindTopic'
  | 'mindSub'
  // ER
  | 'erEntity'
  | 'erAttribute'
  | 'erRelationship'
  | 'erWeakEntity'
  // Containers
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
  /** Overall opacity 0–1 (drives fill-opacity, text follows) */
  opacity?: number;
  /** Whether to draw a drop shadow */
  shadow?: boolean;
  /** Stroke line style (node outline dash pattern) */
  lineDash?: 'solid' | 'dashed' | 'dotted';
  /** Font family */
  fontFamily?: string;
  /** Text color (distinct from stroke) */
  textColor?: string;
  /** Corner radius (optional rounded corners for roundRect / rect) */
  cornerRadius?: number;
  /** Size of the folded corner triangle at the top-right of a note */
  foldSize?: number;
  /**
   * Adjustable shape parameters (draw.io-style vertices): key → value; only keys the user changed are recorded.
   * Keys and value ranges are declared by `ShapeDef.adjust` in the shape catalog, see `model/shapes/adjust.ts`.
   */
  shapeParams?: Record<string, number>;
  /* ------------------------------ Node transform ------------------------------ */
  /**
   * Rotation in degrees (0–360, clockwise).
   * Applied as a pure CSS transform around the bounding-box center, **without touching geometry or edge anchors**:
   * edges still attach to the unrotated axis-aligned box, matching draw.io's bbox behavior.
   */
  rotation?: number;
  /** Horizontal mirror (flip left/right) */
  flipH?: boolean;
  /** Vertical mirror (flip up/down) */
  flipV?: boolean;
  /* ------------------------------ Text layout ------------------------------ */
  /** Vertical text alignment (defaults to middle, matching legacy behavior) */
  verticalAlign?: VerticalAlign;
  /** Line height (multiplier, defaults to 1.25) */
  lineHeight?: number;
  /** Auto-shrink text to fit the box (off by default) */
  autoShrink?: boolean;
  /** Label background color (transparent by default) */
  labelBackground?: string;
  /** Hyperlink (http/https/mailto only, validated at render time) */
  link?: string;
  /** Label text format: plain text (default) / lightweight Markdown rendering */
  textFormat?: TextFormat;
}

/** Label text format */
export type TextFormat = 'plain' | 'markdown';

/** Label text format options */
export const TEXT_FORMAT_OPTIONS: TextFormat[] = ['plain', 'markdown'];

/** Vertical text alignment */
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/** Vertical alignment options */
export const VERTICAL_ALIGN_OPTIONS: VerticalAlign[] = ['top', 'middle', 'bottom'];

/** Vertical alignment → flex main-axis mapping (shared by panel and renderer to avoid stray magic strings) */
export const VERTICAL_ALIGN_FLEX: Record<VerticalAlign, string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

/** Default rotation snap step (degrees); hold Shift for the fine step */
export const ROTATION_SNAP_STEP = 15;
/** Fine rotation step (hold Shift, degrees) */
export const ROTATION_FINE_STEP = 45;
/** Default line-height multiplier (matches legacy CSS behavior) */
export const DEFAULT_LINE_HEIGHT = 1.25;

/** Node type: shape / image / built-in icon / formula / table */
export type FlowNodeType = 'shape' | 'image' | 'icon' | 'formula' | 'table';

/** Default sizes for non-shape nodes */
export const IMAGE_NODE_SIZE: ShapeSize = { width: 240, height: 160 };
export const ICON_NODE_SIZE: ShapeSize = { width: 64, height: 64 };
export const FORMULA_NODE_SIZE: ShapeSize = { width: 200, height: 64 };
export const TABLE_NODE_SIZE: ShapeSize = { width: 320, height: 168 };

/** Max edge length of a single image (larger images are downscaled proportionally to bound draft size) */
export const IMAGE_MAX_EDGE = 1600;
/** Draft size limit (characters, ~4MB); past it the draft degrades to one without images */
export const DRAFT_SIZE_LIMIT = 4_000_000;

/** Max nodes a single paste/import may insert (keeps pathological content from bogging down the canvas) */
export const MAX_PASTE_NODES = 500;

/** Table cell (on merge only the top-left cell keeps content; covered subordinate cells are null) */
export interface TableCellData {
  text?: string;
  /** Column span (≥1, defaults to 1) */
  colspan?: number;
  /** Row span (≥1, defaults to 1) */
  rowspan?: number;
  /** Horizontal text alignment inside the cell (defaults to the node style's align) */
  align?: Align;
  /** Cell fill color (defaults to the node style's fill) */
  fill?: string;
  /** Cell text bold (defaults to the node style's bold) */
  bold?: boolean;
}

/** Table node data (type === 'table') */
export interface TableData {
  /** Row count (≥1) */
  rows: number;
  /** Column count (≥1) */
  cols: number;
  /**
   * Cell content indexed as [row][column]; row/column lengths match rows/cols,
   * covered subordinate cells are null; when absent an empty table is rendered.
   */
  cells?: (TableCellData | null)[][];
  /** Row height weights (equal by default) */
  rowWeights?: number[];
  /** Column width weights (equal by default) */
  colWeights?: number[];
}

export interface FlowNodeData extends Record<string, unknown> {
  kind: ShapeKind;
  label: string;
  style: FlowNodeStyle;
  /** Image node dataURL (type === 'image') */
  src?: string;
  /** Icon id of an icon node (type === 'icon') */
  iconId?: string;
  /** LaTeX source of a formula node (type === 'formula') */
  formula?: string;
  /** Table data of a table node (type === 'table') */
  table?: TableData;
  /**
   * Container (swimlane / group) collapsed: keeps only the title bar and hides child nodes.
   * Stored on data so it travels with React Flow nodes; defaults to expanded with child data intact.
   */
  collapsed?: boolean;
  /** Unrecognized mxGraph style tokens from import (written back on Draw.io round-trip to limit style loss) */
  mxStyle?: string[];
}

/** Edge waypoint (absolute canvas coordinates) */
export interface Waypoint {
  x: number;
  y: number;
}

/** Edge routing source: default (decided by the edge type) / manual waypoints / orthogonal auto-routing (obstacle avoidance) */
export type EdgeRoutingMode = 'default' | 'manual' | 'orthogonal';

export interface FlowEdgeData extends Record<string, unknown> {
  label?: string;
  /** Source-side label (hidden by default); independent of the main and target labels */
  sourceLabel?: string;
  /** Target-side label (hidden by default) */
  targetLabel?: string;
  /** Main label position along the path: center (default) / near source / near target */
  labelPosition?: EdgeLabelPosition;
  /** Edge style (read by the renderer, shown in the property panel) */
  style?: FlowEdgeStyle;
  /** Manual or imported waypoints; absent means none */
  waypoints?: Waypoint[];
  /** Routing source (defaults to default); orthogonal means generated by obstacle-avoiding orthogonal routing */
  routing?: EdgeRoutingMode;
  /** Whether this edge takes part in obstacle-avoiding orthogonal routing (no by default) */
  avoidObstacles?: boolean;
  /** Unrecognized mxGraph style tokens from import (written back on Draw.io round-trip) */
  mxStyle?: string[];
}

/** Main label position along the edge path */
export type EdgeLabelPosition = 'center' | 'nearSource' | 'nearTarget';

export const EDGE_LABEL_POSITION_OPTIONS: EdgeLabelPosition[] = [
  'center',
  'nearSource',
  'nearTarget',
];

/** Label position → path-length ratio (used to sample a point along the path for rendering) */
export const EDGE_LABEL_POSITION_RATIO: Record<EdgeLabelPosition, number> = {
  center: 0.5,
  nearSource: 0.2,
  nearTarget: 0.8,
};

/** Edge line type */
export type EdgeType = 'straight' | 'smoothstep' | 'step' | 'bezier';

/** Edge line style: solid / dashed / dotted / dash-dot / hand-drawn solid / hand-drawn dashed */
export type EdgeDash = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'sketch' | 'sketchDashed';

/** Edge arrow style */
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

/** Edge jump style: none / arc hop */
export type EdgeJumpStyle = 'none' | 'arc';

/** Jump style options */
export const EDGE_JUMP_OPTIONS: EdgeJumpStyle[] = ['none', 'arc'];

/** Edge style (editable from the toolbar / property panel) */
export interface FlowEdgeStyle {
  /** straight line / smoothstep rounded elbow / step right-angle elbow / bezier curve */
  type: EdgeType;
  stroke: string;
  strokeWidth: number;
  dash: EdgeDash;
  startArrow: EdgeArrow;
  endArrow: EdgeArrow;
  /** Jump style (defaults to none, matching legacy behavior) */
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

/** Edge type options */
export const EDGE_TYPE_OPTIONS: EdgeType[] = ['smoothstep', 'straight', 'step', 'bezier'];

/** UML relation presets: switch an edge to a relation's line type / line style / arrows in one click */
export interface EdgeRelationPreset {
  id: string;
  /** i18n key suffix (tools.flowchart.relation*) */
  labelKey: string;
  patch: Partial<FlowEdgeStyle>;
}

/**
 * Relation preset list (pure data, zero rendering cost).
 * Arrow direction follows UML convention: the hollow triangle and open arrow of generalization / realization /
 * dependency point at the referenced side (the target); aggregation / composition diamonds sit at the whole end (start).
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
/** Line style options */
export const EDGE_DASH_OPTIONS: EdgeDash[] = [
  'solid',
  'dashed',
  'dotted',
  'dashdot',
  'sketch',
  'sketchDashed',
];
/** Arrow options */
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

/** Arrow → i18n key suffix (tools.flowchart.arrow*) */
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

/** Partial node data update: style may carry only the fields that change */
export type FlowNodePatch = Partial<Omit<FlowNodeData, 'style'>> & {
  style?: Partial<FlowNodeStyle>;
};

/** Node style view: a missing field means values differ within a multi-select batch (mixed state) */
export type FlowNodeStyleView = Partial<FlowNodeStyle>;

/** Selectable canvas grid snap sizes */
export const GRID_SIZE_OPTIONS = [5, 10, 20, 25] as const;

/** Canvas grid style (how the background is drawn) */
export type GridStyle = 'dots' | 'lines' | 'cross' | 'none';

export const GRID_STYLE_OPTIONS: GridStyle[] = ['dots', 'lines', 'cross', 'none'];

/** Canvas background preset colors (including transparent) */
export const CANVAS_BACKGROUND_OPTIONS = [
  'transparent',
  '#FFFFFF',
  '#F8FAFC',
  '#F1F5F9',
  '#0F172A',
] as const;

/** Mouse wheel behavior: pan (legacy default) / zoom (draw.io habit) */
export type WheelMode = 'pan' | 'zoom';

/** Axis of rulers and guides */
export type GuideAxis = 'x' | 'y';

/**
 * Persistent guide (canvas coordinate space).
 * An `x` guide is a vertical line (its x coordinate is stored); a `y` guide is horizontal.
 */
export interface CanvasGuide {
  axis: GuideAxis;
  pos: number;
}

/** Paper presets (common px @96dpi sizes, used for page bounds) */
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

/** Minimum page size (keeps a paper from being squeezed to an unusable size) */
export const MIN_PAGE_SIZE = 200;

/** Persisted record of a node on the canvas */
export interface FlowNodeRec {
  id: string;
  type: FlowNodeType;
  /** With parentId, coordinates are relative to the parent (swimlane/group) top-left corner */
  position: { x: number; y: number };
  parentId?: string | null;
  data: FlowNodeData;
  /** Size manually set by the user (falls back to the shape catalog default when unset) */
  width?: number;
  height?: number;
  /** Layer: hidden */
  hidden?: boolean;
  /** Layer: locked (not draggable/editable) */
  locked?: boolean;
  /** Unrecognized mxGraph style tokens from import (written back on Draw.io round-trip) */
  mxStyle?: string[];
}

/** Persisted record of an edge on the canvas */
export interface FlowEdgeRec {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  /** Source-side label (absent in legacy documents means hidden) */
  sourceLabel?: string;
  /** Target-side label (absent in legacy documents means hidden) */
  targetLabel?: string;
  /** Main label position (defaults to center) */
  labelPosition?: EdgeLabelPosition;
  style?: FlowEdgeStyle;
  /** Waypoints (absolute canvas coordinates); absent in legacy documents means none */
  waypoints?: Waypoint[];
  /** Routing source (defaults to default); orthogonal means generated by obstacle-avoiding orthogonal routing */
  routing?: EdgeRoutingMode;
  /** Whether this edge takes part in obstacle-avoiding orthogonal routing (no by default) */
  avoidObstacles?: boolean;
  /** Unrecognized mxGraph style tokens from import (written back on Draw.io round-trip) */
  mxStyle?: string[];
}

/** v1: single-page document (legacy drafts and old project files) */
export interface FlowDocV1 {
  version: 1;
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
}

/** One canvas page */
export interface FlowPage {
  id: string;
  name: string;
  nodes: FlowNodeRec[];
  edges: FlowEdgeRec[];
  /** Paper/canvas size (absent means no page bounds, matching legacy behavior) */
  size?: ShapeSize;
}

/** v2: multi-page document (legacy schema, normalized to v3 on read) */
export interface FlowDocV2 {
  version: 2;
  /** Document title: source of the export file name (matches the toolbar title input) */
  name?: string;
  pages: FlowPage[];
  activePageId?: string;
}

/**
 * v3: multi-page document (current schema).
 * Over v2 it adds table nodes, rich-text/Markdown labels and edge routing fields; all optional and backward compatible.
 */
export interface FlowDocV3 {
  version: 3;
  /** Document title: source of the export file name (matches the toolbar title input) */
  name?: string;
  pages: FlowPage[];
  activePageId?: string;
}

/** v3 is used internally throughout; v1 / v2 are normalized on read via `model/migrate.ts` */
export type FlowDoc = FlowDocV3;

/** Default size per shape (pixels) */
export interface ShapeSize {
  width: number;
  height: number;
}

/** Chinese shape names (fallback when i18n is missing; full 9-language translations live in strings.ts) */
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

/** Horizontal swimlane: standard horizontal bar */
export const SWIMLANE_SIZE: ShapeSize = { width: 760, height: 220 };
/** Vertical swimlane: standard vertical bar */
export const SWIMLANE_V_SIZE: ShapeSize = { width: 240, height: 640 };
/** Swimlane title bar thickness (height when horizontal, width when vertical) */
export const SWIMLANE_HEADER_HEIGHT = 40;
export const SWIMLANE_HEADER_WIDTH = 40;

/** Container shapes can hold other nodes (swimlane / group) */
export function isContainerKind(kind: ShapeKind): boolean {
  return kind === 'swimlane' || kind === 'swimlaneV' || kind === 'group';
}

/** Whether this is a vertical container (long side vertical, title bar across the top) */
export function isVerticalLane(kind: ShapeKind): boolean {
  return kind === 'swimlaneV';
}

/** Geometry edit patch (property panel X / Y / W / H): X / Y are absolute canvas coordinates; only the given fields change */
export interface NodeGeometryPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Geometry snapshot of one node during a multi-select group resize (absolute canvas coordinates + actual size) */
export interface GroupScaleItem {
  id: string;
  absX: number;
  absY: number;
  width: number;
  height: number;
}

/**
 * Node transform patch (rotation / mirror).
 * A value of `undefined` clears the field; a concrete value writes it.
 */
export interface NodeTransformPatch {
  rotation?: number | undefined;
  flipH?: boolean | undefined;
  flipV?: boolean | undefined;
}

/** Minimum size for geometry edits (matches NodeResizer's minimum; larger for containers) */
export function minNodeSize(kind: ShapeKind): ShapeSize {
  return isContainerKind(kind) ? { width: 200, height: 140 } : { width: 48, height: 32 };
}
