import { createId } from './factory';
import type { SlideElement, SlideLayout, SlideMaster, SlideTheme, TextBody } from './types';

/**
 * 本地模板库：纯数据、无联网、无外部资源。
 *
 * 每套模板 = 一套主题（12 色 + 中西文主副字体）+ 一个母版 + 若干版式。
 * 实例化时复用 `SlideMaster` / `SlideLayout` 既有结构，与手工创建的文档完全一致，
 * 因此能走同一条导出链路（母版/版式现在会被写回 pptx）。
 */

export interface SlideTemplate {
  id: string;
  /** i18n 键后缀：tools.slide.tpl<Name> */
  nameKey: string;
  /** 画廊分组：商务 / 科技 / 学术 / 教育 / 简约 / 创意 */
  category: string;
  theme: SlideTheme;
  /** 母版公共元素（Logo / 页码等） */
  masterElements: SlideElement[];
  layouts: { name: string; key: string; elements: SlideElement[] }[];
}

/** 页面基准尺寸（与 createDoc 默认一致） */
const W = 1280;
const H = 720;

function body(
  text: string,
  size: number,
  color: string,
  options: { bold?: boolean; align?: 'left' | 'center'; italic?: boolean } = {},
): TextBody {
  return {
    paragraphs: [
      {
        runs: [{ text, style: { size, color, bold: options.bold, italic: options.italic } }],
        align: options.align ?? 'left',
      },
    ],
    anchor: 'top',
    wrap: true,
    autoFit: 'none',
    margins: { left: 8, top: 6, right: 8, bottom: 6 },
  };
}

function textBox(
  x: number,
  y: number,
  width: number,
  height: number,
  content: TextBody,
): SlideElement {
  return { id: createId('el'), type: 'text', x, y, width, height, body: content };
}

/** 通用六版式：标题页 / 标题+内容 / 两栏 / 章节 / 引用 / 空白 */
function standardLayouts(tx: string, txSoft: string): SlideTemplate['layouts'] {
  return [
    {
      key: 'title',
      name: 'Title Slide',
      elements: [
        textBox(96, 232, W - 192, 128, body('标题', 44, tx, { bold: true })),
        textBox(96, 372, W - 192, 80, body('副标题', 20, txSoft)),
      ],
    },
    {
      key: 'titleContent',
      name: 'Title and Content',
      elements: [
        textBox(80, 56, W - 160, 88, body('标题', 34, tx, { bold: true })),
        textBox(80, 172, W - 160, 448, body('内容', 20, txSoft)),
      ],
    },
    {
      key: 'twoColumn',
      name: 'Two Content',
      elements: [
        textBox(80, 56, W - 160, 88, body('标题', 34, tx, { bold: true })),
        textBox(80, 172, (W - 200) / 2, 448, body('左栏', 20, txSoft)),
        textBox(W / 2 + 20, 172, (W - 200) / 2, 448, body('右栏', 20, txSoft)),
      ],
    },
    {
      key: 'section',
      name: 'Section Header',
      elements: [
        textBox(
          160,
          Math.round(H / 2 - 72),
          W - 320,
          144,
          body('章节标题', 40, tx, { bold: true }),
        ),
      ],
    },
    {
      key: 'quote',
      name: 'Quote',
      elements: [
        textBox(160, Math.round(H / 3), W - 320, 256, body('引用一句话', 28, tx, { italic: true })),
      ],
    },
    { key: 'blank', name: 'Blank', elements: [] },
  ];
}

