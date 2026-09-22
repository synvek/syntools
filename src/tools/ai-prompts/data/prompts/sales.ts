import type { PromptItem } from '../../types';

/** 销售与商务拓展类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'sales-cold-email',
    category: 'sales',
    title: { zh: '客户开发信', en: 'Cold outreach email' },
    prompt: {
      zh: '为「{{product}}」写一封给「{{persona}}」的开发信：主题行 3 个备选、开场用对方关心的行业信号切入、一句话价值主张、一个低门槛的行动号召。全文不超过 150 字。',
      en: 'Write a cold email for "{{product}}" to a "{{persona}}": 3 subject options, an opening tied to an industry signal they care about, a one-line value proposition, and a low-friction call to action. Keep it under 120 words.',
    },
  },
  {
    id: 'sales-objection-handling',
    category: 'sales',
    title: { zh: '异议处理', en: 'Objection handling' },
    prompt: {
      zh: '客户提出异议：「{{objection}}」。请给出 3 种回应思路（先共情再澄清 / 用数据回应 / 重新框定问题），并说明各自最适用的情况。',
      en: 'The customer raised this objection: "{{objection}}". Give 3 response approaches (acknowledge then clarify / answer with data / reframe the question) and explain when each fits best.',
    },
  },
  {
    id: 'sales-proposal-quote',
    category: 'sales',
    title: { zh: '方案与报价', en: 'Proposal and quote' },
    prompt: {
      zh: '为客户「{{customer}}」写方案报价：需求复述、方案概述、分期交付内容、报价表结构（项目 / 内容 / 单价 / 数量）、付款与验收条款要点、报价有效期。背景：\n\n{{text}}',
      en: 'Write a proposal and quote for "{{customer}}": a needs recap, solution overview, deliverables by phase, a quote table structure (item / scope / unit price / quantity), payment and acceptance terms, and a validity period. Context:\n\n{{text}}',
    },
  },
  {
    id: 'sales-negotiation-prep',
    category: 'sales',
    title: { zh: '商务谈判准备', en: 'Negotiation prep' },
    prompt: {
      zh: '帮我准备与「{{customer}}」的商务谈判：我方底线与理想结果、对方的可能诉求、可交换的让步项（价格 / 账期 / 范围 / 服务）、开场话术与僵局破解方式。',
      en: 'Prepare me for a negotiation with "{{customer}}": our walk-away and target outcomes, their likely asks, tradeable concessions (price / payment terms / scope / service), an opening, and ways to break a deadlock.',
    },
  },
  {
    id: 'sales-follow-up-cadence',
    category: 'sales',
    title: { zh: '跟进节奏设计', en: 'Follow-up cadence' },
    prompt: {
      zh: '为「{{deal}}」设计跟进节奏：首触后 5 次跟进的时间间隔、每次要提供的价值点（避免无效催促）、渠道切换方式，以及应当停止跟进放弃的信号。',
      en: 'Design a follow-up cadence for "{{deal}}": the timing of 5 follow-ups after first contact, the value point of each (no empty nudges), how to switch channels, and the signals that mean you should stop.',
    },
  },
  {
    id: 'sales-discovery-questions',
    category: 'sales',
    title: { zh: '需求挖掘提问', en: 'Discovery questions' },
    prompt: {
      zh: '针对「{{product}}」的销售场景，设计 12 个需求挖掘问题：按现状、问题、影响、价值（SPIN）分组，并说明每个问题能判断出什么信息。',
      en: 'Design 12 discovery questions for selling "{{product}}": group them by situation, problem, implication, and payoff (SPIN), and state what each question reveals.',
    },
  },
  {
    id: 'sales-demo-script',
    category: 'sales',
    title: { zh: '产品演示脚本', en: 'Demo script' },
    prompt: {
      zh: '为「{{product}}」写一段 15 分钟的演示脚本：开场 1 分钟建立关联、按客户场景演示 3 个功能、每个功能说明「解决什么问题」、结尾 3 分钟处理疑问并约定下一步。客户背景：{{customer}}',
      en: 'Write a 15-minute demo script for "{{product}}": a 1-minute opening that connects to their world, 3 features demoed in the customer scenario, the problem each solves, and a 3-minute close that handles questions and agrees on next steps. Customer: {{customer}}',
    },
  },
  {
    id: 'sales-win-loss-review',
    category: 'sales',
    title: { zh: '赢单与丢单复盘', en: 'Win/loss review' },
    prompt: {
      zh: '复盘这次「{{outcome}}」的商机：关键决策因素、我方做得好的与失误的地方、可复用的经验、下次要更早做的 3 件事。过程材料：\n\n{{text}}',
      en: 'Review this "{{outcome}}" opportunity: the decisive factors, what we did well and where we slipped, reusable lessons, and 3 things to do earlier next time. Material:\n\n{{text}}',
    },
  },
  {
    id: 'sales-account-plan',
    category: 'sales',
    title: { zh: '大客户经营计划', en: 'Account plan' },
    prompt: {
      zh: '为「{{account}}」制定大客户经营计划：组织架构与决策链、当前合作状态、可拓展的业务线、关键关系人的诉求、季度接触节奏与目标。',
      en: 'Build an account plan for "{{account}}": org structure and decision chain, current relationship status, expansion opportunities, what each key stakeholder cares about, and a quarterly engagement rhythm with goals.',
    },
  },
  {
    id: 'sales-pitch-outline',
    category: 'sales',
    title: { zh: '销售提案大纲', en: 'Pitch deck outline' },
    prompt: {
      zh: '为「{{product}}」写销售提案大纲：客户现状与痛点、解决思路、方案与差异化、实施计划、成功案例、报价与下一步。控制在一页一个主题。',
      en: 'Outline a sales pitch deck for "{{product}}": their current state and pain, our approach, solution and differentiation, implementation plan, proof points, pricing, and next step. Keep it to one theme per slide.',
    },
  },
  {
    id: 'sales-channel-partner',
    category: 'sales',
    title: { zh: '渠道伙伴拓展', en: 'Channel partner program' },
    prompt: {
      zh: '为「{{product}}」设计渠道合作方案：目标伙伴类型、伙伴的分成与激励、培训与支持内容、考核指标与退出机制，以及一段面向伙伴负责人的招募话术。',
      en: 'Design a channel partner program for "{{product}}": target partner types, commission and incentives, training and support, performance metrics and exit terms, plus a recruitment pitch for a partner lead.',
    },
  },
  {
    id: 'sales-crm-notes',
    category: 'sales',
    title: { zh: '沟通记录整理', en: 'Structured call notes' },
    prompt: {
      zh: '把下面的沟通记录整理成结构化纪要：客户基本信息、明确需求、隐含诉求、异议与顾虑、承诺事项与时间点、下一步行动与负责人：\n\n{{text}}',
      en: 'Turn the notes below into a structured record: account basics, stated needs, unstated concerns, objections, commitments with deadlines, and next actions with owners:\n\n{{text}}',
    },
  },
];
