# Portfolio Inventory

_Scanned 2026-11-17. Ordered from most complete to least._

**Scope:** seven git repositories: `rudo`, `nova`, `rudoguard`, `rudomusic`, `wordrop-game`, `parallel` and `procedurerunner`. Together they hold 1,211 commits, from 2025-07-06 to 2026-11-06. Two of the repos contain several unrelated projects: `rudo` holds three and `wordrop-game` holds four. Each project gets its own entry, and the repo it lives in is named next to it. Line counts cover hand-written source (TS/JS/Go/Python/HTML/CSS/SQL/shell) and leave out lockfiles and `node_modules`. For a project that shares a repo, the commit count is the number of commits that touched its folders. "Deployed" means the repo is set up for, or points to, a live host; I didn't check that each site is actually up.

| # | Project | Repo | Status | Commits | Dates |
|---|---|---|---|---|---|
| 1 | Rudo, an AI creator platform | rudo | Deployed | ~173 | 2026-02-11 → 2026-10-26 |
| 2 | Wordrop | wordrop-game | Deployed | ~490 | 2025-07-06 → 2026-04-21 |
| 3 | Project Builder | rudo | Deployed | 19 | 2026-10-26 → 2026-10-30 |
| 4 | NOVA | nova | Deployed (hosted demo, paper trading) | 40 | 2026-09-25 → 2026-10-28 |
| 5 | RUDO Guard | rudoguard | Working | 34 | 2026-10-26 → 2026-11-06 |
| 6 | One Team, One Rhythm | rudo | Working | 6 | 2026-09-29 |
| 7 | Rudo Music | rudomusic | Working | 25 | 2026-11-06 |
| 8 | Parallel | parallel | Prototype | 58 | 2026-07-30 → 2026-08-08 |
| 9 | LyricHUD | wordrop-game | Prototype | 172 | 2025-11-18 → 2025-11-21 |
| 10 | Procedure Builder | procedurerunner | Prototype | 3 | 2026-04-20 |
| 11 | Aisle AI | wordrop-game | Prototype | ~13 | 2025-11-22 → 2025-11-23 |
| 12 | Biggest Loser tracker | wordrop-game | Prototype | 25 | 2025-12-08 |

---

## 1. Rudo — AI Creator Platform (`rudo`)

**Status: Deployed** · **Commits:** ~173 · **Dates:** 2026-02-11 → 2026-10-26 (most of the work was in February 2026)

Rudo is a social platform where every creator is an AI. Users design AI "bots" with a no-code wizard, and the bots then post on their own: they write captions, generate images and video, comment, reply to each other and form relationships. Developers can plug in their own agents through a versioned BYOB REST API, and spectators follow, react and comment. The stack is Next.js 15 (App Router) with React 19, TypeScript and Tailwind; PostgreSQL through Prisma; NextAuth; Inngest for background jobs; Stripe for paid tiers and credits; Resend for email; S3 for media; Zod for validation; Vitest for tests. AI comes from OpenAI, with fal.ai/Flux for images and Kling, Minimax and Runway for video, and video falls back to another provider when one fails. The repo is configured for Vercel (crons every 5 minutes and every 2 hours, Node 22 pinned, builds that survive an unreachable database) and refers to the production domain rudo-ai.com. The most impressive piece is the autonomous agent architecture. A deterministic "Character Brain" compiler turns persona fields into numeric traits, vocabulary fingerprints and cognitive archetypes, with no LLM call and seeded per-bot jitter so similar bots still differ. It sits behind a perceive → decide → act agent loop, a "life" layer with memory and world events, a learning loop and a recommendation/trending feed, all run as 12 Inngest functions with concurrency limits. Numbers: about 44,900 lines of TypeScript, 36 Prisma models, 80 API routes, 26 pages, a full admin portal, 5 AI provider adapters, 14 test files with about 200 test cases, about 5,700 lines of design docs, and seed data for more than 60 bots with a social graph.

---

## 2. Wordrop — Daily Word Puzzle Game (`wordrop-game`)

**Status: Deployed** at playwordrop.com (Netlify) · **Commits:** ~490 (747 in the repo, all by rudolph-nck) · **Dates:** 2025-07-06 → 2026-04-21

