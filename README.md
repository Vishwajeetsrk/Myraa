# MYRAA — Private AI Desktop OS

<p align="center">
  <img src="resources/app/build/icon.png" alt="MYRAA" width="96" height="96" />
</p>

<p align="center">
  <strong>A private 3D AI desktop companion. Your API keys. Your data. Your machine.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-8.3.1-38CFFF?style=for-the-badge&labelColor=0a0f1e" alt="version" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-1a2332?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/tests-93%20passing-22c55e?style=for-the-badge&labelColor=0a0f1e" alt="tests" />
  <img src="https://img.shields.io/badge/license-MIT-8b5cf6?style=for-the-badge&labelColor=0a0f1e" alt="license" />
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-installation">Installation</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-development">Development</a>
</p>

---

> **MYRAA and JARVIS share the same powerful AI core — same memory, skills, and model cascade. Different interfaces for different workflows.**
> MYRAA is the **desktop OS experience**: a full windowed shell with 3D avatar, glassmorphism, and native system integration.

---

## ✨ What is MYRAA?

MYRAA is a **Personal AI Operating System** — a desktop application that runs a unified AI brain with:

- 🧠 **MYRAA Core** — intent classifier + model cascade (Gemini → Groq → OpenRouter → Ollama)
- 💾 **Memory & Knowledge (RAG)** — local embeddings, auto-chunking, source-cited retrieval
- 🛠️ **515+ Skills** — discovery + dynamic skills, MCP tools, multi-skill composition
- 🔌 **Plugin System** — hot-loadable plugins with tools, hooks, and settings
- 🌐 **98 Free APIs** — no-auth public APIs across 24 categories
- 🎭 **3D Avatar — Evelyn PMX** — idle / listening / thinking / speaking states
- 📱 **Mobile Remote** — pair via one-time code, control from your phone
- 🔒 **SecureVault** — AES-256-GCM + Windows Credential Manager, LAN guard

All running **locally**. Your conversations stay on your machine. Your API keys are your own.

---

## 🎬 Screenshots

| Desktop Shell | 3D Avatar | Settings & About |
|---------------|-----------|------------------|
| Glassmorphism top bar + 12-view sidebar | Evelyn PMX with GPU-accelerated Three.js | About & Updates with verification badges |

> Screenshots are rendered from the live `myraa_v6_app.js` desktop shell (no mockups).

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/Vishwajeetsrk/Myraa.git
cd Myraa/resources/app

# 2. Install
npm install

# 3. Add your Gemini API key
#    Create resources/app/.env:
#    GEMINI_API_KEY=your_key_here

