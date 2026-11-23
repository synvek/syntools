/**
 * `llms.txt` builder — the "GEO" counterpart of `sitemap.xml`.
 *
 * Search engines crawl the prerendered pages; **answer engines** (ChatGPT, Claude, Perplexity,
 * Copilot…) work better from a single curated map: what the site is, which pages exist, and what
 * each one does. The format is the llms.txt proposal (llmstxt.org): an H1 name, a blockquote
 * summary, then `## Section` blocks of `- [name](url): note` links, plus an optional `## Optional`
 * list of secondary pages.
 *
 * Why this lives in `src/core/seo` and not in the prerender script: the script is a Vite plugin with
 * no test harness, while this is pure string assembly that deserves unit tests. `scripts/prerender.ts`
 * loads it through the same SSR pipeline it already uses for the registry and copy.
 *
 * Kept deliberately terse: an LLM context is not free, so every line says what a page *does*, not
 * what it might do.
 */

export interface LlmsLink {
  url: string;
  name: string;
  /** One sentence; the same text the tool page's meta description leads with */
  description: string;
}

export interface LlmsSection {
  heading: string;
  links: LlmsLink[];
}

export interface LlmsDoc {
  siteName: string;
  summary: string;
  /** Short factual bullets under the summary (language trees, licence, processing model) */
  facts: string[];
  sections: LlmsSection[];
  /** Secondary pages (pricing, security…) rendered as `## Optional` */
  optional: LlmsLink[];
}

/** Renders one `- [name](url): description` line, collapsing whitespace so a newline cannot break the list */
function linkLine(link: LlmsLink): string {
  const note = link.description.replace(/\s+/g, ' ').trim();
  return note ? `- [${link.name}](${link.url}): ${note}` : `- [${link.name}](${link.url})`;
}

/**
 * Assembles the whole file.
 *
 * Section order is the caller's (category order in the registry), which keeps the home page,
 * `llms.txt` and the sitemap from disagreeing about what the site contains.
 */
export function buildLlmsTxt(doc: LlmsDoc): string {
  const blocks: string[] = [`# ${doc.siteName}`, `> ${doc.summary.replace(/\s+/g, ' ').trim()}`];

  if (doc.facts.length) blocks.push(doc.facts.map((fact) => `- ${fact}`).join('\n'));

  for (const section of doc.sections) {
    if (!section.links.length) continue;
    blocks.push(`## ${section.heading}\n\n${section.links.map(linkLine).join('\n')}`);
  }

  if (doc.optional.length) {
    blocks.push(`## Optional\n\n${doc.optional.map(linkLine).join('\n')}`);
  }

  return `${blocks.join('\n\n')}\n`;
}
