import type { PromptItem } from '../../types';

/** 社交媒体类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'social-lifestyle-post',
    category: 'social',
    title: { zh: '生活分享型帖子', en: 'Lifestyle post' },
    prompt: {
      zh: '写一篇生活分享型社媒帖子：标题带 1 个 emoji 与关键词，正文分 3-4 段口语化短句（含具体细节与真实感受），结尾用 1 个提问引导评论，并附 5 个话题标签。主题：{{topic}}',
      en: 'Write a lifestyle social post: a title with one emoji and a keyword, 3–4 short conversational paragraphs with concrete details and honest feelings, a closing question to invite comments, and 5 hashtags. Topic: {{topic}}',
    },
  },
  {
    id: 'social-long-form-article',
    category: 'social',
    title: { zh: '长文推文', en: 'Long-form article post' },
    prompt: {
      zh: '为「{{topic}}」写一篇平台长文：标题 3 个备选（含数字或悬念）、导语在 100 字内建立共鸣、正文 3 个小标题各 2-3 段、结尾引导在看与留言，并标出配图位置。',
      en: 'Write a long-form article about "{{topic}}": 3 title options (with a number or a hook), a lead under 100 words that builds resonance, 3 subheads with 2–3 paragraphs each, a closing that invites reactions and comments, and where images should go.',
    },
  },
  {
    id: 'social-microblog-post',
    category: 'social',
    title: { zh: '短帖文案', en: 'Microblog post' },
    prompt: {
      zh: '写一条短帖：不超过 140 字，第一句就要有信息增量，中间用「但是 / 结果」制造转折，结尾带 2 个话题标签。主题：{{topic}}',
      en: 'Write a short post: under 140 characters, the first line must add information immediately, use a "but / so" turn in the middle, and end with 2 hashtags. Topic: {{topic}}',
    },
  },
  {
    id: 'social-professional-post',
    category: 'social',
    title: { zh: '职场平台帖子', en: 'Professional post' },
    prompt: {
      zh: '写一条职场平台帖子：第一行作为折叠前的钩子，正文用短段落加空行，讲一个具体的工作经历并得出 3 点结论，结尾用一个问题引导讨论。主题：{{topic}}',
      en: 'Write a professional-network post: a hook in the first line before the fold, short paragraphs separated by blank lines, one concrete work story with 3 takeaways, and a closing question to spark discussion. Topic: {{topic}}',
    },
  },
  {
    id: 'social-thread',
    category: 'social',
    title: { zh: '多帖串（Thread）', en: 'Thread' },
    prompt: {
      zh: '把「{{topic}}」写成一个 7 条的社交平台串：第 1 条给结论与价值承诺，中间每条一个要点并配例子或数据，最后一条总结并给出行动建议。',
      en: 'Turn "{{topic}}" into a 7-post thread: post 1 states the conclusion and the value promise, each middle post carries one point with an example or number, and the last post summarizes with a call to action.',
    },
  },
  {
    id: 'social-hashtag-plan',
    category: 'social',
    title: { zh: '话题标签规划', en: 'Hashtag plan' },
    prompt: {
      zh: '为「{{topic}}」做话题标签规划：大、中、小三档竞争各给 4 个标签，说明每个标签的适配理由与竞争程度，最后给出推荐的 6 个标签组合。',
      en: 'Plan hashtags for "{{topic}}": 4 hashtags each for high, mid, and low competition, with the reasoning and difficulty of each, then a recommended set of 6.',
    },
  },
  {
    id: 'social-comment-replies',
    category: 'social',
    title: { zh: '评论互动回复', en: 'Comment replies' },
    prompt: {
      zh: '针对下面的评论写回复：正面评论表示感谢并补充一个细节，质疑用事实回应而不是辩论，恶评礼貌收尾或不回复。请分别给出话术：\n\n{{text}}',
      en: 'Write replies to the comments below: thank positive ones and add one detail, answer criticism with facts rather than arguing, and close politely or stay silent on hostile ones. Provide copy for each:\n\n{{text}}',
    },
  },
  {
    id: 'social-repurpose',
    category: 'social',
    title: { zh: '一稿多平台改写', en: 'Cross-platform repurpose' },
    prompt: {
      zh: '把下面这份内容改写成 3 个平台的版本：短视频口播（30 秒）、社媒图文帖、邮件简报。保留核心信息，按各平台习惯调整长度与语气：\n\n{{text}}',
      en: 'Repurpose the content below for 3 platforms: a 30-second short-video script, a social post, and an email newsletter. Keep the core message and adapt length and tone to each platform:\n\n{{text}}',
    },
  },
  {
    id: 'social-influencer-brief',
    category: 'social',
    title: { zh: '达人合作简报', en: 'Influencer brief' },
    prompt: {
      zh: '为「{{product}}」写达人合作简报：品牌与产品介绍、内容目标、必须出现的信息与禁用表述、内容形式与时长建议、发布时间与交付要求、审核流程。',
      en: 'Write an influencer brief for "{{product}}": brand and product intro, content objective, must-include points and prohibited claims, suggested format and length, timing and deliverable requirements, and the review process.',
    },
  },
  {
    id: 'social-engagement-topics',
    category: 'social',
    title: { zh: '社群互动话题', en: 'Community engagement prompts' },
    prompt: {
      zh: '为「{{community}}」社群设计 7 天的互动话题：每天一个话题并标注类型（立场选择 / 经验分享 / 求助 / 投票），并给出主持人的开场引导语。',
      en: 'Design 7 days of engagement prompts for the "{{community}}" community: one topic per day tagged by type (take a side / share experience / ask for help / poll), each with an opening line for the moderator.',
    },
  },
  {
    id: 'social-hook-writing',
    category: 'social',
    title: { zh: '爆款开头', en: 'Scroll-stopping hooks' },
    prompt: {
      zh: '为「{{topic}}」写 10 个有吸引力的开头：分别用数字悬念、反常识、身份认同、痛点直击、结果前置五种手法，每种 2 条，每条不超过 25 字。',
      en: 'Write 10 scroll-stopping openers for "{{topic}}": 2 each using numbers, counter-intuition, identity, pain point, and result-first, each under 20 words.',
    },
  },
  {
    id: 'social-account-audit',
    category: 'social',
    title: { zh: '账号内容诊断', en: 'Account content audit' },
    prompt: {
      zh: '诊断我的社媒账号内容：从定位清晰度、选题重复度、开头吸引力、互动设计与发布节奏五个维度打分（1-5 分），并给出具体改进项。近期内容：\n\n{{text}}',
      en: 'Audit my social account content: score 1–5 on positioning clarity, topic repetition, hook strength, engagement design, and posting cadence, then give concrete fixes. Recent content:\n\n{{text}}',
    },
  },
];
