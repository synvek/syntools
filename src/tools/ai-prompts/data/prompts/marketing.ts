import type { PromptItem } from '../../types';

/** 市场营销类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'marketing-slogan-ideas',
    category: 'marketing',
    title: { zh: '广告语生成', en: 'Slogan ideas' },
    prompt: {
      zh: '为产品「{{product}}」生成 8 条中英文广告语，风格多样（简洁 / 情感 / 利益点），各附一句使用场景。',
      en: 'Generate 8 bilingual slogans for "{{product}}" in varied styles (short / emotional / benefit-led), each with a use case.',
    },
  },
  {
    id: 'marketing-landing-copy',
    category: 'marketing',
    title: { zh: '落地页文案', en: 'Landing copy' },
    prompt: {
      zh: '为「{{product}}」写落地页文案：主标题、副标题、3 个卖点、社会证明占位、CTA。目标用户：{{audience}}。',
      en: 'Write landing-page copy for "{{product}}": headline, subhead, 3 benefits, social-proof placeholder, CTA. Audience: {{audience}}.',
    },
  },
  {
    id: 'marketing-email',
    category: 'marketing',
    title: { zh: '营销邮件', en: 'Marketing email' },
    prompt: {
      zh: '写一封营销邮件：主题行（3 个备选）+ 正文（痛点→方案→CTA），产品：{{product}}，语气友好专业。',
      en: 'Write a marketing email: 3 subject options + body (pain → solution → CTA) for {{product}}. Friendly and professional.',
    },
  },
  {
    id: 'marketing-audience-persona',
    category: 'marketing',
    title: { zh: '受众画像', en: 'Audience personas' },
    prompt: {
      zh: '为「{{product}}」刻画 3 个目标受众画像：人口特征、核心痛点、购买动机、信息获取渠道、常见异议。请用表格输出，并在最后指出最该优先投入的画像及理由。',
      en: 'Build 3 audience personas for "{{product}}": demographics, core pain points, buying motivation, information channels, and common objections. Output as a table, then state which persona deserves priority and why.',
    },
  },
  {
    id: 'marketing-competitor-compare',
    category: 'marketing',
    title: { zh: '竞品对比', en: 'Competitor comparison' },
    prompt: {
      zh: '对比「{{product}}」与竞品「{{competitor}}」，从定位、核心功能、价格、渠道、用户口碑五个维度做表格对比，并给出 3 条差异化打法建议。',
      en: 'Compare "{{product}}" with the competitor "{{competitor}}" across positioning, core features, pricing, channels, and user reviews in a table, then give 3 differentiation moves.',
    },
  },
  {
    id: 'marketing-campaign-plan',
    category: 'marketing',
    title: { zh: '活动方案', en: 'Campaign plan' },
    prompt: {
      zh: '为「{{product}}」策划一次以「{{goal}}」为目标的营销活动：活动主题、目标人群、核心创意、渠道组合、内容排期、预算分配比例与衡量指标，并注明每个环节的负责角色。',
      en: 'Plan a marketing campaign for "{{product}}" with the goal "{{goal}}": theme, target audience, core creative, channel mix, content schedule, budget split, and success metrics. Note the owner role for each part.',
    },
  },
  {
    id: 'marketing-ad-variants',
    category: 'marketing',
    title: { zh: '广告投放变体', en: 'Ad variants' },
    prompt: {
      zh: '为「{{product}}」写 6 组信息流广告素材（每组：1 句主标题 + 1 句描述 + 1 个行动号召），分别主打价格、效率、社交证明、痛点、新奇、售后安心。',
      en: 'Write 6 feed-ad variants for "{{product}}" (each: 1 headline + 1 description + 1 CTA), each leaning on a different angle: price, efficiency, social proof, pain point, novelty, and after-sales reassurance.',
    },
  },
  {
    id: 'marketing-seo-keywords',
    category: 'marketing',
    title: { zh: 'SEO 关键词规划', en: 'SEO keyword plan' },
    prompt: {
      zh: '围绕「{{topic}}」做关键词规划：按搜索意图分组（信息型 / 导航型 / 交易型），每组给出 5-8 个关键词、预估竞争度与建议的落地页类型。',
      en: 'Plan keywords around "{{topic}}": group by search intent (informational / navigational / transactional), give 5–8 keywords per group with estimated difficulty and the recommended landing page type.',
    },
  },
  {
    id: 'marketing-press-release',
    category: 'marketing',
    title: { zh: '新闻稿', en: 'Press release' },
    prompt: {
      zh: '为「{{event}}」写一篇新闻稿：标题、导语（覆盖 5W1H）、2-3 段正文、一段公司介绍、联系信息占位。语言客观，避免营销形容词。',
      en: 'Write a press release for "{{event}}": headline, lead covering 5W1H, 2–3 body paragraphs, a company boilerplate, and a contact placeholder. Keep the language factual and avoid marketing adjectives.',
    },
  },
  {
    id: 'marketing-value-proposition',
    category: 'marketing',
    title: { zh: '价值主张', en: 'Value proposition' },
    prompt: {
      zh: '为「{{product}}」提炼价值主张：一句话定位、3 个支撑论据、目标用户「现状 vs 使用后」的对比。请给出 3 个不同角度的版本。',
      en: 'Craft a value proposition for "{{product}}": a one-line positioning statement, 3 supporting proof points, and a before/after contrast for the target user. Provide 3 versions from different angles.',
    },
  },
  {
    id: 'marketing-pricing-page',
    category: 'marketing',
    title: { zh: '定价页文案', en: 'Pricing page copy' },
    prompt: {
      zh: '为「{{product}}」写定价页文案：3 个套餐的名称与一句话定位、每个套餐 5 条功能点、推荐套餐标注、5 条常见问题。请说明各套餐如何引导升级。',
      en: 'Write pricing-page copy for "{{product}}": 3 plan names with one-line positioning, 5 feature bullets each, a recommended plan, and 5 FAQs. Explain how each tier nudges an upgrade.',
    },
  },
  {
    id: 'marketing-brand-voice',
    category: 'marketing',
    title: { zh: '品牌语气指南', en: 'Brand voice guide' },
    prompt: {
      zh: '为「{{brand}}」制定品牌语气指南：3 个语气关键词、每个关键词的「要 / 不要」示例句、不同渠道（官网 / 社媒 / 客服）的语气差异，以及 5 个禁用词。',
      en: 'Define a brand voice guide for "{{brand}}": 3 tone attributes with do/don\'t example sentences, tone differences per channel (website / social / support), and 5 banned words.',
    },
  },
];
