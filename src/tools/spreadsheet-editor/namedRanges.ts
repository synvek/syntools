import { escapeXml } from '../../core/drawing/drawingml';

/**
 * 名称管理器（P2-S7.1）：工作簿级 / 工作表级名称（`<definedNames>`）。
 *
 * 为什么不用 exceljs：它的 `DefinedNames.model` 只认识 `{ name, ranges }`，`localSheetId`（局部名称）
 * 会在写回时被静默丢掉，`hidden` / `comment` 更是不进模型。名称是"别处引用它"的东西，静默改作用域
 * 比不支持更糟，所以这里自己做 workbook.xml 的读写，exceljs 只负责其余部分。
 *
 * 覆盖面：区域名称（`A1`、`A1:B2`、`Sheet1!$A$1:$B$2`）。公式型 / 常量型名称（`=GET.WORKBOOK(1)`）
 * 不在范围内：它们没法在编辑器里求值，硬存下来只会让用户在 Excel 里看到一个不存在的名字。
 */

/** One named range as carried by the snapshot */
export interface NamedRange {
  id: string;
  /** 显示名（导出时写 `definedName@name`） */
  name: string;
  /** 规范化的区域引用：`A1:B2`，跨表时带表名 `Sheet1!A1:B2` */
  ref: string;
  /** 局部名称的作用表；工作簿级名称省略 */
  sheetId?: string;
  comment?: string;
  hidden?: boolean;
}

/** Excel 名称规则：首字符是字母/下划线/反斜杠，其余可有数字、点 */
const NAME_PATTERN = /^[\p{L}_\\][\p{L}\p{N}_.\\]*$/u;
/** `A1` 这种形状不能当名称（会和单元格引用混淆） */
const CELL_LIKE = /^[A-Za-z]{1,3}\d{1,7}$/;
/** R1C1 记法同样保留 */
const RC_LIKE = /^[Rr]\d*([Cc]\d*)?$/;

const CELL_PATTERN = /^([A-Za-z]{1,3})(\d{1,7})$/;
/** 表名在引用里出现时可能需要单引号（含空格、连字符等） */
const PLAIN_SHEET_NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export type NameError = 'empty' | 'invalid' | 'reserved' | 'duplicate';

/**
 * 名称合法性：空 → empty；不符 Excel 命名规则或长得像单元格引用 → invalid；与已有名称重名 → duplicate。
 * 大小写不敏感（Excel 也如此）。
 */
export function validateName(
  name: string,
  existing: readonly NamedRange[] = [],
  selfId?: string,
): NameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  if (!NAME_PATTERN.test(trimmed) || CELL_LIKE.test(trimmed) || RC_LIKE.test(trimmed)) {
    return 'invalid';
  }
  // `TRUE` / `FALSE` 在公式里是常量，占了会让引用歧义
  if (/^(TRUE|FALSE)$/i.test(trimmed)) return 'reserved';
  const lower = trimmed.toLowerCase();
  if (existing.some((item) => item.id !== selfId && item.name.toLowerCase() === lower)) {
    return 'duplicate';
  }
  return null;
}

/**
 * 导出 / 关面板前的清洗：丢掉空名、非法名、重名（先到先得）与无法识别的引用。
 * 名称是"别处引用它"的元数据，半个坏名称会让 Excel 认为文件需要修复，因此宁可少一个也不留错的。
 */
export function sanitizeNamedRanges(names: readonly NamedRange[]): NamedRange[] {
  const kept: NamedRange[] = [];
  for (const item of names) {
    const trimmed = { ...item, name: item.name.trim() };
    if (validateName(trimmed.name, kept) !== null) continue;
    const ref = normalizeRef(item.ref);
    if (!ref) continue;
    kept.push({ ...trimmed, ref });
  }
  return kept;
}

/** 给表名加引号（Excel 只在需要时加） */
function quoteSheetName(sheetName: string): string {
  return PLAIN_SHEET_NAME.test(sheetName) ? sheetName : `'${sheetName.replace(/'/g, "''")}'`;
}

interface ParsedRef {
  sheetName?: string;
  /** `A1` 或 `A1:B2`，已去掉 `$`、列字母转大写 */
  range: string;
}

/**
 * 解析引用：接受 `A1`、`a1:b2`、`$A$1:$B$2`、`Sheet1!A1:B2`、`'My Sheet'!A1`。
 * 区域必须是矩形；整列 `A:A` / 整行 `1:1` 不接收（无法换算成单元格区域）。
 */
