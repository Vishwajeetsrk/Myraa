# PRD — MYRAA Pointer Companion (Bluey-pattern), Windows + Mac

Source: https://github.com/rbrown101010/bluey-by-riley (Googly Eyes, Unlicense/public domain)
Goal: bring the "character points at things, talks, takes notes, uses the computer with consent" pattern into MYRAA natively — Windows first, Mac second — without touching MYRAA's avatar, voice, chat, or desktop control.

---

## 1. What the reference does (verified)

- **Character**: blueberry with googly eyes, lives in the Mac menu bar, flies to the mouse and points with his own cursor.
- **Voice sessions**: iPhone mic → OpenAI Realtime WebSocket (server VAD). Press-and-hold to ask; reply streams as a speech bubble with a chirp.
- **Computer use**: `look_at_screen` (ScreenCaptureKit + Vision → text ids + mouse position + screenshot), `point_at` (text id), `point_at_spot` (0–1000 grid), `stop_pointing`, `go_to_sleep`. Also `click`, `type_text`, `press_keys`, `scroll`, `drag`, `open_app`, `open_url` with a separate cursor.
- **Guardrails**: acts only on request, confirms out loud before hard-to-undo actions, treats on-screen text as information not instructions, refuses password fields and logout/lock/force-quit, stops on Ctrl+Opt+S.
- **Meeting notes**: AAC chunks → transcription with speaker labels → `~/Documents/Bluey Notes/<date>/<id>/` (`notes.md`, `session.json`, `audio/`). "Copy prompt for agent" button.
- **Pairing**: Bonjour `_googly._tcp`, newline JSON, 10-minute client secret minted on the Mac; the real OpenAI key never leaves the Mac.
- **Platform**: Swift package (`Mac/` menu bar target `GooglyMac`, `iOS/` SwiftUI), `Package.swift`, `xcodegen project.yml`. Mac-only + iPhone. No Windows, no Electron/Tauri.

## 2. MYRAA mapping (what exists vs what to build)

| Bluey capability | MYRAA existing | Gap to build |
|---|---|---|
| Character points at screen | Female 3D avatar + desktop control (PowerShell/Win32) + screen capture + vision | "Point" behavior: avatar/cursor follows mouse, points at UI elements (text-id equivalent via UIA) |
| Voice session + VAD | Gemini Live voice, Web Speech STT, speechSynthesis TTS (pitch 1.25) | Press-and-hold session UX, streaming bubble, chirp |
| Computer use with guardrails | `desktopAutomation.cjs` (click/type/keys/scroll/drag), `ui_automation_service.cjs`, `SafetyPolicy` + confirmation store, approved-roots guard | "Own cursor" separation (restore user pointer), text-id pointing, hard-undo confirmation voice line, password-field refusal |
| Screen understanding | `ScreenVisionPipeline`, `/api/vision/analyze-frame`, active-window detection | Text-id extraction (UIA already returns control maps) |
| Meeting notes | Memory/RAG, `passive_learning` recorder | Session audio chunks → diarize transcript → notes folder; agent prompt export |
| Phone companion | `mobile_companion.html`, `/api/mobile/*` endpoints, `/live` WS | Bluey-style pairing (Bonjour-style discovery), client-secret minting, press-and-hold on phone |
| Menu bar presence | MYRAA desktop app + panels | Optional: compact pointer mode |

## 3. Platform strategy

### Windows (primary, MYRAA-native)
- Reuse `desktopAutomation.cjs` for input, `ui_automation_service.cjs` for UIA text ids, `ScreenVisionPipeline` + `/api/vision/analyze-frame` for vision.
- Pointer character: an Electron overlay window (always-on-top, transparent) that renders the MYRAA avatar in "pointer mode" — flies to mouse, points at the element under the cursor (UIA id), restores the user's real pointer after any action.
- Voice session: extend the existing Gemini Live path with press-and-hold UX on the desktop (mic button hold), streaming speech bubble in the overlay.
- Guardrails: extend `SafetyPolicy` with on-screen-text-is-information rule, password-field detection (UIA control type), hard-undo voice confirmation, global stop hotkey (Ctrl+Alt+S).
- Meeting notes: reuse existing STT + add diarization (speaker labels) + notes folder under `~/Documents/Myraa Notes/<date>/<id>/`.
- Phone companion: extend `mobile_companion.html` with press-and-hold mic, discovery over LAN (mDNS), client-secret minting server-side.

