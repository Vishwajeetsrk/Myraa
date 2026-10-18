# MYRAA Dependency Map (Phase 0)

## Runtime dependencies

- Node 20 (buildMeta Electron 31.7.7 / Node 20 — `version.json`), Express, WS.
- Python (optional): `sqlite_memory_bridge.py` via spawnSync 3 s timeout with silent JSON fallback — SQLite durability NOT guaranteed if Python absent.
- Windows: System.Speech (TTS), Win32 APIs (foreground window, input), PowerShell (screenshots, UIA runner), Credential Manager (secret mirror), MachineGuid-bound vault.
- Cloud (all optional, honest fallback): Gemini, Groq, OpenRouter, Ollama (local), Tavily, GitHub.

## Key resolution order

`secrets.json` -> `process.env` -> encrypted vault (`vault_secrets.enc`, PBKDF2 MachineGuid+user, AES-256-GCM). Credential Manager is write-mirror only; nothing reads it back.

## New dependencies Course Studio would need (approval required)

1. Real PDF text extraction (pdf-parse or pdfplumber) — current "parser" is a raw-bytes regex.
2. Native Node OCR (tesseract binding or Windows.Media.Ocr via winrt) — current OCR only inside frozen agent binary.
3. Optional: Scrimba MCP client; video render deps already scaffolded via Remotion.
4. No new database: extend `sqlite_memory_bridge.py` commands + CREATE TABLE, or GoalManager-style atomic JSON.

## Files the vertical slice would ADD (not modify)

- `resources/app/dist/course_studio_routes.cjs` (new router)
- `resources/app/dist/course_studio_jobs.cjs` (job service: research-job steps + GoalManager persistence semantics)
- `resources/app/dist/course_studio_schema.cjs` (versioned Course/Module/Lesson/Scene/Narration/Quiz/Progress schemas + validation)
- `resources/app/dist/course_studio_ext.cjs` (frontend panel script, loaded beside avatar)
- `tests/test_course_studio.cjs` (ok/bad convention)
- `docs/myraa-audit/*` -> final home `docs/myraa-learning/*` (needs repo write access — currently read-only for this agent)

## Files that would need SMALL surgical edits (each needs explicit approval)

- `server.cjs`: mount new router (~2 lines after `:5074`); mount optional SSE/stream.
- `server_security.cjs`: add `/api/course-studio` mutating prefixes to SENSITIVE_PREFIXES.
- `myraa_v6_real_routes.cjs`: optional `/api/integrations` entry for Scrimba (only if approved).
- `sqlite_memory_bridge.py`: new commands + tables for courses/lessons/progress (or skip if JSON-file persistence chosen).
