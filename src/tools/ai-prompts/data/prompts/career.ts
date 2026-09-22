import type { PromptItem } from '../../types';

/** 职场求职类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'career-resume-bullets',
    category: 'career',
    title: { zh: '简历要点改写', en: 'Resume bullets' },
    prompt: {
      zh: '将以下工作描述改写成 5 条简历要点，使用动词开头并尽量量化成果：\n\n{{text}}',
      en: 'Rewrite the job description into 5 resume bullets with strong verbs and quantified impact where possible:\n\n{{text}}',
    },
  },
  {
    id: 'career-interview-qa',
    category: 'career',
    title: { zh: '面试问答', en: 'Interview Q&A' },
    prompt: {
      zh: '针对岗位「{{role}}」，列出 8 个常见面试题，并给出 STAR 结构的参考回答提纲。',
      en: 'For the role "{{role}}", list 8 common interview questions with STAR-style answer outlines.',
    },
  },
  {
    id: 'career-performance-feedback',
    category: 'career',
    title: { zh: '绩效反馈', en: 'Performance feedback' },
    prompt: {
      zh: '帮我写一段建设性绩效反馈：肯定成绩、指出可改进点、给出可执行建议。情境：\n\n{{text}}',
      en: 'Draft constructive performance feedback: strengths, gaps, and actionable next steps. Context:\n\n{{text}}',
    },
  },
  {
    id: 'career-self-review',
    category: 'career',
    title: { zh: '年终自评', en: 'Year-end self-review' },
    prompt: {
      zh: '帮我写年终自评：本年度 3 项主要成果（含量化数据占位）、1 项不足与改进计划、明年 3 个目标。语气客观、不夸大。素材：\n\n{{text}}',
      en: 'Draft my year-end self-review: 3 key achievements (with quantified placeholders), one shortfall with an improvement plan, and 3 goals for next year. Keep it factual rather than boastful. Input:\n\n{{text}}',
    },
  },
  {
    id: 'career-promotion-case',
    category: 'career',
    title: { zh: '晋升述职', en: 'Promotion case' },
    prompt: {
      zh: '为晋升「{{role}}」准备述职材料：按「业绩 - 能力 - 影响 - 规划」结构组织，突出与目标职级的匹配度，并预判评审可能提出的 5 个质疑及回应。\n\n现有材料：\n{{text}}',
      en: 'Prepare a promotion case for "{{role}}" structured as impact / capability / influence / plan, highlight fit with the target level, and anticipate 5 likely reviewer objections with responses.\n\nCurrent material:\n{{text}}',
    },
  },
  {
    id: 'career-salary-negotiation',
    category: 'career',
    title: { zh: '薪资沟通', en: 'Salary negotiation' },
    prompt: {
      zh: '帮我准备薪资沟通：基于「{{context}}」给出目标区间与理由、3 种开场说法、遇到压价时的回应话术，以及可替代的谈判条件（期权、假期、培训预算等）。',
      en: 'Help me prepare a salary conversation: given "{{context}}", suggest a target range with rationale, 3 opening lines, responses when the offer is pushed down, and alternative negotiables (equity, vacation, training budget).',
    },
  },
  {
    id: 'career-resume-tailor',
    category: 'career',
    title: { zh: '简历与 JD 匹配', en: 'Tailor resume to posting' },
    prompt: {
      zh: '对照目标岗位 JD 优化我的简历：指出关键词缺失、可强化的经历、应删减的内容，并按 JD 的优先级重排经历顺序。\n\nJD：\n{{jd}}\n\n我的简历：\n{{text}}',
      en: 'Tailor my resume to the target job posting: flag missing keywords, experiences worth strengthening, and content to cut, then reorder experience by the priorities in the posting.\n\nJob posting:\n{{jd}}\n\nMy resume:\n{{text}}',
    },
  },
  {
    id: 'career-path-plan',
    category: 'career',
    title: { zh: '职业路径规划', en: 'Career path plan' },
    prompt: {
      zh: '我目前处于「{{current}}」，希望 3 年后达到「{{goal}}」。请给出路径规划：中间职位、需要补齐的能力与证书、可积累的关键项目、风险与备选路线。',
      en: 'I am currently at "{{current}}" and want to reach "{{goal}}" in 3 years. Give me a roadmap: intermediate roles, capabilities and certifications to gain, key projects to accumulate, risks, and a fallback route.',
    },
  },
  {
    id: 'career-profile-summary',
    category: 'career',
    title: { zh: '个人职业简介', en: 'Professional bio' },
    prompt: {
      zh: '为我写 3 个版本的职业简介：一句话电梯陈述、3 句话的社交平台简介、150 字的正式自我介绍。背景：\n\n{{text}}',
      en: 'Write 3 versions of my professional bio: a one-sentence elevator pitch, a 3-sentence social profile, and a 150-word formal introduction. Background:\n\n{{text}}',
    },
  },
  {
    id: 'career-one-on-one',
    category: 'career',
    title: { zh: '与主管 1:1 沟通', en: 'Manager 1:1 prep' },
    prompt: {
      zh: '帮我准备与主管的 1:1 沟通：3 个要同步的进展、2 个需要支持的问题（各附我的建议方案）、1 个职业发展议题，并给出开场与收尾话术。当前情况：\n\n{{text}}',
      en: 'Help me prepare for a 1:1 with my manager: 3 progress updates, 2 blockers where I need support (each with my proposed option), and 1 career development topic, plus opening and closing lines. Context:\n\n{{text}}',
    },
  },
  {
    id: 'career-write-jd',
    category: 'career',
    title: { zh: '撰写招聘 JD', en: 'Write a job description' },
    prompt: {
      zh: '为「{{role}}」撰写招聘 JD：5 条岗位职责、任职要求（区分必需与加分项）、团队与业务介绍、招聘流程说明。避免年龄、性别等歧视性表述。',
      en: 'Write a job description for "{{role}}": 5 responsibilities, requirements split into must-have and nice-to-have, a team and business intro, and the hiring process. Avoid any discriminatory wording.',
    },
  },
  {
    id: 'career-resignation-talk',
    category: 'career',
    title: { zh: '离职沟通', en: 'Resignation conversation' },
    prompt: {
      zh: '帮我准备离职沟通：告知话术（简洁、不抱怨）、交接计划、以及被挽留时的应对方式。当前情况：\n\n{{text}}',
      en: 'Help me prepare a resignation conversation: a concise, non-complaining message, a handover plan, and how to respond if they try to retain me. Context:\n\n{{text}}',
    },
  },
];
