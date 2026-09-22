import type { PromptItem } from '../../types';

/** 学术与研究类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'research-literature-review',
    category: 'research',
    title: { zh: '文献综述框架', en: 'Literature review framework' },
    prompt: {
      zh: '围绕「{{topic}}」梳理文献综述框架：研究脉络的三个阶段、主要流派与代表观点、争议焦点、研究空白，并给出检索关键词与数据库建议。',
      en: 'Draft a literature review framework around "{{topic}}": three phases in the research lineage, the main schools and their positions, points of disagreement, and the gap, plus search keywords and database suggestions.',
    },
  },
  {
    id: 'research-question-refine',
    category: 'research',
    title: { zh: '研究问题打磨', en: 'Refine the research question' },
    prompt: {
      zh: '帮我打磨研究问题：把「{{topic}}」拆成 3 个可检验的子问题，每个给出变量、假设、所需数据与可能的混淆因素，并指出最值得做的一个及理由。',
      en: 'Help me refine my research question: split "{{topic}}" into 3 testable sub-questions, each with variables, a hypothesis, the data required, and likely confounders, and say which is most worth pursuing and why.',
    },
  },
  {
    id: 'research-methodology-design',
    category: 'research',
    title: { zh: '研究方法设计', en: 'Methodology design' },
    prompt: {
      zh: '为「{{question}}」设计研究方法：研究设计类型（实验 / 准实验 / 调查 / 案例）、抽样方式与样本量考虑、测量工具、数据收集流程、伦理审查要点与分析计划。',
      en: 'Design the methodology for "{{question}}": the design type (experimental / quasi-experimental / survey / case study), sampling approach and sample size considerations, instruments, data collection procedure, ethics review points, and the analysis plan.',
    },
  },
  {
    id: 'research-abstract',
    category: 'research',
    title: { zh: '论文摘要', en: 'Abstract' },
    prompt: {
      zh: '为下面的研究写一段摘要（250 字内）：背景与问题、方法、主要发现（含量化结果）、结论与意义。避免引用文献与缩写：\n\n{{text}}',
      en: 'Write an abstract (under 250 words) for the study below: background and problem, method, key findings with quantitative results, and conclusion with implications. Avoid citations and abbreviations:\n\n{{text}}',
    },
  },
  {
    id: 'research-hypotheses',
    category: 'research',
    title: { zh: '假设构建', en: 'Hypothesis formulation' },
    prompt: {
      zh: '为「{{topic}}」构建 3 个可证伪的假设：每个给出自变量、因变量、预期方向与理论依据，并设计一个能推翻它的观察结果。',
      en: 'Formulate 3 falsifiable hypotheses about "{{topic}}": each with independent and dependent variables, the expected direction, the theoretical basis, and an observation that would refute it.',
    },
  },
  {
    id: 'research-method-critique',
    category: 'research',
    title: { zh: '研究方法审查', en: 'Method critique' },
    prompt: {
      zh: '审查下面研究设计的方法问题：抽样偏差、混淆变量、测量效度、统计方法适配性、因果推断是否成立。按严重程度排序并给出改进建议：\n\n{{text}}',
      en: 'Review the methodological issues in the study design below: sampling bias, confounders, measurement validity, whether the statistics fit, and whether causal claims hold. Rank by severity and suggest improvements:\n\n{{text}}',
    },
  },
  {
    id: 'research-peer-review',
    category: 'research',
    title: { zh: '审稿意见', en: 'Peer review' },
    prompt: {
      zh: '为下面这篇稿件写审稿意见：一句话总体评价、3 条主要问题（每条说明为什么重要与如何修改）、2 条次要问题、最终建议（接受 / 小修 / 大修 / 拒稿）及理由：\n\n{{text}}',
      en: 'Write a peer review for the manuscript below: a one-line overall assessment, 3 major issues (why each matters and how to address it), 2 minor issues, and a recommendation (accept / minor revision / major revision / reject) with reasoning:\n\n{{text}}',
    },
  },
  {
    id: 'research-discussion-section',
    category: 'research',
    title: { zh: '结果讨论', en: 'Discussion section' },
    prompt: {
      zh: '根据下面的研究结果写讨论部分：主要发现复述、与既有文献的一致与冲突之处、可能的解释机制、局限性与替代解释、理论与实践启示：\n\n{{text}}',
      en: 'Write the discussion section based on the results below: restate the key findings, where they agree and conflict with existing literature, plausible mechanisms, limitations and alternative explanations, and theoretical and practical implications:\n\n{{text}}',
    },
  },
  {
    id: 'research-questionnaire-design',
    category: 'research',
    title: { zh: '问卷设计', en: 'Questionnaire design' },
    prompt: {
      zh: '为「{{topic}}」设计一份问卷：构念与维度、每个维度 3-4 道题、题型与量表选择、反向计题设置、填答时长控制，以及需要先做预测试的题目。',
      en: 'Design a questionnaire for "{{topic}}": constructs and dimensions, 3–4 items per dimension, question types and scale choice, reverse-coded items, target completion time, and which items need pilot testing.',
    },
  },
  {
    id: 'research-citation-format',
    category: 'research',
    title: { zh: '引用格式整理', en: 'Citation formatting' },
    prompt: {
      zh: '把下面的参考文献整理成 {{style}} 格式，并检查：作者名顺序、年份、期刊名斜体、卷期页码、DOI 是否缺失、中英文文献混排规则：\n\n{{text}}',
      en: 'Format the references below in {{style}} and check author order, year, journal italics, volume / issue / pages, missing DOIs, and the rules for mixing English and non-English sources:\n\n{{text}}',
    },
  },
  {
    id: 'research-gap-identification',
    category: 'research',
    title: { zh: '研究空白识别', en: 'Research gap identification' },
    prompt: {
      zh: '根据下面的文献摘要识别研究空白：已被反复验证的结论、结论相互矛盾的领域、尚未研究的人群或场景、方法上的不足，并给出 3 个可行的选题方向：\n\n{{text}}',
      en: 'Based on the abstracts below, identify the research gap: findings that are well replicated, areas with contradictory results, populations or settings not yet studied, and methodological weaknesses, then propose 3 feasible research topics:\n\n{{text}}',
    },
  },
  {
    id: 'research-presentation-outline',
    category: 'research',
    title: { zh: '学术汇报提纲', en: 'Conference talk outline' },
    prompt: {
      zh: '为「{{topic}}」准备 15 分钟学术汇报：每页幻灯的主题与要点、时间分配、需要强调的核心贡献，以及预判的 3 个提问与回答思路。',
      en: 'Prepare a 15-minute academic talk on "{{topic}}": the topic and key points of each slide, time allocation, the core contribution to emphasize, and 3 anticipated questions with answer outlines.',
    },
  },
];
