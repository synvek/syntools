/**
 * UML 形状共享的 SVG path 生成函数。
 *
 * 约定：入参 `w` / `h` 为节点像素尺寸，`p` 为可调参数读取器（默认值由 `ShapeDef.adjust` 声明）；
 * 所有函数对尺寸做防御处理（不产生 NaN），输出可直接用于 `ShapeDef.path`，
 * 由 `nodes/shapeDraw.tsx` 的 `path` 分支渲染。
 */

import type { ParamGetter } from './adjust';

/** 角色（火柴人）：头 + 躯干 + 手臂 + 腿 */
export const actorPath = (w: number, h: number): string => {
  const cx = w / 2;
  const r = w * 0.13;
  return (
    `M${cx - r},${h * 0.16} a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0 ` +
    `M${cx},${h * 0.3} V${h * 0.6} ` +
    `M${w * 0.22},${h * 0.44} H${w * 0.78} ` +
    `M${w * 0.26},${h * 0.94} L${cx},${h * 0.6} L${w * 0.74},${h * 0.94}`
  );
};

/** 包：左上角标签 + 主体矩形（tabHeight 可调） */
export const packagePath = (w: number, h: number, p: ParamGetter): string => {
  const th = p('tabHeight');
  return `M0,${th} V${h} H${w} V${th} H${w * 0.45} V0 H0 Z`;
};

/**
 * 生命线：顶部对象框 + 向下竖虚线。
 * 标题框高度 `lifelineHeader` 为固定像素（默认 40px），不再随生命线高度等比缩放。
 */
export const lifelinePath = (w: number, h: number, p: ParamGetter): string => {
  const hh = p('lifelineHeader');
  return `M${w * 0.2},0 H${w * 0.8} V${hh} H${w * 0.2} Z M${w * 0.5},${hh} V${h}`;
};

/** 正圆（两条半圆弧），供无需填充的圆形图标复用 */
const circlePath = (cx: number, cy: number, r: number): string =>
  `M${cx - r},${cy} a${r},${r} 0 1,1 ${r * 2},0 a${r},${r} 0 1,1 -${r * 2},0`;

/** 边界（boundary，分析类）：圆 + 左侧竖线 + 连接短线 */
export const boundaryPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.26;
  const cx = w * 0.62;
  const cy = h / 2;
  const lx = w * 0.32;
  return (
    `${circlePath(cx, cy, r)} ` +
    `M${lx},${cy - r * 1.15} V${cy + r * 1.15} M${lx},${cy} H${cx - r}`
  );
};

/** 控制（control，分析类）：圆 + 顶部小箭头 */
export const controlPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.26;
  const cx = w / 2;
  const cy = h * 0.62;
  const top = cy - r;
  return (
    `${circlePath(cx, cy, r)} ` +
    `M${cx},${top} V${top - r * 0.7} ` +
    `M${cx - r * 0.45},${top - r * 0.3} L${cx},${top - r * 0.7} L${cx + r * 0.45},${top - r * 0.3}`
  );
};

/** 实体（entity，分析类）：圆 + 底部横线 + 连接竖线 */
export const entityPath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.24;
  const cx = w / 2;
  const cy = h * 0.4;
  const base = h * 0.84;
  return (
    `${circlePath(cx, cy, r)} ` + `M${cx},${cy + r} V${base} ` + `M${w * 0.16},${base} H${w * 0.84}`
  );
};

