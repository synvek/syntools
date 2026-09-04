/**
 * CSS3 代码生成器：border-radius / box-shadow / text-shadow / transform / transition / filter。
 */

export type Css3Module =
  | 'borderRadius'
  | 'boxShadow'
  | 'textShadow'
  | 'transform'
  | 'transition'
  | 'filter';

export const CSS3_MODULES: Css3Module[] = [
  'borderRadius',
  'boxShadow',
  'textShadow',
  'transform',
  'transition',
  'filter',
];

export interface BorderRadiusOptions {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  linked: boolean;
}

export interface BoxShadowOptions {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

export interface TextShadowOptions {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

export interface TransformOptions {
  translateX: number;
  translateY: number;
  rotate: number;
  scale: number;
  skewX: number;
}

export interface TransitionOptions {
  property: string;
  duration: number;
  timing: string;
  delay: number;
}

export interface FilterOptions {
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  hueRotate: number;
}

export const DEFAULT_BORDER_RADIUS: BorderRadiusOptions = {
  topLeft: 12,
  topRight: 12,
  bottomRight: 12,
  bottomLeft: 12,
  linked: true,
};

export const DEFAULT_BOX_SHADOW: BoxShadowOptions = {
  offsetX: 0,
  offsetY: 8,
  blur: 24,
  spread: -4,
  color: 'rgba(0,0,0,0.15)',
  inset: false,
};

export const DEFAULT_TEXT_SHADOW: TextShadowOptions = {
  offsetX: 1,
  offsetY: 1,
  blur: 2,
  color: 'rgba(0,0,0,0.35)',
};

export const DEFAULT_TRANSFORM: TransformOptions = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  scale: 1,
  skewX: 0,
};

export const DEFAULT_TRANSITION: TransitionOptions = {
  property: 'all',
  duration: 0.3,
  timing: 'ease',
  delay: 0,
};

export const DEFAULT_FILTER: FilterOptions = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  hueRotate: 0,
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function buildBorderRadiusCss(o: BorderRadiusOptions): string {
  if (o.linked) {
    return `border-radius: ${round(o.topLeft)}px;`;
  }
  return `border-radius: ${round(o.topLeft)}px ${round(o.topRight)}px ${round(o.bottomRight)}px ${round(o.bottomLeft)}px;`;
}

export function buildBoxShadowCss(o: BoxShadowOptions): string {
  const inset = o.inset ? 'inset ' : '';
  return `box-shadow: ${inset}${round(o.offsetX)}px ${round(o.offsetY)}px ${round(o.blur)}px ${round(o.spread)}px ${o.color};`;
}

export function buildTextShadowCss(o: TextShadowOptions): string {
  return `text-shadow: ${round(o.offsetX)}px ${round(o.offsetY)}px ${round(o.blur)}px ${o.color};`;
}

export function buildTransformCss(o: TransformOptions): string {
  const parts = [
    `translate(${round(o.translateX)}px, ${round(o.translateY)}px)`,
    `rotate(${round(o.rotate)}deg)`,
    `scale(${round(o.scale, 3)})`,
    `skewX(${round(o.skewX)}deg)`,
  ];
  return `transform: ${parts.join(' ')};`;
}

export function buildTransitionCss(o: TransitionOptions): string {
  const prop = o.property.trim() || 'all';
  const timing = o.timing.trim() || 'ease';
  return `transition: ${prop} ${round(o.duration, 3)}s ${timing} ${round(o.delay, 3)}s;`;
}

export function buildFilterCss(o: FilterOptions): string {
  const parts = [
    `blur(${round(o.blur)}px)`,
    `brightness(${round(o.brightness)}%)`,
    `contrast(${round(o.contrast)}%)`,
    `saturate(${round(o.saturate)}%)`,
    `grayscale(${round(o.grayscale)}%)`,
    `hue-rotate(${round(o.hueRotate)}deg)`,
  ];
  return `filter: ${parts.join(' ')};`;
}

export function buildCss3ForModule(
  module: Css3Module,
  state: {
    borderRadius: BorderRadiusOptions;
    boxShadow: BoxShadowOptions;
    textShadow: TextShadowOptions;
    transform: TransformOptions;
    transition: TransitionOptions;
    filter: FilterOptions;
  },
): string {
  switch (module) {
    case 'borderRadius':
      return buildBorderRadiusCss(state.borderRadius);
    case 'boxShadow':
      return buildBoxShadowCss(state.boxShadow);
    case 'textShadow':
      return buildTextShadowCss(state.textShadow);
    case 'transform':
      return buildTransformCss(state.transform);
    case 'transition':
      return buildTransitionCss(state.transition);
    case 'filter':
      return buildFilterCss(state.filter);
  }
}

/** 将 CSS 声明解析为内联 style 对象（仅当前模块预览用） */
export function cssDeclToStyle(css: string): Record<string, string> {
  const style: Record<string, string> = {};
  const m = /^([a-z-]+)\s*:\s*(.+);?\s*$/i.exec(css.trim());
  if (!m) return style;
  const prop = m[1].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  style[prop] = m[2].replace(/;$/, '').trim();
  return style;
}
