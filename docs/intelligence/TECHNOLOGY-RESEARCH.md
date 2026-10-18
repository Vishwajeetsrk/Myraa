# Technology & API Selection Research

## Overview

MYRAA selects frameworks, dependencies, and APIs based on empirical suitability, active maintenance, developer ergonomics, security posture, and runtime efficiency.

## Technology Selection Matrix

| Archetype | Recommended Stack | Rationale | Alternatives |
| :--- | :--- | :--- | :--- |
| **Desktop App** | Electron + React / Vite | Native OS integration, rich web ecosystem, multi-window support | Tauri + Rust (lightweight memory) |
| **Web Dashboard** | React + Vite + Vanilla CSS | Maximum rendering velocity, fine-grained style control, rapid HMR | Next.js (SSR / SEO workloads) |
| **CLI / Tooling** | Node.js CommonJS/ESM | Zero-dependency footprint, fast startup, cross-platform portability | Go / Rust (compiled single binaries) |
| **Backend API** | Express / Node.js HTTP | Proven middleware ecosystem, low latency, lightweight routing | Fastify (ultra-high RPS) |
| **State / Storage** | Atomic JSON / SQLite | Zero external database server overhead, reliable atomic writes | PostgreSQL (distributed deployments) |

## API Integration Standards

### 1. Official SDKs First
- When integrating upstream model providers (Google Gemini, OpenAI, Anthropic), use official, actively maintained SDKs (`@google/genai`, `openai`, `@anthropic-ai/sdk`).
- Validate parameter naming against current upstream API specs; avoid legacy or deprecated endpoints.

### 2. Robust Failure Handling & Retries
- Exponential backoff with jitter on network requests (429 Rate Limit and 5xx Server Errors).
- Graceful degradation with local fallbacks whenever remote services are unreachable.

### 3. Security & Secret Management
- API keys, credentials, and secrets must never be hardcoded into client bundles or version control.
- Read keys dynamically from environment variables (`process.env`) or secure local storage.
