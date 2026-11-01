/**
 * 字符级排版新增文案（RTE-05 收尾：小型大写 / 左缩进 / 悬挂缩进）。
 *
 * 单独一份而不是往 `strings.ts` 的 9 个语言块里各插四行：那份文件已经 3500 行，
 * 增量块由 `richTextStrings` 构造时统一合并，改一处就够。
 */
export const charFormatStrings: Record<string, Record<string, string>> = {
  zh: {
    smallCaps: '小型大写',
    indentLeftIncrease: '增加左缩进',
    indentLeftDecrease: '减少左缩进',
    hangingIndent: '悬挂缩进',
  },
  en: {
    smallCaps: 'Small caps',
    indentLeftIncrease: 'Increase left indent',
    indentLeftDecrease: 'Decrease left indent',
    hangingIndent: 'Hanging indent',
  },
  'zh-TW': {
    smallCaps: '小型大寫',
    indentLeftIncrease: '增加左縮排',
    indentLeftDecrease: '減少左縮排',
    hangingIndent: '懸掛縮排',
  },
  ja: {
    smallCaps: '小型英大文字',
    indentLeftIncrease: '左インデントを増やす',
    indentLeftDecrease: '左インデントを減らす',
    hangingIndent: 'ぶら下げインデント',
  },
  fr: {
    smallCaps: 'Petites majuscules',
    indentLeftIncrease: 'Augmenter le retrait gauche',
    indentLeftDecrease: 'Réduire le retrait gauche',
    hangingIndent: 'Retrait négatif',
  },
  de: {
    smallCaps: 'Kapitälchen',
    indentLeftIncrease: 'Linken Einzug vergrößern',
    indentLeftDecrease: 'Linken Einzug verkleinern',
    hangingIndent: 'Hängender Einzug',
  },
  it: {
    smallCaps: 'Maiuscoletto',
    indentLeftIncrease: 'Aumenta rientro sinistro',
    indentLeftDecrease: 'Riduci rientro sinistro',
    hangingIndent: 'Rientro sporgente',
  },
  es: {
    smallCaps: 'Versalitas',
    indentLeftIncrease: 'Aumentar sangría izquierda',
    indentLeftDecrease: 'Reducir sangría izquierda',
    hangingIndent: 'Sangría francesa',
  },
  pt: {
    smallCaps: 'Versaletes',
    indentLeftIncrease: 'Aumentar recuo esquerdo',
    indentLeftDecrease: 'Reduzir recuo esquerdo',
    hangingIndent: 'Recuo pendente',
  },
};
