import type { PromptItem } from '../../types';

/** 学习成长类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'learning-study-plan',
    category: 'learning',
    title: { zh: '学习计划', en: 'Study plan' },
    prompt: {
      zh: '为我制定「{{topic}}」四周学习计划：每周目标、每日任务（约 45 分钟）、检验方式与推荐资源。',
      en: 'Create a 4-week study plan for "{{topic}}": weekly goals, ~45-min daily tasks, checkpoints, and resource suggestions.',
    },
  },
  {
    id: 'learning-eli5-explain',
    category: 'learning',
    title: { zh: '通俗讲解', en: 'ELI5 explain' },
    prompt: {
      zh: '用类比和简单例子解释「{{topic}}」，最后给出 3 个自测问题。',
      en: 'Explain "{{topic}}" with analogies and simple examples, then give 3 self-check questions.',
    },
  },
  {
    id: 'learning-flashcards',
    category: 'learning',
    title: { zh: '闪卡生成', en: 'Flashcards' },
    prompt: {
      zh: '根据以下笔记生成 10 张问答闪卡（正面问题 / 背面答案）：\n\n{{text}}',
      en: 'From the notes below, make 10 Q&A flashcards (front question / back answer):\n\n{{text}}',
    },
  },
  {
    id: 'learning-quiz-generator',
    category: 'learning',
    title: { zh: '练习题生成', en: 'Quiz generator' },
    prompt: {
      zh: '根据以下内容生成 10 道练习题：6 道单选、2 道简答、2 道应用题，并附答案与解析。难度按由易到难排列：\n\n{{text}}',
      en: 'Create 10 practice questions from the content below: 6 multiple choice, 2 short answer, 2 applied, with answers and explanations. Order them from easy to hard:\n\n{{text}}',
    },
  },
  {
    id: 'learning-knowledge-map',
    category: 'learning',
    title: { zh: '知识地图', en: 'Knowledge map' },
    prompt: {
      zh: '把「{{topic}}」整理成知识地图：列出 4-6 个主干模块、每个模块下的关键概念，以及概念之间的依赖关系（用嵌套列表表示，标注「先学 / 后学」）。',
      en: 'Map out "{{topic}}" as a knowledge tree: 4–6 core modules, the key concepts in each, and the dependencies between them (use a nested list and mark "learn first / learn later").',
    },
  },
  {
    id: 'learning-review-checklist',
    category: 'learning',
    title: { zh: '学习复盘', en: 'Learning review' },
    prompt: {
      zh: '帮我复盘这次学习：我学了「{{topic}}」，自评掌握程度为 {{level}}。请生成复盘清单：已掌握、仍模糊、下一步该练什么，每项各配一个自测问题。',
      en: 'Help me review this learning session: I studied "{{topic}}" and rate my level as {{level}}. Produce a review checklist — what is solid, what is still fuzzy, what to practice next — each with a self-test question.',
    },
  },
  {
    id: 'learning-feynman',
    category: 'learning',
    title: { zh: '费曼讲解检验', en: 'Feynman check' },
    prompt: {
      zh: '我要用费曼学习法讲解「{{topic}}」。下面是我的讲解，请指出其中表达含糊、逻辑跳跃或用词不准确的地方，并给出更准确的表述：\n\n{{text}}',
      en: 'I am using the Feynman technique to explain "{{topic}}". Here is my explanation: point out where I am vague, skipping logic, or imprecise, and give more accurate phrasing:\n\n{{text}}',
    },
  },
  {
    id: 'learning-mistake-analysis',
    category: 'learning',
    title: { zh: '错题分析', en: 'Wrong-answer analysis' },
    prompt: {
      zh: '分析我的错题：指出错误类型（概念不清 / 审题失误 / 计算错误 / 思路缺失）、根本原因，并给出 2 道同类型的巩固题：\n\n{{text}}',
      en: 'Analyze my wrong answers: classify each error (concept gap / misread question / calculation slip / missing approach), identify the root cause, and give 2 similar practice problems:\n\n{{text}}',
    },
  },
  {
    id: 'learning-reading-notes',
    category: 'learning',
    title: { zh: '读书笔记整理', en: 'Reading notes' },
    prompt: {
      zh: '把下面的读书摘录整理成结构化笔记：核心论点、关键论据、我的疑问、可行动项，并标注哪些内容是作者观点、哪些是可验证事实：\n\n{{text}}',
      en: 'Turn the reading excerpt below into structured notes: core arguments, key evidence, my open questions, and action items. Mark which statements are opinion and which are verifiable facts:\n\n{{text}}',
    },
  },
  {
    id: 'learning-skill-roadmap',
    category: 'learning',
    title: { zh: '技能进阶路线', en: 'Skill roadmap' },
    prompt: {
      zh: '为「{{skill}}」制定从入门到进阶的路线：3 个阶段的能力标准、每阶段的核心练习、里程碑作品，以及常见的停滞原因与突破方法。',
      en: 'Lay out a beginner-to-advanced roadmap for "{{skill}}": capability standards for 3 stages, core practice for each, milestone artifacts, plus common plateaus and how to break through them.',
    },
  },
  {
    id: 'learning-mnemonic',
    category: 'learning',
    title: { zh: '记忆方法设计', en: 'Memory aids' },
    prompt: {
      zh: '为下面的知识点设计 3 个记忆方案（口诀、图像联想、故事串联），并说明各自适合的场景与局限：\n\n{{text}}',
      en: 'Design 3 memory aids for the facts below (mnemonic phrase, visual association, story chain) and explain when each works best and what its limits are:\n\n{{text}}',
    },
  },
  {
    id: 'learning-language-practice',
    category: 'learning',
    title: { zh: '语言口语陪练', en: 'Speaking practice' },
    prompt: {
      zh: '扮演{{targetLang}}口语陪练：围绕「{{topic}}」和我进行 8 轮对话，每轮用简短自然的句子，并在回复末尾用一行小字指出我上一句话的语法或用词问题。',
      en: 'Act as my {{targetLang}} speaking partner: hold an 8-turn conversation about "{{topic}}" using short natural sentences, and append one short line noting the grammar or word-choice issue in my previous turn.',
    },
  },
];
