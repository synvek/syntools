import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import {
  alignSelected,
  applyUniformSize,
  distributeSelected,
  flipSelected,
  groupSelected,
  layerOp,
  patchSelectedEdgeStyle,
  rotateSelected,
  snapSelectedToGrid,
  toggleHidden,
  toggleLocked,
  ungroupSelected,
} from '../flowOps';
import { normalizeEdgeStyle, type AlignMode, type LayerOp } from '../ops';
import { LAYOUT_DIRECTIONS, type LayoutDensity, type LayoutDirection } from '../layout';
import { useFlowStore } from '../store';
import { ThemePanel } from './ThemePanel';
import {
  CANVAS_BACKGROUND_OPTIONS,
  EDGE_ARROW_LABEL_KEY,
  EDGE_ARROW_OPTIONS,
  EDGE_DASH_OPTIONS,
  EDGE_JUMP_OPTIONS,
  EDGE_RELATION_PRESETS,
  EDGE_TYPE_OPTIONS,
  GRID_SIZE_OPTIONS,
  GRID_STYLE_OPTIONS,
  PAPER_PRESETS,
  type EdgeArrow,
  type EdgeDash,
  type EdgeJumpStyle,
  type EdgeType,
  type FlowEdgeStyle,
  type GridStyle,
  type WheelMode,
} from '../model/types';

/** 连线宽度可选值（与 normalizeEdgeStyle 的 1~8 限制一致） */
const EDGE_WIDTH_OPTIONS = ['1', '2', '3', '4', '5', '6', '8'];

const selectCls =
  'h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[12px] text-gray-700 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200';

/** 工具栏带标签的下拉选择器 */
function EdgeSelect({
  label,
  value,
  options,
  onChange,
  renderOption,
  testId,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  renderOption?: (value: string) => string;
  testId?: string;
}) {
  return (
    <label className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
      <span className="whitespace-nowrap">{label}</span>
      <select
        className={selectCls}
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {renderOption ? renderOption(v) : v}
          </option>
        ))}
      </select>
    </label>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  testId?: string;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  primary,
  icon,
  compact,
  testId,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        compact ? 'h-7 w-8 text-[13px]' : 'h-8 gap-1.5 px-3 text-[13px]'
      } ${
        primary
          ? 'bg-blue-600 text-white hover:bg-blue-500'
          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {compact ? null : <span>{label}</span>}
      {compact && !icon ? <span>{label}</span> : null}
    </button>
  );
}

/** 统一的线性图标容器（用于锁定/隐藏等图标按钮） */
function SvgIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const LOCK_ICON = (
  <SvgIcon>
    <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </SvgIcon>
);

const UNLOCK_ICON = (
  <SvgIcon>
    <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 6.9-2.5" />
  </SvgIcon>
);

const EYE_ICON = (
  <SvgIcon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </SvgIcon>
);

const EYE_OFF_ICON = (
  <SvgIcon>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 3.9" />
    <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.2-.8" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </SvgIcon>
);

const ALIGN_BUTTONS: Array<{ mode: AlignMode; glyph: string; key: string }> = [
  { mode: 'left', glyph: '⇤', key: 'alignLeft' },
  { mode: 'hcenter', glyph: '↔', key: 'alignCenter' },
  { mode: 'right', glyph: '⇥', key: 'alignRight' },
  { mode: 'top', glyph: '⇡', key: 'alignTop' },
  { mode: 'vcenter', glyph: '⇕', key: 'alignMiddle' },
  { mode: 'bottom', glyph: '⇣', key: 'alignBottom' },
];

const LAYER_BUTTONS: Array<{ op: LayerOp; glyph: string; key: string }> = [
  { op: 'front', glyph: '⤒', key: 'layerFront' },
  { op: 'forward', glyph: '↑', key: 'layerForward' },
  { op: 'backward', glyph: '↓', key: 'layerBackward' },
  { op: 'back', glyph: '⤓', key: 'layerBack' },
];

