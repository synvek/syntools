import type { PromptItem } from '../../types';

/** 健康与生活类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'health-training-plan',
    category: 'health',
    title: { zh: '训练计划', en: 'Training plan' },
    prompt: {
      zh: '为「{{goal}}」制定 {{weeks}} 周训练计划：每周训练日与休息日安排、每次的动作与组次、强度递进方式、热身与拉伸，以及出现不适时的调整原则。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Build a {{weeks}}-week training plan for "{{goal}}": training and rest days per week, the exercises and sets for each session, how intensity progresses, warm-up and stretching, and how to adjust when something feels wrong.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-nutrition-balance',
    category: 'health',
    title: { zh: '饮食搭配', en: 'Meal planning' },
    prompt: {
      zh: '为「{{situation}}」设计一日饮食搭配：三餐与加餐的食物类别与大致份量、蛋白质与蔬菜摄入要点、外食时的选择建议，以及需要限制的食物。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Design a day of meals for "{{situation}}": the food groups and rough portions for 3 meals plus a snack, key points on protein and vegetables, what to choose when eating out, and what to limit.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-sleep-improvement',
    category: 'health',
    title: { zh: '睡眠改善', en: 'Sleep improvement' },
    prompt: {
      zh: '帮我改善睡眠：分析下面描述的情况，指出可能的干扰因素，给出睡前 90 分钟的动作清单、作息调整步骤，以及需要就医评估的信号：\n\n{{text}}\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Help me improve my sleep: analyze the situation below, identify likely disruptors, give a 90-minute pre-bed routine, steps to shift my schedule, and the signals that warrant seeing a doctor:\n\n{{text}}\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-habit-building',
    category: 'health',
    title: { zh: '习惯养成', en: 'Habit building' },
    prompt: {
      zh: '帮我养成「{{habit}}」：设计最小可执行版本、触发线索（时间 / 场景 / 前置动作）、即时反馈方式、中断后的恢复规则，以及 4 周的推进阶梯。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Help me build the habit "{{habit}}": design a minimum viable version, the cue (time / place / preceding action), immediate feedback, a rule for recovering after a lapse, and a 4-week progression ladder.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-stress-management',
    category: 'health',
    title: { zh: '压力管理', en: 'Stress management' },
    prompt: {
      zh: '帮我梳理当前的压力来源并给出应对方案：区分可控与不可控因素、每种压力源的即时缓解方式与长期处理方式，以及需要寻求支持的情况：\n\n{{text}}\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Help me map my current stressors and a response plan: separate what is controllable from what is not, give an immediate coping method and a longer-term approach for each stressor, and note when to seek support:\n\n{{text}}\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-sedentary-posture',
    category: 'health',
    title: { zh: '久坐与体态', en: 'Sedentary and posture' },
    prompt: {
      zh: '针对长期久坐的情况设计改善方案：工位调整要点、每小时可做的 3 个微动作、每天 10 分钟的放松与强化动作，以及需要警惕的身体信号。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Design a plan for long hours of sitting: how to adjust the workstation, 3 micro-movements to do every hour, a 10-minute daily routine of release and strengthening, and the physical signals to watch out for.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-symptom-log',
    category: 'health',
    title: { zh: '症状记录整理', en: 'Symptom log' },
    prompt: {
      zh: '帮我把下面的症状描述整理成就诊时可用的记录：出现时间与频率、诱发与缓解因素、伴随症状、已尝试的处理方式、想问医生的问题清单：\n\n{{text}}\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Turn the symptom description below into a record I can bring to a doctor: onset and frequency, triggers and relievers, accompanying symptoms, what I have already tried, and questions to ask:\n\n{{text}}\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-weight-management',
    category: 'health',
    title: { zh: '体重管理', en: 'Weight management' },
    prompt: {
      zh: '为「{{goal}}」制定体重管理方案：每日热量摄入的大致范围与依据、饮食结构调整重点、每周运动量与形式、进度记录方式，以及平台期的应对思路。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Build a weight management plan for "{{goal}}": a rough daily calorie range with the reasoning, the key diet adjustments, weekly activity volume and type, how to track progress, and what to do at a plateau.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-checkup-prep',
    category: 'health',
    title: { zh: '体检准备', en: 'Checkup preparation' },
    prompt: {
      zh: '帮我准备一次体检：需要提前了解的项目与意义、检查前的饮食与用药注意事项、需要带上的既往资料，以及拿到报告后应重点关注哪些指标组合。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Help me prepare for a health checkup: which items to understand and what they mean, what to do about food and medication beforehand, what past records to bring, and which combinations of results deserve attention afterward.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-emotional-reset',
    category: 'health',
    title: { zh: '情绪调节', en: 'Emotional reset' },
    prompt: {
      zh: '我现在处于「{{state}}」的状态，请给出调节建议：3 个可以立刻做的小事、当天剩余的节奏安排、可以和谁说些什么，以及什么情况下应该寻求专业帮助。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'I am currently feeling "{{state}}". Give me suggestions: 3 small things I can do right now, how to pace the rest of the day, who to talk to and what to say, and when to seek professional help.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-family-care',
    category: 'health',
    title: { zh: '家庭照护安排', en: 'Family care plan' },
    prompt: {
      zh: '为「{{situation}}」设计家庭照护安排：日常照护事项清单与分工、需要准备的物品、观察记录要点、复诊与随访提醒，以及照护者自己的休息安排。\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Design a family care plan for "{{situation}}": the daily care task list with who does what, supplies to prepare, what to observe and record, follow-up appointment reminders, and how the caregiver gets rest.\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
  {
    id: 'health-lifestyle-audit',
    category: 'health',
    title: { zh: '生活方式自查', en: 'Lifestyle audit' },
    prompt: {
      zh: '帮我自查生活方式：从睡眠、饮食、运动、久坐时长、屏幕时间、社交与放松六个维度评估现状，指出最该优先改善的一项及具体做法：\n\n{{text}}\n\n（仅供参考，不构成医疗建议；如有健康问题请咨询医生。）',
      en: 'Help me audit my lifestyle: assess sleep, diet, exercise, sedentary hours, screen time, and social connection plus downtime, then point out the single highest-priority change and how to make it:\n\n{{text}}\n\n(General information only; not medical advice — consult a healthcare professional.)',
    },
  },
];
