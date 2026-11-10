/**
 * Rule-based Chinese proofreading (plan P1-3, first slice).
 *
 * Deliberately not a dictionary: a Chinese word list good enough to beat these rules costs megabytes,
 * and the error classes that actually show up in office documents are cheap to detect —
 * half-width punctuation inside Chinese text, repeated function words ("我们们"), and a curated list of
 * common homophone typos ("按装" → "安装"). Everything here is a pure function over one string, so the
 * cost stays proportional to the text and nothing has to be downloaded.
 *
 * Deliberately conservative: every rule needs *both* sides of the evidence (punctuation between two
 * Chinese characters, a doubled word that can never be legitimate, a typo from a hand-checked list),
 * because a false red underline in a word processor is worse than a missed typo.
 *
 * Second slice adds word-level repetition ("文档文档", copied one time too many). It deliberately does
 * *not* ship a segmentation lexicon: the only Chinese dictionary available offline (the one inside
 * `pinyin-pro`, 4082 entries built for polyphone disambiguation) indexes 1 of 30 common office words,
 * so segmenting against it would have been a decoder ring for the wrong corpus. Repetition is decided
 * by word class instead — nouns cannot be ABAB-reduplicated, verbs can — which is both precise and
 * free of any asset.
 */

export type ZhIssueKind = 'punctuation' | 'duplicate' | 'typo';

export interface ZhIssue {
  /** The offending text exactly as it appears in the source */
  word: string;
  /** Start offset in the source string (inclusive) */
  start: number;
  /** End offset (exclusive) */
  end: number;
  kind: ZhIssueKind;
  /** Correct form, when the rule knows it (typos, punctuation width) */
  suggestion?: string;
}

/** CJK ideographs — the context that makes a half-width punctuation mark wrong */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

/** Half-width → full-width, for punctuation sitting between two Chinese characters */
const HALF_TO_FULL: Readonly<Record<string, string>> = {
  ',': '，',
  '.': '。',
  ';': '；',
  ':': '：',
  '?': '？',
  '!': '！',
};

/**
 * Punctuation a doubled run makes a typo. `……` and `——` are legitimate (hence absent) and `！！` is
 * merely a style choice, so neither is checked.
 */
const REPEATED_WATCHED = '，。、；：,.';

/**
 * Function words that are never doubled by accident-free writers. Content words such as 人 / 天 / 常
 * are excluded on purpose: 人人 / 天天 / 常常 / 高高兴兴 are all correct.
 */
const NEVER_DOUBLED = new Set('的了们是在和有不也就都把被这那着过吗呢吧啊很又还再才更最');

/** Legitimate doubled function words ("他的的确确说过" / "是是非非"), skipped by the duplicate rule */
const LEGIT_DOUBLED = ['的的确确', '是是非非'];

/**
 * Two-character nouns that cannot be ABAB-reduplicated, so seeing one twice in a row is a copy-paste
 * slip ("文档文档") and never a stylistic choice. Content verbs are absent on purpose: 研究研究 /
 * 讨论讨论 / 商量商量 are all correct. The list is a watch list, not a dictionary — a unit that is not
 * here is simply not reported.
 */