interface ToolbarProps {
  onTemplates: () => void;
  onShortcutHelp: () => void;
  onAutoLayout: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar(props: ToolbarProps) {
  const { t } = useTranslation();
  const defaultEdge = useFlowStore((s) => s.defaultEdge);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);
  const selectedEdges = useFlowStore((s) => s.selectedEdges);
  const selectedNodes = useFlowStore((s) => s.selectedNodes);
  const gridEnabled = useFlowStore((s) => s.gridEnabled);
  const gridSize = useFlowStore((s) => s.gridSize);
  const layoutDirection = useFlowStore((s) => s.layoutDirection);
  const layoutDensity = useFlowStore((s) => s.layoutDensity);
  const alignTolerance = useFlowStore((s) => s.alignTolerance);
  const pageSize = useFlowStore((s) => s.pageSize);
  const wheelMode = useFlowStore((s) => s.wheelMode);
  const gridStyle = useFlowStore((s) => s.gridStyle);
  const canvasBackground = useFlowStore((s) => s.canvasBackground);
  const rulersVisible = useFlowStore((s) => s.rulersVisible);
  /** 命令式写会话设置（工具栏控件即时生效） */
  const st = useFlowStore.getState();
  /** 当前纸张：命中预设取其 id，否则为 custom / none */
  const pageSizeKey = !pageSize
    ? 'none'
    : (PAPER_PRESETS.find((p) => p.width === pageSize.width && p.height === pageSize.height)?.id ??
      'custom');
  const sep = <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

  // 选中节点的锁定/隐藏状态（用于图标切换）
  const selNodes = nodes.filter((n) => selectedNodes.includes(n.id));
  const allLocked = selNodes.length > 0 && selNodes.every((n) => n.draggable === false);
  const allHidden = selNodes.length > 0 && selNodes.every((n) => n.hidden === true);

  // 选中连线时回显该连线样式，否则回显默认样式
  const hasEdgeSel = selectedEdges.length > 0 && selectedNodes.length === 0;
  const selEdge = hasEdgeSel ? edges.find((e) => e.id === selectedEdges[0]) : undefined;
  const shown = selEdge
    ? normalizeEdgeStyle((selEdge.data as { style?: Partial<FlowEdgeStyle> } | undefined)?.style)
    : defaultEdge;

  /** 修改连线样式：更新默认值，并在选中连线时立即应用到选中连线 */
  const applyEdge = (patch: Partial<FlowEdgeStyle>) => {
    const st = useFlowStore.getState();
    if (st.selectedEdges.length > 0 && st.selectedNodes.length === 0) {
      patchSelectedEdgeStyle(patch);
    }
    st.setDefaultEdge(patch);
  };

  const arrowLabel = (v: string) => t(`tools.flowchart.${EDGE_ARROW_LABEL_KEY[v as EdgeArrow]}`);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolbarButton label={t('tools.flowchart.templates')} onClick={props.onTemplates} />
        <ThemePanel />
        <ToolbarButton label={t('tools.flowchart.autoLayout')} onClick={props.onAutoLayout} />
        <EdgeSelect
          testId="flowchart-layout-direction"
          label={t('tools.flowchart.layoutDirection')}
          value={layoutDirection}
          options={LAYOUT_DIRECTIONS}
          onChange={(v) => useFlowStore.getState().setLayoutDirection(v as LayoutDirection)}
          renderOption={(v) => t(`tools.flowchart.dir${v}`)}
        />
        <EdgeSelect
          testId="flowchart-layout-density"
          label={t('tools.flowchart.layoutDensity')}
          value={layoutDensity}
          options={['compact', 'normal', 'loose']}
          onChange={(v) => useFlowStore.getState().setLayoutDensity(v as LayoutDensity)}
          renderOption={(v) => t(`tools.flowchart.density${v[0].toUpperCase()}${v.slice(1)}`)}
        />

        {sep}

