# MYRAA Risk Register (Phase 0 — do not silently fix; each needs a decision)

## Privacy / safety (highest priority for Live Awareness)

1. **LAN-exposed capture routes.** Server binds `0.0.0.0`; `SENSITIVE_PREFIXES`/`AUTH_REQUIRED_PREFIXES` omit `/api/desktop/capture`, `/api/screen-vision`, `/api/screen/*`, `/api/desktop/windows`, `/api/vision/*`, `/api/screen-recording/*`. Any LAN client can pull screenshots without a token. FIX REQUIRED before any awareness feature: add these prefixes.
2. **Display-only consent flags.** `screenAwarenessEnabled` (default false, `server.cjs:534`) and `screen_capture` permission appear in status only; nothing gates capture routes. `MYRAA_PERMISSION_SCREEN_AWARENESS=false` blocks tools, not REST.
3. **WS video frames forward to Gemini with no server-side consent check** (`server.cjs:8136-8139`); trust boundary is the frontend SHARE button + OS picker only.
4. **Confirmation bridge fails open** (`server.cjs:3127-3163` resolves approved:true offline; nothing listens on 127.0.0.1:3010). File-mutation gate can auto-approve.
5. **Electron grants mic/camera/screen unconditionally** (`main.cjs:1253-1265` + `--use-fake-ui-for-media-stream` `:262`).
6. **Screenshots persist with no retention policy** (`%APPDATA%\MYRAA\recordings\screenshots`, `resources\recordings`, `Projects\ScreenCaptures`). Needs retention/redaction design (deletion itself needs user consent per AGENTS.md rule 2).
7. **Misleading tool contracts:** `analyzeScreenshot` returns image+window list, not OCR; unimplemented tools can return fake "completed successfully" (`server.cjs:5059`).

## Correctness / honesty

8. Apex router mounted twice (`server.cjs:5081` + `:8472`); `/api/memories` implemented twice (apex wins); `saveObservation` called but undefined; SQLite `sessions` table dead; PDF parser is regex-on-bytes; `verify_final_system.cjs` asserts stale version 9.3.0.
9. Hardcoded `D:\Team of Vishwajeet` paths (`secure_vault.cjs:236-237`, `myraa_v6_real_routes.cjs:326`) violate coding standards.
10. No `/api/usage|budget|cost` endpoint — cost tracked to `core_stats.json` but never surfaced; per-integration usage gate (`API-SECURITY-REVIEW.md:8`) unenforceable.

## Delivery

11. **This agent is read-only on the repo** (sandbox ACL: ReadAndExecute). Cannot create `docs/myraa-audit/`, cannot add/modify routers, cannot run `npm run build` or architecture-check. Audit docs staged at `%TEMP%\opencode\myraa-audit\`. Implementation needs user to grant write or apply patches manually.
12. No durable job queue, no migrations runner, no test framework — the vertical slice must introduce the smallest durable-job + schema pieces without forking new infra.
13. Server currently DOWN (port 3000 not listening as of last check) — verification of any runtime behavior needs the app running.
