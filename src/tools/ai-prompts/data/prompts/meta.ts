import type { PromptItem } from '../../types';

/** 提示词工程类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'meta-improve-prompt',
    category: 'meta',
    title: { zh: '提示词改写', en: 'Improve a prompt' },
    prompt: {
      zh: '请改写下面这条提示词，使其更明确：补充角色、任务边界、输出格式与评判标准，并指出原提示词中最容易被模型误解的地方。原提示词：\n\n{{text}}',
      en: 'Rewrite the prompt below to be more precise: add role, task boundaries, output format, and evaluation criteria, and point out where the original is most likely to be misread. Original:\n\n{{text}}',
    },
  },
  {
    id: 'meta-template-generator',
    category: 'meta',
    title: { zh: '结构化模板生成', en: 'Structured template' },
    prompt: {
      zh: '为「{{task}}」生成一个可复用的提示词模板：角色设定、输入变量（用 {{占位符}} 标注）、约束条件、输出格式、完整示例。请说明每个部分的作用。',
      en: 'Generate a reusable prompt template for "{{task}}": role definition, input variables marked with {{placeholders}}, constraints, output format, and a complete example. Explain the purpose of each part.',
    },
  },
  {
    id: 'meta-few-shot-examples',
    category: 'meta',
    title: { zh: '少样本示例设计', en: 'Few-shot examples' },
    prompt: {
      zh: '为「{{task}}」设计 3 个少样本示例：每个包含输入与期望输出，分别覆盖典型情况、边界情况与容易出错的情况，并说明为什么这几个例子最能说明意图。',
      en: 'Design 3 few-shot examples for "{{task}}": each with an input and the expected output, covering the typical case, an edge case, and a common failure, and explain why these best convey the intent.',
    },
  },
  {
    id: 'meta-prompt-review',
    category: 'meta',
    title: { zh: '提示词评审', en: 'Prompt review' },
    prompt: {
      zh: '评审下面这条提示词：指出模糊表述、相互冲突的要求、无法验证的输出要求，并按「严重 / 一般 / 建议」分级给出修改方案：\n\n{{text}}',
      en: 'Review the prompt below: point out vague wording, conflicting requirements, and unverifiable output demands, then give fixes graded blocking / important / suggestion:\n\n{{text}}',
    },
  },
  {
    id: 'meta-output-format',
    category: 'meta',
    title: { zh: '输出格式约束', en: 'Output format constraint' },
    prompt: {
      zh: '为「{{task}}」设计输出格式约束：推荐的格式（表格 / JSON / 列表 / 分节）、各字段或列的定义、长度限制，以及格式无法满足时模型应如何处理。',
      en: 'Design the output format constraint for "{{task}}": the recommended format (table / JSON / list / sections), the definition of each field or column, length limits, and what the model should do if it cannot comply.',
    },
  },
  {
    id: 'meta-step-by-step',
    category: 'meta',
    title: { zh: '分步推理引导', en: 'Step-by-step reasoning' },
    prompt: {
      zh: '把下面这个任务改写成需要分步推理的提示词：要求先列出已知条件与假设，再分步推导，最后给结论，并标注每一步的不确定性。任务：\n\n{{text}}',
      en: 'Rewrite the task below as a step-by-step reasoning prompt: first list the knowns and assumptions, then reason through the steps, and finally give the conclusion while noting the uncertainty at each step. Task:\n\n{{text}}',
    },
  },
  {
    id: 'meta-role-assignment',
    category: 'meta',
    title: { zh: '角色设定优化', en: 'Role assignment' },
    prompt: {
      zh: '为「{{task}}」设计最合适的角色设定：该角色的专业背景、关注重点、会拒绝的请求类型，并说明这个设定相较于「你是一个助手」带来的具体差异。',
      en: 'Design the best role definition for "{{task}}": the persona\'s expertise, what they focus on, the kinds of requests they would refuse, and the concrete difference this makes compared with "you are an assistant".',
    },
  },
  {
    id: 'meta-constraints',
    category: 'meta',
    title: { zh: '约束条件编写', en: 'Writing constraints' },
    prompt: {
      zh: '为「{{task}}」编写约束条件：必须包含什么、必须避免什么、字数与篇幅限制、语气要求，以及「信息不足时应反问而不是编造」这类安全约束。',
      en: 'Write the constraints for "{{task}}": what must be included, what must be avoided, length limits, tone requirements, and safety constraints such as asking a clarifying question rather than inventing details when information is missing.',
    },
  },
  {
    id: 'meta-prompt-debug',
    category: 'meta',
    title: { zh: '提示词排查', en: 'Debug a prompt' },
    prompt: {
      zh: '我的提示词没有得到期望的输出。请分析可能原因（指令冲突、缺少约束、示例误导、上下文过长），给出 3 个最小改动的尝试，并按可能有效性排序。\n\n提示词：\n{{prompt}}\n\n实际输出：\n{{output}}',
      en: 'My prompt did not produce the output I wanted. Analyze the likely causes (conflicting instructions, missing constraints, misleading examples, overly long context), then give 3 minimal changes ordered by how likely they are to help.\n\nPrompt:\n{{prompt}}\n\nActual output:\n{{output}}',
    },
  },
  {
    id: 'meta-system-prompt',
    category: 'meta',
    title: { zh: '系统提示词起草', en: 'System prompt draft' },
    prompt: {
      zh: '为「{{application}}」起草系统提示词：角色与目标、能力边界与拒答规则、回答风格、信息不足时的处理方式、输出格式要求，并指出哪些规则应当用「必须」这类强约束表述。',
      en: 'Draft a system prompt for "{{application}}": role and objective, capability boundaries and refusal rules, answer style, what to do when information is missing, and output format requirements, and note which rules should use strong wording such as "must".',
    },
  },
  {
    id: 'meta-evaluation-criteria',
    category: 'meta',
    title: { zh: '输出评判标准', en: 'Evaluation criteria' },
    prompt: {
      zh: '为「{{task}}」设计模型输出的评判标准：3-5 个维度、每个维度 1 分与 5 分的具体描述、如何构造能区分好坏的测试输入，以及容易出现的主观偏差。',
      en: 'Design evaluation criteria for the model output on "{{task}}": 3–5 dimensions, a concrete description of a 1 and a 5 for each, how to build test inputs that separate good from bad, and the subjective biases to watch for.',
    },
  },
  {
    id: 'meta-library-entry',
    category: 'meta',
    title: { zh: '提示词条目整理', en: 'Prompt library entry' },
    prompt: {
      zh: '把这条提示词整理成规范的库条目：名称、适用场景、所需输入变量及说明、完整提示词正文、使用注意事项与已知局限。原始内容：\n\n{{text}}',
      en: 'Turn this prompt into a structured library entry: name, when to use it, the required input variables with descriptions, the full prompt text, usage notes, and known limitations. Original:\n\n{{text}}',
    },
  },
];
