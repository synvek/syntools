import type { PromptItem } from '../../types';

/** 翻译与本地化类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'translate-zh-to-en',
    category: 'translate',
    title: { zh: '中译英（自然）', en: 'ZH→EN natural' },
    prompt: {
      zh: '将以下中文翻译成自然、地道的英文，保留语气与专有名词：\n\n{{text}}',
      en: 'Translate the following Chinese into natural English, keeping tone and proper nouns:\n\n{{text}}',
    },
  },
  {
    id: 'translate-en-to-zh',
    category: 'translate',
    title: { zh: '英译中（通顺）', en: 'EN→ZH fluent' },
    prompt: {
      zh: '将以下英文翻译成通顺的简体中文，避免生硬直译：\n\n{{text}}',
      en: 'Translate the following English into fluent Simplified Chinese (avoid stiff literal phrasing):\n\n{{text}}',
    },
  },
  {
    id: 'translate-ui-localization',
    category: 'translate',
    title: { zh: '产品文案本地化', en: 'UI copy localization' },
    prompt: {
      zh: '请将以下产品文案本地化为简体中文，兼顾简洁与品牌语气，并给出备选写法：\n\n{{text}}',
      en: 'Localize this product copy into Simplified Chinese. Keep it concise and on-brand; provide alternatives:\n\n{{text}}',
    },
  },
  {
    id: 'translate-terminology-glossary',
    category: 'translate',
    title: { zh: '术语一致性翻译', en: 'Glossary-consistent translation' },
    prompt: {
      zh: '把下面内容翻译成{{targetLang}}，严格遵守术语表。若遇到术语表中没有的专有名词，先列出候选译法与理由，再给出最终译文。\n\n术语表：\n{{glossary}}\n\n原文：\n{{text}}',
      en: 'Translate the content below into {{targetLang}}, strictly following the glossary. For proper nouns not in the glossary, list candidate translations with reasoning before giving the final translation.\n\nGlossary:\n{{glossary}}\n\nSource:\n{{text}}',
    },
  },
  {
    id: 'translate-tone-adapt',
    category: 'translate',
    title: { zh: '语气与文化适配', en: 'Tone and culture adaptation' },
    prompt: {
      zh: '把下面文本翻译成{{targetLang}}，并按目标语言的文化习惯调整语气与礼貌层级，不要逐字直译。请说明你做了哪些语气上的调整。\n\n{{text}}',
      en: 'Translate the text below into {{targetLang}} and adapt tone and politeness level to the target culture instead of translating word for word. Explain the tone adjustments you made.\n\n{{text}}',
    },
  },
  {
    id: 'translate-bilingual-proofread',
    category: 'translate',
    title: { zh: '双语校对', en: 'Bilingual proofread' },
    prompt: {
      zh: '对照原文校对译文，检查漏译、误译、术语不一致、标点与数字格式问题，用表格列出「位置 / 问题 / 建议修改」：\n\n原文：\n{{source}}\n\n译文：\n{{target}}',
      en: 'Proofread the translation against the source. Check omissions, mistranslations, terminology inconsistency, punctuation, and number formats. Output a table of "location / issue / suggested fix":\n\nSource:\n{{source}}\n\nTranslation:\n{{target}}',
    },
  },
  {
    id: 'translate-marketing-copy',
    category: 'translate',
    title: { zh: '营销文案本地化', en: 'Marketing copy localization' },
    prompt: {
      zh: '将下面的营销文案本地化为{{targetLang}}。不要直译卖点，而是用目标市场常见的表达方式重写，保留说服力，并给出 2 个备选版本：\n\n{{text}}',
      en: 'Localize the marketing copy below into {{targetLang}}. Do not translate benefits literally; rewrite them the way the target market phrases them, keep the persuasive intent, and give 2 alternative versions:\n\n{{text}}',
    },
  },
  {
    id: 'translate-technical-doc',
    category: 'translate',
    title: { zh: '技术文档翻译', en: 'Technical doc translation' },
    prompt: {
      zh: '把下面的技术文档翻译成{{targetLang}}：代码、命令、API 名称与占位符原样保留，术语统一，句子简短，关键术语首次出现时以「译文（原文）」标注：\n\n{{text}}',
      en: 'Translate the technical documentation below into {{targetLang}}: keep code, commands, API names, and placeholders unchanged, use consistent terminology, keep sentences short, and annotate key terms as "translation (source term)" on first use:\n\n{{text}}',
    },
  },
  {
    id: 'translate-subtitles',
    category: 'translate',
    title: { zh: '字幕翻译', en: 'Subtitle translation' },
    prompt: {
      zh: '把下面的内容翻译成{{targetLang}}字幕：每行不超过 {{maxChars}} 个字符，保持口语节奏，不拆分完整语义单元，必要时删减冗余词。按「行号 / 译文」输出：\n\n{{text}}',
      en: 'Translate the content below into {{targetLang}} subtitles: keep each line under {{maxChars}} characters, preserve spoken rhythm, avoid splitting semantic units, and trim filler words when needed. Output as "line number / translation":\n\n{{text}}',
    },
  },
  {
    id: 'translate-contract-clause',
    category: 'translate',
    title: { zh: '合同条款翻译', en: 'Contract clause translation' },
    prompt: {
      zh: '把下面的合同条款翻译成{{targetLang}}，保持法律文本的严谨与平行结构，对含义模糊处标注疑点。注意：译文仅供参考，正式文件须由专业法律人员审核。\n\n{{text}}',
      en: 'Translate the contract clause below into {{targetLang}}, preserving legal precision and parallel structure, and flag ambiguous points. Note: this translation is for reference only; a qualified legal professional must review any binding document.\n\n{{text}}',
    },
  },
  {
    id: 'translate-transcreation',
    category: 'translate',
    title: { zh: '品牌创译', en: 'Brand transcreation' },
    prompt: {
      zh: '对下面的品牌名或口号做{{targetLang}}创译（transcreation）：优先保证读音、联想与传播效果，而非字面含义。给出 5 个方案，并说明每个方案的联想与风险。\n\n{{text}}',
      en: 'Transcreate the brand name or slogan below into {{targetLang}}: prioritize sound, associations, and memorability over literal meaning. Offer 5 options and explain the associations and risks of each.\n\n{{text}}',
    },
  },
  {
    id: 'translate-back-translation',
    category: 'translate',
    title: { zh: '回译校验', en: 'Back-translation check' },
    prompt: {
      zh: '先把下面的译文回译成原文语言，再逐句对比原文与回译结果，指出语义偏差与可能的理解歧义。\n\n原文：\n{{source}}\n\n译文：\n{{target}}',
      en: 'First back-translate the translation below into the source language, then compare it with the original sentence by sentence and point out semantic drift and possible ambiguity.\n\nSource:\n{{source}}\n\nTranslation:\n{{target}}',
    },
  },
];
