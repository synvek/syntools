# SynTools

**English** | [简体中文](./README.zh-CN.md)

**A privacy-first, browser-local toolkit for developers.**

SynTools is a unified collection of everyday utilities — encoding, formatting, hashing, image/PDF processing, generators, and more — that run entirely in your browser. No install, no account, and by default **your data never leaves the device**.

---

## Why SynTools?

| Pain point | How SynTools helps |
| --- | --- |
| Tools scattered across many ad-heavy sites | One consistent UI and a single search entry |
| Uploading sensitive text to third-party servers | Pure client-side computation (default) |
| Re-finding the same utilities every day | Favorites, recent history, and ⌘K search |

**Core values**

1. **Privacy** — processing stays in the browser unless a tool explicitly needs a server
2. **Speed** — static site + local compute; results appear as you type
3. **Consistency** — shared layout, IO panels, copy/download, and error handling
4. **Extensibility** — registry-driven plugins; add a tool with one directory + one registration line

---

## Features

- **90+ tools** across encoding, text, formatting, crypto, datetime, generators, network, image, PDF, and more
- **Global search** — `⌘/Ctrl + K` or `/` (when not typing in an input)
- **Recent & favorites** — stored in `localStorage` on your machine
- **Light / dark theme** — system preference by default, no flash on load
- **i18n-ready** — Chinese and English locale strings
- **Lazy-loaded tools** — the app shell stays small; each tool loads on demand
- **Static deploy** — works on Vercel, Cloudflare Pages, or any static host

---

## Tool categories

| Category | Examples |
| --- | --- |
| Encoding | Base64, URL codec, Unicode, HTML entities, ASCII table |
| Text | Regex tester, text diff, case convert, counter, pinyin, zh convert |
| Formatting | JSON / SQL / HTML / JS / CSS / XML formatters, Markdown preview |
| Crypto | Hash, JWT parser, password generator |
| Date & time | Timestamp, calendar, countdown, stopwatch, cron parse/generate |
| Generators | UUID, QR code, random string/number, placeholder image, CSS gradient |
| Image | Compress, crop, merge, watermark, GIF frames, SVG→PNG, Base64, ICO |
| PDF | Merge, split, rotate, encrypt, annotate, to/from image, page numbers, sign |
| Network | UA parser |
| Other | Calculator, MBTI, AI prompts, Mermaid, mind map, chart generator, … |

Browse the full list on the home page or in `src/core/registry/index.ts`.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| UI | React 18 |
| Build | Vite 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 3 (`darkMode: 'class'`) |
| State | Zustand |
| i18n | i18next / react-i18next |
| Unit tests | Vitest + Testing Library |
| E2E | Playwright |
| Package manager | pnpm 11 |

Architecture is **registry-driven**: sidebar, home cards, search index, and routes are all derived from a single `tools` array in `src/core/registry/index.ts`.

---

## Requirements

| Dependency | Version |
| --- | --- |
| Node.js | ≥ 20 (22.x recommended) |
| pnpm | 11.x (locked via `packageManager`) |

Enable Corepack if needed:

```bash
corepack enable
```

---

## Quick start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Typecheck (`tsc -b`) + production build |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm e2e` | Run Playwright end-to-end tests |
| `pnpm lint` | ESLint (zero warnings allowed) |
| `pnpm lint:fix` | ESLint with auto-fix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |
| `pnpm typecheck` | TypeScript only |
| `pnpm size` | Bundle size budget check |

Pre-commit hooks (Husky + lint-staged) run `eslint --fix` and `prettier --write` on staged files.

---

## Project structure

```
syntools/
├── index.html                 # Entry + inline theme bootstrap (no FOUC)
├── vite.config.ts             # Vite + Vitest (@ → src)
├── vercel.json                # SPA rewrites + security headers
└── src/
    ├── main.tsx
    ├── app/                   # Shell: layout, home, search, routes
    ├── core/                  # Types, registry, shared UI, hooks, PDF helpers
    ├── stores/                # Theme, history, favorites
    └── tools/                 # One directory per tool
        ├── _template/         # Copy-paste starter
        └── <tool-id>/
            ├── index.ts       # ToolMeta
            ├── *Tool.tsx      # Lazy-loaded UI
            ├── core.ts        # Pure logic (ToolResult)
            └── core.test.ts
```

---

## Adding a tool

1. Copy `src/tools/_template` to `src/tools/<your-id>`.
2. Implement pure functions in `core.ts` that return `ToolResult<T>` (do not throw for expected errors):

   ```ts
   type ToolResult<T> = { ok: true; value: T } | { ok: false; error: string };
   ```

3. Fill in `ToolMeta` in `index.ts` (`id`, `name`, `description`, `category`, `keywords`, `icon`, lazy `component`).
4. Build the UI with shared components (`IOTextArea`, `CopyButton`, `FileDropZone`, …).
5. Register one line in `src/core/registry/index.ts`.
6. Add `core.test.ts` (aim for ≥ 80% coverage on core logic).
7. Run `pnpm test && pnpm lint`.

After registration, `/tools/<id>`, the sidebar group, home cards, and ⌘K search update automatically.

---

## Privacy & security

- Client tools process input in the browser only; they must not send user content to remote endpoints.
- Favorites, recent tools, and theme preference live in `localStorage` (`syntools:*` keys).
- Production headers (CSP, COOP, Referrer-Policy, etc.) are configured in `vercel.json`.
- Future server-backed tools (`ToolMeta.mode = 'server'`) will be labeled clearly before any data leaves the browser.

---

## Performance budget

| Metric | Budget |
| --- | --- |
| App shell (gzip) | ≤ 150 KB |
| Individual tool chunk (gzip) | ≤ 100 KB (prefer far smaller) |

Tools must use `component: () => import(...)` so they stay out of the initial bundle. Prefer the built-in `Icon` component over icon libraries.

---

## Deployment

The build output is a static SPA in `dist/`.

**Vercel** — `vercel.json` already defines `buildCommand`, `outputDirectory`, SPA rewrites, and security headers.

**Other hosts** — serve `dist/`, rewrite unknown paths to `index.html`, and cache hashed `/assets/*` aggressively.

```bash
pnpm build
pnpm preview   # optional local check
```

---

## Contributing

1. Fork / clone and create a feature branch.
2. Follow the tool template and TypeScript/ESLint/Prettier rules.
3. Keep framework code free of tool-specific third-party deps (put them under `src/tools/*`).
4. Ensure `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass before opening a PR.

---

<p align="center">
  <sub>Built for developers who want fast, private, local tools in one place.</sub>
</p>
