# MYRAA AI OS — Project Architecture (Tauri Native + Module Preservation)

> Generated per Critical Preservation Directive — scan before modifying anything. All 8 modules kept 1:1.

## 1. Desktop Architecture (Native)

- Shell: **Tauri 2** `MYRAA/src-tauri/tauri.conf.json:4` `com.myraa.desktop` `frontendDist ../resources/app/dist` — WebView loads same Vite `dist/assets/index-qnLjC2CG.js` (no browser tabs).
- Windows: `main 1280x800 decorations:true` + `companion 380x580 transparent alwaysOnTop` `src-tauri/src/lib.rs:842` modes `full/compact/floating/background/tray` via `set_window_mode`.
- Tray: `myraa-tray` `Menu Open/Talk/Voice/Tasks/Status/Settings/Restart/Exit:916` left-click toggle, `Close→hide:929` (Discord-like), `single-instance:863`.
- Autostart: `tauri-plugin-autostart MacosLauncher:866` `off/background/full` default background-only after opt-in, `window-state` persists size/pos.
- Installer: `bundle nsis installMode both:32` → `MYRAA-Setup.exe` desktop+StartMenu, `updater` via GitHub releases.
- Build: `resources/app/package.json tauri:dev/tauri:build` `src-tauri/Cargo.toml myraa-ai-os@1.0.2` `capabilities/default.json` `tray singleInstance fs dialog`.

## 2. Agent Architecture

- Orchestrator + Tool Registry: `src-tauri/src/lib.rs invoke_handler:874` central `plugin_execute` dispatcher `plugin_id+action+payload` with permission check `DESTRUCTIVE→confirm:true`.
- Planning: GoalManager in-memory + `session_save/load:362` SQLite `myraa_memory.db` sessions table.
- Permission Engine: `permission_check` maps `delete/remove/deploy/commit → DESTRUCTIVE/CRITICAL` needs confirm; `system_control/fs delete` also `CONFIRM_REQUIRED:116`.
- Security Layer: vault `keyring VAULT_SERVICE com.myraa.desktop:158` + `vault_meta.json` (no secret), legacy `JARVIS/vault.json` scrubbed on `setup:900`.

## 3. Plugin Architecture (Unified)

- Interface: `connect() disconnect() healthCheck() getCapabilities() executeAction() refreshAuth() getLastError()` — single `plugin_execute: plugin_id+action` no second pattern.
- 8 tiles same UI pattern: `plugin_defs: plugin_list_defs` — Gmail/Salesforce/Excel/YouTube + **GitHub/Google Cloud/Figma/Canva** (vault-to-tile gap — already had creds).
- Health: `HEALTH LazyLock:516` `plugin_health_ping/list_health:518/546` 3 states `Connected & Verified / Degraded (reason) / Disconnected (Connect button)`. Runs on tab open + app startup + every 15min `dist/tauri-bridge.js healthInterval` + after auth/failed call. Stores `last_success` timestamp.
- CRUD: Gmail `send/draft_create/label_add/thread_list` Salesforce `create/update/delete` Excel `create_workbook/format_cells/add_chart` GitHub `repo_list/commit scoped repo-level` GCloud `project_status/deploy_trigger` Figma/Canva via `studio_figma/canva`.

## 4. Memory Architecture

- Store: `SQLite %APPDATA%/MYRAA/memory/myraa_memory.db:58` tables `memories(id,category,text,created_at,updated_at) sessions` `rusqlite bundled` + `stack-notes`.
- Categories: Identity/Preferences/Life/Active/Recalls (same view) → `memory_add/list/search/delete:286` `migrate_json:334` from old `memories.json`.
- Write-as-you-go: `session_touch` on every `memory_add/delete` + `session_save` after each Office asset / teach confirm.
- Session-resume: `setup session_touch app_launch:905` + `bridge session_load → __MYRAA_LAST_SESSION__` before first chat.
- Project linking: `studio_generate_office:725` writes `memory_add project "Generated asset …"` + SQLite `asset_*` for Active Projects next session.

## 5. Tool Registry (Capability Registry)

- Registry: `capability_list: capability_list` — `id/name/category/plugin/permissions/risk/status/last_success/health` ~12 capabilities (gmail.send SAFE_WRITE etc).
- Dashboard: `feature_truth_dashboard: REAL/PARTIAL/MOCK/PLANNED/FAILED` — GitHub REAL, Figma Push PARTIAL, Canva REAL etc. Prevents UI claiming 100 when 30 real.
- Health: `check ~/.agent-memory/global` before fix, log root-cause after (5. discipline).

## 6. 3D Avatar

- `three@0.180 + three-vrm` `resources/app/assets/characters/nia/Nai.vrm` Rive state machine `IDLE/LISTENING/THINKING/TALKING/HAPPY/CURIOUS/CONCERNED/ERROR/OFFLINE` driven by real states (mic active→listening, AI processing→thinking, API 1006→error), not decoration. Framer Motion for micro.

## 7. Voice

- Pipeline: STT `Whisper/faster-whisper` TTS `Fish Audio` `dist/apex_v5_routes.cjs Fish Audio sk-fish-…`, Gemini Live WS with `tauri-bridge.js WebSocket wrapper` exponential backoff 1006 vs 1008 auth distinction, `gemini_log_disconnect:816`. Wake-word moved from `document.hasFocus()` to tray background (`visibilitychange` log, Rust tray keeps process alive).

## 8. Security

- No plaintext: `vault_status plaintext_found:false` verified via `trash::delete` legacy; `keyring Entry::new(VAULT_SERVICE,id)` DPAPI. Secrets never in UI/logs/chat/memory/error. Destructive always `confirm:true`.

## 9. App Studio

- Aceternity UI Generator `Create Website/Mobile App` kept → `Projects/apex-web/index.html` BentoGrid scaffold; `studio_generate_office` real `docx` heading/TOC/table `xlsx` formulas+chart `pptx` Cinematic Glassmorphism theme `13.33x7.5` dark `0A0A0F cyan 00E5FF`; Figma `read_design tokens/components` `push_frame` Canva `brand kit` via MCP `studio_figma/canva`.

## 10. Integration

- Local: `list_local_dir/read/write` FS gated outside workspace, WiFi `netsh`, Bluetooth `Get-CimInstance`, brightness `WMI`, volume `powershell`, wallpaper `SystemParametersInfo`.
- Remote: ADB `adb_devices/command:774` tap/swipe/type/app_launch/pull/push scoped `adb_paired_device` vault.

## 11. Mobile Future

- Core shared: `MYRAA CORE` (AI logic/memory/API contracts/agent orchestration) → `WINDOWS Tauri / MACOS Tauri / MOBILE Capacitor` per arch doc. Not mixing mobile code now.

## Tool Quirks (stack-notes)

- `keyring 3` `Entry::set_password` per-user DPAPI, `get_password` NotFound → degraded.
- `netsh wlan show interfaces` parsing via `regex_find` without crate, Signal% line.
- `python -c` candidates `myraa_base/python/python.exe python python3` for Office fallback.
- `sysinfo` memory `total_memory/available_memory` GB calc, `host_name` fallback.
