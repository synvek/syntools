# SynTools

**English** | [简体中文](./README.zh-CN.md)

**A privacy-first, browser-local toolkit for everyone — developers, office users, and anyone handling documents.**

SynTools is a unified collection of everyday utilities — office documents (Word / Excel / PowerPoint), PDF processing, image & photo editing, encoding, formatting, hashing, generators, and more — that run entirely in your browser. No install, no account, and by default **your data never leaves the device**.

You can access online: www.syntools.net

---

## Why SynTools?

| Pain point                                         | How SynTools helps                                  |
| -------------------------------------------------- | --------------------------------------------------- |
| Tools scattered across many ad-heavy sites         | One consistent UI and a single search entry         |
| Uploading sensitive text to third-party servers    | Pure client-side computation (default)              |
| Re-finding the same utilities every day            | Favorites, recent history, and ⌘K search            |
| Editing a `.docx` / `.xlsx` / `.pptx` needs Office | Browser-based editors — no install, no license      |
| PDF and image tasks behind sign-up or paywalls     | Full PDF and photo toolsets, free and local         |
| Contracts or reports uploaded to online converters | Files are parsed and exported on-device, end to end |

**Core values**

1. **Privacy** — processing stays in the browser unless a tool explicitly needs a server
2. **Speed** — static site + local compute; results appear as you type
3. **Consistency** — shared layout, IO panels, copy/download, and error handling
4. **Extensibility** — registry-driven plugins; add a tool with one directory + one registration line

### Who is it for?

SynTools started as a developer toolbox, but it is no longer developer-only:

- **Developers** — encoding, formatters, regex, hashes, JWT, UUIDs, cron, …
- **Office & document work** — Word / Excel / PowerPoint editors, flowcharts, mind maps, full PDF toolset
- **Design & media** — photo editor with layers and PSD export, image compress / crop / watermark, GIF frames
- **Everyday tasks** — calculators, unit & length converters, BMI, QR codes, countdowns, charts

---

## Features

- **150+ tools** across encoding, text, formatting, crypto, datetime, generators, network, file, image, media, PDF, office documents, cheatsheets, and more
- **Global search** — `⌘/Ctrl + K` or `/` (when not typing in an input)
- **Recent & favorites** — stored in `localStorage` on your machine
- **Light / dark theme** — system preference by default, no flash on load
- **i18n-ready** — 9 locales: 简体中文 / English / 繁體中文 / 日本語 / Français / Deutsch / Italiano / Español / Português
- **Lazy-loaded tools** — the app shell stays small; each tool loads on demand
- **Static deploy** — works on GitHub Pages, Vercel, Cloudflare Pages, or any static host
- **Desktop app** — optional Tauri packaging for macOS / Windows / Linux

---

## Tool categories

