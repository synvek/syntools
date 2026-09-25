import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { BACKGROUND_KINDS, useBoardStore } from '../store';
import {
  BACKGROUND_COLORS,
  BRUSH_MAX,
  BRUSH_MIN,
  OPACITY_STEP,
  SIZE_PRESETS,
  TEXT_MAX,
  TEXT_MIN,
  nextZoom,
  type BackgroundKind,
  type ToolId,
} from '../core';
import ColorPicker from './ColorPicker';
import ExportMenu from './ExportMenu';
import { BoardIcon, type BoardIconName } from './icons';

const TOOLS: { id: ToolId; icon: BoardIconName }[] = [
  { id: 'pen', icon: 'pen' },
  { id: 'marker', icon: 'marker' },
  { id: 'eraser', icon: 'eraser' },
  { id: 'line', icon: 'line' },
  { id: 'arrow', icon: 'arrow' },
  { id: 'rect', icon: 'rect' },
  { id: 'ellipse', icon: 'ellipse' },
  { id: 'polygon', icon: 'polygon' },
  { id: 'text', icon: 'text' },
  { id: 'picker', icon: 'picker' },
  { id: 'move', icon: 'move' },
];

const TOOL_ICONS = Object.fromEntries(TOOLS.map(({ id, icon }) => [id, icon])) as Record<
  ToolId,
  BoardIconName
>;

const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100';
const ACTIVE_ICON_BUTTON = 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300';

/** 分组分隔线：竖起的一条细线，让主栏的「工具 / 颜色 / 历史 / 视图」一目了然 */
function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 self-center bg-gray-200 dark:bg-gray-700" />;
}

interface IconButtonProps {
  icon: BoardIconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function IconButton({ icon, label, onClick, disabled, active }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`${ICON_BUTTON} ${active ? ACTIVE_ICON_BUTTON : ''}`}
    >
      <BoardIcon name={icon} />
    </button>
  );
}

/** 缩放组：缩小 / 百分比（点击回到 100%）/ 放大 / 适应窗口 */
function ZoomControls() {
  const { t } = useTranslation();
  const viewScale = useBoardStore((s) => s.viewScale);
  const setZoom = useBoardStore((s) => s.setZoom);
  const current = viewScale > 0 ? viewScale : 1;
  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        icon="zoomOut"
        label={t('tools.doodle.zoomOut')}
        onClick={() => setZoom(nextZoom(current, -1))}
      />
      <button
        type="button"
        onClick={() => setZoom(1)}
        title={t('tools.doodle.zoom')}
        className="w-11 rounded-md py-1 text-center text-xs tabular-nums text-gray-600 transition-colors duration-150 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {Math.round(current * 100)}%
      </button>
      <IconButton
        icon="zoomIn"
        label={t('tools.doodle.zoomIn')}
        onClick={() => setZoom(nextZoom(current, 1))}
      />
      <IconButton icon="fit" label={t('tools.doodle.zoomFit')} onClick={() => setZoom('fit')} />
    </div>
  );
}

/** 收起态：只保留一条细条（当前工具 + 撤销重做 + 缩放），把高度让给画布 */
function CollapsedToolbar() {
  const { t } = useTranslation();
  const tool = useBoardStore((s) => s.tool);
  const past = useBoardStore((s) => s.past);
  const future = useBoardStore((s) => s.future);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const toggleCollapsed = useBoardStore((s) => s.toggleCollapsed);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-2 py-1 shadow-sm backdrop-blur transition-colors duration-150 dark:border-gray-800 dark:bg-gray-900/60">
      <IconButton icon="chevronDown" label={t('tools.doodle.expand')} onClick={toggleCollapsed} />
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
        <BoardIcon name={TOOL_ICONS[tool]} />
        {t(`tools.doodle.tool.${tool}`)}
      </span>
      <Divider />
      <IconButton
        icon="undo"
        label={t('tools.doodle.undo')}
        onClick={undo}
        disabled={past.length === 0}
      />
      <IconButton
        icon="redo"
        label={t('tools.doodle.redo')}
        onClick={redo}
        disabled={future.length === 0}
      />
      <div className="ml-auto flex items-center gap-1">
        <ZoomControls />
      </div>
    </div>
  );
}

