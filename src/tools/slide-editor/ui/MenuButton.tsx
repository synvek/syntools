/**
 * 兼容层：下拉菜单按钮已提升为共享实现 `@/core/components/MenuButton`
 * （幻灯片工具栏与文字处理器 / 电子表格 / 幻灯片的导入导出入口共用同一套定位与关闭行为）。
 *
 * 保留本文件与原有导出名，工具内各处的 `./MenuButton` 引用无需改动。
 */
export { MenuButton, type MenuItem, type MenuButtonProps } from '@/core/components/MenuButton';
