# MYRAA AI OS

**MYRAA** — a private 3D AI desktop companion powered by your own API keys.

![Version](https://img.shields.io/badge/version-8.2.1-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## What is MYRAA?

MYRAA is a **Personal AI Operating System** — a desktop application that runs a unified AI brain (MYRAA Core) with memory, skills, plugins, and a 3D avatar companion (Evelyn PMX). Your data stays on your machine. Your API keys are your own.

## Features

### Core AI Brain
- **MYRAA Core** — unified intent classifier → model cascade (Gemini → Groq → OpenRouter → Ollama)
- Reasoning before coding, 7 task types, automatic model selection
- `MYRAA_CORE_DISABLE=1` escape for zero-regression

### Memory & Knowledge (RAG)
- 256-dim local embeddings (no external API needed)
- Optional Gemini `text-embedding-004` upgrade (`MYRAA_EMBED_REMOTE=1`)
- Auto-chunking, cosine retrieval with sources + citations
- Memory injected into every chat call

### Agent & Skills
- **515 discovery skills** + **483 dynamic skills** merged
- Goal-based skill matching, multi-skill composition
- MCP tools for memory, skills, permissions, free APIs

### Security
- LAN guard (non-loopback requires paired-device token)
- Rate limiter (600 req/min general, 60 req/min sensitive)
- SecureVault (AES-256-GCM + Windows Credential Manager)
- `.env` secrets scrubbed (36 values blanked)

### Free Public APIs
- **98 free (no-auth, HTTPS)** APIs from [public-apis/public-apis](https://github.com/public-apis/public-apis)
- 24 categories: Animals, Anime, Books, Crypto, Currency, Dev, Entertainment, Food, Science, Weather, and more
- MCP tools: `free_api_list`, `free_api_call`

### Plugin System
- Hot-loadable plugins in `resources/app/plugins/<name>/`
- Plugin manifest (`plugin.json`) + entry (`index.cjs`)
- Tools, hooks (onChat, onTool), settings
- Sample plugin: `myraa-utils` (time, hash, encode/decode)

### 3D Avatar
- **Evelyn PMX** — animated 3D avatar with idle, listening, thinking, speaking states
- Three.js renderer with GPU acceleration
- Voice I/O with Whisper + ElevenLabs (optional)

### Mobile Remote
- Pair your phone via one-time code
- Voice commands, text chat, device control from mobile

## Installation

### Windows
1. Download `Installers/v8.2.1/MYRAA-Setup-8.2.1.exe`
2. Run the installer (unsigned — allow when prompted)
3. MYRAA installs to `C:\Program Files\MYRAA AI OS\`
4. Desktop and Start Menu shortcuts created

### macOS
- Build from source: `npm run dist:mac`

### Linux
- Build from source: `npm run dist:linux`

## Quick Start

1. Launch MYRAA AI OS
2. Go to Settings → add your **Gemini API key** (required)
3. Optionally add Groq, OpenRouter, or Ollama keys
4. Start chatting with Evelyn!

## Project Structure

```
Myraa/
├── resources/app/
│   ├── dist/                    # Backend modules
│   │   ├── server.cjs           # Express server (main entry)
│   │   ├── myraa_core.cjs       # Unified AI brain
│   │   ├── memory_kb.cjs        # Memory & Knowledge RAG
│   │   ├── free_api_registry.cjs # 98 free public APIs
│   │   ├── plugin_manager.cjs   # Hot-loadable plugin system
│   │   ├── skills_mcp_engine.cjs # MCP tools & skills
│   │   ├── server_security.cjs  # Headers, rate limit, LAN guard
│   │   └── ...
│   ├── electron/                # Electron main process
│   │   ├── main.cjs             # App lifecycle, backend spawn
│   │   ├── preload.cjs          # Context bridge
│   │   └── updater.cjs          # Auto-update
│   ├── plugins/                 # Hot-loadable plugins
│   │   └── myraa-utils/         # Sample plugin (3 tools)
│   ├── build/                   # Icons, NSIS scripts
│   └── package.json
├── scripts/                     # Build & utility scripts
├── docs/                        # Audit reports, changelog
├── Installers/                  # Versioned installer builds
│   ├── v7.5.0/
│   ├── v8.1.0/
│   ├── v8.2.0/                  # Latest
│   └── old/
└── skills/                      # 515 cognitive skills
```

## Development

```bash
# Install dependencies
cd resources/app && npm install

# Run in dev mode
npm run dev

# Build for production
npm run build

# Package installer
npm run dist:win    # Windows
npm run dist:mac    # macOS
npm run dist:linux  # Linux
```

## Architecture

```
User Input → MYRAA Core (intent classifier) → Model Cascade → Response
                    ↓
            Memory Context (RAG) ←→ Knowledge Base
                    ↓
            Plugin Hooks → Free APIs → MCP Tools
                    ↓
            3D Avatar (Evelyn) + Voice Output
```

## Test Results

| Suite | Result |
|-------|--------|
| Memory KB | 35/35 PASS |
| Pairing + LAN Guard | 11/11 PASS |
| Free Public APIs | 20/20 PASS |
| Plugins | 27/27 PASS |
| Architecture Check | PASS |

## Changelog

See [docs/CHANGELOG.md](docs/CHANGELOG.md) for full version history.

## License

Copyright © 2026 MYRAA AI OS — Vishwajeet & Open Source Community
