# MYRAA Gesture Integration (Phase 15)

Protocol-level integration with a barehands-style board. **No vendored code**
— the board stays a separate process (AGPL-3.0 stays out of `dist/`).

## How it connects

| Direction | Mechanism |
|---|---|
| MYRAA -> ring face | Write `idle`/`listening`/`thinking`/`speaking` to the board's `state/` dir (`setRing`) |
| MYRAA -> board stage | `POST <board>/cmd` with `{a, title, body, src, ...}` (allowlisted verbs only) |
| MYRAA reads board | `GET <board>/board-state` (best-effort; UNKNOWN when absent) |
| Gestures -> MYRAA | `gesture_select/clear/dismiss/present/status` intents in `coding_orchestrator` |

Config: `MYRAA_BAREHANDS_URL` (default `http://127.0.0.1:8794`),
`MYRAA_BAREHANDS_STATE` (default `<cwd>/barehands/state`).

## Safety rules (enforced in code)

- Board verbs restricted to present/add_card/add_img/hand/explode/assemble/yank/hover/reset.
- `src` must be a relative path inside the media airlock (no `..`, no absolute paths).
- Camera runs in the browser page (MediaPipe client-side). MYRAA never sees raw
  video unless a session explicitly enables it — same consent posture as screen vision.
- `/api/gesture/*` is in `SENSITIVE_PREFIXES` (rate limit + LAN pair token).

## Setup (user runs the board)

1. `git clone https://github.com/jaredrhod/barehands`, `python3 server.py` (`run.bat` on Windows).
2. Open `stage.html` in Chrome, allow camera, confirm the ring tracks.
3. Restart MYRAA; say "show me on the board" / "board status".

## License

Board: AGPL-3.0 (separate process, unmodified use). Credit Jared Rhodenizer.
Commercial redistribution of modified board code needs license@jaredrhod.com.