| Category     | Examples                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Office Tools | Word processor (.docx), spreadsheets (.xlsx, formulas & multi-sheet), slides (.pptx & slideshow), flowcharts (multi-page), mind maps (multi-canvas), photo editor (layers, masks, adjustment layers, PSD export) — see [Office tools](#office-tools) |
| Encoding     | Base64, URL codec, Unicode, HTML entities, ASCII table, base16/32/58, Morse, Caesar/ROT13/rail fence, escape/unescape, garbled-text rescue                                                                                                           |
| Text         | Regex tester, text diff, case convert, counter, pinyin, zh convert                                                                                                                                                                                   |
| Formatting   | JSON / SQL / HTML / JS / CSS / XML formatters, Markdown preview, CSV↔JSON, code minifier (CSS/HTML/JS/JSON)                                                                                                                                          |
| Crypto       | Hash, HMAC, JWT parser, password generator/strength, AES, RSA encrypt + sign, key format converter (PEM/DER/JWK/OpenSSH), PBKDF2, CRC-32/Adler-32/FNV                                                                                                |
| Date & time  | Timestamp, calendar, countdown, stopwatch, cron parse/generate, time zone converter                                                                                                                                                                  |
| Generators   | UUID, QR code, barcode (Code 39/128/EAN-13), ID generator (ULID/NanoID/Snowflake/ObjectId), random string/number, placeholder image, CSS gradient                                                                                                    |
| Image        | Compress, crop, merge, watermark, GIF frames, SVG→PNG, Base64, ICO, grid cut, ID photo, image→ASCII                                                                                                                                                  |
| PDF          | Merge, split, rotate, encrypt/decrypt, compress, extract text, watermark, annotate, to/from image, page numbers, sign                                                                                                                                |
| Network      | IP calculator (VLSM), CIDR, MAC, URL parser, UA parser/generator, HTTP headers/request, WebSocket tester, random port                                                                                                                                |
| File         | ZIP create/extract, file split/merge, bulk rename                                                                                                                                                                                                    |
| Media        | Video / audio transcoding (WebCodecs-first, ffmpeg.wasm fallback), video→GIF, subtitle (SRT/WebVTT) converter                                                                                                                                        |
| Cheatsheet   | HTTP status codes, MIME types, Git commands                                                                                                                                                                                                          |
| Other        | Calculator, unit converter, loan/tax calculator, MBTI, AI prompts, Mermaid, chart generator, …                                                                                                                                                       |

Browse the full list on the home page or in `src/core/registry/index.ts`.

### Office tools

A growing family of document-class editors — all run locally, all keep drafts on-device.

| Tool               | Route                       | Highlights                                                                                                                                        |
| ------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Word Processor     | `/tools/rich-text-editor`   | Word `.docx` import/export, two PDF export modes                                                                                                  |
| Spreadsheet Editor | `/tools/spreadsheet-editor` | Excel `.xlsx` import/export, formulas, multi-sheet                                                                                                |
| Slides Editor      | `/tools/slide-editor`       | PowerPoint `.pptx` import/export, Konva canvas editing, slideshow                                                                                 |
| Flowchart Editor   | `/tools/flowchart-editor`   | Shapes & connectors, templates, auto-layout, **multi-page with thumbnail overview**, PNG/SVG                                                      |
| Mind Map Editor    | `/tools/mindmap-editor`     | Keyboard-first editing, collapsible branches, themes, **multi-canvas with thumbnail overview**, PNG/SVG/Markdown                                  |
| Photo Editor       | `/tools/photo-editor`       | Non-destructive layers (groups, masks, adjustment layers, smart objects), selections & crop, adjustments & filters, history panel, **PSD export** |

Common traits: drafts autosave to `localStorage`, and exports stay editable in their target format (`.docx` / `.xlsx` / `.pptx` / PNG·SVG / PSD). Editors with several pages or canvases add a thumbnail overview plus `Ctrl/⌘ + PageUp / PageDown` to browse them; the flowchart and photo editors can also save a re-editable project JSON.

---

## Tech stack

| Layer           | Choice                               |
| --------------- | ------------------------------------ |
| Language        | TypeScript (strict)                  |
| UI              | React 18                             |
| Build           | Vite 6                               |
| Routing         | React Router 7                       |
| Styling         | Tailwind CSS 3 (`darkMode: 'class'`) |
| State           | Zustand                              |
| i18n            | i18next / react-i18next              |
| Unit tests      | Vitest + Testing Library             |
| E2E             | Playwright                           |
| Package manager | pnpm 11                              |

Architecture is **registry-driven**: sidebar, home cards, search index, and routes are all derived from a single `tools` array in `src/core/registry/index.ts`.

---

## Requirements

| Dependency | Version                            |
| ---------- | ---------------------------------- |
| Node.js    | ≥ 20 (22.x recommended)            |
| pnpm       | 11.x (locked via `packageManager`) |

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

Open [http://localhost:9999](http://localhost:9999).

### Scripts

| Command             | Description                             |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Start Vite dev server                   |
| `pnpm build`        | Typecheck (`tsc -b`) + production build |
| `pnpm preview`      | Preview the production build locally    |
| `pnpm test`         | Run unit tests (Vitest)                 |
| `pnpm test:watch`   | Vitest watch mode                       |
| `pnpm e2e`          | Run Playwright end-to-end tests         |
| `pnpm lint`         | ESLint (zero warnings allowed)          |
| `pnpm lint:fix`     | ESLint with auto-fix                    |
| `pnpm format`       | Prettier write                          |
| `pnpm format:check` | Prettier check                          |
| `pnpm typecheck`    | TypeScript only                         |
| `pnpm size`         | Bundle size budget check                |

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

- Client tools process input in the browser only — text, office documents, PDFs, and images alike — they must not send user content to remote endpoints.
- Favorites, recent tools, and theme preference live in `localStorage` (`syntools:*` keys); editor drafts stay on-device too.
- Production headers (CSP, COOP, Referrer-Policy, etc.) are configured in `vercel.json`.
- Future server-backed tools (`ToolMeta.mode = 'server'`) will be labeled clearly before any data leaves the browser.

---

## Performance budget

| Metric                       | Budget                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| First-screen entry (gzip)    | ≤ 210 KB (grows with the bundled `zh`+`en` tool copy)       |
| Individual lazy chunk (gzip) | ≤ 500 KB (heavy deps such as Univer / exceljs ≤ 2 MB)       |
| Static asset (not bundled)   | ≤ 40 MB (self-hosted `ffmpeg.wasm` core, fetched on demand) |

Enforced by `pnpm size` (`scripts/check-bundle-size.mjs`). Tools must use `component: () => import(...)` so they stay out of the initial bundle — heavy third-party dependencies belong in a tool's own async chunk (for example the photo editor's PSD writer loads `ag-psd` only when you export). Prefer the built-in `Icon` component over icon libraries.

### Media engine (WebCodecs-first, ffmpeg.wasm fallback)

Audio/video tools (`video-convert`, `audio-convert`, `video-to-gif`) prefer the browser-native **WebCodecs** API through [Mediabunny](https://mediabunny.dev) — zero download, hardware-accelerated, with precise frame access. When WebCodecs cannot handle a container/codec, they fall back to **ffmpeg.wasm** (`@ffmpeg/core-mt`, multi-threaded).

Because the wasm core is ~31 MB it is **never bundled**: `pnpm ffmpeg:fetch` downloads it into `public/ffmpeg/<version>/` (git-ignored, copied verbatim into `dist/`), and it is fetched only when a fallback actually runs. `predev`/`prebuild` invoke the fetch automatically (fail-soft offline).

Multi-threaded ffmpeg.wasm needs `SharedArrayBuffer`, which requires cross-origin isolation — that is why `vercel.json`, `public/_headers` and Vite's dev/preview server all send `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. The CSP also allows `'wasm-unsafe-eval'` (compiling wasm) plus `blob:`/`data:` for `worker-src`, `img-src`, `media-src` and `connect-src` (canvas/object-URL previews). Everything stays same-origin.

---

## Deployment

The build output is a static SPA in `dist/`.

**Vercel** — `vercel.json` already defines `buildCommand`, `outputDirectory`, SPA rewrites, and security headers (`BASE_PATH` defaults to `/`).

**Other hosts** — serve `dist/`, rewrite unknown paths to `index.html`, and cache hashed `/assets/*` aggressively. For GitHub project pages under a subpath, build with `pnpm build:pages` (sets `BASE_PATH=/syntools/`).

```bash
pnpm build
pnpm preview   # optional local check
```

### Desktop (Tauri)

Requires [Rust](https://www.rust-lang.org/tools/install) and platform prerequisites ([Tauri docs](https://v2.tauri.app/start/prerequisites/)).

```bash
pnpm tauri:dev     # Vite + native window with HMR
pnpm tauri:build   # artifacts under src-tauri/target/release/bundle/
```

CI runs `pnpm tauri:build` on **Linux / Windows / macOS** × **x64 / arm64** (6 runners) and uploads platform bundles as artifacts.

---

## Contributing

1. Fork / clone and create a feature branch.
2. Follow the tool template and TypeScript/ESLint/Prettier rules.
3. Keep framework code free of tool-specific third-party deps (put them under `src/tools/*`).
4. Ensure `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass before opening a PR.

---

<p align="center">
  <sub>Built for anyone who wants fast, private, local tools — from code snippets to office documents and PDFs — in one place.</sub>
</p>
