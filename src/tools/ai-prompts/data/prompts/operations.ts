import type { PromptItem } from '../../types';

/** 运营与增长类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'operations-growth-experiment',
    category: 'operations',
    title: { zh: '增长实验设计', en: 'Growth experiment design' },
    prompt: {
      zh: '为「{{goal}}」设计增长实验：假设、对照组与实验组、变体设计、样本量与周期估算、衡量指标（含护栏指标）、上线与回滚条件。',
      en: 'Design a growth experiment for "{{goal}}": hypothesis, control and variant, variant design, sample size and duration estimate, success metrics (with guardrails), and launch/rollback conditions.',
    },
  },
  {
    id: 'operations-content-calendar',
    category: 'operations',
    title: { zh: '内容日历', en: 'Content calendar' },
    prompt: {
      zh: '为「{{product}}」制定一个月的 {{channel}} 内容日历：按周给出主题、每篇的选题、形式（图文 / 视频 / 直播）、发布时间、目标人群与衡量指标。用表格输出。',
      en: 'Build a one-month {{channel}} content calendar for "{{product}}": weekly themes, each piece\'s topic, format (post / video / livestream), publish time, audience, and metric. Output as a table.',
    },
  },
  {
    id: 'operations-user-segmentation',
    category: 'operations',
    title: { zh: '用户分层', en: 'User segmentation' },
    prompt: {
      zh: '为「{{product}}」设计用户分层：分层维度与阈值、每层用户的特征与核心诉求、对应的运营动作，以及从一层迁到下一层的关键指标。',
      en: 'Design user segments for "{{product}}": the dimensions and thresholds, each segment\'s traits and core needs, the operations action for each, and the key metric that moves a user to the next tier.',
    },
  },
  {
    id: 'operations-retention-recall',
    category: 'operations',
    title: { zh: '留存与召回', en: 'Retention and win-back' },
    prompt: {
      zh: '为「{{product}}」设计留存与召回策略：定义流失（阈值与时间窗）、召回触达渠道与话术、召回激励设计，以及衡量召回效果的口径。',
      en: 'Design retention and win-back for "{{product}}": define churn (threshold and window), the re-engagement channels and copy, the incentive, and how to measure whether it worked.',
    },
  },
  {
    id: 'operations-dashboard-design',
    category: 'operations',
    title: { zh: '数据看板设计', en: 'Dashboard design' },
    prompt: {
      zh: '为「{{team}}」设计运营数据看板：核心指标区、趋势区、维度下钻区、异常提示项，并说明每个指标的更新频率、数据来源与责任人。',
      en: 'Design an operations dashboard for "{{team}}": a headline metrics area, trends, dimension drill-downs, and anomaly alerts. State the refresh frequency, data source, and owner for each metric.',
    },
  },
  {
    id: 'operations-campaign-recap',
    category: 'operations',
    title: { zh: '活动复盘', en: 'Campaign recap' },
    prompt: {
      zh: '复盘这次运营活动：目标与实际结果对比、各渠道的投入产出、超出与未达预期的原因、可复用的做法，以及下次要改的 3 点。数据：\n\n{{text}}',
      en: 'Review this campaign: target versus actual results, channel-by-channel return, why things over- or under-performed, what is reusable, and 3 changes for next time. Data:\n\n{{text}}',
    },
  },
  {
    id: 'operations-lifecycle-messaging',
    category: 'operations',
    title: { zh: '生命周期触达', en: 'Lifecycle messaging' },
    prompt: {
      zh: '为「{{product}}」设计生命周期触达：新用户（0-7 天）、活跃用户、沉睡用户、流失用户各阶段的触达时机、渠道、内容要点与频率上限。',
      en: 'Design lifecycle messaging for "{{product}}": for new (day 0–7), active, dormant, and churned users, specify the timing, channel, message focus, and frequency cap.',
    },
  },
  {
    id: 'operations-community-rules',
    category: 'operations',
    title: { zh: '社群规则', en: 'Community rules' },
    prompt: {
      zh: '为「{{community}}」制定社群规则：3 条核心原则、具体行为清单（鼓励 / 禁止）、违规处理梯度、日常互动节奏与管理员职责。',
      en: 'Draft rules for the "{{community}}" community: 3 core principles, a concrete behavior list (encouraged / prohibited), a graduated enforcement ladder, a daily interaction rhythm, and moderator duties.',
    },
  },
  {
    id: 'operations-referral-program',
    category: 'operations',
    title: { zh: '推荐裂变方案', en: 'Referral program' },
    prompt: {
      zh: '为「{{product}}」设计推荐裂变方案：推荐人与被推荐人的双向激励、触发时机、分享路径与素材、防刷机制、衡量指标与目标值。',
      en: 'Design a referral program for "{{product}}": two-sided incentives, the trigger moment, the share path and assets, anti-abuse rules, and the metric with a target value.',
    },
  },
  {
    id: 'operations-channel-mix',
    category: 'operations',
    title: { zh: '渠道组合规划', en: 'Channel mix planning' },
    prompt: {
      zh: '为「{{product}}」规划渠道组合：列出候选渠道、各自的获客成本与规模预估、内容形式的适配度、优先级排序，以及先做深哪 2 个渠道。',
      en: 'Plan the channel mix for "{{product}}": list candidate channels, their estimated CAC and volume, how well each fits the content format, a priority ranking, and which 2 to go deep on first.',
    },
  },
  {
    id: 'operations-target-breakdown',
    category: 'operations',
    title: { zh: '经营目标拆解', en: 'Target breakdown' },
    prompt: {
      zh: '把「{{target}}」拆解到可执行的运营动作：按渠道、人群、时间三个维度拆，给出每个子目标、所需资源与关键假设，并标注哪些假设最不确定。',
      en: 'Break the target "{{target}}" into executable actions: split by channel, audience, and time, then give each sub-goal, the resources required, and the key assumptions (flag the least certain ones).',
    },
  },
  {
    id: 'operations-crisis-response',
    category: 'operations',
    title: { zh: '舆情与危机应对', en: 'Crisis response' },
    prompt: {
      zh: '为「{{scenario}}」类突发情况准备应对方案：内部上报与决策流程、对外声明的 3 段结构（事实 / 态度 / 行动）、各渠道口径一致性检查清单、24 小时与 7 天跟进动作。',
      en: 'Prepare a response plan for a "{{scenario}}" incident: the internal escalation and decision flow, a 3-part public statement (facts / stance / actions), a consistency checklist across channels, and follow-up actions at 24 hours and 7 days.',
    },
  },
];
