export type PromptCategory =
  | 'writing'
  | 'coding'
  | 'translate'
  | 'marketing'
  | 'learning'
  | 'career';

export interface PromptItem {
  id: string;
  category: PromptCategory;
  titleZh: string;
  titleEn: string;
  promptZh: string;
  promptEn: string;
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  'writing',
  'coding',
  'translate',
  'marketing',
  'learning',
  'career',
];

/** 常用 AI 提示词（中英双语，工具内懒加载） */
export const PROMPTS: PromptItem[] = [
  {
    id: 'write-blog',
    category: 'writing',
    titleZh: '博客大纲',
    titleEn: 'Blog outline',
    promptZh:
      '请围绕主题「{{topic}}」写一篇面向普通读者的博客大纲，包含引言、3-5 个小节与结尾行动建议，语气清晰友好。',
    promptEn:
      'Create a blog outline on "{{topic}}" for general readers: intro, 3–5 sections, and a closing call-to-action. Clear and friendly tone.',
  },
  {
    id: 'write-rewrite',
    category: 'writing',
    titleZh: '润色改写',
    titleEn: 'Polish rewrite',
    promptZh:
      '请润色以下文本，保持原意，提升流畅度与专业感，并给出改写后的全文：\n\n{{text}}',
    promptEn:
      'Polish the text below while preserving meaning. Improve flow and professionalism, then return the full rewrite:\n\n{{text}}',
  },
  {
    id: 'write-summary',
    category: 'writing',
    titleZh: '要点摘要',
    titleEn: 'Key summary',
    promptZh: '用不超过 5 条要点摘要以下内容，并标注最关键结论：\n\n{{text}}',
    promptEn:
      'Summarize the following in at most 5 bullet points and highlight the key conclusion:\n\n{{text}}',
  },
  {
    id: 'code-review',
    category: 'coding',
    titleZh: '代码审查',
    titleEn: 'Code review',
    promptZh:
      '请审查以下代码，指出潜在 bug、可读性与性能问题，并按严重程度排序给出修改建议：\n\n```\n{{code}}\n```',
    promptEn:
      'Review this code for bugs, readability, and performance. Rank findings by severity and suggest fixes:\n\n```\n{{code}}\n```',
  },
  {
    id: 'code-explain',
    category: 'coding',
    titleZh: '解释代码',
    titleEn: 'Explain code',
    promptZh: '请用初学者能懂的语言解释这段代码的作用与执行流程：\n\n```\n{{code}}\n```',
    promptEn:
      'Explain what this code does and how it runs, in beginner-friendly language:\n\n```\n{{code}}\n```',
  },
  {
    id: 'code-refactor',
    category: 'coding',
    titleZh: '重构建议',
    titleEn: 'Refactor tips',
    promptZh:
      '请给出重构方案：更清晰的命名、拆分函数、减少重复，并输出重构后的代码：\n\n```\n{{code}}\n```',
    promptEn:
      'Propose a refactor (clearer names, smaller functions, less duplication) and show the refactored code:\n\n```\n{{code}}\n```',
  },
  {
    id: 'tr-zh-en',
    category: 'translate',
    titleZh: '中译英（自然）',
    titleEn: 'ZH→EN natural',
    promptZh: '将以下中文翻译成自然、地道的英文，保留语气与专有名词：\n\n{{text}}',
    promptEn: 'Translate the following Chinese into natural English, keeping tone and proper nouns:\n\n{{text}}',
  },
  {
    id: 'tr-en-zh',
    category: 'translate',
    titleZh: '英译中（通顺）',
    titleEn: 'EN→ZH fluent',
    promptZh: '将以下英文翻译成通顺的简体中文，避免生硬直译：\n\n{{text}}',
    promptEn: 'Translate the following English into fluent Simplified Chinese (avoid stiff literal phrasing):\n\n{{text}}',
  },
  {
    id: 'tr-locale',
    category: 'translate',
    titleZh: '产品文案本地化',
    titleEn: 'UI copy localization',
    promptZh:
      '请将以下产品文案本地化为简体中文，兼顾简洁与品牌语气，并给出备选写法：\n\n{{text}}',
    promptEn:
      'Localize this product copy into Simplified Chinese. Keep it concise and on-brand; provide alternatives:\n\n{{text}}',
  },
  {
    id: 'mkt-slogan',
    category: 'marketing',
    titleZh: '广告语生成',
    titleEn: 'Slogan ideas',
    promptZh:
      '为产品「{{product}}」生成 8 条中英文广告语，风格多样（简洁 / 情感 / 利益点），各附一句使用场景。',
    promptEn:
      'Generate 8 bilingual slogans for "{{product}}" in varied styles (short / emotional / benefit-led), each with a use case.',
  },
  {
    id: 'mkt-landing',
    category: 'marketing',
    titleZh: '落地页文案',
    titleEn: 'Landing copy',
    promptZh:
      '为「{{product}}」写落地页文案：主标题、副标题、3 个卖点、社会证明占位、CTA。目标用户：{{audience}}。',
    promptEn:
      'Write landing-page copy for "{{product}}": headline, subhead, 3 benefits, social-proof placeholder, CTA. Audience: {{audience}}.',
  },
  {
    id: 'mkt-email',
    category: 'marketing',
    titleZh: '营销邮件',
    titleEn: 'Marketing email',
    promptZh:
      '写一封营销邮件：主题行（3 个备选）+ 正文（痛点→方案→CTA），产品：{{product}}，语气友好专业。',
    promptEn:
      'Write a marketing email: 3 subject options + body (pain → solution → CTA) for {{product}}. Friendly and professional.',
  },
  {
    id: 'learn-plan',
    category: 'learning',
    titleZh: '学习计划',
    titleEn: 'Study plan',
    promptZh:
      '为我制定「{{topic}}」四周学习计划：每周目标、每日任务（约 45 分钟）、检验方式与推荐资源。',
    promptEn:
      'Create a 4-week study plan for "{{topic}}": weekly goals, ~45-min daily tasks, checkpoints, and resource suggestions.',
  },
  {
    id: 'learn-eli5',
    category: 'learning',
    titleZh: '通俗讲解',
    titleEn: 'ELI5 explain',
    promptZh: '用类比和简单例子解释「{{topic}}」，最后给出 3 个自测问题。',
    promptEn: 'Explain "{{topic}}" with analogies and simple examples, then give 3 self-check questions.',
  },
  {
    id: 'learn-flash',
    category: 'learning',
    titleZh: '闪卡生成',
    titleEn: 'Flashcards',
    promptZh: '根据以下笔记生成 10 张问答闪卡（正面问题 / 背面答案）：\n\n{{text}}',
    promptEn: 'From the notes below, make 10 Q&A flashcards (front question / back answer):\n\n{{text}}',
  },
  {
    id: 'career-resume',
    category: 'career',
    titleZh: '简历要点改写',
    titleEn: 'Resume bullets',
    promptZh:
      '将以下工作描述改写成 5 条简历要点，使用动词开头并尽量量化成果：\n\n{{text}}',
    promptEn:
      'Rewrite the job description into 5 resume bullets with strong verbs and quantified impact where possible:\n\n{{text}}',
  },
  {
    id: 'career-interview',
    category: 'career',
    titleZh: '面试问答',
    titleEn: 'Interview Q&A',
    promptZh:
      '针对岗位「{{role}}」，列出 8 个常见面试题，并给出 STAR 结构的参考回答提纲。',
    promptEn:
      'For the role "{{role}}", list 8 common interview questions with STAR-style answer outlines.',
  },
  {
    id: 'career-feedback',
    category: 'career',
    titleZh: '绩效反馈',
    titleEn: 'Performance feedback',
    promptZh:
      '帮我写一段建设性绩效反馈：肯定成绩、指出可改进点、给出可执行建议。情境：\n\n{{text}}',
    promptEn:
      'Draft constructive performance feedback: strengths, gaps, and actionable next steps. Context:\n\n{{text}}',
  },
];
