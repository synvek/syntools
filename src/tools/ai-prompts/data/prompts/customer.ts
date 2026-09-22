import type { PromptItem } from '../../types';

/** 客户服务类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'customer-ticket-reply',
    category: 'customer',
    title: { zh: '工单回复', en: 'Ticket reply' },
    prompt: {
      zh: '帮我回复这张工单：先致歉并确认问题，再给出原因与解决步骤，最后说明后续跟进方式。语气专业友善，避免推责。工单内容：\n\n{{text}}',
      en: 'Draft a reply to this ticket: acknowledge the issue and apologize, confirm what happened, explain the cause and the fix, and state how you will follow up. Keep it professional and warm, and avoid shifting blame.\n\nTicket:\n{{text}}',
    },
  },
  {
    id: 'customer-complaint-deescalate',
    category: 'customer',
    title: { zh: '投诉安抚', en: 'De-escalate a complaint' },
    prompt: {
      zh: '客户情绪激动，投诉内容是「{{complaint}}」。请写 3 段递进回复：先安抚情绪、再给确定性、最后给补偿或补救方案。避免模板化套话。',
      en: 'The customer is upset about "{{complaint}}". Write 3 escalating replies: calm the emotion first, then give certainty, then offer compensation or remediation. Avoid boilerplate phrasing.',
    },
  },
  {
    id: 'customer-faq-generator',
    category: 'customer',
    title: { zh: 'FAQ 生成', en: 'FAQ generator' },
    prompt: {
      zh: '根据下面的产品资料，生成 15 条常见问题与回答：问题用客户的口语写法，回答控制在 3 句以内，并标注哪些问题适合放在帮助中心首屏：\n\n{{text}}',
      en: 'From the product material below, generate 15 FAQs: phrase the questions the way customers speak, keep answers under 3 sentences, and mark which ones belong on the help-center landing page:\n\n{{text}}',
    },
  },
  {
    id: 'customer-escalation-message',
    category: 'customer',
    title: { zh: '问题升级沟通', en: 'Escalation messages' },
    prompt: {
      zh: '我要把问题升级到二线团队，请写两份信息：给客户的告知（说明原因与时间预期）、给二线团队的交接说明（现象、已排查项、影响范围、紧急程度）。情况：\n\n{{text}}',
      en: 'I need to escalate. Write two messages: one to the customer (why, and the expected timeline) and one handover for the tier-2 team (symptoms, what has been ruled out, scope of impact, urgency). Situation:\n\n{{text}}',
    },
  },
  {
    id: 'customer-satisfaction-followup',
    category: 'customer',
    title: { zh: '满意度回访', en: 'Satisfaction follow-up' },
    prompt: {
      zh: '为「{{product}}」写一次满意度回访：3 个评分问题、2 个开放式追问、一句感谢语，并说明低分时如何触发人工跟进。',
      en: 'Write a satisfaction follow-up for "{{product}}": 3 rating questions, 2 open-ended follow-ups, a thank-you line, and how a low score should trigger a human follow-up.',
    },
  },
  {
    id: 'customer-policy-refusal',
    category: 'customer',
    title: { zh: '规则拒绝与替代方案', en: 'Policy refusal with alternatives' },
    prompt: {
      zh: '客户要求退款，但根据规则「{{policy}}」并不完全符合。请写一段回复：先表示理解诉求，再客观解释规则，最后给出 2 个可接受的替代方案。语气坚定但不生硬。',
      en: 'The customer wants a refund, but per the policy "{{policy}}" it is not fully eligible. Write a reply that acknowledges their request, explains the rule objectively, and offers 2 acceptable alternatives. Firm but not cold.',
    },
  },
  {
    id: 'customer-multichannel-tone',
    category: 'customer',
    title: { zh: '多渠道语气适配', en: 'Multi-channel tone' },
    prompt: {
      zh: '把下面这段回复改写成 3 个渠道版本：在线聊天（口语、简短）、邮件（完整、正式）、社交媒体公开回复（礼貌、引导私信）。内容：\n\n{{text}}',
      en: 'Rewrite the reply below for 3 channels: live chat (conversational, short), email (complete, formal), and a public social reply (polite, moves the conversation to DM). Content:\n\n{{text}}',
    },
  },
  {
    id: 'customer-onboarding-guide',
    category: 'customer',
    title: { zh: '新客户上手引导', en: 'Customer onboarding guide' },
    prompt: {
      zh: '为新客户写一份上手引导：3 步完成核心设置、每步的常见卡点、1 个能快速见效的操作、遇到问题时的求助路径。产品：{{product}}，客户规模：{{size}}',
      en: 'Write an onboarding guide for a new customer: 3 steps to complete the core setup, the common snag in each step, one quick-win action, and where to get help. Product: {{product}}, customer size: {{size}}',
    },
  },
  {
    id: 'customer-root-cause-report',
    category: 'customer',
    title: { zh: '同类问题根因报告', en: 'Root-cause report' },
    prompt: {
      zh: '把下面一组同类工单归纳成一份问题报告：现象描述、影响范围与数量、根因假设与验证方法、临时规避方案、长期修复建议：\n\n{{text}}',
      en: 'Synthesize the group of similar tickets below into one problem report: symptom, scope and volume, root-cause hypothesis with a way to verify it, temporary workaround, and a permanent fix proposal:\n\n{{text}}',
    },
  },
  {
    id: 'customer-service-script',
    category: 'customer',
    title: { zh: '客服话术剧本', en: 'Support call script' },
    prompt: {
      zh: '为「{{scenario}}」场景写客服话术剧本：开场白、信息核对、常见分支（客户配合 / 客户拒绝 / 客户要求转人工）、结束语。每句话术不超过 2 句。',
      en: 'Write a support script for the "{{scenario}}" scenario: opening, verification, common branches (cooperative / refuses / asks for a human), and closing. Keep every line under 2 sentences.',
    },
  },
  {
    id: 'customer-help-article',
    category: 'customer',
    title: { zh: '帮助中心文章', en: 'Help-center article' },
    prompt: {
      zh: '为「{{issue}}」写一篇帮助中心文章：一句话结论、前置条件、分步操作、常见错误与排查、相关文章推荐。避免术语，面向非技术用户。',
      en: 'Write a help-center article about "{{issue}}": a one-line answer, prerequisites, numbered steps, common errors and troubleshooting, and related articles. Skip jargon and write for non-technical readers.',
    },
  },
  {
    id: 'customer-churn-save',
    category: 'customer',
    title: { zh: '流失挽留', en: 'Churn save plan' },
    prompt: {
      zh: '客户表示要停用「{{product}}」，原因是「{{reason}}」。请给出挽留方案：理解与确认、可提供的 3 档挽留措施（使用指导 / 方案调整 / 价格优惠），以及客户坚持离开时如何体面收尾并保留回访机会。',
      en: 'The customer plans to leave "{{product}}" because of "{{reason}}". Design a save plan: acknowledge the reason, offer 3 levels of retention (guidance / plan change / discount), and how to close gracefully and keep the door open if they still leave.',
    },
  },
];
