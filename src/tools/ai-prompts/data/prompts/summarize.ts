import type { PromptItem } from '../../types';

/** 摘要与提炼类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'summarize-long-document',
    category: 'summarize',
    title: { zh: '长文摘要', en: 'Long document summary' },
    prompt: {
      zh: '为下面的长文写摘要：先用一句话概括核心结论，再给出 5 条要点（每条不超过 30 字），最后列出文中提到的关键数据：\n\n{{text}}',
      en: 'Summarize the long text below: start with one sentence on the core conclusion, then 5 bullet points (max 30 words each), and finally list the key figures mentioned:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-meeting-conclusions',
    category: 'summarize',
    title: { zh: '会议结论提炼', en: 'Meeting conclusions' },
    prompt: {
      zh: '把下面的会议记录提炼成结论：达成的决定、待办（负责人 + 时间）、未解决的问题、被否掉的方案及原因。不要复述讨论过程：\n\n{{text}}',
      en: 'Distill the meeting notes below into conclusions: decisions made, action items (owner + date), open issues, and rejected options with reasons. Do not replay the discussion:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-action-items',
    category: 'summarize',
    title: { zh: '提取行动项', en: 'Extract action items' },
    prompt: {
      zh: '从下面的内容中提取所有行动项：按负责人分组，每项包含动作、完成标准与时间点；对没有明确责任人的项单独列出并标注需要确认：\n\n{{text}}',
      en: 'Extract every action item from the content below: group by owner, with the action, the definition of done, and the timing. List items with no clear owner separately and flag them as needing confirmation:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-key-points',
    category: 'summarize',
    title: { zh: '要点清单', en: 'Key point list' },
    prompt: {
      zh: '把下面内容整理成要点清单：每条以动词或名词短语开头、不超过 20 字、彼此不重复，并按重要程度排序。最后标注哪一条最容易被忽略：\n\n{{text}}',
      en: 'Turn the content below into a bullet list: each starting with a verb or noun phrase, under 20 words, with no overlap, ordered by importance. Finally, flag which point is easiest to overlook:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-multi-document',
    category: 'summarize',
    title: { zh: '多文档汇总', en: 'Multi-document synthesis' },
    prompt: {
      zh: '把下面几份文档汇总成一份结论：共同点、相互矛盾之处、各自独有的信息、可以得出的总体判断，以及仍需查证的问题：\n\n{{text}}',
      en: 'Synthesize the documents below into one set of conclusions: where they agree, where they contradict, what is unique to each, the overall judgment you can draw, and what still needs verification:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-three-levels',
    category: 'summarize',
    title: { zh: '分层摘要', en: 'Three-level summary' },
    prompt: {
      zh: '对下面内容做三层摘要：一句话（20 字内）、一段话（100 字内）、一页笔记（含小标题）。三层内容必须一致，不引入原文没有的信息：\n\n{{text}}',
      en: 'Summarize the content below at three levels: one sentence (under 20 words), one paragraph (under 100 words), and one page of notes with subheads. The three must be consistent and add nothing that is not in the source:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-with-sources',
    category: 'summarize',
    title: { zh: '摘要附原文依据', en: 'Summary with citations' },
    prompt: {
      zh: '为下面内容写摘要，并为每条要点附上原文的支撑句（用引号引用并注明大致位置），避免断章取义：\n\n{{text}}',
      en: 'Summarize the content below and attach a supporting sentence from the source to each point (quote it and note roughly where it appears) so nothing is taken out of context:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-decision-log',
    category: 'summarize',
    title: { zh: '决策记录', en: 'Decision record' },
    prompt: {
      zh: '把下面内容整理成决策记录：决策事项、背景与约束、考虑过的方案、最终选择与理由、反对意见、复查时间点与触发复查的条件：\n\n{{text}}',
      en: 'Turn the content below into a decision record: the decision, background and constraints, options considered, the choice made with reasoning, dissenting views, and the review date plus the conditions that would trigger a revisit:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-thread',
    category: 'summarize',
    title: { zh: '讨论串提炼', en: 'Thread distillation' },
    prompt: {
      zh: '把下面的讨论串提炼成结论：起点问题、各方主要立场、形成的共识、未解决的争议、下一步由谁推进，并标注哪些发言只是情绪表达可以忽略：\n\n{{text}}',
      en: 'Distill the thread below into conclusions: the original question, the main positions, the consensus reached, the unresolved disputes, and who drives the next step. Flag which messages are just venting and can be ignored:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-feedback-digest',
    category: 'summarize',
    title: { zh: '反馈汇总', en: 'Feedback digest' },
    prompt: {
      zh: '把下面的反馈汇总：按主题聚类并统计提及次数、提炼每类的典型原话、区分「建议 / 抱怨 / 疑问」，最后给出优先级排序：\n\n{{text}}',
      en: 'Digest the feedback below: cluster by theme with mention counts, quote representative lines for each cluster, classify as suggestion / complaint / question, and give a priority ranking:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-changelog-digest',
    category: 'summarize',
    title: { zh: '变更摘要', en: 'Changelog digest' },
    prompt: {
      zh: '把下面的变更记录汇总成面向用户的摘要：按影响程度分组（重大 / 一般 / 修复），每条一句话说明「变化了什么、对我意味着什么」，并标注需要用户采取行动的项：\n\n{{text}}',
      en: 'Digest the changelog below for users: group by impact (major / minor / fix), describe each in one line as "what changed and what it means for me", and flag items that require user action:\n\n{{text}}',
    },
  },
  {
    id: 'summarize-fidelity-check',
    category: 'summarize',
    title: { zh: '摘要保真检查', en: 'Summary fidelity check' },
    prompt: {
      zh: '检查下面这份摘要是否忠实于原文：找出遗漏的重要信息、被放大的次要内容、曲解或过度推断之处，并给出修改后的摘要。\n\n原文：\n{{source}}\n\n摘要：\n{{target}}',
      en: 'Check whether the summary below is faithful to the source: find important omissions, minor points that got inflated, and distortions or overreach, then give a corrected summary.\n\nSource:\n{{source}}\n\nSummary:\n{{target}}',
    },
  },
];
