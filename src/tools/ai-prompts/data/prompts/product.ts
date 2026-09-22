import type { PromptItem } from '../../types';

/** 产品管理类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'product-requirement-breakdown',
    category: 'product',
    title: { zh: '需求拆解', en: 'Requirement breakdown' },
    prompt: {
      zh: '把下面的需求描述拆解成可执行的任务：用户故事、验收标准（Given/When/Then）、依赖项、边界与不做的事、估算要点：\n\n{{text}}',
      en: 'Break the requirement below into executable tasks: user stories, acceptance criteria (Given/When/Then), dependencies, out-of-scope items, and estimation notes:\n\n{{text}}',
    },
  },
  {
    id: 'product-user-story',
    category: 'product',
    title: { zh: '用户故事', en: 'User stories' },
    prompt: {
      zh: '把「{{feature}}」写成 3 个用户故事（As a … I want … so that …），每个故事配 3 条验收标准与 2 个异常场景。',
      en: 'Write "{{feature}}" as 3 user stories (As a … I want … so that …), each with 3 acceptance criteria and 2 edge cases.',
    },
  },
  {
    id: 'product-prd-outline',
    category: 'product',
    title: { zh: 'PRD 提纲', en: 'PRD outline' },
    prompt: {
      zh: '为「{{feature}}」写 PRD 提纲：背景与目标、目标用户与场景、功能描述、交互与状态、数据与埋点、依赖与风险、上线与灰度计划。',
      en: 'Draft a PRD outline for "{{feature}}": background and goals, target users and scenarios, feature description, interactions and states, data and analytics events, dependencies and risks, and rollout plan.',
    },
  },
  {
    id: 'product-prioritization',
    category: 'product',
    title: { zh: '需求优先级排序', en: 'Prioritization' },
    prompt: {
      zh: '帮我给下面的需求排优先级：用 RICE 或 ICE 打分（列出各项分值），输出排序表，并说明哪些需求可以先做最小可用版本：\n\n{{text}}',
      en: 'Prioritize the requirements below: score them with RICE or ICE (show each component), output a ranked table, and note which can ship as a minimal version first:\n\n{{text}}',
    },
  },
  {
    id: 'product-competitor-teardown',
    category: 'product',
    title: { zh: '竞品拆解', en: 'Competitor teardown' },
    prompt: {
      zh: '拆解竞品「{{competitor}}」：核心流程与关键页面、功能清单、商业模式、体验亮点与槽点，并给出 3 条可借鉴或可超越的点。',
      en: 'Tear down the competitor "{{competitor}}": core flows and key screens, feature inventory, business model, UX highlights and frustrations, plus 3 things to borrow or beat.',
    },
  },
  {
    id: 'product-metrics-and-tracking',
    category: 'product',
    title: { zh: '指标与埋点定义', en: 'Metrics and tracking plan' },
    prompt: {
      zh: '为「{{feature}}」定义衡量指标：1 个核心指标、3 个辅助指标，每个指标的计算口径与数据来源，以及埋点事件清单（事件名 / 触发时机 / 属性）。',
      en: 'Define success metrics for "{{feature}}": 1 primary metric, 3 supporting metrics, how each is calculated and where the data comes from, plus a tracking plan (event name / trigger / properties).',
    },
  },
  {
    id: 'product-edge-cases',
    category: 'product',
    title: { zh: '边界与异常场景', en: 'Edge cases' },
    prompt: {
      zh: '针对「{{feature}}」列出边界与异常场景：空数据、超长内容、并发操作、网络失败、权限不足、重复提交，并给出每个场景的界面表现与处理建议。',
      en: 'List edge and error cases for "{{feature}}": empty data, overly long content, concurrent actions, network failure, insufficient permission, duplicate submit. Give the UI behavior and handling suggestion for each.',
    },
  },
  {
    id: 'product-release-note',
    category: 'product',
    title: { zh: '更新公告', en: 'Release note' },
    prompt: {
      zh: '把下面的改动整理成用户可读的更新公告：一句概要 + 分类列出（新增 / 优化 / 修复），每条说明对用户的影响，避免内部术语：\n\n{{text}}',
      en: 'Turn the changes below into a user-facing release note: a one-line summary plus grouped sections (new / improved / fixed), stating the user impact of each and avoiding internal jargon:\n\n{{text}}',
    },
  },
  {
    id: 'product-interview-guide',
    category: 'product',
    title: { zh: '用户访谈提纲', en: 'User interview guide' },
    prompt: {
      zh: '为「{{topic}}」设计用户访谈提纲：3 个暖场问题、5 个聚焦过去行为的非假设性问题、2 个追问技巧、结尾的收集方式，并列出要避免的引导性提问。',
      en: 'Design a user interview guide for "{{topic}}": 3 warm-up questions, 5 questions about past behavior rather than hypotheticals, 2 probing techniques, a closing ask, and the leading questions to avoid.',
    },
  },
  {
    id: 'product-feedback-triage',
    category: 'product',
    title: { zh: '用户反馈归类', en: 'Feedback triage' },
    prompt: {
      zh: '把下面的用户反馈归类：按主题聚类、标注严重程度与出现频次、区分「需求 / 缺陷 / 使用问题」，并给出处理优先级与建议回复话术：\n\n{{text}}',
      en: 'Triage the user feedback below: cluster by theme, tag severity and frequency, classify each item as request / bug / usage issue, then give a handling priority and a suggested reply:\n\n{{text}}',
    },
  },
  {
    id: 'product-onboarding-flow',
    category: 'product',
    title: { zh: '新手引导流程', en: 'Onboarding flow' },
    prompt: {
      zh: '为「{{product}}」设计新手引导流程：首次进入的 3 个关键动作、每步的目标与放弃点、进度提示方式、第 1 天与第 7 天的激活衡量方式。',
      en: 'Design the onboarding flow for "{{product}}": the 3 key actions on first entry, the goal and drop-off risk of each step, how progress is shown, and how day-1 versus day-7 activation is measured.',
    },
  },
  {
    id: 'product-quarterly-roadmap',
    category: 'product',
    title: { zh: '季度路线图', en: 'Quarterly roadmap' },
    prompt: {
      zh: '为「{{product}}」制定一个季度路线图：3 个主题、每个主题下的关键交付项与验收标准、依赖与资源需求，以及明确不做的事项与理由。',
      en: 'Build a quarterly roadmap for "{{product}}": 3 themes, the key deliverables and acceptance criteria under each, dependencies and resourcing needs, and what is explicitly out of scope with reasons.',
    },
  },
];
