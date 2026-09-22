import type { PromptItem } from '../../types';

/** 法律与合规类提示词，详见 ../README.md */
export const PROMPTS: PromptItem[] = [
  {
    id: 'legal-contract-key-points',
    category: 'legal',
    title: { zh: '合同要点梳理', en: 'Contract key points' },
    prompt: {
      zh: '梳理下面这份合同的关键条款：双方权利义务、付款与交付、违约责任、终止与续约条件、争议解决方式，并标出对我方不利或表述模糊的条款：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: "Summarize the key clauses of the contract below: each party's rights and obligations, payment and delivery, breach liability, termination and renewal, and dispute resolution, and flag clauses that are unfavorable or ambiguously worded:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)",
    },
  },
  {
    id: 'legal-clause-compare',
    category: 'legal',
    title: { zh: '条款版本对比', en: 'Clause comparison' },
    prompt: {
      zh: '对比下面两个版本的条款差异：逐条列出改动内容、改动带来的风险变化、对哪一方更有利，并给出我方建议的修改方向：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Compare the two versions of the clause below: list each change, how it shifts risk, which party it favors, and the direction we should push back with:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-risk-flags',
    category: 'legal',
    title: { zh: '法律风险提示', en: 'Legal risk flags' },
    prompt: {
      zh: '识别下面这份材料的法律与合规风险点：按高 / 中 / 低风险分级，说明风险来源、可能后果与缓释措施，并指出必须由专业律师确认的部分：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Identify the legal and compliance risks in the material below: grade them high / medium / low, explain the source, the possible consequence, and a mitigation, and note which parts must be confirmed by a qualified lawyer:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-privacy-policy-outline',
    category: 'legal',
    title: { zh: '隐私政策提纲', en: 'Privacy policy outline' },
    prompt: {
      zh: '为「{{product}}」起草隐私政策提纲：收集的信息类型、收集目的与法律依据、存储与保留期限、共享与第三方、用户权利及行使方式、Cookie 与追踪说明、更新机制。\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Draft a privacy policy outline for "{{product}}": categories of data collected, purpose and legal basis, storage and retention, sharing and third parties, user rights and how to exercise them, cookies and tracking, and how the policy gets updated.\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-terms-outline',
    category: 'legal',
    title: { zh: '服务条款提纲', en: 'Terms of service outline' },
    prompt: {
      zh: '为「{{product}}」写服务条款提纲：服务说明与变更、账号与安全、用户行为规范、付费与退款、知识产权归属、免责与责任限制、终止条件、争议解决与适用法律。\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Outline terms of service for "{{product}}": service description and changes, accounts and security, acceptable use, payment and refunds, IP ownership, disclaimers and liability limits, termination, and dispute resolution with governing law.\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-compliance-checklist',
    category: 'legal',
    title: { zh: '合规检查清单', en: 'Compliance checklist' },
    prompt: {
      zh: '列出「{{scenario}}」场景的合规检查清单：需要取得的资质或许可、必须公示的信息、数据处理要求、留存与审计要求、监管报送义务，并指出常见违规情形。\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'List the compliance checklist for "{{scenario}}": licenses or permits required, mandatory disclosures, data handling requirements, record-keeping and audit requirements, regulatory reporting duties, and the common ways companies violate these.\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-nda-review',
    category: 'legal',
    title: { zh: '保密协议审查', en: 'NDA review' },
    prompt: {
      zh: '审查这份保密协议：保密信息范围是否过宽、例外情形是否合理、保密期限、返还或销毁义务、违约救济方式，并给出 3 条修改建议：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Review this NDA: whether the definition of confidential information is too broad, whether the exceptions are reasonable, the duration, return-or-destroy obligations, and remedies for breach, then give 3 suggested edits:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-dispute-response',
    category: 'legal',
    title: { zh: '争议应对梳理', en: 'Dispute response' },
    prompt: {
      zh: '我方收到对方的争议主张：「{{claim}}」。请梳理：对方可能的依据、我方的抗辩点、需要准备的证据清单、优先协商还是走程序的判断依据，以及回函要点。\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'We received this claim from the other side: "{{claim}}". Lay out their likely basis, our defenses, the evidence to gather, whether to negotiate first or escalate, and the key points for our reply.\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-regulation-summary',
    category: 'legal',
    title: { zh: '法规要点摘要', en: 'Regulation summary' },
    prompt: {
      zh: '把下面的法规或政策文本摘要成要点：适用范围、核心义务、关键时间节点、违规后果，以及对「{{business}}」的具体影响与待办事项：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Summarize the regulation or policy text below into key points: scope, core obligations, key deadlines, penalties, and the concrete impact and action items for "{{business}}":\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-ip-considerations',
    category: 'legal',
    title: { zh: '知识产权要点', en: 'IP considerations' },
    prompt: {
      zh: '梳理「{{project}}」涉及的知识产权问题：权利归属（职务作品 / 委托 / 合作开发）、第三方素材的授权要求、开源许可的合规要点、需要签署或留存的文件。\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Lay out the IP considerations for "{{project}}": ownership (work for hire / commissioned / joint development), licensing requirements for third-party assets, open-source license compliance, and the documents to sign or keep.\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-formal-letter',
    category: 'legal',
    title: { zh: '正式函件起草', en: 'Formal letter draft' },
    prompt: {
      zh: '帮我起草一封正式函件：事由与事实陈述（按时间顺序）、依据（合同条款或法规）、我方主张与期限要求、后续将采取的措施。语气正式克制。情况：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Draft a formal letter: the subject and a chronological statement of facts, the basis (contract clause or regulation), our demand with a deadline, and what happens next. Keep the tone formal and measured. Situation:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
  {
    id: 'legal-plain-language',
    category: 'legal',
    title: { zh: '条款通俗化', en: 'Plain-language rewrite' },
    prompt: {
      zh: '把下面的条款改写成通俗易懂的表述，保持法律含义不变：拆长句、去冗余、用日常用语替换术语，并在必要处用括号保留原术语：\n\n{{text}}\n\n（仅供参考，不构成法律意见；正式文件请咨询执业律师。）',
      en: 'Rewrite the clause below in plain language without changing its legal meaning: split long sentences, cut redundancy, replace jargon with everyday words, and keep the original term in brackets where needed:\n\n{{text}}\n\n(General information only; not legal advice — consult a qualified lawyer for binding documents.)',
    },
  },
];