Wordrop is a daily word-guessing game with five rounds a day. Each round is a hidden word with a cryptic hint ("WIZARD — Spells and secrets in robes"), and you reveal it letter by letter before a hangman-style drawing fills in. Everyone gets the same numbered daily puzzle, and the game adds streaks, collectible badges with toast notifications, a once-a-day lifeline, a practice mode, light and dark themes and a midnight reset. It is written in plain HTML, CSS and JavaScript with no framework, hosted as a Netlify static site with serverless functions, and uses Firebase Cloud Messaging for push notifications plus a privacy page. The most impressive things are its depth and how long it has run. It is the longest-lived project in the portfolio: about 490 commits over nine months, all by one author, with bursts of more than 200 commits in July, August and November 2025. It also handles the hard parts of a daily game properly: puzzle numbering by local date, game state that survives a reload, and a separate `dev/env1` staging copy of the game. Numbers: about 6,000 lines in the main game (1,080 of JS, 3,365 of CSS) and 1,341 hand-written word-and-hint pairs, which is about 268 days of puzzles.

---

## 3. Project Builder — Interactive DIY How-To Guides (`rudo`)

**Status: Deployed** (as a login-gated section of the Rudo app at `/project-builder`) · **Commits:** 19 · **Dates:** 2026-10-26 → 2026-10-30

Project Builder is a library of interactive home-improvement guides: tub-to-shower tile, outlets/GFCI, toilets, faucets, copper and PVC drain pipe, drywall, framing, painting, and laminate, LVP and tile flooring. Each guide asks about your specific job, calculates materials, and walks you through phases, steps and day-by-day work sessions with safety rules, "call a pro" warnings, quick-help cards, a glossary and an SVG illustration on every step. Technically it is a small data-driven engine: guides are JSON files that a Next.js route inlines into a vanilla-JS engine and an HTML template at request time. The format supports conditional questions, `{{ expression }}` templating over the answers and the calculations, inches rounded to the nearest 1/16", and inline warning, info and OK callouts. The most impressive single artifact is the hand-built tub-to-shower guide (about 2,100 lines in one page): a tutorial mode, a jobsite mode, a day planner, photos, animations, and a Design tab with a 3D view of the shower and unfolded wall layouts. Numbers: 18 JSON guides plus the custom tub/shower page, about 19,000 lines of guide content, 244 SVG figures, about 1,100 content ids, and about 790 lines of engine and route code, all built in five days.

---

## 4. NOVA — Personal Capital Intelligence (`nova`)

**Status: Deployed** (hosted demo under a sub-path, served at rudo-ai.com/nova through a rewrite in Rudo; it trades on an Alpaca paper account with practice money, never real money) · **Commits:** 40 · **Dates:** 2026-09-25 → 2026-10-28

NOVA is a private, AI-assisted investment platform for research, forecasting, portfolio management and risk control. Commits describe market data, bull and bear signals with an animated price forecast, a backtesting analysis engine, goals with timelines for each holding, and paper trading on Alpaca for stocks and 24/7 crypto with exits NOVA manages. They also describe a safe mode, a market-stress watch, phone alerts through ntfy, plain-English daily briefs and "why did this move?" explanations written by Claude, and a research mode that honestly tests whether NOVA beats the S&P 500. The stack is a Python API (Alembic migrations, Ruff and mypy) with a separate worker and scheduler, PostgreSQL and Redis, and a Next.js/TypeScript web app tested with Vitest. Six services run under Docker Compose, with a Makefile, CI and an acceptance smoke test. The most impressive part is its safety-first engineering for a money-handling system. It defaults to simulation with a deterministic mock market provider. The `PAPER` mode fails closed at startup if credentials are missing and never falls back silently. `LIVE` trading can't be reached in the current stage. Broker secrets stay on the backend and never reach the web container. All of this is backed by architecture decision records, execution plans and a written platform contract. Numbers: about 9,500 lines of Python and 5,100 lines of TypeScript, 104 backend test functions in 17 test files, and work delivered in staged releases (Stage 1, 2A, 2B and later).

---

## 5. RUDO Guard — Self-Hosted Family Remote Management (`rudoguard`)

**Status: Working** (in real use on a family laptop) · **Commits:** 34 · **Dates:** 2026-10-26 → 2026-11-06

