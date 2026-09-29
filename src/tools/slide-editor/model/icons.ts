/**
 * 本地内置图标素材包。
 *
 * 隐私约束：SynTools 承诺「用户内容不离开浏览器」，因此**不接第三方图标 CDN**，
 * 图标以 24×24 viewBox 的 SVG path 数据内联在包里（纯字符串，不增加网络请求）。
 *
 * 存 path 而不是整段 `<svg>` 的好处：Konva.Path 可以直接同步绘制成矢量节点，
 * 缩略图与 PNG / PDF 光栅导出（同步渲染路径）也能正常出图。
 */

export interface SlideIcon {
  id: string;
  label: string;
  category: string;
  /** 24×24 viewBox 下的 SVG path 数据 */
  path: string;
  /** 线性图标（只描边不填充） */
  stroke?: boolean;
}

/** 图标分类（顺序即面板展示顺序） */
export const ICON_CATEGORIES = ['通用', '箭头', '商务', '状态', '形状'] as const;

export const SLIDE_ICONS: SlideIcon[] = [
  // 通用
  {
    id: 'check',
    label: '对勾',
    category: '通用',
    path: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  },
  {
    id: 'close',
    label: '关闭',
    category: '通用',
    path: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L12 13.4l-6.3 6.3-1.4-1.4L10.6 12 4.3 5.7 5.7 4.3 12 10.6l6.3-6.3z',
  },
  { id: 'plus', label: '加号', category: '通用', path: 'M11 3h2v8h8v2h-8v8h-2v-8H3v-2h8z' },
  { id: 'minus', label: '减号', category: '通用', path: 'M3 11h18v2H3z' },
  { id: 'play', label: '播放', category: '通用', path: 'M6 4l14 8-14 8z' },
  { id: 'pause', label: '暂停', category: '通用', path: 'M6 4h4v16H6zM14 4h4v16h-4z' },
  { id: 'home', label: '首页', category: '通用', path: 'M12 3l9 8h-3v10h-5v-6h-2v6H6V11H3z' },
  {
    id: 'user',
    label: '用户',
    category: '通用',
    path: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6z',
  },
  {
    id: 'search',
    label: '搜索',
    category: '通用',
    path: 'M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  },

  // 箭头
  {
    id: 'arrow-right',
    label: '右箭头',
    category: '箭头',
    path: 'M12 4l-1.4 1.4L16.2 11H4v2h12.2l-5.6 5.6L12 20l8-8z',
  },
  {
    id: 'arrow-left',
    label: '左箭头',
    category: '箭头',
    path: 'M12 4l1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8z',
  },
  {
    id: 'arrow-up',
    label: '上箭头',
    category: '箭头',
    path: 'M20 12l-1.4-1.4L13 16.2V4h-2v12.2L5.4 10.6 4 12l8 8z',
  },
  {
    id: 'arrow-down',
    label: '下箭头',
    category: '箭头',
    path: 'M4 12l1.4 1.4L11 7.8V20h2V7.8l5.6 5.6L20 12l-8-8z',
  },
  {
    id: 'chevron-right',
    label: '右尖括号',
    category: '箭头',
    path: 'M8.6 4.6 7.2 6l6 6-6 6 1.4 1.4L16 12z',
  },
  {
    id: 'chevron-left',
    label: '左尖括号',
    category: '箭头',
    path: 'M15.4 4.6 16.8 6l-6 6 6 6-1.4 1.4L8 12z',
  },
  {
    id: 'chevron-up',
    label: '上尖括号',
    category: '箭头',
    path: 'M4.6 15.4 6 16.8l6-6 6 6 1.4-1.4L12 7.6z',
  },
  {
    id: 'chevron-down',
    label: '下尖括号',
    category: '箭头',
    path: 'M4.6 8.6 6 7.2l6 6 6-6 1.4 1.4L12 16z',
  },
  {
    id: 'refresh',
    label: '循环',
    category: '箭头',
    path: 'M12 4a8 8 0 0 1 7.5 5.2l-1.9.7A6 6 0 0 0 12 6a6 6 0 0 0-5.7 4.1l2 2H4V6h2.1l-1.4 1.4A8 8 0 0 1 12 4zm0 16a8 8 0 0 1-7.5-5.2l1.9-.7A6 6 0 0 0 12 18a6 6 0 0 0 5.7-4.1l-2-2H20v6h-2.1l1.4-1.4A8 8 0 0 1 12 20z',
  },

  // 商务
  {
    id: 'briefcase',
    label: '公文包',
    category: '商务',
    path: 'M9 4h6a2 2 0 0 1 2 2v1h3v13H4V7h3V6a2 2 0 0 1 2-2zm0 3h6V6.5H9z',
  },
  {
    id: 'chart-bar',
    label: '柱状图',
    category: '商务',
    path: 'M4 20h16v-2H4zM6 16h3V9H6zm5 0h3V5h-3zm5 0h3v-9h-3z',
  },
  {
    id: 'chart-line',
    label: '折线图',
    category: '商务',
    path: 'M4 20h16v-2H4zM5 15l4-5 3 3 5-7 1.6 1.2L19 3h-3l-1.4 4.2L13 9l-3-3-4.6 5.8z',
  },
  {
    id: 'chart-pie',
    label: '饼图',
    category: '商务',
    path: 'M11 3v9H3a9 9 0 0 0 8 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9zm2 0v8h8a8 8 0 0 0-8-8z',
  },
  {
    id: 'coin',
    label: '金额',
    category: '商务',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 3.1c1.8.3 3 1.4 3.2 3h-2c-.1-.8-.6-1.3-1.5-1.5v3.6c1 .3 1.8.7 2.4 1.3.6.6.8 1.3.8 2.3 0 1.7-1.2 2.9-3.1 3.2V21h-1.6v-2.9c-2-.3-3.3-1.5-3.5-3.3h2c.1.9.7 1.5 1.8 1.7v-3.8c-1-.3-1.8-.7-2.4-1.3-.6-.6-.9-1.4-.9-2.4 0-1.7 1.2-2.9 3.1-3.1V3h1.2z',
  },
  {
    id: 'target',
    label: '目标',
    category: '商务',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  },
  {
    id: 'team',
    label: '团队',
    category: '商务',
    path: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3.9 3.1-6 7-6s7 2.1 7 6zm14.5 0c0-2.6-.9-4.5-2.5-5.6 3.4.2 6 2.4 6 5.6z',
  },
  {
    id: 'globe',
    label: '全球',
    category: '商务',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm6.9 6h-2.6a15 15 0 0 0-1.2-4.2A7 7 0 0 1 18.9 9zM12 5.1c.7 1 1.3 2.3 1.7 3.9h-3.4c.4-1.6 1-2.9 1.7-3.9zM5.1 9a7 7 0 0 1 3.8-4.2A15 15 0 0 0 7.7 9zm0 2a15 15 0 0 0 1.2 4.2A7 7 0 0 1 5.1 11zm3.9 6.9c-.9 0-1.7-.1-2.5-.3.4-.9.9-1.8 1.4-2.6.4.1.7.1 1.1.1zm4 0c-.4 0-.7 0-1.1-.1.5.8 1 1.7 1.4 2.6-.8.2-1.6.3-2.5.3zm2.9-.6a15 15 0 0 0 1.2-4.2h2.6a7 7 0 0 1-3.8 4.2z',
  },

  // 状态
  {
    id: 'warning',
    label: '警告',
    category: '状态',
    path: 'M12 3l10 18H2zm-1 6v6h2V9zm0 8v2h2v-2z',
  },
  {
    id: 'info',
    label: '信息',
    category: '状态',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-1 4h2v2h-2zm0 4h2v6h-2z',
  },
  {
    id: 'star',
    label: '星标',
    category: '状态',
    path: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z',
  },
  {
    id: 'heart',
    label: '喜欢',
    category: '状态',
    path: 'M12 21s-8-4.9-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5C20 16.1 12 21 12 21z',
  },
  { id: 'flag', label: '旗帜', category: '状态', path: 'M5 3v18H3V3zm2 0h11l-2.5 5L18 13H7z' },
  {
    id: 'lock',
    label: '锁定',
    category: '状态',
    path: 'M12 3a5 5 0 0 0-5 5v2H5v11h14V10h-2V8a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v2H9V8a3 3 0 0 1 3-3z',
  },
  {
    id: 'lightbulb',
    label: '创意',
    category: '状态',
    path: 'M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7l.1.5h5l.1-.5c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3zM9.5 18h5c0 .8-.7 1.5-1.5 1.5h-2c-.8 0-1.5-.7-1.5-1.5z',
  },

  // 形状
  {
    id: 'shape-circle',
    label: '圆形',
    category: '形状',
    path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
  },
  { id: 'shape-square', label: '方形', category: '形状', path: 'M3 3h18v18H3z' },
  {
    id: 'shape-rounded',
    label: '圆角方形',
    category: '形状',
    path: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  },
  { id: 'shape-triangle', label: '三角形', category: '形状', path: 'M12 3l9 18H3z' },
  { id: 'shape-diamond', label: '菱形', category: '形状', path: 'M12 2l10 10-10 10L2 12z' },
  {
    id: 'shape-hexagon',
    label: '六边形',
    category: '形状',
    path: 'M12 2l8.7 5v10L12 22l-8.7-5V7z',
  },
  {
    id: 'shape-star',
    label: '星形',
    category: '形状',
    path: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z',
  },
];

export function findIcon(id: string): SlideIcon | undefined {
  return SLIDE_ICONS.find((icon) => icon.id === id);
}

/** 图标 → 完整 SVG 文本（导出时栅格化用） */
export function iconSvg(icon: SlideIcon, color = '#2563EB'): string {
  const paint = icon.stroke
    ? `<path d="${icon.path}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${icon.path}" fill="${color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${paint}</svg>`;
}