function parseRef(input: string): ParsedRef | null {
  let text = input.trim().replace(/^=/, '').trim();
  if (!text) return null;
  let sheetName: string | undefined;

  const bang = text.lastIndexOf('!');
  if (bang >= 0) {
    const rawSheet = text.slice(0, bang).trim();
    text = text.slice(bang + 1).trim();
    if (!rawSheet) return null;
    sheetName = rawSheet.startsWith("'")
      ? rawSheet.slice(1, rawSheet.endsWith("'") ? -1 : undefined).replace(/''/g, "'")
      : rawSheet;
    if (!sheetName) return null;
  }

  text = text.replace(/\$/g, '');
  const parts = text.split(':');
  if (parts.length > 2) return null;
  const cells: string[] = [];
  for (const part of parts) {
    const match = CELL_PATTERN.exec(part.trim());
    if (!match) return null;
    cells.push(`${match[1].toUpperCase()}${match[2]}`);
  }

  if (cells.length === 2) {
    // 反着写（B2:A1）也接受，但存成左上→右下，否则导出后 Excel 的引用含义会变
    const [first, second] = cells;
    const a = CELL_PATTERN.exec(first);
    const b = CELL_PATTERN.exec(second);
    if (!a || !b) return null;
    const from = refSort(a[1], Number(a[2]), b[1], Number(b[2]), true);
    const to = refSort(a[1], Number(a[2]), b[1], Number(b[2]), false);
    return { sheetName, range: `${from}:${to}` };
  }
  return { sheetName, range: cells[0] };
}

/** 比较两个单元格的列/行，返回左上或右下那一端 */
function refSort(colA: string, rowA: number, colB: string, rowB: number, wantMin: boolean): string {
  const a = { col: colToIndex(colA), row: rowA };
  const b = { col: colToIndex(colB), row: rowB };
  const col = wantMin ? Math.min(a.col, b.col) : Math.max(a.col, b.col);
  const row = wantMin ? Math.min(a.row, b.row) : Math.max(a.row, b.row);
  return `${indexToCol(col)}${row}`;
}

function colToIndex(col: string): number {
  let index = 0;
  for (const char of col.toUpperCase()) index = index * 26 + (char.charCodeAt(0) - 64);
  return index;
}

function indexToCol(index: number): string {
  let value = index;
  let out = '';
  while (value > 0) {
    const rem = (value - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

/** 规范化为快照里的 `ref` 写法；非法返回 null（调用方据此报错，不猜） */
export function normalizeRef(input: string): string | null {
  const parsed = parseRef(input);
  if (!parsed) return null;
  return parsed.sheetName ? `${quoteSheetName(parsed.sheetName)}!${parsed.range}` : parsed.range;
}

/** `A1:B2` → `$A$1:$B$2`（导出用，Excel 自己的 definedName 也是绝对引用） */
function toAbsolute(range: string): string {
  return range
    .split(':')
    .map((cell) => {
      const match = CELL_PATTERN.exec(cell);
      return match ? `$${match[1]}$${match[2]}` : cell;
    })
    .join(':');
}

/**
 * 导出用的完整引用：局部名称（有 scope 表）必须带表名，否则 Excel 会把它当成工作簿级名称的相对引用。
 * 返回 null 表示引用非法，跳过该名称（调用方已做校验，这里只是兜底）。
 */
export function toDefinedNameRef(range: NamedRange, sheetName: string | undefined): string | null {
  const parsed = parseRef(range.ref);
  if (!parsed) return null;
  const resolvedSheet = parsed.sheetName ?? sheetName;
  const body = toAbsolute(parsed.range);
  return resolvedSheet ? `${quoteSheetName(resolvedSheet)}!${body}` : body;
}

/** xml 属性值 / 文本节点转义（`escapeXml` 同时用于两者） */
const esc = escapeXml;

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readAttr(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match ? unescapeXml(match[1]) : undefined;
}

/** workbook.xml 里一条 `<definedName>` 的原始形态 */
export interface RawDefinedName {
  name: string;
  ref: string;
  localSheetId?: number;
  hidden?: boolean;
  comment?: string;
}

/** 从 workbook.xml 读取 `<definedNames>`；没有该块时返回空数组 */
export function parseDefinedNamesXml(workbookXml: string): RawDefinedName[] {
  const block = /<definedNames\b[^>]*>([\s\S]*?)<\/definedNames>/.exec(workbookXml);
  if (!block) return [];
  const out: RawDefinedName[] = [];
  const entryPattern = /<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g;
  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(block[1])) !== null) {
    const attrs = match[1];
    const name = readAttr(attrs, 'name');
    const text = unescapeXml(match[2]).trim();
    if (!name || !text) continue;
    const localSheetId = readAttr(attrs, 'localSheetId');
    const hidden = readAttr(attrs, 'hidden');
    const comment = readAttr(attrs, 'comment');
    out.push({
      name,
      ref: text,
      ...(localSheetId !== undefined && Number.isFinite(Number(localSheetId))
        ? { localSheetId: Number(localSheetId) }
        : {}),
      ...(hidden === '1' || hidden === 'true' ? { hidden: true } : {}),
      ...(comment ? { comment } : {}),
    });
  }
  return out;
}

/**
 * workbook.xml 的 `<definedNames>` 重写：先删旧块再按 CT_Workbook 的顺序插入。
 *
 * 顺序要求（Excel 会报"内容有问题"）：`sheets → functionGroups → externalReferences →
 * definedNames → calcPr → pivotCaches → … → extLst`。所以优先插在 `</sheets>` 之后。
 */
export function setDefinedNamesInWorkbookXml(
  workbookXml: string,
  names: readonly NamedRange[],
  sheetOrder: readonly string[],
  sheets: Readonly<Record<string, { name: string }>> = {},
): string {
  const withoutBlock = workbookXml.replace(/<definedNames\b[^>]*>[\s\S]*?<\/definedNames>/, '');
  if (names.length === 0) return withoutBlock;

  const entries = names
    .map((item) => {
      const sheetName = item.sheetId ? (sheets[item.sheetId]?.name ?? undefined) : undefined;
      const ref = toDefinedNameRef(item, sheetName);
      if (!ref) return null;
      const localIndex = item.sheetId ? sheetOrder.indexOf(item.sheetId) : -1;
      const attrs = [
        `name="${esc(item.name)}"`,
        localIndex >= 0 ? `localSheetId="${localIndex}"` : '',
        item.hidden ? 'hidden="1"' : '',
        item.comment ? `comment="${esc(item.comment)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<definedName ${attrs}>${esc(ref)}</definedName>`;
    })
    .filter((entry): entry is string => entry !== null);
  if (entries.length === 0) return withoutBlock;

  const block = `<definedNames>${entries.join('')}</definedNames>`;
  const sheetsEnd = withoutBlock.indexOf('</sheets>');
  if (sheetsEnd >= 0) {
    const at = sheetsEnd + '</sheets>'.length;
    return `${withoutBlock.slice(0, at)}${block}${withoutBlock.slice(at)}`;
  }
  for (const marker of ['<calcPr', '<pivotCaches', '<extLst']) {
    const index = withoutBlock.indexOf(marker);
    if (index >= 0) return `${withoutBlock.slice(0, index)}${block}${withoutBlock.slice(index)}`;
  }
  const close = withoutBlock.lastIndexOf('</workbook>');
  return close < 0
    ? withoutBlock
    : `${withoutBlock.slice(0, close)}${block}${withoutBlock.slice(close)}`;
}

/* ---------------------------------- zip 读写 ---------------------------------- */

const WORKBOOK_PART = 'xl/workbook.xml';

/**
 * 从 .xlsx 读名称。返回空数组表示"文件里没有名称"或"读不出来"——后者不额外报错，
 * 与其它保真读取（形状/图表 part）的处理一致：坏文件不该让整次导入失败。
 */
export async function readNamedRangesFromXlsx(
  bytes: ArrayBuffer | Uint8Array,
  sheetOrder: readonly string[],
  sheets: Readonly<Record<string, { name: string }>> = {},
): Promise<NamedRange[]> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file(WORKBOOK_PART);
    if (!file) return [];
    const workbookXml = await file.async('string');
    return rawToNamedRanges(parseDefinedNamesXml(workbookXml), sheetOrder, sheets);
  } catch {
    return [];
  }
}