RUDO Guard is a self-hosted remote-management and anti-scam kit for protecting a less-technical family member's Windows laptop. A Go server provides a dashboard, a job queue and phone alerts. A Go agent runs as SYSTEM, reports health every 10 minutes, and runs one-tap actions: close all browsers to kill a fake-virus page, a full scam pop-up cleanup, removal of remote-access tools that scammers use (AnyDesk, TeamViewer and others), Defender scans, Windows and winget patching, browser hardening and restarts. RustDesk provides screen control, and everything travels over a Tailscale network locked down with ACLs, so nothing is exposed to the internet. The stack is Go for the server, agent and setup binaries, PowerShell for the installer and the on-screen buddy, Docker Compose and systemd for the VPS, and ntfy for alerts. The most impressive part is how well it works end to end for a non-technical user. "Rudo," an animated reindeer, sits on her screen with a pulsing nose that shows the connection is live, and she can click him to ask for help. A one-paste VPS setup script, a one-click installer that matches the CPU architecture and survives installer collisions, agent self-updates, family invites and a browser-playable Linux demo round it out. Numbers: about 5,200 lines of Go with 19 tests, about 2,500 lines of PowerShell, shell and HTML, and 8 deployment artifacts (systemd units, Tailscale ACL, compose file).

---

## 6. One Team, One Rhythm — Generative Cinematic Music Video (`rudo`)

**Status: Working** (renders locally; no rendered master is committed) · **Commits:** 6 · **Dates:** 2026-09-29 (a single day)

This is a 4-minute-42-second motion-design music video (1920×1080, 30 fps, 8,460 frames) for a corporate event, *Addition Financial × Addapalooza — The Summit 2026*. It is built as code in Remotion: one brand line travels through darkness and turns into a timeline, a plus sign, a road, a map, a rail and a stage while the song names every team and place. The stack is Remotion 4 with React 19 and TypeScript, Three.js and React Three Fiber, CSS-3D staging, and Python for audio analysis and speech recognition. The most impressive part is that the film is fully data-driven and synced to the music. Python scripts separate the stems, transcribe the sung vocals, and snap lyric timings to a 107.7 BPM beat grid that also drives energy pulses. A 2,600-line scene manifest maps chapters to 12 "world" components and gives every lyric its hero word, camera behavior and transitions, so editing JSON changes the film. Numbers: about 4,500 lines of TypeScript, 12 world components, 27 line-glyph diagrams, 36 map places, and 13 analysis and build scripts.

---

## 7. Rudo Music — Code-Rendered Kinetic-Typography Music Videos (`rudomusic`)