# 4. Run
npm run dev          # Vite dev server
npm run build        # Production build
```

Then launch the desktop app:

```bash
npx electron .
# or package an installer
npm run dist:win      # Windows (portable)
npm run dist:mac      # macOS
npm run dist:linux    # Linux
```

On first launch: **Settings → Gemini API Key → Save & Validate** → start chatting with Evelyn.

---

## 📦 Installation

### Windows (Recommended)

1. Download [`MYRAA-Portable-8.3.1.zip`](https://github.com/Vishwajeetsrk/Myraa/releases) from Releases
2. Extract anywhere and run **`MYRAA AI.exe`** — no install needed
3. Or run `MYRAA-Launcher.bat` if SmartScreen blocks the exe

> `Installers/v8.3.1/` contains portable + zip. For a full NSIS installer, build on CI with Wine (see [Release Guide](RELEASE_GUIDE.md)).

### macOS / Linux — Build from Source

```bash
cd resources/app
npm install
npm run dist:mac      # → release/MYRAA-8.3.1-mac.dmg
npm run dist:linux    # → release/MYRAA-8.3.1-linux.AppImage
```

---

## 🧩 Features

### MYRAA Core — Unified AI Brain

Single entry point for all chat: `dist/myraa_core.cjs` classifies intent (7 types) → picks the best model → cascades on failure → logs cost/health. Escape with `MYRAA_CORE_DISABLE=1` for zero-regression.

### Memory & Knowledge (RAG)

256-dim local embeddings (no external call). Optional Gemini `text-embedding-004` upgrade (`MYRAA_EMBED_REMOTE=1`). Auto-chunking, cosine search, sources + citations injected into every chat.

### Skills — 515 + 483

Discovery skills + dynamic skills merged into a unified catalog. Goal-based matching, multi-skill composition. MCP tools expose memory, skills, permissions, and free APIs to models.

### Plugin System

Hot-loadable plugins in `resources/app/plugins/<name>/`:

```
plugins/myraa-utils/
├── plugin.json    # manifest (name, version, tools, hooks)
└── index.cjs      # entry (register tools, onChat, onTool)
```

Sample `myraa-utils` ships with 3 tools (time, hash, encode/decode).

### Free Public APIs

98 free, no-auth HTTPS APIs from [`public-apis/public-apis`](https://github.com/public-apis/public-apis) — Animals, Crypto, Currency, Weather, Dev, Science, Food, … and more. MCP: `free_api_list`, `free_api_call`.

### 3D Avatar — Evelyn

Evelyn PMX (`resources/app/dist/assets/characters/evelyn/model.pmx`) with GPU-accelerated Three.js. States: idle, listening, thinking, speaking. Voice I/O optional (Whisper + ElevenLabs).

### Mobile Remote

Pair in Settings → one-time code (5-min expiry) → `server_security.cjs` LAN guard (`AUTH_REQUIRED_PREFIXES`, `BOOTSTRAP_PREFIXES`). Chat and control MYRAA from your phone.

---

## 🏗️ Architecture

```
User Input
    ↓
MYRAA Core  ──→  Intent Classifier (7 types)
    ↓                ↓
Model Cascade    Memory RAG (256-dim + cosine)
Gemini → Groq →         ↓
OpenRouter →     Plugin Hooks
Ollama              ↓
    ↓           Free APIs (98)
    ↓                ↓
  3D Avatar  ←  MCP Tools  →  Mobile Remote
  (Evelyn)                    SecureVault
```

| Layer | File | Role |
|-------|------|------|
| Shell | `electron/main.cjs` | Single instance, backend spawn, window + tray |
| Server | `dist/server.cjs` | Express on :3000, mounts all routes |
| Core | `dist/myraa_core.cjs` | Unified chat gate |
| Memory | `dist/memory_kb.cjs` | RAG layer |
| Skills | `dist/skills_mcp_engine.cjs` | MCP + skill catalog |
| Security | `dist/server_security.cjs` | Headers, rate limit, LAN guard |
| Plugins | `dist/plugin_manager.cjs` | Hot-load system |
| APIs | `dist/free_api_registry.cjs` | 98 free APIs |
| About | `dist/myraa_v6_real_routes.cjs` | `/api/system/about`, diagnostics |
| Update | `electron/updater.cjs` | GitHub Releases via electron-updater |

---

## 📁 Project Structure

```
Myraa/
├── resources/app/
│   ├── dist/                     # Backend + frontend
│   │   ├── server.cjs            # Express server (main entry)
│   │   ├── myraa_core.cjs        # Unified AI brain
│   │   ├── memory_kb.cjs         # Memory & Knowledge RAG
│   │   ├── free_api_registry.cjs # 98 free public APIs
│   │   ├── plugin_manager.cjs    # Hot-loadable plugins
│   │   ├── skills_mcp_engine.cjs # MCP tools & skill catalog
│   │   ├── myraa_v6_app.js       # Desktop shell (vanilla JS SPA)
│   │   ├── myraa_v6_real_routes.cjs # Real API routes
│   │   └── assets/               # Bundled frontend + Evelyn avatar
│   ├── electron/
│   │   ├── main.cjs              # Lifecycle, backend spawn, IPC
│   │   ├── preload.cjs           # Context bridge (myraa, myraaUpdate)
│   │   └── updater.cjs           # Auto-update (GitHub Releases)
│   ├── plugins/
│   │   └── myraa-utils/          # Sample plugin (3 tools)
│   ├── build/                    # Icon, NSIS config
│   ├── version.json              # Single source of truth (8.3.1)
│   └── package.json
├── scripts/
│   ├── version.cjs               # Sync version across 6 consumers
│   ├── build.cjs                 # 8-step production pipeline
│   ├── sign.cjs                  # Authenticode signing (SHA256)
│   ├── verify.cjs                # 19-point pre-release check
│   └── release-package.cjs       # Checksums, metadata, latest.json
├── skills/                       # 400+ cognitive skills
├── Installers/                   # Versioned builds (gitignored *.exe)
└── docs/
    ├── AUDIT_REPORT.md
    └── CHANGELOG.md