const REPEAT_NOUNS = new Set([
  '文档',
  '系统',
  '项目',
  '图片',
  '表格',
  '版本',
  '目录',
  '页面',
  '段落',
  '用户',
  '数据',
  '报告',
  '计划',
  '文件',
  '记录',
  '内容',
  '标题',
  '样式',
  '字体',
  '格式',
  '模板',
  '章节',
  '附件',
  '会议',
  '时间',
  '公司',
  '部门',
  '同事',
  '客户',
  '产品',
  '需求',
  '功能',
  '接口',
  '服务',
  '配置',
  '参数',
  '日志',
  '订单',
  '合同',
  '预算',
  '费用',
  '发票',
  '账号',
  '密码',
  '邮箱',
  '地址',
  '电话',
  '编号',
  '名称',
  '说明',
  '规则',
  '流程',
  '任务',
  '进度',
  '质量',
  '风险',
  '成本',
  '资源',
  '环境',
  '代码',
  '测试',
  '部署',
  '发布',
  '备份',
  '归档',
  '权限',
  '角色',
  '字段',
  '报表',
  '图表',
  '公式',
  '函数',
  '数组',
  '对象',
  '组件',
  '模块',
  '插件',
  '脚本',
  '缓存',
  '队列',
  '线程',
  '事务',
  '索引',
  '消息',
  '通知',
  '评论',
  '批注',
  '修订',
  '快照',
  '草稿',
  '摘要',
  '结论',
  '建议',
  '方案',
  '步骤',
  '重点',
  '目标',
  '结果',
  '原因',
  '问题',
  '错误',
  '警告',
  '提示',
  '状态',
  '类型',
  '属性',
  '方法',
  '结构',
  '算法',
  '协议',
  '标准',
  '规范',
  '清单',
  '封面',
  '页眉',
  '页脚',
  '脚注',
  '尾注',
]);

/**
 * Longer units repeated verbatim are reported without a word-class check (a three- or four-character
 * unit is not a reduplicable word), but colloquial emphasis does repeat them.
 */
const REPEAT_EXEMPT = new Set(['怎么样', '没关系', '对了', '不好意思']);

/** Unit length range for word-level repetition */
const REPEAT_MIN = 2;
const REPEAT_MAX = 4;

/**
 * Common homophone typos (wrong → right). Hand-checked, all of them unambiguously wrong in any context;
 * anything context-dependent (的 / 地 / 得) is deliberately absent.
 */
const TYPOS: ReadonlyArray<readonly [string, string]> = [
  ['按装', '安装'],
  ['报歉', '抱歉'],
  ['必竟', '毕竟'],
  ['部份', '部分'],
  ['补尝', '补偿'],
  ['凭添', '平添'],
  ['既使', '即使'],
  ['即然', '既然'],
  ['竟争', '竞争'],
  ['另人', '令人'],
  ['融恰', '融洽'],
  ['题纲', '提纲'],
  ['通迅', '通讯'],
  ['严竣', '严峻'],
  ['膺品', '赝品'],
  ['针贬', '针砭'],
  ['针炙', '针灸'],
  ['震憾', '震撼'],
  ['装璜', '装潢'],
  ['装模做样', '装模作样'],
  ['追朔', '追溯'],
  ['欣尝', '欣赏'],
  ['因该', '应该'],
  ['以经', '已经'],
  ['在次', '再次'],
  ['家俱', '家具'],
  ['精萃', '精粹'],
  ['蜇伏', '蛰伏'],
  ['坐阵', '坐镇'],
  ['走头无路', '走投无路'],
  ['自抱自弃', '自暴自弃'],
  ['一愁莫展', '一筹莫展'],
  ['迫不急待', '迫不及待'],
  ['不径而走', '不胫而走'],
  ['名列前矛', '名列前茅'],
  ['谈笑风声', '谈笑风生'],
  ['甘败下风', '甘拜下风'],
  ['沤心沥血', '呕心沥血'],
  ['随声附合', '随声附和'],
  ['变换莫测', '变幻莫测'],
];

/**
 * One alternation of every typo, longest first so an entry can never shadow a longer one
 * ("装模做样" must win over any shorter form inside it).
 */
const TYPO_RE = new RegExp(
  [...TYPOS]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([wrong]) => wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
);
const TYPO_TABLE = new Map(TYPOS);

/** A unit qualifies for the repetition rule: pure Chinese characters, no punctuation inside */
function isCjkUnit(unit: string): boolean {
  for (const char of unit) if (!CJK.test(char)) return false;
  return true;
}

/**
 * Word-level repetition: the same unit twice in a row ("文档文档", "说明书说明书").
 *
 * A 2-character unit is reported only when it is a known noun (see `REPEAT_NOUNS`) because ABAB is a
 * legitimate verb pattern; a 3–4 character unit is reported unless it is colloquial emphasis. Runs
 * longer than two copies collapse into one issue ("文档文档文档" → one hit covering all three).
 */