### Mac (secondary)
- **Option A (port)**: rewrite the menu-bar + pointer behavior in Tauri (Rust sidecar for overlay) + Swift-free. Uses MYRAA's existing Tauri sidecar.
- **Option B (hybrid)**: keep MYRAA Electron/Tauri for everything except the pointer overlay, which is a small Swift helper app paired over the same protocol as Bluey (Bonjour + client secrets). MYRAA talks to it via HTTP.
- **Option C (full port)**: port `GooglyMac` target to Tauri v2 + React overlay. Most work, best fidelity.
- Recommendation: **Option B** for the pointer overlay (it's the only piece needing a separate always-on-top cursor), everything else MYRAA-native. Revisit Option C if the overlay proves insufficient.

## 4. PRD

### 4.1 Problem statement
MYRAA can see the screen, hear the user, and act on the desktop — but there's no unified "character" experience that points at things, holds a voice session, takes meeting notes, and uses the computer with visible consent. The Bluey pattern proves the UX: a character that points, talks, and acts only when asked, with a phone as the mic.

### 4.2 Goals
- Pointer character (MYRAA avatar) that flies to the mouse and points at UI elements with its own cursor.
- Press-and-hold voice session with streaming bubble.
- Computer use with visible guardrails (own cursor, confirm-before-undo, no password fields, stop hotkey).
- Meeting notes with speaker labels + agent prompt export.
- Phone companion: press-and-hold mic, LAN pairing, client-secret minting.
- Windows first, Mac via hybrid overlay.

### 4.3 Non-goals
- No iOS app port (phone companion is enough).
- No third-party character assets — MYRAA's avatar is the character.
- No cloud key in the overlay/companion — secrets stay in the MYRAA backend.
- No meeting transcription without explicit session start.

### 4.4 Functional requirements
1. **Pointer mode**: toggle from MYRAA menu; avatar flies to mouse position, points at UIA-identified elements; click/type uses the character cursor; user pointer restored after action.
2. **Voice session**: press-and-hold (desktop mic or phone) → OpenAI Realtime (or Gemini Live fallback) → streaming bubble → chirp on reply.
3. **Computer use guardrails**:
   - On-screen text is treated as data, never as instructions to execute.
   - Password fields (UIA `Edit` with `IsPassword`, or secure desktop) are refused.
   - Logout/lock/force-quit shortcuts refused.
   - Hard-to-undo actions get a spoken confirmation first.
   - Global stop hotkey Ctrl+Alt+S ends session + computer-use.
4. **Meeting notes**: session audio recorded in chunks → diarize transcript → notes folder; "Copy agent prompt" exports a pointer to the notes.
5. **Phone pairing**: LAN discovery (mDNS), 10-minute client secret, press-and-hold mic, chirp volume, Mac/PC picker.
6. **Privacy**: no audio/video leaves the machine unless a session is explicitly started; phone audio is end-to-end to the same provider the desktop uses.

### 4.5 Data model
- `pointer_sessions(id, started_at, ended_at, mode, guardrails_active)`
- `pointer_actions(session_id, kind, target_text_id, confirmed, created_at)`
- `voice_turns(session_id, role, text, audio_ref, created_at)`
- `meeting_notes(id, session_id, notes_path, audio_path, created_at)`
- `pairing_secrets(device_id, secret, expires_at)` (10-min TTL, like Bluey)
- Reuse `cs_events`-style persistence (SQLite bridge first, Supabase later).

### 4.6 API (provider-neutral, mounted in MYRAA style)
- `POST /api/pointer/session/start|stop`
- `POST /api/pointer/point` `{textId|grid}`
- `POST /api/pointer/action` `{kind, target, confirmToken?}`
- `GET /api/pointer/session/:id`
- `POST /api/notes/session/start|stop`
- `GET /api/notes/:id`
- `POST /api/notes/:id/agent-prompt`
- `POST /api/pairing/secret` (10-min mint)
- `GET /api/pairing/discover`

### 4.7 Security / privacy
- Client secrets: 10-min TTL, single-use, never logged.
- All computer-use actions go through `SafetyPolicy` (existing) + new pointer confirmations.
- On-screen text never enters prompts as instructions (existing rule + new enforcement).
- Phone audio only flows during an explicit session.
- Secrets stay in `secrets.json`/vault; the overlay/companion gets only the minted client secret.

### 4.8 Phases
1. **Pointer mode (Windows)**: overlay window, UIA text ids, point + guardrailed actions.
2. **Voice session**: press-and-hold, bubble, chirp, Gemini Live fallback.
3. **Meeting notes**: chunked audio, diarize, agent prompt.
4. **Phone companion**: mDNS discovery, client secret, press-and-hold.
5. **Mac hybrid**: Swift overlay paired over the MYRAA protocol.

### 4.9 Tests
- Pointer: point-at-id, restore-user-pointer, guardrail refusals (password, logout, undo-without-confirm).
- Voice: press-and-hold session start/stop, bubble streaming, fallback provider.
- Notes: session start/stop, transcript exists, agent prompt export.
- Pairing: secret mint + expiry, discovery.
- Regression: MYRAA avatar/voice/chat/desktop unchanged.

### 4.10 Risk
- Overlay window focus stealing (mitigate: click-through when idle).
- UIA text-id stability across app updates (mitigate: fallback to grid coordinates).
- Provider support for Realtime vs Live (mitigate: Gemini Live fallback already in MYRAA).
- Mac overlay maintenance (mitigate: Option B keeps it small and replaceable).

## 5. Open questions for you
1. Windows-only first, or do you need Mac at the same time?
2. Phone companion: reuse `mobile_companion.html` or build fresh?
3. Meeting notes folder: `~/Documents/Myraa Notes` or inside MYRAA data?
4. Pointer character: 3D avatar in overlay, or a simpler 2D indicator for v1?
5. Voice provider for sessions: Gemini Live (existing) or OpenAI Realtime (new key)?