**Status: Working** (commits record final 1080p and 4K renders of the first song, *Happy New World*; the video files aren't committed) · **Commits:** 25 · **Dates:** 2026-11-06 (one day; 23 commits by Claude)

Rudo Music is a reusable pipeline for music videos made entirely of animated lyrics, where every frame is a deterministic function of song time. Its engine is adapted from the open-source *pdoom-video* project (MIT), with credit given. It has three parts. An analysis pipeline isolates the vocals with Demucs and aligns the lyrics using both CTC alignment and Whisper, then writes word-level timing and beat data. A shared rendering engine (TypeScript and three.js on bun and Vite) handles karaoke by lyric content, a beat grid, post-processing, kerning and batched lines, and renders through headless Chrome to ffmpeg. A written "blueprint" method comes with templates, a kickoff prompt and a `new-song.sh` scaffold, so the next song can be started by pasting one prompt into Claude Code. The most impressive part is that it turns a one-off film into a repeatable production system: the method, the as-built notes and the decision log are all written down. Engineering details include segmented 4K renders that survive container restarts and a CPU Canvas2D path that is 35% faster on software GPUs. Numbers: about 8,600 lines of TypeScript and Python, 14 scene modules for the first song, a 13-module analysis pipeline, and quality-check tools for palette and alignment.

---

## 8. Parallel — AI Chief of Staff for Microsoft 365 (`parallel`)

**Status: Prototype** (working against a Microsoft 365 demo tenant; the README calls it a "first prototype") · **Commits:** 58 (57 by Nick Rudolph) · **Dates:** 2026-07-30 → 2026-08-08

Parallel is a voice-first workplace assistant. "Ara," a conversational chief of staff, uses "Recall," a memory and context engine, to read Outlook mail, calendars and SharePoint. With approval, Ara books real Teams meetings with agendas, resolves attendees from the company directory (including spoken variants such as "Noel" and "Noelle"), handles conflicts by moving or declining meetings, turns Teams transcripts into structured notes, and publishes branded policies and briefs to SharePoint. Nothing external happens without the user's explicit voice or button approval. The stack is Next.js 16 and React 19 on vinext/Vite targeting Cloudflare Workers, Tailwind 4, Drizzle ORM, MSAL with Microsoft Graph and delegated, least-privilege scopes, and an OpenAI Realtime voice session. The most impressive part is the quality of the voice interaction. Ara pauses the microphone while speaking, keeps the whole conversation in context across turns, takes natural approvals like "sounds good," keeps exact times exact from the spoken proposal through the calendar write, and checks the time after writing it. Visuals react to live microphone volume, and a scripted first meeting introduces Ara. Numbers: about 12,000 lines of TypeScript, 11 test files with 82 test cases, and 13 or more design documents (target architecture, risk register, model-routing plan, evaluations).

---

## 9. LyricHUD — Live Word-at-a-Time Lyric Display (`wordrop-game`)

**Status: Prototype** (hosted alongside Wordrop on Netlify) · **Commits:** 172 · **Dates:** 2025-11-18 → 2025-11-21

LyricHUD shows the lyrics of whatever is playing on Spotify one word at a time, large and centered, with a mirrored head-up-display mode and a fullscreen mode, for use as a stage or car-windshield lyric display. It connects to Spotify through OAuth, reads the current track and playback position, and fetches word-level timing from Musixmatch's richsync data. When no synced lyrics exist, it falls back to OpenAI transcription. A separate editor lets you hand-build song timelines. The stack is vanilla JavaScript ES modules with Netlify serverless functions as the backend for Spotify, Musixmatch and OpenAI. The most impressive part is keeping a word-by-word display in sync with a live third-party player: it rebuilds a live track timeline in absolute playback time and follows Spotify's position. Numbers: about 3,700 lines across 8 modules plus an editor, and 6 serverless functions. Its 172 commits came in four days.

---

## 10. Procedure Builder (`procedurerunner`)

**Status: Prototype** (feature-complete on paper, but delivered as one large generated commit with no later work) · **Commits:** 3 · **Dates:** 2026-04-20 (one day)

Procedure Builder is a visual drag-and-drop editor for procedures, policies, SOPs and run sheets, with a three-panel layout (outline, canvas, settings). It versions procedures so that drafts stay editable and published versions can't change, and its Runner mode executes a procedure step by step or as a checklist with progress tracking. It also offers branded PDF export with a logo, watermark, header and footer, workspace theming, search and filters, and an analytics dashboard. The stack is Next.js and TypeScript, Prisma on SQLite (local-first, with no external services), dnd-kit, Radix UI and shadcn components, React Hook Form with Zod, and a Docker image for self-hosting on an internal network. The most impressive part is the breadth of its block model: 42 typed block types, including checklists, timers, approvals, warnings, tables and signatures, all editable on a drag-and-drop canvas. Numbers: about 7,900 lines of code, 16 Prisma models, 10 pages and 13 API routes. Almost all of it arrived in a single commit by Claude.

---

## 11. Aisle AI — Healthier Choices from the Shelf (`wordrop-game`)

**Status: Prototype** · **Commits:** ~13 · **Dates:** 2025-11-22 → 2025-11-23

Aisle AI is a mobile web app for grocery shopping. You photograph products on the shelf, and an AI model compares them and suggests the healthier choice. It exists as two single-page versions, `AisleAI/` and a reworked `AisleAlly/`. Each is a self-contained HTML/JS page that sends images to a Netlify function, which calls OpenAI's `gpt-4.1-mini` vision model, so the API key stays on the server. The most notable thing is how quickly it went from idea to a working camera-to-AI loop: two days and about 1,900 lines across both versions.

---

## 12. Biggest Loser Tracker (`wordrop-game`)

**Status: Prototype** · **Commits:** 25 · **Dates:** 2025-12-08 (one day)

This is a small head-to-head weight-loss competition tracker: two players log weigh-ins, compare progress and view a history. It is written in plain HTML, CSS and JS with preset users and matchups, and data is saved in the browser's localStorage. A code comment notes that Firebase isn't wired up yet, so nothing syncs between devices. Numbers: about 540 lines of code.
