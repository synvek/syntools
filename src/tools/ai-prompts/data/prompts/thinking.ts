import type { PromptItem } from '../../types';

/** 思维与决策类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'thinking-brainstorm',
    category: 'thinking',
    title: { zh: '多角度头脑风暴', en: 'Brainstorming' },
    prompt: {
      zh: '围绕「{{topic}}」做头脑风暴：先从 4 个不同的切入角度各产出 5 个想法（先不评价可行性），再挑出 5 个最有潜力的并说明理由。',
      en: 'Brainstorm around "{{topic}}": generate 5 ideas from each of 4 different entry angles without judging feasibility yet, then pick the 5 most promising and explain why.',
    },
  },
  {
    id: 'thinking-first-principles',
    category: 'thinking',
    title: { zh: '第一性原理', en: 'First principles' },
    prompt: {
      zh: '用第一性原理分析「{{problem}}」：把问题拆到不可再分的基本事实与约束，指出哪些前提只是「一直这么做」而非必然，再基于基本事实重建 3 个方案。',
      en: 'Analyze "{{problem}}" from first principles: break it down to basic facts and constraints, identify which premises are convention rather than necessity, then rebuild 3 options from those fundamentals.',
    },
  },
  {
    id: 'thinking-decision-matrix',
    category: 'thinking',
    title: { zh: '决策矩阵', en: 'Decision matrix' },
    prompt: {
      zh: '帮我做决策矩阵：列出「{{decision}}」的候选方案与评估维度，给出权重与打分，计算加权得分并排序，最后说明哪些权重变化会改变结论。',
      en: 'Build a decision matrix for "{{decision}}": list the candidate options and evaluation criteria, assign weights and scores, compute the weighted totals and rank, and note which weight changes would flip the result.',
    },
  },
  {
    id: 'thinking-strongest-counterargument',
    category: 'thinking',
    title: { zh: '最强反驳清单', en: 'Strongest counterarguments' },
    prompt: {
      zh: '我准备采取「{{plan}}」，请扮演最理性的反对者：列出 5 条最强的反驳（不要稻草人），每条说明它成立需要什么条件，并给出我应如何应对或修正计划。',
      en: 'I plan to do "{{plan}}". Play the most reasonable opponent: give the 5 strongest counterarguments (no straw men), state what would have to be true for each to hold, and how I should respond or revise the plan.',
    },
  },
  {
    id: 'thinking-assumption-check',
    category: 'thinking',
    title: { zh: '假设检验', en: 'Assumption check' },
    prompt: {
      zh: '把「{{plan}}」依赖的假设列出来：区分「已验证 / 可验证 / 无法验证」，对可验证的假设给出最低成本的验证方式与判定标准，并指出哪个假设一旦不成立计划就失效。',
      en: 'List the assumptions "{{plan}}" depends on: separate verified / testable / untestable, give the cheapest way to test each testable one with a pass criterion, and identify which assumption would sink the plan if false.',
    },
  },
  {
    id: 'thinking-five-whys',
    category: 'thinking',
    title: { zh: '根因追问', en: 'Root-cause analysis' },
    prompt: {
      zh: '用 5 Why 分析这个问题：连续追问直到找到可操作的根因，指出哪些层是现象、哪些是根因，并针对根因给出 2 个改进措施。问题：\n\n{{text}}',
      en: 'Run a 5 Whys analysis on this problem: keep asking until you reach an actionable root cause, mark which layers are symptoms versus root causes, and give 2 fixes aimed at the root. Problem:\n\n{{text}}',
    },
  },
  {
    id: 'thinking-tradeoff-map',
    category: 'thinking',
    title: { zh: '取舍分析', en: 'Trade-off analysis' },
    prompt: {
      zh: '分析「{{choice}}」的取舍：列出每个选项在时间、成本、风险、可逆性与长期收益五个维度的表现，指出哪些取舍无法避免、哪些可以通过设计规避。',
      en: 'Analyze the trade-offs in "{{choice}}": rate each option on time, cost, risk, reversibility, and long-term payoff, then identify which trade-offs are unavoidable and which can be designed around.',
    },
  },
  {
    id: 'thinking-pre-mortem',
    category: 'thinking',
    title: { zh: '事前验尸', en: 'Pre-mortem' },
    prompt: {
      zh: '对「{{plan}}」做事前验尸：假设一年后彻底失败，写出 6 个最可能的原因、每个原因的早期信号、现在就能采取的预防措施，以及一个可以叫停的判断点。',
      en: 'Run a pre-mortem on "{{plan}}": assume it failed completely a year from now, write the 6 most likely causes, the early signal for each, the preventive action to take now, and one checkpoint where you would pull the plug.',
    },
  },
  {
    id: 'thinking-second-order-effects',
    category: 'thinking',
    title: { zh: '二阶影响分析', en: 'Second-order effects' },
    prompt: {
      zh: '分析「{{decision}}」的二阶与三阶影响：直接结果、一周后、一季度后、一年后的连锁反应，并指出哪些短期收益会带来长期成本。',
      en: 'Analyze the second- and third-order effects of "{{decision}}": the immediate result, the effect after a week, a quarter, and a year, and which short-term gains create long-term costs.',
    },
  },
  {
    id: 'thinking-scope-cut',
    category: 'thinking',
    title: { zh: '最小可行范围', en: 'Minimum viable scope' },
    prompt: {
      zh: '帮我把「{{plan}}」裁剪到最小可行范围：保留哪些必要部分、可以推迟哪些、可以完全去掉哪些，并说明裁剪后仍能验证的核心假设是什么。',
      en: 'Trim "{{plan}}" down to its minimum viable scope: what must stay, what can be deferred, what can be dropped entirely, and which core assumption it can still validate at that size.',
    },
  },
  {
    id: 'thinking-criteria-clarity',
    category: 'thinking',
    title: { zh: '判断标准澄清', en: 'Clarify the criteria' },
    prompt: {
      zh: '帮我把「{{choice}}」的判断标准说清楚：区分「必须满足」与「越优越好」的条件、给每项设一个可衡量的阈值，并指出标准之间可能冲突的地方。',
      en: 'Help me clarify the criteria for "{{choice}}": separate must-haves from nice-to-haves, set a measurable threshold for each, and point out where the criteria conflict.',
    },
  },
  {
    id: 'thinking-partner-questions',
    category: 'thinking',
    title: { zh: '思考伙伴提问', en: 'Thinking-partner questions' },
    prompt: {
      zh: '请你作为我的思考伙伴，就「{{topic}}」向我提问：一次只问一个问题，逐步帮我理清真正的目标与约束，不要急于给建议，等我回答后再追问。',
      en: 'Be my thinking partner on "{{topic}}": ask me one question at a time, help me surface the real goal and constraints step by step, and hold off on advice until I answer, then follow up.',
    },
  },
];
