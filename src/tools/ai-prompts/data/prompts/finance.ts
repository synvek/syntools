import type { PromptItem } from '../../types';

/** 财务与金融类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'finance-budget-plan',
    category: 'finance',
    title: { zh: '预算编制', en: 'Budget planning' },
    prompt: {
      zh: '帮我编制「{{period}}」预算：收入预测假设、固定与可变成本分类、人力与营销预算占比、预留应急比例、月度现金流节奏，并标注最敏感的 2 个假设。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Build a budget for "{{period}}": revenue assumptions, fixed versus variable costs, the share for people and marketing, contingency reserve, monthly cash flow pacing, and flag the 2 most sensitive assumptions.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-cost-analysis',
    category: 'finance',
    title: { zh: '成本结构分析', en: 'Cost structure analysis' },
    prompt: {
      zh: '分析下面的成本结构：区分固定与可变、单位成本随规模的变化趋势、可优化的成本项与优化手段，以及降本可能带来的风险：\n\n{{text}}\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Analyze the cost structure below: separate fixed from variable, how unit cost changes with scale, the costs that can be optimized and how, and the risks that cost cutting introduces:\n\n{{text}}\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-pricing-model',
    category: 'finance',
    title: { zh: '定价测算', en: 'Pricing model' },
    prompt: {
      zh: '为「{{product}}」做定价测算：成本加成法的底价、参考竞品与价值感知的合理区间、不同定价对毛利与规模的影响、三种定价策略的取舍。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Model pricing for "{{product}}": the floor from cost-plus, the reasonable range from competitors and perceived value, how different prices affect margin and volume, and the trade-offs of 3 pricing strategies.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-statement-reading',
    category: 'finance',
    title: { zh: '财务报表解读', en: 'Reading financial statements' },
    prompt: {
      zh: '解读下面这份财务数据：先给出三个结论（盈利能力 / 偿债能力 / 现金流质量），再指出异常科目与需要追问的问题，最后说明仅凭这些数据不能得出什么结论：\n\n{{text}}\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Interpret the financials below: start with 3 conclusions (profitability / solvency / cash flow quality), then flag unusual line items and the questions to ask, and finally state what these numbers alone cannot tell you:\n\n{{text}}\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-cash-flow-plan',
    category: 'finance',
    title: { zh: '现金流规划', en: 'Cash flow planning' },
    prompt: {
      zh: '为「{{business}}」做 12 个月现金流规划：收款周期与账期假设、主要支出时间点、资金缺口出现的最早月份与规模、可提前采取的三项措施。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Plan 12 months of cash flow for "{{business}}": assumptions about collection cycles and payment terms, when major outflows land, the earliest month a funding gap appears and its size, and 3 actions to take in advance.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-investment-thesis',
    category: 'finance',
    title: { zh: '投资逻辑梳理', en: 'Investment thesis' },
    prompt: {
      zh: '梳理对「{{target}}」的投资逻辑：3 条核心论点、支撑数据、关键假设与验证方式、主要风险与反方观点，以及在什么情况下这个逻辑不再成立。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Lay out the investment thesis for "{{target}}": 3 core arguments, the supporting data, the key assumptions and how to test them, the main risks and the bear case, and what would invalidate the thesis.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-expense-review',
    category: 'finance',
    title: { zh: '费用审查', en: 'Expense review' },
    prompt: {
      zh: '审查下面的费用明细：区分必要支出与可压缩支出、找出重复或低效投入、标注异常增长项，并给出压缩 10% 与 20% 两种方案下优先削减的项：\n\n{{text}}\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Review the expense detail below: separate essential from compressible spending, find duplicated or low-return items, flag abnormal growth, and list what to cut first under a 10% and a 20% reduction scenario:\n\n{{text}}\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-roi-model',
    category: 'finance',
    title: { zh: '投入产出测算', en: 'ROI model' },
    prompt: {
      zh: '帮我测算「{{investment}}」的投入产出：一次性与持续成本、收益来源与实现周期、回本周期、乐观与保守两套测算，以及最需要验证的关键变量。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Model the return on "{{investment}}": one-off and ongoing costs, revenue sources and the time to realize them, payback period, optimistic and conservative scenarios, and the variable most in need of validation.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-fundraising-outline',
    category: 'finance',
    title: { zh: '融资材料提纲', en: 'Fundraising outline' },
    prompt: {
      zh: '为「{{project}}」准备融资材料提纲：问题与市场、解决方案与壁垒、数据进展（含关键指标）、财务预测框架、资金用途、团队与融资需求。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Outline fundraising materials for "{{project}}": problem and market, solution and moat, traction with key metrics, financial projection framework, use of funds, team, and the ask.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-tax-points',
    category: 'finance',
    title: { zh: '税务要点梳理', en: 'Tax considerations' },
    prompt: {
      zh: '梳理「{{scenario}}」涉及的税务要点：可能涉及的税种、计税依据与时间点、可用的优惠或抵扣、需要留存的凭证，并提醒哪些事项需要咨询专业税务顾问。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Outline the tax points relevant to "{{scenario}}": the tax types likely involved, the basis and timing, available incentives or deductions, the records to keep, and which items require a professional tax advisor.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-ratio-analysis',
    category: 'finance',
    title: { zh: '财务比率分析', en: 'Ratio analysis' },
    prompt: {
      zh: '计算并解释下面数据的财务比率：毛利率、净利率、流动比率、资产负债率、周转天数，说明每个比率的含义与行业参考范围，并指出数据缺口：\n\n{{text}}\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'Calculate and explain the financial ratios from the data below: gross margin, net margin, current ratio, debt-to-assets, and days of turnover. Explain what each means and a typical industry range, and note the data gaps:\n\n{{text}}\n\n(For general reference only; not financial or investment advice.)',
    },
  },
  {
    id: 'finance-risk-checklist',
    category: 'finance',
    title: { zh: '财务风险清单', en: 'Financial risk checklist' },
    prompt: {
      zh: '为「{{business}}」列出财务风险清单：按现金流、应收账款、成本结构、合规、汇率与客户集中度分类，每条给出预警指标与应对预案。\n\n（仅供参考，不构成投资或财务建议。）',
      en: 'List the financial risks for "{{business}}" by category — cash flow, receivables, cost structure, compliance, FX, and customer concentration — with an early warning indicator and a contingency plan for each.\n\n(For general reference only; not financial or investment advice.)',
    },
  },
];