        {/* 网格吸附：可开关并可选网格尺寸 */}
        <ToolbarButton
          testId="flowchart-grid-toggle"
          label={t('tools.flowchart.snapToGrid')}
          onClick={() => useFlowStore.getState().setGridEnabled(!gridEnabled)}
          primary={gridEnabled}
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M4 8h16M4 16h16M8 4v16M16 4v16" />
            </svg>
          }
        />
        <EdgeSelect
          testId="flowchart-grid-size"
          label={t('tools.flowchart.gridSize')}
          value={String(gridSize)}
          options={GRID_SIZE_OPTIONS.map(String)}
          onChange={(v) => useFlowStore.getState().setGridSize(Number(v))}
        />
        <EdgeSelect
          testId="flowchart-align-tolerance"
          label={t('tools.flowchart.alignTolerance')}
          value={String(alignTolerance)}
          options={['4', '6', '8', '10']}
          onChange={(v) => useFlowStore.getState().setAlignTolerance(Number(v))}
          renderOption={(v) => `${v}px`}
        />

        {/* 纸张尺寸：设置后画布显示页边界 */}
        <EdgeSelect
          testId="flowchart-paper-size"
          label={t('tools.flowchart.paperSize')}
          value={pageSizeKey}
          options={['none', ...PAPER_PRESETS.map((p) => p.id), 'custom']}
          onChange={(id) => {
            if (id === 'none') {
              st.setPageSize(undefined);
              return;
            }
            const preset = PAPER_PRESETS.find((p) => p.id === id);
            if (preset) st.setPageSize({ width: preset.width, height: preset.height });
          }}
          renderOption={(v) => t(`tools.flowchart.paper_${v}`)}
        />
        <EdgeSelect
          testId="flowchart-wheel-mode"
          label={t('tools.flowchart.wheelMode')}
          value={wheelMode}
          options={['pan', 'zoom']}
          onChange={(v) => st.setWheelMode(v as WheelMode)}
          renderOption={(v) => t(`tools.flowchart.wheel_${v}`)}
        />
        <EdgeSelect
          testId="flowchart-grid-style"
          label={t('tools.flowchart.gridStyle')}
          value={gridStyle}
          options={GRID_STYLE_OPTIONS}
          onChange={(v) => st.setGridStyle(v as GridStyle)}
          renderOption={(v) => t(`tools.flowchart.grid_${v}`)}
        />
        <EdgeSelect
          testId="flowchart-canvas-bg"
          label={t('tools.flowchart.canvasBackground')}
          value={canvasBackground}
          options={[...CANVAS_BACKGROUND_OPTIONS]}
          onChange={(v) => st.setCanvasBackground(v)}
          renderOption={(v) => (v === 'transparent' ? t('tools.flowchart.bgTransparent') : v)}
        />
        <ToolbarButton
          compact
          testId="flowchart-rulers-toggle"
          label={t('tools.flowchart.rulers')}
          onClick={() => st.setRulersVisible(!rulersVisible)}
          primary={rulersVisible}
          icon={<span>⌐</span>}
        />

        {sep}

        <ToolbarButton
          label={t('tools.flowchart.undo')}
          onClick={props.onUndo}
          disabled={!props.canUndo}
        />
        <ToolbarButton
          label={t('tools.flowchart.redo')}
          onClick={props.onRedo}
          disabled={!props.canRedo}
        />
        <ToolbarButton label={t('tools.flowchart.duplicate')} onClick={props.onDuplicate} />
        <ToolbarButton label={t('tools.flowchart.delete')} onClick={props.onDelete} />
        <ToolbarButton
          compact
          testId="flowchart-shortcut-help"
          label={t('tools.flowchart.shortcutHelp')}
          onClick={props.onShortcutHelp}
          icon={<span>?</span>}
        />
      </div>

      {/* 排列：对齐 / 分布 / 层级 / 编组 */}
      <div className="flex flex-wrap items-center gap-1">
        {ALIGN_BUTTONS.map((item) => (
          <ToolbarButton
            key={item.mode}
            compact
            label={t(`tools.flowchart.${item.key}`)}
            onClick={() => alignSelected(item.mode)}
            icon={<span>{item.glyph}</span>}
          />
        ))}
        {sep}
        <ToolbarButton
          compact
          label={t('tools.flowchart.distributeH')}
          onClick={() => distributeSelected('h')}
          icon={<span>⇹</span>}
        />
        <ToolbarButton
          compact
          label={t('tools.flowchart.distributeV')}
          onClick={() => distributeSelected('v')}
          icon={<span>⇻</span>}
        />
        <ToolbarButton
          compact
          testId="flowchart-uniform-size"
          label={t('tools.flowchart.uniformSize')}
          onClick={applyUniformSize}
          disabled={selectedNodes.length < 2}
          icon={<span>▭</span>}
        />
        <ToolbarButton
          compact
          testId="flowchart-snap-selection-grid"
          label={t('tools.flowchart.snapSelectionToGrid')}
          onClick={snapSelectedToGrid}
          disabled={selectedNodes.length === 0 || !gridEnabled}
          icon={<span>⌗</span>}
        />
        {sep}
        {LAYER_BUTTONS.map((item) => (
          <ToolbarButton
            key={item.op}
            compact
            label={t(`tools.flowchart.${item.key}`)}
            onClick={() => layerOp(item.op)}
            icon={<span>{item.glyph}</span>}
          />
        ))}
        {sep}
        <ToolbarButton
          compact
          label={t('tools.flowchart.group')}
          onClick={groupSelected}
          icon={<span>⊞</span>}
        />
        <ToolbarButton
          compact
          label={t('tools.flowchart.ungroup')}
          onClick={ungroupSelected}
          icon={<span>⊟</span>}
        />
        {sep}
        <ToolbarButton
          compact
          testId="flowchart-tb-rotate-ccw"
          label={t('tools.flowchart.rotateCcw')}
          onClick={() => rotateSelected(-90)}
          disabled={selectedNodes.length === 0}
          icon={<span>⟲</span>}
        />
        <ToolbarButton
          compact
          testId="flowchart-tb-rotate-cw"
          label={t('tools.flowchart.rotateCw')}
          onClick={() => rotateSelected(90)}
          disabled={selectedNodes.length === 0}
          icon={<span>⟳</span>}
        />
        <ToolbarButton
          compact
          testId="flowchart-tb-flip-h"
          label={t('tools.flowchart.flipH')}
          onClick={() => flipSelected('h')}
          disabled={selectedNodes.length === 0}
          icon={<span>⇄</span>}
        />
        <ToolbarButton
          compact
          testId="flowchart-tb-flip-v"
          label={t('tools.flowchart.flipV')}
          onClick={() => flipSelected('v')}
          disabled={selectedNodes.length === 0}
          icon={<span>⇅</span>}
        />
        {sep}
        <ToolbarButton
          compact
          label={t('tools.flowchart.toggleLock')}
          onClick={() => toggleLocked(useFlowStore.getState().selectedNodes)}
          disabled={selectedNodes.length === 0}
          icon={allLocked ? UNLOCK_ICON : LOCK_ICON}
        />
        <ToolbarButton
          compact
          label={t('tools.flowchart.toggleVisible')}
          onClick={() => toggleHidden(useFlowStore.getState().selectedNodes)}
          disabled={selectedNodes.length === 0}
          icon={allHidden ? EYE_OFF_ICON : EYE_ICON}
        />
        {sep}
        <EdgeSelect
          label={t('tools.flowchart.edgeType')}
          value={shown.type}
          options={EDGE_TYPE_OPTIONS}
          onChange={(v) => applyEdge({ type: v as EdgeType })}
          renderOption={(v) => t(`tools.flowchart.${v}`)}
        />
        <EdgeSelect
          label={t('tools.flowchart.strokeWidth')}
          value={String(shown.strokeWidth)}
          options={EDGE_WIDTH_OPTIONS}
          onChange={(v) => applyEdge({ strokeWidth: Number(v) })}
        />
        <EdgeSelect
          label={t('tools.flowchart.edgeStyleLabel')}
          value={shown.dash}
          options={EDGE_DASH_OPTIONS}
          onChange={(v) => applyEdge({ dash: v as EdgeDash })}
          renderOption={(v) => t(`tools.flowchart.${v}`)}
        />
        <EdgeSelect
          label={t('tools.flowchart.startArrowLabel')}
          value={shown.startArrow}
          options={EDGE_ARROW_OPTIONS}
          onChange={(v) => applyEdge({ startArrow: v as EdgeArrow })}
          renderOption={arrowLabel}
        />
        <EdgeSelect
          label={t('tools.flowchart.endArrowLabel')}
          value={shown.endArrow}
          options={EDGE_ARROW_OPTIONS}
          onChange={(v) => applyEdge({ endArrow: v as EdgeArrow })}
          renderOption={arrowLabel}
        />
        <EdgeSelect
          testId="flowchart-relation-preset"
          label={t('tools.flowchart.relationPreset')}
          value=""
          options={EDGE_RELATION_PRESETS.map((p) => p.id)}
          onChange={(id) => {
            const preset = EDGE_RELATION_PRESETS.find((p) => p.id === id);
            if (preset) applyEdge(preset.patch);
          }}
          renderOption={(id) => {
            const preset = EDGE_RELATION_PRESETS.find((p) => p.id === id);
            return preset ? t(`tools.flowchart.${preset.labelKey}`) : id;
          }}
        />
        <EdgeSelect
          testId="flowchart-edge-jump"
          label={t('tools.flowchart.edgeJump')}
          value={shown.jumpStyle ?? 'none'}
          options={EDGE_JUMP_OPTIONS}
          onChange={(v) => applyEdge({ jumpStyle: v as EdgeJumpStyle })}
          renderOption={(v) => t(`tools.flowchart.jump_${v}`)}
        />
      </div>
    </div>
  );
}
