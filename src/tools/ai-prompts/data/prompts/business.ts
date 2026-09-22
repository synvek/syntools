import type { PromptItem } from '../../types';

/** 商业与战略类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'business-model-canvas',
    category: 'business',
    title: { zh: '商业模式画布', en: 'Business model canvas' },
    prompt: {
      zh: '用商业模式画布梳理「{{business}}」：客户细分、价值主张、渠道、客户关系、收入来源、核心资源、关键活动、关键合作、成本结构。每格给 2-3 条具体描述，并指出最薄弱的 1-2 格。',
      en: 'Map "{{business}}" onto a Business Model Canvas: customer segments, value proposition, channels, customer relationships, revenue streams, key resources, key activities, key partners, cost structure. Give 2–3 concrete points per block and flag the 1–2 weakest blocks.',
    },
  },
  {
    id: 'business-swot',
    category: 'business',
    title: { zh: 'SWOT 分析', en: 'SWOT analysis' },
    prompt: {
      zh: '对「{{subject}}」做 SWOT 分析：每个象限 4 条，最后给出 4 条基于组合的策略建议（SO / ST / WO / WT）。',
      en: 'Run a SWOT analysis for "{{subject}}": 4 points per quadrant, then 4 strategy suggestions built from the combinations (SO / ST / WO / WT).',
    },
  },
  {
    id: 'business-market-entry',
    category: 'business',
    title: { zh: '市场进入策略', en: 'Market entry strategy' },
    prompt: {
      zh: '为「{{product}}」进入「{{market}}」制定策略：市场容量估算思路、目标客群、进入方式（自建 / 合作 / 收购）、定价与渠道、18 个月里程碑、主要风险与应对。',
      en: 'Plan how "{{product}}" enters "{{market}}": a sizing approach, target segments, entry mode (build / partner / acquire), pricing and channels, 18-month milestones, and key risks with mitigations.',
    },
  },
  {
    id: 'business-plan-outline',
    category: 'business',
    title: { zh: '商业计划书提纲', en: 'Business plan outline' },
    prompt: {
      zh: '为「{{project}}」写商业计划书提纲：问题与机会、解决方案、市场规模、商业模式、竞争壁垒、团队、财务预测框架、融资需求。每章列出要点与需要补充的数据。',
      en: 'Outline a business plan for "{{project}}": problem and opportunity, solution, market size, business model, moat, team, financial projection framework, and funding needs. List the key points and the data still needed for each section.',
    },
  },
  {
    id: 'business-decision-tradeoff',
    category: 'business',
    title: { zh: '决策权衡建议', en: 'Decision trade-off' },
    prompt: {
      zh: '我要在下面几个选项中做决策，请按「结论先行 → 理由 → 风险」给出建议，并说明如果哪些前提变化结论会反转：\n\n选项与背景：\n{{text}}',
      en: 'I need to choose among the options below. Recommend one as "conclusion first, then rationale, then risks", and explain which changed assumptions would flip the conclusion:\n\nOptions and context:\n{{text}}',
    },
  },
  {
    id: 'business-unit-economics',
    category: 'business',
    title: { zh: '单位经济模型', en: 'Unit economics' },
    prompt: {
      zh: '帮我搭建「{{business}}」的单位经济模型：列出关键变量（客单价、转化率、获客成本、复购率、毛利率），说明每个变量的计算口径，并指出对盈亏平衡影响最敏感的两个变量。',
      en: 'Build the unit economics model for "{{business}}": list the key variables (ARPU, conversion rate, CAC, repeat rate, gross margin), define how each is calculated, and identify the two variables that move break-even the most.',
    },
  },
  {
    id: 'business-partnership-proposal',
    category: 'business',
    title: { zh: '合作提案', en: 'Partnership proposal' },
    prompt: {
      zh: '为「{{partnerType}}」类型的潜在合作方写一份合作提案：双方诉求、合作形式、价值分配、试点方案与成功标准、下一步行动。我方资源：\n\n{{text}}',
      en: 'Write a partnership proposal for a potential "{{partnerType}}" partner: each side\'s interests, the collaboration model, value split, a pilot plan with success criteria, and next steps. Our assets:\n\n{{text}}',
    },
  },
  {
    id: 'business-kpi-tree',
    category: 'business',
    title: { zh: '指标树拆解', en: 'KPI tree' },
    prompt: {
      zh: '把「{{goal}}」拆成指标树：顶层北极星指标、二级驱动指标、三级可执行指标，标注每个指标的计算公式与责任角色，并指出哪些指标容易被「做假」。',
      en: 'Break "{{goal}}" into a metric tree: a north-star metric, second-level drivers, and third-level actionable metrics. Note the formula and owner for each, and flag which ones are easy to game.',
    },
  },
  {
    id: 'business-risk-register',
    category: 'business',
    title: { zh: '风险清单', en: 'Risk register' },
    prompt: {
      zh: '为「{{project}}」建立风险清单：按类别（市场 / 技术 / 资金 / 合规 / 团队）列出风险，每条给出可能性、影响程度、预警信号与应对措施。请用表格输出并按优先级排序。',
      en: 'Build a risk register for "{{project}}": list risks by category (market / technical / financial / compliance / team) with likelihood, impact, early warning signal, and mitigation. Output as a table sorted by priority.',
    },
  },
  {
    id: 'business-growth-model',
    category: 'business',
    title: { zh: '增长模型梳理', en: 'Growth model' },
    prompt: {
      zh: '为「{{product}}」梳理增长模型：写出增长公式（如 新增 = 流量 × 转化率），列出可介入的杠杆点，并估算每个杠杆的提升空间与实现难度。',
      en: 'Model growth for "{{product}}": write the growth equation (e.g. new users = traffic × conversion), list the levers available, and estimate the upside and difficulty of each lever.',
    },
  },
  {
    id: 'business-moat-analysis',
    category: 'business',
    title: { zh: '竞争壁垒分析', en: 'Moat analysis' },
    prompt: {
      zh: '分析「{{product}}」的竞争壁垒：现有壁垒类型（网络效应 / 规模效应 / 转换成本 / 品牌 / 技术）、可持续性评估、最可能被突破的环节，以及加固建议。',
      en: 'Analyze the moat of "{{product}}": current moat types (network effects / scale / switching cost / brand / technology), a durability assessment, the weakest link, and how to reinforce it.',
    },
  },
  {
    id: 'business-strategy-session',
    category: 'business',
    title: { zh: '战略会议准备', en: 'Strategy session prep' },
    prompt: {
      zh: '帮我准备一次战略讨论会：需要提前对齐的 3 个事实、需要决策的 2 个议题（各附 2 个方案与取舍分析）、可能出现的反对意见，以及会议决策记录模板。背景：\n\n{{text}}',
      en: 'Help me prepare a strategy session: 3 facts to align on beforehand, 2 decision items (each with 2 options and the trade-offs), likely objections, and a template for the decision record. Context:\n\n{{text}}',
    },
  },
];
