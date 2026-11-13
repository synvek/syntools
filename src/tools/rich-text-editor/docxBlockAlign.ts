/**
 * Align Word paragraphs with the blocks mammoth produced.
 *
 * The two sides never line up one-to-one: mammoth wraps a paragraph in `<li>` inside lists, expands
 * every table cell into its own `<p>`, and drops paragraphs it cannot represent. Matching by index
 * therefore breaks on the first difference, and a plain forward scan gets stuck as soon as an HTML
 * block appears that Word never had (a table cell emitted in the middle) — which is what made a
 * document lose *every* paragraph property, and every shape, over one table.
 *
 * Longest-common-subsequence over the block texts fixes both: the pairs it returns keep document
 * order, and anything unmatched is simply skipped on whichever side it appears.
 */

/** Above this many cells the table is too large to be worth an exact alignment: fall back to a scan */
const MAX_CELLS = 400_000;

/**
 * Pair indices of `left` with indices of `right`, keeping order.
 * Keys must already be normalised — the caller decides what counts as "the same paragraph".
 */
export function alignBlocks(
  left: readonly string[],
  right: readonly string[],
): Map<number, number> {
  const pairs = new Map<number, number>();
  const rows = left.length;
  const columns = right.length;
  if (rows === 0 || columns === 0) return pairs;

  if (rows * columns > MAX_CELLS) {
    // Greedy forward scan: still order-preserving, just not optimal
    let cursor = 0;
    for (let index = 0; index < rows; index += 1) {
      const key = left[index];
      for (let scan = cursor; scan < columns; scan += 1) {
        if (right[scan] === key) {
          pairs.set(index, scan);
          cursor = scan + 1;
          break;
        }
      }
    }
    return pairs;
  }

  // dp[i][j] = length of the LCS of left[i..] and right[j..]
  const dp: Int32Array[] = Array.from({ length: rows + 1 }, () => new Int32Array(columns + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    const row = dp[i];
    const next = dp[i + 1];
    if (!row || !next) continue;
    for (let j = columns - 1; j >= 0; j -= 1) {
      row[j] =
        left[i] === right[j] ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (left[i] === right[j]) {
      pairs.set(i, j);
      i += 1;
      j += 1;
      continue;
    }
    const skipLeft = dp[i + 1]?.[j] ?? 0;
    const skipRight = dp[i]?.[j + 1] ?? 0;
    if (skipLeft >= skipRight) i += 1;
    else j += 1;
  }
  return pairs;
}
