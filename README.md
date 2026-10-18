# MYRAA AI OS -- Autonomous 3D Desktop Operating System

<p align="center">
  <img src="resources/app/build/icon.png" alt="MYRAA" width="96" height="96" />
</p>

<p align="center">
  <strong>A voice-controlled, multimodal 3D AI desktop operating system. Your API keys. Your data. Your machine.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-9.4.0-38CFFF?style=for-the-badge&labelColor=0a0f1e" alt="version" />
  <img src="https://img.shields.io/badge/platform-Windows%20Native%20x64-1a2332?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/license-MIT-8b5cf6?style=for-the-badge&labelColor=0a0f1e" alt="license" />
  <img src="https://img.shields.io/badge/capabilities-230+-22c55e?style=for-the-badge&labelColor=0a0f1e" alt="capabilities" />
  <img src="https://img.shields.io/badge/runtime-Electron%20Desktop-00e5ff?style=for-the-badge&labelColor=0a0f1e" alt="runtime" />
</p>

---

## About MYRAA

MYRAA is an **Autonomous Personal AI Operating System** -- an intelligent desktop environment powered by a unified cognitive engine with 180+ operational capabilities across 16 core domains. She listens with sub-second voice latency, sees your screen in real time, manipulates native Windows desktop applications, generates software architectures, engineers UI/UX design mockups, drafts professional documents, and manages files -- all while keeping your conversations and personal data strictly private on your local hardware.

She is not a web chatbot or browser tab. She is a **Real Native Windows Desktop Application** running in a dedicated hardware-accelerated holographic window with an interactive WebGL 3D avatar (Evelyn) floating seamlessly in front of a looping 4K Rainbow Nebula motion background.

---

## Table of Contents

