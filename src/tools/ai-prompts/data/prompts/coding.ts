import type { PromptItem } from '../../types';

/** 编程开发类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'coding-code-review',
    category: 'coding',
    title: { zh: '代码审查', en: 'Code review' },
    prompt: {
      zh: '请审查以下代码，指出潜在 bug、可读性与性能问题，并按严重程度排序给出修改建议：\n\n```\n{{code}}\n```',
      en: 'Review this code for bugs, readability, and performance. Rank findings by severity and suggest fixes:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-explain-code',
    category: 'coding',
    title: { zh: '解释代码', en: 'Explain code' },
    prompt: {
      zh: '请用初学者能懂的语言解释这段代码的作用与执行流程：\n\n```\n{{code}}\n```',
      en: 'Explain what this code does and how it runs, in beginner-friendly language:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-refactor-suggestions',
    category: 'coding',
    title: { zh: '重构建议', en: 'Refactor tips' },
    prompt: {
      zh: '请给出重构方案：更清晰的命名、拆分函数、减少重复，并输出重构后的代码：\n\n```\n{{code}}\n```',
      en: 'Propose a refactor (clearer names, smaller functions, less duplication) and show the refactored code:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-add-tests',
    category: 'coding',
    title: { zh: '补充单元测试', en: 'Add unit tests' },
    prompt: {
      zh: '为下面的代码补充单元测试，覆盖正常路径、边界值与异常分支。使用 {{framework}} 的写法，并说明每个用例想验证的行为：\n\n```\n{{code}}\n```',
      en: 'Write unit tests for the code below covering the happy path, edge cases, and error branches. Follow {{framework}} conventions and explain what each case verifies:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-write-docs',
    category: 'coding',
    title: { zh: '补文档注释', en: 'Add documentation' },
    prompt: {
      zh: '为下面的代码补充 {{style}} 风格的文档注释：说明用途、参数、返回值与可能抛出的异常，并在关键分支加简要行内注释：\n\n```\n{{code}}\n```',
      en: 'Add {{style}} documentation comments to the code below: purpose, parameters, return value, and possible errors. Add brief inline comments on key branches:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-debug-error',
    category: 'coding',
    title: { zh: '报错排查', en: 'Debug an error' },
    prompt: {
      zh: '我在运行时报了下面的错误。请按概率排序列出可能原因，给出定位方法（该打印或检查什么）以及最小修复方案。\n\n错误信息：\n{{error}}\n\n相关代码：\n```\n{{code}}\n```',
      en: 'I hit the error below at runtime. List the likely causes in order of probability, suggest how to isolate each (what to log or inspect), and give the minimal fix.\n\nError:\n{{error}}\n\nRelevant code:\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-perf-optimize',
    category: 'coding',
    title: { zh: '性能优化', en: 'Performance tuning' },
    prompt: {
      zh: '分析下面代码的性能瓶颈（时间复杂度、重复计算、IO 次数），给出优化方案与预期收益，并输出优化后的代码：\n\n```\n{{code}}\n```',
      en: 'Analyze the performance bottlenecks in the code below (time complexity, repeated work, IO count), propose optimizations with expected gains, and show the optimized code:\n\n```\n{{code}}\n```',
    },
  },
  {
    id: 'coding-regex-builder',
    category: 'coding',
    title: { zh: '正则表达式', en: 'Regex builder' },
    prompt: {
      zh: '写一个正则表达式，用于匹配「{{requirement}}」。请给出表达式、逐段解释、3 个匹配示例与 3 个不匹配示例，并注明目标语言与正则引擎。',
      en: 'Write a regular expression that matches "{{requirement}}". Provide the pattern, a piece-by-piece explanation, 3 matching and 3 non-matching examples, and note the target language and engine.',
    },
  },
  {
    id: 'coding-api-design',
    category: 'coding',
    title: { zh: '接口设计', en: 'API design' },
    prompt: {
      zh: '为「{{feature}}」设计 HTTP 接口：列出端点、方法、请求参数、响应结构、错误码与鉴权方式，并给出一个请求示例与对应的响应示例。',
      en: 'Design HTTP endpoints for "{{feature}}": list paths, methods, request parameters, response shapes, error codes, and auth. Include one request and response example.',
    },
  },
  {
    id: 'coding-shell-command',
    category: 'coding',
    title: { zh: 'Shell 命令', en: 'Shell command' },
    prompt: {
      zh: '写出完成以下任务的 {{shell}} 命令：{{task}}。请逐条说明命令作用，并明确标注可能覆盖或删除文件的危险操作。',
      en: 'Write the {{shell}} command(s) that accomplish: {{task}}. Explain each command and explicitly flag any operation that could overwrite or delete files.',
    },
  },
  {
    id: 'coding-commit-and-pr',
    category: 'coding',
    title: { zh: '提交信息与 PR 描述', en: 'Commit message and PR' },
    prompt: {
      zh: '根据下面的改动，写一条符合 Conventional Commits 的提交信息，并生成 PR 描述（变更内容、影响范围、测试方式）：\n\n{{text}}',
      en: 'From the changes below, write a Conventional Commits message and a PR description (what changed, blast radius, how it was tested):\n\n{{text}}',
    },
  },
  {
    id: 'coding-stack-migration',
    category: 'coding',
    title: { zh: '代码迁移', en: 'Stack migration' },
    prompt: {
      zh: '把下面的代码从 {{fromStack}} 迁移到 {{toStack}}，保持行为一致；指出 API 差异与兼容性风险，并输出迁移后的完整代码：\n\n```\n{{code}}\n```',
      en: 'Migrate the code below from {{fromStack}} to {{toStack}} while preserving behavior. Call out API differences and compatibility risks, then output the full migrated code:\n\n```\n{{code}}\n```',
    },
  },
];