/** 图框（frame）：外框矩形 + 左上角五边形名称标签（tabHeight 可调） */
export const framePath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.42, 160);
  const tabH = p('tabHeight');
  const clip = tabH * 0.7;
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} L${tabW - clip},${tabH} H0 Z`;
};

/** 系统边界 / 主体（subject）：带左上角名称栏的矩形（tabHeight 可调） */
export const subjectPath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.46, 180);
  const tabH = p('tabHeight');
  return `M0,0 H${tabW} V${tabH} H${w} V${h} H0 Z`;
};

/** 圆角矩形（含箭头指向时为内部关系记号） */
const roundedRect = (w: number, h: number): string => {
  const r = Math.max(0, Math.min(12, w / 2, h / 2));
  return (
    `M${r},0 H${w - r} a${r},${r} 0 0 1 ${r},${r} V${h - r} ` +
    `a${r},${r} 0 0 1 -${r},${r} H${r} a${r},${r} 0 0 1 -${r},-${r} V${r} a${r},${r} 0 0 1 ${r},-${r} Z`
  );
};

/** 包含关系：圆角矩形 + 内部向右箭头（点线由样式 lineDash 控制） */
export const includePath = (w: number, h: number): string => {
  const y = h / 2;
  return (
    `${roundedRect(w, h)} ` +
    `M${w * 0.32},${y} H${w * 0.66} ` +
    `M${w * 0.54},${y - h * 0.14} L${w * 0.66},${y} L${w * 0.54},${y + h * 0.14}`
  );
};

/** 扩展关系：圆角矩形 + 内部向左箭头 */
export const extendPath = (w: number, h: number): string => {
  const y = h / 2;
  return (
    `${roundedRect(w, h)} ` +
    `M${w * 0.68},${y} H${w * 0.34} ` +
    `M${w * 0.46},${y - h * 0.14} L${w * 0.34},${y} L${w * 0.46},${y + h * 0.14}`
  );
};

/** 活动类：矩形 + 左右两侧的双竖线（inset 可调） */
export const activeClassPath = (w: number, h: number, p: ParamGetter): string => {
  const inset = p('activeClassInset');
  return `M0,0 H${w} V${h} H0 Z M${inset},0 V${h} M${w - inset},0 V${h}`;
};

/** 模板类：矩形 + 右上角虚线小框（tabHeight 可调） */
export const templateClassPath = (w: number, h: number, p: ParamGetter): string => {
  const tw = Math.min(w * 0.34, 70);
  const th = p('tabHeight');
  return `M0,0 H${w} V${h} H0 Z ` + `M${w - tw - 4},4 H${w - 4} V${4 + th} H${w - tw - 4} Z`;
};

/** 组件：主体矩形 + 左侧两个小凸块（tabWidth 可调） */
export const componentPath = (w: number, h: number, p: ParamGetter): string => {
  const tw = p('componentTab');
  const ty = h * 0.16;
  const t1a = h * 0.3;
  const t1b = h * 0.44;
  const t2a = h * 0.56;
  const t2b = h * 0.7;
  return (
    `M${tw},${ty} H${w} V${h - ty} H${tw} ` +
    `V${t2b} H0 V${t2a} H${tw} V${t1b} H0 V${t1a} H${tw} Z`
  );
};

/** 提供接口（球）：圆 + 下垂线 + 底部横线 */
export const providedInterfacePath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = r + 3;
  return (
    `${circlePath(cx, cy, r)} ` + `M${cx},${cy + r} V${h - 4} M${w * 0.18},${h - 4} H${w * 0.82}`
  );
};

/** 需求接口（插座）：向右开口的半圆 + 下垂线 + 底部横线 */
export const requiredInterfacePath = (w: number, h: number): string => {
  const r = Math.min(w, h) * 0.2;
  const cx = w / 2;
  const cy = r + 3;
  return (
    `M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} ` +
    `M${cx},${cy + r} V${h - 4} M${w * 0.18},${h - 4} H${w * 0.82}`
  );
};

/** 销毁标记：粗叉（X 形多边形，靠样式填充） */
export const destroyPath = (w: number, h: number): string => {
  const t = Math.min(w, h) * 0.14;
  const cx = w / 2;
  const cy = h / 2;
  return (
    `M${cx - t},${cy - h * 0.34} L${cx},${cy - t} L${cx + t},${cy - h * 0.34} ` +
    `L${w * 0.78},${cy - h * 0.34} L${cx + t},${cy} L${w * 0.78},${cy + h * 0.34} ` +
    `L${cx + t},${cy + t} L${cx},${cy + h * 0.34} L${cx - t},${cy + t} ` +
    `L${w * 0.22},${cy + h * 0.34} L${cx - t},${cy} L${w * 0.22},${cy - h * 0.34} Z`
  );
};

/** 组合片段 / 图框：外框 + 左上角被切角的五边形标签（tabHeight 可调） */
export const combinedFragmentPath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.4, 150);
  const tabH = p('tabHeight');
  const clip = tabH * 0.7;
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} L${tabW - clip},${tabH} H0 Z`;
};

/** 交互引用（ref）：外框 + 左上角矩形标签（tabHeight 可调） */
export const interactionUsePath = (w: number, h: number, p: ParamGetter): string => {
  const tabW = Math.min(w * 0.4, 150);
  const tabH = p('tabHeight');
  return `M0,0 H${w} V${h} H0 Z M0,0 H${tabW} V${tabH} H0 Z`;
};

/** 发送信号：右侧尖角的凸五边形 */
export const sendSignalPath = (w: number, h: number): string =>
  `M0,0 H${w * 0.7} L${w},${h / 2} L${w * 0.7},${h} H0 Z`;

/** 接收信号：左侧凹口的五边形 */
export const receiveSignalPath = (w: number, h: number): string =>
  `M${w * 0.3},0 H${w} V${h} H${w * 0.3} L0,${h / 2} Z`;

/** 活动分区：外框 + 左侧竖向分隔线（左栏宽可调） */
export const activityPartitionPath = (w: number, h: number, p: ParamGetter): string => {
  const hw = p('partitionHeader');
  return `M0,0 H${w} V${h} H0 Z M${hw},0 V${h}`;
};

/** 部署节点：3D 立方体（前/上/右三面；深度可调） */
export const nodePath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return (
    `M0,${d} L${d},0 H${w} V${h - d} L${w - d},${h} H0 Z ` +
    `M0,${d} H${w - d} V${h} M${w - d},${d} L${w},0`
  );
};

/** 设备：3D 立方体 + 前表面上方的一条横线（与普通节点区分） */
export const devicePath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return `${nodePath(w, h, p)} M0,${d + h * 0.18} H${w - d}`;
};

/** 运行环境：3D 立方体 + 前表面下方的双横线 */
export const executionEnvironmentPath = (w: number, h: number, p: ParamGetter): string => {
  const d = p('cubeDepth');
  return `${nodePath(w, h, p)} M0,${h * 0.66} H${w - d} M0,${h * 0.76} H${w - d}`;
};

/** 制品：右上角折角的矩形（折角可调） */
export const artifactPath = (w: number, h: number, p: ParamGetter): string => {
  const c = p('foldSize');
  return `M0,0 H${w - c} L${w},${c} V${h} H0 Z M${w - c},0 V${c} H${w}`;
};