function theme(
  name: string,
  colors: Record<string, string>,
  major: string,
  minor: string,
): SlideTheme {
  return {
    name,
    colors,
    majorFont: { latin: major, ea: major, cs: major },
    minorFont: { latin: minor, ea: minor, cs: minor },
  };
}

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: 'business-blue',
    nameKey: 'BusinessBlue',
    category: '商务',
    theme: theme(
      'Business Blue',
      {
        dk1: '#0F172A',
        lt1: '#FFFFFF',
        dk2: '#44546A',
        lt2: '#E7E6E6',
        accent1: '#4472C4',
        accent2: '#2E75B6',
        accent3: '#A5A5A5',
        accent4: '#FFC000',
        accent5: '#5B9BD5',
        accent6: '#70AD47',
        hlink: '#0563C1',
        folHlink: '#954F72',
        phClr: '#000000',
      },
      'Arial',
      'Arial',
    ),
    masterElements: [],
    layouts: standardLayouts('#0F172A', '#44546A'),
  },
  {
    id: 'graphite',
    nameKey: 'Graphite',
    category: '简约',
    theme: theme(
      'Graphite',
      {
        dk1: '#1C1C1C',
        lt1: '#FFFFFF',
        dk2: '#404040',
        lt2: '#F2F2F2',
        accent1: '#36454F',
        accent2: '#5B6770',
        accent3: '#8A949E',
        accent4: '#C9A227',
        accent5: '#7C8A97',
        accent6: '#2F4F4F',
        hlink: '#2E6DA4',
        folHlink: '#6E4A7E',
        phClr: '#000000',
      },
      'Helvetica',
      'Helvetica',
    ),
    masterElements: [],
    layouts: standardLayouts('#1C1C1C', '#404040'),
  },
  {
    id: 'forest',
    nameKey: 'Forest',
    category: '简约',
    theme: theme(
      'Forest & Moss',
      {
        dk1: '#17301C',
        lt1: '#FFFFFF',
        dk2: '#3C5A41',
        lt2: '#E8EFE6',
        accent1: '#2C5F2D',
        accent2: '#97BC62',
        accent3: '#6B8E5A',
        accent4: '#C9A227',
        accent5: '#4F7942',
        accent6: '#8FA37E',
        hlink: '#1F6B3A',
        folHlink: '#6E4A2E',
        phClr: '#000000',
      },
      'Georgia',
      'Verdana',
    ),
    masterElements: [],
    layouts: standardLayouts('#17301C', '#3C5A41'),
  },
  {
    id: 'warm-sand',
    nameKey: 'WarmSand',
    category: '创意',
    theme: theme(
      'Warm Terracotta',
      {
        dk1: '#3B2A22',
        lt1: '#FFFFFF',
        dk2: '#6B5449',
        lt2: '#F5EFE6',
        accent1: '#B85042',
        accent2: '#E7E8D1',
        accent3: '#A7BEAE',
        accent4: '#D9A05B',
        accent5: '#8C6A54',
        accent6: '#7A8B6F',
        hlink: '#9C3B2E',
        folHlink: '#6E4A2E',
        phClr: '#000000',
      },
      'Georgia',
      'Tahoma',
    ),
    masterElements: [],
    layouts: standardLayouts('#3B2A22', '#6B5449'),
  },
  {
    id: 'deep-indigo',
    nameKey: 'DeepIndigo',
    category: '商务',
    theme: theme(
      'Midnight Executive',
      {
        dk1: '#0B1020',
        lt1: '#FFFFFF',
        dk2: '#1E2761',
        lt2: '#CADCFC',
        accent1: '#1E2761',
        accent2: '#3B4C8C',
        accent3: '#6D7CC1',
        accent4: '#F2C14E',
        accent5: '#2B3A67',
        accent6: '#4E5D8A',
        hlink: '#3B6FD4',
        folHlink: '#8E5AA8',
        phClr: '#000000',
      },
      'Arial',
      'Arial',
    ),
    masterElements: [],
    layouts: standardLayouts('#0B1020', '#1E2761'),
  },
  {
    id: 'cherry',
    nameKey: 'Cherry',
    category: '创意',
    theme: theme(
      'Cherry Bold',
      {
        dk1: '#2B0E14',
        lt1: '#FFFFFF',
        dk2: '#5C2A34',
        lt2: '#FCF6F5',
        accent1: '#990011',
        accent2: '#2F3C7E',
        accent3: '#B76E79',
        accent4: '#E0A96D',
        accent5: '#7A2635',
        accent6: '#4A4E69',
        hlink: '#B32437',
        folHlink: '#6E4A7E',
        phClr: '#000000',
      },
      'Helvetica',
      'Helvetica',
    ),
    masterElements: [],
    layouts: standardLayouts('#2B0E14', '#5C2A34'),
  },

  /* ── 第二批：中文商务 / 学术 / 科技 / 教育 / 极简 / 创意 ── */
  {
    id: 'teal-trust',
    nameKey: 'TealTrust',
    category: '商务',
    theme: theme(
      'Teal Trust',
      {
        dk1: '#03303A',
        lt1: '#FFFFFF',
        dk2: '#0B5563',
        lt2: '#E6F4F1',
        accent1: '#028090',
        accent2: '#00A896',
        accent3: '#02C39A',
        accent4: '#F0B429',
        accent5: '#05668D',
        accent6: '#5FA8A0',
        hlink: '#00708A',
        folHlink: '#7A4E8C',
        phClr: '#000000',
      },
      'Arial',
      'Arial',
    ),
    masterElements: [],
    layouts: standardLayouts('#03303A', '#0B5563'),
  },
  {
    id: 'academic-navy',
    nameKey: 'AcademicNavy',
    category: '学术',
    theme: theme(
      'Academic Navy',
      {
        dk1: '#101C3D',
        lt1: '#FFFFFF',
        dk2: '#33406B',
        lt2: '#EEF1F8',
        accent1: '#21386E',
        accent2: '#4A6FA5',
        accent3: '#8FA6C8',
        accent4: '#B08D3F',
        accent5: '#2C4B7C',
        accent6: '#6B7A99',
        hlink: '#2F5CA8',
        folHlink: '#7B5290',
        phClr: '#000000',
      },
      'Times New Roman',
      'Georgia',
    ),
    masterElements: [],
    layouts: standardLayouts('#101C3D', '#33406B'),
  },
  {
    id: 'tech-gradient',
    nameKey: 'TechGradient',
    category: '科技',
    theme: theme(
      'Tech Gradient',
      {
        dk1: '#050B1F',
        lt1: '#FFFFFF',
        dk2: '#1C7293',
        lt2: '#E3F0F6',
        accent1: '#065A82',
        accent2: '#1C7293',
        accent3: '#4FA3C7',
        accent4: '#00E5C0',
        accent5: '#21295C',
        accent6: '#7ED3E8',
        hlink: '#1C9BD4',
        folHlink: '#8E6BD8',
        phClr: '#000000',
      },
      'Consolas',
      'Arial',
    ),
    masterElements: [],
    layouts: standardLayouts('#050B1F', '#1C7293'),
  },
  {
    id: 'education-coral',
    nameKey: 'EducationCoral',
    category: '教育',
    theme: theme(
      'Education Coral',
      {
        dk1: '#2F3C7E',
        lt1: '#FFFFFF',
        dk2: '#5A6699',
        lt2: '#FDF3E7',
        accent1: '#F96167',
        accent2: '#F9E795',
        accent3: '#2F3C7E',
        accent4: '#3FA796',
        accent5: '#E8845F',
        accent6: '#7E8CC4',
        hlink: '#E0555B',
        folHlink: '#8A5AA8',
        phClr: '#000000',
      },
      'Verdana',
      'Verdana',
    ),
    masterElements: [],
    layouts: standardLayouts('#2F3C7E', '#5A6699'),
  },
  {
    id: 'minimal-charcoal',
    nameKey: 'MinimalCharcoal',
    category: '简约',
    theme: theme(
      'Charcoal Minimal',
      {
        dk1: '#212121',
        lt1: '#FFFFFF',
        dk2: '#36454F',
        lt2: '#F2F2F2',
        accent1: '#36454F',
        accent2: '#7A8A94',
        accent3: '#B0BEC5',
        accent4: '#D97706',
        accent5: '#546E7A',
        accent6: '#9AA5AB',
        hlink: '#3273A8',
        folHlink: '#7B5290',
        phClr: '#000000',
      },
      'Helvetica',
      'Helvetica',
    ),
    masterElements: [],
    layouts: standardLayouts('#212121', '#36454F'),
  },
  {
    id: 'sage-calm',
    nameKey: 'SageCalm',
    category: '简约',
    theme: theme(
      'Sage Calm',
      {
        dk1: '#27403A',
        lt1: '#FFFFFF',
        dk2: '#50808E',
        lt2: '#EFF5F2',
        accent1: '#84B59F',
        accent2: '#69A297',
        accent3: '#50808E',
        accent4: '#C4A35A',
        accent5: '#3F6E63',
        accent6: '#A3C4B8',
        hlink: '#3E7C93',
        folHlink: '#7A6AA8',
        phClr: '#000000',
      },
      'Georgia',
      'Georgia',
    ),
    masterElements: [],
    layouts: standardLayouts('#27403A', '#50808E'),
  },
  {
    id: 'berry-cream',
    nameKey: 'BerryCream',
    category: '创意',
    theme: theme(
      'Berry & Cream',
      {
        dk1: '#3B1729',
        lt1: '#FFFFFF',
        dk2: '#6D2E46',
        lt2: '#F6EEE4',
        accent1: '#6D2E46',
        accent2: '#A26769',
        accent3: '#ECE2D0',
        accent4: '#C9A227',
        accent5: '#8C4A5E',
        accent6: '#BFA6A0',
        hlink: '#A03A62',
        folHlink: '#6E4A8E',
        phClr: '#000000',
      },
      'Georgia',
      'Trebuchet MS',
    ),
    masterElements: [],
    layouts: standardLayouts('#3B1729', '#6D2E46'),
  },
];