- [Quick Start & How to Run](#quick-start--how-to-run)
- [System Requirements](#system-requirements)
- [Capabilities Matrix](#capabilities-matrix)
- [1. 3D Evelyn Avatar WebGL Engine](#1-3d-evelyn-avatar-webgl-engine)
- [2. Voice & Bidirectional Audio Engine](#2-voice--bidirectional-audio-engine)
- [3. Screen Vision & Perception](#3-screen-vision--perception)
- [4. Figma UI/UX Design & Wireframe Engine](#4-figma-uiux-design--wireframe-engine)
- [5. 12 Enterprise Production Connectors](#5-12-enterprise-production-connectors)
- [6. 403+ Cognitive Skills Fleet](#6-403-cognitive-skills-fleet)
- [7. Autonomous Software Engineering Agent](#7-autonomous-software-engineering-agent)
- [8. Professional Word Engine v7.0](#8-professional-word-engine-v70)
- [9. Native Win32 Desktop & Office Automation](#9-native-win32-desktop--office-automation)
- [10. Persistent Memory & Historical Transcripts Hub](#10-persistent-memory--historical-transcripts-hub)
- [11. World Awareness & Live Intelligence](#11-world-awareness--live-intelligence)
- [12. 3D CAD & Additive Manufacturing Engine](#12-3d-cad--additive-manufacturing-engine)
- [13. Browser Agent & Autonomous Web Automation](#13-browser-agent--autonomous-web-automation)
- [14. Computer Vision & Hand Gesture Tracking](#14-computer-vision--hand-gesture-tracking)
- [15. 88 Zero-Authentication Public APIs](#15-88-zero-authentication-public-apis)
- [16. Security, Confidentiality & Privacy Shield](#16-security-confidentiality--privacy-shield)
- [17. Autonomous Operations Stack (v9.4.0)](#17-autonomous-operations-stack-v940)
- [System Architecture](#system-architecture)
- [Project Directory Layout](#project-directory-layout)
- [API Endpoints Reference](#api-endpoints-reference)
- [License](#license)

---

## Quick Start & How to Run

### Method 1: Native Windows Desktop App (Double-Click)
Launch directly in the native Windows desktop application (no browser opened):
```cmd
Start-MYRAA.bat
```
or from the installers release directory:
```cmd
Installers\v9.3.0\Start-MYRAA.bat
```
The launcher starts the native Electron executable (`node_modules\electron\dist\electron.exe .`) silently initializing the background services and presenting the native desktop window.

### Method 2: Development Mode via Node.js
1. Navigate to the application directory:
   ```cmd
   cd resources\app
   npm install
   ```
2. Configure your environment variables in `resources/app/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```
3. Start the Express server and Vite frontend:
   ```cmd
   npm run dev
   ```
4. Open your browser to:
   ```
   http://localhost:3000
   ```

### Method 3: Desktop Electron App
To package or run the full Electron desktop shell:
```cmd
cd resources\app
npx electron .
```

---

## System Requirements

### Minimum Requirements
- **Operating System:** Windows 10/11 (64-bit), macOS 12+ (Apple Silicon/Intel), Ubuntu 20.04+ (x64)
- **Runtime:** Node.js v18.0.0 or higher
- **Memory (RAM):** 4 GB minimum (8 GB recommended for WebGL 3D Avatar)
- **Disk Space:** 1.2 GB available storage
- **Display:** 1280x720 minimum resolution with WebGL 2.0 GPU acceleration
- **Microphone:** Standard input device (for voice activation and Gemini Live stream)

### Optional Integrations
- **Google Gemini API Key:** Required for real-time Live voice streaming, vision reasoning, and code synthesis
- **Python 3.10+:** Required for parametric CAD (`build123d`) and 3D print slicing
- **Playwright / Chromium:** Required for autonomous browser automation (`npx playwright install chromium`)
- **VS Code:** Required for real-time IDE IPC bridge and live editor diagnostics
- **Git CLI:** Required for autonomous repository management (`git_service.cjs`)

---

## Capabilities Matrix

| Capability Domain | Active Features | Production Status |
|:---|:---:|:---:|
| 3D Holographic Avatar Studio | 6 | Operational |
| Voice & Bidirectional Audio | 14 | Operational |
| Screen Vision & Perception | 10 | Operational |
| Figma UI/UX Design & Wireframes | 8 | Operational |
| Enterprise Production Connectors | 12 | Operational |
| Cognitive Skills Fleet | 403+ | Operational |
| Software Engineering Agent | 16 | Operational |
| Professional Word Engine v7.0 | 12 | Operational |
| Win32 Desktop & Office Automation | 15 | Operational |
| Memory & Transcripts Hub | 10 | Operational |
| World Awareness & Intelligence | 8 | Operational |
| 3D CAD & Additive Manufacturing | 6 | Operational |
| Browser Agent & Web Automation | 8 | Operational |
| Computer Vision & Gesture Control | 9 | Operational |
| Free Public APIs | 88 | Operational |
| Security & Privacy Shield | 6 | Operational |
| Evidence Engine (sessions, findings, unknowns) | 6 | Operational |
| Investigation Toolkit (artifact forensics) | 7 | Operational |
| Agent Workspace (roster, threads, routines, approvals) | 8 | Operational |
| Connector Market (zero-auth tool connectors) | 6 | Operational |
| Model Gateway (bring-your-own-key lanes) | 5 | Operational |
| Action Safety Broker (approval-bound execution) | 6 | Operational |
| Unified Event Bus (append-only JSONL log) | 5 | Operational |
| Task Timeline (merged activity view) | 4 | Operational |
| Tool Permissions & MCP Registry | 5 | Operational |
| **Total Platform Capabilities** | **230+** | **Operational** |

---

## 1. 3D Evelyn Avatar WebGL Engine

MYRAA features a real-time 3D interactive avatar named **Evelyn**, powered by Three.js and the MMD/PMX rendering pipeline:

- **Hardware Accelerated WebGL Canvas:** Renders at 60 FPS with dynamic lighting, shadow mapping, and camera dampening.
- **Lip Synchronization:** Analyzes audio output buffers in real time and drives phonetic mouth morph targets (`A`, `I`, `U`, `E`, `O`).
- **Emotional States & Expression Morphing:** Synchronizes facial morph targets with conversation tone -- Idle, Curious, Thinking, Excited, Happy, Playful, and Proud.
- **Glassmorphic Viewport Integration:** Rendered inside a fixed viewport overlay with `#020205` deep background, ensuring zero screen flicker or white flashes.
- **Dynamic Character Shine & Glow:** Configurable through the Settings drawer to tune rim-lighting intensity and specular reflection strength.

---

## 2. Voice & Bidirectional Audio Engine

MYRAA communicates via Google's Gemini Live bidirectional audio protocol:

- **Sub-Second Voice Latency:** Direct PCM 16-bit, 16kHz mono audio streaming over WebSockets.
- **Aoede Vocal Identity:** Natural, feminine, expressive voice synthesis with conversational inflection.
- **Zero-Thinking Leak Filter:** Proprietary stream sanitizer strips all raw model thoughts, internal bracketed tags (`[VISION]`, `[ACTION]`), and reasoning traces before speech delivery.
- **Bilingual Hinglish & English:** Natural comprehension and speech switching across English and conversational Hindi/Hinglish.
- **Wake Word Detection:** Local Web Speech API listening for `"Hey Myraa"` or `"Mira"` with acoustic chime feedback.
- **Cinematic Subtitles:** Floating subtitle pill renders synchronized transcription with user input and model response distinctions.
- **Barge-In Interrupt Handling:** Automatically halts model audio playback the moment user speech is detected.

---

## 3. Screen Vision & Perception

MYRAA inspects and analyzes the operator's active desktop display:

- **Electron IPC & GDI+ Capture:** High-performance native capture across multi-monitor configurations.
- **Continuous Frame Streaming:** Transmits downsampled video frames to Gemini Live at adaptive framerates (0.4 - 2 FPS) with motion delta gating.
- **Active Window Telemetry:** Detects the foreground application (VS Code, Chrome, Word, Terminal) and contextualizes assistance.
- **On-Demand OCR & Inspection:** Voice commands such as *"What is on my screen?"* or *"Inspect this error"* trigger instant visual reasoning.

---

## 4. Figma UI/UX Design & Wireframe Engine

MYRAA includes a built-in autonomous design engine that converts specifications into production-grade HTML/CSS wireframes and mockups:

- **Wireframe Blueprints:** Clean architectural layouts with dashed container bounds, component hierarchy labels, and UX flow diagrams.
- **High-Fidelity UI Mockups:** Sleek dark-mode glassmorphic interfaces (`backdrop-filter: blur(14px)`), gradient accents, metric cards, and responsive grids.
- **SVG Charts & Sparklines:** Built-in vector data visualizations for dashboards, analytics cards, and KPI counters.
- **Multi-Device Viewport Scaling:** Generates layouts tailored for Desktop Canvas (1280px) and Mobile Screen Viewports (390px).
- **Code Export & Live Preview:** Designs are saved to `Projects/FigmaOutput/<design_id>/index.html` with instant browser preview and one-click code copy.
- **Figma Cloud Launcher:** One-click dispatch to Figma Web and project frames.

---

## 5. 12 Enterprise Production Connectors

The Connectors Hub provides bi-directional bridges to major cloud platforms, software suites, and hardware devices, complete with official SVG branding and live latency telemetry:

1. **Figma UI/UX Studio:** Autonomous wireframing, high-fi mockups, and component library synthesis.
2. **GitHub Repository Hub:** Full git sync, pull requests, commit trees, and AST dependency mapping.
3. **Gmail Automator:** Compose, draft, triage, and dispatch communications via Google Workspace.
4. **Salesforce CRM Hub:** Pipeline intelligence, deal lifecycles, and enterprise customer synchronization.
5. **Microsoft Excel Suite:** Native Win32 automation, formula injection, data sheets, and automated `.xlsx` workbooks.
6. **Microsoft Word Professional Engine:** Full Word document suite (letters, reports, proposals, contracts, PDF export).
7. **VS Code Developer Studio:** Active project inspection, script execution, and workspace launching.
8. **YouTube Hands-Free:** Hands-free media search, speech-controlled playback, and tutorial analysis.
9. **Canva Design Studio:** Promotional graphics, presentation slide decks, and marketing banners.
10. **WhatsApp Messenger:** Desktop web dispatcher for reports, photos, and emergency alerts.
11. **Autonomous Deep Research:** Multi-source research synthesizer across academic whitepapers and news.
12. **Smart Home & IoT Automation:** LAN socket controller for TP-Link Kasa smart plugs, relays, and lighting.

---

## 6. 403+ Cognitive Skills Fleet

MYRAA indexes an extensive workforce of 403+ specialized domain skills:

- **Interactive Code Inspector:** Click any skill to inspect the raw `SKILL.md` instructions, parameter schemas, and behavioral rules.
- **Package File Explorer:** Inspect directory files (`manifest.json`, `skill.json`, helper scripts) with file sizes.
- **Direct ZIP Package Download:** One-click download of any skill folder as a compressed `.zip` archive via `/api/skills/download`.
- **Search & Category Filtering:** Instant client-side filtering across Cloud & DevOps, AI & LLMs, Languages, Frontend, Databases, Security, and Custom Workspaces.
- **Custom Skill Ingestion:** Drag and drop `.md` or `.json` manifests to hot-register new operational capabilities.

---

## 7. Autonomous Software Engineering Agent

Powered by MYRAA's autonomous coding loop (v9.0.0+):

```
VOICE -> INTENT -> PROJECT DETECTION -> MEMORY -> PLAN ->
SKILL SELECTION -> CODE -> RUN -> TEST -> DEBUG -> RETEST -> REPORT
```

- **Self-Healing Dev Engine:** Plans project structure, generates source files, runs `npm install`, launches execution, catches runtime exceptions, patches culprit files, and retries up to 4 attempts.
- **Git CLI Wrapper:** Native local git operations -- commit, branch, push, pull, status, diff, stash, and undo.
- **Project Detection Service:** Deep analysis of `package.json`, `Cargo.toml`, `go.mod`, and `requirements.txt`.
- **Test Runner & Linter:** Direct execution of Jest, Vitest, Pytest, Cargo Test, ESLint, and Flake8.
- **Terminal Runner:** Sandboxed shell execution with streaming output and timeout enforcement.
- **AST Graft Engine:** Syntax tree mapping, call hierarchy tracing, and cross-file symbol indexing.

---

## 8. Professional Word Engine v7.0

MYRAA provides an enterprise document creation and manipulation engine:

- **Document Typologies:** Professional letters, technical PRDs, corporate proposals, legal contracts, resumes/CVs, SOPs, and research whitepapers.
- **Layout & Typography:** Configurable page geometry (A4, Letter, Margins), heading hierarchies (H1 - H4), and custom typography.
- **Document Redesign:** Automatic refactoring of irregular spacing, orphan headings, table alignment, and font standardization.
- **Content Operations:** Regex-powered find and replace, case-preserving edits, table of contents (TOC) auto-generation, and document merging/splitting.
- **Native PDF Export:** Automated conversion to PDF via COM automation.

---

## 9. Native Win32 Desktop & Office Automation

- **Application Dispatch:** Launches and controls Excel, Word, PowerPoint, VS Code, Chrome, and Terminal without keyboard interaction.
- **Audio & Hardware Control:** Win32 master volume control, mute toggling, screen brightness, and power states.
- **System Monitoring:** Real-time monitoring of CPU load, memory utilization, battery status, and network reachability.

---

## 10. Persistent Memory & Historical Transcripts Hub

- **Semantic Memory (RAG):** Local 256-dimensional vector search for persistent fact storage and operator preferences.
- **Historical Transcripts:** Searchable, chronological transcripts of voice and text sessions with speaker tagging.
- **Proactive Reminders:** Event scheduler and task recall engine.

---

## 11. World Awareness & Live Intelligence

- **Tavily Web Intelligence:** AI-optimized live web search, clean content extraction from URLs, and site mapping via the Tavily REST API — now the primary search path for voice queries, deep-research jobs, fact verification, and the `tavily_search` / `tavily_extract` / `tavily_map` MCP tools (DuckDuckGo remains the automatic fallback).
- **Weather Engine:** Real-time meteorological reports and forecasts.
- **News Aggregator:** Hacker News API and verified developer news feeds.
- **Fact Verification:** Multi-source validation against search and verified knowledge bases.
- **Groq Fallback LLM:** High-throughput free inference (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`) backing the multi-model cascade when Gemini is rate-limited — plus Whisper STT models available for future speech upgrades.

---

## 12. 3D CAD & Additive Manufacturing Engine

- **Parametric Modeling:** Generates parametric 3D models using Python (`build123d`) from natural language prompts.
- **STL / STEP Export:** Direct conversion into printable 3D geometry files.
- **Slicer & Printer Orchestration:** Integrates with PrusaSlicer/OrcaSlicer profiles and controls 3D printers via OctoPrint and Moonraker APIs.

---

## 13. Browser Agent & Autonomous Web Automation

- **Headless & Visible Playwright Automation:** Automated web browsing, page navigation, and link traversal.
- **Data Scraping & Extraction:** Markdown extraction from documentation, articles, and public repositories.
- **Form Filling & Interaction:** Automated button clicks, inputs, and multi-step web workflows.

---

## 14. Computer Vision & Hand Gesture Tracking

- **MediaPipe Hand Tracking:** Vision model recognizing 9 distinct hand gestures via webcam.
- **Contactless Controls:** Adjust master volume, mute microphone, pause media playback, or trigger wake states with hand gestures.

---

## 15. 88 Zero-Authentication Public APIs

Built-in zero-configuration access to 88 free public APIs across 14 categories:
- **Finance & Currency:** CoinGecko, CoinCap, Frankfurter exchange rates.
- **Development & Tools:** GitHub search, JSONPlaceholder, HTTPBin.
- **Knowledge & Science:** Open Library, Gutenberg, NASA APOD, Open Trivia.
- **Media & Entertainment:** JokeAPI, Studio Ghibli, Dog/Cat facts.

---

## 16. Security, Confidentiality & Privacy Shield

- **Strict No-Emoji Enforcement:** Built with approved SVG vector icons and ASCII status indicators (`[OK]`, `[!]`, `[*]`, `[X]`). Zero emoji characters across UI, logs, and outputs.
- **Operator Vishwajeet Privacy Shield:** Strict confirmation barriers blocking unauthorized data disclosure or destructive file mutations.
- **Local-First Architecture:** Memories, transcripts, designs, and credentials are stored strictly on `%APPDATA%/MYRAA/` on your local disk.
- **Zero Third-Party Telemetry:** No analytics, tracking pixels, or diagnostic telemetry sent to remote servers.

---

## 17. Autonomous Operations Stack (v9.4.0)

The v9.4.0 cycle adds nine governed autonomy subsystems. Every subsystem ships with a live test suite -- **286 automated checks** across 9 suites -- and follows one safety contract: honest errors, additive-only data operations, and local-first storage under `%APPDATA%\MYRAA\`.

### 17.1 Evidence Engine
Turns observations into auditable findings.
- Sessions, findings, unknowns, and SHA256-hashed evidence attachments
- Honesty rules enforced at the schema level: an `observed` finding must cite evidence; an `inferred` finding must carry confidence
- Compare tooling diffs findings between sessions; every output line is bounded
- Voice: "start an investigation", "what do we know", "attach evidence"
- API: `POST /api/evidence/session`, `POST /api/evidence/finding`, `GET /api/evidence/findings`, `GET /api/evidence/status` (plus unknowns + compare endpoints)

### 17.2 Investigation Toolkit
Static analyzers for real artifacts -- no guessing.
- PE header parser (x64/ARM64 detection), ASAR listers, SQLite page/encoding probes, ZIP central-directory readers
- Privileged string extraction with caps; feature scanners that exclude `node_modules`
- Crash log triage and reconstruction verification (jaccard similarity verdicts)
- Voice: "inspect this file", "trace the crash", "verify the reconstruction"

### 17.3 Agent Workspace
A roster of named agents with threads, routines, and approval cards.
- Single-word agent roster with pause/resume; per-agent conversation threads
- Scheduled routines (daily/weekly) with computed `nextRunAt`, honest due reports, and run counters
- Approval cards with scopes (READ/PLAN/PREPARE/EXECUTE), 24-hour expiry, and single-decision enforcement
- Voice: "create an agent", "every day at 9:00 summarize the news", "pending approvals"

### 17.4 Connector Market
A catalogue of 8 zero-/low-auth tool connectors (Wikipedia, Hacker News, weather, crypto, FX, dictionary, ...).
- Declarative host allowlists; every action is validated before any network call
- Honest failure codes: `AUTH_REQUIRED`, `WORKER_OFFLINE`, `REMOTE_ERROR` -- never a silent fallback
- All actions registered as LOW-risk agi tools with injectable fetch for tests
- Voice: "what connectors do we have", "use the Wikipedia connector to search Nikola Tesla"
- API: `GET /api/connector-market/*`

### 17.5 Model Gateway
Route reasoning to the lane each user actually has.
- Four lanes: local Ollama (offline-first), any OpenAI-compatible endpoint, OpenRouter, and a user-supplied OpenAI key
- Token saver: history capped to the last 10 turns, per-message slicing, junk-role normalization
- Honest chain reporting: when no lane can answer you get `NO_PROVIDER` with per-lane attempt reasons
- Policy: no resold or shared channels -- every lane is the user's own key or a local model
- Voice: "model gateway status", "is ollama running", "via ollama summarize the plan"
- API: `GET /api/model-gateway/*`

### 17.6 Action Safety Broker
Dangerous tool calls never execute on their own.
- HIGH/CRITICAL tools are bound to a workspace approval card; execution only after an approve decision
- Secret-ish parameter keys are redacted before storage; params are hidden in all listings
- Failed executions stay retryable with attempts + `lastError` journaled; approved bindings are swept and expired cards mirrored
- Voice: "safety broker status", "sync the broker", "approve it" (auto-executes)
- Store: `%APPDATA%\MYRAA\agent_broker\broker_state.json`

### 17.7 Unified Event Bus
One append-only operational log for the whole OS.
- Namespaced event types (`task.*`, `tool.*`, `approval.*`, `timeline.*`, ...); payload clamping (depth 3, strings 200, arrays 10) and secret-key redaction before anything is written
- 2000-event memory ring with periodic JSONL compaction; `emit` never throws and never blocks
- Voice: "activity log" / "show events" / "what's happened lately"
- API: `GET /api/events`, `/api/events/list`, `/api/events/tail`, `POST /api/events/emit`
- Store: `%APPDATA%\MYRAA\events\events.jsonl`

### 17.8 Task Timeline
A read-only chronological merge of events, broker bindings, approval cards, and scheduled routines.
- Owns no store of its own -- every item carries its source, and the sources map stays honest when a module is missing
- Day-scoped voice summary: "Today: N events, N approvals, N pending, N errors"
- Voice: "timeline" / "what happened today" / "summarize my day"
- API: `GET /api/timeline`, `/api/timeline/items`, `/api/timeline/today`

### 17.9 Tool Permissions & MCP Registry
Per-agent tool policy plus the Model Context Protocol server registry.
- Policies per agent: allow/deny pattern lists; deny rules beat allow rules; HIGH/CRITICAL tools require an explicit (non-wildcard) grant; unknown agents default to deny
- Revoke adds a deny rule; every change is journaled and emitted on the event bus as `permission.changed`
- MCP registry skeleton: register/enable/disable stdio and http servers (bookkeeping only -- transports land in the next cycle; `probe` stays honest about it)
- Voice: "tool permissions" / "who can use what", "allow agent jarvis to use connector_invoke", "revoke agent jarvis tool connector_invoke", "mcp servers"
- API: `GET/POST /api/permissions/*`, `GET/POST /api/mcp/*`

### Verification
All subsystems are covered by the live suites in `tests\` (evidence 29, investigation 37, workspace 43, connector market 26, model gateway 34, safety broker 31, event bus 25, timeline 27, permissions + MCP 34 -- 286 checks total). Run them individually with `node tests\test_<name>.cjs`, or boot the app and watch the per-phase mount log lines.

---

## System Architecture

```
                       +-------------------------------+
                       |  Operator Voice & WebGL UI    |
                       | (Three.js Evelyn 3D Avatar)   |
                       +---------------+---------------+
                                       |
                                       v
                    +-------------------------------------+
                    |   Express Server (:3000)            |
                    |   myraa_v6_real_routes.cjs          |
                    +------------------+------------------+
                                       |
        +------------------------------+------------------------------+
        |                              |                              |
        v                              v                              v
+------------------+          +------------------+          +------------------+
| Gemini Live Hub  |          | Autonomous Brain |          | Enterprise Hub   |
| Real-time Audio  |          | 403+ Skills      |          | 12 Connectors    |
| Screen Vision    |          | Code Loop        |          | Figma AI Studio  |
| Aoede Voice      |          | Word Engine v7.0 |          | Win32 Automation |
+------------------+          +------------------+          +------------------+
        |                              |                              |
        +------------------------------+------------------------------+
                                       |
                                       v
                     +----------------------------------+
                     | Local File & Database Layer      |
                     | %APPDATA%/MYRAA/                 |
                     | Projects/FigmaOutput/            |
                     +----------------------------------+
```

---

## Project Directory Layout

```
Myraa/
├── Start-MYRAA.bat               # Root one-click native desktop launcher
├── Installers/
│   └── v9.4.0/                       # Production release pack (exes also copied to Desktop\MYRAA-Installers-v9.4.0)
│       ├── MYRAA-Setup-9.4.0.exe     # NSIS Windows setup, x64 (308.9 MB, unsigned)
│       ├── MYRAA-Portable-9.4.0.exe  # Portable single-file executable (302.9 MB)
│       ├── MYRAA-Install-v9.4.0.bat  # 1-click automated setup helper
│       ├── SHA256SUMS.txt            # SHA256 hashes, re-verified after copy
│       └── checksums.txt             # Fixed-format checksum list
├── resources/
│   └── app/
│       ├── dist/
│       │   ├── server.cjs                # Express application server
│       │   ├── myraa_v6_real_routes.cjs  # API routes, Figma Studio, Skills, Connectors, AI Router
│       │   ├── coding_orchestrator.cjs   # Voice intent router for all coding + agent tasks
│       │   ├── evidence_engine.cjs       # Auditable findings + SHA256 evidence store
│       │   ├── investigation_skills.cjs  # PE/ASAR/SQLite/ZIP analyzers, crash triage
│       │   ├── agent_workspace.cjs       # Agents, threads, routines, approval cards
│       │   ├── connector_market.cjs      # Zero-auth tool connectors with host allowlists
│       │   ├── model_gateway.cjs         # Ollama / OpenAI-compatible / OpenRouter lanes
│       │   ├── safety_broker.cjs         # Approval-bound execution of high-risk tools
│       │   ├── event_bus.cjs             # Append-only JSONL operational event log
│       │   ├── task_timeline.cjs         # Merged timeline view (events + approvals + routines)
│       │   ├── tool_permissions.cjs      # Per-agent tool permission policies
│       │   ├── mcp_manager.cjs           # MCP server registry (skeleton)
│       │   ├── ui-health-patch.js        # UI layer, HUD overlays, skills inspector, API Env Modal
│       │   ├── myraa_v6_styles.css       # Core layout styling & holographic transparency
│       │   ├── skill_discovery_engine.cjs# Skill registry and scanning
│       │   └── assets/                   # WebGL 3D models, textures & background.mp4
│       ├── package.json                  # Application dependencies (v9.4.0)
│       └── version.json                  # Dynamic version authority (9.4.0)
├── tests/                        # 286 live checks across 9 suites (node tests\test_*.cjs)
├── docs/                         # Per-phase integration docs (evidence, timeline, mcp-permissions, ...)
├── Projects/
│   └── FigmaOutput/              # Generated HTML/CSS wireframes and mockups
├── skills/                       # 403+ native cognitive skills
└── README.md                     # Documentation
```

---

## API Endpoints Reference

### Core & System
- `GET /api/update/check` -- Read platform version and changelog from `version.json`
- `GET /api/config` -- Query API key presence and status
- `POST /api/config/apikey` -- Securely store Gemini API key

### Connectors & Figma Design Studio
- `GET /api/plugins/health` -- Status, latencies, and SVG logos for all 12 enterprise connectors
- `POST /api/plugins/launch` -- Dispatch connector applications and URLs
- `POST /api/plugins/figma/generate` -- Generate autonomous wireframe or high-fi mockup HTML/CSS
- `GET /api/plugins/figma/designs` -- List all generated Figma projects
- `GET /api/plugins/figma/preview/:designId` -- Serve full HTML design for preview
- `POST /api/plugins/figma/launch` -- Launch design in default browser

### Skills Fleet & Workforce
- `GET /api/skills/catalog` -- Retrieve full catalog of active skills
- `GET /api/skills/content?id=<id>` -- Read `SKILL.md` markdown and package file structure
- `GET /api/skills/download?id=<id>` -- Stream zipped skill package archive (.zip)
- `POST /api/skills/execute` -- Execute skill reasoning heuristics

### Coding Agent & Office Suite
- `POST /api/coding/execute` -- Run autonomous software engineering tasks
- `GET /api/git/status` -- Inspect local git repository status
- `POST /api/office/generate` -- Generate Microsoft Word documents (.docx)
- `POST /api/office/word/redesign` -- Refactor Word document layout and typography

### Evidence & Investigation (v9.4.0)
- `POST /api/evidence/session` -- Open an investigation session
- `POST /api/evidence/finding` -- Record observed/inferred findings with honesty rules
- `GET /api/evidence/findings` -- List findings joined with evidence hashes
- `GET /api/evidence/status` -- Store counts, caps, and honesty policy

### Autonomy Operations (v9.4.0)
- `GET /api/events` / `GET /api/events/tail` -- Unified event bus status and newest entries
- `POST /api/events/emit` -- Append a namespaced event (payloads clamped + redacted)
- `GET /api/timeline/today` -- Merged timeline since local midnight (events + approvals + routines)
- `GET /api/connector-market/catalog` -- Zero-auth connector catalogue with host allowlists
- `GET /api/model-gateway/status` -- Model lane status, probes, and honest chain policy
- `GET /api/permissions/agents` / `POST /api/permissions/grant` -- Per-agent tool permissions
- `GET /api/mcp/servers` / `POST /api/mcp/register` -- MCP registry skeleton (bookkeeping only)

---

## License

MIT License -- Copyright (c) 2026 Vishwajeet & Open Source Contributors.
Distributed under the terms of the MIT license.
