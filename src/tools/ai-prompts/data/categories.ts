import type { PromptCategoryMeta } from '../types';

/**
 * 提示词分类清单（28 类）。
 *
 * - `id` 同时作为该类提示词 id 的前缀，新增分类后需同步在 `./prompts/<id>.ts` 建数据文件；
 * - `name` 缺失的语种会回退到 i18n 既有译文（`tools.aiPrompts.cat.<id>`），再回退到 `en`；
 * - 详见 `./README.md`。
 */
export const PROMPT_CATEGORIES = [
  {
    id: 'writing',
    order: 1,
    name: { zh: '写作创作', en: 'Writing' },
    i18nKey: 'tools.aiPrompts.cat.writing',
  },
  {
    id: 'coding',
    order: 2,
    name: { zh: '编程开发', en: 'Coding' },
    i18nKey: 'tools.aiPrompts.cat.coding',
  },
  {
    id: 'translate',
    order: 3,
    name: { zh: '翻译与本地化', en: 'Translation' },
    i18nKey: 'tools.aiPrompts.cat.translate',
  },
  {
    id: 'marketing',
    order: 4,
    name: { zh: '市场营销', en: 'Marketing' },
    i18nKey: 'tools.aiPrompts.cat.marketing',
  },
  {
    id: 'learning',
    order: 5,
    name: { zh: '学习成长', en: 'Learning' },
    i18nKey: 'tools.aiPrompts.cat.learning',
  },
  {
    id: 'career',
    order: 6,
    name: { zh: '职场求职', en: 'Career' },
    i18nKey: 'tools.aiPrompts.cat.career',
  },
  {
    id: 'business',
    order: 7,
    name: { zh: '商业与战略', en: 'Business & Strategy' },
    i18nKey: 'tools.aiPrompts.cat.business',
  },
  {
    id: 'sales',
    order: 8,
    name: { zh: '销售与商务拓展', en: 'Sales & Business Development' },
    i18nKey: 'tools.aiPrompts.cat.sales',
  },
  {
    id: 'customer',
    order: 9,
    name: { zh: '客户服务', en: 'Customer Support' },
    i18nKey: 'tools.aiPrompts.cat.customer',
  },
  {
    id: 'product',
    order: 10,
    name: { zh: '产品管理', en: 'Product Management' },
    i18nKey: 'tools.aiPrompts.cat.product',
  },
  {
    id: 'operations',
    order: 11,
    name: { zh: '运营与增长', en: 'Operations & Growth' },
    i18nKey: 'tools.aiPrompts.cat.operations',
  },
  {
    id: 'design',
    order: 12,
    name: { zh: '设计与创意', en: 'Design & Creative' },
    i18nKey: 'tools.aiPrompts.cat.design',
  },
  {
    id: 'image',
    order: 13,
    name: { zh: '图像与绘画提示词', en: 'Image & Art Prompts' },
    i18nKey: 'tools.aiPrompts.cat.image',
  },
  {
    id: 'video',
    order: 14,
    name: { zh: '视频与音频脚本', en: 'Video & Audio Scripts' },
    i18nKey: 'tools.aiPrompts.cat.video',
  },
  {
    id: 'social',
    order: 15,
    name: { zh: '社交媒体', en: 'Social Media' },
    i18nKey: 'tools.aiPrompts.cat.social',
  },
  {
    id: 'email',
    order: 16,
    name: { zh: '邮件与沟通', en: 'Email & Communication' },
    i18nKey: 'tools.aiPrompts.cat.email',
  },
  {
    id: 'productivity',
    order: 17,
    name: { zh: '效率与办公', en: 'Productivity' },
    i18nKey: 'tools.aiPrompts.cat.productivity',
  },
  {
    id: 'education',
    order: 18,
    name: { zh: '教学与培训', en: 'Teaching & Training' },
    i18nKey: 'tools.aiPrompts.cat.education',
  },
  {
    id: 'research',
    order: 19,
    name: { zh: '学术与研究', en: 'Academic Research' },
    i18nKey: 'tools.aiPrompts.cat.research',
  },
  {
    id: 'data',
    order: 20,
    name: { zh: '数据分析', en: 'Data Analysis' },
    i18nKey: 'tools.aiPrompts.cat.data',
  },
  {
    id: 'finance',
    order: 21,
    name: { zh: '财务与金融', en: 'Finance' },
    i18nKey: 'tools.aiPrompts.cat.finance',
  },
  {
    id: 'legal',
    order: 22,
    name: { zh: '法律与合规', en: 'Legal & Compliance' },
    i18nKey: 'tools.aiPrompts.cat.legal',
  },
  {
    id: 'health',
    order: 23,
    name: { zh: '健康与生活', en: 'Health & Lifestyle' },
    i18nKey: 'tools.aiPrompts.cat.health',
  },
  {
    id: 'thinking',
    order: 24,
    name: { zh: '思维与决策', en: 'Thinking & Decisions' },
    i18nKey: 'tools.aiPrompts.cat.thinking',
  },
  {
    id: 'summarize',
    order: 25,
    name: { zh: '摘要与提炼', en: 'Summarization' },
    i18nKey: 'tools.aiPrompts.cat.summarize',
  },
  {
    id: 'review',
    order: 26,
    name: { zh: '评审与反馈', en: 'Review & Feedback' },
    i18nKey: 'tools.aiPrompts.cat.review',
  },
  {
    id: 'roleplay',
    order: 27,
    name: { zh: '角色扮演与人格设定', en: 'Roleplay & Persona' },
    i18nKey: 'tools.aiPrompts.cat.roleplay',
  },
  {
    id: 'meta',
    order: 28,
    name: { zh: '提示词工程', en: 'Prompt Engineering' },
    i18nKey: 'tools.aiPrompts.cat.meta',
  },
] as const satisfies readonly PromptCategoryMeta[];

/** 分类 id 联合类型 */
export type PromptCategoryId = (typeof PROMPT_CATEGORIES)[number]['id'];