/** 画廊分组（顺序即展示顺序，取模板中实际出现过的分类去重） */
export const TEMPLATE_CATEGORIES: string[] = Array.from(
  new Set(SLIDE_TEMPLATES.map((template) => template.category)),
);

/** 画廊卡片的配色预览（取主题里最能代表风格的四色） */
export function templateSwatch(template: SlideTemplate): string[] {
  const { colors } = template.theme;
  return ['accent1', 'accent2', 'accent3', 'accent4']
    .map((key) => colors[key])
    .filter((value): value is string => Boolean(value));
}

export function findTemplate(id: string): SlideTemplate | undefined {
  return SLIDE_TEMPLATES.find((template) => template.id === id);
}

/** 模板 → 可写入 doc 的母版/版式（id 全部新建，避免与既有文档冲突） */
export function instantiateTemplate(template: SlideTemplate): {
  theme: SlideTheme;
  masters: SlideMaster[];
  layouts: SlideLayout[];
} {
  const master: SlideMaster = {
    id: createId('master'),
    name: template.theme.name,
    elements: template.masterElements,
  };
  const layouts: SlideLayout[] = template.layouts.map((layout) => ({
    id: createId('layout'),
    masterId: master.id,
    name: layout.name,
    elements: layout.elements,
  }));
  return {
    theme: { ...template.theme, colors: { ...template.theme.colors } },
    masters: [master],
    layouts,
  };
}
