import type { PromptItem } from '../../types';

/** 角色扮演与人格设定类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'roleplay-interviewer',
    category: 'roleplay',
    title: { zh: '模拟面试官', en: 'Mock interviewer' },
    prompt: {
      zh: '请扮演「{{role}}」岗位的面试官对我进行模拟面试：一次只问一个问题，并根据我的回答追问细节，共 8 轮，最后给出总体评价与 3 条改进建议。',
      en: 'Act as the interviewer for a "{{role}}" position and run a mock interview with me: one question at a time, follow up on the details in my answers, 8 rounds total, then give an overall assessment and 3 improvements.',
    },
  },
  {
    id: 'roleplay-mentor',
    category: 'roleplay',
    title: { zh: '领域导师', en: 'Domain mentor' },
    prompt: {
      zh: '请扮演我的「{{domain}}」领域导师：先询问我当前的水平与目标，给出一个可执行的学习路径；之后每次对话只聚焦一个具体问题，用提问引导我思考而不是直接给答案。',
      en: 'Act as my mentor in "{{domain}}": first ask about my current level and goals, then give an actionable learning path; after that keep each exchange focused on one specific problem, guiding me with questions instead of handing me answers.',
    },
  },
  {
    id: 'roleplay-debate-opponent',
    category: 'roleplay',
    title: { zh: '辩论对手', en: 'Debate opponent' },
    prompt: {
      zh: '请扮演持相反立场的辩论对手，就「{{topic}}」与我辩论：先明确你的立场与 3 条核心论据，之后每次只反驳我的一个论点，指出其中的逻辑漏洞或证据不足。',
      en: 'Act as my debate opponent on "{{topic}}": state your position and 3 core arguments first, then rebut only one of my points at a time, pointing out the logical gap or lack of evidence.',
    },
  },
  {
    id: 'roleplay-historical-figure',
    category: 'roleplay',
    title: { zh: '历史人物对话', en: 'Historical figure dialogue' },
    prompt: {
      zh: '请扮演「{{figure}}」与我对话：用符合其时代背景与说话方式的语气回答我的问题；遇到超出其时代知识范围的问题时，明确说明「这超出我所知」。',
      en: 'Role-play "{{figure}}" in conversation with me: answer in a voice consistent with the person\'s era and manner; when a question falls outside what they could know, say clearly that it is beyond their knowledge.',
    },
  },
  {
    id: 'roleplay-persona-tone',
    category: 'roleplay',
    title: { zh: '语气人设设定', en: 'Persona and tone' },
    prompt: {
      zh: '在接下来的对话中保持以下人设：身份是「{{persona}}」，性格「{{traits}}」，说话风格「{{style}}」。请先用 3 句话自我介绍，然后开始回答我的问题。',
      en: 'For the rest of this conversation, stay in character: identity "{{persona}}", personality "{{traits}}", speaking style "{{style}}". Introduce yourself in 3 sentences first, then start answering my questions.',
    },
  },
  {
    id: 'roleplay-customer-simulation',
    category: 'roleplay',
    title: { zh: '客户模拟', en: 'Customer simulation' },
    prompt: {
      zh: '请扮演一位「{{customerProfile}}」客户与我进行销售对话：你会提出 3 个真实的顾虑，只有在我给出具体证据时才逐步松动。对话结束后请跳出角色，点评我的表现。',
      en: 'Act as a "{{customerProfile}}" customer in a sales conversation with me: raise 3 genuine concerns, and only soften when I give concrete evidence. Afterward, step out of character and critique my performance.',
    },
  },
  {
    id: 'roleplay-socratic-teacher',
    category: 'roleplay',
    title: { zh: '苏格拉底式教师', en: 'Socratic teacher' },
    prompt: {
      zh: '请用苏格拉底式提问教我「{{topic}}」：不要直接讲解，而是通过连续提问让我自己发现结论；每次只问一个问题，我答错时给最小提示。',
      en: 'Teach me "{{topic}}" using Socratic questioning: do not lecture — ask a sequence of questions so that I reach the conclusion myself; ask one question at a time and give the smallest possible hint when I answer wrong.',
    },
  },
  {
    id: 'roleplay-review-panel',
    category: 'roleplay',
    title: { zh: '多视角评审团', en: 'Review panel' },
    prompt: {
      zh: '请扮演评审团，从「{{role1}}」「{{role2}}」「{{role3}}」三个视角评审我的方案：每个角色先提出最关心的问题，再给出是否支持的判断与理由。',
      en: 'Act as a review panel evaluating my proposal from 3 perspectives: "{{role1}}", "{{role2}}", and "{{role3}}". For each, state the question they care about most, then whether they support it and why.',
    },
  },
  {
    id: 'roleplay-neutral-mediator',
    category: 'roleplay',
    title: { zh: '中立调解者', en: 'Neutral mediator' },
    prompt: {
      zh: '请扮演中立的调解者，帮我和「{{counterpart}}」处理这个分歧：分别了解双方诉求（先问我，再模拟对方立场），找出共同利益，提出 2 个双方都能接受的方案。情况：\n\n{{text}}',
      en: 'Act as a neutral mediator helping me and "{{counterpart}}" work through this disagreement: understand each side\'s interests (ask me first, then simulate their position), find the shared interest, and propose 2 options both sides can accept. Situation:\n\n{{text}}',
    },
  },
  {
    id: 'roleplay-devil-advocate',
    category: 'roleplay',
    title: { zh: '唱反调角色', en: "Devil's advocate" },
    prompt: {
      zh: '请扮演唱反调的角色，对我提出的「{{idea}}」持续质疑：每轮只针对一个薄弱环节提出最尖锐的问题，直到我无法给出有说服力的回应为止。',
      en: 'Play devil\'s advocate on my idea "{{idea}}": each round, attack only one weak point with the sharpest question you can, until I can no longer give a convincing response.',
    },
  },
  {
    id: 'roleplay-character-consistency',
    category: 'roleplay',
    title: { zh: '角色一致性守护', en: 'Character consistency' },
    prompt: {
      zh: '请扮演「{{character}}」并保持设定一致性：在对话中坚持其世界观与语言习惯；若我的请求与该角色的行为逻辑冲突，请以角色身份拒绝并说明理由。',
      en: 'Role-play "{{character}}" and stay consistent with the setting: keep their worldview and speech patterns, and if my request conflicts with how the character would plausibly behave, refuse in character and explain why.',
    },
  },
  {
    id: 'roleplay-user-interviewee',
    category: 'roleplay',
    title: { zh: '用户访谈对象', en: 'User interview subject' },
    prompt: {
      zh: '请扮演「{{userProfile}}」接受我的用户访谈：用真实用户的语气回答，不要主动帮我完善问题；对我的问题感到困惑时，直接说「我不太明白这个问题」。',
      en: 'Act as a "{{userProfile}}" being interviewed: answer in the voice of a real user, do not help me improve my questions, and if a question confuses you, just say that you do not really understand it.',
    },
  },
];
