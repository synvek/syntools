import type { GradientOptions } from './core';

/**
 * CSS 渐变常用分类预设。
 */

export type GradientPresetCategoryId =
  | 'warm'
  | 'cool'
  | 'nature'
  | 'pink'
  | 'purple'
  | 'dark'
  | 'light'
  | 'rainbow'
  | 'sunset'
  | 'ocean';

export interface GradientPreset {
  id: string;
  category: GradientPresetCategoryId;
  options: GradientOptions;
}

export const GRADIENT_PRESET_CATEGORY_IDS: GradientPresetCategoryId[] = [
  'warm',
  'cool',
  'nature',
  'pink',
  'purple',
  'dark',
  'light',
  'rainbow',
  'sunset',
  'ocean',
];

function linear(angle: number, stops: GradientOptions['stops']): GradientOptions {
  return { type: 'linear', angle, shape: 'circle', stops };
}

function radial(shape: 'circle' | 'ellipse', stops: GradientOptions['stops']): GradientOptions {
  return { type: 'radial', angle: 0, shape, stops };
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  // 暖色系
  { id: 'warm-golden', category: 'warm', options: linear(135, [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 100 }]) },
  { id: 'warm-peach', category: 'warm', options: linear(120, [{ color: '#ff9966', position: 0 }, { color: '#ff5e62', position: 100 }]) },
  { id: 'warm-coral', category: 'warm', options: linear(45, [{ color: '#ff758c', position: 0 }, { color: '#ff7eb3', position: 100 }]) },
  { id: 'warm-amber', category: 'warm', options: linear(160, [{ color: '#f6d365', position: 0 }, { color: '#fda085', position: 100 }]) },
  { id: 'warm-spice', category: 'warm', options: linear(90, [{ color: '#fc4a1a', position: 0 }, { color: '#f7b733', position: 100 }]) },
  { id: 'warm-rose-gold', category: 'warm', options: linear(135, [{ color: '#eecda3', position: 0 }, { color: '#ef629f', position: 100 }]) },
  { id: 'warm-papaya', category: 'warm', options: linear(180, [{ color: '#ffecd2', position: 0 }, { color: '#fcb69f', position: 100 }]) },
  { id: 'warm-flame', category: 'warm', options: linear(45, [{ color: '#f12711', position: 0 }, { color: '#f5af19', position: 100 }]) },
  { id: 'warm-honey', category: 'warm', options: linear(90, [{ color: '#f9d423', position: 0 }, { color: '#ff4e50', position: 100 }]) },
  { id: 'warm-terracotta', category: 'warm', options: linear(135, [{ color: '#e65c00', position: 0 }, { color: '#f9d423', position: 100 }]) },
  { id: 'warm-mango', category: 'warm', options: linear(120, [{ color: '#ffe259', position: 0 }, { color: '#ffa751', position: 100 }]) },
  { id: 'warm-autumn', category: 'warm', options: linear(160, [{ color: '#d38312', position: 0 }, { color: '#a83279', position: 100 }]) },
  { id: 'warm-cinnamon', category: 'warm', options: linear(180, [{ color: '#c79081', position: 0 }, { color: '#dfa579', position: 100 }]) },
  { id: 'warm-tangerine', category: 'warm', options: linear(45, [{ color: '#ff8008', position: 0 }, { color: '#ffc837', position: 100 }]) },
  { id: 'warm-sunset-orange', category: 'warm', options: linear(135, [{ color: '#ff6b6b', position: 0 }, { color: '#feca57', position: 100 }]) },
  { id: 'warm-brick', category: 'warm', options: linear(90, [{ color: '#cb2d3e', position: 0 }, { color: '#ef473a', position: 100 }]) },
  { id: 'warm-caramel', category: 'warm', options: linear(120, [{ color: '#d1913c', position: 0 }, { color: '#ffd194', position: 100 }]) },
  { id: 'warm-radial', category: 'warm', options: radial('ellipse', [{ color: '#fff1eb', position: 0 }, { color: '#ff9a56', position: 100 }]) },
  { id: 'warm-saffron', category: 'warm', options: linear(160, [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 50 }, { color: '#f12711', position: 100 }]) },
  { id: 'warm-burnt', category: 'warm', options: linear(135, [{ color: '#8e0e00', position: 0 }, { color: '#1f1c18', position: 50 }, { color: '#f12711', position: 100 }]) },
  { id: 'warm-apricot', category: 'warm', options: linear(45, [{ color: '#ffecd2', position: 0 }, { color: '#fcb69f', position: 50 }, { color: '#ff8177', position: 100 }]) },

  // 冷色系
  { id: 'cool-arctic', category: 'cool', options: linear(135, [{ color: '#00d2ff', position: 0 }, { color: '#3a7bd5', position: 100 }]) },
  { id: 'cool-ice', category: 'cool', options: linear(180, [{ color: '#e0eafc', position: 0 }, { color: '#cfdef3', position: 100 }]) },
  { id: 'cool-frost', category: 'cool', options: linear(120, [{ color: '#83a4d4', position: 0 }, { color: '#b6fbff', position: 100 }]) },
  { id: 'cool-steel', category: 'cool', options: linear(90, [{ color: '#bdc3c7', position: 0 }, { color: '#2c3e50', position: 100 }]) },
  { id: 'cool-mint-ice', category: 'cool', options: linear(135, [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 100 }]) },
  { id: 'cool-glacier', category: 'cool', options: linear(45, [{ color: '#c9d6ff', position: 0 }, { color: '#e2e2e2', position: 100 }]) },
  { id: 'cool-skyline', category: 'cool', options: linear(160, [{ color: '#56ccf2', position: 0 }, { color: '#2f80ed', position: 100 }]) },
  { id: 'cool-polar', category: 'cool', options: radial('ellipse', [{ color: '#ffffff', position: 0 }, { color: '#a1c4fd', position: 100 }]) },
  { id: 'cool-nordic', category: 'cool', options: linear(135, [{ color: '#e6e9f0', position: 0 }, { color: '#eef1f5', position: 100 }]) },
  { id: 'cool-periwinkle', category: 'cool', options: linear(90, [{ color: '#a8c0ff', position: 0 }, { color: '#3f2b96', position: 100 }]) },
  { id: 'cool-cobalt', category: 'cool', options: linear(120, [{ color: '#004e92', position: 0 }, { color: '#000428', position: 100 }]) },
  { id: 'cool-teal-breeze', category: 'cool', options: linear(160, [{ color: '#1cb5e0', position: 0 }, { color: '#000046', position: 100 }]) },
  { id: 'cool-sapphire', category: 'cool', options: linear(45, [{ color: '#0f2027', position: 0 }, { color: '#203a43', position: 50 }, { color: '#2c5364', position: 100 }]) },
  { id: 'cool-winter', category: 'cool', options: linear(180, [{ color: '#e6dada', position: 0 }, { color: '#274046', position: 100 }]) },
  { id: 'cool-azure', category: 'cool', options: linear(135, [{ color: '#7f7fd5', position: 0 }, { color: '#86a8e7', position: 50 }, { color: '#91eae4', position: 100 }]) },
  { id: 'cool-denim', category: 'cool', options: linear(90, [{ color: '#4b6cb7', position: 0 }, { color: '#182848', position: 100 }]) },
  { id: 'cool-moonlight', category: 'cool', options: radial('circle', [{ color: '#f5f7fa', position: 0 }, { color: '#c3cfe2', position: 100 }]) },
  { id: 'cool-cyan', category: 'cool', options: linear(120, [{ color: '#00d2ff', position: 0 }, { color: '#928dab', position: 100 }]) },
  { id: 'cool-harbor', category: 'cool', options: linear(160, [{ color: '#536976', position: 0 }, { color: '#292e49', position: 100 }]) },
  { id: 'cool-iceberg', category: 'cool', options: linear(45, [{ color: '#accbee', position: 0 }, { color: '#e7f0fd', position: 100 }]) },

  // 自然绿
  { id: 'nature-forest', category: 'nature', options: linear(135, [{ color: '#134e5e', position: 0 }, { color: '#71b280', position: 100 }]) },
  { id: 'nature-moss', category: 'nature', options: linear(90, [{ color: '#56ab2f', position: 0 }, { color: '#a8e063', position: 100 }]) },
  { id: 'nature-jungle', category: 'nature', options: linear(45, [{ color: '#11998e', position: 0 }, { color: '#38ef7d', position: 100 }]) },
  { id: 'nature-spring', category: 'nature', options: linear(120, [{ color: '#d4fc79', position: 0 }, { color: '#96e6a1', position: 100 }]) },
  { id: 'nature-fern', category: 'nature', options: linear(180, [{ color: '#004d40', position: 0 }, { color: '#1b5e20', position: 50 }, { color: '#81c784', position: 100 }]) },
  { id: 'nature-matcha', category: 'nature', options: linear(135, [{ color: '#c0d6a8', position: 0 }, { color: '#6b8e23', position: 100 }]) },
  { id: 'nature-emerald', category: 'nature', options: linear(160, [{ color: '#348f50', position: 0 }, { color: '#56b4d3', position: 100 }]) },
  { id: 'nature-leaf', category: 'nature', options: radial('circle', [{ color: '#e8f5e9', position: 0 }, { color: '#2e7d32', position: 100 }]) },
  { id: 'nature-bamboo', category: 'nature', options: linear(135, [{ color: '#76b852', position: 0 }, { color: '#8dc26f', position: 100 }]) },
  { id: 'nature-pine', category: 'nature', options: linear(90, [{ color: '#0f3443', position: 0 }, { color: '#34e89e', position: 100 }]) },
  { id: 'nature-sage', category: 'nature', options: linear(120, [{ color: '#bdc3c7', position: 0 }, { color: '#2c3e50', position: 100 }]) },
  { id: 'nature-meadow', category: 'nature', options: linear(160, [{ color: '#56ab2f', position: 0 }, { color: '#a8e063', position: 50 }, { color: '#f1f2b5', position: 100 }]) },
  { id: 'nature-rainforest', category: 'nature', options: linear(45, [{ color: '#000000', position: 0 }, { color: '#0f9b0f', position: 100 }]) },
  { id: 'nature-olive', category: 'nature', options: linear(180, [{ color: '#808080', position: 0 }, { color: '#3d9970', position: 100 }]) },
  { id: 'nature-cypress', category: 'nature', options: linear(135, [{ color: '#134e5e', position: 0 }, { color: '#71b280', position: 50 }, { color: '#a8e063', position: 100 }]) },
  { id: 'nature-mint', category: 'nature', options: linear(90, [{ color: '#00b09b', position: 0 }, { color: '#96c93d', position: 100 }]) },
  { id: 'nature-tea', category: 'nature', options: linear(120, [{ color: '#d4fc79', position: 0 }, { color: '#96e6a1', position: 100 }]) },
  { id: 'nature-canopy', category: 'nature', options: radial('ellipse', [{ color: '#56ab2f', position: 0 }, { color: '#004d40', position: 100 }]) },
  { id: 'nature-dew', category: 'nature', options: linear(45, [{ color: '#e0f7fa', position: 0 }, { color: '#80cbc4', position: 100 }]) },
  { id: 'nature-avocado', category: 'nature', options: linear(160, [{ color: '#a8e063', position: 0 }, { color: '#56ab2f', position: 100 }]) },

  // 浪漫粉
  { id: 'pink-blush', category: 'pink', options: linear(135, [{ color: '#ff9a9e', position: 0 }, { color: '#fecfef', position: 100 }]) },
  { id: 'pink-rose', category: 'pink', options: linear(45, [{ color: '#f857a6', position: 0 }, { color: '#ff5858', position: 100 }]) },
  { id: 'pink-cotton', category: 'pink', options: linear(120, [{ color: '#a18cd1', position: 0 }, { color: '#fbc2eb', position: 100 }]) },
  { id: 'pink-sakura', category: 'pink', options: linear(180, [{ color: '#fad0c4', position: 0 }, { color: '#ffd1ff', position: 100 }]) },
  { id: 'pink-cherry', category: 'pink', options: linear(90, [{ color: '#f093fb', position: 0 }, { color: '#f5576c', position: 100 }]) },
  { id: 'pink-bubble', category: 'pink', options: linear(135, [{ color: '#ffafbd', position: 0 }, { color: '#ffc3a0', position: 100 }]) },
  { id: 'pink-dream', category: 'pink', options: linear(160, [{ color: '#ee9ca7', position: 0 }, { color: '#ffdde1', position: 100 }]) },
  { id: 'pink-valentine', category: 'pink', options: radial('ellipse', [{ color: '#ff6a88', position: 0 }, { color: '#ff99ac', position: 100 }]) },
  { id: 'pink-lotus', category: 'pink', options: linear(135, [{ color: '#ffc3a0', position: 0 }, { color: '#ffafbd', position: 100 }]) },
  { id: 'pink-peony', category: 'pink', options: linear(90, [{ color: '#ed4264', position: 0 }, { color: '#ffedbc', position: 100 }]) },
  { id: 'pink-strawberry', category: 'pink', options: linear(120, [{ color: '#ff0844', position: 0 }, { color: '#ffb199', position: 100 }]) },
  { id: 'pink-fairy', category: 'pink', options: linear(160, [{ color: '#fbc2eb', position: 0 }, { color: '#a6c1ee', position: 100 }]) },
  { id: 'pink-magnolia', category: 'pink', options: linear(45, [{ color: '#fff0f5', position: 0 }, { color: '#ffb6c1', position: 100 }]) },
  { id: 'pink-petal', category: 'pink', options: linear(180, [{ color: '#ff9a9e', position: 0 }, { color: '#fad0c4', position: 50 }, { color: '#fad0c4', position: 100 }]) },
  { id: 'pink-candy', category: 'pink', options: linear(135, [{ color: '#ff758c', position: 0 }, { color: '#ff7eb3', position: 100 }]) },
  { id: 'pink-radial', category: 'pink', options: radial('circle', [{ color: '#fff0f5', position: 0 }, { color: '#f857a6', position: 100 }]) },
  { id: 'pink-rosewater', category: 'pink', options: linear(90, [{ color: '#e8cbc0', position: 0 }, { color: '#636fa4', position: 100 }]) },
  { id: 'pink-ballet', category: 'pink', options: linear(120, [{ color: '#ffdde1', position: 0 }, { color: '#ee9ca7', position: 100 }]) },

  // 神秘紫
  { id: 'purple-galaxy', category: 'purple', options: linear(135, [{ color: '#4e54c8', position: 0 }, { color: '#8f94fb', position: 100 }]) },
  { id: 'purple-mystic', category: 'purple', options: linear(45, [{ color: '#cc2b5e', position: 0 }, { color: '#753a88', position: 100 }]) },
  { id: 'purple-amethyst', category: 'purple', options: linear(120, [{ color: '#9d50bb', position: 0 }, { color: '#6e48aa', position: 100 }]) },
  { id: 'purple-velvet', category: 'purple', options: linear(180, [{ color: '#654ea3', position: 0 }, { color: '#eaafc8', position: 100 }]) },
  { id: 'purple-neon', category: 'purple', options: linear(90, [{ color: '#7f00ff', position: 0 }, { color: '#e100ff', position: 100 }]) },
  { id: 'purple-twilight', category: 'purple', options: linear(160, [{ color: '#2b5876', position: 0 }, { color: '#4e4376', position: 100 }]) },
  { id: 'purple-royal', category: 'purple', options: linear(135, [{ color: '#141e30', position: 0 }, { color: '#243b55', position: 50 }, { color: '#6a3093', position: 100 }]) },
  { id: 'purple-orb', category: 'purple', options: radial('circle', [{ color: '#a770ef', position: 0 }, { color: '#cf8bf3', position: 50 }, { color: '#fdb99b', position: 100 }]) },
  { id: 'purple-lilac', category: 'purple', options: linear(135, [{ color: '#c471f5', position: 0 }, { color: '#fa71cd', position: 100 }]) },
  { id: 'purple-indigo', category: 'purple', options: linear(90, [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 100 }]) },
  { id: 'purple-plum', category: 'purple', options: linear(120, [{ color: '#41295a', position: 0 }, { color: '#2f0743', position: 100 }]) },
  { id: 'purple-cosmic', category: 'purple', options: linear(160, [{ color: '#ff00cc', position: 0 }, { color: '#333399', position: 100 }]) },
  { id: 'purple-dusk', category: 'purple', options: linear(45, [{ color: '#2c3e50', position: 0 }, { color: '#4ca1af', position: 50 }, { color: '#c471ed', position: 100 }]) },
  { id: 'purple-wine', category: 'purple', options: linear(180, [{ color: '#200122', position: 0 }, { color: '#6f0000', position: 100 }]) },
  { id: 'purple-iris', category: 'purple', options: linear(135, [{ color: '#5f2c82', position: 0 }, { color: '#49a09d', position: 100 }]) },
  { id: 'purple-void', category: 'purple', options: radial('ellipse', [{ color: '#1a1a2e', position: 0 }, { color: '#16213e', position: 50 }, { color: '#0f3460', position: 100 }]) },
  { id: 'purple-haze', category: 'purple', options: linear(90, [{ color: '#614385', position: 0 }, { color: '#516395', position: 100 }]) },
  { id: 'purple-orchid', category: 'purple', options: linear(120, [{ color: '#da22ff', position: 0 }, { color: '#9733ee', position: 100 }]) },
  { id: 'purple-aurora', category: 'purple', options: linear(160, [{ color: '#7f00ff', position: 0 }, { color: '#e100ff', position: 50 }, { color: '#ff0080', position: 100 }]) },
  { id: 'purple-midnight', category: 'purple', options: linear(135, [{ color: '#0c0c1d', position: 0 }, { color: '#1a1a3e', position: 50 }, { color: '#6b21a8', position: 100 }]) },

  // 深色系
  { id: 'dark-charcoal', category: 'dark', options: linear(135, [{ color: '#232526', position: 0 }, { color: '#414345', position: 100 }]) },
  { id: 'dark-midnight', category: 'dark', options: linear(180, [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#24243e', position: 100 }]) },
  { id: 'dark-slate', category: 'dark', options: linear(90, [{ color: '#29323c', position: 0 }, { color: '#485563', position: 100 }]) },
  { id: 'dark-eclipse', category: 'dark', options: linear(45, [{ color: '#141e30', position: 0 }, { color: '#243b55', position: 100 }]) },
  { id: 'dark-carbon', category: 'dark', options: linear(120, [{ color: '#283048', position: 0 }, { color: '#859398', position: 100 }]) },
  { id: 'dark-noir', category: 'dark', options: linear(160, [{ color: '#000000', position: 0 }, { color: '#434343', position: 100 }]) },
  { id: 'dark-abyss', category: 'dark', options: linear(135, [{ color: '#000428', position: 0 }, { color: '#004e92', position: 100 }]) },
  { id: 'dark-spotlight', category: 'dark', options: radial('ellipse', [{ color: '#3a3a3a', position: 0 }, { color: '#0a0a0a', position: 100 }]) },
  { id: 'dark-obsidian', category: 'dark', options: linear(135, [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 100 }]) },
  { id: 'dark-graphite', category: 'dark', options: linear(90, [{ color: '#373b44', position: 0 }, { color: '#4286f4', position: 100 }]) },
  { id: 'dark-onyx', category: 'dark', options: linear(120, [{ color: '#000000', position: 0 }, { color: '#434343', position: 50 }, { color: '#000000', position: 100 }]) },
  { id: 'dark-storm', category: 'dark', options: linear(160, [{ color: '#20002c', position: 0 }, { color: '#cbb4d4', position: 100 }]) },
  { id: 'dark-ink', category: 'dark', options: linear(45, [{ color: '#141e30', position: 0 }, { color: '#243b55', position: 100 }]) },
  { id: 'dark-vignette', category: 'dark', options: radial('circle', [{ color: '#2c2c2c', position: 0 }, { color: '#000000', position: 100 }]) },
  { id: 'dark-smoke', category: 'dark', options: linear(180, [{ color: '#606c88', position: 0 }, { color: '#3f4c6b', position: 100 }]) },
  { id: 'dark-raven', category: 'dark', options: linear(135, [{ color: '#1e130c', position: 0 }, { color: '#9a8478', position: 100 }]) },
  { id: 'dark-void', category: 'dark', options: linear(90, [{ color: '#000000', position: 0 }, { color: '#1a1a2e', position: 50 }, { color: '#16213e', position: 100 }]) },

  // 浅色系
  { id: 'light-cloud', category: 'light', options: linear(180, [{ color: '#fdfcfb', position: 0 }, { color: '#e2d1c3', position: 100 }]) },
  { id: 'light-pearl', category: 'light', options: linear(135, [{ color: '#ece9e6', position: 0 }, { color: '#ffffff', position: 100 }]) },
  { id: 'light-mist', category: 'light', options: linear(120, [{ color: '#f5f7fa', position: 0 }, { color: '#c3cfe2', position: 100 }]) },
  { id: 'light-cream', category: 'light', options: linear(90, [{ color: '#fff1eb', position: 0 }, { color: '#ace0f9', position: 100 }]) },
  { id: 'light-linen', category: 'light', options: linear(45, [{ color: '#fafafa', position: 0 }, { color: '#e8e8e8', position: 100 }]) },
  { id: 'light-sand', category: 'light', options: linear(160, [{ color: '#f9f6f0', position: 0 }, { color: '#e8dcc8', position: 100 }]) },
  { id: 'light-lavender', category: 'light', options: linear(135, [{ color: '#f3e7e9', position: 0 }, { color: '#e3eeff', position: 100 }]) },
  { id: 'light-glow', category: 'light', options: radial('circle', [{ color: '#ffffff', position: 0 }, { color: '#f0f0f0', position: 100 }]) },
  { id: 'light-ivory', category: 'light', options: linear(135, [{ color: '#fffff0', position: 0 }, { color: '#f5f5dc', position: 100 }]) },
  { id: 'light-snow', category: 'light', options: linear(90, [{ color: '#ffffff', position: 0 }, { color: '#e6e9f0', position: 100 }]) },
  { id: 'light-blush', category: 'light', options: linear(120, [{ color: '#fff5f5', position: 0 }, { color: '#ffe4e6', position: 100 }]) },
  { id: 'light-morning', category: 'light', options: linear(160, [{ color: '#ffecd2', position: 0 }, { color: '#fcb69f', position: 50 }, { color: '#ffffff', position: 100 }]) },
  { id: 'light-silk', category: 'light', options: linear(45, [{ color: '#fdfbfb', position: 0 }, { color: '#ebedee', position: 100 }]) },
  { id: 'light-frost', category: 'light', options: linear(180, [{ color: '#f5f7fa', position: 0 }, { color: '#ffffff', position: 100 }]) },
  { id: 'light-champagne', category: 'light', options: linear(135, [{ color: '#f7f1e3', position: 0 }, { color: '#e8dcc8', position: 100 }]) },
  { id: 'light-dawn', category: 'light', options: radial('ellipse', [{ color: '#ffffff', position: 0 }, { color: '#ffeaa7', position: 100 }]) },
  { id: 'light-powder', category: 'light', options: linear(90, [{ color: '#e0c3fc', position: 0 }, { color: '#8ec5fc', position: 100 }]) },
  { id: 'light-cotton', category: 'light', options: linear(120, [{ color: '#fdfcfb', position: 0 }, { color: '#e2d1c3', position: 100 }]) },

  // 多彩
  { id: 'rainbow-classic', category: 'rainbow', options: linear(90, [
    { color: '#ff0000', position: 0 },
    { color: '#ff7f00', position: 17 },
    { color: '#ffff00', position: 33 },
    { color: '#00ff00', position: 50 },
    { color: '#0000ff', position: 67 },
    { color: '#4b0082', position: 83 },
    { color: '#9400d3', position: 100 },
  ]) },
  { id: 'rainbow-neon', category: 'rainbow', options: linear(135, [{ color: '#fa709a', position: 0 }, { color: '#fee140', position: 50 }, { color: '#30cfd0', position: 100 }]) },
  { id: 'rainbow-candy', category: 'rainbow', options: linear(45, [{ color: '#f83600', position: 0 }, { color: '#f9d423', position: 50 }, { color: '#00f260', position: 100 }]) },
  { id: 'rainbow-aurora', category: 'rainbow', options: linear(120, [{ color: '#00c6ff', position: 0 }, { color: '#0072ff', position: 33 }, { color: '#7b2ff7', position: 66 }, { color: '#f107a3', position: 100 }]) },
  { id: 'rainbow-sunset', category: 'rainbow', options: linear(160, [{ color: '#ff512f', position: 0 }, { color: '#dd2476', position: 50 }, { color: '#7f00ff', position: 100 }]) },
  { id: 'rainbow-pastel', category: 'rainbow', options: linear(90, [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 33 }, { color: '#d299c2', position: 66 }, { color: '#fef9d7', position: 100 }]) },
  { id: 'rainbow-vivid', category: 'rainbow', options: linear(180, [{ color: '#12c2e9', position: 0 }, { color: '#c471ed', position: 50 }, { color: '#f64f59', position: 100 }]) },
  { id: 'rainbow-prism', category: 'rainbow', options: radial('ellipse', [
    { color: '#ff9a9e', position: 0 },
    { color: '#fad0c4', position: 25 },
    { color: '#a18cd1', position: 50 },
    { color: '#fbc2eb', position: 75 },
    { color: '#84fab0', position: 100 },
  ]) },
  { id: 'rainbow-spectrum', category: 'rainbow', options: linear(135, [
    { color: '#ff6b6b', position: 0 },
    { color: '#feca57', position: 20 },
    { color: '#48dbfb', position: 40 },
    { color: '#1dd1a1', position: 60 },
    { color: '#5f27cd', position: 80 },
    { color: '#ff9ff3', position: 100 },
  ]) },
  { id: 'rainbow-holo', category: 'rainbow', options: linear(90, [{ color: '#89f7fe', position: 0 }, { color: '#66a6ff', position: 25 }, { color: '#f093fb', position: 50 }, { color: '#f5576c', position: 75 }, { color: '#4facfe', position: 100 }]) },
  { id: 'rainbow-pop', category: 'rainbow', options: linear(45, [{ color: '#f953c6', position: 0 }, { color: '#b91d73', position: 50 }, { color: '#f7971e', position: 100 }]) },
  { id: 'rainbow-soda', category: 'rainbow', options: linear(120, [{ color: '#00c9ff', position: 0 }, { color: '#92fe9d', position: 50 }, { color: '#ff6a88', position: 100 }]) },
  { id: 'rainbow-tropical', category: 'rainbow', options: linear(160, [{ color: '#f83600', position: 0 }, { color: '#f9d423', position: 33 }, { color: '#00f260', position: 66 }, { color: '#0575e6', position: 100 }]) },
  { id: 'rainbow-laser', category: 'rainbow', options: linear(180, [{ color: '#ff0080', position: 0 }, { color: '#7928ca', position: 50 }, { color: '#00dfd8', position: 100 }]) },
  { id: 'rainbow-universe', category: 'rainbow', options: linear(135, [{ color: '#ee0979', position: 0 }, { color: '#ff6a00', position: 33 }, { color: '#ffd200', position: 66 }, { color: '#00c9ff', position: 100 }]) },
  { id: 'rainbow-dream', category: 'rainbow', options: linear(90, [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 25 }, { color: '#d299c2', position: 50 }, { color: '#fef9d7', position: 75 }, { color: '#84fab0', position: 100 }]) },
  { id: 'rainbow-galaxy', category: 'rainbow', options: radial('ellipse', [{ color: '#667eea', position: 0 }, { color: '#764ba2', position: 33 }, { color: '#f093fb', position: 66 }, { color: '#f5576c', position: 100 }]) },
  { id: 'rainbow-confetti', category: 'rainbow', options: linear(45, [
    { color: '#ff0000', position: 0 },
    { color: '#ff8800', position: 14 },
    { color: '#ffff00', position: 28 },
    { color: '#00ff00', position: 42 },
    { color: '#0088ff', position: 57 },
    { color: '#8800ff', position: 71 },
    { color: '#ff00ff', position: 85 },
    { color: '#ff0088', position: 100 },
  ]) },
  { id: 'rainbow-cyber', category: 'rainbow', options: linear(135, [{ color: '#08aeea', position: 0 }, { color: '#2af598', position: 50 }, { color: '#fe5196', position: 100 }]) },
  { id: 'rainbow-retro', category: 'rainbow', options: linear(120, [{ color: '#fc466b', position: 0 }, { color: '#3f5efb', position: 100 }]) },
  { id: 'rainbow-synth', category: 'rainbow', options: linear(160, [{ color: '#ff6fd8', position: 0 }, { color: '#3813c2', position: 100 }]) },
  { id: 'rainbow-cotton', category: 'rainbow', options: radial('circle', [
    { color: '#ff9a9e', position: 0 },
    { color: '#fecfef', position: 25 },
    { color: '#a1c4fd', position: 50 },
    { color: '#c2e9fb', position: 75 },
    { color: '#84fab0', position: 100 },
  ]) },
  { id: 'rainbow-electric', category: 'rainbow', options: linear(90, [{ color: '#00f5a0', position: 0 }, { color: '#00d9f5', position: 50 }, { color: '#b721ff', position: 100 }]) },
  { id: 'rainbow-sunrise', category: 'rainbow', options: linear(180, [{ color: '#ff512f', position: 0 }, { color: '#f09819', position: 33 }, { color: '#38ef7d', position: 66 }, { color: '#11998e', position: 100 }]) },

  // 日落
  { id: 'sunset-dusk', category: 'sunset', options: linear(135, [{ color: '#2b32b2', position: 0 }, { color: '#1488cc', position: 50 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-horizon', category: 'sunset', options: linear(180, [{ color: '#ff7e5f', position: 0 }, { color: '#feb47b', position: 100 }]) },
  { id: 'sunset-glow', category: 'sunset', options: linear(90, [{ color: '#ff512f', position: 0 }, { color: '#dd2476', position: 100 }]) },
  { id: 'sunset-beach', category: 'sunset', options: linear(120, [{ color: '#f3904f', position: 0 }, { color: '#3b4371', position: 100 }]) },
  { id: 'sunset-desert', category: 'sunset', options: linear(45, [{ color: '#c94b4b', position: 0 }, { color: '#4b134f', position: 100 }]) },
  { id: 'sunset-evening', category: 'sunset', options: linear(160, [{ color: '#355c7d', position: 0 }, { color: '#6c5b7b', position: 50 }, { color: '#c06c84', position: 100 }]) },
  { id: 'sunset-fire', category: 'sunset', options: linear(135, [{ color: '#f83600', position: 0 }, { color: '#fe8c00', position: 100 }]) },
  { id: 'sunset-radial', category: 'sunset', options: radial('ellipse', [{ color: '#ffecd2', position: 0 }, { color: '#fcb69f', position: 60 }, { color: '#ff8177', position: 100 }]) },
  { id: 'sunset-amber', category: 'sunset', options: linear(135, [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 50 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-crimson', category: 'sunset', options: linear(90, [{ color: '#eb3349', position: 0 }, { color: '#f45c43', position: 100 }]) },
  { id: 'sunset-twilight', category: 'sunset', options: linear(120, [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-mango', category: 'sunset', options: linear(160, [{ color: '#ffe259', position: 0 }, { color: '#ffa751', position: 50 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-ember', category: 'sunset', options: linear(45, [{ color: '#ff416c', position: 0 }, { color: '#ff4b2b', position: 100 }]) },
  { id: 'sunset-sky', category: 'sunset', options: linear(180, [{ color: '#2980b9', position: 0 }, { color: '#6dd5fa', position: 50 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-sahara', category: 'sunset', options: linear(135, [{ color: '#c94b4b', position: 0 }, { color: '#4b134f', position: 100 }]) },
  { id: 'sunset-golden', category: 'sunset', options: linear(90, [{ color: '#f9d423', position: 0 }, { color: '#ff4e50', position: 100 }]) },
  { id: 'sunset-coast', category: 'sunset', options: linear(120, [{ color: '#ff7e5f', position: 0 }, { color: '#feb47b', position: 50 }, { color: '#86a8e7', position: 100 }]) },
  { id: 'sunset-violet', category: 'sunset', options: linear(160, [{ color: '#ff512f', position: 0 }, { color: '#dd2476', position: 50 }, { color: '#7b2ff7', position: 100 }]) },
  { id: 'sunset-radial-glow', category: 'sunset', options: radial('circle', [{ color: '#fff1eb', position: 0 }, { color: '#ff9a56', position: 60 }, { color: '#ff512f', position: 100 }]) },
  { id: 'sunset-lake', category: 'sunset', options: linear(45, [{ color: '#355c7d', position: 0 }, { color: '#6c5b7b', position: 50 }, { color: '#c06c84', position: 100 }]) },

  // 海洋
  { id: 'ocean-deep', category: 'ocean', options: linear(180, [{ color: '#2e3192', position: 0 }, { color: '#1bffff', position: 100 }]) },
  { id: 'ocean-wave', category: 'ocean', options: linear(135, [{ color: '#2193b0', position: 0 }, { color: '#6dd5ed', position: 100 }]) },
  { id: 'ocean-lagoon', category: 'ocean', options: linear(90, [{ color: '#43cea2', position: 0 }, { color: '#185a9d', position: 100 }]) },
  { id: 'ocean-reef', category: 'ocean', options: linear(120, [{ color: '#1d976c', position: 0 }, { color: '#93f9b9', position: 100 }]) },
  { id: 'ocean-abyss', category: 'ocean', options: linear(45, [{ color: '#000046', position: 0 }, { color: '#1cb5e0', position: 100 }]) },
  { id: 'ocean-tide', category: 'ocean', options: linear(160, [{ color: '#4ca1af', position: 0 }, { color: '#c4e0e5', position: 100 }]) },
  { id: 'ocean-coral', category: 'ocean', options: linear(135, [{ color: '#00b4db', position: 0 }, { color: '#0083b0', position: 100 }]) },
  { id: 'ocean-bubble', category: 'ocean', options: radial('circle', [{ color: '#89f7fe', position: 0 }, { color: '#66a6ff', position: 100 }]) },
  { id: 'ocean-marine', category: 'ocean', options: linear(135, [{ color: '#1a2980', position: 0 }, { color: '#26d0ce', position: 100 }]) },
  { id: 'ocean-aqua', category: 'ocean', options: linear(90, [{ color: '#13547a', position: 0 }, { color: '#80d0c7', position: 100 }]) },
  { id: 'ocean-storm', category: 'ocean', options: linear(120, [{ color: '#373b44', position: 0 }, { color: '#4286f4', position: 100 }]) },
  { id: 'ocean-seafoam', category: 'ocean', options: linear(160, [{ color: '#a8edea', position: 0 }, { color: '#fed6e3', position: 100 }]) },
  { id: 'ocean-caribbean', category: 'ocean', options: linear(45, [{ color: '#00c6ff', position: 0 }, { color: '#0072ff', position: 100 }]) },
  { id: 'ocean-pacific', category: 'ocean', options: linear(180, [{ color: '#2c3e50', position: 0 }, { color: '#3498db', position: 100 }]) },
  { id: 'ocean-arctic', category: 'ocean', options: linear(135, [{ color: '#e0eafc', position: 0 }, { color: '#cfdef3', position: 50 }, { color: '#2193b0', position: 100 }]) },
  { id: 'ocean-turquoise', category: 'ocean', options: linear(90, [{ color: '#136a8a', position: 0 }, { color: '#267871', position: 100 }]) },
  { id: 'ocean-depth', category: 'ocean', options: radial('ellipse', [{ color: '#1cb5e0', position: 0 }, { color: '#000046', position: 100 }]) },
  { id: 'ocean-surf', category: 'ocean', options: linear(120, [{ color: '#00d2ff', position: 0 }, { color: '#3a7bd5', position: 100 }]) },
  { id: 'ocean-kelp', category: 'ocean', options: linear(160, [{ color: '#11998e', position: 0 }, { color: '#38ef7d', position: 50 }, { color: '#2193b0', position: 100 }]) },
  { id: 'ocean-mist', category: 'ocean', options: linear(45, [{ color: '#4ca1af', position: 0 }, { color: '#c4e0e5', position: 100 }]) },
  { id: 'ocean-pearl', category: 'ocean', options: radial('circle', [{ color: '#e0f7fa', position: 0 }, { color: '#00acc1', position: 100 }]) },
];

export function isGradientPresetCategoryId(v: string): v is GradientPresetCategoryId {
  return GRADIENT_PRESET_CATEGORY_IDS.includes(v as GradientPresetCategoryId);
}

export function getPresetsByCategory(category: GradientPresetCategoryId): GradientPreset[] {
  return GRADIENT_PRESETS.filter((p) => p.category === category);
}

/** 深拷贝预设，避免共享 stops 引用 */
export function cloneGradientOptions(options: GradientOptions): GradientOptions {
  return {
    ...options,
    stops: options.stops.map((s) => ({ ...s })),
  };
}

export function presetToOptions(preset: GradientPreset): GradientOptions {
  return cloneGradientOptions(preset.options);
}
