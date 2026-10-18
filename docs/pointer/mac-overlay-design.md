# MYRAA Pointer — Mac Hybrid Overlay Design (Phase 5)

Goal: bring the pointer character to macOS without porting all of MYRAA. MYRAA's Electron/Tauri app stays the brain; a small Swift menu-bar overlay provides the always-on-top pointer cursor and talks to MYRAA over the existing pairing protocol (`pointer_pairing.cjs`).

## Why hybrid (not full port)

- The pointer overlay is the only piece that needs a separate OS-level always-on-top window.
- Voice, notes, guardrails, and session state all live in MYRAA already.
- A Swift helper keeps the Mac surface small (~300 lines) and replaceable; if it fails, MYRAA still works without it.

## Architecture

```
macOS
  MYRAA (Electron/Tauri)  <-- existing, unchanged except pointer routes
    |
    | HTTP on 127.0.0.1:3000 (or MYRAA_PORT)
    | /api/pointer/session/*, /api/pairing/*
    v
  MYRAA Pointer Overlay (Swift, ~300 lines)
    - NSPanel / NSWindow .floating level, click-through when idle
    - Renders MYRAA avatar (or 2D indicator) at mouse position
    - Receives point/action commands from MYRAA
    - Sends press-and-hold mic events back via WS
```

## Swift helper responsibilities

1. Pair: discover MYRAA via Bonjour (`_myraa-pointer._tcp`), request `/api/pairing/secret`, present code to MYRAA.
2. Overlay: always-on-top transparent window; avatar follows mouse (follow mode) or docks (idle).
3. Point: on `POST /api/pointer/point`, move overlay cursor to grid position; brief highlight animation.
4. Voice: press-and-hold on overlay mic button -> WS to MYRAA `/live` -> reply streams to overlay bubble.
5. Stop: global hotkey (Cmd+Opt+S) -> `POST /api/pointer/session/stop`.

## MYRAA-side changes (already staged)

- `pointer_core.cjs` — text-id targeting, grid conversion, guardrails, cursor save/restore.
- `pointer_routes.cjs` — session/point/action endpoints.
- `pointer_voice.cjs` — press-and-hold state machine, chirp, bubble HTML.
- `pointer_notes.cjs` — meeting notes, diarization, agent prompt.
- `pointer_pairing.cjs` — 10-min secrets, single-use verify, discovery info.

## Security

- Secrets: 10-min TTL, single-use, SHA-256 hashed at rest, never logged (mirrors Bluey protocol).
- Overlay receives only minted secrets; the real OpenAI/Gemini key never leaves MYRAA backend.
- Computer-use actions go through MYRAA's `SafetyPolicy` + pointer confirmations.

## Testing

- Pairing logic: 10/10 (already green).
- Overlay: manual on macOS (SwiftUI preview + real device).
- Integration: MYRAA session start -> overlay pairs -> point -> voice reply -> notes stop.

## Files

- `docs/PRD-pointer-companion.md` — full PRD (phases 1-5).
- `resources/app/dist/pointer_*.cjs` — staged modules (phases 1-4).
- `docs/pointer-mac-overlay.swift` — Swift helper source (this phase).