```

---

## 🛠️ Development

```bash
cd resources/app && npm install

# Version management (single source: resources/app/version.json)
npm run version             # show current
npm run version:patch       # 8.3.1 → 8.3.2
npm run version:minor       # 8.3.1 → 8.4.0
npm run version:major       # 8.3.1 → 9.0.0
npm run version:sync        # re-sync all consumers

# Build
npm run build               # vite build
npm run build:electron      # vite + electron

# Package
npm run dist:win            # Windows portable
npm run dist:mac            # macOS DMG
npm run dist:linux          # Linux AppImage

# Production pipeline
node ../../scripts/build.cjs --win              # clean → sync → build → package
node ../../scripts/build.cjs --win --sign       # + code signing (needs CSC_LINK)
node ../../scripts/verify.cjs                   # 19-point verification
node ../../scripts/release-package.cjs          # checksums + latest.json

# Tests
node dist/scratch/test_memory_kb.cjs      # 35/35
node dist/scratch/test_plugins.cjs        # 27/27
npm run myraa:architecture-check
```

### Code Signing

Set a Windows Code Signing Certificate for trusted distribution:

```bash
set CSC_LINK=C:\path\to\certificate.pfx
set CSC_KEY_PASSWORD=your_password
node ../../scripts/build.cjs --win --sign --verify
```

Or sign an existing build:

```bash
node ../../scripts/sign.cjs --cert C:\path\to\cert.pfx --password pw
```

---

## 🧪 Test Results

| Suite | Result |
|-------|--------|
| Memory & Knowledge | **35/35** PASS |
| Pairing + LAN Guard | **11/11** PASS |
| Free Public APIs | **20/20** PASS |
| Plugins | **27/27** PASS |
| Full Smoke (API + frontend + Electron + versions) | **29/29** PASS |
| Pre-release Verification | **19/19** PASS |
| Architecture Check | **PASS** |

---

## 🔄 MYRAA vs JARVIS

|  | MYRAA | JARVIS |
|--|-------|--------|
| **Interface** | Desktop OS shell — windowed, glassmorphism, 12-view sidebar, 3D avatar stage | *(Different UX — see [JARVIS-AI-OS](https://github.com/vishwajeetsrk/JARVIS-AI-OS))* |
| **Core** | Same MYRAA Core, same 515+ skills, same memory/RAG, same model cascade | Same |
| **Platform** | Electron (Windows/macOS/Linux) | Tauri + Electron variants |
| **Use when** | You want a full desktop companion with visual presence | You prefer JARVIS's workflow |

Both share the same power. Pick the interface you prefer — or run both.

---

## 📄 License

MIT — see [LICENSE](LICENSE).

This project bundles Electron (`LICENSE.electron.txt`) and Chromium (`LICENSES.chromium.html`).

---

<p align="center">
  Built with care by <strong>Vishwajeet</strong> & the Open Source Community<br/>
  <sub>MYRAA AI — Private by design. Powerful by choice.</sub>
</p>
