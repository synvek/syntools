/** MBTI 题干与类型文案（随工具懒加载，避免撑大首屏 i18n） */

export type MbtiLocale = 'zh' | 'en';

const questionsZh: Record<string, { text: string; a: string; b: string }> = {
  q1: { text: '聚会后你通常会感觉？', a: '更有能量，还想多聊一会儿', b: '需要独处恢复精力' },
  q2: { text: '周末更想？', a: '约朋友外出活动', b: '在家安静做自己的事' },
  q3: { text: '面对陌生场合，你更？', a: '先观察再慢慢融入', b: '主动找人搭话' },
  q4: { text: '思考问题时你更喜欢？', a: '说出来和别人讨论', b: '先自己想清楚再讲' },
  q5: { text: '电话/即时消息多起来时？', a: '容易觉得打扰，想静一静', b: '觉得热闹，乐于回应' },
  q6: { text: '学习新东西时？', a: '喜欢小组讨论碰撞', b: '喜欢独自钻研' },
  q7: { text: '做决定时你更看重？', a: '已验证的经验与细节', b: '未来可能与整体构想' },
  q8: { text: '读说明书时？', a: '先理解原理再动手', b: '按步骤一步步跟做' },
  q9: { text: '描述事物时你更？', a: '具体、可观察的事实', b: '比喻、联想与含义' },
  q10: { text: '对「惯例」的态度？', a: '稳定可靠，优先沿用', b: '容易腻，想换新方法' },
  q11: { text: '听故事时你更在意？', a: '主题与象征意义', b: '情节与具体细节' },
  q12: { text: '规划旅行时？', a: '列清单、查评价、定行程', b: '留白，到了再随性探索' },
  q13: { text: '争论中你更强调？', a: '对错与逻辑一致性', b: '感受与关系影响' },
  q14: { text: '朋友求助时你先？', a: '安抚情绪、陪伴倾听', b: '分析原因、给解决方案' },
  q15: { text: '评价工作时你更在意？', a: '是否客观公正高效', b: '是否照顾到人的感受' },
  q16: { text: '冲突发生时？', a: '先厘清事实再谈', b: '先缓和气氛再谈' },
  q17: { text: '做反馈时你倾向？', a: '委婉、先肯定再建议', b: '直接指出问题关键' },
  q18: { text: '「公平」对你意味着？', a: '同一标准一视同仁', b: '按情境照顾弱者' },
  q19: { text: '你的桌面/日程通常？', a: '分类清晰、计划明确', b: '弹性大、想到再做' },
  q20: { text: '截止日期临近时？', a: '压力下反而兴奋高效', b: '会提前分批完成' },
  q21: { text: '面对开放式任务？', a: '先定框架与里程碑', b: '先动手探索再收束' },
  q22: { text: '购物时你更？', a: '列好清单再买', b: '逛着逛着就买了' },
  q23: { text: '假期安排？', a: '留足自由时间随机应变', b: '尽量提前订好行程' },
  q24: { text: '完成一件事后？', a: '喜欢收尾归档再开启下一项', b: '容易同时开很多未完成项' },
};

const questionsEn: Record<string, { text: string; a: string; b: string }> = {
  q1: { text: 'After a social gathering you usually feel…', a: 'Energized and ready for more', b: 'Drained and need alone time' },
  q2: { text: 'On weekends you prefer to…', a: 'Go out with friends', b: 'Stay in and do your own thing' },
  q3: { text: 'In unfamiliar settings you tend to…', a: 'Observe first, then join in', b: 'Start conversations quickly' },
  q4: { text: 'When thinking something through you like to…', a: 'Talk it out with others', b: 'Figure it out alone first' },
  q5: { text: 'When messages pile up you…', a: 'Feel interrupted and need quiet', b: 'Enjoy the buzz and reply readily' },
  q6: { text: 'Learning something new, you prefer…', a: 'Group discussion', b: 'Solo deep dives' },
  q7: { text: 'When deciding you weigh more…', a: 'Proven experience and details', b: 'Future possibilities and big ideas' },
  q8: { text: 'With instructions you…', a: 'Want the why before doing', b: 'Follow steps one by one' },
  q9: { text: 'Describing things you lean…', a: 'Concrete, observable facts', b: 'Metaphors and meanings' },
  q10: { text: 'Toward routines you feel…', a: 'They are reliable — keep them', b: 'They get stale — try new ways' },
  q11: { text: 'In a story you notice more…', a: 'Themes and symbolism', b: 'Plot and concrete details' },
  q12: { text: 'Planning a trip you…', a: 'List, review, lock an itinerary', b: 'Leave room to explore on the fly' },
  q13: { text: 'In arguments you emphasize…', a: 'Logic and consistency', b: 'Feelings and relationships' },
  q14: { text: 'A friend asks for help; you first…', a: 'Comfort and listen', b: 'Analyze and suggest fixes' },
  q15: { text: 'Judging work you care more about…', a: 'Fairness and efficiency', b: 'People’s feelings' },
  q16: { text: 'When conflict appears you…', a: 'Clarify facts first', b: 'Ease the mood first' },
  q17: { text: 'Giving feedback you tend to…', a: 'Be gentle: praise then suggest', b: 'Be direct about the issue' },
  q18: { text: '“Fair” means to you…', a: 'Same rules for everyone', b: 'Context and care for the vulnerable' },
  q19: { text: 'Your desk / schedule is usually…', a: 'Organized with clear plans', b: 'Flexible and spontaneous' },
  q20: { text: 'Near a deadline you…', a: 'Get a productive surge under pressure', b: 'Finish in stages ahead of time' },
  q21: { text: 'Open-ended tasks make you…', a: 'Set a framework and milestones', b: 'Explore first, then converge' },
  q22: { text: 'When shopping you…', a: 'Use a list', b: 'Browse and decide on the spot' },
  q23: { text: 'On vacation you prefer…', a: 'Plenty of free, flexible time', b: 'Booked plans in advance' },
  q24: { text: 'After finishing something you…', a: 'Close it out before starting more', b: 'Keep many things in parallel' },
};