/** XML 形态 → 快照形态（localSheetId 换成 sheetId，引用拆成不带表名的 `ref`） */
export function rawToNamedRanges(
  raw: readonly RawDefinedName[],
  sheetOrder: readonly string[],
  sheets: Readonly<Record<string, { name: string }>> = {},
): NamedRange[] {
  return raw.map((entry, index) => {
    const sheetId = entry.localSheetId !== undefined ? sheetOrder[entry.localSheetId] : undefined;
    const parsed = parseRef(entry.ref);
    /**
     * 局部名称的引用里通常也带表名（Excel 就这么写）。作用域已经由 sheetId 表达，这里把冗余前缀
     * 去掉：否则表一改名，引用就指向一个不存在的表名了。
     */
    const scopedName = sheetId ? sheets[sheetId]?.name : undefined;
    const stripPrefix =
      scopedName !== undefined &&
      parsed?.sheetName !== undefined &&
      parsed.sheetName.toLowerCase() === scopedName.toLowerCase();
    const ref = parsed
      ? parsed.sheetName && !stripPrefix
        ? `${parsed.sheetName}!${parsed.range}`
        : parsed.range
      : entry.ref;
    return {
      id: `name-${index + 1}`,
      name: entry.name,
      // 解析不了的引用原样保留（例如指向另一个名称），至少不丢信息
      ref,
      ...(sheetId ? { sheetId } : {}),
      ...(entry.comment ? { comment: entry.comment } : {}),
      ...(entry.hidden ? { hidden: true } : {}),
    };
  });
}

/** 把名称写进 exceljs 产出的 .xlsx（没有名称时只负责清掉旧块） */
export async function injectNamedRanges(
  bytes: ArrayBuffer | Uint8Array,
  names: readonly NamedRange[],
  sheetOrder: readonly string[],
  sheets: Readonly<Record<string, { name: string }>> = {},
): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file(WORKBOOK_PART);
  if (!file) return bytes instanceof ArrayBuffer ? bytes : (bytes.buffer as ArrayBuffer);
  const workbookXml = await file.async('string');
  const next = setDefinedNamesInWorkbookXml(workbookXml, names, sheetOrder, sheets);
  if (next === workbookXml) {
    return bytes instanceof ArrayBuffer ? bytes : (bytes.buffer as ArrayBuffer);
  }
  zip.file(WORKBOOK_PART, next);
  return (await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })) as ArrayBuffer;
}
