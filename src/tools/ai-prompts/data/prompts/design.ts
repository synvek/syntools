import type { PromptItem } from '../../types';

/** 设计与创意类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'design-brief',
    category: 'design',
    title: { zh: '设计需求简报', en: 'Design brief' },
    prompt: {
      zh: '把下面的需求整理成设计简报：目标与成功标准、目标用户与使用场景、必须包含的元素、品牌约束（色彩 / 字体 / 语气）、交付物与尺寸、评审节点：\n\n{{text}}',
      en: 'Turn the request below into a design brief: goals and success criteria, target users and usage scenario, required elements, brand constraints (color / type / tone), deliverables and sizes, and review checkpoints:\n\n{{text}}',
    },
  },
  {
    id: 'design-color-palette',
    category: 'design',
    title: { zh: '配色方案', en: 'Color palette' },
    prompt: {
      zh: '为「{{product}}」设计配色方案：主色 / 辅助色 / 中性色各给出 HEX 色值、使用比例、对比度是否满足无障碍要求，并说明各自适合的场景与情绪。',
      en: 'Design a color palette for "{{product}}": primary, secondary, and neutral colors with HEX values, usage ratios, whether contrast meets accessibility requirements, and the mood and context each suits.',
    },
  },
  {
    id: 'design-ui-microcopy',
    category: 'design',
    title: { zh: '界面微文案', en: 'UI microcopy' },
    prompt: {
      zh: '为下面的界面场景写微文案：按钮文字、空状态、加载中、错误提示、成功提示、权限请求。每处给 2 个备选，语气与品牌一致：\n\n{{text}}',
      en: 'Write microcopy for the interface scenarios below: button labels, empty state, loading, error, success, and permission request. Give 2 options for each, consistent with the brand voice:\n\n{{text}}',
    },
  },
  {
    id: 'design-usability-review',
    category: 'design',
    title: { zh: '可用性检查', en: 'Usability review' },
    prompt: {
      zh: '检查下面这个界面或流程的可用性问题：信息层级、操作可见性、反馈及时性、错误预防、认知负担。按严重程度排序并给出改法：\n\n{{text}}',
      en: 'Review the interface or flow below for usability issues: information hierarchy, action visibility, timely feedback, error prevention, and cognitive load. Rank by severity and suggest fixes:\n\n{{text}}',
    },
  },
  {
    id: 'design-ideation',
    category: 'design',
    title: { zh: '创意发散', en: 'Ideation with SCAMPER' },
    prompt: {
      zh: '围绕「{{topic}}」做创意发散：用 SCAMPER（替代 / 合并 / 调整 / 修改 / 其他用途 / 消除 / 重排）每个维度产出 2 个具体想法，并标注哪些最有可行性。',
      en: 'Diverge on "{{topic}}" using SCAMPER (substitute / combine / adapt / modify / another use / eliminate / reverse): 2 concrete ideas per prompt, and flag the most feasible ones.',
    },
  },
  {
    id: 'design-logo-concept',
    category: 'design',
    title: { zh: 'Logo 概念', en: 'Logo concepts' },
    prompt: {
      zh: '为「{{brand}}」提出 5 个 logo 概念：每个用一句话描述视觉意象、象征含义、适合的字形风格与配色方向，并说明哪个概念最适合长期延展。',
      en: 'Propose 5 logo concepts for "{{brand}}": for each, one line on the visual image, the symbolism, a suitable type style, and color direction. Say which concept scales best long term.',
    },
  },
  {
    id: 'design-typography-system',
    category: 'design',
    title: { zh: '字体系统', en: 'Type system' },
    prompt: {
      zh: '为「{{product}}」制定字体系统：标题 / 正文 / 辅助文字的字号与行高（含移动端）、字重使用规则、层级对比原则、中英文混排注意事项。',
      en: 'Define a type system for "{{product}}": sizes and line heights for headings, body, and captions (including mobile), weight usage rules, hierarchy principles, and notes for mixing CJK and Latin text.',
    },
  },
  {
    id: 'design-layout-grid',
    category: 'design',
    title: { zh: '栅格与布局', en: 'Layout and grid' },
    prompt: {
      zh: '为「{{pageType}}」设计布局方案：栅格列数与间距、内容分区与优先级、各断点下的重排方式，并说明为什么这样分区。',
      en: 'Design a layout for "{{pageType}}": grid columns and gutters, content zones and their priority, how it reflows at each breakpoint, and why the zones are arranged this way.',
    },
  },
  {
    id: 'design-interaction-spec',
    category: 'design',
    title: { zh: '交互说明', en: 'Interaction spec' },
    prompt: {
      zh: '为「{{component}}」写交互说明：触发条件、各状态（默认 / 悬停 / 激活 / 禁用 / 加载 / 错误）、动效时长与缓动、键盘与无障碍行为、边界情况处理。',
      en: 'Write the interaction spec for "{{component}}": triggers, states (default / hover / active / disabled / loading / error), motion duration and easing, keyboard and accessibility behavior, and edge-case handling.',
    },
  },
  {
    id: 'design-accessibility-check',
    category: 'design',
    title: { zh: '无障碍检查', en: 'Accessibility check' },
    prompt: {
      zh: '对下面的设计做无障碍检查：色彩对比度、文本替代、键盘可达性、焦点顺序、表单标签与错误提示、动态内容播报。列出问题与修复建议：\n\n{{text}}',
      en: 'Audit the design below for accessibility: color contrast, text alternatives, keyboard reachability, focus order, form labels and error messages, and announcements for dynamic content. List issues and fixes:\n\n{{text}}',
    },
  },
  {
    id: 'design-portfolio-case',
    category: 'design',
    title: { zh: '作品集案例', en: 'Portfolio case study' },
    prompt: {
      zh: '把我的项目整理成作品集案例：问题背景、我的角色与约束、调研与决策依据、方案与取舍、验证结果与数据、如果重做会怎么改。素材：\n\n{{text}}',
      en: 'Turn my project into a portfolio case study: the problem, my role and constraints, research and the basis for decisions, the solution and trade-offs, validation results and numbers, and what I would change if I redid it. Material:\n\n{{text}}',
    },
  },
  {
    id: 'design-creative-critique',
    category: 'design',
    title: { zh: '创意点评', en: 'Creative critique' },
    prompt: {
      zh: '请点评下面这个创意方案：先说最强的一点，再指出 3 个可改进处（每条给出具体改法），最后给出一个完全不同的替代方向：\n\n{{text}}',
      en: 'Critique the creative concept below: name the strongest part, then 3 improvements (each with a concrete fix), and finally offer one entirely different direction:\n\n{{text}}',
    },
  },
];