/** 工具栏：主栏（高频操作常驻）+「更多设置」（低频设置可折叠）+ 收起细条 */
export default function BoardToolbar() {
  const { t } = useTranslation();
  const tool = useBoardStore((s) => s.tool);
  const brush = useBoardStore((s) => s.brush);
  const secondary = useBoardStore((s) => s.secondary);
  const recent = useBoardStore((s) => s.recent);
  const textSize = useBoardStore((s) => s.textSize);
  const fill = useBoardStore((s) => s.fill);
  const scene = useBoardStore((s) => s.scene);
  const preset = useBoardStore((s) => s.preset);
  const past = useBoardStore((s) => s.past);
  const future = useBoardStore((s) => s.future);
  const collapsed = useBoardStore((s) => s.collapsed);
  const details = useBoardStore((s) => s.details);
  const setTool = useBoardStore((s) => s.setTool);
  const patchBrush = useBoardStore((s) => s.patchBrush);
  const setPrimaryColor = useBoardStore((s) => s.setPrimaryColor);
  const setSecondaryColor = useBoardStore((s) => s.setSecondaryColor);
  const swapColors = useBoardStore((s) => s.swapColors);
  const setTextSize = useBoardStore((s) => s.setTextSize);
  const setFill = useBoardStore((s) => s.setFill);
  const setPreset = useBoardStore((s) => s.setPreset);
  const setBackground = useBoardStore((s) => s.setBackground);
  const setSize = useBoardStore((s) => s.setSize);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clear = useBoardStore((s) => s.clear);
  const toggleCollapsed = useBoardStore((s) => s.toggleCollapsed);
  const toggleDetails = useBoardStore((s) => s.toggleDetails);

  const isBrushTool = tool === 'pen' || tool === 'marker' || tool === 'eraser';
  const isShapeTool = tool === 'rect' || tool === 'ellipse' || tool === 'polygon';

  if (collapsed) return <CollapsedToolbar />;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/80 p-2 shadow-sm backdrop-blur transition-colors duration-150 dark:border-gray-800 dark:bg-gray-900/60">
      {/* 主栏：高频操作常驻，不与低频设置抢位置 */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <div
          className="flex items-center gap-1 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-950/60"
          role="group"
          aria-label="tools"
        >
          {TOOLS.map(({ id, icon }) => (
            <Fragment key={id}>
              {id === 'picker' ? <Divider /> : null}
              <button
                type="button"
                title={t(`tools.doodle.tool.${id}`)}
                aria-label={t(`tools.doodle.tool.${id}`)}
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ${
                  tool === id
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                    : 'text-gray-500 hover:bg-white/70 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <BoardIcon name={icon} />
              </button>
            </Fragment>
          ))}
        </div>

        <Divider />

        <ColorPicker
          foreground={brush.color}
          background={secondary}
          recent={recent}
          onForeground={setPrimaryColor}
          onBackground={setSecondaryColor}
          onSwap={swapColors}
        />

        <Divider />

        <IconButton
          icon="undo"
          label={t('tools.doodle.undo')}
          onClick={undo}
          disabled={past.length === 0}
        />
        <IconButton
          icon="redo"
          label={t('tools.doodle.redo')}
          onClick={redo}
          disabled={future.length === 0}
        />
        <IconButton icon="trash" label={t('tools.doodle.clear')} onClick={clear} />

        <div className="ml-auto flex flex-wrap items-center gap-x-1 gap-y-2">
          <ZoomControls />
          <Divider />
          <ExportMenu scene={scene} />
          <Divider />
          <IconButton
            icon="sliders"
            label={t('tools.doodle.details')}
            active={details}
            onClick={toggleDetails}
          />
          <IconButton
            icon="chevronUp"
            label={t('tools.doodle.collapse')}
            onClick={toggleCollapsed}
          />
        </div>
      </div>

      {/* 更多设置：低频设置，可折叠 */}
      {details ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 pt-2 dark:border-gray-800">
          <Slider
            label={t('tools.doodle.size')}
            value={brush.width}
            min={BRUSH_MIN}
            max={BRUSH_MAX}
            display={`${brush.width}`}
            onChange={(width) => patchBrush({ width })}
          />
          <Slider
            label={t('tools.doodle.opacity')}
            value={Math.round(brush.opacity * 100)}
            min={Math.round(OPACITY_STEP * 100)}
            max={100}
            display={`${Math.round(brush.opacity * 100)}%`}
            onChange={(value) => patchBrush({ opacity: value / 100 })}
          />
          {isBrushTool ? (
            <Toggle checked={brush.pressure} onChange={(pressure) => patchBrush({ pressure })}>
              {t('tools.doodle.pressure')}
            </Toggle>
          ) : null}
          {isShapeTool ? (
            <Toggle checked={fill} onChange={setFill} icon="fill">
              {t('tools.doodle.fill')}
            </Toggle>
          ) : null}
          {tool === 'text' ? (
            <Slider
              label={t('tools.doodle.textSize')}
              value={textSize}
              min={TEXT_MIN}
              max={TEXT_MAX}
              display={`${textSize}`}
              onChange={setTextSize}
            />
          ) : null}

          <Divider />

          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium text-gray-500 dark:text-gray-400">
              {t('tools.doodle.canvasSize')}
            </span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-800 outline-none transition-colors duration-150 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="fit">{t('tools.doodle.sizeFit')}</option>
              {Object.keys(SIZE_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {key.replace('x', ' × ')}
                </option>
              ))}
              <option value="custom">{t('tools.doodle.sizeCustom')}</option>
            </select>
          </label>
          {preset === 'custom' ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="number"
                min={360}
                max={4096}
                value={scene.width}
                onChange={(e) => setSize(Number(e.target.value), scene.height, { history: false })}
                className="h-8 w-20 rounded-md border border-gray-300 bg-white px-2 outline-none transition-colors duration-150 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
                aria-label={t('tools.doodle.width')}
              />
              <span>×</span>
              <input
                type="number"
                min={1}
                max={4096}
                value={scene.height}
                onChange={(e) => setSize(scene.width, Number(e.target.value), { history: false })}
                className="h-8 w-20 rounded-md border border-gray-300 bg-white px-2 outline-none transition-colors duration-150 focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900"
                aria-label={t('tools.doodle.height')}
              />
            </div>
          ) : null}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('tools.doodle.background')}
            </span>
            <div className="flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-700">
              {BACKGROUND_KINDS.map((kind: BackgroundKind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setBackground({ kind })}
                  className={`px-2 py-1 text-xs transition-colors duration-150 ${
                    scene.background.kind === kind
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(`tools.doodle.bg.${kind}`)}
                </button>
              ))}
            </div>
          </div>

          {scene.background.kind === 'transparent' ? null : (
            <div className="flex items-center gap-1">
              {BACKGROUND_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  aria-label={color}
                  onClick={() => setBackground({ color })}
                  className={`h-5 w-5 rounded-full border transition-transform duration-150 hover:scale-110 ${
                    scene.background.color.toLowerCase() === color
                      ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, display, onChange }: SliderProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      <span className="font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-blue-600"
      />
      <span className="w-8 font-mono text-[11px] text-gray-500 dark:text-gray-400">{display}</span>
    </label>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: BoardIconName;
  children: string;
}

function Toggle({ checked, onChange, icon, children }: ToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-150 ${
        checked
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {icon ? <BoardIcon name={icon} className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}
