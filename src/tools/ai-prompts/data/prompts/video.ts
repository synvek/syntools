import type { PromptItem } from '../../types';

/** 视频与音频脚本类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'video-short-form-script',
    category: 'video',
    title: { zh: '短视频口播稿', en: 'Short-form script' },
    prompt: {
      zh: '为「{{topic}}」写一条 {{duration}} 秒短视频口播稿：前 3 秒钩子、1 个核心观点、1 个例子、结尾引导互动。按「口播 + 画面提示」两列输出。',
      en: 'Write a {{duration}}-second short-video script about "{{topic}}": a 3-second hook, one core point, one example, and a closing that invites engagement. Output as two columns: voiceover and visual cue.',
    },
  },
  {
    id: 'video-storyboard',
    category: 'video',
    title: { zh: '分镜脚本', en: 'Storyboard' },
    prompt: {
      zh: '为脚本「{{script}}」写分镜：镜号、景别（远全中近特）、画面内容、运镜方式、时长、音效或配乐提示。用表格输出。',
      en: 'Storyboard the script "{{script}}": shot number, shot size (wide / full / medium / close-up), visual content, camera movement, duration, and sound or music cue. Output as a table.',
    },
  },
  {
    id: 'video-podcast-outline',
    category: 'video',
    title: { zh: '播客提纲', en: 'Podcast outline' },
    prompt: {
      zh: '为「{{topic}}」的一期 {{duration}} 分钟播客写提纲：开场引入、3 个讨论段落（每段 3 个要点与 1 个追问）、可能的跑题风险、结尾总结与下期预告。',
      en: 'Outline a {{duration}}-minute podcast episode about "{{topic}}": an intro, 3 discussion segments (each with 3 points and 1 follow-up question), the risk of going off-topic, a closing summary, and a teaser for the next episode.',
    },
  },
  {
    id: 'video-voiceover-timing',
    category: 'video',
    title: { zh: '配音稿与时长', en: 'Voiceover and timing' },
    prompt: {
      zh: '把下面的文字改写成配音稿：句子拆短便于换气，标注每句预计秒数，总时长控制在 {{duration}} 秒，并标出需要重读的词：\n\n{{text}}',
      en: 'Rewrite the text below as a voiceover script: shorten sentences for breathing room, note the estimated seconds per line with a total of {{duration}} seconds, and mark the words to emphasize:\n\n{{text}}',
    },
  },
  {
    id: 'video-editing-rhythm',
    category: 'video',
    title: { zh: '剪辑节奏', en: 'Editing rhythm' },
    prompt: {
      zh: '为「{{content}}」设计剪辑节奏：开场 5 秒的镜头切换频率、中段信息密度变化、情绪高点位置、留白与转场处理，以及卡点配乐的建议。',
      en: 'Design the edit rhythm for "{{content}}": cut frequency in the first 5 seconds, how information density changes mid-video, where the emotional peak sits, use of pauses and transitions, and beat-synced music suggestions.',
    },
  },
  {
    id: 'video-title-and-thumbnail',
    category: 'video',
    title: { zh: '标题与封面', en: 'Title and thumbnail' },
    prompt: {
      zh: '为「{{topic}}」视频给出 8 个标题与 3 个封面方案：标题要有好奇缺口但不夸张，封面说明主视觉、图上文字（不超过 6 字）与情绪表达。',
      en: 'Give 8 titles and 3 thumbnail concepts for a video about "{{topic}}": titles with a curiosity gap but no clickbait; for thumbnails, describe the key visual, on-image text (max 6 characters), and the emotion conveyed.',
    },
  },
  {
    id: 'video-tutorial-script',
    category: 'video',
    title: { zh: '教学视频脚本', en: 'Tutorial script' },
    prompt: {
      zh: '为「{{task}}」写教学视频脚本：学习目标、前置条件、分步骤演示（每步说明操作与常见错误）、小结与练习任务。',
      en: 'Write a tutorial video script for "{{task}}": the learning objective, prerequisites, a step-by-step demonstration (with the operation and the common mistake at each step), a recap, and a practice task.',
    },
  },
  {
    id: 'video-interview-outline',
    category: 'video',
    title: { zh: '采访提纲', en: 'Interview outline' },
    prompt: {
      zh: '为采访「{{guest}}」准备提纲：3 个背景铺垫问题、6 个有观点碰撞空间的核心问题、2 个轻松收尾问题，并标注哪些问题可能被回避及应对方式。',
      en: 'Prepare an interview outline for "{{guest}}": 3 background questions, 6 core questions that leave room for genuine disagreement, 2 light closers, and which questions they may dodge plus how to handle it.',
    },
  },
  {
    id: 'video-livestream-runbook',
    category: 'video',
    title: { zh: '直播流程单', en: 'Livestream runbook' },
    prompt: {
      zh: '为「{{topic}}」的 {{duration}} 分钟直播写流程单：时间轴、每个环节的内容与话术要点、互动与抽奖节点、产品讲解位置，以及应急预案（冷场 / 设备故障 / 恶意评论）。',
      en: 'Write a runbook for a {{duration}}-minute livestream about "{{topic}}": a timeline, the content and talking points for each segment, interaction and giveaway moments, where the product pitch goes, and contingencies (dead air / equipment failure / hostile comments).',
    },
  },
  {
    id: 'video-spoken-rewrite',
    category: 'video',
    title: { zh: '口播稿改写', en: 'Spoken-style rewrite' },
    prompt: {
      zh: '把下面这段文案改写成适合口播的版本：句子更短、去掉书面语、加入停顿提示与口语连接词，删掉念不出来的绕口表达：\n\n{{text}}',
      en: 'Rewrite the copy below for spoken delivery: shorter sentences, no written-language constructions, add pause markers and spoken connectors, and remove tongue-twisting phrasing:\n\n{{text}}',
    },
  },
  {
    id: 'video-course-module',
    category: 'video',
    title: { zh: '课程模块设计', en: 'Course module design' },
    prompt: {
      zh: '为「{{course}}」设计一个课程模块：模块目标、3-5 节课的顺序与每节时长、每节的核心要点与练习、模块测验 3 道题与通过标准。',
      en: 'Design a course module for "{{course}}": the module objective, 3–5 lessons in order with durations, the key points and exercise for each lesson, plus 3 quiz questions and the passing bar.',
    },
  },
  {
    id: 'video-show-notes',
    category: 'video',
    title: { zh: '节目简介与时间戳', en: 'Show notes and timestamps' },
    prompt: {
      zh: '为这一期节目写简介与时间戳：一段吸引人的开场介绍（不超过 80 字）、要点时间戳、嘉宾与资源链接占位、可延伸收听的相关内容。素材：\n\n{{text}}',
      en: 'Write show notes and timestamps for this episode: a compelling intro under 80 words, timestamped highlights, placeholders for guest and resource links, and related episodes to listen to next. Material:\n\n{{text}}',
    },
  },
];
