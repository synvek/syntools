import type { PromptItem } from '../../types';

/** 效率与办公类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'productivity-task-breakdown',
    category: 'productivity',
    title: { zh: '任务拆解与排期', en: 'Task breakdown' },
    prompt: {
      zh: '把「{{task}}」拆成可执行步骤：每步一句话、预估耗时、前置依赖、可并行项，并根据可用时间 {{availableTime}} 给出今天的安排。',
      en: 'Break "{{task}}" into actionable steps: one line each with estimated time, prerequisites, and what can run in parallel, then schedule today given {{availableTime}} of available time.',
    },
  },
  {
    id: 'productivity-meeting-notes',
    category: 'productivity',
    title: { zh: '会议纪要', en: 'Meeting minutes' },
    prompt: {
      zh: '把下面的会议记录整理成纪要：结论与决策、待办事项（负责人 + 截止时间）、待确认问题、下次会议议题建议。删掉讨论过程中的重复内容：\n\n{{text}}',
      en: 'Turn the meeting notes below into minutes: decisions made, action items (owner + due date), open questions, and suggested topics for next time. Drop the repetition from the discussion:\n\n{{text}}',
    },
  },
  {
    id: 'productivity-weekly-report',
    category: 'productivity',
    title: { zh: '周报', en: 'Weekly report' },
    prompt: {
      zh: '帮我写周报：本周关键产出（用量化结果描述）、遇到的问题与解决方案、下周计划与优先级、需要支持的事项。素材：\n\n{{text}}',
      en: "Draft my weekly report: key outputs this week described with results, problems hit and how they were solved, next week's plan with priorities, and where I need support. Material:\n\n{{text}}",
    },
  },
  {
    id: 'productivity-sop',
    category: 'productivity',
    title: { zh: '流程 SOP', en: 'Standard operating procedure' },
    prompt: {
      zh: '把「{{process}}」写成 SOP：适用场景、角色与职责、分步骤操作（含每步的输入与产出）、常见错误与检查点、异常处理方式。',
      en: 'Write an SOP for "{{process}}": when it applies, roles and responsibilities, numbered steps with the input and output of each, common mistakes with checkpoints, and exception handling.',
    },
  },
  {
    id: 'productivity-prioritize-today',
    category: 'productivity',
    title: { zh: '今日优先级安排', en: 'Prioritize today' },
    prompt: {
      zh: '帮我安排今天的优先级：把下面所有待办按「重要且紧急 / 重要不紧急 / 紧急不重要 / 其他」分类，给出时间块安排，并指出应该删掉或委派的事项：\n\n{{text}}',
      en: 'Help me prioritize today: classify the to-dos below into urgent-important / important-not-urgent / urgent-not-important / other, propose time blocks, and point out what to delete or delegate:\n\n{{text}}',
    },
  },
  {
    id: 'productivity-email-to-task',
    category: 'productivity',
    title: { zh: '邮件转任务', en: 'Email to task list' },
    prompt: {
      zh: '把下面这封邮件转成待办清单：每条包含动词开头的任务描述、截止时间、依赖人、完成标准与优先级，并标注哪些需要先回复：\n\n{{text}}',
      en: 'Turn the email below into a task list: each task with a verb-first description, due date, dependency, definition of done, and priority, and flag which ones need a reply first:\n\n{{text}}',
    },
  },
  {
    id: 'productivity-template-generator',
    category: 'productivity',
    title: { zh: '模板生成', en: 'Template generator' },
    prompt: {
      zh: '为「{{scenario}}」生成一个可复用模板：字段说明、填写示例、使用注意事项，并说明哪些字段可以留空、哪些必须填写。',
      en: 'Generate a reusable template for "{{scenario}}": field descriptions, a filled-in example, usage notes, and which fields are optional versus required.',
    },
  },
  {
    id: 'productivity-time-audit',
    category: 'productivity',
    title: { zh: '时间审计', en: 'Time audit' },
    prompt: {
      zh: '分析下面这份一周时间记录：时间实际花在哪里、被打断最频繁的时段、低价值的重复活动、可合并或自动化的部分，并给出 3 条具体调整建议：\n\n{{text}}',
      en: "Analyze this week's time log below: where the time actually went, when interruptions cluster, low-value repetitive work, and what could be merged or automated, then give 3 concrete adjustments:\n\n{{text}}",
    },
  },
  {
    id: 'productivity-delegation-plan',
    category: 'productivity',
    title: { zh: '委派方案', en: 'Delegation plan' },
    prompt: {
      zh: '帮我委派「{{task}}」：说明为什么适合委派、选择承接人的标准、需要交代的背景与验收标准、检查节点，以及我自己仍应保留的决策部分。',
      en: 'Help me delegate "{{task}}": why it suits delegation, how to pick the owner, the context and acceptance criteria to hand over, the check-in points, and which decisions I should keep.',
    },
  },
  {
    id: 'productivity-knowledge-note',
    category: 'productivity',
    title: { zh: '知识库笔记', en: 'Knowledge-base note' },
    prompt: {
      zh: '把下面的内容整理成一条知识库笔记：一句话结论、适用场景、关键步骤或规则、注意事项与例外情况、相关链接与标签：\n\n{{text}}',
      en: 'Turn the content below into a knowledge-base note: a one-line conclusion, when it applies, the key steps or rules, caveats and exceptions, and related links with tags:\n\n{{text}}',
    },
  },
  {
    id: 'productivity-automation-opportunity',
    category: 'productivity',
    title: { zh: '自动化机会识别', en: 'Find automation opportunities' },
    prompt: {
      zh: '分析我下面的工作流程，找出可以自动化的环节：按「频率 × 耗时 × 出错成本」排序，给出每种自动化方案的工具类型与投入产出估计：\n\n{{text}}',
      en: 'Review my workflow below and find what can be automated: rank by frequency × time cost × cost of error, and give the tool category and a rough cost/benefit estimate for each option:\n\n{{text}}',
    },
  },
  {
    id: 'productivity-daily-review',
    category: 'productivity',
    title: { zh: '每日复盘', en: 'Daily review' },
    prompt: {
      zh: '引导我做一次每日复盘：依次问 5 个问题（今天完成了什么、卡在哪里、学到什么、明天最重要的一件事、需要谁的支持），等我回答后再给出改进建议。',
      en: 'Guide me through a daily review: ask 5 questions in sequence (what got done, where I got stuck, what I learned, the single most important thing tomorrow, whose support I need), and once I answer, suggest improvements.',
    },
  },
];
