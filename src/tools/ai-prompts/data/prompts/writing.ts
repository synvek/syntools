import type { PromptItem } from '../../types';

/** 写作创作类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'writing-blog-outline',
    category: 'writing',
    title: { zh: '博客大纲', en: 'Blog outline' },
    prompt: {
      zh: '请围绕主题「{{topic}}」写一篇面向普通读者的博客大纲，包含引言、3-5 个小节与结尾行动建议，语气清晰友好。',
      en: 'Create a blog outline on "{{topic}}" for general readers: intro, 3–5 sections, and a closing call-to-action. Clear and friendly tone.',
    },
  },
  {
    id: 'writing-polish-rewrite',
    category: 'writing',
    title: { zh: '润色改写', en: 'Polish rewrite' },
    prompt: {
      zh: '请润色以下文本，保持原意，提升流畅度与专业感，并给出改写后的全文：\n\n{{text}}',
      en: 'Polish the text below while preserving meaning. Improve flow and professionalism, then return the full rewrite:\n\n{{text}}',
    },
  },
  {
    id: 'writing-key-summary',
    category: 'writing',
    title: { zh: '要点摘要', en: 'Key summary' },
    prompt: {
      zh: '用不超过 5 条要点摘要以下内容，并标注最关键结论：\n\n{{text}}',
      en: 'Summarize the following in at most 5 bullet points and highlight the key conclusion:\n\n{{text}}',
    },
  },
  {
    id: 'writing-long-form-structure',
    category: 'writing',
    title: { zh: '长文结构设计', en: 'Long-form structure' },
    prompt: {
      zh: '为「{{topic}}」设计一篇约 {{wordCount}} 字长文的结构：开篇钩子、3 个核心论点及支撑材料、段落过渡、结尾升华。请说明每部分的作用与字数分配。',
      en: 'Design the structure of a {{wordCount}}-word article on "{{topic}}": a hook, 3 core arguments with supporting material, transitions, and a closing. Explain the role and word budget of each part.',
    },
  },
  {
    id: 'writing-tone-shift',
    category: 'writing',
    title: { zh: '语气调整', en: 'Tone shift' },
    prompt: {
      zh: '把下面这段文本改写成「{{tone}}」的语气，信息量保持不变，句子长度与用词随之调整：\n\n{{text}}',
      en: 'Rewrite the text below in a "{{tone}}" tone. Keep the information intact and adjust sentence length and word choice accordingly:\n\n{{text}}',
    },
  },
  {
    id: 'writing-headline-options',
    category: 'writing',
    title: { zh: '标题备选', en: 'Headline options' },
    prompt: {
      zh: '为下面这篇文章生成 10 个标题备选：3 个信息直给型、4 个悬念型、3 个数字清单型。每个不超过 20 字，并标注最适合的发布渠道。\n\n{{text}}',
      en: 'Generate 10 headline options for the article below: 3 informational, 4 curiosity-driven, 3 list-style. Keep each under 12 words and note the best-fit channel.\n\n{{text}}',
    },
  },
  {
    id: 'writing-story-continue',
    category: 'writing',
    title: { zh: '故事续写', en: 'Story continuation' },
    prompt: {
      zh: '以现有片段为开头续写故事，保持人称、时态与叙事节奏一致，续写约 {{wordCount}} 字，并在结尾留一个转折或悬念：\n\n{{text}}',
      en: 'Continue the story from the excerpt below, keeping the same person, tense, and pacing. Write roughly {{wordCount}} words and end on a twist or cliffhanger:\n\n{{text}}',
    },
  },
  {
    id: 'writing-voiceover-script',
    category: 'writing',
    title: { zh: '旁白脚本', en: 'Voiceover script' },
    prompt: {
      zh: '为「{{topic}}」写一段 {{duration}} 秒的旁白脚本：开头 3 秒抓住注意力，中段给 2 个信息点，结尾一句行动号召。请标注每句话的大致时长。',
      en: 'Write a {{duration}}-second voiceover script about "{{topic}}": a 3-second hook, two mid-section points, and a closing call to action. Note the approximate duration of each line.',
    },
  },
  {
    id: 'writing-product-description',
    category: 'writing',
    title: { zh: '电商产品描述', en: 'Product description' },
    prompt: {
      zh: '为「{{product}}」写电商详情页文案：一句卖点标题 + 3 条利益点（每条不超过 20 字）+ 使用场景描写 + 规格参数占位。目标用户：{{audience}}。',
      en: 'Write an e-commerce product description for "{{product}}": a benefit-led title, 3 bullet points (max 12 words each), a usage scenario, and a specs placeholder. Audience: {{audience}}.',
    },
  },
  {
    id: 'writing-speech-draft',
    category: 'writing',
    title: { zh: '演讲稿', en: 'Speech draft' },
    prompt: {
      zh: '为「{{occasion}}」写一篇约 {{duration}} 分钟的演讲稿：开场致意、核心观点、1 个故事或例子、结尾呼应开场。语言口语化，便于朗读。',
      en: 'Draft a {{duration}}-minute speech for "{{occasion}}": an opening greeting, the core message, one story or example, and a closing that echoes the opening. Keep it spoken-style and easy to read aloud.',
    },
  },
  {
    id: 'writing-style-imitate',
    category: 'writing',
    title: { zh: '风格模仿', en: 'Style imitation' },
    prompt: {
      zh: '参考样例文本的风格（句式、节奏、用词偏好）重写我的初稿，不要照抄样例中的具体内容。\n\n风格样例：\n{{sample}}\n\n我的初稿：\n{{text}}',
      en: 'Using the sample as a style reference (sentence patterns, rhythm, word choice), rewrite my draft in the same style without copying its content.\n\nStyle sample:\n{{sample}}\n\nMy draft:\n{{text}}',
    },
  },
  {
    id: 'writing-naturalize',
    category: 'writing',
    title: { zh: '自然化去模板感', en: 'Naturalize the prose' },
    prompt: {
      zh: '把下面这段文字改得更像真人写的：删掉套话与空洞排比，换成具体细节，减少连接词堆砌，保持原意：\n\n{{text}}',
      en: 'Make the text below read like a human wrote it: cut clichés and empty parallelism, add concrete detail, reduce connective clutter, and preserve the meaning:\n\n{{text}}',
    },
  },
];
