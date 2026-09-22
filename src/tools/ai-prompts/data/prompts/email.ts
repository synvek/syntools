import type { PromptItem } from '../../types';

/** 邮件与沟通类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'email-business-request',
    category: 'email',
    title: { zh: '商务请求邮件', en: 'Business request' },
    prompt: {
      zh: '写一封商务请求邮件：主题行明确事由、开头一句说明身份与来意、正文分点列出请求内容与所需时间、结尾给出截止时间与感谢。背景：\n\n{{text}}',
      en: 'Write a business request email: a subject line that states the purpose, an opening that establishes who you are and why you are writing, bullet points with the request and the time it needs, and a closing with a deadline and thanks. Context:\n\n{{text}}',
    },
  },
  {
    id: 'email-follow-up',
    category: 'email',
    title: { zh: '礼貌跟进催办', en: 'Polite follow-up' },
    prompt: {
      zh: '写一封礼貌的跟进邮件：不要直接催促，先复述上次沟通的结论与时间点，再说明当前卡点、需要对方确认的事项与建议的处理方式。背景：\n\n{{text}}',
      en: 'Write a polite follow-up: do not just nudge — restate the last agreement and its timing, explain the current blocker, list what you need confirmed, and suggest how to proceed. Context:\n\n{{text}}',
    },
  },
  {
    id: 'email-apology',
    category: 'email',
    title: { zh: '道歉与说明', en: 'Apology and explanation' },
    prompt: {
      zh: '写一封道歉邮件：先直接承认问题与影响，再说明原因（不找借口），给出已采取的补救措施与时间点，最后说明如何避免再次发生。情况：\n\n{{text}}',
      en: 'Write an apology email: acknowledge the problem and its impact up front, explain the cause without excuses, state the remediation underway with dates, and say how you will prevent a repeat. Situation:\n\n{{text}}',
    },
  },
  {
    id: 'email-meeting-invite',
    category: 'email',
    title: { zh: '会议邀请', en: 'Meeting invitation' },
    prompt: {
      zh: '写一封会议邀请：主题与目标、议程与每项时长、需要对方提前准备的材料、时间与时区、参会人角色，并给出一句「如果不方便」的替代方案。',
      en: 'Write a meeting invitation: topic and objective, agenda with time per item, what attendees should prepare, time and time zone, attendee roles, and an alternative if the time does not work.',
    },
  },
  {
    id: 'email-cross-cultural',
    category: 'email',
    title: { zh: '跨文化沟通邮件', en: 'Cross-cultural email' },
    prompt: {
      zh: '帮我写一封发给「{{culture}}」合作方的邮件：调整直白程度、称呼与礼貌层级，并说明是否适合直接说「不」以及你做了哪些文化适配。内容：\n\n{{text}}',
      en: 'Help me write an email to a partner from "{{culture}}": adjust directness, forms of address, and politeness level, and advise whether a direct "no" is appropriate. Explain the cultural adaptations you made. Content:\n\n{{text}}',
    },
  },
  {
    id: 'email-status-update',
    category: 'email',
    title: { zh: '项目进度同步', en: 'Project status update' },
    prompt: {
      zh: '写一封项目进度同步邮件：整体状态一句话结论（正常 / 有风险 / 阻塞）、本周完成、下周计划、需要协助的事项与责任人、关键时间点。材料：\n\n{{text}}',
      en: 'Write a project status email: a one-line overall status (on track / at risk / blocked), what shipped this week, what is planned next, what help is needed and from whom, and key dates. Material:\n\n{{text}}',
    },
  },
  {
    id: 'email-professional-rewrite',
    category: 'email',
    title: { zh: '强硬表达改写', en: 'Rewrite a blunt message' },
    prompt: {
      zh: '把下面这段比较强硬的表达改写成一封专业邮件：保留立场与底线，去掉情绪化措辞，用事实与影响陈述替代指责，并留出可协商的空间：\n\n{{text}}',
      en: 'Rewrite the blunt message below as a professional email: keep the position and the bottom line, remove emotional wording, replace blame with facts and impact, and leave room to negotiate:\n\n{{text}}',
    },
  },
  {
    id: 'email-decline',
    category: 'email',
    title: { zh: '婉拒请求', en: 'Decline a request' },
    prompt: {
      zh: '帮我婉拒这个请求：「{{request}}」。请先表达理解与感谢，再简短说明拒绝的原因（不展开细节），最后给出替代方案或推荐其他人选。',
      en: 'Help me decline this request: "{{request}}". Acknowledge and thank them first, give a brief reason without over-explaining, then offer an alternative or refer someone else.',
    },
  },
  {
    id: 'email-introduction',
    category: 'email',
    title: { zh: '引荐邮件', en: 'Introduction email' },
    prompt: {
      zh: '写一封引荐邮件，把「{{personA}}」介绍给「{{personB}}」：分别用一句话说明两人的背景与价值，说明为什么值得认识，给出下一步的简单建议，并附一句「如不希望被打扰可忽略」的礼貌表述。',
      en: 'Write an introduction email connecting "{{personA}}" and "{{personB}}": one line on each person\'s background and value, why they should meet, a simple next step, and a polite opt-out line.',
    },
  },
  {
    id: 'email-internal-announcement',
    category: 'email',
    title: { zh: '内部通知', en: 'Internal announcement' },
    prompt: {
      zh: '写一封内部通知：一句话说清「什么变了、对谁有影响、什么时候生效」，再补充必要背景与操作指引，最后给出答疑渠道与联系人。内容：\n\n{{text}}',
      en: 'Write an internal announcement: one line covering what changed, who is affected, and when it takes effect, then the necessary background and instructions, and finally where to ask questions and who to contact. Content:\n\n{{text}}',
    },
  },
  {
    id: 'email-thread-summary',
    category: 'email',
    title: { zh: '长邮件串梳理', en: 'Thread summary' },
    prompt: {
      zh: '把下面这串邮件整理成结论：已达成的共识、仍有分歧的点、各自的待办与时间点、下一步需要谁决策。只保留结论，不复述过程：\n\n{{text}}',
      en: "Turn the email thread below into conclusions: what has been agreed, what is still disputed, each party's action items with dates, and who needs to decide next. Keep the conclusions only, not the back-and-forth:\n\n{{text}}",
    },
  },
  {
    id: 'email-tone-rewrite',
    category: 'email',
    title: { zh: '邮件语气调整', en: 'Adjust email tone' },
    prompt: {
      zh: '把下面这封邮件改写成「{{tone}}」的语气：调整称呼、开场、请求方式与结尾，保持信息完整，并标注哪些地方改得更委婉或更直接：\n\n{{text}}',
      en: 'Rewrite the email below in a "{{tone}}" tone: adjust the greeting, opening, how requests are phrased, and the sign-off while keeping all information intact, and note where you made it softer or more direct:\n\n{{text}}',
    },
  },
];
