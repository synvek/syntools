/**
 * Workbook theme palette (xl/theme/theme1.xml → <a:clrScheme>).
 *
 * `<color theme="4"/>` does not name a colour, it names *a slot in this file's theme* — accent1 of the
 * Excel theme the author picked. Only the file's own theme part says which RGB that is, so import has to
 * resolve it here: Univer's built-in palette belongs to Univer, not to the workbook, and painting with it
 * shows a visibly different colour (the classic "主题色不一样" import bug). Resolving to RGB also fixes the
 * round-trip, because the export then writes the same concrete colour.
 *
 * Parsed with regex rather than DOMParser: the importer also runs inside a worker, where no DOM exists.
 */

/** Theme slots in the order the OOXML `theme` attribute indexes them (0…11) */
export type ThemePalette = readonly (string | undefined)[];

const SCHEME_KEYS = [
  'dk1',
  'lt1',
  'dk2',
  'lt2',
  'accent1',
  'accent2',
  'accent3',
  'accent4',
  'accent5',
  'accent6',
  'hlink',
  'folHlink',
] as const;

const PREFIX = '(?:[A-Za-z0-9]+:)?';

/** Parse `<a:clrScheme>` of a theme part; undefined when the part carries no usable colours */
export function parseThemePalette(xml: string): ThemePalette | undefined {
  const scheme = new RegExp(
    `<${PREFIX}clrScheme\\b[^>]*>([\\s\\S]*?)</${PREFIX}clrScheme>`,
    'i',
  ).exec(xml);
  if (!scheme) return undefined;
  const colors = SCHEME_KEYS.map((key) => readSchemeColor(scheme[1], key));
  return colors.some(Boolean) ? colors : undefined;
}

/** One slot: prefers <a:srgbClr val>, falls back to <a:sysClr lastClr> (dk1/lt1 are usually system colours) */
function readSchemeColor(scheme: string, key: string): string | undefined {
  const block = new RegExp(`<${PREFIX}${key}\\b[^>]*>([\\s\\S]*?)</${PREFIX}${key}>`, 'i').exec(
    scheme,
  );
  if (!block) return undefined;
  const rgb = new RegExp(`<${PREFIX}srgbClr\\b[^>]*\\bval="([0-9A-Fa-f]{6})"`, 'i').exec(block[1]);
  if (rgb) return `#${rgb[1].toUpperCase()}`;
  const sys = new RegExp(`<${PREFIX}sysClr\\b[^>]*\\blastClr="([0-9A-Fa-f]{6})"`, 'i').exec(
    block[1],
  );
  if (sys) return `#${sys[1].toUpperCase()}`;
  return undefined;
}

/** Resolve a `<color theme="n" tint="t"/>` reference against the workbook palette */
export function resolveThemeColor(
  palette: ThemePalette | undefined,
  theme: number | undefined,
  tint?: number,
): string | undefined {
  if (!palette || typeof theme !== 'number') return undefined;
  const base = palette[theme];
  return base ? applyTint(base, tint) : undefined;
}

/**
 * Excel's tint semantics: negative mixes towards black, positive towards white, per channel.
 * Tints are common in real files (`<color theme="4" tint="-0.249977111117893"/>`), so ignoring them
 * would resolve "mostly right but visibly wrong" colours.
 */
export function applyTint(hex: string, tint?: number): string {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (!tint || !Number.isFinite(tint) || normalized.length < 6)
    return `#${normalized.toUpperCase()}`;
  const channels = [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16));
  const shifted = channels.map((channel) =>
    tint < 0 ? channel * (1 + tint) : channel * (1 - tint) + 255 * tint,
  );
  const clamped = shifted.map((value) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${clamped.join('').toUpperCase()}`;
}

/**
 * Read the workbook theme out of the archive.
 * A missing or unreadable theme part is not an import error — theme colours simply stay unresolved,
 * which is what happened before this module existed.
 */
export async function readXlsxThemePalette(buffer: ArrayBuffer): Promise<ThemePalette | undefined> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const candidates = Object.keys(zip.files)
      .filter((path) => /^xl\/theme\/[^/]+\.xml$/i.test(path))
      .sort();
    for (const path of candidates) {
      const file = zip.file(path);
      if (!file) continue;
      const palette = parseThemePalette(await file.async('string'));
      if (palette) return palette;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
