import type { PromptItem } from '../../types';

/** 评审与反馈类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'review-plan',
    category: 'review',
    title: { zh: '方案评审', en: 'Plan review' },
    prompt: {
      zh: '评审下面这个方案：先说最值得肯定的一点，再指出 3 个关键问题（每条说明风险与建议改法）、2 个需要补充的信息，最后给出「通过 / 有条件通过 / 需重做」的建议：\n\n{{text}}',
      en: 'Review the plan below: name what is strongest first, then 3 key problems (each with the risk and a suggested fix), 2 pieces of missing information, and a recommendation of approve / approve with conditions / needs rework:\n\n{{text}}',
    },
  },
  {
    id: 'review-document',
    category: 'review',
    title: { zh: '文档打磨', en: 'Document polish' },
    prompt: {
      zh: '打磨下面的文档：指出结构与逻辑问题、表述含糊或可删减的地方、术语不一致之处，并给出修改后的关键段落：\n\n{{text}}',
      en: 'Polish the document below: flag structural and logic problems, vague or cuttable phrasing, and inconsistent terminology, then provide revised versions of the key passages:\n\n{{text}}',
    },
  },
  {
    id: 'review-work-critique',
    category: 'review',
    title: { zh: '作品点评', en: 'Work critique' },
    prompt: {
      zh: '点评下面这个作品：它想达到什么效果、哪些地方达到了、哪些地方没达到（指出具体位置）、如果要再做一版最该改动哪一处：\n\n{{text}}',
      en: 'Critique the work below: what it is trying to achieve, where it succeeds, where it falls short (point to specific spots), and the single change that would most improve the next version:\n\n{{text}}',
    },
  },
  {
    id: 'review-structured-feedback',
    category: 'review',
    title: { zh: '结构化反馈', en: 'Structured feedback' },
    prompt: {
      zh: '帮我把这段反馈改写成结构化表达：情境（具体时间或事件）、行为（可观察的事实）、影响（对结果或他人的影响）、期望（希望改成什么样）。不要评价性格：\n\n{{text}}',
      en: 'Rewrite this feedback in a structured form: situation (a specific time or event), behavior (observable facts), impact (on results or others), and expectation (what should change). Avoid commenting on personality:\n\n{{text}}',
    },
  },
  {
    id: 'review-change',
    category: 'review',
    title: { zh: '变更评审', en: 'Change review' },
    prompt: {
      zh: '评审下面这次变更：是否解决了它声称解决的问题、是否有副作用、边界情况是否处理、可维护性如何，并指出必须修改才能合入的项：\n\n{{text}}',
      en: 'Review the change below: does it solve the problem it claims to, are there side effects, are edge cases handled, how maintainable is it, and what must be fixed before it can merge:\n\n{{text}}',
    },
  },
  {
    id: 'review-grade-findings',
    category: 'review',
    title: { zh: '问题分级', en: 'Grade the findings' },
    prompt: {
      zh: '把下面的评审意见分级：阻断性问题（必须解决）、重要问题（应尽快解决）、改进建议（可择机处理），并说明分级依据与建议的处理顺序：\n\n{{text}}',
      en: 'Grade the review comments below into blocking (must fix), important (fix soon), and suggestions (when convenient), with the reasoning behind each grade and a suggested order of handling:\n\n{{text}}',
    },
  },
  {
    id: 'review-self-critique',
    category: 'review',
    title: { zh: '自我审查', en: 'Self-critique' },
    prompt: {
      zh: '帮我对「{{work}}」做一次自我审查：用一个严格评审者的视角列出 5 个最可能被质疑的点，并为每个点给出可以提前补强的证据或说明。',
      en: 'Help me self-review "{{work}}": from the perspective of a tough reviewer, list the 5 points most likely to be challenged, and for each, the evidence or explanation I can prepare in advance.',
    },
  },
  {
    id: 'review-presentation-feedback',
    category: 'review',
    title: { zh: '汇报反馈', en: 'Presentation feedback' },
    prompt: {
      zh: '我准备这样汇报：「{{plan}}」。请给出反馈：信息顺序是否合理、哪些内容该提前或删掉、预判听众最关心的 3 个问题与我的应答思路。',
      en: 'I plan to present this: "{{plan}}". Give feedback: is the order of information right, what should move earlier or be cut, and the 3 questions the audience will care about most with how I should answer them.',
    },
  },
  {
    id: 'review-quality-checklist',
    category: 'review',
    title: { zh: '交付质量检查', en: 'Delivery quality checklist' },
    prompt: {
      zh: '为「{{deliverable}}」制定交付前的质量检查清单：内容完整性、数据准确性、格式与一致性、常见错误、责任人确认项，并标注哪些必须由他人复核。',
      en: 'Build a pre-delivery quality checklist for "{{deliverable}}": completeness, data accuracy, formatting and consistency, common mistakes, and sign-off items, and flag which ones require a second reviewer.',
    },
  },
  {
    id: 'review-disagreement-handling',
    category: 'review',
    title: { zh: '分歧处理', en: 'Handling disagreement' },
    prompt: {
      zh: '我和同事在「{{topic}}」上有分歧，我方观点是「{{myView}}」。请帮我梳理双方论点、判断这是事实分歧还是价值分歧，并给出 3 种推进讨论的方式。',
      en: 'A colleague and I disagree on "{{topic}}"; my position is "{{myView}}". Help me lay out both sides, decide whether the disagreement is about facts or values, and give 3 ways to move the discussion forward.',
    },
  },
  {
    id: 'review-improvement-plan',
    category: 'review',
    title: { zh: '改进计划', en: 'Improvement plan' },
    prompt: {
      zh: '根据下面的反馈帮我制定改进计划：归纳成 3 个改进主题、每个主题的具体行动与衡量方式、30 天内的检查点，并指出哪一条最容易被放弃：\n\n{{text}}',
      en: 'Based on the feedback below, help me build an improvement plan: group it into 3 themes, with concrete actions and how to measure each, checkpoints within 30 days, and which one is most likely to be abandoned:\n\n{{text}}',
    },
  },
  {
    id: 'review-decision-quality',
    category: 'review',
    title: { zh: '决策质量复盘', en: 'Decision quality review' },
    prompt: {
      zh: '复盘这个决策的质量（而不是结果）：当时掌握的信息是否充分、推理过程有无漏洞、是否考虑了替代方案、运气占多大成分，以及下次可以改进的判断方式：\n\n{{text}}',
      en: 'Review the quality of this decision rather than its outcome: was the information sufficient at the time, were there gaps in the reasoning, were alternatives considered, how much was luck, and what judgment could improve next time:\n\n{{text}}',
    },
  },
];
