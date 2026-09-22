import type { PromptItem } from '../../types';

/** 教学与培训类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'education-lesson-plan',
    category: 'education',
    title: { zh: '教案设计', en: 'Lesson plan' },
    prompt: {
      zh: '为「{{topic}}」设计一节 {{duration}} 分钟的教案：教学目标（知识 / 技能 / 态度）、学情分析、教学环节与时间分配、提问设计、板书或课件要点、作业布置。',
      en: 'Design a {{duration}}-minute lesson plan for "{{topic}}": objectives (knowledge / skill / attitude), a read on the learners, the sequence with time allocation, questions to ask, board or slide points, and homework.',
    },
  },
  {
    id: 'education-differentiated-practice',
    category: 'education',
    title: { zh: '分层练习', en: 'Tiered practice' },
    prompt: {
      zh: '为「{{topic}}」设计分层练习：基础层 5 题（巩固概念）、进阶层 4 题（综合应用）、挑战层 2 题（开放探究），并说明每层的判断标准与讲评重点。',
      en: 'Design tiered practice for "{{topic}}": 5 foundation questions (concept consolidation), 4 intermediate (combined application), 2 challenge (open inquiry), with the criteria for each tier and the focus when reviewing.',
    },
  },
  {
    id: 'education-classroom-activity',
    category: 'education',
    title: { zh: '课堂活动设计', en: 'Classroom activity' },
    prompt: {
      zh: '为「{{topic}}」设计课堂互动活动：活动目标、分组方式、规则与时长、需要的材料、教师引导语，以及学生不配合时的备选方案。',
      en: 'Design a classroom activity for "{{topic}}": objective, grouping, rules and duration, materials needed, the teacher\'s facilitation lines, and a fallback if students disengage.',
    },
  },
  {
    id: 'education-rubric',
    category: 'education',
    title: { zh: '评分量规', en: 'Grading rubric' },
    prompt: {
      zh: '为「{{assignment}}」制定评分量规：3-4 个评分维度、每个维度 4 个等级的描述（优秀 / 良好 / 合格 / 待改进）、各维度权重，并说明如何向学生解释这套标准。',
      en: 'Build a grading rubric for "{{assignment}}": 3–4 criteria, 4 levels of description each (excellent / good / satisfactory / needs work), the weight of each criterion, and how to explain the rubric to students.',
    },
  },
  {
    id: 'education-assessment-design',
    category: 'education',
    title: { zh: '测验设计', en: 'Assessment design' },
    prompt: {
      zh: '为「{{topic}}」设计一次测验：双向细目表（知识点 × 认知层次）、题型与数量、分值分布、时间建议，并附 3 道样题与答案要点。',
      en: 'Design an assessment for "{{topic}}": a table of specifications (topics × cognitive levels), question types and counts, score distribution, suggested duration, plus 3 sample items with answer keys.',
    },
  },
  {
    id: 'education-training-curriculum',
    category: 'education',
    title: { zh: '培训课程体系', en: 'Training curriculum' },
    prompt: {
      zh: '为「{{audience}}」设计培训课程体系：3 个阶段的能力目标、每阶段的课程清单与课时、考核方式、每阶段的实践任务与导师角色。',
      en: 'Design a training curriculum for "{{audience}}": capability goals for 3 stages, the course list and hours for each, how learners are assessed, and the practice task and mentor role per stage.',
    },
  },
  {
    id: 'education-assignment-feedback',
    category: 'education',
    title: { zh: '作业点评', en: 'Assignment feedback' },
    prompt: {
      zh: '为下面这份作业写点评：先肯定 1 个具体优点，再指出 2 个可改进处并给出修改方向，最后给一句鼓励。避免套话，点评要可操作：\n\n{{text}}',
      en: 'Write feedback on the assignment below: name one specific strength first, then 2 improvements with concrete direction, and close with one encouraging line. Avoid generic praise and make it actionable:\n\n{{text}}',
    },
  },
  {
    id: 'education-misconceptions',
    category: 'education',
    title: { zh: '常见误解澄清', en: 'Common misconceptions' },
    prompt: {
      zh: '列出学生在「{{topic}}」上最常见的 5 个误解：说明误解的表现、产生原因、为什么错，以及一个能纠正它的类比或演示。',
      en: 'List the 5 most common misconceptions students hold about "{{topic}}": how the misconception shows up, why it arises, why it is wrong, and an analogy or demonstration that corrects it.',
    },
  },
  {
    id: 'education-flipped-classroom',
    category: 'education',
    title: { zh: '翻转课堂设计', en: 'Flipped classroom' },
    prompt: {
      zh: '为「{{topic}}」设计翻转课堂：课前自主学习任务与材料、课堂前 10 分钟的检测方式、课堂内的活动与讨论问题、课后延伸任务与评价方式。',
      en: 'Design a flipped classroom for "{{topic}}": the pre-class self-study task and materials, how the first 10 minutes of class will check understanding, the in-class activity and discussion questions, and the post-class extension task with assessment.',
    },
  },
  {
    id: 'education-course-outline',
    category: 'education',
    title: { zh: '课程大纲', en: 'Course outline' },
    prompt: {
      zh: '为「{{course}}」写课程大纲：课程目标、面向人群与前置要求、8-12 周的周主题与交付物、考核构成与比例、参考书目与工具清单。',
      en: 'Write a syllabus for "{{course}}": course objectives, intended audience and prerequisites, weekly topics with deliverables for 8–12 weeks, the assessment components and weights, and a reading and tool list.',
    },
  },
  {
    id: 'education-case-discussion-questions',
    category: 'education',
    title: { zh: '案例讨论问题', en: 'Case discussion questions' },
    prompt: {
      zh: '为下面的教学案例设计讨论问题：3 个事实理解题、3 个分析判断题、2 个决策开放题，并给出每题的讨论要点与常见的错误思路：\n\n{{text}}',
      en: 'Design discussion questions for the case study below: 3 comprehension questions, 3 analytical questions, and 2 open decision questions, each with discussion points and common wrong turns:\n\n{{text}}',
    },
  },
  {
    id: 'education-parent-communication',
    category: 'education',
    title: { zh: '家校沟通', en: 'Parent communication' },
    prompt: {
      zh: '帮我写一段与家长沟通的话术：用事实与例子说明学生的具体表现而不下结论、指出需要家校配合的 2 件事、约定期望与后续沟通方式。情况：\n\n{{text}}',
      en: "Help me write a message to a parent: describe the student's specific behavior using facts and examples without labeling them, identify 2 things that need support at home, and agree on expectations and how to follow up. Situation:\n\n{{text}}",
    },
  },
];
