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