const typesZh: Record<string, { name: string; desc: string }> = {
  ISTJ: { name: '物流师', desc: '务实可靠，重视规则与责任，擅长把事情落地。' },
  ISFJ: { name: '守卫者', desc: '细心体贴，默默支持他人，重视传统与稳定。' },
  INFJ: { name: '提倡者', desc: '洞察力强，追求意义与理想，常鼓舞身边的人。' },
  INTJ: { name: '建筑师', desc: '战略思维，独立冷静，喜欢构建长远体系。' },
  ISTP: { name: '鉴赏家', desc: '灵活务实，动手能力强，善于临场解决问题。' },
  ISFP: { name: '探险家', desc: '温和敏感，追求美感与当下体验。' },
  INFP: { name: '调停者', desc: '理想主义，忠于价值观，富有同理心。' },
  INTP: { name: '逻辑学家', desc: '好奇分析，热爱抽象理论与可能性。' },
  ESTP: { name: '企业家', desc: '行动派，精力充沛，善于抓住机会。' },
  ESFP: { name: '表演者', desc: '热情外向，享受互动与生活乐趣。' },
  ENFP: { name: '竞选者', desc: '创意满满，善于连接人与想法。' },
  ENTP: { name: '辩论家', desc: '机智好辩，喜欢挑战常规与头脑风暴。' },
  ESTJ: { name: '总经理', desc: '组织力强，明确目标，推动团队执行。' },
  ESFJ: { name: '执政官', desc: '热心合群，重视和谐与互相支持。' },
  ENFJ: { name: '主人公', desc: '富有感染力，善于激励他人成长。' },
  ENTJ: { name: '指挥官', desc: '果断有魄力，擅长领导与战略决策。' },
};

const typesEn: Record<string, { name: string; desc: string }> = {
  ISTJ: { name: 'Logistician', desc: 'Practical and reliable; values duty and getting things done.' },
  ISFJ: { name: 'Defender', desc: 'Warm and dutiful; quietly supports others and stability.' },
  INFJ: { name: 'Advocate', desc: 'Insightful idealist who seeks meaning and helps people grow.' },
  INTJ: { name: 'Architect', desc: 'Strategic and independent; builds long-range systems.' },
  ISTP: { name: 'Virtuoso', desc: 'Flexible troubleshooter with strong hands-on skills.' },
  ISFP: { name: 'Adventurer', desc: 'Gentle and aesthetic; lives in the present moment.' },
  INFP: { name: 'Mediator', desc: 'Idealistic and empathetic; true to personal values.' },
  INTP: { name: 'Logician', desc: 'Curious analyst who loves theories and possibilities.' },
  ESTP: { name: 'Entrepreneur', desc: 'Energetic doer who seizes opportunities.' },
  ESFP: { name: 'Entertainer', desc: 'Outgoing and spontaneous; enjoys people and fun.' },
  ENFP: { name: 'Campaigner', desc: 'Creative connector of people and ideas.' },
  ENTP: { name: 'Debater', desc: 'Quick-witted challenger of norms and brainstormer.' },
  ESTJ: { name: 'Executive', desc: 'Organized leader who drives teams toward goals.' },
  ESFJ: { name: 'Consul', desc: 'Sociable helper who values harmony and support.' },
  ENFJ: { name: 'Protagonist', desc: 'Charismatic motivator who lifts others up.' },
  ENTJ: { name: 'Commander', desc: 'Decisive leader with strong strategic drive.' },
};

export function resolveMbtiLocale(lang: string): MbtiLocale {
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getMbtiQuestion(lang: string, id: string) {
  const loc = resolveMbtiLocale(lang);
  return (loc === 'zh' ? questionsZh : questionsEn)[id];
}

export function getMbtiTypeCopy(lang: string, type: string) {
  const loc = resolveMbtiLocale(lang);
  return (loc === 'zh' ? typesZh : typesEn)[type];
}