export function findWordRepetitions(text: string): ZhIssue[] {
  const issues: ZhIssue[] = [];
  let index = 0;
  while (index < text.length) {
    let unit = 0;
    for (let size = REPEAT_MAX; size >= REPEAT_MIN; size -= 1) {
      const middle = index + size;
      if (middle + size > text.length) continue;
      const word = text.slice(index, middle);
      if (text.slice(middle, middle + size) !== word) continue;
      if (!isCjkUnit(word) || REPEAT_EXEMPT.has(word)) continue;
      if (size === REPEAT_MIN && !REPEAT_NOUNS.has(word)) continue;
      unit = size;
      break;
    }
    if (!unit) {
      index += 1;
      continue;
    }
    const word = text.slice(index, index + unit);
    let end = index + unit * 2;
    while (text.slice(end, end + unit) === word) end += unit;
    issues.push({
      word: text.slice(index, end),
      start: index,
      end,
      kind: 'duplicate',
      suggestion: word,
    });
    index = end;
  }
  return issues;
}

/**
 * Check Chinese text. `ignore` holds words the user already accepted (the custom dictionary), so
 * "加入词典" also silences a rule hit for this session and for saved drafts.
 */
export function checkChinese(text: string, ignore: readonly string[] = []): ZhIssue[] {
  if (!text) return [];
  const accepted = new Set(ignore.map((word) => word.trim()).filter(Boolean));
  const issues: ZhIssue[] = [];

  // 1. Half-width punctuation between two Chinese characters: "我们,明天" -> "我们，明天"
  for (let index = 1; index < text.length - 1; index += 1) {
    const suggestion = HALF_TO_FULL[text[index] as string];
    if (!suggestion) continue;
    if (!CJK.test(text[index - 1] as string) || !CJK.test(text[index + 1] as string)) continue;
    issues.push({
      word: text[index] as string,
      start: index,
      end: index + 1,
      kind: 'punctuation',
      suggestion,
    });
  }

  // 2. Repeated punctuation: "，，" / "。。"
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] as string;
    if (!REPEATED_WATCHED.includes(char)) continue;
    let end = index;
    while (text[end + 1] === char) end += 1;
    if (end === index) continue;
    issues.push({
      word: text.slice(index, end + 1),
      start: index,
      end: end + 1,
      kind: 'punctuation',
      suggestion: char,
    });
    index = end;
  }

  // 3. Doubled function words: "我们们" / "是的的"
  for (let index = 0; index < text.length - 1; index += 1) {
    const char = text[index] as string;
    if (!NEVER_DOUBLED.has(char) || text[index + 1] !== char) continue;
    if (LEGIT_DOUBLED.some((phrase) => text.startsWith(phrase, index))) continue;
    issues.push({
      word: text.slice(index, index + 2),
      start: index,
      end: index + 2,
      kind: 'duplicate',
      suggestion: char,
    });
    index += 1;
  }

  // 4. Curated homophone typos
  TYPO_RE.lastIndex = 0;
  let match = TYPO_RE.exec(text);
  while (match) {
    const start = match.index;
    const end = start + match[0].length;
    const suggestion = TYPO_TABLE.get(match[0]);
    if (suggestion) {
      issues.push({ word: match[0], start, end, kind: 'typo', suggestion });
    }
    match = TYPO_RE.exec(text);
  }

  // 5. Word-level repetition: "文档文档" / "说明书说明书"
  issues.push(...findWordRepetitions(text));

  const seen = new Set<string>();
  return issues
    .filter((issue) => !accepted.has(issue.word))
    .filter((issue) => {
      const key = `${issue.start}:${issue.end}:${issue.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Typos the rules know a correction for (exposed for the panel's "suggestion" rendering and tests) */
export function knownTypos(): ReadonlyArray<readonly [string, string]> {
  return TYPOS;
}
