# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Broad utility users, not skewed toward one group: developers, document/office and creator users, image and design handlers, and people who just need a lightweight everyday tool. The usage scenario is "open a browser (or optionally the desktop shell) and get one thing done" — no install, no sign-up, and no handing sensitive files to a third-party website.

## Product Purpose

SynTools gathers everyday utilities behind a single entry point: office documents (Word / Excel / PowerPoint), PDF, images and photos, encoding, formatting, hashing, generators, network and file handling, and more — all running locally in the browser by default. Success means a user can find a tool fast, finish the task and take the result away, with their data never leaving the device by default.

## Positioning

Compared with ad-heavy online tool sites that require uploads, and with Office/desktop software that requires installation and licensing, SynTools has to hold two things at once:

1. **Privacy first** — unless a tool explicitly needs a server, processing happens in the browser/on the machine, and data is not uploaded by default.
2. **Single entry point + free local use** — one search and one consistent UI (favorites, recent, ⌘K) replacing scattered sites and paywalls, with core capabilities free to use.

Both are equally central; neither may be sacrificed for the other.

## Operating Context

- Primary delivery: a static web app (e.g. www.syntools.net; also works on static hosts such as GitHub Pages, Vercel and Cloudflare Pages).
- Optional desktop shell: packaged with Tauri (macOS / Windows / Linux). The design language is still the same web UI — not a per-platform native app with its own skin.
- Typical ritual: open the site or app → ⌘/Ctrl+K or `/` to search → use a tool → copy/download the result; favorites and recents live in local `localStorage`.
- Document-level workflows: import/edit `.docx` / `.xlsx` / `.pptx`, PDF and images, then export in a format you can keep editing or hand off; drafts are auto-saved locally by default.

## Capabilities and Constraints

**Confirmed capabilities (product facts, not an exhaustive list):**

- 150+ tools, registry-driven; the sidebar, home page, search and routing are all derived from one registry.
- Global search, recents, favorites; light/dark theme (follows the system by default); i18n for 9 locales.
- Lazy-loaded tools; static deployment; optional Tauri desktop.
- License: AGPL-3.0-only; author/entity mark Synvek.

**Technical and product constraints:**

- Client-side local computation by default; any tool that needs a server must say so explicitly and may not quietly weaken the "privacy first" promise.
- Tool routes stay stable (including legacy ids) so bookmarks and external links keep working.
- The design language is the web UI; desktop is an optional shell and does not get its own native design system unless it is explicitly changed to adaptive later.

**Open questions (genuinely undecided, do not invent answers):**

- Whether to elevate one user group to primary audience, or to adjust the paid/value-added boundary: not decided in this init.

## Brand Commitments

- Product name: **SynTools**; associated entity: **Synvek**.
- Official site: www.syntools.net; repository: https://github.com/synvek/syntools.
- Existing brand assets: `public/logo.svg`; Tauri app name SynTools (`com.synvek.syntools`).
- License and copyright wording must respect AGPL-3.0-only; copy must never imply "already processed in the cloud" or "registration required to use core tools" unless the product facts change.
- Voice (drawn from existing product copy): direct, speaking through capabilities and the privacy promise; never invent customer quotes or unpublished metrics.

## Evidence on Hand

- The runnable product and its copy: `README.md` / `README.zh-CN.md`, the live site, local `pnpm dev`.
- Source of truth for tool registration and categories: `src/core/registry/`.
- Logo: `public/logo.svg`; desktop icons: `src-tauri/icons/`.
- There are **no** confirmed customer quotes, case studies, independent review scores or growth metrics; later marketing/landing-page work must not fabricate such evidence.

## Product Principles

1. **Local by default** — if it can be done on the device, never upload by default; when the network is required, say so honestly.
2. **One entry point** — search, favorites, recents and a consistent tool shell beat isolated single-tool experiences.
3. **Broadly useful** — never sacrifice reachability on one side (developers / office users) to serve the other.
4. **Extensible without fragmenting** — new tools follow the registry and layout conventions; growth never comes at the cost of broken routes or an inconsistent shell.
5. **Honest evidence** — state only verifiable capabilities and constraints; no invented users, metrics or third-party endorsements.
