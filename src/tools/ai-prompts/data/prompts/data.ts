import type { PromptItem } from '../../types';

/** 数据分析类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'data-metric-definition',
    category: 'data',
    title: { zh: '指标定义', en: 'Metric definition' },
    prompt: {
      zh: '为「{{metric}}」写指标定义：业务含义、计算公式、统计粒度、数据来源表、口径边界（包含与不包含的情况）、常见误用方式。',
      en: 'Define the metric "{{metric}}": business meaning, formula, aggregation grain, source table, boundary cases (what is included and excluded), and common misuses.',
    },
  },
  {
    id: 'data-sql-approach',
    category: 'data',
    title: { zh: 'SQL 取数思路', en: 'SQL approach' },
    prompt: {
      zh: '针对下面的取数需求，写出 SQL 思路：需要的表与关联关系、过滤条件、聚合维度、去重逻辑、可能的性能问题与优化方式。需求：\n\n{{text}}',
      en: 'For the data request below, outline the SQL approach: the tables and joins needed, filters, aggregation dimensions, dedup logic, and likely performance issues with optimizations. Request:\n\n{{text}}',
    },
  },
  {
    id: 'data-interpretation',
    category: 'data',
    title: { zh: '数据解读', en: 'Data interpretation' },
    prompt: {
      zh: '解读下面的数据：先给结论，再指出支撑结论的关键数字、异常点与需要注意的口径问题，最后列出还需要补充哪些数据才能确认结论：\n\n{{text}}',
      en: 'Interpret the data below: lead with the conclusion, then the key numbers supporting it, anomalies, and definitional caveats, and finally what additional data would confirm the conclusion:\n\n{{text}}',
    },
  },
  {
    id: 'data-ab-test-analysis',
    category: 'data',
    title: { zh: 'A/B 实验分析', en: 'A/B test analysis' },
    prompt: {
      zh: '分析这次 A/B 实验：对照与实验组的核心指标差异、置信区间与显著性判断、样本量是否充足、是否存在分流不均或提前停止的问题、最终建议（上线 / 扩大实验 / 放弃）：\n\n{{text}}',
      en: 'Analyze this A/B test: the difference in the primary metric, confidence interval and significance, whether the sample was sufficient, whether there was uneven assignment or premature stopping, and the recommendation (ship / extend / stop):\n\n{{text}}',
    },
  },
  {
    id: 'data-chart-selection',
    category: 'data',
    title: { zh: '图表选型', en: 'Chart selection' },
    prompt: {
      zh: '我有一组「{{dataShape}}」的数据，想表达「{{intent}}」。请推荐 2-3 种合适的图表类型并说明理由，同时指出容易误导的图表做法。',
      en: 'I have data shaped like "{{dataShape}}" and want to show "{{intent}}". Recommend 2–3 suitable chart types with reasoning, and point out charting choices that would mislead.',
    },
  },
  {
    id: 'data-funnel-analysis',
    category: 'data',
    title: { zh: '漏斗分析设计', en: 'Funnel analysis' },
    prompt: {
      zh: '帮我设计漏斗分析：定义各步骤与转化口径、指出每一步最可能的流失原因、列出需要拆分的维度（渠道 / 人群 / 设备），以及优化优先级的判断方式。背景：\n\n{{text}}',
      en: 'Design a funnel analysis: define each step and how conversion is counted, identify the most likely drop-off reason at each step, list the dimensions to break down by (channel / audience / device), and how to decide the optimization priority. Context:\n\n{{text}}',
    },
  },
  {
    id: 'data-anomaly-investigation',
    category: 'data',
    title: { zh: '指标异常排查', en: 'Anomaly investigation' },
    prompt: {
      zh: '指标出现异常波动，请给出排查清单：按「数据问题 → 产品改动 → 外部事件 → 用户结构变化」的顺序列出要检查的项，每项说明检查方法与判定标准。现象：\n\n{{text}}',
      en: 'A metric moved unexpectedly. Give me a checklist in this order — data issue, product change, external event, user-mix shift — with the check and the decision rule for each. Symptom:\n\n{{text}}',
    },
  },
  {
    id: 'data-cohort-analysis',
    category: 'data',
    title: { zh: '同期群分析', en: 'Cohort analysis' },
    prompt: {
      zh: '设计一次同期群分析：分组维度（注册时间 / 获客渠道 / 首次行为）、观察指标与时间窗、需要对比的群组，以及如何从结果中区分「产品改善」与「人群结构变化」。',
      en: 'Design a cohort analysis: grouping dimensions (signup month / acquisition channel / first action), the metric and time window, which cohorts to compare, and how to tell product improvement apart from a shift in user mix.',
    },
  },
  {
    id: 'data-report-outline',
    category: 'data',
    title: { zh: '数据报告提纲', en: 'Data report outline' },
    prompt: {
      zh: '为「{{topic}}」写数据报告提纲：结论摘要（3 条）、分析背景与口径说明、核心发现及证据、异常与不确定项、建议行动与后续验证方式。',
      en: 'Outline a data report on "{{topic}}": an executive summary of 3 conclusions, background and metric definitions, key findings with evidence, anomalies and uncertainties, and recommended actions with how to verify them later.',
    },
  },
  {
    id: 'data-dashboard-metrics',
    category: 'data',
    title: { zh: '看板指标选择', en: 'Dashboard metrics' },
    prompt: {
      zh: '为「{{role}}」设计看板指标：首选 5 个指标（说明为什么选它）、每个指标的对比基准与预警阈值、需要下钻的维度，并指出应剔除的虚荣指标。',
      en: 'Design dashboard metrics for a "{{role}}": 5 primary metrics with why each was chosen, the comparison baseline and alert threshold for each, the drill-down dimensions, and which vanity metrics to drop.',
    },
  },
  {
    id: 'data-cleaning-plan',
    category: 'data',
    title: { zh: '数据清洗方案', en: 'Data cleaning plan' },
    prompt: {
      zh: '为下面的数据集设计清洗方案：缺失值处理策略、异常值判定规则、重复与冲突记录处理、字段标准化（时间 / 单位 / 分类），以及每一步对最终结论可能造成的影响：\n\n{{text}}',
      en: 'Design a cleaning plan for the dataset below: how to handle missing values, rules for outlier detection, how to treat duplicates and conflicting records, field standardization (time / units / categories), and how each step could bias the final conclusion:\n\n{{text}}',
    },
  },
  {
    id: 'data-insight-to-action',
    category: 'data',
    title: { zh: '洞察转行动', en: 'Insight to action' },
    prompt: {
      zh: '把下面的数据洞察转成可执行行动：每条洞察对应的业务问题、可采取的具体动作、预期影响与验证方式、负责角色，并标注哪些洞察暂不具备行动条件：\n\n{{text}}',
      en: 'Turn the insights below into actions: for each, the business question, the concrete action, the expected impact and how to verify it, and the owner, and flag which insights are not yet actionable:\n\n{{text}}',
    },
  },
];
